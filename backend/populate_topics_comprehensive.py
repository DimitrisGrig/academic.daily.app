"""
Populate Topics table with comprehensive tags from user_friendly_tags.txt
This includes the 857K filtered tags from MeSH and ontology sources.
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_local_db
from models import Topics
from fnc import generate_embeddings
from sqlalchemy import func


def load_user_friendly_tags(filepath="user_friendly_tags.txt"):
    """Load tags from user_friendly_tags.txt file."""
    tags = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                tag = line.strip()
                if tag:  # Skip empty lines
                    tags.append(tag)
        return tags
    except FileNotFoundError:
        print(f"❌ Error: {filepath} not found!")
        print(f"   Looking in: {os.path.abspath(filepath)}")
        return []


def categorize_tag(tag: str) -> str:
    """
    Categorize a tag based on keywords.
    This is a simple categorization - you can enhance this logic.
    """
    tag_lower = tag.lower()
    
    # Medical Specialties
    if any(word in tag_lower for word in ['cardiology', 'oncology', 'neurology', 'pediatrics', 'psychiatry', 'surgery']):
        return "Medical Specialties"
    
    # Cancer Types
    if 'cancer' in tag_lower or 'carcinoma' in tag_lower or 'tumor' in tag_lower or 'neoplasm' in tag_lower:
        return "Cancer Types"
    
    # Diseases & Conditions
    if any(word in tag_lower for word in ['disease', 'disorder', 'syndrome', 'infection', 'deficiency']):
        return "Diseases & Conditions"
    
    # Research Methods
    if any(word in tag_lower for word in ['sequencing', 'microscopy', 'pcr', 'elisa', 'flow cytometry', 'western blot', 'crispr']):
        return "Research Methods"
    
    # Molecular Biology
    if any(word in tag_lower for word in ['dna', 'rna', 'protein', 'gene', 'mrna', 'expression']):
        return "Molecular Biology"
    
    # Cell Biology
    if any(word in tag_lower for word in ['cell', 'cellular', 'stem', 'lymphocyte', 'neuron']):
        return "Cell Biology"
    
    # Genetics & Genomics
    if any(word in tag_lower for word in ['genome', 'genetic', 'mutation', 'chromosome', 'allele']):
        return "Genetics & Genomics"
    
    # Immunology
    if any(word in tag_lower for word in ['immune', 'antibod', 'antigen', 'immunoglobulin', 'cytokine']):
        return "Immunology"
    
    # Neuroscience
    if any(word in tag_lower for word in ['brain', 'neural', 'neuron', 'cognitive', 'neuroscience']):
        return "Neuroscience"
    
    # Pharmacology
    if any(word in tag_lower for word in ['drug', 'pharmaceutical', 'therapy', 'treatment', 'inhibitor']):
        return "Pharmacology"
    
    # Anatomy
    if any(word in tag_lower for word in ['heart', 'liver', 'kidney', 'lung', 'tissue', 'organ']):
        return "Anatomy"
    
    # Pathways & Processes
    if any(word in tag_lower for word in ['pathway', 'metabolism', 'signaling', 'transduction', 'regulation']):
        return "Pathways & Processes"
    
    # Clinical & Translational
    if any(word in tag_lower for word in ['clinical', 'trial', 'patient', 'therapy', 'diagnostic']):
        return "Clinical & Translational"
    
    # Technology & AI
    if any(word in tag_lower for word in ['machine learning', 'artificial intelligence', 'digital health', 'bioinformatics']):
        return "Technology & AI"
    
    # Default category
    return "Biomedical Research"


def populate_comprehensive_topics(batch_size=100, max_tags=None):
    """
    Populate Topics table with tags from user_friendly_tags.txt
    
    Args:
        batch_size: Number of tags to process in each batch
        max_tags: Maximum number of tags to add (None = all tags)
    """
    print("=" * 60)
    print("POPULATING TOPICS TABLE WITH COMPREHENSIVE TAGS")
    print("=" * 60)
    print()
    
    # Load tags
    print("📂 Loading tags from user_friendly_tags.txt...")
    tags = load_user_friendly_tags()
    
    if not tags:
        print("❌ No tags loaded. Exiting.")
        return
    
    print(f"✅ Loaded {len(tags):,} tags")
    
    if max_tags:
        tags = tags[:max_tags]
        print(f"⚠️  Limited to first {max_tags:,} tags for testing")
    
    print()
    
    db = next(get_local_db())
    
    # Get existing tags to avoid duplicates
    print("🔍 Checking for existing tags in database...")
    existing_tags = set(
        tag[0] for tag in db.query(Topics.subtopic).all()
    )
    print(f"   Found {len(existing_tags):,} existing tags")
    print()
    
    # Filter out existing tags
    new_tags = [tag for tag in tags if tag not in existing_tags]
    print(f"📊 Tags to add: {len(new_tags):,}")
    print()
    
    if len(new_tags) == 0:
        print("✅ All tags already exist in database!")
        return
    
    # Process in batches
    total_added = 0
    total_skipped = 0
    
    for i in range(0, len(new_tags), batch_size):
        batch = new_tags[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(new_tags) + batch_size - 1) // batch_size
        
        print(f"📦 Processing batch {batch_num}/{total_batches} ({len(batch)} tags)...")
        
        for tag in batch:
            try:
                # Categorize the tag
                category = categorize_tag(tag)
                
                # Generate embedding
                embedding = generate_embeddings(tag)
                
                # Create new topic
                new_topic = Topics(
                    broadtopic=category,
                    subtopic=tag,
                    embeddings=embedding.tolist()
                )
                
                db.add(new_topic)
                total_added += 1
                
            except Exception as e:
                print(f"   ⚠️  Error adding tag '{tag}': {str(e)}")
                total_skipped += 1
                continue
        
        # Commit batch
        try:
            db.commit()
            print(f"   ✅ Batch {batch_num} committed ({total_added:,} tags added so far)")
        except Exception as e:
            print(f"   ❌ Error committing batch {batch_num}: {str(e)}")
            db.rollback()
        
        print()
    
    print("=" * 60)
    print("✅ COMPLETE!")
    print("=" * 60)
    print()
    print(f"📊 Final Statistics:")
    print(f"   Total added: {total_added:,}")
    print(f"   Total skipped: {total_skipped:,}")
    print(f"   Total in database: {db.query(func.count(Topics.id)).scalar():,}")
    print()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Populate Topics table with comprehensive tags"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of tags to process in each batch (default: 100)"
    )
    parser.add_argument(
        "--max-tags",
        type=int,
        default=None,
        help="Maximum number of tags to add (default: all)"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: only add first 1000 tags"
    )
    
    args = parser.parse_args()
    
    if args.test:
        print("🧪 TEST MODE: Adding first 1000 tags only")
        print()
        populate_comprehensive_topics(
            batch_size=args.batch_size,
            max_tags=1000
        )
    else:
        populate_comprehensive_topics(
            batch_size=args.batch_size,
            max_tags=args.max_tags
        )
