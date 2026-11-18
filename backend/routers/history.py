from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_local_db
from auth import get_current_user
import models
from sqlalchemy import desc, func
from crud.crud_journal_icons import enrich_articles_with_icons

router = APIRouter()


@router.get("/get_user_history")
async def get_user_history(db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    """Get user's article reading history with article details"""
    try:
        # Get user's clicked articles with timestamps
        user_clicks = (
            db.query(models.UserArticleClicks)
            .filter(models.UserArticleClicks.user_id == current_user["user_id"])
            .order_by(desc(models.UserArticleClicks.clicked_at))
            .all()
        )
        
        if not user_clicks:
            return {"history": []}
        
        # Get article IDs
        article_ids = [click.article_id for click in user_clicks]
        
        # Fetch article details
        articles = (
            db.query(
                models.Articles,
                models.WosJournalsClarivateRankings,
                models.ScimagojrRankings
            )
            .outerjoin(
                models.WosJournalsClarivateRankings,
                models.Articles.issn == models.WosJournalsClarivateRankings.issn
            )
            .outerjoin(
                models.ScimagojrRankings,
                models.Articles.issn == models.ScimagojrRankings.issn_print,
            )
            .filter(models.Articles.id.in_(article_ids))
            .all()
        )
        
        # Create article lookup dict
        articles_dict = {
            article.id: (article, wos_journal, scimagojr_rankings)
            for article, wos_journal, scimagojr_rankings in articles
        }
        
        # Get user's upvoted articles
        user_upvotes = db.query(models.UserUpvotes.article_id).filter(
            models.UserUpvotes.user_id == current_user['user_id']
        ).all()
        upvoted_article_ids = {upvote[0] for upvote in user_upvotes} if user_upvotes else set()
        
        # Get comment counts for articles
        comment_counts_query = (
            db.query(
                models.Comment.article_id,
                func.count(models.Comment.id).label('comments_count')
            )
            .filter(models.Comment.article_id.in_(article_ids))
            .group_by(models.Comment.article_id)
            .all()
        )
        comments_count_map = {article_id: count for article_id, count in comment_counts_query}
        
        # Build response with click timestamps
        history = []
        for click in user_clicks:
            if click.article_id in articles_dict:
                article, wos_journal, scimagojr_rankings = articles_dict[click.article_id]
                
                article_data = {
                    'id': article.id,
                    'title': article.title,
                    'abstract': article.abstract,
                    'journal': article.journal,
                    'publication_date': article.publication_date.isoformat() if article.publication_date else None,
                    'created_at': article.created_at.isoformat() if article.created_at else None,
                    'authors_full': article.authors_full,
                    'doi': article.doi,
                    'pmid': article.pmid,
                    'pmcid': article.pmcid,
                    'issn': article.issn,
                    'publication_type': article.publication_type,
                    'affiliations': article.affiliations,
                    'mesh_terms': article.mesh_terms,
                    'figures_urls': article.figures_urls,
                    'unpaywall_status': article.unpaywall_status,
                    'is_open_access_unpaywall': article.is_open_access_unpaywall,
                    'graphical_abstract_path': article.graphical_abstract_path,
                    'upvotes': article.upvotes,
                    'user_has_upvoted': click.article_id in upvoted_article_ids,
                    'comments_count': comments_count_map.get(click.article_id, 0),
                    'clicked_at': click.clicked_at.isoformat() if click.clicked_at else None,
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
                history.append(article_data)
        
        # Enrich articles with journal icons
        enrich_articles_with_icons(db, history)
        
        return {"history": history}
        
    except Exception as e:
        print(f"Error fetching user history: {str(e)}")
        return {"history": [], "error": str(e)}
