"""
Migration: Add `faiss_bioarchive_results_cache` and
           `faiss_bioarchive_cache_date_created` columns to the `feeds` table.

These columns mirror the existing main-feed FAISS cache columns and allow the
BioArchive router to cache per-user FAISS search results, avoiding a full
vector search on every page load.

Run once:
    cd backend && python migrations/add_bioarchive_faiss_cache.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE feeds
            ADD COLUMN IF NOT EXISTS faiss_bioarchive_results_cache JSONB DEFAULT NULL;
        """))

        conn.execute(text("""
            ALTER TABLE feeds
            ADD COLUMN IF NOT EXISTS faiss_bioarchive_cache_date_created TIMESTAMP DEFAULT NULL;
        """))

        conn.commit()
        print("[Migration] Added faiss_bioarchive_results_cache and "
              "faiss_bioarchive_cache_date_created columns to `feeds` table.")


if __name__ == "__main__":
    run()
