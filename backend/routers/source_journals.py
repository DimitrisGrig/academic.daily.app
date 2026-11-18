from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
import schemas, models
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func
from crud.crud_journal_icons import get_icon_map

router = APIRouter(prefix="/source_journals", tags=["source_journals"])


@router.get("/journals")
def get_all_journals(search: str = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get all tracked journals from the database.
    If search is provided, filter by journal title (case-insensitive).
    Returns all journals without any impact factor filtering or limits.
    """
    
    impact_factor_threshold = 0
    
    impact_factor_threshold = db.query(models.Settings.setting_value).filter(
        models.Settings.setting_key == "impact_factor_threshold"
    ).scalar()
        
    # Base query - get all tracked journals
    query = db.query(models.TrackedJournal)
    
    # Apply impact factor threshold filter and active status filter
    # query = query.filter(models.TrackedJournal.wos_impact_factor >= float(impact_factor_threshold))
    
    # Order by impact factor descending (nulls last), then by title
    query = query.order_by(
        models.TrackedJournal.wos_impact_factor.desc().nullslast(),
        models.TrackedJournal.journal_title
    )
    
    # Apply search filter if provided
    if search:
        query = query.filter(
            func.lower(models.TrackedJournal.journal_title).contains(func.lower(search))
        )
    
    # Get all journals
    journals = query.all()
    
    # Build journal icon lookup
    journal_names = [j.journal_title for j in journals if j.journal_title]
    icon_map = get_icon_map(db, journal_names) if journal_names else {}
    
    # Serialize journals to list of dictionaries
    journals_list = [
        {
            "id": journal.id,
            "journal_title": journal.journal_title,
            "issn": journal.issn,
            "eissn": journal.eissn,
            "wos_impact_factor": journal.wos_impact_factor,
            "is_active_by_user": journal.is_active_by_user,
            "journal_icon_url": icon_map.get(journal.journal_title.lower()) if journal.journal_title else None,
        }
        for journal in journals
    ]
    
    return {"journals": journals_list}


@router.get("/statistics")
def get_journal_statistics(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get statistics about tracked journals.
    """
    
    # Get all journals
    all_journals = db.query(models.TrackedJournal).all()
    
    # Get active journals
    active_journals = db.query(models.TrackedJournal).filter(
        models.TrackedJournal.is_active_by_user == True
    ).all()
    
    # Calculate statistics
    total_journals = len(all_journals)
    active_journals_count = len(active_journals)
    
    # Calculate average impact factor (for journals that have one)
    journals_with_if = [j for j in all_journals if j.wos_impact_factor is not None]
    avg_impact_factor = sum(j.wos_impact_factor for j in journals_with_if) / len(journals_with_if) if journals_with_if else 0
    
    # Count high impact journals (IF >= 10)
    high_impact_count = len([j for j in all_journals if j.wos_impact_factor and j.wos_impact_factor >= 10])
    
    return {
        "total_journals": total_journals,
        "active_journals": active_journals_count,
        "average_impact_factor": round(avg_impact_factor, 2),
        "high_impact_count": high_impact_count,
    }


@router.get("/journal/{journal_id}/articles")
def get_journal_articles(journal_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get the latest 100 articles from a specific journal, ordered by publication_date descending.
    Also returns journal information.
    """
    
    # Get journal info
    journal = db.query(models.TrackedJournal).filter(models.TrackedJournal.id == journal_id).first()
    
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    
    # Get articles for this journal, ordered by publication date (most recent first), limit to 100
    articles = db.query(models.Articles).filter(
        models.Articles.journal == journal.journal_title
    ).order_by(
        models.Articles.publication_date.desc()
    ).limit(100).all()
    
    # Serialize articles
    articles_list = []
    for article in articles:
        # Get WOS journal info if available (join by ISSN)
        wos_journal = None
        if article.issn:
            wos_journal_data = db.query(models.WosJournalsClarivateRankings).filter(
                (models.WosJournalsClarivateRankings.issn == article.issn) |
                (models.WosJournalsClarivateRankings.eissn == article.issn)
            ).first()
            if wos_journal_data:
                wos_journal = {
                    "journal_impact_factor": wos_journal_data.journal_impact_factor,
                    "five_year_impact_factor": wos_journal_data.five_year_impact_factor,
                    "country": wos_journal_data.country,
                }
        
        # Get Scimago rankings if available (join by ISSN)
        scimagojr_rankings = None
        if article.issn:
            scimago_data = db.query(models.ScimagojrRankings).filter(
                (models.ScimagojrRankings.issn == article.issn) |
                (models.ScimagojrRankings.issn_print == article.issn) |
                (models.ScimagojrRankings.issn_electronic == article.issn)
            ).first()
            if scimago_data:
                scimagojr_rankings = {
                    "publisher": scimago_data.publisher,
                    "categories": scimago_data.categories,
                    "areas": scimago_data.areas,
                }
        
        # Get user interactions
        user_has_upvoted = db.query(models.UserUpvotes).filter(
            models.UserUpvotes.user_id == current_user["user_id"],
            models.UserUpvotes.article_id == article.id
        ).first() is not None
        
        user_has_read = db.query(models.UserArticleClicks).filter(
            models.UserArticleClicks.user_id == current_user["user_id"],
            models.UserArticleClicks.article_id == article.id
        ).first() is not None
        
        # Get upvotes count
        upvotes_count = db.query(func.count(models.UserUpvotes.id)).filter(
            models.UserUpvotes.article_id == article.id
        ).scalar() or 0
        
        # Get comments count
        comments_count = db.query(func.count(models.Comment.id)).filter(
            models.Comment.article_id == article.id
        ).scalar() or 0
        
        articles_list.append({
            "id": article.id,
            "publication_type": article.publication_type,
            "issn": article.issn,
            "title": article.title,
            "abstract": article.abstract,
            "journal": article.journal,
            "publication_date": article.publication_date.isoformat() if article.publication_date else None,
            "created_at": article.created_at.isoformat() if article.created_at else None,
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
            "similarity_score": 0,  # Not applicable for this view
            "upvotes": upvotes_count,
            "user_has_upvoted": user_has_upvoted,
            "user_has_read": user_has_read,
            "comments_count": comments_count,
            "wos_journal": wos_journal,
            "scimagojr_rankings": scimagojr_rankings,
        })
    
    # Enrich articles with journal icons
    from crud.crud_journal_icons import enrich_articles_with_icons
    enrich_articles_with_icons(db, articles_list)
    
    # Build icon map for journal_info
    journal_names_for_icon = [journal.journal_title] if journal.journal_title else []
    icon_map_for_info = get_icon_map(db, journal_names_for_icon) if journal_names_for_icon else {}
    
    return {
        "articles": articles_list,
        "journal_info": {
            "journal_title": journal.journal_title,
            "issn": journal.issn,
            "eissn": journal.eissn,
            "wos_impact_factor": journal.wos_impact_factor,
            "journal_icon_url": icon_map_for_info.get(journal.journal_title.lower()) if journal.journal_title else None,
        },
        "total_count": len(articles_list),
    }


@router.get("/impact-factor-threshold")
def get_impact_factor_threshold(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get the impact factor threshold setting from the database.
    """
    threshold = db.query(models.Settings.setting_value).filter(
        models.Settings.setting_key == "impact_factor_threshold"
    ).scalar()
    
    # Default to 3 if not found
    threshold_value = float(threshold) if threshold else 3.0
    
    return {"impact_factor_threshold": threshold_value}



@router.post("/suggest_new_journal")
async def suggest_new_journal(data: schemas.SuggestNewJournal, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    suggestion = models.JournalSuggestion(
        clerk_user_id=current_user["user_id"],
        journal_name_or_issn=data.journal_name_or_issn,
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return {"message": "Journal suggestion submitted successfully", "id": suggestion.id}
    