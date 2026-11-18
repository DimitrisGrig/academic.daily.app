from fastapi import APIRouter, Depends, HTTPException, Query
from vector_store.FAISS import search_similar_articles
from vector_store.bm25 import search_bm25
from fnc import generate_embeddings
import models
from sqlalchemy.orm import Session

from database import get_local_db
from crud.crud_journal_icons import enrich_articles_with_icons
import numpy as np

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/benchmark_search")
def benchmark_search(query: str = Query(..., description="Free-text query to search for similar articles"), db: Session = Depends(get_local_db), k: int = 100,):
    """
    Benchmark endpoint: convert a free-text query to BioBERT embeddings and
    return the top-k most similar articles ordered by cosine similarity (desc).

    The article shape and similarity scoring match the main feed exactly so
    results can be compared directly against production recommendations.
    """
    if k > 1000:
        raise HTTPException(status_code=400, detail="k cannot exceed 1000.")
    k = max(k, 1)

    query_text = query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="query must not be empty.")

    # Embed the query with the same BioBERT model used for article embeddings
    query_embedding = generate_embeddings(query_text)
    query_embedding = np.array(query_embedding, dtype=np.float32)

    faiss_results = search_similar_articles(
        query_embedding=query_embedding, k=k, index_type="flat"
    )

    if not faiss_results:
        return []

    article_ids = [r["article_id"] for r in faiss_results]
    similarity_map = {r["article_id"]: r["similarity_score"] for r in faiss_results}

    articles_query = (
        db.query(models.Articles)
        .filter(models.Articles.id.in_(article_ids))
    )

    articles_dict = {
        article.id: article
        for article in articles_query.all()
    }

    # Preserve FAISS similarity order (highest score first)
    results = []
    for article_id in article_ids:
        if article_id not in articles_dict:
            continue
        article = articles_dict[article_id]
        results.append(
            {
                "id": article.id,
                "issn": article.issn,
                "publication_type": article.publication_type,
                "title": article.title,
                "abstract": article.abstract,
                "journal": article.journal,
                "publication_date": article.publication_date,
                "created_at": article.created_at,
                "authors_full": article.authors_full,
                "affiliations": article.affiliations,
                "doi": article.doi,
                "pmcid": article.pmcid,
                "pmid": article.pmid,
                "mesh_terms": article.mesh_terms,
                "similarity_score": similarity_map[article_id]
            }
        )

    enrich_articles_with_icons(db, results)

    return results


@router.get("/benchmark_search_BM25")
def benchmark_search_BM25(
    query: str = Query(..., description="Free-text query to search for similar articles"),
    db: Session = Depends(get_local_db),
    k: int = 100,
    depth: int = Query(1000, description="Candidates retrieved from each channel before fusion"),
    rrf_k: int = Query(60, description="Reciprocal Rank Fusion constant"),
):
    """
    Hybrid benchmark endpoint: same dense BioBERT/FAISS retrieval as
    /benchmark_search plus a BM25 channel over title + ". " + abstract,
    fused with Reciprocal Rank Fusion: score = sum 1 / (rrf_k + rank).

    `similarity_score` is the fused RRF score; the per-channel scores are
    returned as `dense_score` / `bm25_score` (null if not retrieved by that channel).
    """
    if k > 1000:
        raise HTTPException(status_code=400, detail="k cannot exceed 1000.")
    k = max(k, 1)
    depth = min(max(depth, k), 1000)

    query_text = query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="query must not be empty.")

    query_embedding = np.array(generate_embeddings(query_text), dtype=np.float32)
    dense_results = search_similar_articles(
        query_embedding=query_embedding, k=depth, index_type="flat"
    )
    bm25_results = search_bm25(query_text, k=depth)

    dense_map = {r["article_id"]: r["similarity_score"] for r in dense_results}
    bm25_map = {r["article_id"]: r["bm25_score"] for r in bm25_results}

    fused = {}
    for ranked in (dense_results, bm25_results):
        for rank, r in enumerate(ranked, 1):
            fused[r["article_id"]] = fused.get(r["article_id"], 0.0) + 1.0 / (rrf_k + rank)

    if not fused:
        return []

    article_ids = sorted(fused, key=fused.get, reverse=True)[:k]

    articles_dict = {
        article.id: article
        for article in db.query(models.Articles).filter(models.Articles.id.in_(article_ids)).all()
    }

    results = []
    for article_id in article_ids:
        if article_id not in articles_dict:
            continue
        article = articles_dict[article_id]
        results.append(
            {
                "id": article.id,
                "issn": article.issn,
                "publication_type": article.publication_type,
                "title": article.title,
                "abstract": article.abstract,
                "journal": article.journal,
                "publication_date": article.publication_date,
                "created_at": article.created_at,
                "authors_full": article.authors_full,
                "affiliations": article.affiliations,
                "doi": article.doi,
                "pmcid": article.pmcid,
                "pmid": article.pmid,
                "mesh_terms": article.mesh_terms,
                "similarity_score": fused[article_id],
                "dense_score": dense_map.get(article_id),
                "bm25_score": bm25_map.get(article_id),
            }
        )

    enrich_articles_with_icons(db, results)

    return results
