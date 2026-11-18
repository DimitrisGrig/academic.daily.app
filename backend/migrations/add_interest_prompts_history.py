"""
Migration: Add interest_prompts_history JSONB column to feeds table.

Stores the last 5 interest prompts the user has submitted.

Run this script once:
    python migrations/add_interest_prompts_history.py
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE feeds
            ADD COLUMN IF NOT EXISTS interest_prompts_history JSONB DEFAULT NULL
        """))

        conn.commit()
        print("✅ Migration complete: added interest_prompts_history column to feeds table.")


if __name__ == "__main__":
    migrate()
