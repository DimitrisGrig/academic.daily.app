"""
Populate Topics table with essential tags and their embeddings.
This script loads the curated essential tags and generates embeddings for intelligent tag suggestions.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_local_db
from models import Topics
from fnc import generate_embeddings
import json


def populate_topics_table():
    """Populate the Topics table with categorized tags and embeddings."""
    db = next(get_local_db())
    
    print("=" * 60)
    print("POPULATING TOPICS TABLE WITH ESSENTIAL TAGS")
    print("=" * 60)
    print()
        
    existing = db.query(Topics).filter(
        Topics.embeddings == None,
    ).all()
        
    for existing in existing:
        embedding = generate_embeddings(existing.subtopic)
        existing.embeddings=embedding.tolist()
               
    db.commit()
        

if __name__ == "__main__":
    populate_topics_table()
