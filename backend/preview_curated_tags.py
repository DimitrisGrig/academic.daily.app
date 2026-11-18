"""
Preview what tags will be added WITHOUT actually adding them to database.
Use this to verify the filtering logic before running the real script.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from populate_topics_curated import load_tags_from_file, is_high_quality_tag, categorize_tag


def preview_tags(tier='standard', sample_size=50):
    """Preview tags that will be added."""
    print("=" * 70)
    print(f"PREVIEW: {tier.upper()} TIER TAGS")
    print("=" * 70)
    print()
    
    # Load tags
    print("Loading tags...")
    all_tags = load_tags_from_file("../user_friendly_tags.txt")
    if not all_tags:
        all_tags = load_tags_from_file("user_friendly_tags.txt")
    
    print(f"Loaded {len(all_tags):,} total tags")
    print()
    
    # Filter
    print(f"Filtering for tier: {tier}")
    print()
    
    filtered = []
    rejected_examples = []
    stats = {'essential': 0, 'standard': 0, 'extended': 0, 'reject': 0}
    rejection_reasons = {}
    
    for tag in all_tags:
        quality_info = is_high_quality_tag(tag)
        quality_level = quality_info['quality']
        stats[quality_level] += 1
        
        # Track rejection reasons
        if quality_level == 'reject':
            reason = quality_info['reason']
            if reason not in rejection_reasons:
                rejection_reasons[reason] = []
            if len(rejection_reasons[reason]) < 5:
                rejection_reasons[reason].append(tag)
        
        # Decide inclusion
        include = False
        if tier == 'essential' and quality_level == 'essential':
            include = True
        elif tier == 'standard' and quality_level in ['essential', 'standard']:
            include = True
        elif tier == 'extended' and quality_level in ['essential', 'standard', 'extended']:
            include = True
        
        if include:
            category = quality_info['category'] or categorize_tag(tag, "Biomedical Research")
            filtered.append({
                'tag': tag,
                'category': category,
                'quality': quality_level
            })
    
    # Show statistics
    print("📊 QUALITY DISTRIBUTION:")
    print(f"   Essential:  {stats['essential']:>8,} tags")
    print(f"   Standard:   {stats['standard']:>8,} tags")
    print(f"   Extended:   {stats['extended']:>8,} tags")
    print(f"   Rejected:   {stats['reject']:>8,} tags")
    print()
    print(f"✅ Selected for '{tier}' tier: {len(filtered):,} tags")
    print()
    
    # Show rejection reasons
    print("❌ REJECTION REASONS (sample):")
    for reason, examples in sorted(rejection_reasons.items()):
        print(f"\n   {reason}:")
        for ex in examples[:3]:
            print(f"      • {ex}")
    print()
    
    # Show sample by category
    print("=" * 70)
    print(f"SAMPLE TAGS BY CATEGORY (first {sample_size} total)")
    print("=" * 70)
    print()
    
    # Group by category
    by_category = {}
    for item in filtered:
        cat = item['category']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(item)
    
    # Show samples
    shown = 0
    for category in sorted(by_category.keys()):
        items = by_category[category]
        print(f"📁 {category} ({len(items)} tags)")
        
        # Show first few from this category
        for item in items[:min(5, sample_size - shown)]:
            quality_badge = "⭐" if item['quality'] == 'essential' else "📌" if item['quality'] == 'standard' else "📍"
            print(f"   {quality_badge} {item['tag']}")
            shown += 1
            if shown >= sample_size:
                break
        
        print()
        if shown >= sample_size:
            break
    
    print("=" * 70)
    print("💡 TIP: If this looks good, run:")
    print(f"   python backend/populate_topics_curated.py --tier {tier}")
    print("=" * 70)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Preview curated tags before adding")
    parser.add_argument(
        "--tier",
        type=str,
        default="standard",
        choices=['essential', 'standard', 'extended'],
        help="Which tier to preview"
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=50,
        help="How many sample tags to show"
    )
    
    args = parser.parse_args()
    preview_tags(tier=args.tier, sample_size=args.sample)
