import xml.etree.ElementTree as ET
import csv
import json
import requests
from pathlib import Path

OUTPUT_FILE = "all_tag_words.txt"
CACHE_DIR = Path("tag_data_cache")


def load_mesh_descriptors(desc_xml):
    terms = set()
    tree = ET.parse(desc_xml)
    root = tree.getroot()

    for record in root.findall("DescriptorRecord"):
        # Main MeSH term
        main = record.find("DescriptorName/String").text
        terms.add(main)

        # Entry terms (synonyms)
        entry_list = record.find("ConceptList")
        if entry_list is not None:
            for concept in entry_list.findall("Concept"):
                for term in concept.findall("TermList/Term/String"):
                    terms.add(term.text)

    print(f"MeSH descriptors + entry terms: {len(terms)}")
    return terms


def load_mesh_supplementary(supp_xml):
    terms = set()
    tree = ET.parse(supp_xml)
    root = tree.getroot()

    for record in root.findall("SupplementalRecord"):
        name = record.find("SupplementalRecordName/String")
        if name is not None:
            terms.add(name.text)

        # Synonyms
        for concept in record.findall("ConceptList/Concept"):
            for term in concept.findall("TermList/Term/String"):
                terms.add(term.text)

    print(f"Supplementary concepts: {len(terms)}")
    return terms


def load_hgnc_genes(hgnc_file):
    terms = set()

    with open(hgnc_file, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")

        for row in reader:
            # Approved symbol
            if row.get("symbol"):
                terms.add(row["symbol"])

            # Approved name
            if row.get("name"):
                terms.add(row["name"])

            # Aliases
            for col in ["alias_symbol", "alias_name", "prev_symbol"]:
                if row.get(col):
                    for alias in row[col].split("|"):
                        terms.add(alias)

    print(f"HGNC genes + aliases: {len(terms)}")
    return terms


def load_omics_terms():
    # Curated list – expand anytime
    return {
        "RNA-seq",
        "ATAC-seq",
        "ChIP-seq",
        "Single-cell RNA-seq",
        "scRNA-seq",
        "Spatial transcriptomics",
        "Whole genome sequencing",
        "Whole exome sequencing",
        "CRISPR-Cas9",
        "Proteomics",
        "Metabolomics",
        "Epigenomics",
        "DNA methylation",
        "Hi-C",
        "CUT&RUN",
        "CUT&Tag",
        "10x Genomics",
        "Nanopore sequencing",
        "PacBio sequencing",
        "Mass spectrometry",
        "Flow cytometry",
        "CyTOF",
        "Immunofluorescence",
        "Western blot",
        "ELISA",
        "qPCR",
        "Microarray",
    }


def load_disease_ontology(do_file="doid.obo"):
    """
    Load Human Disease Ontology (DO)
    Download from: https://disease-ontology.org/
    File: doid.obo
    """
    terms = set()
    
    if not Path(do_file).exists():
        print(f"⚠️  Disease Ontology file not found: {do_file}")
        print("   Download from: https://github.com/DiseaseOntology/HumanDiseaseOntology/raw/main/src/ontology/doid.obo")
        return terms
    
    with open(do_file, 'r', encoding='utf-8') as f:
        current_name = None
        for line in f:
            line = line.strip()
            if line.startswith("name:"):
                current_name = line.split("name:", 1)[1].strip()
                terms.add(current_name)
            elif line.startswith("synonym:") and current_name:
                # Extract synonym from quotes
                if '"' in line:
                    synonym = line.split('"')[1]
                    terms.add(synonym)
    
    print(f"Disease Ontology terms: {len(terms)}")
    return terms


def load_go_terms(go_file="go-basic.obo"):
    """
    Load Gene Ontology (GO) terms
    Download from: http://geneontology.org/docs/download-ontology/
    File: go-basic.obo
    """
    terms = set()
    
    if not Path(go_file).exists():
        print(f"⚠️  Gene Ontology file not found: {go_file}")
        print("   Download from: http://purl.obolibrary.org/obo/go/go-basic.obo")
        return terms
    
    with open(go_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith("name:"):
                name = line.split("name:", 1)[1].strip()
                terms.add(name)
            elif line.startswith("synonym:"):
                if '"' in line:
                    synonym = line.split('"')[1]
                    terms.add(synonym)
    
    print(f"Gene Ontology terms: {len(terms)}")
    return terms


def load_clinicaltrials_conditions():
    """
    Load common conditions from ClinicalTrials.gov
    Uses a curated list of major medical conditions
    """
    # Top medical conditions from ClinicalTrials.gov and medical literature
    conditions = {
        # Cancer types
        "Breast Cancer", "Lung Cancer", "Prostate Cancer", "Colorectal Cancer",
        "Melanoma", "Leukemia", "Lymphoma", "Brain Tumor", "Pancreatic Cancer",
        "Ovarian Cancer", "Bladder Cancer", "Kidney Cancer", "Liver Cancer",
        "Thyroid Cancer", "Gastric Cancer", "Esophageal Cancer",
        
        # Cardiovascular
        "Heart Failure", "Coronary Artery Disease", "Myocardial Infarction",
        "Atrial Fibrillation", "Stroke", "Hypertension", "Arrhythmia",
        "Cardiomyopathy", "Atherosclerosis", "Peripheral Artery Disease",
        
        # Neurological
        "Alzheimer's Disease", "Parkinson's Disease", "Multiple Sclerosis",
        "Epilepsy", "Migraine", "Amyotrophic Lateral Sclerosis", "Dementia",
        "Traumatic Brain Injury", "Spinal Cord Injury", "Neuropathy",
        
        # Metabolic/Endocrine
        "Type 2 Diabetes", "Type 1 Diabetes", "Obesity", "Metabolic Syndrome",
        "Hyperthyroidism", "Hypothyroidism", "Osteoporosis", "PCOS",
        
        # Autoimmune/Inflammatory
        "Rheumatoid Arthritis", "Lupus", "Crohn's Disease", "Ulcerative Colitis",
        "Psoriasis", "Inflammatory Bowel Disease", "Celiac Disease",
        "Scleroderma", "Sjogren's Syndrome",
        
        # Respiratory
        "Asthma", "COPD", "Pulmonary Fibrosis", "Pneumonia", "Tuberculosis",
        "Cystic Fibrosis", "Sleep Apnea",
        
        # Infectious Diseases
        "HIV", "COVID-19", "Influenza", "Hepatitis B", "Hepatitis C",
        "Malaria", "Sepsis", "Bacterial Infection", "Viral Infection",
        
        # Mental Health
        "Depression", "Anxiety", "Schizophrenia", "Bipolar Disorder",
        "PTSD", "Autism Spectrum Disorder", "ADHD", "Eating Disorders",
        
        # Kidney/Renal
        "Chronic Kidney Disease", "Acute Kidney Injury", "Nephrotic Syndrome",
        "Glomerulonephritis", "Polycystic Kidney Disease",
        
        # Other
        "Septic Shock", "Transplant Rejection", "Graft-versus-Host Disease",
        "Anemia", "Thrombosis", "Hemophilia", "Sickle Cell Disease",
    }
    
    print(f"Clinical conditions: {len(conditions)}")
    return conditions


def load_drug_names(drugbank_file="drugbank_vocabulary.csv"):
    """
    Load drug names from DrugBank or RxNorm
    DrugBank: https://go.drugbank.com/releases/latest
    Alternative: Use PubChem or ChEMBL
    """
    terms = set()
    
    if not Path(drugbank_file).exists():
        print(f"⚠️  DrugBank file not found: {drugbank_file}")
        print("   Download from: https://go.drugbank.com/releases/latest (requires free account)")
        print("   Or use common_drugs list below")
        
        # Fallback: Common drug classes and examples
        common_drugs = {
            # Drug classes
            "Antibiotics", "Antivirals", "Antifungals", "Antiparasitics",
            "Chemotherapy", "Immunotherapy", "Targeted Therapy",
            "Monoclonal Antibodies", "Checkpoint Inhibitors",
            "Beta Blockers", "ACE Inhibitors", "Statins", "Anticoagulants",
            "NSAIDs", "Corticosteroids", "Immunosuppressants",
            "Antidepressants", "Antipsychotics", "Anticonvulsants",
            "Insulin", "Metformin", "GLP-1 Agonists", "SGLT2 Inhibitors",
            "Proton Pump Inhibitors", "H2 Blockers",
            
            # Common drugs
            "Aspirin", "Ibuprofen", "Acetaminophen", "Warfarin",
            "Metformin", "Insulin", "Atorvastatin", "Lisinopril",
            "Pembrolizumab", "Nivolumab", "Rituximab", "Trastuzumab",
            "Paclitaxel", "Cisplatin", "Doxorubicin", "Tamoxifen",
        }
        terms |= common_drugs
    
    print(f"Drug terms: {len(terms)}")
    return terms


def load_anatomy_terms():
    """
    Load anatomical terms - could expand with UBERON ontology
    """
    anatomy = {
        # Major organs
        "Heart", "Lung", "Liver", "Kidney", "Brain", "Pancreas",
        "Spleen", "Stomach", "Intestine", "Colon", "Bladder",
        "Prostate", "Ovary", "Uterus", "Testis", "Thyroid",
        
        # Tissues
        "Epithelium", "Endothelium", "Mesenchyme", "Connective Tissue",
        "Muscle Tissue", "Nerve Tissue", "Adipose Tissue",
        
        # Cell types
        "T Cell", "B Cell", "NK Cell", "Macrophage", "Neutrophil",
        "Dendritic Cell", "Monocyte", "Eosinophil", "Basophil",
        "Stem Cell", "Fibroblast", "Keratinocyte", "Hepatocyte",
        "Neuron", "Astrocyte", "Microglia", "Oligodendrocyte",
        "Cardiomyocyte", "Endothelial Cell", "Epithelial Cell",
        
        # Systems
        "Cardiovascular System", "Respiratory System", "Nervous System",
        "Immune System", "Digestive System", "Endocrine System",
        "Musculoskeletal System", "Reproductive System", "Urinary System",
    }
    
    print(f"Anatomy terms: {len(anatomy)}")
    return anatomy


def load_pathways_and_processes():
    """
    Load common biological pathways and molecular processes
    Could expand with KEGG, Reactome, WikiPathways
    """
    pathways = {
        # Signaling pathways
        "MAPK Signaling", "PI3K-AKT Pathway", "mTOR Pathway",
        "JAK-STAT Pathway", "NF-kB Pathway", "Wnt Signaling",
        "Notch Signaling", "Hedgehog Signaling", "TGF-beta Signaling",
        "EGFR Signaling", "VEGF Signaling", "Apoptosis",
        
        # Metabolic pathways
        "Glycolysis", "Gluconeogenesis", "TCA Cycle", "Oxidative Phosphorylation",
        "Fatty Acid Metabolism", "Amino Acid Metabolism", "Nucleotide Metabolism",
        
        # Cellular processes
        "Cell Cycle", "DNA Replication", "DNA Repair", "Transcription",
        "Translation", "Protein Folding", "Autophagy", "Endocytosis",
        "Exocytosis", "Cell Migration", "Cell Adhesion", "Cell Differentiation",
        "Cell Proliferation", "Senescence", "Necrosis", "Ferroptosis",
        
        # Immune processes
        "Innate Immunity", "Adaptive Immunity", "Inflammation",
        "Cytokine Signaling", "Antigen Presentation", "T Cell Activation",
        "B Cell Activation", "Complement Activation",
    }
    
    print(f"Pathways & processes: {len(pathways)}")
    return pathways


def load_research_techniques():
    """
    Modern research methodologies and techniques
    """
    techniques = {
        # Molecular biology
        "PCR", "RT-PCR", "qPCR", "Gel Electrophoresis", "Northern Blot",
        "Southern Blot", "Western Blot", "ELISA", "Immunohistochemistry",
        "Immunofluorescence", "Flow Cytometry", "Cell Sorting",
        
        # Sequencing
        "RNA-seq", "DNA-seq", "ChIP-seq", "ATAC-seq", "Bisulfite Sequencing",
        "Single-cell Sequencing", "Spatial Transcriptomics", "Long-read Sequencing",
        "Metagenomics", "16S rRNA Sequencing",
        
        # Imaging
        "Microscopy", "Confocal Microscopy", "Two-photon Microscopy",
        "Light Sheet Microscopy", "Electron Microscopy", "MRI", "PET Scan",
        "CT Scan", "Ultrasound", "Live Cell Imaging",
        
        # Omics
        "Proteomics", "Metabolomics", "Lipidomics", "Glycomics",
        "Phosphoproteomics", "Epigenomics", "Transcriptomics",
        
        # Gene editing
        "CRISPR", "CRISPR-Cas9", "Base Editing", "Prime Editing",
        "RNA Interference", "Gene Knockout", "Gene Knockdown",
        
        # Model systems
        "Mouse Model", "Cell Culture", "Organoid", "3D Culture",
        "Patient-derived Xenograft", "Zebrafish Model", "Drosophila Model",
        "C. elegans", "In Vitro", "In Vivo", "Ex Vivo",
        
        # Data analysis
        "Machine Learning", "Deep Learning", "Bioinformatics",
        "Systems Biology", "Network Analysis", "Pathway Analysis",
        "Structural Modeling", "Molecular Dynamics",
    }
    
    print(f"Research techniques: {len(techniques)}")
    return techniques


def normalize(term):
    return term.strip()


def is_human_readable(term):
    """
    Filter out overly technical terms that are not user-friendly.
    Returns True if term should be kept, False if it should be filtered out.
    """
    # Skip empty or very short terms
    if not term or len(term) < 2:
        return False
    
    # Filter out terms starting with multiple parentheses (chemical formulas)
    if term.startswith('((') or term.startswith('((('):
        return False
    
    # Filter out terms with excessive special characters (likely chemical formulas)
    special_char_count = sum(1 for c in term if c in '()[]{}@#$%^&*+=<>|\\')
    if special_char_count > len(term) * 0.3:  # More than 30% special chars
        return False
    
    # Filter out terms with multiple consecutive numbers and special chars (e.g., "((11)C)PIB")
    if term.count(')(') > 2 or term.count('((') > 0:
        return False
    
    # Filter out very long chemical nomenclature (IUPAC names)
    # These often have multiple hyphens, numbers, and are very long
    if len(term) > 80 and term.count('-') > 5:
        return False
    
    # Filter out terms that are mostly numbers and punctuation
    alphanumeric = sum(1 for c in term if c.isalnum())
    if alphanumeric < len(term) * 0.5:  # Less than 50% alphanumeric
        return False
    
    # Filter out radioisotope compounds (e.g., "((18)F)FDDNP", "((11)C)PIB")
    if '(' in term and ')' in term and any(iso in term for iso in ['11)C', '18)F', '123)I', '125)I', '131)I', '68)Ga', '177)Lu', '90)Y', '99m)Tc', '14)C', '3)H']):
        return False
    
    # Filter out terms with excessive nested parentheses
    max_nesting = 0
    current_nesting = 0
    for c in term:
        if c == '(':
            current_nesting += 1
            max_nesting = max(max_nesting, current_nesting)
        elif c == ')':
            current_nesting -= 1
    if max_nesting > 3:
        return False
    
    # Filter out terms that look like systematic chemical names
    # (contain multiple chemical prefixes)
    chemical_prefixes = ['methyl', 'ethyl', 'propyl', 'butyl', 'pentyl', 'hexyl', 
                        'heptyl', 'octyl', 'nonyl', 'decyl', 'chloro', 'fluoro', 
                        'bromo', 'iodo', 'hydroxy', 'amino', 'carbonyl', 'oxy', 
                        'phenyl', 'benzyl', 'thio', 'sulfonyl', 'phospho']
    
    term_lower = term.lower()
    prefix_count = sum(1 for prefix in chemical_prefixes if prefix in term_lower)
    
    # If term has many chemical prefixes and is long, it's likely IUPAC nomenclature
    if prefix_count > 4 and len(term) > 50:
        return False
    
    # Filter out terms with stereochemistry notation (e.g., "(1R,2S,3R)")
    if term.count('(') > 3 and any(x in term for x in ['R)', 'S)', 'E)', 'Z)', 'alpha', 'beta']):
        return False
    
    return True


def clean_term(term):
    """
    Clean and simplify terms to make them more readable.
    """
    # Remove leading/trailing whitespace
    term = term.strip()
    
    # Remove quotes if term is entirely quoted
    if term.startswith("'") and term.endswith("'"):
        term = term[1:-1]
    
    # Simplify some common patterns
    # E.g., "RNA-seq" instead of variations
    
    return term


def main():
    print("=" * 60)
    print("COLLECTING TAG WORDS FOR PUBMED RECOMMENDATION SYSTEM")
    print("=" * 60)
    print()
    
    all_terms = set()

    # === Core PubMed Sources (Required) ===
    print("📚 Loading Core PubMed Vocabulary...")
    all_terms |= load_mesh_descriptors("desc2025.xml")
    all_terms |= load_mesh_supplementary("supp2025.xml")
    print()
    
    # === Gene/Protein Sources ===
    print("🧬 Loading Gene & Protein Data...")
    # Uncomment if you have the HGNC file (download from: https://www.genenames.org/download/archive/)
    # all_terms |= load_hgnc_genes("hgnc_complete_set.txt")
    print()
    
    # === Disease & Condition Sources ===
    print("🏥 Loading Disease & Condition Terms...")
    all_terms |= load_disease_ontology("doid.obo")  # Optional: download if available
    all_terms |= load_clinicaltrials_conditions()
    print()
    
    # === Biological Process Sources ===
    print("🔬 Loading Biological Processes...")
    all_terms |= load_go_terms("go-basic.obo")  # Optional: download if available
    all_terms |= load_pathways_and_processes()
    print()
    
    # === Drug & Treatment Sources ===
    print("💊 Loading Drug & Treatment Terms...")
    all_terms |= load_drug_names("drugbank_vocabulary.csv")  # Optional
    print()
    
    # === Research Methods & Techniques ===
    print("🔧 Loading Research Methods...")
    all_terms |= load_omics_terms()
    all_terms |= load_research_techniques()
    print()
    
    # === Anatomy & Cell Types ===
    print("🫀 Loading Anatomy Terms...")
    all_terms |= load_anatomy_terms()
    print()

    # === Normalize & clean ===
    print("🧹 Cleaning and normalizing terms...")
    
    # First pass: normalize
    all_terms = {normalize(t) for t in all_terms if t}
    
    # Second pass: filter for readability
    print(f"   Before readability filter: {len(all_terms):,} terms")
    all_terms = {clean_term(t) for t in all_terms if is_human_readable(t)}
    print(f"   After readability filter: {len(all_terms):,} terms")
    
    # Filter out terms shorter than 2 characters
    all_terms = {t for t in all_terms if t and len(t) > 1}
    
    # Remove overly generic terms
    stopwords = {"the", "and", "or", "of", "in", "to", "a", "is", "for", "with", "at", "by"}
    all_terms = {t for t in all_terms if t.lower() not in stopwords}

    # === Save ===
    print(f"\n💾 Saving {len(all_terms):,} total tag words to {OUTPUT_FILE}")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for term in sorted(all_terms):
            f.write(term + "\n")

    print("\n" + "=" * 60)
    print("✅ COMPLETE! Tag words ready for recommendation system")
    print("=" * 60)
    print()
    
    # === Statistics ===
    print("📊 Statistics:")
    print(f"   Total unique terms: {len(all_terms):,}")
    print(f"   Average term length: {sum(len(t) for t in all_terms) / len(all_terms):.1f} characters")
    print(f"   Output file: {OUTPUT_FILE}")
    print()
    
    print("💡 Tips:")
    print("   - Download optional ontology files for more comprehensive coverage")
    print("   - Gene Ontology: http://purl.obolibrary.org/obo/go/go-basic.obo")
    print("   - Disease Ontology: https://github.com/DiseaseOntology/HumanDiseaseOntology")
    print("   - HGNC Genes: https://www.genenames.org/download/archive/")
    print("   - DrugBank: https://go.drugbank.com/releases/latest")


if __name__ == "__main__":
    main()

