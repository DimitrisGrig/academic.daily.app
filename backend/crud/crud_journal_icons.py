from sqlalchemy.orm import Session
from sqlalchemy import func
import models


def get_all_journal_icons(db: Session):
    """Return all journal icons."""
    return db.query(models.JournalIcon).order_by(models.JournalIcon.journal_name).all()


def get_icon_by_journal_name(db: Session, journal_name: str):
    """Case-insensitive lookup for a single journal icon."""
    return (
        db.query(models.JournalIcon)
        .filter(func.lower(models.JournalIcon.journal_name) == journal_name.lower())
        .first()
    )


def get_icons_for_journals(db: Session, journal_names: list[str]):
    """Return icons for a list of journal names (case-insensitive)."""
    lower_names = [n.lower() for n in journal_names]
    return (
        db.query(models.JournalIcon)
        .filter(func.lower(models.JournalIcon.journal_name).in_(lower_names))
        .all()
    )


def get_icon_map(db: Session, journal_names: list[str]) -> dict[str, str | None]:
    """Return a {journal_name_lower: icon_url} dict for fast lookup."""
    icons = get_icons_for_journals(db, journal_names)
    return {icon.journal_name.lower(): icon.icon_url for icon in icons}


def enrich_articles_with_icons(db: Session, articles: list[dict]) -> None:
    """Add 'journal_icon_url' key to each article dict in-place.

    Performs a single bulk query for all distinct journal names found
    in the list, then patches every article dict.
    """
    journal_names = list({
        a["journal"] for a in articles
        if a.get("journal")
    })
    if not journal_names:
        for a in articles:
            a["journal_icon_url"] = None
        return

    icon_map = get_icon_map(db, journal_names)
    for a in articles:
        jname = (a.get("journal") or "").lower()
        a["journal_icon_url"] = icon_map.get(jname)
