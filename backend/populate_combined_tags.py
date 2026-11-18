"""
Populate Topics Database with Essential + Curated Medical Tags

This script combines:
1. Existing tags from tags_essential.txt (~439 tags)
2. New curated medical tags from curated_medical_tags.py (~500 tags)

Total: ~900-1000 high-quality tags covering:
- Medical specialties and subspecialties
- Major diseases from top journals (Nature, Cell, Lancet, NEJM)
- Molecular biology (RNA: miRNA, lncRNA, circRNA, etc.)
- Cellular stress (ROS, UV light, oxidative stress, etc.)
- Bioinformatics and computational biology
- Research methodologies and techniques
"""

import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import get_local_db, engine
from models import Topics
import models
from fnc import generate_embeddings
from curated_medical_tags import get_all_curated_tags, get_tag_count, CURATED_TAGS

# Create tables
models.Base.metadata.create_all(bind=engine)


def load_essential_tags():
    """Load existing essential tags from tags_essential.txt"""
    essential_file = os.path.join(os.path.dirname(__file__), '..', 'tags_essential.txt')
    
    if not os.path.exists(essential_file):
        print(f"❌ Warning: {essential_file} not found")
        return []
    
    with open(essential_file, 'r', encoding='utf-8') as f:
        tags = [line.strip() for line in f if line.strip()]
    
    print(f"📁 Loaded {len(tags)} tags from tags_essential.txt")
    return tags


def populate_database(db: Session, dry_run=False):
    """
    Populate database with essential + curated tags.
    
    Args:
        db: Database session
        dry_run: If True, only show what would be added without committing
    """
    
    # Statistics
    stats = {
        'essential_loaded': 0,
        'essential_new': 0,
        'essential_exists': 0,
        'curated_new': 0,
        'curated_exists': 0,
        'total_new': 0,
        'errors': 0
    }
    
    print("\n" + "="*70)
    print("🏥 MEDICAL TAGS DATABASE POPULATION")
    print("="*70)
    
    # ===== PHASE 1: Load existing essential tags =====
    print("\n📋 PHASE 1: Essential Tags")
    print("-" * 70)
    
    essential_tags = load_essential_tags()
    stats['essential_loaded'] = len(essential_tags)
    
    for tag in essential_tags:
        try:
            # Check if exists
            existing = db.query(Topics).filter(Topics.subtopic == tag).first()
            
            if existing:
                stats['essential_exists'] += 1
                continue
            
            if not dry_run:
                # Generate embedding
                embedding = generate_embeddings(tag)
                
                # Create new topic (assign to "General" category since we don't know original)
                new_topic = Topics(
                    broadtopic="General",
                    subtopic=tag,
                    embeddings=embedding
                )
                db.add(new_topic)
                db.commit()
            
            stats['essential_new'] += 1
            
            if stats['essential_new'] % 50 == 0:
                print(f"  ✓ Added {stats['essential_new']} essential tags...")
                
        except Exception as e:
            stats['errors'] += 1
            print(f"  ❌ Error adding '{tag}': {str(e)}")
            if not dry_run:
                db.rollback()
    
    print(f"\n✓ Essential tags: {stats['essential_new']} new, {stats['essential_exists']} existing")
    
    # ===== PHASE 2: Add curated medical tags =====
    print("\n🏥 PHASE 2: Curated Medical Tags")
    print("-" * 70)
    
    curated_tags = get_all_curated_tags()
    print(f"📁 Total curated tags: {len(curated_tags)}")
    
    for item in curated_tags:
        category = item['category']
        tag = item['tag']
        
        try:
            # Check if exists
            existing = db.query(Topics).filter(Topics.subtopic == tag).first()
            
            if existing:
                stats['curated_exists'] += 1
                continue
            
            if not dry_run:
                # Generate embedding
                embedding = generate_embeddings(tag)
                
                # Create new topic with proper category
                new_topic = Topics(
                    broadtopic=category,
                    subtopic=tag,
                    embeddings=embedding
                )
                db.add(new_topic)
                
                # Commit in batches of 50
                if stats['curated_new'] % 50 == 0:
                    db.commit()
                    print(f"  ✓ Added {stats['curated_new']} curated tags...")
            
            stats['curated_new'] += 1
            
        except Exception as e:
            stats['errors'] += 1
            print(f"  ❌ Error adding '{tag}': {str(e)}")
            if not dry_run:
                db.rollback()
    
    # Final commit for remaining tags
    if not dry_run:
        db.commit()
    
    print(f"\n✓ Curated tags: {stats['curated_new']} new, {stats['curated_exists']} existing")
    
    # ===== SUMMARY =====
    stats['total_new'] = stats['essential_new'] + stats['curated_new']
    
    print("\n" + "="*70)
    print("📊 SUMMARY")
    print("="*70)
    print(f"\n📁 Sources:")
    print(f"   • tags_essential.txt: {stats['essential_loaded']} tags loaded")
    print(f"   • curated_medical_tags.py: {len(curated_tags)} tags")
    
    print(f"\n✅ Added to Database:")
    print(f"   • Essential tags: {stats['essential_new']} new")
    print(f"   • Curated tags: {stats['curated_new']} new")
    print(f"   • TOTAL NEW TAGS: {stats['total_new']}")
    
    print(f"\n⏭️  Skipped (already exist):")
    print(f"   • Essential: {stats['essential_exists']}")
    print(f"   • Curated: {stats['curated_exists']}")
    print(f"   • Total skipped: {stats['essential_exists'] + stats['curated_exists']}")
    
    if stats['errors'] > 0:
        print(f"\n❌ Errors: {stats['errors']}")
    
    # Show category distribution
    print(f"\n📂 Curated Tag Categories:")
    for category, tags in CURATED_TAGS.items():
        print(f"   • {category}: {len(tags)} tags")
    
    print("\n" + "="*70)
    
    if dry_run:
        print("🔍 DRY RUN COMPLETE - No changes made to database")
    else:
        print("✅ DATABASE POPULATION COMPLETE")
    
    print("="*70 + "\n")
    
    return stats


def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Populate database with essential + curated medical tags'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be added without making changes'
    )
    
    args = parser.parse_args()
    
    # Create database session
    db = next(get_local_db())
    
    try:
        if args.dry_run:
            print("\n🔍 DRY RUN MODE - No changes will be made\n")
        
        # Populate database
        stats = populate_database(db, dry_run=args.dry_run)
        
        if not args.dry_run:
            # Show final count
            total_count = db.query(Topics).count()
            print(f"\n📊 Total tags in database: {total_count}")
            print(f"   (Started with ~439, added {stats['total_new']})\n")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
