"""
Migration: Add email digest subscription fields to the `users` table.

Run once:
    python migrations/add_email_digest_fields.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        # Add email_digest_subscribed column (default True = subscribed)
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email_digest_subscribed BOOLEAN NOT NULL DEFAULT TRUE;
        """))

        # Add unsubscribe_token column (unique, nullable)
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR UNIQUE;
        """))

        # Create index for fast token lookups
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_users_unsubscribe_token
            ON users (unsubscribe_token);
        """))

        conn.commit()
        print("[Migration] email digest fields added to `users` table successfully.")


if __name__ == "__main__":
    run()
