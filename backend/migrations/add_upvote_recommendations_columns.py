"""
Migration: Add upvote_based_recommendations and embeddings_last_recomputed columns to feeds table.

Run this script once to add the new columns:
    python migrations/add_upvote_recommendations_columns.py
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        # Add upvote_based_recommendations column (default True)
        conn.execute(text("""
            ALTER TABLE feeds
            ADD COLUMN IF NOT EXISTS upvote_based_recommendations BOOLEAN DEFAULT TRUE
        """))

        # Add embeddings_last_recomputed column
        conn.execute(text("""
            ALTER TABLE feeds
            ADD COLUMN IF NOT EXISTS embeddings_last_recomputed TIMESTAMP DEFAULT NULL
        """))

        conn.commit()
        print("✅ Migration complete: added upvote_based_recommendations and embeddings_last_recomputed columns to feeds table.")


if __name__ == "__main__":
    migrate()
