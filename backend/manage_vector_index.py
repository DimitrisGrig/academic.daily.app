"""
Vector Index Management Script for Topics Table
Use this script to maintain the vector index after bulk operations.
"""

from database import get_local_db, engine
from sqlalchemy import text
import sys

def get_index_stats():
    """Get statistics about the vector index."""
    with engine.connect() as conn:
        # Check if index exists
        check_query = text("""
            SELECT 
                schemaname,
                relname as tablename,
                indexrelname as indexname,
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size
            FROM pg_stat_user_indexes
            WHERE relname = 'topics' AND indexrelname = 'topics_embeddings_idx'
        """)
        result = conn.execute(check_query)
        index_info = result.fetchone()
        
        # Get table stats
        table_query = text("""
            SELECT 
                COUNT(*) as total_topics,
                COUNT(embeddings) as topics_with_embeddings
            FROM topics
        """)
        result = conn.execute(table_query)
        table_info = result.fetchone()
        
        return index_info, table_info


def rebuild_index():
    """
    Rebuild the vector index from scratch.
    Use this after bulk inserts/deletes or if search performance degrades.
    """
    with engine.connect() as conn:
        try:
            print("Dropping existing index...")
            conn.execute(text("DROP INDEX IF EXISTS topics_embeddings_idx"))
            conn.commit()
            
            print("Rebuilding index with optimized parameters...")
            print("This may take a few minutes depending on dataset size...")
            
            # Get topic count to determine optimal lists parameter
            result = conn.execute(text("SELECT COUNT(*) FROM topics WHERE embeddings IS NOT NULL"))
            topic_count = result.fetchone()[0]
            
            # Rule of thumb: lists = sqrt(rows)
            # Min 10, max 1000
            lists = max(10, min(1000, int(topic_count ** 0.5)))
            
            print(f"Topics with embeddings: {topic_count}")
            print(f"Using lists parameter: {lists}")
            
            create_index_query = text(f"""
                CREATE INDEX topics_embeddings_idx 
                ON topics 
                USING ivfflat (embeddings vector_cosine_ops) 
                WITH (lists = {lists})
            """)
            
            conn.execute(create_index_query)
            conn.commit()
            
            print("✓ Index rebuilt successfully!")
            
        except Exception as e:
            print(f"✗ Error rebuilding index: {str(e)}")
            conn.rollback()
            raise


def vacuum_analyze():
    """
    Run VACUUM ANALYZE to optimize the index and update statistics.
    This helps PostgreSQL make better query plans.
    """
    with engine.connect() as conn:
        try:
            # Need to be outside a transaction block for VACUUM
            conn.execute(text("COMMIT"))
            print("Running VACUUM ANALYZE on topics table...")
            conn.execute(text("VACUUM ANALYZE topics"))
            print("✓ VACUUM ANALYZE completed!")
            
        except Exception as e:
            print(f"✗ Error during VACUUM: {str(e)}")
            raise


def show_stats():
    """Display current index statistics."""
    index_info, table_info = get_index_stats()
    
    print("\n" + "=" * 60)
    print("Topics Table & Index Statistics")
    print("=" * 60)
    
    if table_info:
        print(f"\n📊 Table Stats:")
        print(f"  Total topics: {table_info.total_topics:,}")
        print(f"  Topics with embeddings: {table_info.topics_with_embeddings:,}")
    
    if index_info:
        print(f"\n📦 Index Info:")
        print(f"  Index name: {index_info.indexname}")
        print(f"  Index size: {index_info.index_size}")
    else:
        print("\n⚠️  No vector index found!")
        print("  Run: python manage_vector_index.py --create")
    
    print("\n" + "=" * 60)


def create_index():
    """Create the index if it doesn't exist."""
    from add_vector_index import add_vector_index
    add_vector_index()


if __name__ == "__main__":
    commands = {
        "--stats": ("Show index statistics", show_stats),
        "--rebuild": ("Rebuild the index (use after bulk operations)", rebuild_index),
        "--vacuum": ("Run VACUUM ANALYZE to optimize", vacuum_analyze),
        "--create": ("Create index if it doesn't exist", create_index),
    }
    
    if len(sys.argv) < 2 or sys.argv[1] not in commands:
        print("=" * 60)
        print("Vector Index Management for Topics Table")
        print("=" * 60)
        print("\nUsage: python manage_vector_index.py [command]")
        print("\nAvailable commands:")
        for cmd, (desc, _) in commands.items():
            print(f"  {cmd:15} - {desc}")
        print("\nExamples:")
        print("  python manage_vector_index.py --stats")
        print("  python manage_vector_index.py --rebuild")
        print("=" * 60)
        sys.exit(1)
    
    command = sys.argv[1]
    _, func = commands[command]
    
    print("\n" + "=" * 60)
    print(f"Running: {command}")
    print("=" * 60)
    
    func()
    
    print("\n✓ Done!")
    print("=" * 60)
