"""
Migration: Add notification_type and notification_metadata columns to notifications table.

Run once:
    python migrations/add_notification_type.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS notification_type VARCHAR DEFAULT NULL;
        """))

        conn.execute(text("""
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS notification_metadata JSONB DEFAULT NULL;
        """))

        conn.commit()
        print("[Migration] notifications: added notification_type and notification_metadata columns.")


if __name__ == "__main__":
    run()
