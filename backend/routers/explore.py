from fastapi import APIRouter, Depends, HTTPException
from auth import get_optional_user
import models
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func
from vector_store.FAISS import search_similar_articles
import numpy as np
from crud.crud_journal_icons import enrich_articles_with_icons

router = APIRouter(prefix="/explore", tags=["explore"])



@router.get("/explore_feed")
def get_explore_articles(
    sort_by: str = "clicks", 
    limit: int = 1000, 
    topic: str = None,
    current_user: dict = Depends(get_optional_user), 
    db: Session = Depends(get_local_db)
):
    """
    Get personalized articles for the explore page based on user embeddings and sorting options.
    Features diversity mixing (70% personalized, 30% trending) and high-impact journal filtering (IF >= 10).
    
    Args:
        sort_by: Sorting method - 'clicks', 'upvotes', 'comments', or 'date'
        limit: Maximum number of articles to return
        topic: Optional topic name to filter articles by (searches in title, abstract, and MeSH terms)
        current_user: Optional user authentication
    
    Returns:
        List of articles sorted by the specified criteria, personalized when user is authenticated
    """
    
    # If topic is provided, use topic-based filtering instead of personalization
    if topic:
        print(f"🔍 Filtering articles by topic: {topic}")
        return get_articles_by_topic(topic, sort_by, limit, current_user, db)
    
    # Get article IDs based on user embeddings if user is authenticated
    article_ids = None
    similarity_map = {}
    diverse_article_ids = []
    
    if current_user and current_user.get('user_id'):
        # Get user's feed with embeddings
        feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

        if feed and feed.main_feed_embeddings is not None:
            # Use cached FAISS results if available and fresh
            from datetime import datetime, timezone, timedelta
            
            cache_is_fresh = False
            if feed.faiss_cache_date_created is not None:
                cache_created = feed.faiss_cache_date_created
                if cache_created.tzinfo is None:
                    cache_created = cache_created.replace(tzinfo=timezone.utc)
                cache_age = datetime.now(timezone.utc) - cache_created
                cache_is_fresh = cache_age < timedelta(hours=24)
            
            if (feed.faiss_results_cache and 
                len(feed.faiss_results_cache) > 0 and 
                cache_is_fresh):
                print("📦 Using cached FAISS results for explore")
                faiss_results = feed.faiss_results_cache
            else:
                print("🔍 Computing FAISS results for explore...")
                # Convert embeddings to numpy array and search
                query_embedding = np.array(feed.main_feed_embeddings, dtype=np.float32)
                faiss_results = search_similar_articles(
                    query_embedding=query_embedding, 
                    k=5000,  # Get more results for explore
                    index_type="flat"
                )
                
                # Cache the results
                if faiss_results:
                    feed.faiss_results_cache = faiss_results
                    feed.faiss_cache_date_created = datetime.now(timezone.utc)
                    db.commit()
                    print(f"💾 Cached {len(faiss_results)} FAISS results for explore")
            
            if faiss_results:
                # Diversity Mixing: 70% personalized, 30% trending diverse content
                personalized_count = int(len(faiss_results) * 0.7)
                
                # Extract personalized article IDs (top 70%)
                personalized_ids = [result['article_id'] for result in faiss_results[:personalized_count]]
                similarity_map = {result['article_id']: result['similarity_score'] for result in faiss_results}
                
                # Get trending articles outside user's immediate interests (for diversity)
                # Exclude top 1000 personalized to ensure diversity
                excluded_ids = [result['article_id'] for result in faiss_results[:1000]]
                
                diverse_count = int(len(faiss_results) * 0.3)
                diverse_query = (
                    db.query(models.Articles.id)
                    .join(
                        models.WosJournalsClarivateRankings,
                        models.Articles.issn == models.WosJournalsClarivateRankings.issn
                    )
                    .filter(
                        ~models.Articles.id.in_(excluded_ids),
                        models.WosJournalsClarivateRankings.journal_impact_factor >= 8
                    )
                    .order_by(models.Articles.clicks.desc())
                    .limit(diverse_count)
                )
                
                diverse_article_ids = [row[0] for row in diverse_query.all()]
                
                # Combine personalized and diverse articles
                article_ids = personalized_ids + diverse_article_ids
                print(f"📊 Explore mix: {len(personalized_ids)} personalized + {len(diverse_article_ids)} diverse")
    
    # Base query with joins for journal rankings and comment counts
    base_query = (
        db.query(
            models.Articles,
            models.WosJournalsClarivateRankings,
            models.ScimagojrRankings,
            func.count(models.Comment.id).label('comments_count')
        )
        .join(
            models.WosJournalsClarivateRankings,
            models.Articles.issn == models.WosJournalsClarivateRankings.issn
        )
        .outerjoin(
            models.ScimagojrRankings,
            models.Articles.issn == models.ScimagojrRankings.issn_print
        )
        .outerjoin(
            models.Comment,
            models.Articles.id == models.Comment.article_id
        )
        .filter(
            models.WosJournalsClarivateRankings.journal_impact_factor >= 10
        )
        .group_by(
            models.Articles.id,
            models.WosJournalsClarivateRankings.id,
            models.ScimagojrRankings.rank
        )
    )
    
    # Filter by personalized article IDs if available
    if article_ids:
        base_query = base_query.filter(models.Articles.id.in_(article_ids))
    
    # Apply sorting based on sort_by parameter
    if sort_by == "clicks":
        base_query = base_query.order_by(models.Articles.clicks.desc())
    elif sort_by == "upvotes":
        base_query = base_query.order_by(models.Articles.upvotes.desc())
    elif sort_by == "comments":
        base_query = base_query.order_by(func.count(models.Comment.id).desc())
    elif sort_by == "date":
        base_query = base_query.order_by(models.Articles.created_at.desc())
    else:
        # Default to clicks if invalid sort_by
        base_query = base_query.order_by(models.Articles.clicks.desc())
    
    # Execute query with limit
    results = base_query.limit(limit).all()
    
    # Get user's upvoted articles if user is authenticated
    upvoted_article_ids = set()
    if current_user and current_user.get('user_id'):
        user_upvotes = db.query(models.UserUpvotes.article_id).filter(
            models.UserUpvotes.user_id == current_user['user_id']
        ).all()
        if user_upvotes:
            upvoted_article_ids = {upvote[0] for upvote in user_upvotes}
    
    # Format the results
    articles = []
    for article, wos_journal, scimagojr_rankings, comments_count in results:
        # Determine if article is from diverse set (for visual differentiation)
        is_diverse = article.id in diverse_article_ids
        
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
            'upvotes': article.upvotes,
            'clicks': article.clicks,
            'user_has_upvoted': article.id in upvoted_article_ids,
            'comments_count': comments_count,
            'similarity_score': similarity_map.get(article.id, 0.0),  # Include similarity score
            'is_diverse': is_diverse,  # Flag for visual differentiation
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
        articles.append(article_data)
    
    # Enrich articles with journal icons
    enrich_articles_with_icons(db, articles)
    
    return articles


def get_articles_by_topic(topic: str, sort_by: str, limit: int, current_user: dict, db: Session):
    """
    Get articles filtered by a specific topic.
    Searches in article title, abstract, and MeSH terms.
    """
    from sqlalchemy import or_
    
    topic_lower = topic.lower()
    search_pattern = f"%{topic_lower}%"
    
    # Get user's upvoted articles if authenticated
    upvoted_article_ids = set()
    if current_user and current_user.get('user_id'):
        user_upvotes = db.query(models.UserUpvotes.article_id).filter(
            models.UserUpvotes.user_id == current_user['user_id']
        ).all()
        if user_upvotes:
            upvoted_article_ids = {upvote[0] for upvote in user_upvotes}
    
    # Base query with topic filtering
    base_query = (
        db.query(
            models.Articles,
            models.WosJournalsClarivateRankings,
            models.ScimagojrRankings,
            func.count(models.Comment.id).label('comments_count')
        )
        .outerjoin(
            models.WosJournalsClarivateRankings,
            models.Articles.issn == models.WosJournalsClarivateRankings.issn
        )
        .outerjoin(
            models.ScimagojrRankings,
            models.Articles.issn == models.ScimagojrRankings.issn_print
        )
        .outerjoin(
            models.Comment,
            models.Articles.id == models.Comment.article_id
        )
        .filter(
            or_(
                func.lower(models.Articles.title).contains(topic_lower),
                func.lower(models.Articles.abstract).contains(topic_lower),
                func.lower(models.Articles.mesh_terms).contains(topic_lower)
            )
        )
        .group_by(
            models.Articles.id,
            models.WosJournalsClarivateRankings.id,
            models.ScimagojrRankings.rank
        )
    )
    
    # Apply sorting
    if sort_by == "clicks":
        base_query = base_query.order_by(models.Articles.clicks.desc())
    elif sort_by == "upvotes":
        base_query = base_query.order_by(models.Articles.upvotes.desc())
    elif sort_by == "comments":
        base_query = base_query.order_by(func.count(models.Comment.id).desc())
    elif sort_by == "date":
        base_query = base_query.order_by(models.Articles.created_at.desc())
    else:
        base_query = base_query.order_by(models.Articles.clicks.desc())
    
    # Execute query with limit
    results = base_query.limit(limit).all()
    
    print(f"📚 Found {len(results)} articles for topic '{topic}'")
    
    # Format the results
    articles = []
    for article, wos_journal, scimagojr_rankings, comments_count in results:
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
            'upvotes': article.upvotes,
            'clicks': article.clicks,
            'user_has_upvoted': article.id in upvoted_article_ids,
            'comments_count': comments_count,
            'similarity_score': 0.0,  # No similarity score for topic search
            'is_diverse': False,
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
        articles.append(article_data)
    
    # Enrich articles with journal icons
    enrich_articles_with_icons(db, articles)
    
    return articles