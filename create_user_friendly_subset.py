#!/usr/bin/env python3
"""
Create a user-friendly subset of tag words for onboarding UI.
This filters the comprehensive list to keep only highly readable, 
commonly used biomedical terms.
"""

import re

INPUT_FILE = "all_tag_words.txt"
OUTPUT_FILE = "user_friendly_tags.txt"


def is_highly_readable(term):
    """
    More aggressive filtering for user-facing tags.
    Only keeps very readable, common biomedical terms.
    """
    term_lower = term.lower()
    
    # Skip very short terms
    if len(term) < 3:
        return False
    
    # Skip terms with excessive numbers
    digit_count = sum(1 for c in term if c.isdigit())
    if digit_count > len(term) * 0.3:  # More than 30% digits
        return False
    
    # Skip terms with Greek letters (often very technical)
    greek_letters = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 
                    'theta', 'kappa', 'lambda', 'sigma', 'omega', 'xi']
    if any(greek in term_lower for greek in greek_letters):
        return False
    
    # Skip terms with excessive hyphens (chemical nomenclature)
    if term.count('-') > 3:
        return False
    
    # Skip terms with excessive commas (complex nomenclature)
    if term.count(',') > 2:
        return False
    
    # Skip steroid nomenclature
    if any(x in term_lower for x in ['cholestan', 'cholanoic', 'pregnan', 'androstan']):
        return False
    
    # Skip terms that are mostly capital letters (abbreviations might be too technical)
    caps = sum(1 for c in term if c.isupper())
    if caps > len(term) * 0.8 and len(term) > 5:
        return False
    
    # Skip single-letter + numbers (e.g., "3 alpha Hydroxy")
    if re.match(r'^\d+\s+[a-z]+\s+', term_lower):
        # But keep common ones like "Type 2 Diabetes"
        if not any(x in term_lower for x in ['type', 'stage', 'class', 'grade', 'phase']):
            return False
    
    # Keep common disease categories
    disease_keywords = ['cancer', 'tumor', 'disease', 'syndrome', 'disorder', 'diabetes',
                       'infection', 'deficiency', 'failure', 'injury', 'inflammation']
    
    # Keep common techniques
    technique_keywords = ['sequencing', 'microscopy', 'assay', 'screening', 'imaging',
                         'pcr', 'elisa', 'crispr', 'rna-seq', 'chip-seq', 'proteomics']
    
    # Keep anatomical terms
    anatomy_keywords = ['cell', 'tissue', 'organ', 'system', 'brain', 'heart', 'lung',
                       'liver', 'kidney', 'blood', 'bone', 'muscle', 'nerve']
    
    # Keep biological process terms
    process_keywords = ['signaling', 'pathway', 'metabolism', 'regulation', 'development',
                       'differentiation', 'proliferation', 'death', 'repair', 'response']
    
    # Prioritize terms with these keywords
    all_keywords = disease_keywords + technique_keywords + anatomy_keywords + process_keywords
    has_priority_keyword = any(kw in term_lower for kw in all_keywords)
    
    # More lenient for priority terms
    if has_priority_keyword:
        return len(term) < 60 and term.count('(') < 2
    
    # For non-priority terms, be more strict
    if len(term) > 40:
        return False
    
    if term.count('(') > 1:
        return False
    
    return True


def main():
    print("=" * 60)
    print("CREATING USER-FRIENDLY TAG SUBSET")
    print("=" * 60)
    print()
    
    # Read all tags
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        all_tags = [line.strip() for line in f if line.strip()]
    
    print(f"📚 Total tags: {len(all_tags):,}")
    
    # Filter for readability
    user_friendly = [tag for tag in all_tags if is_highly_readable(tag)]
    
    print(f"✨ User-friendly tags: {len(user_friendly):,}")
    print(f"📉 Filtered out: {len(all_tags) - len(user_friendly):,} ({100 * (len(all_tags) - len(user_friendly)) / len(all_tags):.1f}%)")
    
    # Save
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        for tag in sorted(user_friendly):
            f.write(tag + '\n')
    
    print(f"\n💾 Saved to: {OUTPUT_FILE}")
    print()
    
    # Show some examples
    print("📋 Sample tags (first 20):")
    for i, tag in enumerate(sorted(user_friendly)[:20], 1):
        print(f"   {i}. {tag}")
    
    print()
    print("=" * 60)
    print("✅ COMPLETE!")
    print("=" * 60)
    print()
    print("💡 Use this file for user-facing tag selection UI")
    print("   Use all_tag_words.txt for comprehensive search/matching")


if __name__ == "__main__":
    main()
