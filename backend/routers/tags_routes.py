"""
Tags routes for displaying all topics and statistics.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text, desc
from database import get_local_db
from models import Topics, Articles, UserArticleClicks, Feeds
from typing import List, Dict, Any
from datetime import datetime, timedelta

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/categorized")
def get_all_tags_categorized(db: Session = Depends(get_local_db)):
    """
    Get all tags organized by broadtopic category.
    Returns tags grouped by category with counts.
    """
    try:
        # Get all topics from database
        topics = db.query(Topics).all()
        
        # Organize by category
        categorized = {}
        for topic in topics:
            category = topic.broadtopic or "Other"
            if category not in categorized:
                categorized[category] = []
            
            categorized[category].append({
                "id": topic.id,
                "subtopic": topic.subtopic,
                "broadtopic": topic.broadtopic
            })
        
        # Sort categories alphabetically
        sorted_categories = dict(sorted(categorized.items()))
        
        # Sort tags within each category
        for category in sorted_categories:
            sorted_categories[category] = sorted(sorted_categories[category], key=lambda x: x['subtopic'])
        
        return {
            "categories": sorted_categories,
            "total_categories": len(sorted_categories),
            "total_tags": sum(len(tags) for tags in sorted_categories.values())
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tags: {str(e)}")


@router.get("/trending")
def get_trending_tags(limit: int = 10, db: Session = Depends(get_local_db)):
    """
    Get trending tags from the top 10 most clicked articles.
    Returns tags from articles that have been clicked the most.
    Only counts MeSH terms marked with asterisk (*) as major topics.
    """
    try:
        # Get the top 10 most clicked articles
        top_articles = db.query(Articles).order_by(desc(Articles.clicks)).limit(10).all()
        
        # Collect all mesh terms from these articles
        tag_counts = {}
        tag_to_topic = {}
        
        for article in top_articles:
            if article.mesh_terms:
                # MeSH terms are separated by semicolons
                terms = [term.strip() for term in article.mesh_terms.split(';') if term.strip()]
                # Track unique tags per article to avoid counting duplicates
                unique_tags_in_article = set()
                
                for term in terms:
                    # Only process terms that have an asterisk (major topics)
                    if '*' not in term:
                        continue
                    
                    # Remove asterisks and qualifiers (e.g., "/ drug effects")
                    clean_term = term.split('/')[0].strip().replace('*', '')
                    if not clean_term:
                        continue
                    term_lower = clean_term.lower()
                    
                    # Only count each tag once per article
                    if term_lower not in unique_tags_in_article:
                        unique_tags_in_article.add(term_lower)
                        if term_lower not in tag_counts:
                            tag_counts[term_lower] = 0
                            tag_to_topic[term_lower] = clean_term
                        tag_counts[term_lower] += 1
        
        # Get proper topic information from Topics table
        trending = []
        for term_lower, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True):
            topic = db.query(Topics).filter(
                func.lower(Topics.subtopic) == term_lower
            ).first()
            
            if topic:
                trending.append({
                    "tag": topic.subtopic,
                    "count": count,
                    "broadtopic": topic.broadtopic
                })
                
                if len(trending) >= limit:
                    break
        
        return {
            "trending_tags": trending,
            "total": len(trending)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trending tags: {str(e)}")


@router.get("/popular")
def get_popular_tags(limit: int = 10, db: Session = Depends(get_local_db)):
    """
    Get popular tags that users have included in their feeds.
    Returns top tags by frequency across all user feeds.
    """
    try:
        # Get all user feeds
        feeds = db.query(Feeds).filter(Feeds.main_feed_tags.isnot(None)).all()
        
        # Count tag occurrences across all feeds
        tag_counts = {}
        
        for feed in feeds:
            if feed.main_feed_tags and isinstance(feed.main_feed_tags, list):
                for tag in feed.main_feed_tags:
                    tag_lower = tag.lower() if isinstance(tag, str) else str(tag).lower()
                    if tag_lower not in tag_counts:
                        tag_counts[tag_lower] = 0
                    tag_counts[tag_lower] += 1
        
        # Get proper topic information from Topics table
        popular = []
        for term_lower, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]:
            topic = db.query(Topics).filter(
                func.lower(Topics.subtopic) == term_lower
            ).first()
            
            if topic:
                popular.append({
                    "tag": topic.subtopic,
                    "count": count,
                    "broadtopic": topic.broadtopic
                })
        
        return {
            "popular_tags": popular,
            "total": len(popular)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch popular tags: {str(e)}")


@router.get("/most-upvoted")
def get_most_upvoted_tags(limit: int = 10, db: Session = Depends(get_local_db)):
    """
    Get tags from the top 10 most upvoted articles.
    Returns tags from articles that have received the most upvotes.
    Only counts MeSH terms marked with asterisk (*) as major topics.
    """
    try:
        # Get the top 10 most upvoted articles
        top_articles = db.query(Articles).order_by(desc(Articles.upvotes)).limit(10).all()
        
        # Collect all mesh terms from these articles
        tag_counts = {}
        tag_to_topic = {}
        
        for article in top_articles:
            if article.mesh_terms:
                # MeSH terms are separated by semicolons
                terms = [term.strip() for term in article.mesh_terms.split(';') if term.strip()]
                # Track unique tags per article to avoid counting duplicates
                unique_tags_in_article = set()
                
                for term in terms:
                    # Only process terms that have an asterisk (major topics)
                    if '*' not in term:
                        continue
                    
                    # Remove asterisks and qualifiers (e.g., "/ drug effects")
                    clean_term = term.split('/')[0].strip().replace('*', '')
                    if not clean_term:
                        continue
                    term_lower = clean_term.lower()
                    
                    # Only count each tag once per article
                    if term_lower not in unique_tags_in_article:
                        unique_tags_in_article.add(term_lower)
                        if term_lower not in tag_counts:
                            tag_counts[term_lower] = 0
                            tag_to_topic[term_lower] = clean_term
                        tag_counts[term_lower] += 1
        
        # Get proper topic information from Topics table
        most_upvoted = []
        for term_lower, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True):
            topic = db.query(Topics).filter(
                func.lower(Topics.subtopic) == term_lower
            ).first()
            
            if topic:
                most_upvoted.append({
                    "tag": topic.subtopic,
                    "count": count,
                    "broadtopic": topic.broadtopic
                })
                
                if len(most_upvoted) >= limit:
                    break
        
        return {
            "most_upvoted_tags": most_upvoted,
            "total": len(most_upvoted)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch most upvoted tags: {str(e)}")


@router.get("/stats")
def get_tag_statistics(db: Session = Depends(get_local_db)):
    """
    Get overall statistics about tags.
    """
    try:
        # Count total topics
        total_topics = db.query(Topics).count()
        
        # Count unique categories
        unique_categories = db.query(Topics.broadtopic).distinct().count()
        
        return {
            "total_topics": total_topics,
            "unique_categories": unique_categories
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tag statistics: {str(e)}")
