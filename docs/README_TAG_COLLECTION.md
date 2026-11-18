# Tag Words Collection System - Quick Reference

## 📝 Overview

This system collects comprehensive biomedical vocabulary for building user interest profiles in your PubMed article recommendation system.

## 🚀 Quick Start

### Option 1: Basic Setup (5 minutes)

Uses only the files you already have:

```bash
python gather_major_tag_wrods.py
```

**Output**: ~40,000 terms (MeSH + curated lists)

### Option 2: Enhanced Setup (10 minutes)

Download additional free ontologies:

```bash
./download_ontologies.sh
python gather_major_tag_wrods.py
```

**Output**: ~80,000+ terms (includes GO, Disease Ontology, etc.)

## 📊 Data Sources Summary

| Source             | Terms   | Status      | Priority      |
| ------------------ | ------- | ----------- | ------------- |
| MeSH Descriptors   | ~30,000 | ✅ Have     | **Essential** |
| MeSH Supplementary | ~5,000  | ✅ Have     | **Essential** |
| Curated Clinical   | ~200    | ✅ Built-in | High          |
| Curated Techniques | ~150    | ✅ Built-in | High          |
| Gene Ontology      | ~45,000 | 🔄 Optional | High          |
| Disease Ontology   | ~10,000 | 🔄 Optional | High          |
| HGNC Genes         | ~40,000 | 🔄 Optional | Medium        |
| DrugBank           | ~14,000 | 🔄 Optional | Medium        |

## 📁 Files in This Directory

- **`gather_major_tag_wrods.py`** - Main collection script (enhanced version)
- **`download_ontologies.sh`** - Auto-download optional ontologies
- **`tag_collection_config.ini`** - Configuration file
- **`TAG_WORDS_SOURCES_GUIDE.md`** - Comprehensive documentation
- **`README_TAG_COLLECTION.md`** - This file

## 🎯 Key Improvements Made

### Before (Original Script)

- ✅ MeSH descriptors
- ✅ MeSH supplementary
- ❌ Limited omics terms (~16 terms)
- ❌ No disease ontology
- ❌ No gene ontology
- ❌ No drug database
- ❌ Basic anatomy coverage

**Total**: ~30,000 terms

### After (Enhanced Script)

- ✅ MeSH descriptors
- ✅ MeSH supplementary
- ✅ Extended omics (~60 techniques)
- ✅ Disease Ontology integration
- ✅ Gene Ontology integration
- ✅ Clinical conditions (~200 curated)
- ✅ Drug classes & examples (~500)
- ✅ Comprehensive anatomy (~100 terms)
- ✅ Research techniques (~150 methods)
- ✅ Biological pathways (~80 major pathways)
- ✅ Better organization & statistics

**Total**: 40,000-80,000+ terms (depending on optional files)

## 💡 Recommended Sources for PubMed

### ⭐⭐⭐⭐⭐ Must Have (Already Included)

1. **MeSH** - Official PubMed indexing vocabulary
2. **Curated Clinical Terms** - User-friendly disease names

### ⭐⭐⭐⭐ Highly Recommended (Easy to Add)

3. **Gene Ontology** - Biological processes, molecular functions
4. **Disease Ontology** - Comprehensive disease classification
5. **Research Techniques** - Methods-focused users

### ⭐⭐⭐ Nice to Have

6. **HGNC Genes** - For genetics researchers
7. **DrugBank** - For pharmacology focus
8. **Reactome** - For systems biology

## 🔧 Usage Examples

### Example 1: Run with defaults

```bash
python gather_major_tag_wrods.py
```

### Example 2: Download optional files first

```bash
./download_ontologies.sh
python gather_major_tag_wrods.py
```

### Example 3: Check output

```bash
wc -l all_tag_words.txt
head -20 all_tag_words.txt
tail -20 all_tag_words.txt
```

## 📈 Expected Results

### With Current Files Only:

```
📚 Loading Core PubMed Vocabulary...
MeSH descriptors + entry terms: ~30,000
Supplementary concepts: ~5,000

🏥 Loading Disease & Condition Terms...
Clinical conditions: 200

🔧 Loading Research Methods...
Omics terms: 60
Research techniques: 150

💾 Saving ~40,000 total tag words
```

### With Optional Downloads:

```
📚 Loading Core PubMed Vocabulary...
MeSH descriptors + entry terms: ~30,000
Supplementary concepts: ~5,000

🔬 Loading Biological Processes...
Gene Ontology terms: ~45,000

🏥 Loading Disease & Condition Terms...
Disease Ontology terms: ~10,000
Clinical conditions: 200

💾 Saving ~80,000+ total tag words
```

## 🎨 Frontend Integration Ideas

### 1. Hierarchical Tag Selection

```typescript
// Group tags by category
interface TagCategory {
  name: string;
  tags: string[];
  icon: string;
}

const categories: TagCategory[] = [
  {
    name: "Diseases & Conditions",
    tags: ["Breast Cancer", "Alzheimer's Disease", ...],
    icon: "🏥"
  },
  {
    name: "Research Methods",
    tags: ["RNA-seq", "CRISPR", "Mass Spectrometry", ...],
    icon: "🔬"
  },
  // ... more categories
];
```

### 2. Smart Search with Autocomplete

```typescript
// As user types, suggest matching tags
const suggestions = searchTags(userInput, allTags);
```

### 3. Popular Tags Display

```typescript
// Show most commonly selected tags by users
const popularTags = getTopTags(limit: 20);
```

### 4. Multi-select with Preview

```typescript
// Show how many articles match current selection
const matchCount = getArticleCount(selectedTags);
```

## 🔄 Maintenance

### Annual Updates (5 minutes)

```bash
# Update MeSH
wget https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/desc2025.xml
wget https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/supp2025.xml

# Re-run collection
python gather_major_tag_wrods.py
```

### Quarterly Updates (10 minutes)

```bash
# Update all ontologies
./download_ontologies.sh
python gather_major_tag_wrods.py
```

## 📚 Additional Resources

- **Detailed Documentation**: See `TAG_WORDS_SOURCES_GUIDE.md`
- **MeSH Browser**: https://meshb.nlm.nih.gov/
- **PubMed Search**: Test tags at https://pubmed.ncbi.nlm.nih.gov/
- **Gene Ontology**: http://geneontology.org/
- **Disease Ontology**: https://disease-ontology.org/

## 🆘 Troubleshooting

### Issue: "File not found" errors

**Solution**: The script gracefully handles missing optional files. Only MeSH files are required.

### Issue: Download script fails

**Solution**: Check internet connection. Try manual downloads from links in `TAG_WORDS_SOURCES_GUIDE.md`

### Issue: Too many/few terms

**Solution**: Edit `tag_collection_config.ini` to enable/disable specific sources

### Issue: Terms too technical for users

**Solution**: Focus on curated lists (clinical conditions, drug classes). Optionally create a "simplified" version with only user-friendly terms.

## 💭 Design Considerations for Your App

### User Experience

1. **Progressive Disclosure**: Start with broad categories, drill down to specific terms
2. **Smart Defaults**: Suggest popular tags based on user's field
3. **Visual Feedback**: Show how each tag affects recommendations
4. **Easy Refinement**: Allow users to update interests anytime

### Technical

1. **Embedding Generation**: Use concatenated tags (comma-separated works well)
2. **Similarity Threshold**: Consider minimum similarity score for recommendations
3. **Tag Weighting**: Some tags more specific than others (e.g., "CRISPR" vs "Research")
4. **Multi-tag Logic**: AND vs OR combinations

### Performance

1. **Caching**: Cache user embeddings (already implemented!)
2. **Batch Processing**: Pre-compute embeddings for all tags
3. **Index Updates**: Refresh FAISS index when new articles added

## ✅ Summary

You now have:

- ✅ **Enhanced collection script** with 10+ data sources
- ✅ **Auto-download script** for optional ontologies
- ✅ **Comprehensive documentation** of all sources
- ✅ **Configuration system** for customization
- ✅ **40,000-80,000 high-quality terms** perfectly aligned with PubMed

**Your original script was already great with MeSH!** These enhancements add breadth and depth while maintaining quality.

## 🎯 Next Steps

1. ✅ Run `python gather_major_tag_wrods.py` to generate tags
2. ✅ Integrate tags into your onboarding UI
3. ✅ Test embedding generation with combined tags
4. ✅ Monitor which tags users select most frequently
5. ✅ Gather user feedback and refine tag list

Good luck with your recommendation system! 🚀
