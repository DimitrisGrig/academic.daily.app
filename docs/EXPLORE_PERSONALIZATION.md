# Explore Page Personalization# Explore Page Personalization

## Overview## Overview

The Explore page has been updated to show **personalized articles based on user embeddings** instead of returning all articles from the database. The personalization is automatic for authenticated users with embeddings.

The Explore page has been updated to show personalized articles based on user embeddings instead of returning all articles from the database.

## Changes Made

## Changes Made

### Backend Changes (`backend/routers/explore.py`)

### Backend Changes (`backend/routers/explore.py`)

1. **Added Imports**

   - `search_similar_articles` from `vector_store.FAISS`1. **Added Imports**

   - `numpy` for array operations

   - `search_similar_articles` from `vector_store.FAISS`

2. **Personalization Logic** - `numpy` for array operations

   - When a user is authenticated and has embeddings:

     - Retrieves user's feed embeddings from the `Feeds` table2. **Personalization Logic**

     - Uses FAISS vector search to find articles similar to user's interests - When a user is authenticated and has embeddings:

     - Leverages cached FAISS results (24-hour cache) for performance - Retrieves user's feed embeddings from the `Feeds` table

     - Filters the article query to only include personalized articles - Uses FAISS vector search to find articles similar to user's interests

       - Leverages cached FAISS results (24-hour cache) for performance

3. **Fallback Behavior** - Filters the article query to only include personalized articles

   - If user is not authenticated or has no embeddings, shows all articles (original behavior)3. **Fallback Behavior**

   - This ensures the explore page works for both logged-in and guest users

   - If user is not authenticated or has no embeddings, shows all articles (original behavior)

4. **Similarity Scores** - This ensures the explore page works for both logged-in and guest users

   - Each article now includes a `similarity_score` field (0.0 to 1.0)

   - Represents how relevant the article is to the user's interests4. **Similarity Scores**

   - Score of 0.0 for non-authenticated users or articles without embeddings - Each article now includes a `similarity_score` field (0.0 to 1.0)

   - Represents how relevant the article is to the user's interests

### Frontend Changes (`frontend/src/pages/Explore.tsx`) - Score of 0.0 for non-authenticated users or articles without embeddings

1. **Updated Page Description**### Frontend Changes (`frontend/src/pages/Explore.tsx`)

   - Changed from "Discover trending research articles from the academic community"

   - To "Discover research articles personalized to your interests"1. **New Sort Option: "For You"**

2. **Sort Buttons (4 buttons)** - Added "relevance" as a sort type (default)

   - Popular (by clicks) - Default - Sorts articles by similarity score when selected

   - By upvotes - Shows the most relevant articles first based on user's interests

   - By comments

   - By date2. **Sort Button Order**

3. **Removed "For You" Button** - "For You" button is now first (personalized recommendations)

   - Personalization is now **automatic** - no need for a separate button - Followed by Popular, By upvotes, By comments, By date

   - All sort options work on the personalized article set

4. **Client-Side Sorting**

## How It Works - When "For You" is selected, articles are sorted by `similarity_score` on the frontend

- Other sort options use backend sorting as before

### For Authenticated Users with Embeddings:

1. User's interests are represented as a 768-dimensional embedding vector## How It Works

2. FAISS index performs similarity search to find matching articles (~5000 results)

3. Results are cached for 24 hours to improve performance### For Authenticated Users with Embeddings:

4. These personalized articles can then be sorted by:

   - **Popular**: By click count (default)1. User's interests are represented as a 768-dimensional embedding vector

   - **By upvotes**: By community upvotes2. FAISS index performs similarity search to find matching articles

   - **By comments**: By discussion activity3. Results are cached for 24 hours to improve performance

   - **By date**: By publication date4. Articles can be sorted by:

   - **For You**: Personalized by similarity to user interests (default)

### For Non-Authenticated or New Users: - **Popular**: By click count

- Shows all articles from the database - **By upvotes**: By community upvotes

- Sorting options work as before - **By comments**: By discussion activity

- Same UI, but without personalization - **By date**: By publication date

## Performance Optimizations### For Non-Authenticated or New Users:

1. **FAISS Cache**: Results are cached for 24 hours to avoid expensive re-computation- Shows all articles from the database

2. **Reuses Main Feed Cache**: Uses the same cached results as the main feed- Sorting options work as before

3. **Efficient Filtering**: Database query is filtered before sorting/limiting- "For You" button still appears but behaves like "Popular" sorting

## Benefits## Performance Optimizations

- ✅ **Automatic Personalization**: No need for users to select "For You" - it's always personalized1. **FAISS Cache**: Results are cached for 24 hours to avoid expensive re-computation

- ✅ **Improved Discovery**: Users see articles relevant to their interests2. **Reuses Main Feed Cache**: Uses the same cached results as the main feed

- ✅ **Flexible Sorting**: Users can still sort personalized results by traditional metrics3. **Efficient Filtering**: Database query is filtered before sorting/limiting

- ✅ **Performance**: Caching ensures fast response times

- ✅ **Backward Compatible**: Works for both authenticated and guest users## Benefits

## Technical Details- ✅ **Personalized Discovery**: Users see articles relevant to their interests

- ✅ **Improved Engagement**: More relevant content = more engagement

### FAISS Configuration- ✅ **Flexible Sorting**: Users can still sort by traditional metrics

- Index Type: Flat (for explore, up to 5000 results)- ✅ **Performance**: Caching ensures fast response times

- Metric: Inner Product (Cosine Similarity)- ✅ **Backward Compatible**: Works for both authenticated and guest users

- Embeddings: BioBERT 768-dimensional vectors

- Cache Duration: 24 hours## Technical Details

### Database Schema### FAISS Configuration

The implementation uses existing database tables:

- `feeds`: Stores user embeddings and FAISS cache- Index Type: Flat (for explore, up to 5000 results)

- `articles`: Main article data- Metric: Inner Product (Cosine Similarity)

- `wos_journals_clarivate_rankings`: Journal impact factors- Embeddings: BioBERT 768-dimensional vectors

- `scimagojr_rankings`: Journal rankings- Cache Duration: 24 hours

## User Experience Flow### Database Schema

1. **User logs in** → Completes onboarding → Selects interestsThe implementation uses existing database tables:

2. **System generates** → User embedding vector from their interests

3. **FAISS computes** → ~5000 most relevant articles (cached for 24h)- `feeds`: Stores user embeddings and FAISS cache

4. **User visits Explore** → Sees personalized articles sorted by popularity- `articles`: Main article data

5. **User can sort** → By upvotes, comments, or date to find what they want- `wos_journals_clarivate_rankings`: Journal impact factors

- `scimagojr_rankings`: Journal rankings

## Future Enhancements

## Future Enhancements

Potential improvements:

1. Add a filter to show only high-similarity articles (e.g., score > 0.5)Potential improvements:

2. Display similarity indicators on article cards for transparency

3. Allow users to refresh/update their personalization1. Add a filter to show only high-similarity articles (e.g., score > 0.5)

4. Add "Discover More" to temporarily show non-personalized articles2. Implement hybrid sorting (combine similarity with popularity)

5. A/B test different default sort options3. Add visual indicators for similarity scores on article cards

6. Allow users to refine their interests directly from Explore page
7. A/B test different default sort options
