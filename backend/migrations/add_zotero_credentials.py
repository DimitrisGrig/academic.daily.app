"""
Migration: Create zotero_credentials table for Zotero OAuth integration.

Run this script once to create the table:
    python migrations/add_zotero_credentials.py
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS zotero_credentials (
                clerk_user_id VARCHAR PRIMARY KEY,
                zotero_user_id VARCHAR,
                zotero_api_key VARCHAR,
                oauth_token_secret VARCHAR,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_zotero_credentials_clerk_user_id
            ON zotero_credentials (clerk_user_id)
        """))
        conn.commit()
        print("✅ Migration complete: created zotero_credentials table.")


if __name__ == "__main__":
    migrate()
