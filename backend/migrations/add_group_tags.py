"""
Migration: Add tags column to groups table.

Run once:
    python migrations/add_group_tags.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE groups
            ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
        """))
        conn.commit()
        print("[Migration] groups: added tags column.")


if __name__ == "__main__":
    run()
