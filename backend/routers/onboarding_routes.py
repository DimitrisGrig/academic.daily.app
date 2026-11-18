"""
Onboarding routes for tag selection with intelligent suggestions based on embeddings.

Performance notes:
- Ensure indexes exist on: topics.broadtopic, topics.subtopic
- The get_categorized_tags endpoint now excludes embeddings for faster queries
- Database-side sorting is used instead of Python-side sorting
"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from database import get_local_db
from sqlalchemy.orm import Session
from models import Topics
import numpy as np
from typing import List, Optional
from pydantic import BaseModel


router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class TagSuggestionsRequest(BaseModel):
    selected_tags: List[str]
    limit: int = 30


@router.get("/tags/categorized")
def get_categorized_tags(db: Session = Depends(get_local_db)):
    """
    Get all tags organized by category for initial display.
    Returns tags grouped by broadtopic (category).
    
    Optimizations:
    - Only fetches id, subtopic, broadtopic (excludes heavy embedding vectors)
    - Uses database-side ordering (ORDER BY) instead of Python sorting
    - Reduced memory footprint and transfer time
    """
    try:
        # Get all topics from database WITHOUT embeddings (much faster)
        # Only select the fields we need, ordered by broadtopic and subtopic
        topics = db.query(
            Topics.id,
            Topics.subtopic,
            Topics.broadtopic
        ).filter(
            Topics.embeddings.isnot(None)
        ).order_by(
            Topics.broadtopic,
            Topics.subtopic
        ).all()
        
        # Organize by category (topics are already sorted)
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
        
        return {
            "categories": categorized,
            "total_tags": sum(len(tags) for tags in categorized.values())
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tags: {str(e)}")



@router.post("/tags/suggestions")
def get_tag_suggestions(request: TagSuggestionsRequest, db: Session = Depends(get_local_db)):
    """
    Get intelligent tag suggestions based on currently selected tags.
    Uses embedding similarity to recommend related tags.
    
    Args:
        selected_tags: List of already selected tag names
        limit: Maximum number of suggestions to return (default: 30)
    """
    try:
        if not request.selected_tags:
            # If no tags selected, return popular tags from each category
            topics = db.query(Topics).filter(Topics.embeddings.isnot(None)).limit(50).all()
            return {
                "suggestions": [
                    {
                        "id": t.id,
                        "subtopic": t.subtopic,
                        "broadtopic": t.broadtopic,
                        "relevance_score": 1.0,
                        "reason": "Popular tag"
                    }
                    for t in topics
                ],
                "strategy": "popular"
            }
        
        # Get embeddings for selected tags
        selected_topics = db.query(Topics).filter(
            Topics.subtopic.in_(request.selected_tags),
            Topics.embeddings.isnot(None)
        ).all()
        
        if not selected_topics:
            raise HTTPException(status_code=400, detail="No valid selected tags found")
        
        # Calculate average embedding of selected tags
        selected_embeddings = np.array([
            np.array(topic.embeddings) 
            for topic in selected_topics
        ])
        avg_embedding = np.mean(selected_embeddings, axis=0)
        avg_embedding_list = avg_embedding.tolist()
        
        # Use pgvector's <=> operator directly with raw SQL
        # The <=> operator computes cosine distance and can use vector indexes
        # Note: pgvector uses distance, so smaller values = more similar
        from sqlalchemy import text
        
        # Create SQL query with pgvector's <=> operator
        # Format embedding as PostgreSQL vector literal string
        embedding_str = '[' + ','.join(map(str, avg_embedding_list)) + ']'
        
        # Build excluded tags as a SQL array literal to avoid parameter binding issues
        # Escape single quotes in tag names
        excluded_tags_escaped = [tag.replace("'", "''") for tag in request.selected_tags]
        excluded_tags_literal = "ARRAY['" + "','".join(excluded_tags_escaped) + "']"
        
        # Use string interpolation for the embedding vector to ensure compatibility
        # across different pgvector versions (some don't support CAST with parameters)
        query_str = f"""
            SELECT id, subtopic, broadtopic, 
                   embeddings <=> '{embedding_str}'::vector AS distance
            FROM topics
            WHERE subtopic != ALL({excluded_tags_literal})
              AND embeddings IS NOT NULL
            ORDER BY embeddings <=> '{embedding_str}'::vector
            LIMIT :limit
        """
        
        query = text(query_str)
        
        # Execute raw SQL query with only the limit parameter
        result = db.execute(query, {"limit": request.limit})
        
        similar_topics = result.fetchall()
        
        # Convert distance to similarity score (1 - distance)
        # cosine distance ranges from 0 (identical) to 2 (opposite)
        # cosine similarity ranges from 1 (identical) to -1 (opposite)
        suggestions = [
            {
                "id": topic.id,
                "subtopic": topic.subtopic,
                "broadtopic": topic.broadtopic,
                "relevance_score": float(1 - topic.distance),
                "reason": "Similar to your interests"
            }
            for topic in similar_topics
        ]
        
        return {
            "suggestions": suggestions,
            "strategy": "embedding_similarity",
            "based_on": request.selected_tags
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")



@router.get("/tags/popular")
def get_popular_tags(limit: int = 20, db: Session = Depends(get_local_db)):
    """
    Get most popular/essential tags for quick start.
    Returns a diverse set of high-level tags from different categories.
    
    Optimized: Only fetches needed columns (excludes embeddings).
    """
    try:
        # Get tags from different categories to ensure diversity
        popular_categories = [
            "Medical Specialties",
            "Cancer Types",
            "Diseases & Conditions",
            "Research Methods",
            "Molecular Biology"
        ]
        
        popular_tags = []
        tags_per_category = limit // len(popular_categories)
        
        for category in popular_categories:
            topics = db.query(
                Topics.id,
                Topics.subtopic,
                Topics.broadtopic
            ).filter(
                Topics.broadtopic == category,
                Topics.embeddings.isnot(None)
            ).limit(tags_per_category).all()
            
            for topic in topics:
                popular_tags.append({
                    "id": topic.id,
                    "subtopic": topic.subtopic,
                    "broadtopic": topic.broadtopic
                })
        
        return {
            "popular_tags": popular_tags,
            "total": len(popular_tags)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch popular tags: {str(e)}")


@router.get("/tags/search")
def search_tags(query: str, limit: int = 50, db: Session = Depends(get_local_db)):
    """
    Fuzzy search for tags in the Topics table.
    Searches across all subtopics with case-insensitive partial matching.
    
    Args:
        query: Search term (supports partial matches, case-insensitive)
        limit: Maximum number of results to return (default: 50)
    
    Examples:
        - "rna" will match "RNA-seq", "RNA", "mRNA", etc.
        - "canc" will match "Cancer", "Cancer Biology", "Breast Cancer", etc.
        - "crispr" will match "CRISPR", "CRISPR-Cas9", etc.
    """
    try:
        if not query or len(query.strip()) == 0:
            return {
                "results": [],
                "total": 0,
                "query": query
            }
        
        query_lower = query.strip().lower()
        
        # Use PostgreSQL ILIKE for case-insensitive pattern matching
        # The % wildcard allows partial matches anywhere in the string
        search_pattern = f"%{query_lower}%"
        
        topics = db.query(
            Topics.id,
            Topics.subtopic,
            Topics.broadtopic
        ).filter(
            Topics.subtopic.ilike(search_pattern),
            Topics.embeddings.isnot(None)
        ).limit(limit).all()
        
        results = [
            {
                "id": topic.id,
                "subtopic": topic.subtopic,
                "broadtopic": topic.broadtopic
            }
            for topic in topics
        ]
        
        return {
            "results": results,
            "total": len(results),
            "query": query
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search tags: {str(e)}")
