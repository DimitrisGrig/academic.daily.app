"""
GEO (POE) API proxy
===================
GET /geo/gse_ids?pmid=...   – GSE dataset IDs linked to a PubMed article

The POE credentials stay on the server; the frontend only calls this endpoint.

Environment variables
---------------------
GEO_API_BASE_URL   e.g. https://poe.mm.di.uoa.gr/api
GEO_API_USERNAME
GEO_API_PASSWORD
"""

import os
import threading
import time

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Query

from auth import get_current_user

load_dotenv()

router = APIRouter(prefix="/geo", tags=["geo"])

GEO_API_BASE_URL = os.getenv("GEO_API_BASE_URL", "").rstrip("/")
GEO_API_USERNAME = os.getenv("GEO_API_USERNAME", "")
GEO_API_PASSWORD = os.getenv("GEO_API_PASSWORD", "")

# Simple in-memory token cache (assume 50-min lifetime, refresh early)
_token: str | None = None
_token_expires_at = 0.0
_token_lock = threading.Lock()


def _get_geo_token() -> str:
    global _token, _token_expires_at
    with _token_lock:
        if _token and time.time() < _token_expires_at:
            return _token
        response = requests.post(
            f"{GEO_API_BASE_URL}/login/token",
            data={"username": GEO_API_USERNAME, "password": GEO_API_PASSWORD},
            timeout=10,
        )
        response.raise_for_status()
        _token = response.json()["access_token"]
        _token_expires_at = time.time() + 50 * 60
        return _token


@router.get("/gse_ids")
def get_gse_ids(pmid: str = Query(..., pattern=r"^\d{1,12}$"), current_user: dict = Depends(get_current_user)) -> list[str]:
    """
    Return GSE dataset IDs for a PubMed ID.
    Returns an empty list on any failure — this feature is supplementary.
    """
    if not (GEO_API_BASE_URL and GEO_API_USERNAME and GEO_API_PASSWORD):
        return []

    try:
        response = requests.get(
            f"{GEO_API_BASE_URL}/da/get_gse_id",
            params={"pmid": pmid},
            headers={"Authorization": f"Bearer {_get_geo_token()}"},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"GEO API: failed to fetch GSE IDs for PMID {pmid}: {e}")
        return []

    if isinstance(data, list):
        return [i for i in data if isinstance(i, str) and i]
    return []
