from fastapi import APIRouter, Depends, HTTPException, Request
from auth import get_current_user, get_optional_user
import schemas, models
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func
from sqlalchemy.orm.attributes import flag_modified
from typing import List
from crud.crud_journal_icons import enrich_articles_with_icons

import uuid

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("/get_folders")
def get_bookmark_folders(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Get all bookmark folders for the current user"""
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    if not feeds or not feeds.bookmarks:
        return {"folders": []}
    
    # Bookmarks is stored as JSONB with structure: {"folders": [...], "items": [...]}
    bookmarks_data = feeds.bookmarks if isinstance(feeds.bookmarks, dict) else {}
    folders = bookmarks_data.get("folders", [])
    
    return {"folders": folders}


@router.get("/get_user_bookmarks")
def get_user_bookmarks(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Get all saved bookmarks for the current user
    
    Returns the saved_bookmarks structure:
    {
        "saved_bookmarks": {
            "folder_key_1": [article_id_1, article_id_2, ...],
            "folder_key_2": [article_id_3, ...],
            ...
        }
    }
    """
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    if not feeds or not feeds.saved_bookmarks:
        return {"saved_bookmarks": {}}
    
    # Ensure saved_bookmarks is a dictionary
    if not isinstance(feeds.saved_bookmarks, dict):
        return {"saved_bookmarks": {}}
    
    return {"saved_bookmarks": feeds.saved_bookmarks}


@router.post("/create_folder")
def create_bookmark_folder(data: schemas.CreateBookmarkFolder, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Create a new bookmark folder"""
    # Get existing feeds/bookmarks for the user
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    # Initialize bookmarks data structure
    bookmarks_data = {}
    if feeds and feeds.bookmarks and isinstance(feeds.bookmarks, dict):
        bookmarks_data = dict(feeds.bookmarks)
    
    folders = bookmarks_data.get("folders", [])
    
    # Check if user already has 20 folders (maximum limit)
    if len(folders) >= 20:
        raise HTTPException(status_code=400, detail="Maximum limit of 20 bookmark folders reached. Please delete a folder to create a new one.")
    
    # Generate a unique folder key using UUID
    folder_key = f"folder_{uuid.uuid4().hex[:8]}"
    
    # Create new folder object
    new_folder = {
        "key": folder_key,
        "name": data.name,
        "icon": data.icon,
    }
    
    # Add new folder to the list
    folders = [dict(f) for f in folders]
    folders.append(new_folder)
    bookmarks_data["folders"] = folders
    
    # Create or update feeds record
    if not feeds:
        feeds = models.Feeds(
            clerk_user_id=current_user["user_id"],
            bookmarks=bookmarks_data,
        )
        db.add(feeds)
    else:
        # Mark the field as modified and reassign
        from sqlalchemy.orm.attributes import flag_modified
        feeds.bookmarks = bookmarks_data
        flag_modified(feeds, "bookmarks")
    
    db.commit()
    db.refresh(feeds)
    
    return {"message": "Folder created successfully", "folder": new_folder}


@router.post("/update_folder")
def update_bookmark_folder(data: schemas.UpdateBookmarkFolder, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Update an existing bookmark folder"""
    # Get existing feeds/bookmarks for the user
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    if not feeds or not feeds.bookmarks:
        raise HTTPException(status_code=404, detail="No bookmarks found for this user")
    
    bookmarks_data = dict(feeds.bookmarks) if isinstance(feeds.bookmarks, dict) else {}
    folders = bookmarks_data.get("folders", [])
    
    if not folders:
        raise HTTPException(status_code=404, detail="No folders found for this user")
    
    # Find and update the folder
    folder_found = False
    updated_folders = []
    
    for folder in folders:
        if folder.get("key") == data.key:
            folder_found = True
            # Create a new dict with updated values
            updated_folder = {
                "key": folder["key"],
                "name": data.name if data.name is not None else folder["name"],
                "icon": data.icon if data.icon is not None else folder["icon"],
            }
            updated_folders.append(updated_folder)
        else:
            # Keep other folders as-is but create new dict
            updated_folders.append(dict(folder))
    
    if not folder_found:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Update bookmarks data
    bookmarks_data["folders"] = updated_folders
    
    # Mark the field as modified and reassign
    from sqlalchemy.orm.attributes import flag_modified
    feeds.bookmarks = bookmarks_data
    flag_modified(feeds, "bookmarks")
    
    db.commit()
    db.refresh(feeds)
    
    return {"message": "Folder updated successfully", "folders": updated_folders}


@router.post("/delete_folder")
def delete_bookmark_folder(data: schemas.DeleteBookmarkFolder, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Delete a bookmark folder"""
    # Get existing feeds/bookmarks for the user
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    if not feeds or not feeds.bookmarks:
        raise HTTPException(status_code=404, detail="No bookmarks found for this user")
    
    bookmarks_data = dict(feeds.bookmarks) if isinstance(feeds.bookmarks, dict) else {}
    folders = bookmarks_data.get("folders", [])
    
    if not folders:
        raise HTTPException(status_code=404, detail="No folders found for this user")
    
    # Filter out the folder to delete
    updated_folders = [dict(folder) for folder in folders if folder.get("key") != data.key]
    
    if len(updated_folders) == len(folders):
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Update bookmarks data
    bookmarks_data["folders"] = updated_folders
    
    # Mark the field as modified and reassign
    from sqlalchemy.orm.attributes import flag_modified
    feeds.bookmarks = bookmarks_data
    flag_modified(feeds, "bookmarks")
    
    db.commit()
    db.refresh(feeds)
    
    return {"message": "Folder deleted successfully", "folders": updated_folders}



@router.post("/save_bookmark")
def save_bookmark(data: schemas.SaveBookmark, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Save a bookmark to a folder
    
    Structure of saved_bookmarks:
    {
        "folder_key_1": [article_id_1, article_id_2, ...],
        "folder_key_2": [article_id_3, ...],
        ...
    }
    """
    clerk_user_id = current_user["user_id"]
    
    # Get or create feeds record for user
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == clerk_user_id).first()
    if not feed:
        feed = models.Feeds(clerk_user_id=clerk_user_id)
        db.add(feed)
        db.commit()
        db.refresh(feed)
    
    # Initialize saved_bookmarks as a dictionary if it doesn't exist
    if not feed.saved_bookmarks or not isinstance(feed.saved_bookmarks, dict):
        saved_bookmarks = {}
    else:
        saved_bookmarks = dict(feed.saved_bookmarks)
    
    # Get or create the list of articles in this folder
    if data.folder_key not in saved_bookmarks:
        saved_bookmarks[data.folder_key] = []
    
    # Add article to folder if not already there
    if data.article_id not in saved_bookmarks[data.folder_key]:
        saved_bookmarks[data.folder_key].append(data.article_id)
    
    # Update the feed
    feed.saved_bookmarks = saved_bookmarks
    flag_modified(feed, "saved_bookmarks")
    
    db.commit()
    db.refresh(feed)
    
    return {
        "success": True,
        "message": "Bookmark saved successfully",
        "folder_key": data.folder_key,
        "article_id": data.article_id,
        "saved_bookmarks": feed.saved_bookmarks,
    }

@router.post("/delete_bookmark")
def delete_bookmark(data: schemas.DeleteBookmark, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """Delete a bookmark from a folder
    
    Removes a specific article from a folder's bookmark list.
    If the folder becomes empty, it remains in the structure (not deleted).
    """
    clerk_user_id = current_user["user_id"]
    
    # Get feeds record for user
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == clerk_user_id).first()
    if not feed or not feed.saved_bookmarks:
        raise HTTPException(status_code=404, detail="No bookmarks found for this user")
    
    # Ensure saved_bookmarks is a dictionary
    if not isinstance(feed.saved_bookmarks, dict):
        raise HTTPException(status_code=400, detail="Invalid bookmarks structure")
    
    saved_bookmarks = dict(feed.saved_bookmarks)
    
    # Check if folder exists
    if data.folder_key not in saved_bookmarks:
        raise HTTPException(status_code=404, detail=f"Folder '{data.folder_key}' not found")
    
    # Check if article exists in folder
    if data.article_id not in saved_bookmarks[data.folder_key]:
        raise HTTPException(status_code=404, detail=f"Article {data.article_id} not found in folder '{data.folder_key}'")
    
    # Remove the article from the folder
    saved_bookmarks[data.folder_key].remove(data.article_id)
    
    # Update the feed
    from sqlalchemy.orm.attributes import flag_modified
    feed.saved_bookmarks = saved_bookmarks
    flag_modified(feed, "saved_bookmarks")
    
    db.commit()
    db.refresh(feed)
    
    return {
        "success": True,
        "message": "Bookmark deleted successfully",
        "folder_key": data.folder_key,
        "article_id": data.article_id,
        "saved_bookmarks": feed.saved_bookmarks,
    }


@router.get("/get_articles_by_folder")
def get_articles_by_folder(folder_key: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get all articles saved in a specific bookmark folder.
    
    Args:
        folder_key: The folder key (e.g., 'quick_saves' or 'folder_xxxxx')
    
    Returns:
        List of articles with full data including upvotes and user interactions
    """
    clerk_user_id = current_user["user_id"]
    
    # Get feeds record for user
    feed = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == clerk_user_id).first()
    if not feed or not feed.saved_bookmarks:
        return []
    
    # Ensure saved_bookmarks is a dictionary
    if not isinstance(feed.saved_bookmarks, dict):
        return []
    
    # Get article IDs for this folder
    article_ids = feed.saved_bookmarks.get(folder_key, [])
    
    if not article_ids:
        return []
    
    # Fetch articles from database
    articles = db.query(models.Articles).filter(models.Articles.id.in_(article_ids)).all()
    
    # Get user's upvotes
    upvoted_articles = db.query(models.UserUpvotes.article_id).filter(
        models.UserUpvotes.user_id == clerk_user_id,
        models.UserUpvotes.article_id.in_(article_ids)
    ).all()
    upvoted_article_ids = {article_id for (article_id,) in upvoted_articles}
    
    # Get comments count for each article
    comments_count = db.query(
        models.Comment.article_id,
        func.count(models.Comment.id).label('count')
    ).filter(
        models.Comment.article_id.in_(article_ids)
    ).group_by(models.Comment.article_id).all()
    comments_count_map = {article_id: count for article_id, count in comments_count}
    
    # Get upvotes count for each article
    upvotes_count = db.query(
        models.UserUpvotes.article_id,
        func.count(models.UserUpvotes.id).label('count')
    ).filter(
        models.UserUpvotes.article_id.in_(article_ids)
    ).group_by(models.UserUpvotes.article_id).all()
    upvotes_map = {article_id: count for article_id, count in upvotes_count}
    
    # Get journal impact factors
    journal_issns = [article.issn for article in articles if article.issn]
    wos_journals = {}
    if journal_issns:
        wos_data = db.query(models.WosJournalsClarivateRankings).filter(models.WosJournalsClarivateRankings.issn.in_(journal_issns)).all()
        wos_journals = {journal.issn: journal for journal in wos_data}
    
    scimagojr_data = {}
    if journal_issns:
        scimagojr = db.query(models.ScimagojrRankings).filter(models.ScimagojrRankings.issn.in_(journal_issns)).all()
        scimagojr_data = {journal.issn: journal for journal in scimagojr}
    
    # Build response
    results = []
    for article in articles:
        wos_journal = wos_journals.get(article.issn)
        scimagojr_rankings = scimagojr_data.get(article.issn)
        
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
            'similarity_score': 0,  # No similarity score for bookmarks
            'upvotes': upvotes_map.get(article.id, 0),
            'user_has_upvoted': article.id in upvoted_article_ids,
            'comments_count': comments_count_map.get(article.id, 0),
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
    
    return results


