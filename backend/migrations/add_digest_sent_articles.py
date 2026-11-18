"""
Migration: Create the `digest_sent_articles` table to track which articles
have already been emailed to each user (prevents duplicate digest content).

Run once:
    cd backend && python migrations/add_digest_sent_articles.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS digest_sent_articles (
                id SERIAL PRIMARY KEY,
                clerk_user_id VARCHAR NOT NULL,
                article_id INTEGER NOT NULL,
                sent_at TIMESTAMP DEFAULT NOW()
            );
        """))

        # Index for fast lookups: "which articles were already sent to this user?"
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_digest_sent_articles_user
            ON digest_sent_articles (clerk_user_id);
        """))

        # Unique constraint so the same article can never be recorded twice per user
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_digest_sent_user_article
            ON digest_sent_articles (clerk_user_id, article_id);
        """))

        conn.commit()
        print("[Migration] `digest_sent_articles` table created successfully.")


if __name__ == "__main__":
    run()
