"""
Populate Topics table with CURATED, high-quality tags.
This script filters out obscure/garbage tags while keeping useful ones.

Quality Tiers:
- Tier 1 (Essential): ~500 tags - Core medical/research terms everyone needs
- Tier 2 (Standard): ~5000 tags - Common specialties, diseases, techniques
- Tier 3 (Extended): ~20000 tags - Comprehensive but still clean

Filtering Strategy:
- KEEP: Medical specialties, common diseases, research techniques, anatomy, major molecules
- REMOVE: Chemical formulas, drug metabolites, obscure compounds, overly specific terms
"""

import sys
import os
import re

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_local_db
from models import Topics
from fnc import generate_embeddings
from sqlalchemy import func


def load_tags_from_file(filepath):
    """Load tags from a text file."""
    tags = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                tag = line.strip()
                if tag:
                    tags.append(tag)
        return tags
    except FileNotFoundError:
        print(f"❌ Error: {filepath} not found!")
        return []


def is_high_quality_tag(tag: str) -> dict:
    """
    Determine if a tag is high quality and categorize it.
    
    Returns:
        dict with keys: 'quality' (essential/standard/extended/reject), 
                       'reason' (why), 
                       'category' (Medical Specialties, etc.)
    """
    tag_lower = tag.lower()
    tag_len = len(tag)
    
    # REJECT: Chemical formulas and drug metabolites
    # Examples: (+)-Osilodrostat, 4-Hydroxytamoxifen, α-gal allergy
    if any(pattern in tag for pattern in ['(+)-', '(-)-', '(R)-', '(S)-', '(±)-']):
        return {'quality': 'reject', 'reason': 'stereochemistry notation', 'category': None}
    
    # REJECT: Contains multiple special characters (likely chemical names)
    special_char_count = sum(tag.count(c) for c in ['(', ')', '-', ',', '[', ']'])
    if special_char_count >= 4:
        return {'quality': 'reject', 'reason': 'too many special characters', 'category': None}
    
    # REJECT: Starts with numbers or Greek letters followed by hyphen (chemical nomenclature)
    if re.match(r'^(\d+[a-zA-Z]?-|α-|β-|γ-|δ-)', tag):
        return {'quality': 'reject', 'reason': 'chemical nomenclature', 'category': None}
    
    # REJECT: Contains " anabolism", " catabolism", " metabolism" (too specific metabolic pathways)
    if any(word in tag_lower for word in [' anabolism', ' catabolism', ' biosynthesis of ']):
        return {'quality': 'reject', 'reason': 'specific metabolic pathway', 'category': None}
    
    # REJECT: Overly long names (likely very specific compounds/genes)
    if tag_len > 60:
        return {'quality': 'reject', 'reason': 'too long (overly specific)', 'category': None}
    
    # REJECT: Contains multiple numbers (likely gene IDs, protein variants)
    if len(re.findall(r'\d+', tag)) >= 3:
        return {'quality': 'reject', 'reason': 'multiple numbers (gene/protein ID)', 'category': None}
    
    
    # ==================================================================
    # TIER 1: ESSENTIAL (~500 tags)
    # Core terms everyone should know
    # ==================================================================
    
    # Medical Specialties (high priority)
    medical_specialties = [
        'cardiology', 'oncology', 'neurology', 'pediatrics', 'psychiatry', 
        'dermatology', 'gastroenterology', 'endocrinology', 'nephrology',
        'hematology', 'pulmonology', 'rheumatology', 'urology', 'ophthalmology',
        'otolaryngology', 'orthopedics', 'surgery', 'anesthesiology',
        'radiology', 'pathology', 'immunology', 'infectious disease'
    ]
    if any(spec in tag_lower for spec in medical_specialties):
        return {'quality': 'essential', 'reason': 'medical specialty', 'category': 'Medical Specialties'}
    
    # Major Cancer Types
    major_cancers = [
        'lung cancer', 'breast cancer', 'prostate cancer', 'colorectal cancer',
        'pancreatic cancer', 'liver cancer', 'stomach cancer', 'bladder cancer',
        'kidney cancer', 'leukemia', 'lymphoma', 'melanoma', 'glioblastoma'
    ]
    if any(cancer in tag_lower for cancer in major_cancers) or (tag_lower == 'cancer'):
        return {'quality': 'essential', 'reason': 'major cancer type', 'category': 'Cancer Types'}
    
    # Common Diseases (household names)
    common_diseases = [
        'diabetes', 'alzheimer', 'parkinson', 'hypertension', 'asthma', 
        'arthritis', 'osteoporosis', 'obesity', 'stroke', 'heart failure',
        'copd', 'depression', 'anxiety', 'schizophrenia', 'autism', 'adhd',
        'multiple sclerosis', 'epilepsy', 'tuberculosis', 'malaria', 'hiv',
        'covid-19', 'influenza', 'pneumonia', 'sepsis'
    ]
    if any(disease in tag_lower for disease in common_diseases):
        return {'quality': 'essential', 'reason': 'common disease', 'category': 'Diseases & Conditions'}
    
    # Core Research Methods
    core_methods = [
        'pcr', 'western blot', 'elisa', 'flow cytometry', 'microscopy',
        'sequencing', 'rna-seq', 'crispr', 'immunohistochemistry',
        'mass spectrometry', 'chromatography', 'gel electrophoresis',
        'cell culture', 'animal model', 'clinical trial', 'meta-analysis'
    ]
    if any(method in tag_lower for method in core_methods):
        return {'quality': 'essential', 'reason': 'core research method', 'category': 'Research Methods'}
    
    # Fundamental Biology
    fundamental_bio = [
        'dna', 'rna', 'protein', 'gene', 'genome', 'cell', 'tissue',
        'enzyme', 'antibody', 'antigen', 'chromosome', 'mutation',
        'transcription', 'translation', 'metabolism', 'apoptosis'
    ]
    if tag_lower in fundamental_bio or any(f' {term}' in tag_lower for term in fundamental_bio):
        return {'quality': 'essential', 'reason': 'fundamental biology', 'category': 'Molecular Biology'}
    
    # Major Organs/Anatomy
    major_organs = [
        'heart', 'brain', 'lung', 'liver', 'kidney', 'pancreas', 'stomach',
        'intestine', 'colon', 'bladder', 'prostate', 'ovary', 'uterus',
        'thyroid', 'spleen', 'bone', 'muscle', 'skin', 'blood'
    ]
    if tag_lower in major_organs or any(f'{organ} ' in tag_lower for organ in major_organs):
        return {'quality': 'essential', 'reason': 'major organ/anatomy', 'category': 'Anatomy'}
    
    
    # ==================================================================
    # TIER 2: STANDARD (~5000 tags)
    # Useful for most researchers
    # ==================================================================
    
    # Any "disease", "syndrome", "disorder"
    if any(word in tag_lower for word in ['disease', 'syndrome', 'disorder', 'deficiency']):
        if tag_len < 50:  # Not too specific
            return {'quality': 'standard', 'reason': 'disease/syndrome', 'category': 'Diseases & Conditions'}
    
    # Medical conditions and symptoms
    if any(word in tag_lower for word in ['infection', 'inflammation', 'injury', 'failure', 'insufficiency']):
        if tag_len < 45:
            return {'quality': 'standard', 'reason': 'medical condition', 'category': 'Diseases & Conditions'}
    
    # Research techniques containing key method words
    method_keywords = [
        'assay', 'analysis', 'sequencing', 'imaging', 'screening', 'test',
        'technique', 'method', 'procedure', 'protocol', 'staining'
    ]
    if any(kw in tag_lower for kw in method_keywords) and tag_len < 50:
        return {'quality': 'standard', 'reason': 'research technique', 'category': 'Research Methods'}
    
    # Cell types and biology
    if any(word in tag_lower for word in ['cell', 'neuron', 'lymphocyte', 't cell', 'b cell', 'stem cell']):
        if tag_len < 40:
            return {'quality': 'standard', 'reason': 'cell biology', 'category': 'Cell Biology'}
    
    # Genetics and genomics
    if any(word in tag_lower for word in ['genetic', 'genomic', 'gene expression', 'allele', 'polymorphism']):
        if tag_len < 45:
            return {'quality': 'standard', 'reason': 'genetics/genomics', 'category': 'Genetics & Genomics'}
    
    # Pharmacology and therapeutics
    if any(word in tag_lower for word in ['therapy', 'treatment', 'drug', 'inhibitor', 'agonist', 'antagonist']):
        # Exclude specific drug names (usually have complex patterns)
        if tag_len < 35 and special_char_count < 2:
            return {'quality': 'standard', 'reason': 'pharmacology/therapy', 'category': 'Pharmacology'}
    
    # Immunology
    if any(word in tag_lower for word in ['immune', 'immunotherapy', 'vaccine', 'cytokine', 'chemokine']):
        if tag_len < 40:
            return {'quality': 'standard', 'reason': 'immunology', 'category': 'Immunology'}
    
    # Clinical and translational
    if any(word in tag_lower for word in ['clinical', 'patient', 'diagnosis', 'prognosis', 'biomarker']):
        if tag_len < 45:
            return {'quality': 'standard', 'reason': 'clinical/translational', 'category': 'Clinical & Translational'}
    
    # Pathways and processes (general ones)
    if any(word in tag_lower for word in ['pathway', 'signaling', 'regulation', 'response']):
        if tag_len < 40 and ' biosynthesis' not in tag_lower:
            return {'quality': 'standard', 'reason': 'pathway/process', 'category': 'Pathways & Processes'}
    
    
    # ==================================================================
    # TIER 3: EXTENDED (~20000 tags)
    # Comprehensive coverage for specialists
    # ==================================================================
    
    # Proteins, genes, receptors (not too specific)
    if any(word in tag_lower for word in ['protein', 'receptor', 'factor', 'kinase', 'enzyme']):
        if tag_len < 35 and special_char_count < 2:
            return {'quality': 'extended', 'reason': 'protein/gene', 'category': 'Molecular Biology'}
    
    # Specific anatomical structures
    if tag_len < 40 and special_char_count < 2:
        return {'quality': 'extended', 'reason': 'general term', 'category': 'Biomedical Research'}
    
    # Default: reject if we got here
    return {'quality': 'reject', 'reason': 'no matching criteria', 'category': None}


def categorize_tag(tag: str, default_category: str) -> str:
    """
    Determine the best category for a tag.
    Uses keyword matching with more specific logic.
    """
    tag_lower = tag.lower()
    
    # Order matters - check most specific first
    
    # Medical Specialties
    if any(spec in tag_lower for spec in [
        'cardiology', 'oncology', 'neurology', 'pediatrics', 'psychiatry',
        'dermatology', 'gastroenterology', 'endocrinology', 'nephrology',
        'hematology', 'pulmonology', 'rheumatology', 'urology'
    ]):
        return "Medical Specialties"
    
    # Cancer (check before general diseases)
    if 'cancer' in tag_lower or 'carcinoma' in tag_lower or 'tumor' in tag_lower:
        return "Cancer Types"
    
    # Research Methods
    if any(word in tag_lower for word in [
        'sequencing', 'microscopy', 'pcr', 'elisa', 'assay', 'imaging',
        'western blot', 'flow cytometry', 'chromatography', 'crispr'
    ]):
        return "Research Methods"
    
    # Cell Biology
    if any(word in tag_lower for word in [
        'cell', 'cellular', 'stem cell', 'neuron', 'lymphocyte'
    ]):
        return "Cell Biology"
    
    # Molecular Biology
    if any(word in tag_lower for word in [
        'dna', 'rna', 'protein', 'gene', 'mrna', 'expression', 'transcription'
    ]):
        return "Molecular Biology"
    
    # Genetics & Genomics
    if any(word in tag_lower for word in [
        'genome', 'genetic', 'genomic', 'mutation', 'chromosome', 'allele'
    ]):
        return "Genetics & Genomics"
    
    # Immunology
    if any(word in tag_lower for word in [
        'immune', 'antibody', 'antigen', 'immunoglobulin', 'cytokine', 'vaccine'
    ]):
        return "Immunology"
    
    # Neuroscience
    if any(word in tag_lower for word in [
        'brain', 'neural', 'neuron', 'cognitive', 'neurological'
    ]):
        return "Neuroscience"
    
    # Pharmacology
    if any(word in tag_lower for word in [
        'drug', 'therapy', 'treatment', 'inhibitor', 'pharmaceutical'
    ]):
        return "Pharmacology"
    
    # Anatomy
    if any(word in tag_lower for word in [
        'heart', 'liver', 'kidney', 'lung', 'tissue', 'organ', 'bone'
    ]):
        return "Anatomy"
    
    # Clinical & Translational
    if any(word in tag_lower for word in [
        'clinical', 'trial', 'patient', 'diagnosis', 'therapy'
    ]):
        return "Clinical & Translational"
    
    # Diseases & Conditions (after more specific checks)
    if any(word in tag_lower for word in [
        'disease', 'syndrome', 'disorder', 'infection', 'diabetes'
    ]):
        return "Diseases & Conditions"
    
    # Pathways & Processes
    if any(word in tag_lower for word in [
        'pathway', 'metabolism', 'signaling', 'regulation'
    ]):
        return "Pathways & Processes"
    
    return default_category


def populate_curated_topics(tier: str = "essential", batch_size: int = 100, max_tags: int = None):
    """
    Populate Topics table with curated tags.
    
    Args:
        tier: Which quality tier to use ('essential', 'standard', 'extended', 'all')
        batch_size: Number of tags to process in each batch
        max_tags: Maximum number of tags to add (None = no limit)
    """
    print("=" * 60)
    print("POPULATING TOPICS WITH CURATED TAGS")
    print("=" * 60)
    print(f"Tier: {tier.upper()}")
    print()
    
    # Load tags from user_friendly_tags.txt
    print("📂 Loading tags from user_friendly_tags.txt...")
    all_tags = load_tags_from_file("../user_friendly_tags.txt")
    
    if not all_tags:
        all_tags = load_tags_from_file("user_friendly_tags.txt")
    
    if not all_tags:
        print("❌ Could not load tags file!")
        return
    
    print(f"✅ Loaded {len(all_tags):,} tags from file")
    print()
    
    # Filter tags by quality
    print(f"🔍 Filtering tags by quality tier: {tier}...")
    filtered_tags = []
    stats = {'essential': 0, 'standard': 0, 'extended': 0, 'reject': 0}
    
    for tag in all_tags:
        quality_info = is_high_quality_tag(tag)
        quality_level = quality_info['quality']
        stats[quality_level] += 1
        
        # Decide if we should include this tag
        include = False
        if tier == 'essential' and quality_level == 'essential':
            include = True
        elif tier == 'standard' and quality_level in ['essential', 'standard']:
            include = True
        elif tier == 'extended' and quality_level in ['essential', 'standard', 'extended']:
            include = True
        elif tier == 'all':
            include = quality_level != 'reject'
        
        if include:
            category = quality_info['category'] or categorize_tag(tag, "Biomedical Research")
            filtered_tags.append({
                'tag': tag,
                'category': category,
                'quality': quality_level
            })
    
    print(f"📊 Quality Distribution:")
    print(f"   Essential: {stats['essential']:,}")
    print(f"   Standard: {stats['standard']:,}")
    print(f"   Extended: {stats['extended']:,}")
    print(f"   Rejected: {stats['reject']:,}")
    print()
    print(f"✅ Filtered to {len(filtered_tags):,} tags")
    print()
    
    if max_tags:
        filtered_tags = filtered_tags[:max_tags]
        print(f"⚠️  Limited to first {max_tags:,} tags for testing")
        print()
    
    # Get existing tags
    db = next(get_local_db())
    print("🔍 Checking for existing tags in database...")
    existing_tags = set(tag[0] for tag in db.query(Topics.subtopic).all())
    print(f"   Found {len(existing_tags):,} existing tags")
    print()
    
    # Filter out existing
    new_tags = [t for t in filtered_tags if t['tag'] not in existing_tags]
    print(f"📊 New tags to add: {len(new_tags):,}")
    print()
    
    if len(new_tags) == 0:
        print("✅ All filtered tags already exist in database!")
        return
    
    # Process in batches
    total_added = 0
    total_skipped = 0
    
    for i in range(0, len(new_tags), batch_size):
        batch = new_tags[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(new_tags) + batch_size - 1) // batch_size
        
        print(f"📦 Batch {batch_num}/{total_batches} ({len(batch)} tags)...")
        
        for tag_info in batch:
            try:
                tag = tag_info['tag']
                category = tag_info['category']
                
                # Generate embedding
                embedding = generate_embeddings(tag)
                
                # Create topic
                new_topic = Topics(
                    broadtopic=category,
                    subtopic=tag,
                    embeddings=embedding.tolist()
                )
                
                db.add(new_topic)
                total_added += 1
                
            except Exception as e:
                print(f"   ⚠️  Error adding '{tag}': {str(e)}")
                total_skipped += 1
        
        # Commit batch
        try:
            db.commit()
            print(f"   ✅ Committed ({total_added:,} total added)")
        except Exception as e:
            print(f"   ❌ Error committing: {str(e)}")
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
        description="Populate Topics with CURATED, high-quality tags"
    )
    parser.add_argument(
        "--tier",
        type=str,
        default="standard",
        choices=['essential', 'standard', 'extended', 'all'],
        help="Quality tier: essential (~500), standard (~5000), extended (~20000), all"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size (default: 100)"
    )
    parser.add_argument(
        "--max-tags",
        type=int,
        default=None,
        help="Max tags to add (for testing)"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: Add 100 tags only"
    )
    
    args = parser.parse_args()
    
    if args.test:
        print("🧪 TEST MODE: Adding 100 tags only")
        print()
        populate_curated_topics(
            tier=args.tier,
            batch_size=args.batch_size,
            max_tags=100
        )
    else:
        populate_curated_topics(
            tier=args.tier,
            batch_size=args.batch_size,
            max_tags=args.max_tags
        )
