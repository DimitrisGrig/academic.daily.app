#!/bin/bash

# Download script for optional ontology files
# These files enhance the tag words collection significantly

echo "=========================================="
echo "TAG WORDS DATA DOWNLOADER"
echo "=========================================="
echo ""

# Create data directory
mkdir -p ontology_data
cd ontology_data

echo "📥 Downloading Gene Ontology (GO)..."
echo "   Source: Gene Ontology Consortium"
echo "   Size: ~30 MB"
wget -q --show-progress http://purl.obolibrary.org/obo/go/go-basic.obo
if [ $? -eq 0 ]; then
    echo "   ✅ Downloaded: go-basic.obo"
else
    echo "   ❌ Failed to download GO"
fi
echo ""

echo "📥 Downloading Disease Ontology (DO)..."
echo "   Source: Disease Ontology Consortium"
echo "   Size: ~5 MB"
wget -q --show-progress https://github.com/DiseaseOntology/HumanDiseaseOntology/raw/main/src/ontology/doid.obo
if [ $? -eq 0 ]; then
    echo "   ✅ Downloaded: doid.obo"
else
    echo "   ❌ Failed to download DO"
fi
echo ""

echo "📥 Downloading Reactome Pathways (optional)..."
echo "   Source: Reactome"
echo "   Size: ~2 MB"
wget -q --show-progress https://reactome.org/download/current/ReactomePathways.txt
if [ $? -eq 0 ]; then
    echo "   ✅ Downloaded: ReactomePathways.txt"
else
    echo "   ❌ Failed to download Reactome"
fi
echo ""

echo "📥 Downloading UBERON Anatomy Ontology (optional, large)..."
echo "   Source: UBERON"
echo "   Size: ~60 MB"
echo "   Note: This is a large file. Press Ctrl+C to skip."
sleep 2
wget -q --show-progress http://purl.obolibrary.org/obo/uberon.obo
if [ $? -eq 0 ]; then
    echo "   ✅ Downloaded: uberon.obo"
else
    echo "   ❌ Failed to download UBERON"
fi
echo ""

# Move files to parent directory
echo "📦 Moving files to parent directory..."
mv *.obo ../ 2>/dev/null
mv *.txt ../ 2>/dev/null
cd ..
rmdir ontology_data 2>/dev/null

echo ""
echo "=========================================="
echo "✅ DOWNLOAD COMPLETE"
echo "=========================================="
echo ""
echo "Downloaded files:"
ls -lh *.obo *.txt 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "📋 Manual Downloads Required (free account needed):"
echo ""
echo "1. HGNC Gene Names:"
echo "   → Visit: https://www.genenames.org/download/archive/"
echo "   → Download: hgnc_complete_set.txt"
echo "   → Place in: $(pwd)"
echo ""
echo "2. DrugBank Vocabulary:"
echo "   → Visit: https://go.drugbank.com/releases/latest"
echo "   → Create free academic account"
echo "   → Download: drugbank vocabulary.csv"
echo "   → Place in: $(pwd)"
echo ""
echo "💡 You can now run: python gather_major_tag_wrods.py"
echo ""
