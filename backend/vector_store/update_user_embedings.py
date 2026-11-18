"""
Script to update FAISS recommendation caches for all users.
Run this script after rebuilding the FAISS index with new articles
to ensure all users get fresh recommendations on their next request.

Daily recompute also regenerates each user's embedding vector by
combining their selected tags with the titles + abstracts of articles
they have upvoted (when upvote_based_recommendations is enabled).
"""

from vector_store.FAISS import search_similar_articles
import sys
import os
from sqlalchemy.orm import Session
from database import get_local_db
from fastapi import Depends

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models, user_models
from datetime import datetime, timezone
import numpy as np
import time


# --------------- Embedding helpers --------------- #

# Weight given to the tag-based embedding vs the upvote-based embedding
# when combining them into the final user vector.
TAGS_WEIGHT = 0.70
UPVOTES_WEIGHT = 0.30

# Maximum number of upvoted articles to include (most recent first)
MAX_UPVOTED_ARTICLES = 50

# Maximum characters of abstract to include per article
ABSTRACT_TRUNCATE = 300


def _build_upvote_text(db: Session, user_id: str) -> str | None:
    """
    Build a single text block from the user's upvoted article titles + abstracts.
    Returns None if the user has no upvotes.
    """
    upvoted_rows = (
        db.query(models.UserUpvotes.article_id)
        .filter(models.UserUpvotes.user_id == user_id)
        .order_by(models.UserUpvotes.upvoted_at.desc())
        .limit(MAX_UPVOTED_ARTICLES)
        .all()
    )

    if not upvoted_rows:
        return None

    article_ids = [row[0] for row in upvoted_rows]

    articles = (
        db.query(models.Articles.title, models.Articles.abstract)
        .filter(models.Articles.id.in_(article_ids))
        .all()
    )

    if not articles:
        return None

    parts: list[str] = []
    for title, abstract in articles:
        if title:
            snippet = title.strip()
            if abstract:
                truncated = abstract.strip()[:ABSTRACT_TRUNCATE]
                snippet += ". " + truncated
            parts.append(snippet)

    return " ".join(parts) if parts else None


def _generate_combined_embedding(
    tags_text: str,
    upvote_text: str | None,
    generate_embeddings_fn,
) -> np.ndarray:
    """
    Generate a combined embedding from tag text and (optional) upvote text.

    Strategy:
    - Generate one embedding from the user's tags.
    - Generate one embedding from the upvoted article content.
    - Return a weighted average (normalized) of the two.
    - If no upvote text, return the pure tags embedding.
    """
    tags_emb = generate_embeddings_fn(tags_text)

    if upvote_text is None:
        return tags_emb

    upvote_emb = generate_embeddings_fn(upvote_text)

    combined = TAGS_WEIGHT * tags_emb + UPVOTES_WEIGHT * upvote_emb

    # L2-normalize so cosine similarity works correctly
    norm = np.linalg.norm(combined)
    if norm > 0:
        combined = combined / norm

    return combined


# --------------- Cache update logic --------------- #

def update_user_embeddings_cache(k: int = 5000, index_type: str = "flat", clerk_user_id: str = None, db: Session = Depends(get_local_db)) -> dict:
    """
    Update FAISS recommendation caches for all users (or a specific user).
    
    When upvote_based_recommendations is enabled for a user, the function
    regenerates the user's embedding vector by combining their selected tags
    with the titles + abstracts of their upvoted articles before running
    the FAISS search.
    
    Args:
        k: Number of top articles to cache per user (default: 5000)
        index_type: FAISS index type to use ("flat", "ivf", "hnsw", "ivfpq")
        clerk_user_id: If provided, only update this user's cache
    
    Returns:
        dict: Statistics about the update process
    """
    from fnc import generate_embeddings
    
    start_time = time.time()
    
    try:
        # Get all users with embeddings (or specific user)
        if clerk_user_id:
            feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == clerk_user_id, models.Feeds.main_feed_embeddings.isnot(None)).all()
            print(f"🔍 Updating cache for user: {clerk_user_id}")
        else:
            feeds = db.query(models.Feeds).filter(models.Feeds.main_feed_embeddings.isnot(None)).all()
            print(f"🔍 Found {len(feeds)} users with embeddings")
        
        if not feeds:
            print("⚠️ No users found with embeddings")
            return {
                "total_users": 0,
                "updated": 0,
                "failed": 0,
                "execution_time": 0
            }
        
        stats = {
            "total_users": len(feeds),
            "updated": 0,
            "failed": 0,
            "skipped": 0,
            "embeddings_regenerated": 0,
        }
        
        for i, feed in enumerate(feeds, 1):
            try:
                user_id = feed.clerk_user_id
                print(f"\n[{i}/{len(feeds)}] Processing user: {user_id}")
                
                # ---- Regenerate embedding if upvote-based recommendations enabled ---- #
                use_upvotes = feed.upvote_based_recommendations is not False  # default True
                tags = feed.main_feed_tags

                if use_upvotes and tags:
                    upvote_text = _build_upvote_text(db, user_id)
                    if upvote_text:
                        tags_text = ", ".join(tags)
                        print(f"  🧬 Regenerating embedding (tags + {len(upvote_text)} chars of upvote text)...")
                        combined_emb = _generate_combined_embedding(
                            tags_text, upvote_text, generate_embeddings
                        )
                        feed.main_feed_embeddings = combined_emb.tolist()
                        feed.embeddings_last_recomputed = datetime.now(timezone.utc)
                        db.commit()
                        stats["embeddings_regenerated"] += 1
                        print(f"  ✅ Embedding regenerated (tags weight={TAGS_WEIGHT}, upvotes weight={UPVOTES_WEIGHT})")
                    else:
                        print(f"  ℹ️ No upvotes found — keeping tags-only embedding")
                else:
                    if not use_upvotes:
                        print(f"  ℹ️ Upvote-based recommendations disabled — keeping tags-only embedding")
                    # If tags are missing, just use whatever embedding already exists

                # ---- Run FAISS search with (possibly updated) embedding ---- #
                query_embedding = np.array(feed.main_feed_embeddings, dtype=np.float32)
                
                # Compute FAISS results
                print(f"  🔍 Computing FAISS results (k={k}, index={index_type})...")
                faiss_results = search_similar_articles(
                    query_embedding=query_embedding,
                    k=k,
                    index_type=index_type
                )
                
                if not faiss_results:
                    print(f"  ⚠️ No results found for user {user_id}")
                    stats["skipped"] += 1
                    continue
                
                # Update cache in database
                feed.faiss_results_cache = faiss_results
                feed.faiss_cache_date_created = datetime.now(timezone.utc)
                db.commit()
                
                print(f"  ✅ Cached {len(faiss_results)} results")
                print(f"     Top similarity: {faiss_results[0]['similarity_score']:.4f}")
                print(f"     Lowest similarity: {faiss_results[-1]['similarity_score']:.4f}")
                
                stats["updated"] += 1
                
            except Exception as e:
                print(f"  ❌ Failed to update user {feed.clerk_user_id}: {str(e)}")
                stats["failed"] += 1
                db.rollback()
                continue
        
        execution_time = time.time() - start_time
        stats["execution_time"] = execution_time
        
        print("\n" + "="*70)
        print("📊 Update Summary:")
        print(f"   Total users: {stats['total_users']}")
        print(f"   ✅ Updated: {stats['updated']}")
        print(f"   🧬 Embeddings regenerated: {stats['embeddings_regenerated']}")
        print(f"   ⚠️ Skipped: {stats['skipped']}")
        print(f"   ❌ Failed: {stats['failed']}")
        print(f"   ⏱️ Total time: {execution_time:.2f} seconds")
        print(f"   ⚡ Average time per user: {execution_time/len(feeds):.2f} seconds")
        print("="*70)
        
        return stats
        
    except Exception as e:
        print(f"❌ Fatal error during cache update: {str(e)}")
        raise
    finally:
        db.close()


def wrapper_update_user_embeddings_cache():
    """
    Wrapper function to update embeddings cache for all users.
    Called from the scheduler (not a FastAPI route), so we create
    our own DB session instead of relying on Depends().
    
    Returns:
        dict: Aggregated statistics for all users
    """
    
    # Create our own DB session (Depends() does NOT work outside FastAPI routes)
    db = next(get_local_db())
    try:
        # Extract clerk_user_ids from tuples returned by query
        clerk_user_ids = [row[0] for row in db.query(user_models.User.clerk_user_id).all()]
    finally:
        db.close()
    
    print(f"🚀 Starting cache update for {len(clerk_user_ids)} users")
    
    all_stats = {
        "total_users": len(clerk_user_ids),
        "updated": 0,
        "failed": 0,
        "skipped": 0,
        "execution_time": 0
    }
    
    start_time = time.time()
    
    for i, clerk_user_id in enumerate(clerk_user_ids, 1):
        try:
            print(f"\n{'='*70}")
            print(f"Processing user {i}/{len(clerk_user_ids)}: {clerk_user_id}")
            print(f"{'='*70}")
            
            # Get a fresh database session for each user
            db_session = next(get_local_db())
            
            stats = update_user_embeddings_cache(
                k=5000, 
                index_type="flat", 
                clerk_user_id=clerk_user_id, 
                db=db_session
            )
            
            # Aggregate stats
            all_stats["updated"] += stats["updated"]
            all_stats["failed"] += stats["failed"]
            all_stats["skipped"] += stats["skipped"]
            
        except Exception as e:
            print(f"❌ Error processing user {clerk_user_id}: {str(e)}")
            all_stats["failed"] += 1
            continue
    
    all_stats["execution_time"] = time.time() - start_time
    
    print("\n" + "="*70)
    print("🎉 FINAL SUMMARY - All Users:")
    print(f"   Total users: {all_stats['total_users']}")
    print(f"   ✅ Updated: {all_stats['updated']}")
    print(f"   ⚠️ Skipped: {all_stats['skipped']}")
    print(f"   ❌ Failed: {all_stats['failed']}")
    print(f"   ⏱️ Total time: {all_stats['execution_time']:.2f} seconds")
    print("="*70)
    
    return all_stats
