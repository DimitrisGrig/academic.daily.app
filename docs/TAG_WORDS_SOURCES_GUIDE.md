# Tag Words Sources for PubMed Recommendation System

## Overview

This guide explains all the data sources used to collect tag words for user interest profiling in your academic article recommendation system.

## 🎯 Core Sources (Currently Implemented)

### 1. **MeSH (Medical Subject Headings)** ⭐⭐⭐⭐⭐

**Status**: ✅ Implemented  
**Coverage**: ~30,000+ terms  
**Source**: National Library of Medicine

- **What**: Official indexing vocabulary for PubMed/MEDLINE
- **Why Essential**: Every PubMed article is manually tagged with MeSH terms
- **Files**:
  - `desc2025.xml` - Main descriptors
  - `supp2025.xml` - Supplementary concepts (drugs, protocols)
- **Download**: https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/
- **Update Frequency**: Annual

**Perfect match for your use case!** MeSH terms directly correspond to PubMed indexing.

---

## 🧬 Genetics & Genomics Sources

### 2. **HGNC Gene Names** ⭐⭐⭐⭐⭐

**Status**: 🔄 Optional (commented out)  
**Coverage**: ~40,000+ genes + aliases  
**Source**: HUGO Gene Nomenclature Committee

- **What**: Official human gene symbols and names
- **Why Important**: Critical for genomics, molecular biology, genetics papers
- **File**: `hgnc_complete_set.txt` (TSV format)
- **Download**: https://www.genenames.org/download/archive/
- **Update Frequency**: Monthly
- **Cost**: Free

**Recommendation**: Uncomment if users work with genes/proteins!

### 3. **Gene Ontology (GO)** ⭐⭐⭐⭐⭐

**Status**: ✅ Implemented  
**Coverage**: ~45,000+ terms  
**Source**: Gene Ontology Consortium

- **What**: Standardized vocabulary for gene functions, processes, locations
- **Categories**:
  - Biological Process (e.g., "cell division", "immune response")
  - Molecular Function (e.g., "kinase activity", "DNA binding")
  - Cellular Component (e.g., "nucleus", "mitochondria")
- **File**: `go-basic.obo`
- **Download**: http://purl.obolibrary.org/obo/go/go-basic.obo
- **Update Frequency**: Weekly
- **Cost**: Free

**Highly recommended!** Excellent for molecular biology & biochemistry papers.

---

## 🏥 Disease & Clinical Sources

### 4. **Disease Ontology (DO)** ⭐⭐⭐⭐

**Status**: ✅ Implemented  
**Coverage**: ~10,000+ diseases  
**Source**: Disease Ontology Consortium

- **What**: Hierarchical classification of human diseases
- **Why Important**: Captures disease names, synonyms, relationships
- **File**: `doid.obo`
- **Download**: https://github.com/DiseaseOntology/HumanDiseaseOntology/raw/main/src/ontology/doid.obo
- **Update Frequency**: Monthly
- **Cost**: Free

**Great for clinical medicine papers!**

### 5. **ClinicalTrials.gov Conditions** ⭐⭐⭐⭐

**Status**: ✅ Implemented (curated subset)  
**Coverage**: ~200 major conditions  
**Source**: Manual curation + ClinicalTrials.gov

- **What**: Common medical conditions from clinical trials
- **Why Important**: User-friendly disease names (e.g., "Type 2 Diabetes" vs complex ontology terms)
- **Current**: Hardcoded list of ~200 major conditions
- **Enhancement**: Could scrape from https://clinicaltrials.gov/data-api/api

**Good coverage of practical clinical terms!**

---

## 💊 Drug & Treatment Sources

### 6. **DrugBank** ⭐⭐⭐⭐

**Status**: ✅ Fallback list implemented  
**Coverage**: ~500 common drugs/classes  
**Source**: DrugBank (commercial) or curated list

- **What**: Comprehensive drug database with names, synonyms, targets
- **Why Important**: Pharmacology, clinical trials, treatment papers
- **File**: `drugbank_vocabulary.csv`
- **Download**: https://go.drugbank.com/releases/latest
- **Update Frequency**: Quarterly
- **Cost**: Free academic license (requires signup)

**Alternatives**:

- **RxNorm** (NLM): https://www.nlm.nih.gov/research/umls/rxnorm/
- **PubChem**: https://pubchem.ncbi.nlm.nih.gov/
- **ChEMBL**: https://www.ebi.ac.uk/chembl/

### 7. **Common Drug Classes** ⭐⭐⭐

**Status**: ✅ Implemented  
**Coverage**: ~60 drug classes + examples  
**Source**: Manual curation

- **What**: Major drug categories (antibiotics, immunotherapy, etc.)
- **Why Important**: Covers general pharmacology without needing full database
- **Maintenance**: Update with emerging therapies (e.g., GLP-1 agonists, checkpoint inhibitors)

---

## 🔬 Research Methods & Techniques

### 8. **Omics Technologies** ⭐⭐⭐⭐⭐

**Status**: ✅ Implemented & Expanded  
**Coverage**: ~60+ techniques  
**Source**: Manual curation

- **What**: Modern experimental methods (RNA-seq, CRISPR, proteomics)
- **Why Essential**: Users interested in specific methodologies
- **Categories**:
  - Sequencing (RNA-seq, ATAC-seq, single-cell)
  - Gene editing (CRISPR, base editing)
  - Mass spec (proteomics, metabolomics)
  - Imaging (microscopy, flow cytometry)

**Critical for methods-focused researchers!**

### 9. **Research Techniques Library** ⭐⭐⭐⭐

**Status**: ✅ Implemented  
**Coverage**: ~100+ techniques  
**Source**: Manual curation

- **What**: Broad experimental approaches across disciplines
- **Categories**:
  - Molecular biology (PCR, Western blot, ELISA)
  - Imaging (microscopy, MRI, PET)
  - Model systems (mouse models, organoids, cell culture)
  - Data analysis (machine learning, bioinformatics)

**Excellent coverage of practical research methods!**

---

## 🫀 Anatomy & Cell Biology Sources

### 10. **Anatomy Terms** ⭐⭐⭐⭐

**Status**: ✅ Implemented  
**Coverage**: ~100+ anatomical terms  
**Source**: Manual curation

- **What**: Major organs, tissues, cell types, organ systems
- **Why Important**: Tissue-specific research (e.g., "liver cancer", "brain development")
- **Enhancement Option**: UBERON (cross-species anatomy ontology)
  - Download: http://purl.obolibrary.org/obo/uberon.obo
  - Coverage: ~15,000+ terms across species

**Good foundation; UBERON adds comprehensive coverage if needed.**

---

## 🔄 Biological Pathways & Processes

### 11. **Curated Pathways** ⭐⭐⭐⭐

**Status**: ✅ Implemented  
**Coverage**: ~80+ major pathways  
**Source**: Manual curation

- **What**: Key signaling pathways, metabolic processes, cellular mechanisms
- **Categories**:
  - Signaling (MAPK, PI3K-AKT, NF-kB)
  - Metabolism (glycolysis, TCA cycle, fatty acid metabolism)
  - Cellular processes (cell cycle, apoptosis, autophagy)
  - Immune processes (inflammation, T cell activation)

**Enhancement Options**:

- **KEGG Pathways**: https://www.genome.jp/kegg/pathway.html (commercial license)
- **Reactome**: https://reactome.org/download-data (free, ~2,500 pathways)
- **WikiPathways**: https://www.wikipathways.org/index.php/Download_Pathways (free, ~3,000 pathways)

**Good coverage; Reactome/WikiPathways add depth if needed.**

---

## 📊 Recommended Implementation Priority

### Tier 1: Essential (Already Have)

1. ✅ **MeSH Descriptors + Supplementary** - Core PubMed vocabulary
2. ✅ **Curated Clinical Conditions** - User-friendly disease names
3. ✅ **Research Techniques** - Methods-focused discovery
4. ✅ **Anatomy Terms** - Tissue/organ specificity

### Tier 2: High Value (Easy Additions)

5. 🔄 **Gene Ontology (GO)** - Download go-basic.obo (~30 MB)
6. 🔄 **Disease Ontology (DO)** - Download doid.obo (~5 MB)
7. 🔄 **HGNC Genes** - Download if users work with genetics

### Tier 3: Enhanced Coverage (If Needed)

8. 🔄 **Reactome Pathways** - For systems biology users
9. 🔄 **DrugBank** - For pharmacology focus
10. 🔄 **UBERON Anatomy** - For cross-species comparative work

---

## 🚀 Quick Start Guide

### Step 1: Download Core Files (Required)

```bash
# MeSH (already have)
wget https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/desc2025.xml
wget https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/supp2025.xml
```

### Step 2: Download Recommended Files (5 minutes)

```bash
# Gene Ontology
wget http://purl.obolibrary.org/obo/go/go-basic.obo

# Disease Ontology
wget https://github.com/DiseaseOntology/HumanDiseaseOntology/raw/main/src/ontology/doid.obo
```

### Step 3: Optional Enhancements

```bash
# HGNC Genes (requires manual download + free account)
# Visit: https://www.genenames.org/download/archive/

# Reactome Pathways
wget https://reactome.org/download/current/ReactomePathways.txt

# DrugBank (requires free academic account)
# Visit: https://go.drugbank.com/releases/latest
```

### Step 4: Run the Script

```bash
python gather_major_tag_wrods.py
```

**Expected Output**: 40,000-60,000+ unique terms (depending on optional files)

---

## 💡 Additional Enhancement Ideas

### 1. **PubMed MeSH Statistics**

Mine PubMed for most frequently used MeSH terms in the last 5 years:

```python
# Use Entrez API to get term frequencies
from Bio import Entrez
```

### 2. **Journal Categories**

Add high-level journal categories (Nature categories, Scopus ASJC codes):

- Neuroscience
- Immunology
- Cell Biology
- Computational Biology

### 3. **Trending Terms**

Periodically update with emerging terms:

- COVID-19 (added during pandemic)
- Long COVID
- mRNA vaccines
- AlphaFold
- Large language models in medicine

### 4. **User-Submitted Terms**

Allow users to add custom tags, aggregate popular ones.

### 5. **Abbreviation Expansion**

Add common abbreviations:

- GWAS → Genome-Wide Association Study
- SNP → Single Nucleotide Polymorphism
- RCT → Randomized Controlled Trial

---

## 📈 Expected Coverage by Category

| Category                | # Terms | Completeness | Source                             |
| ----------------------- | ------- | ------------ | ---------------------------------- |
| Medical Subjects (MeSH) | ~30,000 | ⭐⭐⭐⭐⭐   | desc2025.xml + supp2025.xml        |
| Gene Ontology           | ~45,000 | ⭐⭐⭐⭐⭐   | go-basic.obo                       |
| Diseases                | ~10,000 | ⭐⭐⭐⭐     | doid.obo + curated                 |
| Human Genes             | ~40,000 | ⭐⭐⭐⭐⭐   | hgnc_complete_set.txt              |
| Drugs                   | ~500    | ⭐⭐⭐       | curated (⭐⭐⭐⭐⭐ with DrugBank) |
| Research Methods        | ~150    | ⭐⭐⭐⭐     | curated                            |
| Anatomy                 | ~100    | ⭐⭐⭐       | curated (⭐⭐⭐⭐⭐ with UBERON)   |
| Pathways                | ~80     | ⭐⭐⭐       | curated (⭐⭐⭐⭐⭐ with Reactome) |

**Total (with recommended files)**: 60,000-80,000 unique terms

---

## 🎯 Best Practices for Your Use Case

### 1. **Term Weighting**

Not all terms are equally useful for recommendations:

- **High weight**: Specific diseases, techniques, pathways
- **Medium weight**: General processes, anatomy
- **Low weight**: Very broad terms (e.g., "research", "analysis")

### 2. **Hierarchical Organization**

Consider grouping terms by category in UI:

```
🧬 Genetics & Genomics
  - CRISPR-Cas9
  - RNA-seq
  - Single-cell sequencing

🏥 Diseases & Conditions
  - Cancer
    - Breast Cancer
    - Lung Cancer
  - Neurodegenerative Diseases
    - Alzheimer's Disease
    - Parkinson's Disease
```

### 3. **Smart Suggestions**

When user types, suggest:

- Exact matches
- Partial matches
- Related terms (using MeSH tree hierarchy)

### 4. **Popular Tags**

Show most commonly selected tags by other users.

### 5. **Multi-term Combinations**

Allow users to combine terms:

- "Breast Cancer" + "Immunotherapy" + "Clinical Trial"
- Creates highly specific embedding vector

---

## 🔄 Maintenance Schedule

| Task                    | Frequency | Effort   |
| ----------------------- | --------- | -------- |
| Update MeSH files       | Annual    | 5 min    |
| Update GO               | Quarterly | 5 min    |
| Update Disease Ontology | Quarterly | 5 min    |
| Add trending terms      | Monthly   | 15 min   |
| Review user feedback    | Ongoing   | Variable |

---

## 📚 Official Documentation Links

- **MeSH**: https://www.nlm.nih.gov/mesh/
- **Gene Ontology**: http://geneontology.org/
- **Disease Ontology**: https://disease-ontology.org/
- **HGNC**: https://www.genenames.org/
- **DrugBank**: https://go.drugbank.com/
- **Reactome**: https://reactome.org/
- **PubChem**: https://pubchem.ncbi.nlm.nih.gov/
- **UBERON**: http://uberon.github.io/

---

## ✅ Conclusion

Your current script has an **excellent foundation** with MeSH (the gold standard for PubMed). The enhanced version adds:

1. **60,000-80,000 total terms** (up from ~30,000)
2. **Better coverage** of diseases, genes, drugs, methods
3. **User-friendly terms** (clinical conditions, drug names)
4. **Easy extensibility** with optional ontology files

**Recommendation**:

- Run with current implementation (MeSH + curated terms) → **40,000+ terms**
- Download GO + DO ontologies → **80,000+ terms**
- Optionally add HGNC genes if users work with genomics → **120,000+ terms**

All sources are **free for academic use** and align perfectly with PubMed indexing! 🎯
