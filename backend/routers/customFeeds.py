from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user, get_optional_user
from crud import crud_customFeeds
import schemas, models
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func
import uuid

router = APIRouter(prefix="/customFeeds", tags=["customFeeds"])


@router.get("/get_custom_feeds")
def get_custom_feeds(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    if not feeds or not feeds.feeds:
        return {"feeds": []}

    custom_feeds = [f for f in feeds.feeds if f.get("feed_type", "custom_feed") != "journal_follow"]
    return {"feeds": custom_feeds}


@router.get("/get_journal_follows")
def get_journal_follows(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    if not feeds or not feeds.feeds:
        return {"journal_follows": []}

    journal_follows = [f for f in feeds.feeds if f.get("feed_type") == "journal_follow"]
    return {"journal_follows": journal_follows}



@router.post("/create_new_feed")
def create_new_feed(data: schemas.CreateFeed, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    feed_type = data.feed_type if data.feed_type else "custom_feed"

    if feeds and feeds.feeds:
        same_type_feeds = [f for f in feeds.feeds if f.get("feed_type", "custom_feed") == feed_type]
        if len(same_type_feeds) >= 20:
            label = "journal follows" if feed_type == "journal_follow" else "custom feeds"
            raise HTTPException(status_code=400, detail=f"Maximum limit of 20 {label} reached. Please delete one to create a new one.")

    feedKey = f"feed_{uuid.uuid4().hex[:8]}"

    embeddings = crud_customFeeds.create_embeddings(data.tags) if feed_type != "journal_follow" else None

    new_feed = {
        "key": feedKey,
        "name": data.name,
        "icon": data.icon,
        "feed_type": feed_type,
        "tags": data.tags if data.tags else [],
        "journals": data.journals if data.journals else [],
        "include_all_journals": data.include_all_journals if data.include_all_journals is not None else True,
        "publishers": data.publishers if data.publishers else [],
        "default_sorting": data.default_sorting if data.default_sorting else "recommended",
        "time_range": data.time_range if data.time_range else "all_time",
        "publication_types": data.publication_types if data.publication_types else [],
        "graphical_abstract_only": data.graphical_abstract_only if data.graphical_abstract_only else False,
        "open_access_only": data.open_access_only if data.open_access_only else False,
        "embeddings": embeddings if embeddings else None,
    }
    
    # Create or update feeds record
    if not feeds:
        feeds = models.Feeds(
            clerk_user_id=current_user["user_id"],
            feeds=[new_feed],
        )
        db.add(feeds)
    else:
        # Create new list with all feeds as new dict objects
        existing_feeds = [dict(feed) for feed in (feeds.feeds or [])]
        existing_feeds.append(new_feed)
        
        # Mark the field as modified and reassign
        from sqlalchemy.orm.attributes import flag_modified
        feeds.feeds = existing_feeds
        flag_modified(feeds, "feeds")
    
    db.commit()
    db.refresh(feeds)
    
    return {"message": "Feed created successfully", "feed": new_feed}



@router.post("/update_feed")
def update_feed(data: schemas.UpdateFeed, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    # Get existing feeds for the user
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()

    if not feeds or not feeds.feeds:
        raise HTTPException(status_code=404, detail="No feeds found for this user")
    
    # Find and update the feed - create completely new objects to ensure change detection
    existing_feeds = list(feeds.feeds)
    feed_found = False
    updated_feeds = []
    
    # Generate embeddings
    embeddings = crud_customFeeds.create_embeddings(data.tags)
    
    for feed in existing_feeds:
        if feed.get("key") == data.key:
            feed_found = True
            updated_feed = {
                "key": feed["key"],
                "feed_type": feed.get("feed_type", "custom_feed"),
                "name": data.name if data.name is not None else feed["name"],
                "icon": data.icon if data.icon is not None else feed["icon"],
                "tags": data.tags if data.tags is not None else feed.get("tags", []),
                "journals": data.journals if data.journals is not None else feed.get("journals", []),
                "include_all_journals": data.include_all_journals if data.include_all_journals is not None else feed.get("include_all_journals", True),
                "publishers": data.publishers if data.publishers is not None else feed.get("publishers", []),
                "default_sorting": data.default_sorting if data.default_sorting is not None else feed.get("default_sorting", "recommended"),
                "time_range": data.time_range if data.time_range is not None else feed.get("time_range", "all_time"),
                "publication_types": data.publication_types if data.publication_types is not None else feed.get("publication_types", []),
                "graphical_abstract_only": data.graphical_abstract_only if data.graphical_abstract_only is not None else feed.get("graphical_abstract_only", False),
                "open_access_only": data.open_access_only if data.open_access_only is not None else feed.get("open_access_only", False),
                "embeddings": embeddings if embeddings else None,
            }
            updated_feeds.append(updated_feed)
        else:
            # Keep other feeds as-is but create new dict
            updated_feeds.append(dict(feed))
    
    if not feed_found:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    # Mark the field as modified and reassign
    from sqlalchemy.orm.attributes import flag_modified
    feeds.feeds = updated_feeds
    flag_modified(feeds, "feeds")
    
    db.commit()
    db.refresh(feeds)
    
    return {"message": "Feed updated successfully", "feeds": feeds.feeds}


@router.post("/delete_feed")
def delete_feed(data: schemas.DeleteFeed, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    # Get existing feeds for the user
    feeds = db.query(models.Feeds).filter(models.Feeds.clerk_user_id == current_user["user_id"]).first()
    
    if not feeds or not feeds.feeds:
        raise HTTPException(status_code=404, detail="No feeds found for this user")
    
    # Filter out the feed to delete - create new dict objects
    existing_feeds = list(feeds.feeds)
    updated_feeds = [dict(feed) for feed in existing_feeds if feed.get("key") != data.key]
    
    if len(updated_feeds) == len(existing_feeds):
        raise HTTPException(status_code=404, detail="Feed not found")
    
    # Mark the field as modified and reassign
    from sqlalchemy.orm.attributes import flag_modified
    feeds.feeds = updated_feeds
    flag_modified(feeds, "feeds")
    
    db.commit()
    db.refresh(feeds)
    
    return {"message": "Feed deleted successfully", "feeds": feeds.feeds}


@router.get("/get_topics")
def get_topics(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    topics = db.query(models.Topics).all()
    # Serialize topics to list of dictionaries
    topics_list = [
        {
            "id": topic.id,
            "broadtopic": topic.broadtopic,
            "subtopic": topic.subtopic,
        }
        for topic in topics
    ]
    return {"topics": topics_list}


@router.get("/get_journals")
def get_journals(search: str = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get journals. If search is provided, filter by journal title.
    Otherwise, return top 20 journals by impact factor.
    """
    impactFactorThreshold = db.query(models.Settings.setting_value).filter(models.Settings.setting_key == "impact_factor_threshold").scalar()

    
    query = db.query(models.TrackedJournal).filter(
        models.TrackedJournal.is_active_by_user == True,
        models.TrackedJournal.wos_impact_factor >= float(impactFactorThreshold) if impactFactorThreshold else 0,
        )
    
    if search:
        # Filter by journal title (case-insensitive)
        query = query.filter(
            func.lower(models.TrackedJournal.journal_title).contains(func.lower(search))
        )
        # Order by impact factor descending, then by title
        query = query.order_by(
            models.TrackedJournal.wos_impact_factor.desc().nullslast(),
            models.TrackedJournal.journal_title
        )
        # Limit to 50 results for search
        journals = query.limit(50).all()
    else:
        # Return top 20 journals by impact factor
        query = query.order_by(
            models.TrackedJournal.wos_impact_factor.desc().nullslast()
        )
        journals = query.limit(20).all()
    
    # Serialize journals to list of dictionaries
    journals_list = [
        {
            "id": journal.id,
            "journal_title": journal.journal_title,
            "issn": journal.issn,
            "eissn": journal.eissn,
            "wos_impact_factor": journal.wos_impact_factor,
        }
        for journal in journals
    ]
    
    return {"journals": journals_list}


@router.get("/get_publication_types")
def get_publication_types(current_user: dict = Depends(get_current_user),db: Session = Depends(get_local_db)):
    """
    Get distinct publication types from Articles table.
    """
    # Query distinct publication types, excluding None/null values
    publication_types = db.query(models.Articles.publication_type)\
        .distinct()\
        .filter(models.Articles.publication_type.isnot(None))\
        .filter(models.Articles.publication_type != "")\
        .order_by(models.Articles.publication_type)\
        .all()
    
    # Extract publication type values from tuples
    types_list = [pt[0] for pt in publication_types if pt[0]]
    
    return {"publication_types": types_list}


@router.get("/get_publishers")
def get_publishers(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get distinct publishers from ScimagojrRankings table
    by joining with Articles table on ISSN.
    Note: ScimagojrRankings.issn may contain comma-separated values.
    """
    # Get distinct articles ISSNs first
    article_issns = db.query(models.Articles.issn)\
        .filter(models.Articles.issn.isnot(None))\
        .filter(models.Articles.issn != "")\
        .distinct()\
        .all()
    
    article_issns_set = {issn[0].strip() for issn in article_issns if issn[0]}
    
    # Query all publishers from ScimagojrRankings
    scimagojr_records = db.query(
        models.ScimagojrRankings.publisher,
        models.ScimagojrRankings.issn
    )\
        .filter(models.ScimagojrRankings.publisher.isnot(None))\
        .filter(models.ScimagojrRankings.publisher != "")\
        .filter(models.ScimagojrRankings.issn.isnot(None))\
        .all()
    
    # Filter publishers where at least one ISSN matches (handling comma-separated ISSNs)
    matching_publishers = set()
    for publisher, issn_string in scimagojr_records:
        if issn_string:
            # Split by comma and check if any ISSN matches
            issns = [i.strip() for i in issn_string.split(',')]
            if any(issn in article_issns_set for issn in issns):
                matching_publishers.add(publisher)
    
    # Sort and return
    publishers_list = sorted(list(matching_publishers))
    
    return {"publishers": publishers_list}




@router.get("/get_recommended_by_faiss_feed")
def get_recommended_by_faiss(feed_key: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db), k: int = 1000):
    """
    Get article recommendations for a specific custom feed using FAISS.
    
    Args:
        feed_key: The key of the custom feed (e.g., 'feed_520b76fe')
        k: Number of results to return from FAISS (max 1000)
    """
    if k > 1000:
        raise HTTPException(status_code=400, detail="k cannot exceed 1000.")

    k = max(k, 1)

    return crud_customFeeds.get_get_recommended_by_faiss(feed_key=feed_key, current_user=current_user, db=db, k=k)