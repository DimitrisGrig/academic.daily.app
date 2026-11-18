from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
import schemas, models, user_models
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from database import get_local_db
import uuid

router = APIRouter(prefix="/groups", tags=["groups"])

MAX_GROUPS_AS_ADMIN = 20


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_member(group: models.Group, user_id: str) -> bool:
    members = group.members or []
    return any(m["user_id"] == user_id and m["status"] == "active" for m in members)


def _is_invited(group: models.Group, user_id: str) -> bool:
    members = group.members or []
    return any(m["user_id"] == user_id and m["status"] == "invited" for m in members)


def _is_admin(group: models.Group, user_id: str) -> bool:
    """Returns True if user is the owner or has been promoted to admin."""
    if group.admin_user_id == user_id:
        return True
    members = group.members or []
    return any(m["user_id"] == user_id and m.get("role") == "admin" and m["status"] == "active" for m in members)


def _notify_group_invite(db: Session, invited_user_id: str, group: models.Group, inviter_name: str):
    """Create a group invite notification for the invited user."""
    notif = models.Notifications(
        user_id=invited_user_id,
        message=f"{inviter_name} invited you to join the group \u201c{group.name}\u201d. Accept or decline below.",
        is_read=False,
        notification_type="group_invite",
        notification_metadata={
            "group_key": group.key,
            "group_name": group.name,
            "group_icon": group.icon,
            "inviter_name": inviter_name,
        },
    )
    db.add(notif)


# ---------------------------------------------------------------------------
# GET endpoints
# ---------------------------------------------------------------------------

@router.get("/get_groups")
def get_groups(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Return all groups where the current user is admin or active member."""
    user_id = current_user["user_id"]

    all_groups = db.query(models.Group).all()

    result = []
    for g in all_groups:
        is_admin = g.admin_user_id == user_id
        members = g.members or []
        is_active_member = any(m["user_id"] == user_id and m["status"] == "active" for m in members)

        is_extra_admin = any(m["user_id"] == user_id and m.get("role") == "admin" and m["status"] == "active" for m in members)

        if is_admin or is_active_member or is_extra_admin:
            member_count = 1 + len([m for m in members if m["status"] == "active"])
            result.append({
                "key": g.key,
                "name": g.name,
                "icon": g.icon,
                "admin_user_id": g.admin_user_id,
                "is_admin": is_admin or is_extra_admin,
                "member_count": member_count,
                "members": members,
                "is_public": g.is_public if g.is_public is not None else False,
                "tags": g.tags or [],
                "notifications_muted": g.notifications_muted or [],
                "created_at": g.created_at.isoformat() if g.created_at else None,
            })

    return {"groups": result}


@router.get("/get_public_groups")
def get_public_groups(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Return all public groups with member count and shared article count."""
    user_id = current_user["user_id"]

    all_groups = db.query(models.Group).filter(models.Group.is_public == True).all()

    result = []
    for g in all_groups:
        members = g.members or []
        active_member_count = len([m for m in members if m["status"] == "active"])
        member_count = 1 + active_member_count  # +1 for admin

        article_count = (
            db.query(models.GroupSharedArticle)
            .filter(models.GroupSharedArticle.group_key == g.key)
            .count()
        )

        is_member = g.admin_user_id == user_id or any(
            m["user_id"] == user_id and m["status"] == "active" for m in members
        )

        result.append({
            "key": g.key,
            "name": g.name,
            "icon": g.icon,
            "tags": g.tags or [],
            "member_count": member_count,
            "article_count": article_count,
            "is_member": is_member,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })

    # Sort by member count descending
    result.sort(key=lambda x: x["member_count"], reverse=True)

    return {"groups": result}


@router.get("/get_pending_invites")
def get_pending_invites(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Return groups where the current user has a pending invite."""
    user_id = current_user["user_id"]

    all_groups = db.query(models.Group).all()
    result = []
    for g in all_groups:
        members = g.members or []
        if any(m["user_id"] == user_id and m["status"] == "invited" for m in members):
            result.append({
                "key": g.key,
                "name": g.name,
                "icon": g.icon,
                "admin_user_id": g.admin_user_id,
            })

    return {"invites": result}


@router.get("/get_shared_articles")
def get_shared_articles(group_key: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Return articles shared in a group. Caller must be member or admin."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.admin_user_id != user_id and not _is_member(group, user_id):
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    shared = (
        db.query(models.GroupSharedArticle)
        .filter(models.GroupSharedArticle.group_key == group_key)
        .order_by(models.GroupSharedArticle.shared_at.desc())
        .all()
    )

    article_ids = [s.article_id for s in shared]
    shared_by_map = {s.article_id: s.shared_by_user_id for s in shared}
    shared_at_map = {s.article_id: s.shared_at for s in shared}

    if not article_ids:
        return {"articles": []}

    articles = db.query(models.Articles).filter(models.Articles.id.in_(article_ids)).all()

    # Build sharer-name map: prefer stored name, fall back to DB lookup
    sharer_name_stored_map = {s.article_id: (s.shared_by_name or "") for s in shared}
    sharer_ids = [uid for uid in set(shared_by_map.values()) if uid]
    fallback_name_map: dict[str, str] = {}
    if sharer_ids:
        sharers = db.query(user_models.User).filter(user_models.User.clerk_user_id.in_(sharer_ids)).all()
        fallback_name_map = {
            u.clerk_user_id: f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
            for u in sharers
        }

    # Get user's upvoted articles
    user_upvotes = db.query(models.UserUpvotes.article_id).filter(
        models.UserUpvotes.user_id == user_id,
        models.UserUpvotes.article_id.in_(article_ids),
    ).all()
    upvoted_article_ids = {upvote[0] for upvote in user_upvotes} if user_upvotes else set()

    # Get user's clicked/read articles
    user_clicks = db.query(models.UserArticleClicks.article_id).filter(
        models.UserArticleClicks.user_id == user_id,
        models.UserArticleClicks.article_id.in_(article_ids),
    ).all()
    read_article_ids = {click[0] for click in user_clicks} if user_clicks else set()

    # Get comment counts for articles
    comment_counts_query = db.query(
        models.Comment.article_id,
        func.count(models.Comment.id).label('comments_count')
    ).filter(
        models.Comment.article_id.in_(article_ids)
    ).group_by(models.Comment.article_id).all()
    comments_count_map = {article_id: count for article_id, count in comment_counts_query}

    result = []
    for article in articles:
        stored_name = sharer_name_stored_map.get(article.id, "")
        sharer_uid = shared_by_map.get(article.id, "")
        display_name = stored_name or fallback_name_map.get(sharer_uid, "") or "Unknown"
        result.append({
            "id": article.id,
            "title": article.title,
            "abstract": article.abstract,
            "journal": article.journal,
            "publication_date": article.publication_date.isoformat() if article.publication_date else None,
            "authors_full": article.authors_full,
            "doi": article.doi,
            "pmid": article.pmid,
            "is_open_access_unpaywall": article.is_open_access_unpaywall,
            "graphical_abstract_path": article.graphical_abstract_path,
            "upvotes": article.upvotes,
            "user_has_upvoted": article.id in upvoted_article_ids,
            "user_has_read": article.id in read_article_ids,
            "comments_count": comments_count_map.get(article.id, 0),
            "shared_by_user_id": shared_by_map.get(article.id),
            "shared_by_name": display_name,
            "created_at": shared_at_map[article.id].isoformat() if shared_at_map.get(article.id) else None,
        })

    # Sort by shared_at descending (preserve order from shared list)
    result.sort(key=lambda a: article_ids.index(a["id"]))

    return {"articles": result}


# ---------------------------------------------------------------------------
# POST endpoints
# ---------------------------------------------------------------------------

@router.post("/create_group")
def create_group(data: schemas.CreateGroup, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Create a new group. Admin limit of 10 groups per user."""
    user_id = current_user["user_id"]

    # Check admin limit
    admin_count = db.query(models.Group).filter(models.Group.admin_user_id == user_id).count()
    if admin_count >= MAX_GROUPS_AS_ADMIN:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum limit of {MAX_GROUPS_AS_ADMIN} groups reached. Please delete a group to create a new one."
        )

    group_key = f"group_{uuid.uuid4().hex[:10]}"

    # Resolve invite emails to users
    members = []
    invited_users = []  # list of (user_id, email) for notification
    for email in data.invite_emails:
        email = email.strip().lower()
        if not email:
            continue
        existing_user = db.query(user_models.User).filter(user_models.User.email == email).first()
        if existing_user and existing_user.clerk_user_id != user_id:
            members.append({
                "user_id": existing_user.clerk_user_id,
                "email": existing_user.email,
                "status": "invited",
            })
            invited_users.append(existing_user.clerk_user_id)

    group = models.Group(
        key=group_key,
        name=data.name.strip(),
        icon=data.icon,
        admin_user_id=user_id,
        members=members if members else [],
        is_public=data.is_public,
        tags=data.tags,
    )
    db.add(group)
    db.flush()  # get group persisted so we can reference it in notifications

    # Look up inviter's display name
    inviter = db.query(user_models.User).filter(user_models.User.clerk_user_id == user_id).first()
    inviter_name = (
        f"{inviter.first_name or ''} {inviter.last_name or ''}".strip()
        if inviter else "A user"
    ) or (inviter.email if inviter else "A user")

    # Create notifications for all invited users
    for invited_uid in invited_users:
        _notify_group_invite(db, invited_uid, group, inviter_name)

    db.commit()
    db.refresh(group)

    return {
        "message": "Group created successfully",
        "group": {
            "key": group.key,
            "name": group.name,
            "icon": group.icon,
            "admin_user_id": group.admin_user_id,
            "is_admin": True,
            "member_count": 1,
            "members": group.members,
            "is_public": group.is_public,
            "tags": group.tags or [],
        },
    }


@router.post("/delete_group")
def delete_group(data: schemas.DeleteGroup, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Delete a group. Admin only."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.admin_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the group admin can delete this group")

    # Delete shared articles and group comments first
    db.query(models.GroupSharedArticle).filter(models.GroupSharedArticle.group_key == data.key).delete()
    db.query(models.GroupComment).filter(models.GroupComment.group_key == data.key).delete()
    db.delete(group)
    db.commit()

    return {"message": "Group deleted successfully"}


@router.post("/update_group")
def update_group(data: schemas.UpdateGroup, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Update group name/icon. Admin only."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not _is_admin(group, user_id):
        raise HTTPException(status_code=403, detail="Only a group admin can update this group")

    if data.name is not None:
        group.name = data.name.strip()
    if data.icon is not None:
        group.icon = data.icon
    if data.is_public is not None:
        # Only the owner can change visibility
        if group.admin_user_id != user_id:
            raise HTTPException(status_code=403, detail="Only the group owner can change visibility")
        group.is_public = data.is_public
    if data.tags is not None:
        group.tags = data.tags
        flag_modified(group, "tags")

    db.commit()
    return {"message": "Group updated successfully"}


@router.post("/invite_members")
def invite_members(data: schemas.InviteGroupMembers, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Invite users to a group by email. Admin only."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not _is_admin(group, user_id):
        raise HTTPException(status_code=403, detail="Only a group admin can invite members")

    members = list(group.members or [])
    existing_ids = {m["user_id"] for m in members}

    invited = []
    not_found = []
    new_invited_uids = []

    for email in data.emails:
        email = email.strip().lower()
        if not email:
            continue
        target_user = db.query(user_models.User).filter(user_models.User.email == email).first()
        if not target_user:
            not_found.append(email)
            continue
        if target_user.clerk_user_id == user_id:
            continue  # Skip admin self-invite
        if target_user.clerk_user_id in existing_ids:
            continue  # Already invited or member

        members.append({
            "user_id": target_user.clerk_user_id,
            "email": target_user.email,
            "status": "invited",
        })
        invited.append(email)
        new_invited_uids.append(target_user.clerk_user_id)

    group.members = members
    flag_modified(group, "members")

    # Look up inviter's display name
    inviter = db.query(user_models.User).filter(user_models.User.clerk_user_id == user_id).first()
    inviter_name = (
        f"{inviter.first_name or ''} {inviter.last_name or ''}".strip()
        if inviter else "A user"
    ) or (inviter.email if inviter else "A user")

    # Create notifications for newly invited users
    for invited_uid in new_invited_uids:
        _notify_group_invite(db, invited_uid, group, inviter_name)

    db.commit()

    return {
        "message": f"Invited {len(invited)} user(s)",
        "invited": invited,
        "not_found": not_found,
    }


@router.post("/remove_member")
def remove_member(data: schemas.RemoveGroupMember, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Remove a member from a group. Admin only."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not _is_admin(group, user_id):
        raise HTTPException(status_code=403, detail="Only a group admin can remove members")
    if data.user_id == group.admin_user_id:
        raise HTTPException(status_code=400, detail="Cannot remove the group owner")

    members = [m for m in (group.members or []) if m["user_id"] != data.user_id]
    group.members = members
    flag_modified(group, "members")
    db.commit()

    return {"message": "Member removed"}


@router.post("/accept_invite")
def accept_invite(data: schemas.AcceptGroupInvite, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Accept a group invitation."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = list(group.members or [])
    found = False
    updated = []
    for m in members:
        if m["user_id"] == user_id and m["status"] == "invited":
            updated.append({**m, "status": "active"})
            found = True
        else:
            updated.append(m)

    if not found:
        raise HTTPException(status_code=400, detail="No pending invite found for this user")

    group.members = updated
    flag_modified(group, "members")
    db.commit()

    return {"message": "Invite accepted"}


@router.post("/decline_invite")
def decline_invite(data: schemas.AcceptGroupInvite, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Decline a group invitation."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = [m for m in (group.members or []) if not (m["user_id"] == user_id and m["status"] == "invited")]
    group.members = members
    flag_modified(group, "members")
    db.commit()

    return {"message": "Invite declined"}


@router.post("/leave_group")
def leave_group(data: schemas.LeaveGroup, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Leave a group (non-admin members only)."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.admin_user_id == user_id:
        raise HTTPException(status_code=400, detail="Admin cannot leave the group. Delete it instead.")

    members = [m for m in (group.members or []) if m["user_id"] != user_id]
    group.members = members
    flag_modified(group, "members")
    db.commit()

    return {"message": "Left group successfully"}


@router.post("/share_article")
def share_article(data: schemas.ShareArticleToGroup, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Share an article to a group."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.admin_user_id != user_id and not _is_member(group, user_id):
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    # Check article exists
    article = db.query(models.Articles).filter(models.Articles.id == data.article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Prevent duplicate shares
    existing = (
        db.query(models.GroupSharedArticle)
        .filter(
            models.GroupSharedArticle.group_key == data.group_key,
            models.GroupSharedArticle.article_id == data.article_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Article already shared in this group")

    shared = models.GroupSharedArticle(
        group_key=data.group_key,
        article_id=data.article_id,
        shared_by_user_id=user_id,
        shared_by_name=data.shared_by_name or None,
    )
    db.add(shared)
    db.commit()

    # ── Notify other group members ──────────────────────────────────────
    muted = set(group.notifications_muted or [])
    sharer_display = data.shared_by_name or "A member"
    article_title = (article.title or "an article")[:120]

    # Collect all user_ids who should be notified (owner + active members, minus sharer & muted)
    recipient_ids: list[str] = []
    if group.admin_user_id != user_id and group.admin_user_id not in muted:
        recipient_ids.append(group.admin_user_id)
    for m in (group.members or []):
        mid = m["user_id"]
        if mid != user_id and m["status"] == "active" and mid not in muted:
            recipient_ids.append(mid)

    for rid in set(recipient_ids):
        notif = models.Notifications(
            user_id=rid,
            message=f'{sharer_display} shared "{article_title}" in {group.name}.',
            is_read=False,
            notification_type="group_article_shared",
            notification_metadata={
                "group_key": group.key,
                "group_name": group.name,
                "group_icon": group.icon,
                "article_id": data.article_id,
                "shared_by_name": sharer_display,
            },
        )
        db.add(notif)
    db.commit()

    return {"message": "Article shared successfully"}


@router.post("/remove_shared_article")
def remove_shared_article(data: schemas.RemoveSharedArticle, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Remove a shared article. Admin or the sharer can remove."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    shared = (
        db.query(models.GroupSharedArticle)
        .filter(
            models.GroupSharedArticle.group_key == data.group_key,
            models.GroupSharedArticle.article_id == data.article_id,
        )
        .first()
    )
    if not shared:
        raise HTTPException(status_code=404, detail="Shared article not found")

    if not _is_admin(group, user_id) and shared.shared_by_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only an admin or the sharer can remove this article")

    db.delete(shared)
    db.commit()

    return {"message": "Article removed from group"}


@router.post("/promote_to_admin")
def promote_to_admin(data: schemas.PromoteGroupMember, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Promote an active member to admin role. Only the group owner can promote."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.admin_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the group owner can promote members to admin")
    if data.user_id == user_id:
        raise HTTPException(status_code=400, detail="You are already the group owner")

    members = list(group.members or [])
    target = next((m for m in members if m["user_id"] == data.user_id and m["status"] == "active"), None)
    if not target:
        raise HTTPException(status_code=404, detail="Active member not found")

    updated = [{**m, "role": "admin"} if m["user_id"] == data.user_id else m for m in members]
    group.members = updated
    flag_modified(group, "members")
    db.commit()

    return {"message": "Member promoted to admin"}


@router.post("/demote_from_admin")
def demote_from_admin(data: schemas.DemoteGroupMember, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Remove admin role from a member. Only the group owner can demote."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.admin_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the group owner can demote admins")

    members = list(group.members or [])
    updated = [{**m, "role": "member"} if m["user_id"] == data.user_id and m.get("role") == "admin" else m for m in members]
    group.members = updated
    flag_modified(group, "members")
    db.commit()

    return {"message": "Admin role removed"}


# ---------------------------------------------------------------------------
# Group Comments
# ---------------------------------------------------------------------------

@router.get("/get_group_comments")
def get_group_comments(group_key: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Get all comments for a group (newest first). User must be a member."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.admin_user_id != user_id and not _is_member(group, user_id):
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    comments = (
        db.query(models.GroupComment)
        .filter(models.GroupComment.group_key == group_key)
        .order_by(models.GroupComment.created_at.desc())
        .all()
    )

    return {
        "comments": [schemas.GroupCommentResponse.from_orm(c) for c in comments],
        "count": len(comments),
    }


@router.post("/add_group_comment")
def add_group_comment(data: schemas.GroupCommentCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Add a comment to a group discussion. User must be a member."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.admin_user_id != user_id and not _is_member(group, user_id):
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    if not data.comment_text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    user = db.query(user_models.User).filter(user_models.User.clerk_user_id == user_id).first()
    first_name = user.first_name or "" if user else ""
    last_name = user.last_name or "" if user else ""

    comment = models.GroupComment(
        group_key=data.group_key,
        user_id=user_id,
        first_name=first_name,
        last_name=last_name,
        comment_text=data.comment_text.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {
        "success": True,
        "comment": schemas.GroupCommentResponse.from_orm(comment),
    }


@router.post("/update_group_comment")
def update_group_comment(data: schemas.GroupCommentUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Edit a group comment. Only the author can edit."""
    user_id = current_user["user_id"]

    comment = db.query(models.GroupComment).filter(models.GroupComment.id == data.comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")
    if not data.comment_text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    comment.comment_text = data.comment_text.strip()
    db.commit()
    db.refresh(comment)

    return {
        "success": True,
        "comment": schemas.GroupCommentResponse.from_orm(comment),
    }


@router.post("/delete_group_comment")
def delete_group_comment(data: schemas.GroupCommentDelete, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Delete a group comment. Author can delete their own; admins can delete any."""
    user_id = current_user["user_id"]

    comment = db.query(models.GroupComment).filter(models.GroupComment.id == data.comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    is_author = comment.user_id == user_id
    is_group_admin = _is_admin(group, user_id)

    if not is_author and not is_group_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    db.delete(comment)
    db.commit()

    return {"success": True, "message": "Comment deleted"}


# ---------------------------------------------------------------------------
# Notification preferences
# ---------------------------------------------------------------------------

@router.post("/toggle_group_notifications")
def toggle_group_notifications(data: schemas.ToggleGroupNotifications, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Toggle article-share notifications for the current user in a group."""
    user_id = current_user["user_id"]

    group = db.query(models.Group).filter(models.Group.key == data.group_key).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.admin_user_id != user_id and not _is_member(group, user_id):
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    muted = list(group.notifications_muted or [])

    if data.muted:
        if user_id not in muted:
            muted.append(user_id)
    else:
        muted = [uid for uid in muted if uid != user_id]

    group.notifications_muted = muted
    flag_modified(group, "notifications_muted")
    db.commit()

    return {"success": True, "muted": data.muted}
