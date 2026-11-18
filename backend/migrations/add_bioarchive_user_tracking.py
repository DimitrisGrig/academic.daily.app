"""
Migration: Create `user_bioarchive_upvotes` and `user_bioarchive_clicks` tables.

These tables mirror the existing `user_upvotes` and `user_article_clicks` tables
for regular articles but target BioArchive preprints.

Run once:
    cd backend && python migrations/add_bioarchive_user_tracking.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_bioarchive_upvotes (
                id         SERIAL PRIMARY KEY,
                user_id    VARCHAR NOT NULL,
                article_id INTEGER NOT NULL,
                upvoted_at TIMESTAMP DEFAULT NOW()
            );
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_bioarchive_upvotes_user_id
                ON user_bioarchive_upvotes (user_id);
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_bioarchive_upvotes_article_id
                ON user_bioarchive_upvotes (article_id);
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_bioarchive_clicks (
                id         SERIAL PRIMARY KEY,
                user_id    VARCHAR NOT NULL,
                article_id INTEGER NOT NULL,
                clicked_at TIMESTAMP DEFAULT NOW()
            );
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_bioarchive_clicks_user_id
                ON user_bioarchive_clicks (user_id);
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_bioarchive_clicks_article_id
                ON user_bioarchive_clicks (article_id);
        """))

        conn.commit()
        print("[Migration] Created user_bioarchive_upvotes and user_bioarchive_clicks tables.")


if __name__ == "__main__":
    run()
