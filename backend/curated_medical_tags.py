"""
Curated Medical & Research Tags

High-quality tags covering:
- Medical specialties and subspecialties
- Major diseases and conditions
- Research methodologies and techniques
- Molecular biology and genetics
- Clinical and translational research
- Topics from Nature, Cell, Lancet, NEJM

These tags complement tags_essential.txt to provide comprehensive coverage
of biomedical research without overwhelming specificity.
"""

CURATED_TAGS = {
    # ===== MEDICAL SPECIALTIES =====
    "Medical Specialties": [
        "Cardiology", "Neurology", "Oncology", "Gastroenterology", "Nephrology",
        "Pulmonology", "Endocrinology", "Rheumatology", "Hematology", "Dermatology",
        "Urology", "Ophthalmology", "Otolaryngology", "Orthopedics", "Psychiatry",
        "Radiology", "Pathology", "Anesthesiology", "Emergency Medicine", "Surgery",
        "Pediatrics", "Geriatrics", "Obstetrics", "Gynecology", "Infectious Disease",
        "Immunology", "Allergy", "Critical Care", "Palliative Care", "Sports Medicine",
        "Rehabilitation Medicine", "Sleep Medicine", "Pain Management", "Transplantation",
    ],
    
    # ===== MAJOR DISEASES & CONDITIONS =====
    "Cardiovascular": [
        "Atherosclerosis", "Myocardial Infarction", "Heart Failure", "Arrhythmia",
        "Hypertension", "Coronary Artery Disease", "Stroke", "Thrombosis",
        "Cardiomyopathy", "Valvular Heart Disease", "Peripheral Artery Disease",
    ],
    
    "Cancer Types": [
        "Breast Cancer", "Lung Cancer", "Colorectal Cancer", "Prostate Cancer",
        "Leukemia", "Lymphoma", "Melanoma", "Pancreatic Cancer", "Ovarian Cancer",
        "Glioblastoma", "Hepatocellular Carcinoma", "Gastric Cancer", "Renal Cell Carcinoma",
        "Bladder Cancer", "Thyroid Cancer", "Multiple Myeloma", "Neuroblastoma",
    ],
    
    "Neurological": [
        "Alzheimer Disease", "Parkinson Disease", "Multiple Sclerosis", "Epilepsy",
        "Amyotrophic Lateral Sclerosis", "Huntington Disease", "Migraine",
        "Neuropathy", "Dementia", "Brain Injury", "Spinal Cord Injury",
        "Cerebrovascular Disease", "Neurodegenerative Disease",
    ],
    
    "Metabolic & Endocrine": [
        "Diabetes Mellitus", "Type 1 Diabetes", "Type 2 Diabetes", "Obesity",
        "Metabolic Syndrome", "Thyroid Disorder", "Osteoporosis", "Hyperlipidemia",
        "Insulin Resistance", "Diabetic Nephropathy", "Diabetic Retinopathy",
    ],
    
    "Infectious Diseases": [
        "Tuberculosis", "Malaria", "HIV", "Hepatitis", "Influenza", "Sepsis",
        "Pneumonia", "Meningitis", "Bacterial Infection", "Viral Infection",
        "Fungal Infection", "Antibiotic Resistance", "Antimicrobial Resistance",
    ],
    
    "Autoimmune & Inflammatory": [
        "Rheumatoid Arthritis", "Systemic Lupus Erythematosus", "Inflammatory Bowel Disease",
        "Crohn Disease", "Ulcerative Colitis", "Psoriasis", "Celiac Disease",
        "Sjogren Syndrome", "Scleroderma", "Vasculitis", "Autoimmunity",
    ],
    
    "Respiratory": [
        "Asthma", "Chronic Obstructive Pulmonary Disease", "Pulmonary Fibrosis",
        "Cystic Fibrosis", "Lung Disease", "Respiratory Failure", "Sleep Apnea",
    ],
    
    "Renal": [
        "Chronic Kidney Disease", "Acute Kidney Injury", "Renal Failure",
        "Glomerulonephritis", "Polycystic Kidney Disease", "Nephrotic Syndrome",
    ],
    
    # ===== MOLECULAR & CELLULAR BIOLOGY =====
    "Gene Regulation": [
        "Gene Expression", "Transcription", "Translation", "Epigenetics",
        "DNA Methylation", "Histone Modification", "Chromatin Remodeling",
        "Transcription Factor", "Gene Silencing", "Alternative Splicing",
    ],
    
    "RNA Biology": [
        "mRNA", "microRNA", "miRNA", "lncRNA", "Long Noncoding RNA",
        "siRNA", "circRNA", "RNA Processing", "RNA Splicing", "RNA Interference",
        "RNA-Binding Protein", "RNA Stability", "RNA Transport",
    ],
    
    "Protein Biology": [
        "Protein Folding", "Protein Degradation", "Ubiquitination", "Proteasome",
        "Autophagy", "Post-Translational Modification", "Protein-Protein Interaction",
        "Proteomics", "Proteostasis", "Chaperone Protein",
    ],
    
    "Cell Signaling": [
        "Signal Transduction", "Kinase", "Phosphorylation", "MAPK Pathway",
        "PI3K-AKT Pathway", "Wnt Signaling", "Notch Signaling", "Hedgehog Signaling",
        "TGF-beta Signaling", "JAK-STAT Pathway", "NF-kappa B", "G Protein",
        "Receptor Tyrosine Kinase", "Second Messenger",
    ],
    
    "Cell Biology": [
        "Cell Cycle", "Apoptosis", "Cell Death", "Necrosis", "Ferroptosis",
        "Cell Proliferation", "Cell Differentiation", "Stem Cell", "Progenitor Cell",
        "Cell Migration", "Cell Adhesion", "Cytoskeleton", "Mitochondria",
        "Endoplasmic Reticulum", "Golgi Apparatus", "Lysosome", "Peroxisome",
        "Cell Membrane", "Extracellular Matrix", "Cell Junction",
    ],
    
    # ===== STRESS & CELLULAR RESPONSES =====
    "Cellular Stress": [
        "Oxidative Stress", "ROS", "Reactive Oxygen Species", "Oxidative Damage",
        "Antioxidant", "ER Stress", "Endoplasmic Reticulum Stress", "Unfolded Protein Response",
        "Heat Shock Response", "DNA Damage Response", "UV Radiation", "UV Light",
        "Radiation Damage", "Hypoxia", "Ischemia", "Metabolic Stress",
    ],
    
    # ===== IMMUNOLOGY =====
    "Immune System": [
        "Immune Response", "Innate Immunity", "Adaptive Immunity", "T Cell",
        "B Cell", "NK Cell", "Natural Killer Cell", "Dendritic Cell", "Macrophage",
        "Neutrophil", "Cytokine", "Chemokine", "Interleukin", "Interferon",
        "Antibody", "Immunoglobulin", "MHC", "Antigen Presentation",
        "Immune Checkpoint", "Immunotherapy", "Inflammation", "Cytokine Storm",
    ],
    
    # ===== GENETICS & GENOMICS =====
    "Genomics": [
        "Genome", "Genomics", "Genome-Wide Association Study", "GWAS", "Exome",
        "Whole Genome Sequencing", "Whole Exome Sequencing", "Genomic Instability",
        "Copy Number Variation", "Single Nucleotide Polymorphism", "SNP",
        "Genetic Variant", "Mutation", "Somatic Mutation", "Germline Mutation",
    ],
    
    "Genetic Technologies": [
        "CRISPR", "CRISPR-Cas9", "Gene Editing", "Genome Editing", "Gene Therapy",
        "RNA Sequencing", "RNA-seq", "Single-Cell RNA-seq", "scRNA-seq",
        "ChIP-seq", "ATAC-seq", "Hi-C", "Spatial Transcriptomics",
    ],
    
    # ===== RESEARCH METHODS & TECHNOLOGIES =====
    "Omics Technologies": [
        "Genomics", "Transcriptomics", "Proteomics", "Metabolomics", "Lipidomics",
        "Epigenomics", "Metagenomics", "Multi-Omics", "Systems Biology",
    ],
    
    "Imaging & Microscopy": [
        "Microscopy", "Fluorescence Microscopy", "Confocal Microscopy",
        "Super-Resolution Microscopy", "Electron Microscopy", "Live-Cell Imaging",
        "In Vivo Imaging", "MRI", "Magnetic Resonance Imaging", "PET Scan",
        "CT Scan", "Ultrasound", "Optical Imaging",
    ],
    
    "Molecular Techniques": [
        "PCR", "qPCR", "Western Blot", "ELISA", "Flow Cytometry",
        "Mass Spectrometry", "Chromatography", "Electrophoresis",
        "Immunohistochemistry", "In Situ Hybridization", "Northern Blot",
        "Southern Blot", "Cloning", "Mutagenesis",
    ],
    
    "Model Systems": [
        "Animal Model", "Mouse Model", "Zebrafish", "Drosophila", "C. elegans",
        "Cell Culture", "Primary Cell", "Cell Line", "Organoid", "3D Culture",
        "Patient-Derived Xenograft", "Transgenic", "Knockout Mouse",
    ],
    
    # ===== BIOINFORMATICS & COMPUTATIONAL =====
    "Bioinformatics": [
        "Bioinformatics", "Computational Biology", "Sequence Analysis",
        "Phylogenetics", "Structural Bioinformatics", "Network Analysis",
        "Gene Ontology", "Pathway Analysis", "Differential Expression",
        "Machine Learning", "Deep Learning", "Artificial Intelligence",
        "Data Mining", "Big Data", "Biostatistics", "Statistical Analysis",
    ],
    
    # ===== PHARMACOLOGY & THERAPEUTICS =====
    "Drug Development": [
        "Drug Discovery", "Drug Development", "Clinical Trial", "Pharmacokinetics",
        "Pharmacodynamics", "Drug Target", "Small Molecule", "Antibody Therapy",
        "Monoclonal Antibody", "Biologics", "Vaccine", "Immunization",
        "Drug Resistance", "Adverse Drug Reaction", "Toxicology",
    ],
    
    "Therapeutic Approaches": [
        "Chemotherapy", "Radiotherapy", "Targeted Therapy", "Precision Medicine",
        "Personalized Medicine", "Cell Therapy", "CAR-T Cell", "Stem Cell Therapy",
        "Regenerative Medicine", "Tissue Engineering", "Nanomedicine",
    ],
    
    # ===== NEUROSCIENCE =====
    "Neuroscience": [
        "Neuroscience", "Neuroplasticity", "Synaptic Plasticity", "Synapse",
        "Neuron", "Neurotransmitter", "Dopamine", "Serotonin", "GABA", "Glutamate",
        "Action Potential", "Neural Circuit", "Brain Development", "Neurogenesis",
        "Learning and Memory", "Cognition", "Behavior", "Circadian Rhythm",
    ],
    
    # ===== DEVELOPMENTAL BIOLOGY =====
    "Development": [
        "Developmental Biology", "Embryogenesis", "Organogenesis", "Morphogenesis",
        "Cell Fate", "Lineage Tracing", "Pattern Formation", "Tissue Development",
    ],
    
    # ===== AGING & LONGEVITY =====
    "Aging": [
        "Aging", "Senescence", "Cellular Senescence", "Longevity", "Lifespan",
        "Age-Related Disease", "Telomere", "Telomerase", "Mitochondrial Dysfunction",
    ],
    
    # ===== MICROBIOME =====
    "Microbiome": [
        "Microbiome", "Gut Microbiome", "Microbiota", "Metagenomics",
        "Microbial Community", "Dysbiosis", "Probiotic", "Prebiotic",
    ],
    
    # ===== METABOLISM =====
    "Metabolism": [
        "Metabolism", "Metabolic Pathway", "Glycolysis", "TCA Cycle",
        "Oxidative Phosphorylation", "Fatty Acid Metabolism", "Amino Acid Metabolism",
        "Glucose Metabolism", "Lipid Metabolism", "Mitochondrial Metabolism",
        "Metabolic Reprogramming", "Warburg Effect",
    ],
    
    # ===== PUBLIC HEALTH & EPIDEMIOLOGY =====
    "Public Health": [
        "Public Health", "Epidemiology", "Clinical Epidemiology", "Prevalence",
        "Incidence", "Risk Factor", "Biomarker", "Screening", "Prevention",
        "Health Policy", "Global Health", "Maternal Health", "Child Health",
    ],
    
    # ===== CLINICAL MEDICINE =====
    "Clinical Research": [
        "Clinical Trial", "Randomized Controlled Trial", "Cohort Study",
        "Case-Control Study", "Meta-Analysis", "Systematic Review",
        "Evidence-Based Medicine", "Diagnosis", "Prognosis", "Treatment Outcome",
        "Quality of Life", "Patient Safety", "Healthcare", "Telemedicine",
    ],
}


def get_all_curated_tags():
    """Return all curated tags as a flat list with their categories."""
    tags_with_categories = []
    for category, tags in CURATED_TAGS.items():
        for tag in tags:
            tags_with_categories.append({
                'category': category,
                'tag': tag
            })
    return tags_with_categories


def get_tag_count():
    """Return total count of curated tags."""
    return sum(len(tags) for tags in CURATED_TAGS.values())


if __name__ == "__main__":
    tags = get_all_curated_tags()
    print(f"Total curated tags: {get_tag_count()}")
    print(f"\nCategories: {len(CURATED_TAGS)}")
    print("\nTag distribution:")
    for category, tag_list in CURATED_TAGS.items():
        print(f"  {category}: {len(tag_list)} tags")
