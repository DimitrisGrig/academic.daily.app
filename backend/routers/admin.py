import os
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Header, HTTPException, Depends
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, distinct, case, and_
from database import get_local_db
from vector_store.FAISS import clear_faiss_cache, get_cache_stats
from auth import get_current_user, verify_admin_user
from fnc import get_GMT
import models
import user_models

load_dotenv()

ADMIN_CLERK_USER_ID = os.getenv("ADMIN_CLERK_USER_ID")

router = APIRouter(prefix="/admin", tags=["admin"])


def verify_admin_secret(x_admin_secret: str = Header(...)):
    """
    Simple header-based admin authentication.
    Pass the secret as: X-Admin-Secret: <value>
    """
    expected = os.getenv("ADMIN_SECRET_KEY")
    if not expected:
        raise HTTPException(status_code=503, detail="Admin secret not configured on server.")
    if not secrets.compare_digest(x_admin_secret.encode(), expected.encode()):
        raise HTTPException(status_code=403, detail="Invalid admin secret.")


@router.get("/check")
def check_admin(current_user: dict = Depends(get_current_user)):
    """Check if the current user is an admin."""
    return {"is_admin": current_user.get("user_id") == ADMIN_CLERK_USER_ID}


@router.get("/dashboard", dependencies=[Depends(verify_admin_user)])
def get_admin_dashboard(db: Session = Depends(get_local_db)):
    """
    Admin dashboard data: journal suggestions, testimonials, and last update time.
    Only accessible by the admin user.
    """
    # --- Journal Suggestions ---
    suggestions = (
        db.query(models.JournalSuggestion)
        .order_by(desc(models.JournalSuggestion.created_at))
        .all()
    )
    suggestions_list = []
    for s in suggestions:
        # Look up user email
        user = db.query(user_models.User).filter(
            user_models.User.clerk_user_id == s.clerk_user_id
        ).first()
        suggestions_list.append({
            "id": s.id,
            "clerk_user_id": s.clerk_user_id,
            "user_email": user.email if user else "Unknown",
            "first_name": user.first_name if user else None,
            "last_name": user.last_name if user else None,
            "journal_name_or_issn": s.journal_name_or_issn,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    # --- Testimonials ---
    testimonials = (
        db.query(models.Testimonial)
        .order_by(desc(models.Testimonial.created_at))
        .all()
    )
    testimonials_list = []
    for t in testimonials:
        user = db.query(user_models.User).filter(
            user_models.User.clerk_user_id == t.clerk_user_id
        ).first()
        testimonials_list.append({
            "id": t.id,
            "clerk_user_id": t.clerk_user_id,
            "user_email": user.email if user else "Unknown",
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else "Unknown",
            "rating": t.rating,
            "testimonial_text": t.testimonial_text,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    # --- Last update time ---
    last_update = db.query(func.max(models.Articles.created_at)).scalar()

    # --- Recent logins (from log_routes, last 48 hours) ---
    gmt_offset = get_GMT()
    now = datetime.utcnow() + timedelta(hours=gmt_offset)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_48h = now - timedelta(hours=48)

    # Get distinct users with their most recent activity in last 48h
    recent_activity = (
        db.query(
            models.LogRoutes.username,
            func.max(models.LogRoutes.datetime).label("last_seen"),
            func.count(models.LogRoutes.id).label("request_count"),
        )
        .filter(
            models.LogRoutes.datetime >= cutoff_48h,
            models.LogRoutes.username != "anonymous",
            models.LogRoutes.username != None,
            models.LogRoutes.username != "",
            models.LogRoutes.username != ADMIN_CLERK_USER_ID,
        )
        .group_by(models.LogRoutes.username)
        .order_by(desc(func.max(models.LogRoutes.datetime)))
        .all()
    )

    recent_logins = []
    for row in recent_activity:
        username = row.username
        last_seen = row.last_seen
        period = "24h" if last_seen >= cutoff_24h else "48h"
        
        # Look up user details - username may be an email or a clerk user ID
        if username.startswith("user_"):
            user = db.query(user_models.User).filter(
                user_models.User.clerk_user_id == username
            ).first()
        else:
            user = db.query(user_models.User).filter(
                user_models.User.email == username
            ).first()

        email = user.email if user and user.email else username
        
        # Skip entries with empty email
        if not email or not email.strip():
            continue

        recent_logins.append({
            "email": email,
            "first_name": user.first_name if user else None,
            "last_name": user.last_name if user else None,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "request_count": row.request_count,
            "period": period,
        })

    return {
        "journal_suggestions": suggestions_list,
        "testimonials": testimonials_list,
        "last_update": last_update.isoformat() if last_update else None,
        "recent_logins": recent_logins,
    }


@router.get("/monthly-active-users", dependencies=[Depends(verify_admin_user)])
def get_monthly_active_users(db: Session = Depends(get_local_db)):
    """
    Returns daily distinct active user counts for the past 30 days.
    A user is considered active if they made at least one request on that day.
    """
    gmt_offset = get_GMT()
    now = datetime.utcnow() + timedelta(hours=gmt_offset)
    cutoff = now - timedelta(days=60)

    rows = (
        db.query(
            func.date(models.LogRoutes.datetime).label("day"),
            func.count(distinct(models.LogRoutes.username)).label("active_users"),
        )
        .filter(
            models.LogRoutes.datetime >= cutoff,
            models.LogRoutes.username != "anonymous",
            models.LogRoutes.username != None,
            models.LogRoutes.username != "",
            models.LogRoutes.username != ADMIN_CLERK_USER_ID,
        )
        .group_by(func.date(models.LogRoutes.datetime))
        .order_by(func.date(models.LogRoutes.datetime))
        .all()
    )

    return [{"date": str(row.day), "active_users": row.active_users} for row in rows]


@router.post("/clear_faiss_cache", dependencies=[Depends(verify_admin_secret)], summary="Clear FAISS in-memory index cache",
    description=(
        "Clears the in-process FAISS index cache so the next search reloads "
        "the index file from disk. Also invalidates every user's DB-level "
        "FAISS results cache so fresh article IDs are served immediately."
    ))
def clear_faiss_cache_endpoint(db: Session = Depends(get_local_db)):
    # 1. Clear in-memory FAISS index cache
    stats_before = get_cache_stats()
    clear_faiss_cache()

    # 2. Invalidate per-user DB-level FAISS results cache
    updated_rows = (
        db.query(models.Feeds)
        .filter(models.Feeds.faiss_results_cache.isnot(None))
        .update(
            {
                models.Feeds.faiss_results_cache: None,
                models.Feeds.faiss_cache_date_created: None,
            },
            synchronize_session=False,
        )
    )
    db.commit()

    return {
        "status": "ok",
        "faiss_index_cache_cleared": stats_before["count"],
        "cleared_indices": stats_before["cached_indices"],
        "user_feed_caches_invalidated": updated_rows,
        "message": (
            "In-memory FAISS index cache cleared. "
            f"Invalidated {updated_rows} user feed cache(s). "
            "Next recommendations request will reload the index and recompute results."
        ),
    }


@router.get("/faiss_cache_stats", dependencies=[Depends(verify_admin_secret)], summary="Get FAISS in-memory cache statistics")
def faiss_cache_stats():
    """Returns which FAISS indexes are currently loaded in memory."""
    return get_cache_stats()


# ────────────────────────────────────────────────────────────────
#  Feature Announcements  (admin CRUD + user-facing endpoints)
# ────────────────────────────────────────────────────────────────

from pydantic import BaseModel
from typing import List


class FeatureAnnouncementCreate(BaseModel):
    title: str
    bullets: List[str]


@router.get("/announcements", dependencies=[Depends(verify_admin_user)])
def list_announcements(db: Session = Depends(get_local_db)):
    """List all feature announcements (newest first)."""
    rows = (
        db.query(models.FeatureAnnouncement)
        .order_by(desc(models.FeatureAnnouncement.created_at))
        .all()
    )
    return [
        {
            "id": r.id,
            "title": r.title,
            "bullets": r.bullets,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/announcements", dependencies=[Depends(verify_admin_user)])
def create_announcement(body: FeatureAnnouncementCreate, db: Session = Depends(get_local_db)):
    """Create a new feature announcement."""
    row = models.FeatureAnnouncement(
        title=body.title,
        bullets=body.bullets,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "title": row.title,
        "bullets": row.bullets,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.delete("/announcements/{announcement_id}", dependencies=[Depends(verify_admin_user)])
def delete_announcement(announcement_id: int, db: Session = Depends(get_local_db)):
    """Delete a feature announcement."""
    row = db.query(models.FeatureAnnouncement).filter(
        models.FeatureAnnouncement.id == announcement_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.patch("/announcements/{announcement_id}/toggle", dependencies=[Depends(verify_admin_user)])
def toggle_announcement(announcement_id: int, db: Session = Depends(get_local_db)):
    """Toggle active/inactive status of an announcement."""
    row = db.query(models.FeatureAnnouncement).filter(
        models.FeatureAnnouncement.id == announcement_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    row.is_active = not row.is_active
    db.commit()
    return {"id": row.id, "is_active": row.is_active}


@router.get("/announcements/unseen")
def get_unseen_announcements(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """
    Return the latest active announcement that the user has NOT yet seen.
    If a user hasn't logged in for a long time, they only see the single
    most recent active announcement (not a backlog).
    """
    user_id = current_user.get("user_id")

    # IDs the user has already dismissed
    seen_ids = (
        db.query(models.FeatureAnnouncementSeen.announcement_id)
        .filter(models.FeatureAnnouncementSeen.clerk_user_id == user_id)
        .subquery()
    )

    # Latest active announcement the user hasn't seen
    latest = (
        db.query(models.FeatureAnnouncement)
        .filter(
            models.FeatureAnnouncement.is_active == True,
            ~models.FeatureAnnouncement.id.in_(seen_ids),
        )
        .order_by(desc(models.FeatureAnnouncement.created_at))
        .first()
    )

    if not latest:
        return None

    return {
        "id": latest.id,
        "title": latest.title,
        "bullets": latest.bullets,
        "created_at": latest.created_at.isoformat() if latest.created_at else None,
    }


@router.post("/announcements/{announcement_id}/seen")
def mark_announcement_seen(
    announcement_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """Mark an announcement as seen by the current user."""
    user_id = current_user.get("user_id")

    # Avoid duplicates
    existing = (
        db.query(models.FeatureAnnouncementSeen)
        .filter(
            models.FeatureAnnouncementSeen.clerk_user_id == user_id,
            models.FeatureAnnouncementSeen.announcement_id == announcement_id,
        )
        .first()
    )
    if not existing:
        db.add(models.FeatureAnnouncementSeen(
            clerk_user_id=user_id,
            announcement_id=announcement_id,
        ))
        # Also mark ALL older announcements as seen so the user
        # never gets shown a backlog after a long absence.
        older = (
            db.query(models.FeatureAnnouncement)
            .filter(
                models.FeatureAnnouncement.id < announcement_id,
                models.FeatureAnnouncement.is_active == True,
            )
            .all()
        )
        for ann in older:
            already = (
                db.query(models.FeatureAnnouncementSeen)
                .filter(
                    models.FeatureAnnouncementSeen.clerk_user_id == user_id,
                    models.FeatureAnnouncementSeen.announcement_id == ann.id,
                )
                .first()
            )
            if not already:
                db.add(models.FeatureAnnouncementSeen(
                    clerk_user_id=user_id,
                    announcement_id=ann.id,
                ))
        db.commit()

    return {"status": "ok"}
