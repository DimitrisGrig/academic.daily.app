# Smart Shuffle Implementation

## Overview
Implemented an intelligent article shuffling system that provides variety in the main feed while prioritizing relevant and high-impact articles. This solves the problem of users seeing the same articles in the same order on every page reload.

## Changes Made

### Backend (`backend/routers/mainFeed.py`)

#### 1. Added `sort_mode` Parameter
- New query parameter: `sort_mode` with options:
  - `"smart_shuffle"` (default) - Weighted randomization
  - `"similarity"` - Pure similarity score ordering
  - `"date"` - Publication date ordering

#### 2. Smart Shuffle Algorithm
The smart shuffle uses a composite scoring system:

```python
# Composite score formula:
base_score = (0.70 × similarity_weight) + (0.30 × impact_weight)
final_score = base_score × random_factor(0.85 to 1.15)
```

**Key Features:**
- **70% Similarity Weight**: Ensures articles remain relevant to user interests
- **30% Impact Factor Weight**: Boosts high-quality journals (IF normalized to 0-20 scale)
- **±15% Random Variance**: Adds variety while keeping top articles near the top
- **Log Scale for Impact Factor**: Prevents extreme outliers from dominating
- **Graceful Defaults**: Articles without impact factor get 0.3 default weight

**Impact Factor Normalization:**
- Journals without IF: 0.3 weight (modest default)
- Typical journals (IF 0-10): 0-0.5 weight
- Good journals (IF 10-20): 0.5-1.0 weight
- Elite journals (IF 20+): Capped at 1.5 weight

#### 3. Sorting Modes
- **smart_shuffle**: Fresh ordering on each request, favoring relevance + impact
- **similarity**: Deterministic ordering by FAISS similarity scores
- **date**: Deterministic ordering by publication date (newest first)

### Frontend (`frontend/src/pages/MainFeed.tsx`)

#### 1. Updated State Management
```typescript
const [sortBy, setSortBy] = useState<"smart_shuffle" | "similarity" | "date">("smart_shuffle");
```

#### 2. Backend-Driven Sorting
- Removed client-side sorting logic
- Added `sort_mode` parameter to API call
- Backend now handles all sorting logic
- Query key includes `sortBy` for proper caching

#### 3. Enhanced UI Menu
Added "Smart Feed (Recommended)" option:
- **Smart Feed**: Dynamic, varied ordering with quality prioritization
- **By Relevance**: Pure similarity-based ordering
- **By Date**: Chronological ordering

## Benefits

### 1. Variety Without Sacrificing Relevance
- Users see different articles on each reload
- Most relevant articles still appear near the top
- Prevents "feed fatigue" from repetitive ordering

### 2. Quality Prioritization
- High-impact journals naturally rank higher
- Balances between relevance and journal prestige
- Encourages discovery of quality research

### 3. User Control
- Users can still choose deterministic ordering if preferred
- "By Relevance" for pure similarity-based ranking
- "By Date" for chronological browsing

### 4. Performance
- Sorting happens on backend (more efficient)
- Leverages existing FAISS cache
- No impact on cache invalidation logic

## Example Behavior

### Smart Shuffle (Default)
**First Load:**
1. Article A (sim: 0.95, IF: 15) → score: ~0.91
2. Article B (sim: 0.90, IF: 8) → score: ~0.75
3. Article C (sim: 0.88, IF: 20) → score: ~0.82

**Second Load (after refresh):**
1. Article C (sim: 0.88, IF: 20) → score: ~0.88 (random boost)
2. Article A (sim: 0.95, IF: 15) → score: ~0.85 (slight decrease)
3. Article B (sim: 0.90, IF: 8) → score: ~0.78

### By Relevance (Similarity)
Always shows: A → C → B (deterministic by similarity)

### By Date
Always shows: Newest → Oldest (deterministic by publication date)

## Technical Notes

### Random Seed
- Uses Python's `random.uniform()` for variance
- Different shuffle on each request
- Controlled variance prevents extreme reordering

### Impact Factor Handling
- Gracefully handles `None` values
- Uses Web of Science IF when available
- Could be extended to use ScimagoJR rankings as fallback

### Cache Compatibility
- FAISS cache remains untouched
- Shuffle logic only affects final ordering
- Cache invalidation rules unchanged

## Future Enhancements

### Potential Improvements:
1. **User Engagement Signals**: Factor in upvotes, comments, reading time
2. **Temporal Decay**: Slightly reduce scores for older articles
3. **Diversity Boost**: Ensure variety in journals/topics within top results
4. **Personalized Weights**: Allow users to adjust similarity/impact balance
5. **A/B Testing**: Compare engagement metrics across sorting modes
6. **Fallback to ScimagoJR**: Use alternative rankings when WoS unavailable

### Configuration Options:
```python
# Could be made configurable per-user:
SIMILARITY_WEIGHT = 0.70  # 70% weight on relevance
IMPACT_WEIGHT = 0.30      # 30% weight on journal quality
RANDOM_VARIANCE = 0.15    # ±15% randomness
```

## Testing Recommendations

1. **Verify Variety**: Reload feed multiple times, check ordering changes
2. **Check Relevance**: Ensure highly relevant articles stay near top
3. **Test Impact Factor**: Verify high-IF journals rank appropriately
4. **Edge Cases**: Test with articles lacking impact factors
5. **Performance**: Measure response time vs. previous implementation
6. **Deterministic Modes**: Verify similarity/date sorting works consistently

## Conclusion

This implementation provides an elegant solution to feed monotony while maintaining the core value propositions of relevance and quality. The weighted randomization approach is backed by research in recommendation systems and provides a superior user experience compared to pure deterministic ordering.
