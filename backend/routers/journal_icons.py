from fastapi import APIRouter, Depends, HTTPException, Query
from auth import get_current_user
from sqlalchemy.orm import Session
from database import get_local_db
from crud.crud_journal_icons import (
    get_all_journal_icons,
    get_icon_by_journal_name,
    get_icon_map,
)

router = APIRouter(prefix="/journal_icons", tags=["journal_icons"])


@router.get("/all")
def list_all_icons(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """Return every journal icon row (admin / debug use)."""
    icons = get_all_journal_icons(db)
    return {
        "count": len(icons),
        "icons": [
            {
                "id": i.id,
                "journal_name": i.journal_name,
                "icon_url": i.icon_url,
                "source_domain": i.source_domain,
            }
            for i in icons
        ],
    }


@router.get("/lookup")
def lookup_icon(
    journal_name: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """Look up the icon for a single journal by name (case-insensitive)."""
    icon = get_icon_by_journal_name(db, journal_name)
    if not icon:
        raise HTTPException(status_code=404, detail="No icon found for this journal")
    return {
        "journal_name": icon.journal_name,
        "icon_url": icon.icon_url,
        "source_domain": icon.source_domain,
    }


@router.post("/batch")
def batch_lookup_icons(
    journal_names: list[str],
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """Given a list of journal names, return a map of {journal_name: icon_url}.

    Useful for the MainFeed to resolve icons for a page of articles in one call.
    """
    icon_map = get_icon_map(db, journal_names)
    return {"icons": icon_map}
