# MeSH Terms Extraction System

## Overview

This system automatically extracts MeSH (Medical Subject Headings) terms from articles in the database and adds them as topics with embeddings. This enriches the Topics table with real-world terms from your article collection.

## How It Works

### Extraction Logic

The system follows the same logic as the frontend article modal display:

1. **Split Terms**: Split `Articles.mesh_terms` field on semicolon (`;`)
2. **Clean Terms**: For each term:
   - Take only the first part before `/`
   - Example: `"Bacteria* / isolation & purification"` → `"Bacteria"`
   - Remove asterisk (`*`) from major topics
   - Example: `"Bacteria*"` → `"Bacteria"`
3. **Filter**: Remove duplicates and very short terms (<3 chars)
4. **Validate**: Skip terms that contain `/` in the final result
5. **Add to Database**: Create Topics entries with category `"MeSH Terms"`

### Example Transformations

```
Raw MeSH Term                          → Cleaned Term
----------------------------------------|-------------------
"Adult"                                 → "Adult"
"B-Cell Activating Factor*"             → "B-Cell Activating Factor"
"Hepatitis, Autoimmune* / complications"→ "Hepatitis, Autoimmune"
"Drug Therapy, Combination"             → "Drug Therapy, Combination"
"Humans"                                → "Humans"
```

## Files

### Core Files

- **`backend/extract_mesh_to_topics.py`**: Main extraction logic

  - `extract_mesh_terms_from_text()`: Parses and cleans MeSH terms
  - `add_mesh_terms_to_topics()`: Adds terms to database
  - `extract_mesh_terms_job()`: Scheduler job function

- **`backend/routers/scheduler_jobs.py`**: Scheduler configuration
  - Runs daily at 3:00 AM
  - Processes articles added in last 24 hours

## Usage

### Manual Execution

```bash
# Dry run to preview (no database changes)
python backend/extract_mesh_to_topics.py --dry-run

# Process specific number of articles
python backend/extract_mesh_to_topics.py --limit 100

# Process all articles
python backend/extract_mesh_to_topics.py --all
```

### Scheduled Execution

The system runs automatically every day at **3:00 AM** via the APScheduler:

```python
# In scheduler_jobs.py
scheduler.add_job(
    func=extract_mesh_terms_job,
    trigger='cron',
    hour=3,
    minute=0
)
```

The scheduled job:

- Processes articles created in the last 24 hours
- Extracts MeSH terms from `Articles.mesh_terms`
- Adds new unique terms to `Topics` table
- Skips duplicates automatically
- Logs statistics to console

## Database Impact

### Initial Run Results

```
📊 Statistics:
   • Articles processed: 16,273
   • MeSH terms extracted: 170,004
   • Unique terms found: 10,146
   • New terms added: 9,931
   • Duplicates skipped: 215

📊 Database Growth:
   • Before: 764 topics
   • After: 10,695 topics
   • Growth: +9,931 MeSH terms
```

### Topics Table Structure

```sql
CREATE TABLE topics (
    id SERIAL PRIMARY KEY,
    broadtopic VARCHAR,        -- "MeSH Terms" for extracted terms
    subtopic VARCHAR,           -- The cleaned MeSH term
    embeddings VECTOR(768)     -- BioBERT embedding
);
```

### Sample MeSH Terms Added

```
Medical Terms:
  • Humans
  • Adult
  • Female
  • Male
  • Middle Aged
  • Aged

Diseases:
  • Hepatitis, Autoimmune
  • Liver Cirrhosis
  • Fatty Liver
  • Hypertension, Portal

Techniques:
  • Machine Learning
  • Biopsy
  • Logistic Models
  • Drug Therapy, Combination

Molecular:
  • B-Cell Activating Factor
  • Immunosuppressive Agents
```

## Benefits

1. **Automatic Enrichment**: Database grows with real content from articles
2. **No Duplicates**: System checks existing topics before adding
3. **Quality Control**: Filters out invalid terms (with `/`, too short, etc.)
4. **Embeddings**: Each term gets BioBERT embedding for similarity search
5. **Onboarding**: Users can select from real MeSH terms in their articles
6. **Search**: Fuzzy search works across all MeSH terms
7. **Recommendations**: Better tag suggestions based on actual article topics

## Monitoring

### Check Scheduler Status

The scheduler logs to console when running:

```
[2025-12-30 03:00:00] Starting scheduled MeSH terms extraction...
   Found 45 new articles with MeSH terms
   Added 23 new terms from 45 articles
[2025-12-30 03:00:15] Scheduled MeSH extraction complete
```

### Query Database

```python
from database import get_local_db
from models import Topics

db = next(get_local_db())

# Count MeSH terms
mesh_count = db.query(Topics).filter(
    Topics.broadtopic == 'MeSH Terms'
).count()

print(f"MeSH Terms in database: {mesh_count}")

# Get recent additions (if you track timestamps)
recent = db.query(Topics).filter(
    Topics.broadtopic == 'MeSH Terms'
).order_by(Topics.id.desc()).limit(10).all()

for term in recent:
    print(f"  • {term.subtopic}")
```

## Maintenance

### Re-run Full Extraction

If you need to reprocess all articles:

```bash
# Preview first
python backend/extract_mesh_to_topics.py --all --dry-run

# Execute
python backend/extract_mesh_to_topics.py --all
```

### Clear MeSH Terms

If you need to remove all extracted MeSH terms:

```sql
DELETE FROM topics WHERE broadtopic = 'MeSH Terms';
```

Then re-run the extraction script.

## Configuration

### Change Schedule Time

Edit `backend/routers/scheduler_jobs.py`:

```python
# Run at 2:30 AM instead
scheduler.add_job(
    func=extract_mesh_terms_job,
    trigger='cron',
    hour=2,     # Hour (0-23)
    minute=30   # Minute (0-59)
)
```

### Change Processing Window

Edit `backend/extract_mesh_to_topics.py`:

```python
# Process last 48 hours instead of 24
yesterday = datetime.now() - timedelta(days=2)
```

## Troubleshooting

### No New Terms Added

Check if:

1. Articles have `mesh_terms` field populated
2. Terms aren't already in database
3. Scheduler is running (check console logs)

### Duplicate Prevention

The system automatically:

- Queries existing topics before adding
- Uses set operations to filter duplicates
- Skips terms that already exist

### Error Handling

- Individual term errors are caught and logged
- Batch commits every 50 terms
- Database rollback on error
- Process continues even if some terms fail

## Performance

- **Processing Speed**: ~100 articles/second
- **Batch Size**: 50 terms per commit
- **Memory**: Minimal (processes articles sequentially)
- **Embedding Generation**: ~0.1 second per term

### Optimization Tips

For large batches (>10,000 articles):

- Run during off-peak hours (default: 3 AM)
- Monitor database connection pool
- Consider increasing batch size for faster commits

## Future Enhancements

Possible improvements:

- Track term frequency across articles
- Weight terms by article impact factor
- Add term relationships (parent/child MeSH hierarchy)
- Deduplicate similar terms using embeddings
- Filter by term importance (major topics only)
