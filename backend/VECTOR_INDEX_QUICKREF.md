# Quick Reference: Topics Table Management

## Daily Operations - NO ACTION NEEDED! ✅

### Adding Topics

```python
# Index updates automatically
new_topic = Topics(subtopic="New Topic", broadtopic="Category", embeddings=[...])
db.add(new_topic)
db.commit()
```

### Deleting Topics

```python
# Index updates automatically
db.query(Topics).filter(Topics.id == topic_id).delete()
db.commit()
```

### Updating Topics

```python
# Index updates automatically
topic = db.query(Topics).filter(Topics.id == topic_id).first()
topic.embeddings = new_embeddings
db.commit()
```

---

## Maintenance Operations - Run As Needed 🔧

### Check Index Health

```bash
python3 manage_vector_index.py --stats
```

**When**: Anytime you want to check status

### Rebuild Index

```bash
python3 manage_vector_index.py --rebuild
```

**When**:

- After bulk operations (1000+ topics added/deleted)
- Search feels slower than usual
- After changing many topics over time

### Optimize Index

```bash
python3 manage_vector_index.py --vacuum
```

**When**:

- Weekly/monthly routine maintenance
- After many small updates
- Query planner seems off

---

## Rules of Thumb

| Operation           | Index Action                   | Performance Impact     |
| ------------------- | ------------------------------ | ---------------------- |
| Add 1-10 topics     | Auto-updates                   | Negligible             |
| Add 100s of topics  | Auto-updates                   | Slight (~1-2s total)   |
| Add 1000+ topics    | Auto-updates, then **rebuild** | Consider rebuild after |
| Delete any amount   | Auto-updates                   | Same as above          |
| Daily small changes | Auto-updates                   | No rebuild needed      |

---

## Example Workflow

### Bulk Import

```bash
# 1. Import topics in your Python script
python3 import_new_topics.py  # adds 5000 topics

# 2. Rebuild index for optimal performance
python3 manage_vector_index.py --rebuild

# 3. Check results
python3 manage_vector_index.py --stats
```

### Regular Maintenance (Optional)

```bash
# Once per month or when you notice slower searches
python3 manage_vector_index.py --vacuum
```

---

## TL;DR

**For 99% of operations**: Just add/delete topics normally. The index handles itself!

**Only rebuild**: After very large bulk operations (1000+ topics at once)
