"""
Migration: Create feature_announcements and feature_announcement_seen tables.

Run once:
    python migrations/add_feature_announcements.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS feature_announcements (
                id SERIAL PRIMARY KEY,
                title VARCHAR NOT NULL,
                bullets JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS feature_announcement_seen (
                id SERIAL PRIMARY KEY,
                clerk_user_id VARCHAR NOT NULL,
                announcement_id INTEGER NOT NULL,
                seen_at TIMESTAMP DEFAULT NOW()
            );
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_feature_announcement_seen_user
            ON feature_announcement_seen (clerk_user_id);
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_feature_announcement_seen_announcement
            ON feature_announcement_seen (announcement_id);
        """))

        conn.commit()
        print("[Migration] feature_announcements tables created successfully.")


if __name__ == "__main__":
    run()
