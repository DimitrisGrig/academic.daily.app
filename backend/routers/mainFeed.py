from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user, get_optional_user
from vector_store.FAISS import search_similar_articles
from fnc import generate_embeddings
import schemas, models, schemasResponse
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func, or_
from datetime import datetime, timezone
import numpy as np
from crud.crud_journal_icons import enrich_articles_with_icons, get_icon_by_journal_name

router = APIRouter(prefix="/mainFeed", tags=["mainFeed"])


@router.get("/is_onboarded", response_model=schemasResponse.MainFeedResponse)
def is_onboarded(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """ Check if the main feed tags for the current user exists to check onboarding status """
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    if feed is None or feed.main_feed_tags is None:
        return {"onBoard": False}
    else:
        return {"onBoard": True}



@router.post("/complete_onboarding")
def complete_onboarding(
    onboarding_data: schemas.OnboardingRequest, 
    current_user: dict = Depends(get_current_user), 
    db: Session = Depends(get_local_db)
):
    """ Complete user onboarding by saving their selected tags and generating embeddings """
    
    if not onboarding_data.tags or len(onboarding_data.tags) == 0:
        raise HTTPException(status_code=400, detail="At least one tag is required")
    
    try:
        # Check if user already has a feed entry
        feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
        
        # Combine tags into a single string for embedding generation. Using comma separator for better semantic distinction between tags
        tags_text = ", ".join(onboarding_data.tags)
        
        # Generate embeddings
        embeddings = generate_embeddings(tags_text)
        
        if feed:
            # Update existing feed entry and invalidate cache
            feed.main_feed_tags = onboarding_data.tags
            feed.main_feed_date_created = datetime.now(timezone.utc)
            feed.main_feed_embeddings = embeddings.tolist()
            feed.faiss_results_cache = None  # Invalidate cache when interests change
            feed.faiss_cache_date_created = None
            # Save initial prompt to history
            feed.interest_prompts_history = [{"prompt": tags_text, "saved_at": datetime.now(timezone.utc).isoformat()}]
        else:
            # Create new feed entry
            feed = models.Feeds(
                clerk_user_id=current_user["user_id"],
                main_feed_tags=onboarding_data.tags,
                main_feed_date_created=datetime.now(timezone.utc),
                main_feed_embeddings=embeddings.tolist(),
                faiss_results_cache=None,  # No cache yet
                faiss_cache_date_created=None,
                interest_prompts_history=[{"prompt": tags_text, "saved_at": datetime.now(timezone.utc).isoformat()}]
            )
            db.add(feed)
        
        db.commit()
        db.refresh(feed)
        
        return {"message": "Onboarding completed successfully"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to complete onboarding: {str(e)}")

    
    
    
@router.get("/get_recommended_by_faiss")
def get_recommended_by_faiss(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db), k: int = 1000, cache_expiry: int = 6, force_refresh: bool = False, sort_mode: str = "smart_shuffle"):
    """
    Get article recommendations based on user's feed embeddings using FAISS.
    Returns full article data sorted by relevance with similarity scores.
    
    Args:
        cache_expiry: Cache expiry time in hours
        force_refresh: If True, bypass cache and recompute FAISS results
        sort_mode: Sorting strategy - "smart_shuffle" (default), "similarity", or "date"
            - smart_shuffle: Weighted randomization favoring relevance + high impact journals
            - similarity: Pure similarity score ordering (deterministic)
            - date: Publication date ordering (deterministic)
    
    Uses intelligent caching:
    - FAISS results are cached to avoid expensive recomputation
    - Cache is invalidated when user updates their interests or is older than 6 hours
    - Article data is fetched fresh from database each time
    """
    
    if k > 1000:
        raise HTTPException(status_code=400, detail="k cannot exceed 1000.")

    k = max(k, 1)
    
    import time
    from datetime import timedelta
    start_time = time.time()
    
    # Get user's feed
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    if feed is None or feed.main_feed_embeddings is None:
        raise HTTPException(status_code=400, detail="User has not completed onboarding or has no embeddings.")
    
    # Check if cache is valid (exists, not empty, and less than 24 hours old)
    cache_is_fresh = False
    if feed.faiss_cache_date_created is not None:
        # Ensure both datetimes are timezone-aware for comparison
        cache_created = feed.faiss_cache_date_created
        if cache_created.tzinfo is None:
            cache_created = cache_created.replace(tzinfo=timezone.utc)
        
        cache_age = datetime.now(timezone.utc) - cache_created
        cache_is_fresh = cache_age < timedelta(hours=cache_expiry)
        if not cache_is_fresh:
            print(f"⏰ Cache expired (age: {cache_age.total_seconds() / 3600:.1f} hours)")
    
    use_cache = (
        not force_refresh 
        and feed.faiss_results_cache is not None 
        and len(feed.faiss_results_cache) > 0
        and cache_is_fresh
    )
    
    if use_cache:
        print("📦 Using cached FAISS results")
        faiss_results = feed.faiss_results_cache
    else:
        print("🔍 Computing FAISS results...")
        # Convert embeddings list to numpy array
        query_embedding = np.array(feed.main_feed_embeddings, dtype=np.float32)
        
        # Search for similar articles using FAISS
        faiss_results = search_similar_articles(query_embedding=query_embedding, k=k, index_type="flat")
        
        if not faiss_results:
            return []
        
        # Cache the results with timestamp (only IDs and scores, not full article data)
        feed.faiss_results_cache = faiss_results
        feed.faiss_cache_date_created = datetime.now(timezone.utc)
        db.commit()
        print(f"💾 Cached {len(faiss_results)} FAISS results (expires in 24 hours)")
    
    # Extract article IDs and create similarity lookup
    article_ids = [result['article_id'] for result in faiss_results]
    similarity_map = {
        result['article_id']: result['similarity_score'] 
        for result in faiss_results
    }
    
    # Fetch articles from database with left outer joins to ensure all articles are returned
    articles_query = (
        db.query(
            models.Articles,
            models.WosJournalsClarivateRankings,
            models.ScimagojrRankings
        )
        .outerjoin(
            models.WosJournalsClarivateRankings,
            or_(
                models.Articles.issn == models.WosJournalsClarivateRankings.issn,
                models.Articles.issn == models.WosJournalsClarivateRankings.eissn
            )
            )
        .outerjoin(
            models.ScimagojrRankings,
            models.Articles.issn == models.ScimagojrRankings.issn_print,
        )
        .filter(models.Articles.id.in_(article_ids))
    )
    
    # Convert to dict and add similarity scores, maintaining FAISS sort order
    articles_dict = {
        article.id: (article, wos_journal, scimagojr_rankings) 
        for article, wos_journal, scimagojr_rankings in articles_query.all()
    }
    
    # Get user's upvoted articles
    user_upvotes = db.query(models.UserUpvotes.article_id).filter(
        models.UserUpvotes.user_id == current_user['user_id']
    ).all()

    if user_upvotes:
        upvoted_article_ids = {upvote[0] for upvote in user_upvotes}
    else:
        upvoted_article_ids = set()
    
    # Get user's clicked/read articles
    user_clicks = db.query(models.UserArticleClicks.article_id).filter(
        models.UserArticleClicks.user_id == current_user['user_id']
    ).all()
    
    if user_clicks:
        read_article_ids = {click[0] for click in user_clicks}
    else:
        read_article_ids = set()
    
    # Get comment counts for articles
    comment_counts_query = db.query(
        models.Comment.article_id,
        func.count(models.Comment.id).label('comments_count')
    ).filter(
        models.Comment.article_id.in_(article_ids)
    ).group_by(models.Comment.article_id).all()
    
    comments_count_map = {
        article_id: count 
        for article_id, count in comment_counts_query
    }
    
    results = []
    for article_id in article_ids:
        if article_id in articles_dict:
            article, wos_journal, scimagojr_rankings = articles_dict[article_id]
            article_data = {
                'id': article.id,
                'issn': article.issn,
                'publication_type': article.publication_type,
                'title': article.title,
                'abstract': article.abstract,
                'journal': article.journal,
                'publication_date': article.publication_date,
                'created_at': article.created_at,
                'authors_full': article.authors_full,
                'affiliations': article.affiliations,
                'doi': article.doi,
                'pmcid': article.pmcid,
                'pmid': article.pmid,
                'mesh_terms': article.mesh_terms,
                'figures_urls': article.figures_urls,
                'unpaywall_status': article.unpaywall_status,
                'is_open_access_unpaywall': article.is_open_access_unpaywall,
                'graphical_abstract_path': article.graphical_abstract_path,
                'similarity_score': similarity_map[article_id],
                'upvotes': article.upvotes,
                'user_has_upvoted': article_id in upvoted_article_ids,
                'user_has_read': article_id in read_article_ids,
                'comments_count': comments_count_map.get(article_id, 0),
                'wos_journal': {
                    'journal_impact_factor': wos_journal.journal_impact_factor if wos_journal else None,
                    'five_year_impact_factor': wos_journal.five_year_impact_factor if wos_journal else None,
                    'country': wos_journal.country if wos_journal else None,
                },
                'scimagojr_rankings': {
                    'publisher': scimagojr_rankings.publisher if scimagojr_rankings else None,
                    'categories': scimagojr_rankings.categories if scimagojr_rankings else None,
                    'areas': scimagojr_rankings.areas if scimagojr_rankings else None,
                    
                }
            }
            results.append(article_data)
    
    # Enrich articles with journal icons
    enrich_articles_with_icons(db, results)
    
    # Apply sorting strategy based on sort_mode
    if sort_mode == "smart_shuffle":
        # Smart shuffle: weighted randomization favoring high similarity + high impact factor
        import random
        
        # Calculate composite scores for weighted shuffling
        for article in results:
            # Normalize similarity score (0-1 range, already normalized from FAISS)
            similarity_weight = article['similarity_score']
            
            # Extract and normalize impact factor
            impact_factor = None
            if article['wos_journal'] and article['wos_journal']['journal_impact_factor']:
                impact_factor = article['wos_journal']['journal_impact_factor']
            
            # Normalize impact factor (cap at 50 for extreme outliers, typical range 0-20)
            if impact_factor is not None:
                # Use log scale for impact factor to prevent extreme values from dominating
                # Most journals: 0-10, good journals: 10-20, elite journals: 20+
                impact_weight = min(impact_factor / 20.0, 1.5)  # Cap boost at 1.5x
            else:
                impact_weight = 0.3  # Modest default for journals without impact factor
            
            # Composite score: 70% similarity, 30% impact factor
            base_score = (0.70 * similarity_weight) + (0.30 * impact_weight)
            
            # Add controlled randomness (±15% variance)
            # This ensures variety while keeping relevant/high-impact articles at top
            random_factor = random.uniform(0.85, 1.15)
            article['_shuffle_score'] = base_score * random_factor
        
        # Sort by shuffle score (highest first)
        results.sort(key=lambda x: x['_shuffle_score'], reverse=True)
        
        # Remove temporary score field
        for article in results:
            del article['_shuffle_score']
    
    elif sort_mode == "date":
        # Sort by date added to feed (newest first) - deterministic
        results.sort(key=lambda x: x['created_at'], reverse=True)
    
    # Default or "similarity": keep FAISS ordering (already sorted by similarity)
    # No additional sorting needed as results maintain FAISS order
    
    execution_time = time.time() - start_time
    cache_status = "cached" if use_cache else "computed"
    
    # Log cache age if using cached results
    if use_cache and feed.faiss_cache_date_created:
        cache_created = feed.faiss_cache_date_created
        if cache_created.tzinfo is None:
            cache_created = cache_created.replace(tzinfo=timezone.utc)
        cache_age = datetime.now(timezone.utc) - cache_created
        cache_age_hours = cache_age.total_seconds() / 3600
        print(f"✅ Returned {len(results)} articles in {execution_time:.2f} sec ({cache_status}, age: {cache_age_hours:.1f}h, sort: {sort_mode})")
    else:
        print(f"✅ Returned {len(results)} articles in {execution_time:.2f} sec ({cache_status}, sort: {sort_mode})")
    
    return results



@router.get("/you_might_miss")
def you_might_miss(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db), limit: int = 10):
    """
    Return the top `limit` highly-relevant articles the user has NOT yet viewed.

    Efficiency strategy:
    - Reuses the already-computed FAISS results cache (no expensive re-computation).
    - FAISS results are already sorted by similarity score (highest first).
    - We simply skip articles the user has clicked/read and take the top N remaining.
    - Only fetches article rows for those N articles from the DB.
    """
    # --- 1. Load user's FAISS cache (already computed, free to read) ---
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    if feed is None or feed.main_feed_embeddings is None:
        raise HTTPException(status_code=400, detail="User has not completed onboarding.")

    if not feed.faiss_results_cache or len(feed.faiss_results_cache) == 0:
        # Cache not ready yet — return empty list gracefully
        return []

    faiss_results = feed.faiss_results_cache  # list of {article_id, similarity_score}

    # --- 2. Fetch the set of article IDs the user has already read ---
    read_ids: set[int] = {
        row[0]
        for row in db.query(models.UserArticleClicks.article_id)
        .filter(models.UserArticleClicks.user_id == current_user["user_id"])
        .all()
    }

    # --- 3. Pick the top `limit` unread articles (FAISS results already sorted by similarity desc) ---
    candidate_ids: list[int] = []
    similarity_map: dict[int, float] = {}
    for result in faiss_results:
        if result["article_id"] not in read_ids:
            candidate_ids.append(result["article_id"])
            similarity_map[result["article_id"]] = result["similarity_score"]
        if len(candidate_ids) >= limit:
            break

    if not candidate_ids:
        return []

    # --- 4. Fetch full article data for those N candidates only ---
    articles_query = (
        db.query(
            models.Articles,
            models.WosJournalsClarivateRankings,
        )
        .outerjoin(
            models.WosJournalsClarivateRankings,
            or_(
                models.Articles.issn == models.WosJournalsClarivateRankings.issn,
                models.Articles.issn == models.WosJournalsClarivateRankings.eissn,
            ),
        )
        .filter(models.Articles.id.in_(candidate_ids))
    )

    articles_dict = {
        article.id: (article, wos_journal)
        for article, wos_journal in articles_query.all()
    }

    # --- 5. Get upvote state for these articles ---
    upvoted_ids: set[int] = {
        row[0]
        for row in db.query(models.UserUpvotes.article_id)
        .filter(
            models.UserUpvotes.user_id == current_user["user_id"],
            models.UserUpvotes.article_id.in_(candidate_ids),
        )
        .all()
    }

    # --- 6. Build response, preserving similarity order ---
    results = []
    for article_id in candidate_ids:
        if article_id not in articles_dict:
            continue
        article, wos_journal = articles_dict[article_id]
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
                "figures_urls": article.figures_urls,
                "unpaywall_status": article.unpaywall_status,
                "is_open_access_unpaywall": article.is_open_access_unpaywall,
                "graphical_abstract_path": article.graphical_abstract_path,
                "similarity_score": similarity_map[article_id],
                "upvotes": article.upvotes,
                "user_has_upvoted": article_id in upvoted_ids,
                "user_has_read": False,  # by definition: never read
                "comments_count": 0,
                "wos_journal": {
                    "journal_impact_factor": wos_journal.journal_impact_factor if wos_journal else None,
                    "five_year_impact_factor": wos_journal.five_year_impact_factor if wos_journal else None,
                    "country": wos_journal.country if wos_journal else None,
                },
                "scimagojr_rankings": None,
            }
        )

    enrich_articles_with_icons(db, results)
    return results


@router.get("/related_articles/{article_id}")
def get_related_articles(
    article_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
    k: int = 3,
):
    """
    Get articles related to a specific article based on FAISS embedding similarity.
    Returns the top k related articles with minimal data (title, journal, IF, date).
    """
    if k > 10:
        k = 10

    # Get the article's embedding
    article = (
        db.query(models.Articles.embeddings_biobert)
        .filter(models.Articles.id == article_id)
        .first()
    )

    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    if article.embeddings_biobert is None:
        return []

    query_embedding = np.array(article.embeddings_biobert, dtype=np.float32)

    # Search FAISS (request k+1 to account for the article itself appearing in results)
    faiss_results = search_similar_articles(
        query_embedding=query_embedding, k=k + 5, index_type="flat"
    )

    if not faiss_results:
        return []

    # Exclude the source article and take top k
    candidate_ids = [
        r["article_id"] for r in faiss_results if r["article_id"] != article_id
    ][:k]

    if not candidate_ids:
        return []

    # Fetch minimal article data with journal impact factor
    rows = (
        db.query(
            models.Articles.id,
            models.Articles.title,
            models.Articles.journal,
            models.Articles.publication_date,
            models.Articles.doi,
            models.Articles.pmid,
            models.WosJournalsClarivateRankings.journal_impact_factor,
        )
        .outerjoin(
            models.WosJournalsClarivateRankings,
            or_(
                models.Articles.issn == models.WosJournalsClarivateRankings.issn,
                models.Articles.issn == models.WosJournalsClarivateRankings.eissn,
            ),
        )
        .filter(models.Articles.id.in_(candidate_ids))
        .all()
    )

    # Build lookup and preserve FAISS order
    rows_map = {row.id: row for row in rows}

    results = []
    for aid in candidate_ids:
        row = rows_map.get(aid)
        if row:
            results.append(
                {
                    "id": row.id,
                    "title": row.title,
                    "journal": row.journal.split("=")[0].strip() if row.journal else None,
                    "publication_date": row.publication_date,
                    "impact_factor": row.journal_impact_factor,
                    "doi": row.doi,
                    "pmid": row.pmid,
                }
            )

    return results


@router.post("/refresh_recommendations")
def refresh_recommendations(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Manually refresh FAISS recommendations cache.
    Use this when FAISS index is updated with new articles.
    """
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    # Invalidate cache
    feed.faiss_results_cache = None
    feed.faiss_cache_date_created = None
    db.commit()
    
    return {"message": "Recommendations cache cleared. Next request will recompute."}


@router.get("/get_article/{article_id}")
def get_article_by_id(
    article_id: int,
    current_user: dict = Depends(get_optional_user),
    db: Session = Depends(get_local_db)
):
    """
    Fetch a single article by its ID with all related data.
    Works for both authenticated and unauthenticated users.
    """
    
    try:
        # Get user's upvoted articles if authenticated
        upvoted_article_ids = set()
        if current_user and current_user.get('user_id'):
            user_upvotes = db.query(models.UserUpvotes.article_id).filter(
                models.UserUpvotes.user_id == current_user['user_id']
            ).all()
            if user_upvotes:
                upvoted_article_ids = {upvote[0] for upvote in user_upvotes}
        
        # Query article with journal rankings and comment count
        result = db.query(
            models.Articles,
            models.WosJournalsClarivateRankings,
            models.ScimagojrRankings,
            func.count(models.Comment.id).label('comments_count')
        ).outerjoin(
            models.WosJournalsClarivateRankings,
            or_(
                models.Articles.issn == models.WosJournalsClarivateRankings.issn,
                models.Articles.issn == models.WosJournalsClarivateRankings.eissn
            )
        ).outerjoin(
            models.ScimagojrRankings,
            models.Articles.issn == models.ScimagojrRankings.issn_print
        ).outerjoin(
            models.Comment,
            models.Articles.id == models.Comment.article_id
        ).filter(
            models.Articles.id == article_id
        ).group_by(
            models.Articles.id,
            models.WosJournalsClarivateRankings.id,
            models.ScimagojrRankings.rank
        ).first()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Article with ID {article_id} not found")
        
        article, wos_journal, scimagojr_rankings, comments_count = result
        
        # Format the article data
        article_data = {
            'id': article.id,
            'issn': article.issn,
            'publication_type': article.publication_type,
            'title': article.title,
            'abstract': article.abstract,
            'journal': article.journal,
            'publication_date': article.publication_date,
            'created_at': article.created_at,
            'authors_full': article.authors_full,
            'affiliations': article.affiliations,
            'doi': article.doi,
            'pmcid': article.pmcid,
            'pmid': article.pmid,
            'mesh_terms': article.mesh_terms,
            'figures_urls': article.figures_urls,
            'unpaywall_status': article.unpaywall_status,
            'is_open_access_unpaywall': article.is_open_access_unpaywall,
            'graphical_abstract_path': article.graphical_abstract_path,
            'similarity_score': 0,  # No similarity score for direct fetch
            'upvotes': article.upvotes,
            'user_has_upvoted': article.id in upvoted_article_ids,
            'user_has_read': False,  # Would need to check history
            'comments_count': comments_count,
            'wos_journal': {
                'journal_impact_factor': wos_journal.journal_impact_factor if wos_journal else None,
                'five_year_impact_factor': wos_journal.five_year_impact_factor if wos_journal else None,
                'country': wos_journal.country if wos_journal else None,
            },
            'scimagojr_rankings': {
                'publisher': scimagojr_rankings.publisher if scimagojr_rankings else None,
                'categories': scimagojr_rankings.categories if scimagojr_rankings else None,
                'areas': scimagojr_rankings.areas if scimagojr_rankings else None,
            }
        }
        
        # Add journal icon
        icon = get_icon_by_journal_name(db, article.journal) if article.journal else None
        article_data['journal_icon_url'] = icon.icon_url if icon else None
        
        return article_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch article: {str(e)}")




