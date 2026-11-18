from fastapi import APIRouter, Depends, HTTPException, Request
from auth import get_current_user, get_optional_user
import models
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func, or_
from typing import Optional, List, Dict, Any
from limiter import limiter
from crud.crud_journal_icons import get_icon_map, enrich_articles_with_icons

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/global")
@limiter.limit("10/minute")
def global_search(request: Request, query: str, current_user: Optional[dict] = Depends(get_optional_user), db: Session = Depends(get_local_db), limit: int = 20):
    # Hard cap to prevent expensive unbounded queries
    limit = min(max(limit, 1), 50)
    """
    Global search across articles, topics, and journals.
    
    Args:
        query: Search term
        current_user: Optional authenticated user
        db: Database session
        limit: Maximum results per category
        
    Returns:
        Dictionary with articles, topics, and journals matching the query
    """
    
    if not query or len(query.strip()) < 2:
        return {
            "articles": [],
            "topics": [],
            "journals": [],
            "bioarchive": [],
            "total": 0
        }
    
    query_lower = query.strip().lower()
    search_pattern = f"%{query_lower}%"
    
    results = {
        "articles": [],
        "topics": [],
        "journals": [],
        "bioarchive": [],
        "total": 0
    }
    
    try:
        # Search Articles (title, abstract, authors, journal)
        articles_query = db.query(
            models.Articles.id,
            models.Articles.title,
            models.Articles.abstract,
            models.Articles.journal,
            models.Articles.authors_full,
            models.Articles.publication_date,
            models.Articles.doi,
            models.Articles.upvotes,
            models.Articles.clicks
        ).filter(
            or_(
                func.lower(models.Articles.title).contains(query_lower),
                func.lower(models.Articles.abstract).contains(query_lower),
                func.lower(models.Articles.authors_full).contains(query_lower),
                func.lower(models.Articles.journal).contains(query_lower)
            )
        ).order_by(
            models.Articles.clicks.desc(),
            models.Articles.upvotes.desc()
        ).limit(limit)
        
        articles = articles_query.all()
        
        for article in articles:
            results["articles"].append({
                "id": article.id,
                "title": article.title,
                "abstract": article.abstract[:200] + "..." if article.abstract and len(article.abstract) > 200 else article.abstract,
                "journal": article.journal,
                "authors": article.authors_full[:150] + "..." if article.authors_full and len(article.authors_full) > 150 else article.authors_full,
                "publication_date": article.publication_date,
                "doi": article.doi,
                "upvotes": article.upvotes,
                "clicks": article.clicks,
                "type": "article"
            })
        
        # Search Topics
        topics_query = db.query(
            models.Topics.id,
            models.Topics.subtopic,
            models.Topics.broadtopic
        ).filter(
            or_(
                models.Topics.subtopic.ilike(search_pattern),
                models.Topics.broadtopic.ilike(search_pattern)
            )
        ).limit(limit)
        
        topics = topics_query.all()
        
        for topic in topics:
            results["topics"].append({
                "id": topic.id,
                "subtopic": topic.subtopic,
                "broadtopic": topic.broadtopic,
                "type": "topic"
            })
        
        # Search Journals
        journals_query = db.query(
            models.TrackedJournal.id,
            models.TrackedJournal.journal_title,
            models.TrackedJournal.issn,
            models.TrackedJournal.wos_impact_factor
        ).filter(
            func.lower(models.TrackedJournal.journal_title).contains(query_lower)
        ).order_by(
            models.TrackedJournal.wos_impact_factor.desc().nullslast()
        ).limit(limit)
        
        journals = journals_query.all()
        
        # Build icon map for journals
        journal_names = [j.journal_title for j in journals if j.journal_title]
        # Also include journal names from articles
        article_journal_names = [a["journal"] for a in results["articles"] if a.get("journal")]
        all_journal_names = list(set(journal_names + article_journal_names))
        icon_map = get_icon_map(db, all_journal_names) if all_journal_names else {}

        # Enrich articles with journal_icon_url
        for a in results["articles"]:
            jname = (a.get("journal") or "").lower()
            a["journal_icon_url"] = icon_map.get(jname)

        for journal in journals:
            results["journals"].append({
                "id": journal.id,
                "journal_title": journal.journal_title,
                "issn": journal.issn,
                "impact_factor": journal.wos_impact_factor,
                "journal_icon_url": icon_map.get(journal.journal_title.lower()) if journal.journal_title else None,
                "type": "journal"
            })
        
        # Search BioArchive (bioRxiv / medRxiv preprints)
        bioarchive_query = db.query(
            models.ArticlesBioArchive.id,
            models.ArticlesBioArchive.title,
            models.ArticlesBioArchive.abstract,
            models.ArticlesBioArchive.authors,
            models.ArticlesBioArchive.author_corresponding,
            models.ArticlesBioArchive.date_posted,
            models.ArticlesBioArchive.doi,
            models.ArticlesBioArchive.category,
            models.ArticlesBioArchive.server,
            models.ArticlesBioArchive.upvotes
        ).filter(
            or_(
                func.lower(models.ArticlesBioArchive.title).contains(query_lower),
                func.lower(models.ArticlesBioArchive.abstract).contains(query_lower),
                func.lower(models.ArticlesBioArchive.authors).contains(query_lower),
                func.lower(models.ArticlesBioArchive.category).contains(query_lower)
            )
        ).order_by(
            models.ArticlesBioArchive.date_posted.desc().nullslast(),
            models.ArticlesBioArchive.upvotes.desc()
        ).limit(limit)
        
        bioarchive_articles = bioarchive_query.all()
        
        for article in bioarchive_articles:
            results["bioarchive"].append({
                "id": article.id,
                "title": article.title,
                "abstract": article.abstract[:200] + "..." if article.abstract and len(article.abstract) > 200 else article.abstract,
                "authors": article.authors[:150] + "..." if article.authors and len(article.authors) > 150 else article.authors,
                "author_corresponding": article.author_corresponding,
                "date_posted": article.date_posted,
                "doi": article.doi,
                "category": article.category,
                "server": article.server,
                "upvotes": article.upvotes,
                "type": "bioarchive"
            })
        
        # Calculate total results
        results["total"] = len(results["articles"]) + len(results["topics"]) + len(results["journals"]) + len(results["bioarchive"])
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/articles")
@limiter.limit("10/minute")
def search_articles(request: Request, query: str, current_user: Optional[dict] = Depends(get_optional_user), db: Session = Depends(get_local_db), limit: int = 50, offset: int = 0):
    # Hard caps to prevent expensive unbounded queries
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    """
    Focused search for articles only with pagination.
    
    Args:
        query: Search term
        current_user: Optional authenticated user
        db: Database session
        limit: Maximum results to return
        offset: Number of results to skip
        
    Returns:
        List of articles matching the query with full details
    """
    
    if not query or len(query.strip()) < 2:
        return {"articles": [], "total": 0}
    
    query_lower = query.strip().lower()
    
    try:
        # Get user's upvoted articles if authenticated
        upvoted_article_ids = set()
        if current_user and current_user.get('user_id'):
            user_upvotes = db.query(models.UserUpvotes.article_id).filter(
                models.UserUpvotes.user_id == current_user['user_id']
            ).all()
            if user_upvotes:
                upvoted_article_ids = {upvote[0] for upvote in user_upvotes}
        
        # Search query with joins for journal data
        articles_query = db.query(
            models.Articles,
            models.WosJournalsClarivateRankings,
            func.count(models.Comment.id).label('comments_count')
        ).outerjoin(
            models.WosJournalsClarivateRankings,
            models.Articles.issn == models.WosJournalsClarivateRankings.issn
        ).outerjoin(
            models.Comment,
            models.Articles.id == models.Comment.article_id
        ).filter(
            or_(
                func.lower(models.Articles.title).contains(query_lower),
                func.lower(models.Articles.abstract).contains(query_lower),
                func.lower(models.Articles.authors_full).contains(query_lower),
                func.lower(models.Articles.journal).contains(query_lower)
            )
        ).group_by(
            models.Articles.id,
            models.WosJournalsClarivateRankings.id
        ).order_by(
            models.Articles.clicks.desc(),
            models.Articles.upvotes.desc()
        )
        
        # Get total count
        total = articles_query.count()
        
        # Apply pagination
        results = articles_query.limit(limit).offset(offset).all()
        
        # Format results
        articles = []
        for article, wos_journal, comments_count in results:
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
                'user_has_read': False,  # Would need to check history table
                'comments_count': comments_count,
                'wos_journal': {
                    'journal_impact_factor': wos_journal.journal_impact_factor if wos_journal else None,
                    'five_year_impact_factor': wos_journal.five_year_impact_factor if wos_journal else None,
                    'country': wos_journal.country if wos_journal else None,
                }
            }
            articles.append(article_data)
        
        # Enrich articles with journal icon URLs
        enrich_articles_with_icons(db, articles)
        
        return {
            "articles": articles,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Article search failed: {str(e)}")


@router.get("/bioarchive")
@limiter.limit("10/minute")
def search_bioarchive(request: Request, query: str, current_user: Optional[dict] = Depends(get_optional_user), db: Session = Depends(get_local_db), limit: int = 50, offset: int = 0):
    # Hard caps to prevent expensive unbounded queries
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    """
    Focused search for bioRxiv/medRxiv preprint articles with pagination.
    """
    
    if not query or len(query.strip()) < 2:
        return {"bioarchive": [], "total": 0}
    
    query_lower = query.strip().lower()
    
    try:
        # Get user's upvoted bioarchive articles if authenticated
        upvoted_article_ids = set()
        if current_user and current_user.get('user_id'):
            user_upvotes = db.query(models.UserBioArchiveUpvotes.article_id).filter(
                models.UserBioArchiveUpvotes.user_id == current_user['user_id']
            ).all()
            if user_upvotes:
                upvoted_article_ids = {upvote[0] for upvote in user_upvotes}
        
        # Search query
        bioarchive_query = db.query(
            models.ArticlesBioArchive
        ).filter(
            or_(
                func.lower(models.ArticlesBioArchive.title).contains(query_lower),
                func.lower(models.ArticlesBioArchive.abstract).contains(query_lower),
                func.lower(models.ArticlesBioArchive.authors).contains(query_lower),
                func.lower(models.ArticlesBioArchive.category).contains(query_lower)
            )
        ).order_by(
            models.ArticlesBioArchive.date_posted.desc().nullslast(),
            models.ArticlesBioArchive.upvotes.desc()
        )
        
        # Get total count
        total = bioarchive_query.count()
        
        # Apply pagination
        results = bioarchive_query.limit(limit).offset(offset).all()
        
        # Format results
        articles = []
        for article in results:
            article_data = {
                'id': article.id,
                'title': article.title,
                'authors': article.authors,
                'author_corresponding': article.author_corresponding,
                'author_corresponding_institution': article.author_corresponding_institution,
                'doi': article.doi,
                'date_posted': article.date_posted,
                'version': article.version,
                'publication_type': article.publication_type,
                'license': article.license,
                'category': article.category,
                'abstract': article.abstract,
                'published': article.published,
                'server': article.server,
                'upvotes': article.upvotes,
                'user_has_upvoted': article.id in upvoted_article_ids,
                'type': 'bioarchive'
            }
            articles.append(article_data)
        
        return {
            "bioarchive": articles,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BioArchive search failed: {str(e)}")
