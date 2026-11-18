from sqlalchemy.orm import Session
from auth import get_current_user
from fnc import generate_embeddings
from fastapi import Depends, HTTPException
import models
from database import get_local_db
from sqlalchemy import func, or_
import numpy as np
from vector_store.FAISS import search_similar_articles
from crud.crud_journal_icons import enrich_articles_with_icons



def create_embeddings(tags_text: list[str] = None):
    if not tags_text:
        return None
    
    tags_text = ", ".join(tags_text)
    embeddings = generate_embeddings(tags_text)
    return embeddings.tolist()




def get_get_recommended_by_faiss(feed_key: str, current_user: dict, db: Session, k: int = 1000):
    """
    Get article recommendations based on custom feed embeddings using FAISS.
    Returns full article data sorted by relevance with similarity scores, filtered by feed settings.
    
    Args:
        feed_key: The key of the custom feed to get recommendations for
        current_user: Current authenticated user
        db: Database session
        k: Number of results to return from FAISS
    """
    from datetime import datetime, timedelta, timezone
    
    # Get user's feeds
    feeds_record = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    if not feeds_record or not feeds_record.feeds:
        raise HTTPException(status_code=404, detail="No custom feeds found for this user")
    
    # Find the specific feed by key
    feed_config = None
    for feed in feeds_record.feeds:
        if feed.get("key") == feed_key:
            feed_config = feed
            break
    
    if not feed_config:
        raise HTTPException(status_code=404, detail=f"Feed with key '{feed_key}' not found")
    
    # Get feed embeddings
    feed_embeddings = feed_config.get("embeddings")
    
    # Extract feed configuration
    journals = feed_config.get("journals", [])
    publishers = feed_config.get("publishers", [])
    time_range = feed_config.get("time_range", "all_time")
    default_sorting = feed_config.get("default_sorting", "recommended")
    open_access_only = feed_config.get("open_access_only", False)
    publication_types = feed_config.get("publication_types", [])
    include_all_journals = feed_config.get("include_all_journals", True)
    graphical_abstract_only = feed_config.get("graphical_abstract_only", False)
    
    # If embeddings exist, use FAISS to get article recommendations
    if feed_embeddings:
        # Convert embeddings list to numpy array
        query_embedding = np.array(feed_embeddings, dtype=np.float32)
        
        # Search for similar articles using FAISS
        faiss_results = search_similar_articles(query_embedding=query_embedding, k=k, index_type="flat")
        
        if not faiss_results:
            return []
        
        # Extract article IDs and create similarity lookup
        article_ids = [result['article_id'] for result in faiss_results]
        similarity_map = {
            result['article_id']: result['similarity_score'] 
            for result in faiss_results
        }
    else:
        # No embeddings - we'll fetch articles based on filters only
        # Get recent articles (limiting to a reasonable number for performance)
        article_ids = None  # Will query all articles matching filters
        similarity_map = {}  # No similarity scores available
    
    # Build base query with joins
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
            models.Articles.issn == models.ScimagojrRankings.issn_print
        )
    )
    
    # Apply article IDs filter only if we have FAISS results
    if article_ids is not None:
        articles_query = articles_query.filter(models.Articles.id.in_(article_ids))
    
    # Apply journal filter (only if include_all_journals is False and journals list is not empty)
    if not include_all_journals and journals:
        articles_query = articles_query.filter(models.Articles.journal.in_(journals))
    
    # Apply publisher filter (only if include_all_journals is False and publishers list is not empty)
    if not include_all_journals and publishers:
        articles_query = articles_query.filter(models.ScimagojrRankings.publisher.in_(publishers))
    
    # Apply publication type filter
    if publication_types:
        articles_query = articles_query.filter(models.Articles.publication_type.in_(publication_types))
    
    # Apply open access filter
    if open_access_only:
        articles_query = articles_query.filter(models.Articles.is_open_access_unpaywall == True)
    
    # Apply graphical abstract filter
    if graphical_abstract_only:
        articles_query = articles_query.filter(models.Articles.graphical_abstract_path.isnot(None))
        articles_query = articles_query.filter(models.Articles.graphical_abstract_path != "")
    
    # Apply time range filter
    if time_range and time_range != "all_time":
        now = datetime.now(timezone.utc)
        if time_range == "past_24_hours":
            start_date = now - timedelta(hours=24)
        elif time_range == "past_week":
            start_date = now - timedelta(weeks=1)
        elif time_range == "past_month":
            start_date = now - timedelta(days=30)
        else:
            start_date = None
        
        if start_date:
            articles_query = articles_query.filter(models.Articles.publication_date >= start_date)
    
    # If no embeddings (no FAISS), we need to decide how to pre-order the query
    # before limiting results based on the default_sorting preference
    if not feed_embeddings:
        # Pre-order and limit based on the sorting preference
        if default_sorting == "clicks":
            # Order by clicks to get top clicked articles
            articles_query = articles_query.order_by(models.Articles.clicks.desc()).limit(k)
        elif default_sorting == "upvotes":
            # We can't pre-order by upvotes here (it's in a different table)
            # So we'll fetch more articles and sort later
            articles_query = articles_query.order_by(models.Articles.publication_date.desc()).limit(k)
        else:
            # For "date" and "recommended" (which falls back to date), order by date
            articles_query = articles_query.order_by(models.Articles.publication_date.desc()).limit(k)
    
    # Execute query
    articles_results = articles_query.all()
    
    # Convert to dict
    articles_dict = {
        article.id: (article, wos_journal, scimagojr_rankings) 
        for article, wos_journal, scimagojr_rankings in articles_results
    }
    
    # Get filtered article IDs for additional queries
    filtered_article_ids = list(articles_dict.keys())
    
    if not filtered_article_ids:
        return []
    
    # Get user's upvoted articles
    user_upvotes = db.query(models.UserUpvotes.article_id).filter(
        models.UserUpvotes.user_id == current_user['user_id'],
        models.UserUpvotes.article_id.in_(filtered_article_ids)
    ).all()
    upvoted_article_ids = {upvote[0] for upvote in user_upvotes}
    
    # Get user's clicked/read articles
    user_clicks = db.query(models.UserArticleClicks.article_id).filter(
        models.UserArticleClicks.user_id == current_user['user_id'],
        models.UserArticleClicks.article_id.in_(filtered_article_ids)
    ).all()
    read_article_ids = {click[0] for click in user_clicks}
    
    # Get upvotes count for each article
    upvotes_count = db.query(
        models.UserUpvotes.article_id,
        func.count(models.UserUpvotes.id).label('count')
    ).filter(
        models.UserUpvotes.article_id.in_(filtered_article_ids)
    ).group_by(models.UserUpvotes.article_id).all()
    upvotes_map = {article_id: count for article_id, count in upvotes_count}
    
    # Get comment counts for articles
    comment_counts_query = db.query(
        models.Comment.article_id,
        func.count(models.Comment.id).label('comments_count')
    ).filter(
        models.Comment.article_id.in_(filtered_article_ids)
    ).group_by(models.Comment.article_id).all()
    
    comments_count_map = {
        article_id: count 
        for article_id, count in comment_counts_query
    }
    
    # Build results
    results = []
    
    # If we have FAISS results, iterate in FAISS order to maintain similarity ranking
    if article_ids is not None:
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
                    'similarity_score': similarity_map.get(article_id, 0),
                    'upvotes': upvotes_map.get(article.id, 0),
                    'user_has_upvoted': article_id in upvoted_article_ids,
                    'user_has_read': article_id in read_article_ids,
                    'comments_count': comments_count_map.get(article_id, 0),
                    'clicks': article.clicks if article.clicks else 0,
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
    else:
        # No FAISS results - iterate through filtered articles directly
        for article_id, (article, wos_journal, scimagojr_rankings) in articles_dict.items():
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
                'similarity_score': 0,  # No similarity score without embeddings
                'upvotes': upvotes_map.get(article.id, 0),
                'user_has_upvoted': article_id in upvoted_article_ids,
                'user_has_read': article_id in read_article_ids,
                'comments_count': comments_count_map.get(article_id, 0),
                'clicks': article.clicks if article.clicks else 0,
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
    
    # Apply sorting based on default_sorting
    if default_sorting == "date":
        # Sort by date added to feed (newest first)
        results.sort(key=lambda x: x['created_at'], reverse=True)
    elif default_sorting == "upvotes":
        # Sort by upvotes (highest first)
        results.sort(key=lambda x: x['upvotes'], reverse=True)
    elif default_sorting == "clicks":
        # Sort by clicks (most clicked first)
        results.sort(key=lambda x: x.get('clicks', 0), reverse=True)
    elif default_sorting == "recommended" and not feed_embeddings:
        # If no embeddings but "recommended" sorting selected, fallback to date
        results.sort(key=lambda x: x['created_at'], reverse=True)
    # else: default is "recommended" with embeddings which maintains FAISS similarity order
    
    return results