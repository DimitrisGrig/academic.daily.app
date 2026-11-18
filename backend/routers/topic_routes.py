from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime, timedelta, timezone
import threading
import numpy as np
import models
from database import get_local_db
from auth import verify_admin_user
from vector_store.FAISS import search_similar_articles
from fnc import generate_embeddings

router = APIRouter(prefix="/topics", tags=["topics"])

# In-process cache: slug → np.ndarray (warm across requests, lost on restart)
_embedding_cache: dict[str, np.ndarray] = {}

# Per-slug locks so concurrent requests for the same topic share one computation
# instead of both calling generate_embeddings simultaneously.
_slug_locks: dict[str, threading.Lock] = {}
_slug_locks_mutex = threading.Lock()

def _get_slug_lock(slug: str) -> threading.Lock:
    with _slug_locks_mutex:
        if slug not in _slug_locks:
            _slug_locks[slug] = threading.Lock()
        return _slug_locks[slug]


def _get_or_create_embedding(slug: str, topic_text: str, db: Session) -> np.ndarray:
    """
    Return the embedding for a topic slug.
    Priority: in-memory cache → DB → compute and persist.

    A per-slug lock serialises the slow path so that two simultaneous requests
    for the same topic (e.g. latest + trending fired in parallel by the frontend)
    only call generate_embeddings once — the second thread waits and then reads
    the result from _embedding_cache.

    DB errors are isolated so they never prevent an embedding from being
    returned — the value is always at least cached in-process.
    """
    # Fast path — no lock needed
    if slug in _embedding_cache:
        return _embedding_cache[slug]

    with _get_slug_lock(slug):
        # Re-check inside the lock (another thread may have just computed it)
        if slug in _embedding_cache:
            return _embedding_cache[slug]

        # --- try to load from DB ---
        record = None
        try:
            record = db.query(models.TopicPageEmbedding).filter(
                models.TopicPageEmbedding.slug == slug
            ).first()
        except Exception as exc:
            print(f"⚠️  [Topics] DB read failed for '{slug}': {exc}")
            db.rollback()

        if record is not None and record.embeddings is not None:
            emb = np.array(record.embeddings, dtype=np.float32)
            _embedding_cache[slug] = emb
            return emb

        # --- compute (only one thread per slug reaches here) ---
        emb = generate_embeddings(topic_text)

        # --- try to persist ---
        try:
            if record is not None:
                record.embeddings = emb.tolist()
            else:
                db.add(models.TopicPageEmbedding(slug=slug, embeddings=emb.tolist()))
            db.commit()
            print(f"✅ [Topics] Computed and stored embedding for '{slug}'")
        except Exception as exc:
            print(f"⚠️  [Topics] DB write failed for '{slug}': {exc}")
            db.rollback()

        _embedding_cache[slug] = emb
        return emb


def _fetch_articles_by_ids(
    article_ids: list[int], limit: int, db: Session
) -> list[dict]:
    """
    From the FAISS candidate pool, return papers published in the last 3 months,
    sorted newest-first. The date filter is applied in SQL so we avoid pulling
    old papers into Python.
    """
    if not article_ids:
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)

    rows = (
        db.query(
            models.Articles.id,
            models.Articles.title,
            models.Articles.abstract,
            models.Articles.journal,
            models.Articles.authors_full,
            models.Articles.publication_date,
            models.Articles.created_at,
            models.Articles.doi,
            models.Articles.pmid,
            models.Articles.upvotes,
            models.Articles.clicks,
            models.Articles.graphical_abstract_path,
        )
        .filter(
            models.Articles.id.in_(article_ids),
            models.Articles.created_at >= cutoff,
        )
        .order_by(models.Articles.created_at.desc())
        .limit(limit)
        .all()
    )

    papers = []
    for r in rows:
        abstract = r.abstract or ""
        authors = r.authors_full or ""
        papers.append({
            "id": r.id,
            "title": r.title,
            "abstract": abstract[:300] + "..." if len(abstract) > 300 else abstract,
            "journal": r.journal,
            "authors": authors[:120] + "..." if len(authors) > 120 else authors,
            "publication_date": r.publication_date.isoformat() if r.publication_date else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "doi": r.doi,
            "pmid": r.pmid,
            "upvotes": r.upvotes or 0,
            "clicks": r.clicks or 0,
            "graphical_abstract_path": r.graphical_abstract_path,
        })
    return papers


@router.get("/papers")
def get_topic_papers(
    slug: str = Query(..., description="Topic slug, e.g. 'rna-seq'"),
    topic_text: str = Query(..., description="Text to embed (title + search query)"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_local_db),
):
    """
    Return semantically relevant papers published in the last 3 months, newest first.

    FAISS retrieves the top-k most similar articles across all time; the DB then
    applies the 90-day cutoff so only recent papers reach the response.
    k is set large enough that the date filter has plenty to choose from.
    """
    try:
        embedding = _get_or_create_embedding(slug, topic_text, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

    # Large FAISS pool: the 90-day filter will discard most results, so we need
    # many more candidates than `limit`.  k=3000 keeps FAISS fast (flat index)
    # while giving plenty of room even for niche topics.
    faiss_results = search_similar_articles(embedding, k=3000, index_type="flat")

    if not faiss_results:
        return {"papers": [], "total": 0}

    article_ids = [r["article_id"] for r in faiss_results]
    papers = _fetch_articles_by_ids(article_ids, limit, db)
    return {"papers": papers, "total": len(papers)}


@router.post("/papers/invalidate/{slug}")
def invalidate_topic_embedding(slug: str, db: Session = Depends(get_local_db), admin_user: dict = Depends(verify_admin_user)):
    """
    Drop the cached embedding for a topic so it is recomputed on the next request.
    Useful when you update a topic's search text.
    """
    _embedding_cache.pop(slug, None)
    record = db.query(models.TopicPageEmbedding).filter(
        models.TopicPageEmbedding.slug == slug
    ).first()
    if record:
        record.embeddings = None
        db.commit()
        return {"message": f"Embedding invalidated for '{slug}'"}
    return {"message": f"No stored embedding found for '{slug}'"}


@router.get("/journals")
def get_topic_journals(
    names: str = Query(..., description="Comma-separated journal name keywords"),
    db: Session = Depends(get_local_db),
):
    """Return tracked journal metadata for a list of name keywords, sorted by impact factor."""
    keywords = [n.strip() for n in names.split(",") if n.strip()]
    if not keywords:
        return {"journals": []}

    rows = db.query(
        models.TrackedJournal.id,
        models.TrackedJournal.journal_title,
        models.TrackedJournal.wos_impact_factor,
    ).filter(
        or_(*[func.lower(models.TrackedJournal.journal_title).contains(k.lower()) for k in keywords])
    ).order_by(
        models.TrackedJournal.wos_impact_factor.desc().nullslast()
    ).limit(10).all()

    return {
        "journals": [
            {"id": r.id, "title": r.journal_title, "impact_factor": r.wos_impact_factor}
            for r in rows
        ]
    }
