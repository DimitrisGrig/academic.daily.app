"""
Zotero OAuth 1.0a integration router.

Handles:
  - OAuth key exchange flow (init → authorize → callback)
  - Exporting articles to a connected Zotero library
  - Connection status & disconnect
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from pydantic import BaseModel
from database import get_local_db, Base
from auth import get_current_user
from requests_oauthlib import OAuth1Session
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# ── Zotero OAuth config ──────────────────────────────────────────────
ZOTERO_CLIENT_KEY = os.getenv("ZOTERO_CLIENT_KEY", "")
ZOTERO_CLIENT_SECRET = os.getenv("ZOTERO_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.daily-academic.com")

ZOTERO_REQUEST_TOKEN_URL = "https://www.zotero.org/oauth/request"
ZOTERO_AUTHORIZE_URL = "https://www.zotero.org/oauth/authorize"
ZOTERO_ACCESS_TOKEN_URL = "https://www.zotero.org/oauth/access"
ZOTERO_API_BASE = "https://api.zotero.org"


# ── DB Model ─────────────────────────────────────────────────────────
class ZoteroCredential(Base):
    __tablename__ = "zotero_credentials"

    clerk_user_id = Column(String, primary_key=True, index=True)
    zotero_user_id = Column(String, nullable=True)
    zotero_api_key = Column(String, nullable=True)
    # Temporary storage during OAuth handshake
    oauth_token_secret = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ZoteroExport(Base):
    __tablename__ = "zotero_exports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    article_id = Column(Integer, nullable=False)
    exported_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Pydantic schemas ─────────────────────────────────────────────────
class ZoteroExportRequest(BaseModel):
    article_id: int
    title: str
    abstract: str | None = None
    journal: str | None = None
    publication_date: str | None = None
    authors_full: list[str] | str | None = None
    doi: str | None = None
    pmid: str | None = None
    pmcid: str | None = None
    issn: str | None = None
    mesh_terms: str | None = None
    url: str | None = None


# ── Router ────────────────────────────────────────────────────────────
router = APIRouter(prefix="/zotero", tags=["zotero"])


def _ensure_configured():
    if not ZOTERO_CLIENT_KEY or not ZOTERO_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Zotero integration is not configured. Set ZOTERO_CLIENT_KEY and ZOTERO_CLIENT_SECRET.",
        )


# ─── 1. Check connection status ──────────────────────────────────────
@router.get("/status")
async def zotero_status(
    db: Session = Depends(get_local_db),
    current_user: dict = Depends(get_current_user),
):
    """Return whether the user has a connected Zotero account."""
    user_id = current_user["user_id"]
    cred = db.query(ZoteroCredential).filter(
        ZoteroCredential.clerk_user_id == user_id
    ).first()

    connected = bool(cred and cred.zotero_api_key and cred.zotero_user_id)
    return {"connected": connected}


# ─── 2. Start OAuth ──────────────────────────────────────────────────
@router.get("/auth/init")
async def zotero_auth_init(
    db: Session = Depends(get_local_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Step 1 of the Zotero OAuth 1.0a flow.
    Returns the Zotero authorize URL the frontend should redirect to.
    """
    _ensure_configured()
    user_id = current_user["user_id"]

    callback_url = f"{FRONTEND_URL}/ZoteroCallback"

    try:
        oauth = OAuth1Session(
            ZOTERO_CLIENT_KEY,
            client_secret=ZOTERO_CLIENT_SECRET,
            callback_uri=callback_url,
        )
        fetch_response = oauth.fetch_request_token(ZOTERO_REQUEST_TOKEN_URL)
    except Exception as e:
        logger.error(f"Zotero request token error: {e}")
        raise HTTPException(status_code=502, detail="Failed to contact Zotero for OAuth.")

    oauth_token = fetch_response["oauth_token"]
    oauth_token_secret = fetch_response["oauth_token_secret"]

    # Store the temporary token secret so we can complete the exchange later
    cred = db.query(ZoteroCredential).filter(
        ZoteroCredential.clerk_user_id == user_id
    ).first()
    if cred:
        cred.oauth_token_secret = oauth_token_secret
    else:
        cred = ZoteroCredential(
            clerk_user_id=user_id,
            oauth_token_secret=oauth_token_secret,
        )
        db.add(cred)
    db.commit()

    # Build Zotero authorize URL with permission scopes
    authorize_url = (
        f"{ZOTERO_AUTHORIZE_URL}"
        f"?oauth_token={oauth_token}"
        f"&library_access=1"
        f"&write_access=1"
        f"&name=Academic%20Daily"
    )

    return {"authorize_url": authorize_url}


# ─── 3. Complete OAuth ────────────────────────────────────────────────
@router.post("/auth/callback")
async def zotero_auth_callback(
    oauth_token: str = Query(...),
    oauth_verifier: str = Query(...),
    db: Session = Depends(get_local_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Step 3 of the Zotero OAuth 1.0a flow.
    Exchange the authorized request token for a permanent access token.
    """
    _ensure_configured()
    user_id = current_user["user_id"]

    cred = db.query(ZoteroCredential).filter(
        ZoteroCredential.clerk_user_id == user_id
    ).first()
    if not cred or not cred.oauth_token_secret:
        raise HTTPException(status_code=400, detail="No pending OAuth session found. Please restart the connection flow.")

    try:
        oauth = OAuth1Session(
            ZOTERO_CLIENT_KEY,
            client_secret=ZOTERO_CLIENT_SECRET,
            resource_owner_key=oauth_token,
            resource_owner_secret=cred.oauth_token_secret,
            verifier=oauth_verifier,
        )
        access_response = oauth.fetch_access_token(ZOTERO_ACCESS_TOKEN_URL)
    except Exception as e:
        logger.error(f"Zotero access token error: {e}")
        raise HTTPException(status_code=502, detail="Failed to complete Zotero authorization.")

    # Zotero returns userID and the API key as oauth_token_secret
    zotero_user_id = access_response.get("userID")
    zotero_api_key = access_response.get("oauth_token_secret")

    if not zotero_user_id or not zotero_api_key:
        raise HTTPException(status_code=502, detail="Zotero did not return expected credentials.")

    # Save permanent credentials, clear temporary secret
    cred.zotero_user_id = str(zotero_user_id)
    cred.zotero_api_key = zotero_api_key
    cred.oauth_token_secret = None
    db.commit()

    return {"success": True, "message": "Zotero connected successfully."}


# ─── 4. Export article to Zotero ──────────────────────────────────────
@router.post("/export")
async def zotero_export(
    data: ZoteroExportRequest,
    force: bool = Query(False),
    db: Session = Depends(get_local_db),
    current_user: dict = Depends(get_current_user),
):
    """Add an article to the user's Zotero library via the Web API."""
    user_id = current_user["user_id"]

    # Check if article was already exported by this user
    existing = db.query(ZoteroExport).filter(
        ZoteroExport.clerk_user_id == user_id,
        ZoteroExport.article_id == data.article_id,
    ).first()
    if existing and not force:
        raise HTTPException(status_code=409, detail="This article has already been exported to your Zotero library.")

    cred = db.query(ZoteroCredential).filter(
        ZoteroCredential.clerk_user_id == user_id
    ).first()
    if not cred or not cred.zotero_api_key or not cred.zotero_user_id:
        raise HTTPException(status_code=400, detail="Zotero account not connected.")

    # Build the Zotero item JSON (journalArticle type)
    creators = _parse_creators(data.authors_full)
    tags = _parse_tags(data.mesh_terms)

    item = {
        "itemType": "journalArticle",
        "title": data.title,
        "abstractNote": data.abstract or "",
        "publicationTitle": data.journal or "",
        "date": data.publication_date or "",
        "DOI": data.doi or "",
        "ISSN": data.issn or "",
        "url": data.url or "",
        "extra": "",
        "creators": creators,
        "tags": tags,
        "collections": [],
        "relations": {},
    }

    # Add PMID / PMCID to extra field (Zotero convention)
    extra_parts = []
    if data.pmid:
        extra_parts.append(f"PMID: {data.pmid}")
    if data.pmcid:
        extra_parts.append(f"PMCID: {data.pmcid}")
    if extra_parts:
        item["extra"] = "\n".join(extra_parts)

    import requests

    headers = {
        "Zotero-API-Key": cred.zotero_api_key,
        "Zotero-API-Version": "3",
        "Content-Type": "application/json",
    }

    api_url = f"{ZOTERO_API_BASE}/users/{cred.zotero_user_id}/items"

    try:
        resp = requests.post(api_url, json=[item], headers=headers, timeout=15)
    except Exception as e:
        logger.error(f"Zotero API request failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to contact Zotero API.")

    if resp.status_code == 200:
        body = resp.json()
        if body.get("successful") or body.get("success"):
            # Record the export (only if not already tracked)
            if not existing:
                db.add(ZoteroExport(clerk_user_id=user_id, article_id=data.article_id))
                db.commit()
            return {"success": True, "message": "Article added to your Zotero library."}
        failed = body.get("failed", {})
        first_err = next(iter(failed.values()), {}) if failed else {}
        err_msg = first_err.get("message", "Unknown error")
        raise HTTPException(status_code=400, detail=f"Zotero rejected the item: {err_msg}")
    elif resp.status_code == 403:
        # API key revoked or permissions changed
        raise HTTPException(status_code=403, detail="Zotero authorization expired. Please reconnect your Zotero account.")
    else:
        logger.error(f"Zotero API error {resp.status_code}: {resp.text}")
        raise HTTPException(status_code=502, detail=f"Zotero API error ({resp.status_code}).")


# ─── 5. Check exported articles ───────────────────────────────────────
@router.post("/exported-articles")
async def zotero_exported_articles(
    data: dict,
    db: Session = Depends(get_local_db),
    current_user: dict = Depends(get_current_user),
):
    """Return which of the given article IDs have been exported to Zotero."""
    user_id = current_user["user_id"]
    article_ids = data.get("article_ids", [])
    if not article_ids:
        return {"exported_ids": []}

    rows = db.query(ZoteroExport.article_id).filter(
        ZoteroExport.clerk_user_id == user_id,
        ZoteroExport.article_id.in_(article_ids),
    ).all()
    return {"exported_ids": [r[0] for r in rows]}


# ─── 6. Disconnect Zotero ─────────────────────────────────────────────
@router.delete("/disconnect")
async def zotero_disconnect(
    db: Session = Depends(get_local_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove the user's Zotero connection."""
    user_id = current_user["user_id"]
    cred = db.query(ZoteroCredential).filter(
        ZoteroCredential.clerk_user_id == user_id
    ).first()
    if cred:
        db.delete(cred)
        db.commit()
    return {"success": True, "message": "Zotero disconnected."}


# ── Helpers ───────────────────────────────────────────────────────────
def _parse_creators(authors_full) -> list[dict]:
    """Convert the app's authors format into Zotero creators."""
    if not authors_full:
        return []
    if isinstance(authors_full, str):
        names = [a.strip() for a in authors_full.split(";") if a.strip()]
    elif isinstance(authors_full, list):
        names = authors_full
    else:
        return []

    creators = []
    for raw in names:
        name = raw.split(":")[0].strip().rstrip(":")
        if not name:
            continue
        parts = name.rsplit(" ", 1)
        if len(parts) == 2:
            creators.append({
                "creatorType": "author",
                "firstName": parts[0],
                "lastName": parts[1],
            })
        else:
            creators.append({
                "creatorType": "author",
                "name": name,
            })
    return creators


def _parse_tags(mesh_terms: str | None) -> list[dict]:
    """Convert semicolon-delimited MeSH terms to Zotero tags."""
    if not mesh_terms:
        return []
    return [
        {"tag": t.strip().lstrip("*")}
        for t in mesh_terms.split(";")
        if t.strip()
    ]
