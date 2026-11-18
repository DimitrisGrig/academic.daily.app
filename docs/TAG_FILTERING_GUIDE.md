# Tag Words Filtering - Technical Details

## Problem: Overly Technical Chemical Names

MeSH includes highly technical IUPAC chemical nomenclature that's not user-friendly:

**Examples of filtered terms:**

- `((11)C)PIB` - Radiotracer compound
- `(((1R)-(1alpha(Z),2beta(1E,3R*),3alpha,5alpha))-7-(3,5-dihydroxy-2-(3-hydroxy-4-(3-trifluoromethyl)phenoxy)-1-butenyl)cyclopentyl)-5-heptenoic acid` - Complex IUPAC name
- `3 alpha,7 alpha,12 alpha-trihydroxy-5 beta-cholestan-26-oic acid` - Steroid nomenclature

## Solution: Two-Tier Filtering System

### Tier 1: Basic Filtering (all_tag_words.txt)

Applied during initial collection in `gather_major_tag_wrods.py`:

```python
def is_human_readable(term):
    # Filters out:
    # - Terms starting with (( or (((
    # - Radioisotope compounds ((11)C, (18)F, etc.)
    # - Excessive special characters (>30%)
    # - Excessive nested parentheses (>3 levels)
    # - Very long IUPAC names (>80 chars with >5 hyphens)
    # - Terms with excessive chemical prefixes
```

**Result:** ~1,175,000 terms (filtered 28,000 worst offenders)

### Tier 2: User-Friendly Subset (user_friendly_tags.txt)

Created by `create_user_friendly_subset.py`:

```python
def is_highly_readable(term):
    # Additionally filters out:
    # - Greek letters (alpha, beta, gamma, etc.)
    # - Excessive hyphens (>3)
    # - Steroid nomenclature
    # - Complex number+letter patterns
    # - Very long terms (>40 chars unless priority keyword)

    # Prioritizes terms with keywords:
    # - Diseases: cancer, diabetes, syndrome, etc.
    # - Techniques: RNA-seq, CRISPR, microscopy, etc.
    # - Anatomy: cell, tissue, brain, heart, etc.
    # - Processes: signaling, metabolism, regulation, etc.
```

**Result:** ~857,000 terms (27% more filtered)

## Recommended Usage

### For User Onboarding UI (Tag Selection)

Use **`user_friendly_tags.txt`**:

- Highly readable terms
- Common diseases, techniques, anatomical terms
- Better UX for non-expert users
- ~857,000 terms

### For Backend Matching/Search

Use **`all_tag_words.txt`**:

- Comprehensive coverage
- Includes technical terms users might search for
- Better recall for article matching
- ~1,175,000 terms

## Examples of What's Kept vs. Filtered

### ✅ Kept (User-Friendly)

- Breast Cancer
- Type 2 Diabetes
- Alzheimer's Disease
- RNA-seq
- CRISPR-Cas9
- Heart Failure
- T Cell
- Apoptosis
- MAPK Signaling
- Immunotherapy

### ⚠️ Kept (All Tags) but Filtered (User-Friendly)

- 3 alpha,7 alpha,12 alpha-trihydroxy-5 beta-cholestan-26-oic acid
- Pregn-4-ene-3,20-dione
- 5-alpha-dihydrotestosterone
- (R)-(-)-2-phenylpropionic acid

### ❌ Filtered (Both)

- ((11)C)PIB
- (((1R)-(1alpha(Z),2beta(1E,3R\*)...)-heptenoic acid
- ((18)F)FDDNP
- ((2,3,7,8,12,13,17,18)-octaethylporphinato)copper (II)

## Implementation in Your App

### Option 1: User-Friendly Only (Recommended for MVP)

```typescript
// Load only user-friendly tags for onboarding
const tags = await loadTags("user_friendly_tags.txt");
```

**Pros:**

- Better UX
- Faster autocomplete
- Less overwhelming for users

**Cons:**

- Might miss some very specific technical interests

### Option 2: Two-Tier System

```typescript
// Primary: user-friendly tags
const primaryTags = await loadTags("user_friendly_tags.txt");

// Allow advanced users to search all tags
const allTags = await loadTags("all_tag_words.txt");

// UI: Show primaryTags by default
// UI: Add "Show advanced terms" toggle for allTags
```

**Pros:**

- Best of both worlds
- Expert users can access technical terms

**Cons:**

- More complex implementation

### Option 3: Category-Based

```typescript
// Group by readability level
const tags = {
  essential: extractEssential(allTags), // ~10,000 most common
  standard: userFriendlyTags, // ~857,000
  advanced: allTags, // ~1,175,000
};

// UI: Progressive disclosure
// Onboarding: Show essential only
// Profile: Allow access to standard
// Advanced: Toggle for all terms
```

## Statistics

| File                     | Terms     | Filtering  | Use Case                            |
| ------------------------ | --------- | ---------- | ----------------------------------- |
| `all_tag_words.txt`      | 1,175,147 | Basic      | Backend matching, search            |
| `user_friendly_tags.txt` | 857,249   | Aggressive | User-facing UI, onboarding          |
| Filtered out (Tier 1)    | ~28,000   | -          | Chemical formulas, radiotracers     |
| Filtered out (Tier 2)    | ~318,000  | -          | Steroid nomenclature, Greek letters |

## Customization

You can adjust filtering strictness in `create_user_friendly_subset.py`:

```python
# Make MORE strict (fewer terms, more readable):
if len(term) > 30:  # Was 40
    return False

# Make LESS strict (more terms, less filtering):
if term.count('-') > 5:  # Was 3
    return False
```

## Maintenance

Re-run both scripts when updating source data:

```bash
# Step 1: Collect all tags with basic filtering
python gather_major_tag_wrods.py

# Step 2: Create user-friendly subset
python create_user_friendly_subset.py
```

Both files stay in sync with your data sources!
