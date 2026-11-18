"""
Migration: Create zotero_exports table to track which articles
each user has exported to Zotero, preventing duplicates.

Run this script once to create the table:
    python migrations/add_zotero_exports.py
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS zotero_exports (
                id SERIAL PRIMARY KEY,
                clerk_user_id VARCHAR NOT NULL,
                article_id INTEGER NOT NULL,
                exported_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (clerk_user_id, article_id)
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_zotero_exports_user
            ON zotero_exports (clerk_user_id)
        """))
        conn.commit()
        print("✅ Migration complete: created zotero_exports table.")


if __name__ == "__main__":
    migrate()
