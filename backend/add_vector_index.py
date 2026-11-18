"""
Add vector index to Topics.embeddings for faster similarity searches.
Run this once to optimize the /tags/suggestions endpoint.
"""

from database import get_local_db, engine
from sqlalchemy import text

def add_vector_index():
    """
    Create an IVFFlat index on the embeddings column for faster similarity searches.
    
    IVFFlat is a good balance between speed and accuracy for moderate-sized datasets.
    The lists parameter (100) creates 100 clusters - adjust based on your data size:
    - Rule of thumb: lists = rows / 1000 (for ~100k rows, use lists=100)
    - More lists = faster search but potentially lower recall
    """
    
    with engine.connect() as conn:
        try:
            # Check if index already exists
            check_query = text("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'topics' 
                AND indexname = 'topics_embeddings_idx'
            """)
            result = conn.execute(check_query)
            existing = result.fetchone()
            
            if existing:
                print("✓ Index 'topics_embeddings_idx' already exists")
                return
            
            # Create the vector extension if not exists
            print("Ensuring pgvector extension is enabled...")
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
            
            # Create IVFFlat index for cosine distance
            print("Creating IVFFlat index on embeddings column...")
            print("This may take a few minutes depending on your dataset size...")
            
            create_index_query = text("""
                CREATE INDEX topics_embeddings_idx 
                ON topics 
                USING ivfflat (embeddings vector_cosine_ops) 
                WITH (lists = 100)
            """)
            
            conn.execute(create_index_query)
            conn.commit()
            
            print("✓ Index 'topics_embeddings_idx' created successfully!")
            print("\nTo verify the index, run:")
            print("  SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'topics';")
            
        except Exception as e:
            print(f"✗ Error creating index: {str(e)}")
            conn.rollback()
            raise


if __name__ == "__main__":
    print("=" * 60)
    print("Adding Vector Index to Topics Table")
    print("=" * 60)
    add_vector_index()
    print("\n" + "=" * 60)
    print("Done! Your /tags/suggestions endpoint should now be much faster.")
    print("=" * 60)
