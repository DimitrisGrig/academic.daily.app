from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from vector_store.FAISS import search_similar_bioarchive_articles
import models
import schemas
from sqlalchemy.orm import Session
from database import get_local_db
from datetime import datetime, timezone, timedelta
import numpy as np

router = APIRouter(prefix="/bioarchive", tags=["bioarchive"])


@router.get("/get_article/{article_id}")
def get_bioarchive_article_by_id(
    article_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """Fetch a single BioArchive article by its ID."""
    article = db.query(models.ArticlesBioArchive).filter(models.ArticlesBioArchive.id == article_id).first()

    if not article:
        raise HTTPException(status_code=404, detail=f"BioArchive article with ID {article_id} not found")

    user_has_upvoted = (
        db.query(models.UserBioArchiveUpvotes)
        .filter(
            models.UserBioArchiveUpvotes.user_id == current_user["user_id"],
            models.UserBioArchiveUpvotes.article_id == article_id,
        )
        .first()
        is not None
    )

    user_has_read = (
        db.query(models.UserBioArchiveClicks)
        .filter(
            models.UserBioArchiveClicks.user_id == current_user["user_id"],
            models.UserBioArchiveClicks.article_id == article_id,
        )
        .first()
        is not None
    )

    return {
        "id": article.id,
        "title": article.title,
        "authors": article.authors,
        "author_corresponding": article.author_corresponding,
        "author_corresponding_institution": article.author_corresponding_institution,
        "doi": article.doi,
        "date_posted": str(article.date_posted) if article.date_posted else None,
        "created_at": str(article.created_at),
        "updated_at": str(article.updated_at),
        "version": article.version,
        "publication_type": article.publication_type,
        "license": article.license,
        "category": article.category,
        "abstract": article.abstract,
        "published": article.published,
        "server": article.server,
        "upvotes": article.upvotes or 0,
        "user_has_upvoted": user_has_upvoted,
        "user_has_read": user_has_read,
        "similarity_score": 0.0,
    }


@router.get("/get_recommended_by_faiss")
def get_bioarchive_recommended(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
    k: int = 1000,
    cache_expiry: int = 2,
    force_refresh: bool = False,
    sort_mode: str = "smart_shuffle",
):
    """
    Get BioArchive article recommendations based on the user's main feed embeddings via FAISS.

    Uses the same embedding vector as the Main Feed so no extra onboarding is required.
    Results are sorted according to sort_mode:
      - smart_shuffle: weighted randomisation favouring higher similarity (default)
      - similarity: pure cosine similarity ordering (deterministic)
      - date: published date ordering, newest first (deterministic)

    Uses intelligent caching (same pattern as the main feed):
    - FAISS results (article IDs + scores) are cached in `feeds.faiss_bioarchive_results_cache`
    - Cache is invalidated when older than `cache_expiry` hours or when force_refresh=True
    - Article rows are always fetched fresh from the DB so metadata stays up to date
    - Embeddings are NEVER returned to the browser
    """
    if k > 1000:
        raise HTTPException(status_code=400, detail="k cannot exceed 1000.")
    k = max(k, 1)

    import time
    start_time = time.time()

    # Re-use the user's main feed embeddings — no separate onboarding needed
    feed = (
        db.query(models.Feeds)
        .filter(models.Feeds.clerk_user_id == current_user["user_id"])
        .first()
    )

    if feed is None or feed.main_feed_embeddings is None:
        raise HTTPException(
            status_code=400,
            detail="User has not completed onboarding or has no embeddings.",
        )

    # ── Cache validity check ────────────────────────────────────────────────
    cache_is_fresh = False
    if feed.faiss_bioarchive_cache_date_created is not None:
        cache_created = feed.faiss_bioarchive_cache_date_created
        if cache_created.tzinfo is None:
            cache_created = cache_created.replace(tzinfo=timezone.utc)
        cache_age = datetime.now(timezone.utc) - cache_created
        cache_is_fresh = cache_age < timedelta(hours=cache_expiry)
        if not cache_is_fresh:
            print(f"⏰ [BioArchive] Cache expired (age: {cache_age.total_seconds() / 3600:.1f}h)")

    use_cache = (
        not force_refresh
        and feed.faiss_bioarchive_results_cache is not None
        and len(feed.faiss_bioarchive_results_cache) > 0
        and cache_is_fresh
    )

    if use_cache:
        print("📦 [BioArchive] Using cached FAISS results")
        faiss_results = feed.faiss_bioarchive_results_cache
    else:
        print("🔍 [BioArchive] Computing FAISS results...")
        query_embedding = np.array(feed.main_feed_embeddings, dtype=np.float32)
        faiss_results = search_similar_bioarchive_articles(
            query_embedding=query_embedding, k=k, index_type="flat"
        )

        if not faiss_results:
            return []

        # Persist the cache (only IDs + scores, never embeddings)
        feed.faiss_bioarchive_results_cache = faiss_results
        feed.faiss_bioarchive_cache_date_created = datetime.now(timezone.utc)
        db.commit()
        print(f"💾 [BioArchive] Cached {len(faiss_results)} FAISS results (expires in {cache_expiry}h)")

    # ── Build lookup structures ─────────────────────────────────────────────
    article_ids = [r["article_id"] for r in faiss_results]
    similarity_map: dict[int, float] = {
        r["article_id"]: r["similarity_score"] for r in faiss_results
    }

    # Fetch matching BioArchive articles — explicitly exclude embeddings_biobert
    rows = (
        db.query(
            models.ArticlesBioArchive.id,
            models.ArticlesBioArchive.title,
            models.ArticlesBioArchive.authors,
            models.ArticlesBioArchive.author_corresponding,
            models.ArticlesBioArchive.author_corresponding_institution,
            models.ArticlesBioArchive.doi,
            models.ArticlesBioArchive.date_posted,
            models.ArticlesBioArchive.created_at,
            models.ArticlesBioArchive.updated_at,
            models.ArticlesBioArchive.version,
            models.ArticlesBioArchive.publication_type,
            models.ArticlesBioArchive.license,
            models.ArticlesBioArchive.category,
            models.ArticlesBioArchive.abstract,
            models.ArticlesBioArchive.published,
            models.ArticlesBioArchive.server,
            models.ArticlesBioArchive.upvotes,
        )
        .filter(models.ArticlesBioArchive.id.in_(article_ids))
        .all()
    )

    articles_dict: dict[int, any] = {row.id: row for row in rows}

    # Get per-user upvotes and reads for this user
    user_upvoted_ids: set[int] = {
        r.article_id
        for r in db.query(models.UserBioArchiveUpvotes.article_id)
        .filter(models.UserBioArchiveUpvotes.user_id == current_user["user_id"])
        .all()
    }
    user_read_ids: set[int] = {
        r.article_id
        for r in db.query(models.UserBioArchiveClicks.article_id)
        .filter(models.UserBioArchiveClicks.user_id == current_user["user_id"])
        .all()
    }

    # Assemble results in FAISS similarity order
    results = []
    for article_id in article_ids:
        if article_id not in articles_dict:
            continue
        row = articles_dict[article_id]
        results.append(
            {
                "id": row.id,
                "title": row.title,
                "authors": row.authors,
                "author_corresponding": row.author_corresponding,
                "author_corresponding_institution": row.author_corresponding_institution,
                "doi": row.doi,
                "date_posted": row.date_posted,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "version": row.version,
                "publication_type": row.publication_type,
                "license": row.license,
                "category": row.category,
                "abstract": row.abstract,
                "published": row.published,
                "server": row.server,
                "upvotes": row.upvotes or 0,
                "user_has_upvoted": article_id in user_upvoted_ids,
                "user_has_read": article_id in user_read_ids,
                "similarity_score": similarity_map[article_id],
            }
        )

    # ── Sorting ──────────────────────────────────────────────────────────────
    if sort_mode == "smart_shuffle":
        import random

        for article in results:
            base_score = article["similarity_score"]
            random_factor = random.uniform(0.85, 1.15)
            article["_shuffle_score"] = base_score * random_factor

        results.sort(key=lambda x: x["_shuffle_score"], reverse=True)

        for article in results:
            del article["_shuffle_score"]

    elif sort_mode == "date":
        results.sort(key=lambda x: x["date_posted"] or datetime.min, reverse=True)

    # Default / "similarity": keep FAISS order (already sorted by cosine similarity desc)

    execution_time = time.time() - start_time
    cache_status = "cached" if use_cache else "computed"

    if use_cache and feed.faiss_bioarchive_cache_date_created:
        cache_created = feed.faiss_bioarchive_cache_date_created
        if cache_created.tzinfo is None:
            cache_created = cache_created.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - cache_created).total_seconds() / 3600
        print(f"✅ [BioArchive] Returned {len(results)} articles in {execution_time:.2f}s "
              f"({cache_status}, age: {age_hours:.1f}h, sort: {sort_mode})")
    else:
        print(f"✅ [BioArchive] Returned {len(results)} articles in {execution_time:.2f}s "
              f"({cache_status}, sort: {sort_mode})")

    return results


@router.post("/upvote")
def upvote_bioarchive_article(
    data: schemas.BioArchiveUpvoteData,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """
    Upvote (or undo an upvote for) a BioArchive article.
    Mirrors the behaviour of /user_actions/upvote for regular articles.
    """
    article = db.query(models.ArticlesBioArchive).filter(models.ArticlesBioArchive.id == data.article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="BioArchive article not found")

    if article.upvotes is None:
        article.upvotes = 0

    existing = (
        db.query(models.UserBioArchiveUpvotes)
        .filter(
            models.UserBioArchiveUpvotes.user_id == current_user["user_id"],
            models.UserBioArchiveUpvotes.article_id == data.article_id,
        )
        .first()
    )

    if data.undo:
        if existing:
            article.upvotes = max(0, article.upvotes - 1)
            db.delete(existing)
        # If no existing upvote, undo is a no-op
    else:
        if not existing:
            article.upvotes += 1
            db.add(
                models.UserBioArchiveUpvotes(
                    user_id=current_user["user_id"],
                    article_id=data.article_id,
                )
            )
        # If already upvoted, this is a no-op (idempotent)

    db.commit()

    # After commit: user_has_upvoted is True unless we just successfully undid it
    user_has_upvoted = not (data.undo and existing)

    return {
        "success": True,
        "article_id": data.article_id,
        "upvotes": article.upvotes,
        "user_has_upvoted": user_has_upvoted,
    }


@router.post("/article_click")
def click_bioarchive_article(
    data: schemas.BioArchiveClickData,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """
    Track that the current user has opened/read a BioArchive article.
    Only inserts a new row on first click; subsequent clicks update the timestamp.
    """
    existing = (
        db.query(models.UserBioArchiveClicks)
        .filter(
            models.UserBioArchiveClicks.user_id == current_user["user_id"],
            models.UserBioArchiveClicks.article_id == data.article_id,
        )
        .first()
    )

    if not existing:
        db.add(
            models.UserBioArchiveClicks(
                user_id=current_user["user_id"],
                article_id=data.article_id,
            )
        )
    else:
        existing.clicked_at = datetime.utcnow()

    db.commit()
    return {"success": True, "article_id": data.article_id}


@router.post("/refresh_recommendations")
def refresh_bioarchive_recommendations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """
    Manually clear the BioArchive FAISS results cache for the current user.
    The next request will recompute results from the FAISS index.
    Useful after the BioArchive FAISS index is rebuilt with new preprints.
    """
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")

    feed.faiss_bioarchive_results_cache = None
    feed.faiss_bioarchive_cache_date_created = None
    db.commit()

    return {"message": "BioArchive recommendations cache cleared. Next request will recompute."}
