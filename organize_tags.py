#!/usr/bin/env python3
"""
Create a comprehensive, well-organized tag collection with three tiers:
1. Essential Tags (for onboarding) - ~500 most accessible terms
2. Standard Tags (main collection) - All user-friendly terms
3. Advanced Tags (comprehensive) - Everything including technical terms

This makes it easy to implement progressive disclosure in the UI.
"""

import json


def load_file(filename):
    """Load tags from a text file."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return {line.strip() for line in f if line.strip()}
    except FileNotFoundError:
        print(f"⚠️  File not found: {filename}")
        return set()


def categorize_tags(tags):
    """
    Organize tags into categories for better UI presentation.
    """
    categories = {
        'Medical Specialties': set(),
        'Diseases & Conditions': set(),
        'Cancer Types': set(),
        'Research Methods': set(),
        'Molecular Biology': set(),
        'Cell Biology': set(),
        'Genetics & Genomics': set(),
        'Immunology': set(),
        'Neuroscience': set(),
        'Pharmacology': set(),
        'Anatomy': set(),
        'Pathways & Processes': set(),
        'Clinical & Translational': set(),
        'Technology & AI': set(),
        'Population Health': set(),
        'Other': set(),
    }
    
    # Define keywords for each category
    category_keywords = {
        'Medical Specialties': ['ology', 'iatrics', 'Medicine', 'Surgery'],
        'Diseases & Conditions': ['Disease', 'Syndrome', 'Disorder', 'Condition', 'Infection'],
        'Cancer Types': ['Cancer', 'Carcinoma', 'Sarcoma', 'Lymphoma', 'Leukemia', 'Melanoma', 'Tumor'],
        'Research Methods': ['seq', 'PCR', 'Microscopy', 'Assay', 'Sequencing', 'Imaging', 'CRISPR', '-omics', 'Blot'],
        'Molecular Biology': ['DNA', 'RNA', 'Protein', 'Gene Expression', 'Transcription', 'Translation', 'MicroRNA'],
        'Cell Biology': ['Cell', 'Cellular', 'Mitochondri', 'Nucleus', 'Cytoplasm', 'Organelle'],
        'Genetics & Genomics': ['Genetic', 'Genome', 'Genomic', 'Mutation', 'Allele', 'Chromosome', 'Epigenetic'],
        'Immunology': ['Immune', 'Antibod', 'Antigen', 'Cytokine', 'T Cell', 'B Cell', 'Macrophage', 'Inflammation'],
        'Neuroscience': ['Neuro', 'Brain', 'Cognitive', 'Synapse', 'Neurotransmitter', 'Neural'],
        'Pharmacology': ['Drug', 'Therapeutic', 'Pharmacokinetic', 'Pharmacodynamic', 'Inhibitor', 'Agonist'],
        'Anatomy': ['Heart', 'Lung', 'Liver', 'Kidney', 'Brain', 'System', 'Tissue', 'Organ'],
        'Pathways & Processes': ['Pathway', 'Signaling', 'Metabolism', 'Regulation', 'Apoptosis', 'Proliferation'],
        'Clinical & Translational': ['Clinical', 'Trial', 'Patient', 'Treatment', 'Therapy', 'Diagnosis'],
        'Technology & AI': ['Machine Learning', 'Deep Learning', 'AI', 'Computational', 'Bioinformatics', 'Digital'],
        'Population Health': ['Epidemiology', 'Public Health', 'Screening', 'Prevention', 'Health Policy'],
    }
    
    # Categorize each tag
    for tag in tags:
        categorized = False
        for category, keywords in category_keywords.items():
            if any(keyword.lower() in tag.lower() for keyword in keywords):
                categories[category].add(tag)
                categorized = True
                break
        
        if not categorized:
            categories['Other'].add(tag)
    
    # Remove empty categories
    return {k: sorted(v) for k, v in categories.items() if v}


def get_essential_tags():
    """
    Curate ~500 most essential, accessible tags for initial onboarding.
    These are the "can't miss" topics that most users will understand.
    """
    essential = {
        # Major diseases everyone knows
        "Cancer", "Breast Cancer", "Lung Cancer", "Prostate Cancer", "Colorectal Cancer",
        "Heart Disease", "Heart Failure", "Stroke", "Diabetes", "Type 2 Diabetes", "Type 1 Diabetes",
        "Alzheimer's Disease", "Parkinson's Disease", "Multiple Sclerosis", "Dementia",
        "Asthma", "COPD", "Arthritis", "Osteoporosis", "Hypertension",
        "Obesity", "Depression", "Anxiety", "Schizophrenia", "ADHD",
        "HIV", "COVID-19", "Influenza", "Tuberculosis", "Malaria",
        
        # Body systems & organs
        "Heart", "Brain", "Lung", "Liver", "Kidney", "Pancreas",
        "Immune System", "Nervous System", "Cardiovascular System",
        "Blood", "Bone", "Muscle",
        
        # Cell types (accessible)
        "Stem Cells", "T Cells", "Cancer Cells", "Neurons", "Blood Cells",
        
        # Major medical specialties
        "Cardiology", "Neurology", "Oncology", "Immunology", "Endocrinology",
        "Pediatrics", "Psychiatry", "Surgery", "Internal Medicine",
        
        # Research areas
        "Gene Therapy", "Immunotherapy", "Precision Medicine", "Regenerative Medicine",
        "Vaccine Development", "Drug Discovery", "Clinical Trials",
        "Artificial Intelligence", "Machine Learning", "Digital Health",
        
        # Common techniques (accessible names)
        "RNA-seq", "CRISPR", "Gene Editing", "DNA Sequencing", "Genome Sequencing",
        "MRI", "CT Scan", "PET Scan", "Ultrasound", "X-ray",
        "PCR", "Western Blot", "ELISA", "Flow Cytometry", "Microscopy",
        
        # Fundamental concepts
        "DNA", "RNA", "Protein", "Gene", "Genome", "Chromosome",
        "Mutation", "Genetic Disorder", "Inflammation", "Infection",
        "Antibodies", "Antigens", "Vaccines", "Hormones", "Enzymes",
        
        # Molecular processes (simplified)
        "Gene Expression", "Protein Synthesis", "Cell Division", "Cell Death",
        "Immune Response", "Signal Transduction", "Metabolism",
        
        # Treatment & therapy
        "Chemotherapy", "Radiation Therapy", "Surgery", "Antibiotics",
        "Immunosuppressants", "Pain Management", "Rehabilitation",
        
        # Pathways (major ones)
        "Cancer Biology", "Neuroscience", "Infectious Disease", "Autoimmune Disease",
        "Metabolic Syndrome", "Cardiovascular Disease", "Mental Health",
        
        # Study types
        "Clinical Trial", "Randomized Controlled Trial", "Meta-Analysis",
        "Cohort Study", "Case Study", "Systematic Review",
        
        # Hot topics
        "Microbiome", "Gut Health", "Sleep", "Aging", "Longevity",
        "Stem Cell Therapy", "Personalized Medicine", "Biomarkers",
        
        # Model systems (simple)
        "Mouse Model", "Cell Culture", "Animal Models", "Human Studies",
        
        # Omics (accessible)
        "Genomics", "Proteomics", "Metabolomics", "Single-Cell Analysis",
        
        # Emerging fields
        "Nanomedicine", "Telemedicine", "Wearable Devices", "Health Informatics",
        "Systems Biology", "Synthetic Biology", "Tissue Engineering", "Organoids",
    }
    
    return essential


def main():
    print("=" * 70)
    print("CREATING ORGANIZED TAG COLLECTION WITH THREE TIERS")
    print("=" * 70)
    print()
    
    # Load all files
    print("📚 Loading tag collections...")
    all_tags = load_file('all_tag_words.txt')
    user_friendly = load_file('user_friendly_tags.txt')
    broad_categories = load_file('broad_research_categories.txt')
    
    print(f"   - All tags: {len(all_tags):,}")
    print(f"   - User-friendly tags: {len(user_friendly):,}")
    print(f"   - Broad categories: {len(broad_categories):,}")
    print()
    
    # Merge user_friendly with broad_categories
    print("🔄 Merging user-friendly tags with broad categories...")
    standard_tags = user_friendly | broad_categories
    print(f"   - Standard collection: {len(standard_tags):,} tags")
    print()
    
    # Create essential tier
    print("✨ Curating essential tags...")
    essential_curated = get_essential_tags()
    # Verify they exist in our collections
    essential_tags = essential_curated & standard_tags
    # Add any that exist in all_tags
    essential_tags |= essential_curated & all_tags
    print(f"   - Essential collection: {len(essential_tags):,} tags")
    print()
    
    # Save three-tier system
    print("💾 Saving organized collections...")
    
    # 1. Essential (for onboarding)
    with open('tags_essential.txt', 'w', encoding='utf-8') as f:
        for tag in sorted(essential_tags):
            f.write(tag + '\n')
    print(f"   ✅ tags_essential.txt ({len(essential_tags):,} tags)")
    
    # 2. Standard (user-friendly + broad)
    with open('tags_standard.txt', 'w', encoding='utf-8') as f:
        for tag in sorted(standard_tags):
            f.write(tag + '\n')
    print(f"   ✅ tags_standard.txt ({len(standard_tags):,} tags)")
    
    # 3. Advanced (everything)
    with open('tags_advanced.txt', 'w', encoding='utf-8') as f:
        for tag in sorted(all_tags):
            f.write(tag + '\n')
    print(f"   ✅ tags_advanced.txt ({len(all_tags):,} tags)")
    
    # Create categorized version for UI
    print()
    print("📂 Creating categorized collection...")
    categorized = categorize_tags(essential_tags)
    
    with open('tags_categorized.json', 'w', encoding='utf-8') as f:
        json.dump(categorized, f, indent=2, ensure_ascii=False)
    print(f"   ✅ tags_categorized.json ({len(categorized)} categories)")
    
    # Statistics
    print()
    print("=" * 70)
    print("📊 STATISTICS")
    print("=" * 70)
    print()
    
    print(f"{'Collection':<20} {'Tags':>15} {'Use Case':<35}")
    print("-" * 70)
    print(f"{'Essential':<20} {len(essential_tags):>15,} {'Onboarding, first-time users':<35}")
    print(f"{'Standard':<20} {len(standard_tags):>15,} {'Main UI, most users':<35}")
    print(f"{'Advanced':<20} {len(all_tags):>15,} {'Search, expert users':<35}")
    print()
    
    # Show category breakdown
    print("=" * 70)
    print("📂 ESSENTIAL TAGS BY CATEGORY")
    print("=" * 70)
    print()
    for category, tags in sorted(categorized.items(), key=lambda x: -len(x[1]))[:10]:
        print(f"{category:<30} {len(tags):>5} tags")
        # Show first 5 examples
        for tag in tags[:5]:
            print(f"   - {tag}")
        if len(tags) > 5:
            print(f"   ... and {len(tags) - 5} more")
        print()
    
    print("=" * 70)
    print("✅ COMPLETE! Tag collections ready for implementation")
    print("=" * 70)
    print()
    
    print("💡 IMPLEMENTATION GUIDE:")
    print()
    print("   OPTION 1: Simple (Recommended for MVP)")
    print("   ----------------------------------------")
    print("   - Use tags_essential.txt for onboarding")
    print("   - Users select 3-5 tags")
    print("   - Backend matches against tags_advanced.txt")
    print()
    print("   OPTION 2: Progressive Disclosure")
    print("   ----------------------------------------")
    print("   - Onboarding: Show tags_essential.txt")
    print("   - Profile settings: Allow tags_standard.txt")
    print("   - Search: Use tags_advanced.txt")
    print()
    print("   OPTION 3: Categorized (Best UX)")
    print("   ----------------------------------------")
    print("   - Load tags_categorized.json")
    print("   - Show categories with expand/collapse")
    print("   - Users browse by category")
    print("   - Add search across all categories")


if __name__ == "__main__":
    main()
