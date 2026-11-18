from fastapi import APIRouter, Depends, HTTPException, Query
from auth import get_current_user, get_optional_user
import schemas, models
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func, and_, cast, Date
from datetime import datetime, timezone, timedelta
from collections import Counter
import re
import user_models

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/reading-overview")
async def get_reading_overview(year: int = Query(None, description="Year to filter activity (defaults to current year)"), db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Get reading overview statistics for the user
    """
    user_id = user.get("user_id")
    
    # Get user's registration year
    user_record = db.query(user_models.User).filter(user_models.User.clerk_user_id == user_id).first()
    registration_year = user_record.created_at.year if user_record and user_record.created_at else datetime.now().year
    
    # Default to current year if not specified
    if year is None:
        year = datetime.now().year
    
    # Validate year is not before registration
    if year < registration_year:
        year = registration_year
    
    # Calculate date range for the selected year
    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)
    
    # Total Reads - count of all article clicks by user in selected year
    total_reads = db.query(func.count(models.UserArticleClicks.id)).filter(
        models.UserArticleClicks.user_id == user_id,
        models.UserArticleClicks.clicked_at >= year_start,
        models.UserArticleClicks.clicked_at <= year_end
    ).scalar() or 0
    
    # Total Reading Days - consecutive days with at least one article click in selected year
    clicks = db.query(
        cast(models.UserArticleClicks.clicked_at, Date).label('date')
    ).filter(
        models.UserArticleClicks.user_id == user_id,
        models.UserArticleClicks.clicked_at >= year_start,
        models.UserArticleClicks.clicked_at <= year_end
    ).distinct().order_by('date').all()
    
    # Calculate consecutive reading days (current streak)
    total_reading_days = 0
    if clicks:
        dates = [click.date for click in clicks]
        dates.sort(reverse=True)
        
        # Calculate current streak from most recent date
        current_streak = 1
        for i in range(len(dates) - 1):
            if (dates[i] - dates[i + 1]).days == 1:
                current_streak += 1
            else:
                break
        
        total_reading_days = current_streak
    
    # Top Tags Read - top 10 major MeSH terms (marked with *) in selected year
    clicked_article_ids = db.query(models.UserArticleClicks.article_id).filter(
        models.UserArticleClicks.user_id == user_id,
        models.UserArticleClicks.clicked_at >= year_start,
        models.UserArticleClicks.clicked_at <= year_end
    ).all()
    
    article_ids = [row[0] for row in clicked_article_ids]
    
    top_tags = []
    if article_ids:
        articles = db.query(models.Articles.mesh_terms).filter(
            models.Articles.id.in_(article_ids),
            models.Articles.mesh_terms.isnot(None)
        ).all()
        
        # Extract major MeSH terms (those with *)
        major_terms = []
        for article in articles:
            if article.mesh_terms:
                # Split by semicolon and filter for terms with *
                terms = article.mesh_terms.split(';')
                for term in terms:
                    term = term.strip()
                    if '*' in term:
                        # Remove the * and clean the term
                        clean_term = term.replace('*', '').strip()
                        # Only add if not already in the list (avoid duplicates within same article)
                        if clean_term:
                            major_terms.append(clean_term)
        
        # Count frequency and get top 10 (this will remove duplicates across articles)
        if major_terms:
            term_counts = Counter(major_terms)
            top_tags = [
                {"tag": tag, "count": count}
                for tag, count in term_counts.most_common(10)
            ]
    
    # Posts Read in Last Month (of the selected year, or last 30 days if current year)
    if year == datetime.now().year:
        # For current year, use last 30 days
        one_month_ago = datetime.now() - timedelta(days=30)
        posts_last_month = db.query(func.count(models.UserArticleClicks.id)).filter(
            models.UserArticleClicks.user_id == user_id,
            models.UserArticleClicks.clicked_at >= one_month_ago
        ).scalar() or 0
    else:
        # For past years, use December of that year
        december_start = datetime(year, 12, 1)
        december_end = datetime(year, 12, 31, 23, 59, 59)
        posts_last_month = db.query(func.count(models.UserArticleClicks.id)).filter(
            models.UserArticleClicks.user_id == user_id,
            models.UserArticleClicks.clicked_at >= december_start,
            models.UserArticleClicks.clicked_at <= december_end
        ).scalar() or 0
    
    # Daily Reading Activity for the selected year (for heatmap)
    daily_activity = db.query(
        cast(models.UserArticleClicks.clicked_at, Date).label('date'),
        func.count(models.UserArticleClicks.id).label('count')
    ).filter(
        models.UserArticleClicks.user_id == user_id,
        models.UserArticleClicks.clicked_at >= year_start,
        models.UserArticleClicks.clicked_at <= year_end
    ).group_by(cast(models.UserArticleClicks.clicked_at, Date)).all()
    
    # Convert to dictionary format for easy frontend consumption
    activity_by_date = {
        str(row.date): row.count for row in daily_activity
    }
    
    # Top Tags by Reading Days - Compare last 30 days vs previous 30 days of selected year
    # For current year: compare last 30 days vs previous 30 days
    # For past years: compare last 30 days of that year vs previous 30 days of that year
    current_year = datetime.now().year
    
    if year == current_year:
        # For current year, use actual last 30 days
        sixty_days_ago = datetime.now() - timedelta(days=60)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_start = thirty_days_ago
        recent_end = datetime.now()
        previous_start = sixty_days_ago
        previous_end = thirty_days_ago
    else:
        # For past years, use last 60 days of that year (Nov-Dec vs Sep-Oct)
        # Or if the year has less than 60 days of data, compare what's available
        year_end = datetime(year, 12, 31, 23, 59, 59)
        sixty_days_before_year_end = year_end - timedelta(days=60)
        thirty_days_before_year_end = year_end - timedelta(days=30)
        
        recent_start = thirty_days_before_year_end
        recent_end = year_end
        previous_start = sixty_days_before_year_end
        previous_end = thirty_days_before_year_end
    
    # Get articles clicked in recent period
    recent_clicks = db.query(models.UserArticleClicks.article_id).filter(
        models.UserArticleClicks.user_id == user_id,
        models.UserArticleClicks.clicked_at >= recent_start,
        models.UserArticleClicks.clicked_at <= recent_end
    ).all()
    recent_article_ids = [row[0] for row in recent_clicks]
    
    # Get articles clicked in previous period
    previous_clicks = db.query(models.UserArticleClicks.article_id).filter(
        models.UserArticleClicks.user_id == user_id,
        models.UserArticleClicks.clicked_at >= previous_start,
        models.UserArticleClicks.clicked_at < previous_end
    ).all()
    previous_article_ids = [row[0] for row in previous_clicks]
    
    trending_tags = []
    if recent_article_ids:
        # Get major MeSH terms from recent articles
        recent_articles = db.query(models.Articles.mesh_terms).filter(
            models.Articles.id.in_(recent_article_ids),
            models.Articles.mesh_terms.isnot(None)
        ).all()
        
        recent_terms = []
        for article in recent_articles:
            if article.mesh_terms:
                terms = article.mesh_terms.split(';')
                for term in terms:
                    term = term.strip()
                    if '*' in term:
                        clean_term = term.replace('*', '').strip()
                        if clean_term:
                            recent_terms.append(clean_term)
        
        # Get major MeSH terms from previous period articles
        previous_terms = []
        if previous_article_ids:
            previous_articles = db.query(models.Articles.mesh_terms).filter(
                models.Articles.id.in_(previous_article_ids),
                models.Articles.mesh_terms.isnot(None)
            ).all()
            
            for article in previous_articles:
                if article.mesh_terms:
                    terms = article.mesh_terms.split(';')
                    for term in terms:
                        term = term.strip()
                        if '*' in term:
                            clean_term = term.replace('*', '').strip()
                            if clean_term:
                                previous_terms.append(clean_term)
        
        # Count frequency in both periods
        recent_counts = Counter(recent_terms)
        previous_counts = Counter(previous_terms)
        
        # Calculate trends (top 8 tags from recent period)
        for tag, recent_count in recent_counts.most_common(8):
            previous_count = previous_counts.get(tag, 0)
            
            # Calculate percentage change
            if previous_count > 0:
                change = int(((recent_count - previous_count) / previous_count) * 100)
            else:
                # For new tags, use a special marker instead of 100%
                change = None  # Will be handled in frontend as "New"
            
            trending_tags.append({
                "tag": tag,
                "count": recent_count,
                "change": change,
                "is_new": previous_count == 0
            })
    
    return {
        "total_reads": total_reads,
        "total_reading_days": total_reading_days,
        "top_tags": top_tags,
        "posts_last_month": posts_last_month,
        "daily_activity": activity_by_date,
        "trending_tags": trending_tags,
        "selected_year": year,
        "registration_year": registration_year
    }


@router.get("/activity")
async def get_user_activity(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Get user activity statistics (upvotes and comments)
    """
    user_id = user.get("user_id")
    
    # Get upvoted articles with details
    upvoted_articles = db.query(
        models.Articles,
        models.UserUpvotes.upvoted_at
    ).join(
        models.UserUpvotes,
        models.Articles.id == models.UserUpvotes.article_id
    ).filter(
        models.UserUpvotes.user_id == user_id
    ).order_by(
        models.UserUpvotes.upvoted_at.desc()
    ).limit(50).all()
    
    upvoted_list = [
        {
            "article_id": article.id,
            "title": article.title,
            "journal": article.journal,
            "publication_date": article.publication_date.isoformat() if article.publication_date else None,
            "upvoted_at": upvoted_at.isoformat() if upvoted_at else None
        }
        for article, upvoted_at in upvoted_articles
    ]
    
    # Get user comments with article details
    user_comments = db.query(
        models.Comment,
        models.Articles.title,
        models.Articles.journal
    ).join(
        models.Articles,
        models.Comment.article_id == models.Articles.id
    ).filter(
        models.Comment.user_id == user_id
    ).order_by(
        models.Comment.created_at.desc()
    ).limit(50).all()
    
    comments_list = [
        {
            "comment_id": comment.id,
            "article_id": comment.article_id,
            "article_title": title,
            "article_journal": journal,
            "comment_text": comment.comment_text,
            "created_at": comment.created_at.isoformat() if comment.created_at else None
        }
        for comment, title, journal in user_comments
    ]
    
    return {
        "upvoted_articles": upvoted_list,
        "comments": comments_list
    }


@router.get("/user-tags")
async def get_user_tags(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Get the current user's selected tags from their feed settings
    """
    user_id = user.get("user_id")
    
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == user_id).first()
    
    if not feed or not feed.main_feed_tags:
        return {
            "tags": [],
            "message": "No tags configured yet"
        }
    
    return {
        "tags": feed.main_feed_tags,
        "last_updated": feed.main_feed_date_created.isoformat() if feed.main_feed_date_created else None
    }


@router.post("/update-user-tags")
async def update_user_tags(update_request: schemas.OnboardingRequest, db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Update the user's selected tags and regenerate embeddings for their feed.
    This allows users to refine their interests after initial onboarding.
    """
    from fnc import generate_embeddings
    
    user_id = user.get("user_id")
    
    if not update_request.tags or len(update_request.tags) == 0:
        raise HTTPException(status_code=400, detail="At least one tag is required")
    
    try:
        # Get user's feed entry
        feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == user_id).first()
        
        if not feed:
            raise HTTPException(status_code=404, detail="User feed not found. Please complete onboarding first.")
        
        # Combine tags into a single string for embedding generation
        tags_text = ", ".join(update_request.tags)
        
        # Generate new embeddings
        embeddings = generate_embeddings(tags_text)
        
        # Save current prompt to history before updating (keep last 5)
        history = list(feed.interest_prompts_history or [])
        history.insert(0, {
            "prompt": tags_text,
            "saved_at": datetime.now(timezone.utc).isoformat()
        })
        feed.interest_prompts_history = history[:5]
        
        # Update feed entry and invalidate cache
        feed.main_feed_tags = update_request.tags
        feed.main_feed_date_created = datetime.now(timezone.utc)
        feed.main_feed_embeddings = embeddings.tolist()
        feed.faiss_results_cache = None  # Invalidate cache when interests change
        feed.faiss_cache_date_created = None
        
        db.commit()
        db.refresh(feed)
        
        return {
            "message": "Tags updated successfully",
            "tags": feed.main_feed_tags,
            "updated_at": feed.main_feed_date_created.isoformat()
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update tags: {str(e)}")


@router.get("/interest-history")
async def get_interest_history(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Get the user's last 5 interest prompts history.
    """
    user_id = user.get("user_id")
    
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == user_id).first()
    
    if not feed:
        return {"history": []}
    
    return {
        "history": feed.interest_prompts_history or []
    }


@router.post("/reset-feed-settings")
async def reset_feed_settings(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Reset the user's feed settings by clearing main_feed_tags and faiss_results_cache.
    This effectively resets their interests and requires them to select new tags.
    """
    user_id = user.get("user_id")
    
    try:
        # Get user's feed entry
        feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == user_id).first()
        
        if not feed:
            raise HTTPException(status_code=404, detail="User feed not found. Please complete onboarding first.")
        
        # Reset feed settings
        feed.main_feed_tags = None
        feed.faiss_results_cache = None
        feed.main_feed_embeddings = None
        feed.main_feed_date_created = None
        feed.faiss_cache_date_created = None
        
        db.commit()
        
        return {
            "message": "Feed settings reset successfully",
            "tags": []
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset feed settings: {str(e)}")


@router.get("/feed-preferences")
async def get_feed_preferences(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Get the user's feed preference flags (e.g. upvote-based recommendations).
    """
    user_id = user.get("user_id")
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == user_id).first()

    if not feed:
        return {"upvote_based_recommendations": True}  # default

    return {
        "upvote_based_recommendations": feed.upvote_based_recommendations if feed.upvote_based_recommendations is not None else True,
    }


@router.post("/feed-preferences")
async def update_feed_preferences(
    payload: schemas.FeedPreferencesUpdate,
    db: Session = Depends(get_local_db),
    user: dict = Depends(get_current_user),
):
    """
    Update the user's feed preference flags.
    When upvote_based_recommendations changes, invalidate the FAISS cache
    so the next daily recompute (or manual refresh) picks up the new setting.
    """
    user_id = user.get("user_id")
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == user_id).first()

    if not feed:
        raise HTTPException(status_code=404, detail="User feed not found. Please complete onboarding first.")

    changed = False
    if payload.upvote_based_recommendations is not None:
        old_val = feed.upvote_based_recommendations
        feed.upvote_based_recommendations = payload.upvote_based_recommendations
        if old_val != payload.upvote_based_recommendations:
            changed = True

    if changed:
        # Invalidate FAISS cache so the daily recompute regenerates embeddings
        feed.faiss_results_cache = None
        feed.faiss_cache_date_created = None

    db.commit()
    db.refresh(feed)

    return {
        "message": "Feed preferences updated",
        "upvote_based_recommendations": feed.upvote_based_recommendations,
    }


@router.get("/scholar-profile")
async def get_scholar_profile(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Get the user's Google Scholar profile URL.
    """
    user_id = user.get("user_id")
    profile = db.query(user_models.UserProfile).filter(user_models.UserProfile.clerk_user_id == user_id).first()
    google_scholar_url = None
    if profile and profile.preferences:
        google_scholar_url = profile.preferences.get("google_scholar_url")
    return {"google_scholar_url": google_scholar_url}


@router.post("/scholar-profile")
async def update_scholar_profile(
    payload: schemas.ScholarProfileUpdate,
    db: Session = Depends(get_local_db),
    user: dict = Depends(get_current_user),
):
    """
    Save or clear the user's Google Scholar profile URL.
    """
    user_id = user.get("user_id")

    # Validate URL format if a value is provided
    url = payload.google_scholar_url.strip() if payload.google_scholar_url else None
    if url and not re.match(r'^https?://', url):
        raise HTTPException(status_code=400, detail="Invalid URL: must start with http:// or https://")

    profile = db.query(user_models.UserProfile).filter(user_models.UserProfile.clerk_user_id == user_id).first()

    if not profile:
        profile = user_models.UserProfile(
            clerk_user_id=user_id,
            preferences={"google_scholar_url": url},
        )
        db.add(profile)
    else:
        current_prefs = dict(profile.preferences) if profile.preferences else {}
        current_prefs["google_scholar_url"] = url
        profile.preferences = current_prefs

    db.commit()
    return {"message": "Scholar profile updated", "google_scholar_url": url}




