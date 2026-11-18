"""
Mail Digests Router
===================
Endpoints
---------
GET  /mail-digests/subscription          – get current user's subscription status
POST /mail-digests/subscription          – subscribe / unsubscribe (toggle or explicit)
GET  /mail-digests/unsubscribe           – one-click unsubscribe via token (no auth, linked from email)
POST /mail-digests/send                  – manually trigger digest send (admin only)

Digest logic
------------
* For each subscribed user, find the top-5 articles that match their feed tags
  but have NOT been viewed/clicked by that user.
* Emails are sent via Resend API (HTTPS port 443 – works on all servers/VPS).

Environment variables required
-------------------------------
RESEND_API_KEY    get free key at resend.com (3,000 emails/month free)
FRONTEND_URL      https://app.daily-academic.com   (for unsubscribe links)
DIGEST_FROM       Daily Academic <digest@newsletter.daily-academic.com>

Optional
--------
DIGEST_ALWAYS_SEND_TO   comma-separated emails that always get the digest (skip the inactivity rule)
ENABLE_DIGEST_PREVIEW   set to "true" to enable GET /mail-digests/preview (keep off in production)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_local_db
from auth import get_current_user, verify_admin_user
import user_models
import models
from typing import Optional
import secrets
import os
import resend
from datetime import datetime, timedelta
from dotenv import load_dotenv
from email_templates import build_digest_email, build_plain_text_digest

load_dotenv()

router = APIRouter(prefix="/mail-digests", tags=["mail-digests"])

resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_ADDRESS = os.getenv("DIGEST_FROM", "Daily Academic <digest@newsletter.daily-academic.com>")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.daily-academic.com")
ALWAYS_SEND_TO = {e.strip().lower() for e in os.getenv("DIGEST_ALWAYS_SEND_TO", "").split(",") if e.strip()}
ENABLE_DIGEST_PREVIEW = os.getenv("ENABLE_DIGEST_PREVIEW", "").lower() == "true"
MAX_ARTICLES = 10          # upper bound — never send more than this
MIN_ARTICLES = 3          # lower bound — don't send if fewer relevant articles found
SIMILARITY_THRESHOLD = 0.6   # FAISS cosine similarity floor for "significant" relevance
INACTIVE_DAYS = 7         # only email users who haven't logged in for this many days
RECENCY_DAYS = 45         # only consider articles published in the last 45 days
INCLUDE_CUSTOM_FEEDS = False  # True = also search custom feeds for relevant articles; False = main feed only


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ensure_unsubscribe_token(user: user_models.User, db: Session) -> str:
    """Return existing token or create a fresh one for the user."""
    if not user.unsubscribe_token:
        user.unsubscribe_token = secrets.token_urlsafe(32)
        db.commit()
    return user.unsubscribe_token


def _send_email(to_email: str, subject: str, html_body: str, plain_body: str, unsubscribe_url: str) -> None:
    """Send a single email via Resend API (HTTPS — no SMTP port needed)."""
    resend.Emails.send({
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
        "text": plain_body,
        "headers": {
            "List-Unsubscribe": f"<{unsubscribe_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "Precedence": "bulk",
        },
    })


def _get_relevant_unread_articles(clerk_user_id: str, db: Session, limit: int = MAX_ARTICLES) -> list[dict]:
    """
    Find up to `limit` articles that:
    1. Match the user's main feed tags (FAISS cache or tag-based SQL) AND/OR
       any custom feeds the user has created (via FAISS on each feed's embeddings)
    2. Have NOT been clicked / viewed by this user
    3. Were published within the last RECENCY_DAYS days
    4. Are ranked by WOS impact factor — highest first
    """
    # Get user's feed record (main feed + custom feeds)
    feed = db.query(models.Feeds).filter(
        models.Feeds.clerk_user_id == clerk_user_id
    ).first()

    if not feed or not feed.main_feed_tags:
        return []

    tags: list[str] = feed.main_feed_tags  # e.g. ["CRISPR", "Machine Learning", ...]

    # Get article IDs already clicked by the user
    clicked_ids_rows = db.query(models.UserArticleClicks.article_id).filter(
        models.UserArticleClicks.user_id == clerk_user_id
    ).all()
    clicked_ids = {row[0] for row in clicked_ids_rows}

    # Get article IDs already sent to the user in a previous digest
    sent_ids_rows = db.query(models.DigestSentArticle.article_id).filter(
        models.DigestSentArticle.clerk_user_id == clerk_user_id
    ).all()
    sent_ids = {row[0] for row in sent_ids_rows}

    # Combine both sets — never include clicked OR previously-sent articles
    exclude_ids = clicked_ids | sent_ids

    recency_cutoff = datetime.utcnow() - timedelta(days=RECENCY_DAYS)

    # ── Collect candidate article IDs from all sources ────────────────────────
    candidate_ids: set[int] = set()

    # Source 1: main feed FAISS cache
    if feed.faiss_results_cache:
        raw_cache = feed.faiss_results_cache
        for entry in raw_cache:
            if isinstance(entry, dict):
                aid = entry.get("article_id")
                score = entry.get("similarity_score", 0.0)
            else:
                aid = entry  # legacy: plain int, no score — treat as significant
                score = 1.0
            if aid is not None and score >= SIMILARITY_THRESHOLD and int(aid) not in exclude_ids:
                candidate_ids.add(int(aid))

        # Cap the main-feed contribution so FAISS doesn't crowd out custom feeds
        candidate_ids = set(list(candidate_ids)[: limit * 4])

    else:
        # Fallback: text-based tag matching for main feed
        from sqlalchemy import or_
        conditions = [
            models.Articles.mesh_terms.ilike(f"%{tag}%")
            for tag in tags[:10]
        ] + [
            models.Articles.title.ilike(f"%{tag}%")
            for tag in tags[:5]
        ]
        query = db.query(models.Articles.id).filter(or_(*conditions))
        if exclude_ids:
            query = query.filter(~models.Articles.id.in_(exclude_ids))
        sql_ids = [row[0] for row in query.filter(
            models.Articles.publication_date >= recency_cutoff
        ).all()]
        candidate_ids.update(sql_ids)

    # Source 2: custom feeds (FAISS on each feed's embeddings)
    custom_feeds = feed.feeds or []
    if INCLUDE_CUSTOM_FEEDS and custom_feeds:
        import numpy as np
        from vector_store.FAISS import search_similar_articles

        for custom_feed in custom_feeds:
            embeddings = custom_feed.get("embeddings")
            if not embeddings:
                continue
            query_vec = np.array(embeddings, dtype=np.float32)
            faiss_results = search_similar_articles(
                query_embedding=query_vec,
                k=limit * 4,
                index_type="flat",
            )
            for result in faiss_results:
                aid = result.get("article_id")
                score = result.get("similarity_score", 0.0)
                if aid is not None and score >= SIMILARITY_THRESHOLD and int(aid) not in exclude_ids:
                    candidate_ids.add(int(aid))

    # ── Fetch articles, apply recency filter ──────────────────────────────────
    articles = (
        db.query(models.Articles)
        .filter(
            models.Articles.id.in_(candidate_ids),
            models.Articles.publication_date >= recency_cutoff,
        )
        .all()
    )

    if len(articles) < MIN_ARTICLES:
        return []

    # ── WOS impact factor lookup ───────────────────────────────────────────────
    issns = list({a.issn for a in articles if a.issn})
    wos_map: dict[str, float] = {}
    if issns:
        wos_rows = (
            db.query(models.WosJournalsClarivateRankings.issn, models.WosJournalsClarivateRankings.journal_impact_factor)
            .filter(models.WosJournalsClarivateRankings.issn.in_(issns))
            .all()
        )
        wos_map = {row.issn: row.journal_impact_factor for row in wos_rows if row.journal_impact_factor}

    def _is_open_access(a) -> bool:
        return bool(
            a.is_open_access_unpaywall
            or a.is_open_access_semanticscholar
            or a.is_open_access_europepmc
        )

    # Rank by impact factor (highest first); articles without a WOS entry go last
    ranked = sorted(
        articles,
        key=lambda a: wos_map.get(a.issn or "", 0.0) or 0.0,
        reverse=True,
    )

    return [
        {
            "id": a.id,
            "title": a.title,
            "journal": a.journal,
            "abstract": a.abstract,
            "doi": a.doi,
            "authors_full": a.authors_full,
            "publication_date": a.publication_date,
            "graphical_abstract_path": a.graphical_abstract_path,
            "is_open_access": _is_open_access(a),
            "publication_type": a.publication_type or "",
            "impact_factor": wos_map.get(a.issn or "", None),
        }
        for a in ranked[:limit]
    ]


def _send_digest_to_user(user: user_models.User, db: Session) -> bool:
    """Send a digest email to a single user. Returns True on success."""
    # Rule 1 — skip users who have been active in the last INACTIVE_DAYS days
    from sqlalchemy import func as sqlfunc
    activity_cutoff = datetime.utcnow() - timedelta(days=INACTIVE_DAYS)
    last_activity = (
        db.query(sqlfunc.max(models.UserArticleClicks.clicked_at))
        .filter(models.UserArticleClicks.user_id == user.clerk_user_id)
        .scalar()
    )
    
    if user.email and user.email.lower() in ALWAYS_SEND_TO:
        pass  # Always send to addresses listed in DIGEST_ALWAYS_SEND_TO
    elif last_activity and last_activity > activity_cutoff:
        return False  # user was active recently — they don't need a nudge

    articles = _get_relevant_unread_articles(user.clerk_user_id, db)
    if not articles:
        return False

    token = _ensure_unsubscribe_token(user, db)
    unsubscribe_url = f"{FRONTEND_URL}/unsubscribe?token={token}"

    subject, html_body = build_digest_email(
        user_first_name=user.first_name or "",
        articles=articles,
        unsubscribe_url=unsubscribe_url,
        send_date=datetime.utcnow(),
    )
    plain_body = build_plain_text_digest(
        user_first_name=user.first_name or "",
        articles=articles,
        unsubscribe_url=unsubscribe_url,
        send_date=datetime.utcnow(),
    )

    _send_email(user.email, subject, html_body, plain_body, unsubscribe_url)

    # Record which articles were sent so they are never included again
    for article in articles:
        db.add(models.DigestSentArticle(
            clerk_user_id=user.clerk_user_id,
            article_id=article["id"],
        ))
    db.commit()

    return True


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/subscription")
async def get_subscription_status(db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    """Return whether the current user is subscribed to the weekly digest."""
    user_id = current_user.get("user_id")
    email = current_user.get("email") or ""
    user = db.query(user_models.User).filter(
        user_models.User.clerk_user_id == user_id
    ).first()

    if not user:
        # User hasn't been synced from Clerk yet — create a minimal row on the fly
        user = user_models.User(
            clerk_user_id=user_id,
            email=email,
            email_digest_subscribed=True,
            unsubscribe_token=secrets.token_urlsafe(32),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "subscribed": user.email_digest_subscribed if user.email_digest_subscribed is not None else True
    }


@router.post("/subscription")
async def update_subscription(subscribed: bool, db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    """Subscribe (subscribed=true) or unsubscribe (subscribed=false) from the weekly digest."""
    user_id = current_user.get("user_id")
    email = current_user.get("email") or ""
    user = db.query(user_models.User).filter(
        user_models.User.clerk_user_id == user_id
    ).first()

    if not user:
        # Auto-create on first preference change
        user = user_models.User(
            clerk_user_id=user_id,
            email=email,
            email_digest_subscribed=subscribed,
            unsubscribe_token=secrets.token_urlsafe(32),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.email_digest_subscribed = subscribed
        _ensure_unsubscribe_token(user, db)
        db.commit()

    return {"subscribed": user.email_digest_subscribed, "message": "Preference saved."}


@router.get("/unsubscribe")
async def one_click_unsubscribe(token: str = Query(..., description="Unsubscribe token embedded in email link"), db: Session = Depends(get_local_db)):
    """
    Public endpoint (no authentication required).
    Called when the user clicks the unsubscribe link in the digest email.
    """
    user = db.query(user_models.User).filter(
        user_models.User.unsubscribe_token == token
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="Invalid or expired unsubscribe token.")

    user.email_digest_subscribed = False
    db.commit()

    return {
        "message": "You have been unsubscribed from the Daily Academic weekly digest.",
        "email": user.email,
    }


@router.post("/send")
async def send_digests(background_tasks: BackgroundTasks, test_email: Optional[str] = Query(None, description="Send a test digest to this email only"), db: Session = Depends(get_local_db), current_user: dict = Depends(verify_admin_user),):
    """
    Trigger the weekly digest send for ALL subscribed users (or a single test recipient).
    Runs in the background so the HTTP response is immediate.
    """

    def _run_all(test_email_override: Optional[str]):
        _db = next(get_local_db())
        try:
            if test_email_override:
                users = _db.query(user_models.User).filter(
                    user_models.User.email == test_email_override,
                    user_models.User.is_active == True,
                    user_models.User.deleted_account == False,
                ).all()
            else:
                users = _db.query(user_models.User).filter(
                    user_models.User.email_digest_subscribed == True,
                    user_models.User.is_active == True,
                    user_models.User.deleted_account == False,
                ).all()

            sent = 0
            skipped = 0
            errors = 0

            for user in users:
                try:
                    ok = _send_digest_to_user(user, _db)
                    if ok:
                        sent += 1
                    else:
                        skipped += 1
                except Exception as exc:
                    errors += 1
                    print(f"[MailDigest] Error sending to {user.email}: {exc}")

            print(f"[MailDigest] Digest run complete – sent:{sent} skipped:{skipped} errors:{errors}")
        finally:
            _db.close()

    background_tasks.add_task(_run_all, test_email)
    return {"message": "Digest send job started in background."}


# ── SAMPLE DATA used by the preview endpoint ──────────────────────────────────
_PREVIEW_ARTICLES = [
    {
        "id": 56167,
        "title": "CRISPR-Cas9 genome editing in neurodegenerative disease: recent advances",
        "journal": "Nature Neuroscience",
        "abstract": (
            "We review recent progress in applying CRISPR-based tools to correct pathogenic variants "
            "associated with Alzheimer and Parkinson disease, including in vivo delivery strategies "
            "and off-target safety profiles. New base-editing and prime-editing variants extend the "
            "therapeutic window while minimising double-strand breaks."
        ),
        "doi": "10.1038/s41593-025-01234-5",
        "authors_full": "Zhang, L.; Patel, R.; Müller, K.; Okonkwo, A.; Fernandez, M.",
        "publication_date": datetime(2026, 2, 15),
        "graphical_abstract_path": None,
        "is_open_access": True,
        "publication_type": "Review",
        "impact_factor": 24.1,
    },
    {
        "id": 56200,
        "title": "Machine learning prediction of drug-target interactions at scale",
        "journal": "Cell Systems",
        "abstract": (
            "A transformer-based model trained on 42 million drug-protein pairs achieves "
            "state-of-the-art performance on binding affinity prediction benchmarks, enabling "
            "rapid virtual screening of novel compound libraries against unexplored target space."
        ),
        "doi": "10.1016/j.cels.2026.01.008",
        "authors_full": "Kim, S.; Nguyen, T.; Osei, P.",
        "publication_date": datetime(2026, 2, 10),
        "graphical_abstract_path": None,
        "is_open_access": False,
        "publication_type": "Journal Article",
        "impact_factor": 11.8,
    },
    {
        "id": 56250,
        "title": "Single-cell RNA sequencing reveals heterogeneity in tumour microenvironments",
        "journal": "Cancer Cell",
        "abstract": (
            "scRNA-seq profiling of 120 patient samples identifies seven distinct immune-cell "
            "subtypes correlated with immunotherapy response, providing a roadmap for personalised "
            "oncology treatment decisions."
        ),
        "doi": "10.1016/j.ccell.2026.01.015",
        "authors_full": "Li, W.; Sharma, P.; Costa, A.; Andersen, B.; Wu, Q.; Ibrahim, F.",
        "publication_date": datetime(2026, 2, 5),
        "graphical_abstract_path": None,
        "is_open_access": True,
        "publication_type": None,
        "impact_factor": 48.8,
    },
    {
        "id": 56300,
        "title": "Epigenetic clocks and biological ageing: translational implications",
        "journal": "The Lancet",
        "abstract": (
            "DNA methylation-based epigenetic clocks show strong concordance with chronological age "
            "and predict age-related disease onset up to 10 years in advance, opening avenues for "
            "early intervention strategies in geriatric medicine."
        ),
        "doi": "10.1016/S0140-6736(26)00123-4",
        "authors_full": "Reyes, C.; Nakamura, H.; Bello, F.",
        "publication_date": datetime(2026, 1, 28),
        "graphical_abstract_path": None,
        "is_open_access": False,
        "publication_type": "Review",
        "impact_factor": None,
    },
    {
        "id": 56350,
        "title": "Microbiome–gut–brain axis: mechanisms and therapeutic targets",
        "journal": "Nature Reviews Neuroscience",
        "abstract": (
            "This review summarises emerging evidence linking gut microbial composition to "
            "neuroinflammation, mood disorders, and cognitive function, and evaluates probiotic, "
            "prebiotic, and faecal microbiota transplantation as therapeutic strategies."
        ),
        "doi": "10.1038/s41583-026-00987-1",
        "authors_full": "Dubois, M.; Olawale, S.; Petrov, I.; Chen, X.",
        "publication_date": datetime(2026, 1, 20),
        "graphical_abstract_path": None,
        "is_open_access": True,
        "publication_type": "Journal Article",
        "impact_factor": 28.7,
    },
]


@router.get("/preview", response_class=None)
async def preview_digest(name: str = Query("Dimitris", description="First name shown in greeting"), articles: int = Query(5, ge=1, le=5, description="Number of sample articles to show")):
    """
    ──────────────────────────────────────────────────────────────
    PREVIEW ONLY — no email is sent.
    Open in browser:  http://localhost:8007/mail-digests/preview
    ──────────────────────────────────────────────────────────────
    Renders the exact HTML that would be emailed so you can tweak
    email_templates.py and refresh to see changes instantly.

    Query params
    ------------
    ?name=Dimitris   change the greeting name
    ?articles=3      show 1-5 sample articles
    """
    from fastapi.responses import HTMLResponse

    if not ENABLE_DIGEST_PREVIEW:
        raise HTTPException(status_code=404, detail="Not Found")

    unsubscribe_url = f"{FRONTEND_URL}/unsubscribe?token=preview_token"
    _, html_body = build_digest_email(
        user_first_name=name,
        articles=_PREVIEW_ARTICLES[:articles],
        unsubscribe_url=unsubscribe_url,
        send_date=datetime.now(),
    )

    # Wrap with a thin grey shell so it looks like an inbox preview
    preview_wrapper = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Email Preview</title>
  <style>
    body {{ margin: 0; padding: 0; background: #ffffff; font-family: Arial, sans-serif; }}
    .toolbar {{
      position: sticky; top: 0; z-index: 999;
      background: #1e293b; color: #f1f5f9;
      padding: 10px 20px; display: flex; align-items: center; gap: 16px;
      font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.4);
    }}
    .toolbar strong {{ color: #818cf8; font-size: 15px; }}
    .toolbar a {{ color: #94a3b8; text-decoration: none; }}
    .toolbar a:hover {{ color: #e2e8f0; }}
    .badge {{
      background: #4f46e5; color: white; border-radius: 20px;
      padding: 2px 10px; font-size: 11px; font-weight: bold;
    }}
    .email-frame {{ max-width: 660px; margin: 24px auto 48px; box-shadow: 0 4px 24px rgba(0,0,0,.2); }}
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>✉ Email Preview</strong>
    <span class="badge">NO EMAIL SENT</span>
    <span>Edit <code>backend/email_templates.py</code> then refresh</span>
    <span style="margin-left:auto;">
      <a href="?name={name}&articles=1">1 article</a> &nbsp;|&nbsp;
      <a href="?name={name}&articles=3">3 articles</a> &nbsp;|&nbsp;
      <a href="?name={name}&articles=5">5 articles</a>
    </span>
  </div>
  <div class="email-frame">
    {html_body}
  </div>
</body>
</html>"""

    return HTMLResponse(content=preview_wrapper, status_code=200)