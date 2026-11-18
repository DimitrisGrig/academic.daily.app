"""
Extract MeSH Terms from Articles and Add to Topics Table

This module extracts MeSH terms from articles in the database and adds them
as new topics with embeddings. It processes MeSH terms the same way as shown
in the article modal:
- Split on ";" to get individual terms
- Keep only the first part before "/" (e.g., "Bacteria* / isolation & purification" -> "Bacteria")
- Keep terms with asterisk (*) as they are major topics
- Remove the asterisk from the final term
- Remove duplicates
- Generate embeddings and add to Topics table

Usage:
    python extract_mesh_to_topics.py --limit 100  # Process 100 articles
    python extract_mesh_to_topics.py --all        # Process all articles
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_local_db
from models import Articles, Topics
from fnc import generate_embeddings
from sqlalchemy import func
from typing import Set, List
import re


def clean_mesh_term(term: str) -> str:
    """
    Clean a single MeSH term following the frontend logic.
    
    Args:
        term: Raw MeSH term (e.g., "Bacteria* / isolation & purification")
        
    Returns:
        Cleaned term (e.g., "Bacteria")
    """
    # Split on / and keep only the first part
    main_term = term.split("/")[0].strip()
    
    # Remove asterisk if present
    if main_term.endswith("*"):
        main_term = main_term[:-1].strip()
    
    return main_term


def extract_mesh_terms_from_text(mesh_terms_text: str) -> Set[str]:
    """
    Extract and clean MeSH terms from the mesh_terms field.
    
    Args:
        mesh_terms_text: Raw MeSH terms string from database
        
    Returns:
        Set of cleaned, unique MeSH terms
    """
    if not mesh_terms_text or not mesh_terms_text.strip():
        return set()
    
    # Split on semicolon
    raw_terms = mesh_terms_text.split(";")
    
    # Clean each term
    cleaned_terms = set()
    for term in raw_terms:
        term = term.strip()
        if term:
            cleaned = clean_mesh_term(term)
            if cleaned and len(cleaned) > 2:  # Avoid very short terms
                # Only keep terms without "/" in final result
                if "/" not in cleaned:
                    cleaned_terms.add(cleaned)
    
    return cleaned_terms


def get_existing_topics(db) -> Set[str]:
    """Get all existing topic subtopics to avoid duplicates."""
    existing = db.query(Topics.subtopic).all()
    return {topic.subtopic for topic in existing}


def add_mesh_terms_to_topics(db, limit: int = None, dry_run: bool = False) -> dict:
    """
    Extract MeSH terms from articles and add them to Topics table.
    
    Args:
        db: Database session
        limit: Maximum number of articles to process (None for all)
        dry_run: If True, only show what would be added without committing
        
    Returns:
        Statistics dictionary
    """
    stats = {
        'articles_processed': 0,
        'mesh_terms_extracted': 0,
        'mesh_terms_new': 0,
        'mesh_terms_duplicate': 0,
        'errors': 0
    }
    
    print("\n" + "="*70)
    print("🏷️  EXTRACTING MESH TERMS FROM ARTICLES")
    print("="*70)
    
    # Get existing topics to avoid duplicates
    print("\n📊 Loading existing topics...")
    existing_topics = get_existing_topics(db)
    print(f"   Found {len(existing_topics)} existing topics in database")
    
    # Query articles with MeSH terms
    query = db.query(Articles).filter(
        Articles.mesh_terms.isnot(None),
        Articles.mesh_terms != ''
    )
    
    if limit:
        query = query.limit(limit)
    
    articles = query.all()
    print(f"\n📚 Processing {len(articles)} articles with MeSH terms...")
    print("-" * 70)
    
    # Collect all unique MeSH terms from all articles
    all_mesh_terms = set()
    
    for article in articles:
        stats['articles_processed'] += 1
        
        try:
            # Extract MeSH terms from this article
            mesh_terms = extract_mesh_terms_from_text(article.mesh_terms)
            all_mesh_terms.update(mesh_terms)
            stats['mesh_terms_extracted'] += len(mesh_terms)
            
            if stats['articles_processed'] % 100 == 0:
                print(f"   Processed {stats['articles_processed']} articles...")
                
        except Exception as e:
            stats['errors'] += 1
            print(f"   ❌ Error processing article {article.id}: {str(e)}")
    
    print(f"\n✓ Extracted {len(all_mesh_terms)} unique MeSH terms from {stats['articles_processed']} articles")
    
    # Filter out terms that already exist
    new_mesh_terms = all_mesh_terms - existing_topics
    duplicate_mesh_terms = all_mesh_terms & existing_topics
    
    stats['mesh_terms_new'] = len(new_mesh_terms)
    stats['mesh_terms_duplicate'] = len(duplicate_mesh_terms)
    
    print(f"   • {stats['mesh_terms_new']} new terms to add")
    print(f"   • {stats['mesh_terms_duplicate']} terms already exist (skipped)")
    
    if new_mesh_terms:
        print(f"\n🔄 Adding {len(new_mesh_terms)} new MeSH terms to Topics table...")
        print("-" * 70)
        
        added_count = 0
        for term in sorted(new_mesh_terms):
            try:
                if not dry_run:
                    # Generate embedding
                    embedding = generate_embeddings(term)
                    
                    # Create new topic with category "MeSH Terms"
                    new_topic = Topics(
                        broadtopic="MeSH Terms",
                        subtopic=term,
                        embeddings=embedding
                    )
                    db.add(new_topic)
                    
                    # Commit in batches of 50
                    if added_count % 50 == 0 and added_count > 0:
                        db.commit()
                        print(f"   ✓ Added {added_count} terms...")
                
                added_count += 1
                
            except Exception as e:
                stats['errors'] += 1
                print(f"   ❌ Error adding term '{term}': {str(e)}")
                if not dry_run:
                    db.rollback()
        
        # Final commit
        if not dry_run:
            db.commit()
        
        print(f"\n✓ Successfully added {added_count} new MeSH terms")
    
    # Print summary
    print("\n" + "="*70)
    print("📊 SUMMARY")
    print("="*70)
    print(f"\n📚 Articles processed: {stats['articles_processed']}")
    print(f"🏷️  Total MeSH terms extracted: {stats['mesh_terms_extracted']}")
    print(f"   • Unique terms found: {len(all_mesh_terms)}")
    print(f"   • New terms added: {stats['mesh_terms_new']}")
    print(f"   • Duplicates skipped: {stats['mesh_terms_duplicate']}")
    
    if stats['errors'] > 0:
        print(f"\n❌ Errors: {stats['errors']}")
    
    if dry_run:
        print("\n🔍 DRY RUN COMPLETE - No changes made to database")
    else:
        print("\n✅ MESH TERMS EXTRACTION COMPLETE")
    
    print("="*70 + "\n")
    
    return stats


def extract_mesh_terms_job():
    """
    Job function to be called by the scheduler.
    Processes new articles added in the last 24 hours.
    """
    from datetime import datetime, timedelta
    
    db = next(get_local_db())
    
    try:
        print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting scheduled MeSH terms extraction...")
        
        # Get articles created in the last 24 hours
        yesterday = datetime.now() - timedelta(days=1)
        
        query = db.query(Articles).filter(
            Articles.mesh_terms.isnot(None),
            Articles.mesh_terms != '',
            Articles.created_at >= yesterday
        )
        
        article_count = query.count()
        
        if article_count == 0:
            print(f"   No new articles with MeSH terms found in the last 24 hours")
            return
        
        print(f"   Found {article_count} new articles with MeSH terms")
        
        # Process the articles
        stats = add_mesh_terms_to_topics(db, dry_run=False)
        
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scheduled MeSH extraction complete")
        print(f"   Added {stats['mesh_terms_new']} new terms from {stats['articles_processed']} articles\n")
        
    except Exception as e:
        print(f"   ❌ Error in scheduled MeSH extraction: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Extract MeSH terms from articles and add to Topics table'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximum number of articles to process (default: all)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Process all articles (override any limit)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be added without making changes'
    )
    
    args = parser.parse_args()
    
    if args.all:
        args.limit = None
    
    # Create database session
    db = next(get_local_db())
    
    try:
        if args.dry_run:
            print("\n🔍 DRY RUN MODE - No changes will be made\n")
        
        # Extract and add MeSH terms
        stats = add_mesh_terms_to_topics(db, limit=args.limit, dry_run=args.dry_run)
        
        if not args.dry_run:
            # Show final count
            total_topics = db.query(Topics).count()
            print(f"\n📊 Total topics in database: {total_topics}\n")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
