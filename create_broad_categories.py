#!/usr/bin/env python3
"""
Add high-level, user-friendly research category tags.
These are broad, accessible terms that users can easily understand and select.
"""

def get_broad_research_categories():
    """
    High-level research fields and topics that are missing or need emphasis.
    These are perfect for user onboarding - easy to understand and select.
    """
    categories = {
        # === Broad Medical Specialties ===
        "Cardiology",
        "Neurology",
        "Oncology",
        "Immunology",
        "Endocrinology",
        "Gastroenterology",
        "Pulmonology",
        "Nephrology",
        "Hematology",
        "Dermatology",
        "Ophthalmology",
        "Orthopedics",
        "Pediatrics",
        "Geriatrics",
        "Psychiatry",
        "Radiology",
        "Anesthesiology",
        "Emergency Medicine",
        "Internal Medicine",
        "Surgery",
        
        # === Research Areas ===
        "Basic Science",
        "Translational Research",
        "Clinical Research",
        "Epidemiology",
        "Public Health",
        "Global Health",
        "Precision Medicine",
        "Personalized Medicine",
        "Regenerative Medicine",
        "Gene Therapy",
        "Cell Therapy",
        "Stem Cell Research",
        "Tissue Engineering",
        "Biomarker Discovery",
        "Drug Discovery",
        "Drug Development",
        "Clinical Trials",
        "Health Policy",
        "Healthcare Delivery",
        
        # === Technology & Methods (High-Level) ===
        "Artificial Intelligence",
        "Machine Learning in Medicine",
        "Deep Learning",
        "Medical Imaging",
        "Digital Health",
        "Telemedicine",
        "Wearable Devices",
        "Health Informatics",
        "Computational Biology",
        "Systems Medicine",
        "Network Biology",
        "Structural Biology",
        "Chemical Biology",
        "Synthetic Biology",
        
        # === Disease Categories (General) ===
        "Infectious Disease",
        "Autoimmune Disease",
        "Genetic Disorders",
        "Rare Diseases",
        "Chronic Disease",
        "Acute Disease",
        "Neurodegenerative Disease",
        "Cardiovascular Disease",
        "Metabolic Disease",
        "Cancer Biology",
        "Tumor Immunology",
        "Mental Health",
        "Substance Abuse",
        
        # === Biological Systems & Concepts ===
        "Immune System",
        "Nervous System",
        "Cardiovascular System",
        "Respiratory System",
        "Digestive System",
        "Endocrine System",
        "Reproductive System",
        "Musculoskeletal System",
        "Gene Expression",
        "Gene Regulation",
        "Epigenetics",
        "Chromatin",
        "Protein Synthesis",
        "Post-translational Modification",
        "Signal Transduction",
        "Cellular Communication",
        "Cell Death",
        "Cell Survival",
        "Stem Cells",
        "Differentiation",
        "Development",
        "Aging",
        "Longevity",
        
        # === Molecular Biology Fundamentals ===
        "DNA",
        "RNA",
        "Protein",
        "Enzyme",
        "Receptor",
        "Ligand",
        "Antibody",
        "Antigen",
        "Cytokine",
        "Chemokine",
        "Hormone",
        "Neurotransmitter",
        "Growth Factor",
        "Transcription Factor",
        "MicroRNA",
        "Long Non-coding RNA",
        "Circular RNA",
        
        # === Pharmacology & Therapeutics ===
        "Drug Resistance",
        "Drug Toxicity",
        "Pharmacokinetics",
        "Pharmacodynamics",
        "Drug Interactions",
        "Adverse Effects",
        "Side Effects",
        "Vaccine Development",
        "Vaccine Efficacy",
        "Antibody Therapy",
        "Small Molecule Drugs",
        "Biologics",
        "Biosimilars",
        
        # === Pathology & Disease Mechanisms ===
        "Inflammation",
        "Infection",
        "Immune Response",
        "Oxidative Stress",
        "Mitochondrial Dysfunction",
        "Protein Misfolding",
        "DNA Damage",
        "Mutation",
        "Genomic Instability",
        "Metastasis",
        "Angiogenesis",
        "Tumor Microenvironment",
        "Fibrosis",
        "Neuroinflammation",
        "Neurodegeneration",
        
        # === Patient Care & Outcomes ===
        "Patient Safety",
        "Quality of Life",
        "Disease Progression",
        "Disease Prevention",
        "Early Detection",
        "Screening",
        "Diagnosis",
        "Prognosis",
        "Treatment Response",
        "Survival",
        "Mortality",
        "Morbidity",
        "Rehabilitation",
        "Palliative Care",
        
        # === Population & Demographics ===
        "Pediatric Population",
        "Adult Population",
        "Elderly Population",
        "Women's Health",
        "Men's Health",
        "Maternal Health",
        "Child Health",
        "Adolescent Health",
        "Health Disparities",
        "Health Equity",
        
        # === Study Types ===
        "Case Report",
        "Case Series",
        "Cohort Study",
        "Cross-Sectional Study",
        "Longitudinal Study",
        "Randomized Controlled Trial",
        "Meta-Analysis",
        "Systematic Review",
        "Observational Study",
        "Prospective Study",
        "Retrospective Study",
        
        # === Emerging Fields ===
        "Microbiome",
        "Gut Microbiota",
        "Microbiome-Gut-Brain Axis",
        "Circadian Rhythm",
        "Sleep Medicine",
        "Exercise Medicine",
        "Nutritional Medicine",
        "Lifestyle Medicine",
        "Integrative Medicine",
        "Nanomedicine",
        "Theranostics",
        "Liquid Biopsy",
        "Single-Cell Analysis",
        "Spatial Biology",
        "Multi-Omics",
        "Organoid Technology",
        
        # === Hot Topics & Trends ===
        "COVID-19",
        "SARS-CoV-2",
        "Pandemic Preparedness",
        "Antimicrobial Resistance",
        "Climate Change and Health",
        "Environmental Health",
        "One Health",
        "Zoonotic Disease",
        "Emerging Infectious Disease",
        
        # === Model Organisms (User-Friendly) ===
        "Human Studies",
        "Mouse Studies",
        "Rat Studies",
        "Animal Models",
        "Cell Models",
        "In Vitro Models",
        "In Vivo Models",
        "Patient-Derived Models",
    }
    
    return categories


def get_common_research_keywords():
    """
    Common research keywords that bridge technical and accessible language.
    """
    keywords = {
        # === Impact & Significance ===
        "Novel",
        "Innovative",
        "Breakthrough",
        "First-in-Human",
        "Proof-of-Concept",
        "Feasibility",
        
        # === Research Phases ===
        "Preclinical",
        "Phase 1",
        "Phase 2",
        "Phase 3",
        "Phase 4",
        "Clinical Translation",
        
        # === Outcomes ===
        "Efficacy",
        "Safety",
        "Tolerability",
        "Bioavailability",
        "Therapeutic Window",
        
        # === Analytical Terms ===
        "Biomarker",
        "Endpoint",
        "Risk Factor",
        "Protective Factor",
        "Predictor",
        "Correlation",
        "Association",
        "Causation",
        "Mechanism",
        "Pathway",
        
        # === Comparison Terms ===
        "Versus",
        "Comparison",
        "Control Group",
        "Treatment Group",
        "Placebo",
        "Standard of Care",
        
        # === Scale/Scope ===
        "Molecular Level",
        "Cellular Level",
        "Tissue Level",
        "Organ Level",
        "Systemic",
        "Whole Organism",
        "Population Level",
    }
    
    return keywords


def get_interdisciplinary_fields():
    """
    Interdisciplinary fields that combine multiple areas.
    """
    fields = {
        "Biochemistry",
        "Molecular Medicine",
        "Chemical Biology",
        "Biomedical Engineering",
        "Bioengineering",
        "Biomechanics",
        "Biomaterials",
        "Medical Physics",
        "Pharmacology",
        "Toxicology",
        "Neuroscience",
        "Cognitive Neuroscience",
        "Behavioral Neuroscience",
        "Neuroimaging",
        "Neuropsychology",
        "Psychopharmacology",
        "Molecular Genetics",
        "Population Genetics",
        "Genomic Medicine",
        "Pharmacogenomics",
        "Nutrigenomics",
        "Immunogenetics",
        "Cancer Genetics",
        "Developmental Biology",
        "Evolutionary Biology",
        "Microbiology",
        "Virology",
        "Bacteriology",
        "Parasitology",
        "Mycology",
        "Cell Biology",
        "Molecular Biology",
        "Biophysics",
        "Physiology",
        "Pathophysiology",
        "Anatomy",
        "Histology",
        "Pathology",
        "Clinical Pathology",
        "Molecular Pathology",
    }
    
    return fields


def main():
    print("=" * 60)
    print("GENERATING BROAD RESEARCH CATEGORIES")
    print("=" * 60)
    print()
    
    all_categories = set()
    
    all_categories |= get_broad_research_categories()
    print(f"✅ Broad research categories: {len(get_broad_research_categories())}")
    
    all_categories |= get_common_research_keywords()
    print(f"✅ Common research keywords: {len(get_common_research_keywords())}")
    
    all_categories |= get_interdisciplinary_fields()
    print(f"✅ Interdisciplinary fields: {len(get_interdisciplinary_fields())}")
    
    print(f"\n📊 Total new terms: {len(all_categories)}")
    
    # Save to file
    output_file = "broad_research_categories.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        for term in sorted(all_categories):
            f.write(term + '\n')
    
    print(f"💾 Saved to: {output_file}")
    print()
    
    # Show samples by category
    print("=" * 60)
    print("SAMPLE CATEGORIES")
    print("=" * 60)
    print()
    
    print("🏥 Medical Specialties (sample):")
    specialties = [t for t in all_categories if any(x in t for x in ['ology', 'iatrics', 'Medicine'])]
    for term in sorted(specialties)[:10]:
        print(f"   - {term}")
    
    print(f"\n🔬 Research Areas (sample):")
    research = [t for t in get_broad_research_categories() if 'Research' in t or 'Medicine' in t or 'Therapy' in t]
    for term in sorted(research)[:10]:
        print(f"   - {term}")
    
    print(f"\n🧬 Biological Systems (sample):")
    bio = [t for t in all_categories if 'System' in t or t in ['DNA', 'RNA', 'Protein']]
    for term in sorted(bio)[:10]:
        print(f"   - {term}")
    
    print()
    print("=" * 60)
    print("✅ COMPLETE!")
    print("=" * 60)
    print()
    print("💡 Next steps:")
    print("   1. Merge this with user_friendly_tags.txt")
    print("   2. Use as high-level categories in UI")
    print("   3. Allow users to drill down to specific terms")


if __name__ == "__main__":
    main()
