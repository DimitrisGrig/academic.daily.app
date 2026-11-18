import faiss
import numpy as np
from typing import List, Dict, Any
import os

# GLOBAL CACHE: Load FAISS index once and reuse across all requests
# This prevents memory leaks from loading the index repeatedly
_FAISS_INDEX_CACHE = {}
_FAISS_INDEX_LOCK = None

def _get_lock():
    """Get or create a threading lock for thread-safe index loading"""
    global _FAISS_INDEX_LOCK
    if _FAISS_INDEX_LOCK is None:
        import threading
        _FAISS_INDEX_LOCK = threading.Lock()
    return _FAISS_INDEX_LOCK


def load_faiss_index(index_path: str = None, index_type: str = "hnsw"):
    """
    Load a previously created FAISS index with embedded database IDs.
    Uses global caching to prevent memory leaks from repeated loading.
    
    Args:
        index_path (str): Path to the FAISS index file.
        index_type (str): Type of index to load: "flat", "ivf", "hnsw" (default), or "ivfpq"
        
    Returns:
        faiss.IndexIDMap: The loaded FAISS index with database IDs
    """
    faiss_dir = os.getenv("FAISS_INDEX_DIR")
    
    if index_path is None:
        # Map index type to filename - each type has its own file
        index_files = {
            "flat": "articles_biobert_flat.index",
            "ivf": "articles_biobert_ivf.index",
            "hnsw": "articles_biobert_hnsw.index",
            "ivfpq": "articles_biobert_ivfpq.index",
        }
        
        filename = index_files.get(index_type.lower())
        if not filename:
            raise ValueError(f"Invalid index_type: {index_type}. Must be one of: flat, ivf, hnsw, ivfpq")
        
        index_path = os.path.join(faiss_dir, filename)
    
    # Check if index is already cached (prevents memory leaks)
    cache_key = f"{index_path}_{index_type}"
    if cache_key in _FAISS_INDEX_CACHE:
        # print(f"✅ Using cached FAISS index: {cache_key}")
        return _FAISS_INDEX_CACHE[cache_key]
    
    # Thread-safe loading
    with _get_lock():
        # Double-check after acquiring lock
        if cache_key in _FAISS_INDEX_CACHE:
            return _FAISS_INDEX_CACHE[cache_key]
        
        try:
            # Load FAISS index
            index = faiss.read_index(index_path)
            
            # Get index type name for display
            index_type_name = os.path.basename(index_path).replace("articles_biobert", "").replace(".index", "").replace("_", "").upper() or "FLAT"
            
            # Detect metric type
            metric_type = index.metric_type if hasattr(index, 'metric_type') else (index.index.metric_type if hasattr(index, 'index') else 1)
            metric_name = "Inner Product (Cosine Similarity)" if metric_type == 1 else "L2 Distance"
            
            print(f"✅ Loaded {index_type_name} index from: {index_path}")
            print(f"📊 Index contains {index.ntotal} articles")
            print(f"📏 Metric: {metric_name}")
            
            # Set nprobe for IVF indices if needed
            if hasattr(index, 'index') and isinstance(index.index, faiss.IndexIVF):
                index.index.nprobe = 50  # Search more clusters for better recall
                print(f"🔧 Set nprobe=50 for IVF index")
            
            # Set search parameters for HNSW
            if hasattr(index, 'index') and hasattr(index.index, 'hnsw'):
                index.index.hnsw.efSearch = 128  # Increase search depth for better recall
                print(f"🔧 Set efSearch=128 for HNSW index")
            
            # Cache the index to prevent repeated loading and memory leaks
            _FAISS_INDEX_CACHE[cache_key] = index
            print(f"💾 Cached FAISS index: {cache_key}")
            
            return index
        except Exception as e:
            print(f"❌ Failed to load FAISS index: {e}")
            raise
    
    

def search_similar_articles(query_embedding: np.ndarray, k: int = 10, index_path: str = None, index_type: str = "hnsw") -> List[Dict[str, Any]]:
    """
    Search for similar articles using FAISS.
    
    Args:
        query_embedding (np.ndarray): Query embedding vector (should already be normalized).
        k (int): Number of similar articles to return.
        index_path (str): Path to the FAISS index file.
        index_type (str): Type of index to use: "flat", "ivf", "hnsw" (default), or "ivfpq"
        
    Returns:
        List[Dict[str, Any]]: List of similar articles with their database IDs and scores.
        
    Note:
        The FAISS index was created with METRIC_INNER_PRODUCT on normalized vectors,
        which is equivalent to cosine similarity. Query must also be normalized.
    """
    # Load index
    index = load_faiss_index(index_path, index_type)
    
    # Ensure correct shape and type, then NORMALIZE for Inner Product
    query_embedding = query_embedding.astype('float32').reshape(1, -1)
    faiss.normalize_L2(query_embedding)  # REQUIRED: Index uses Inner Product on normalized vectors
    
    # Search
    scores, indices = index.search(query_embedding, k)
    
    # With IndexIDMap, indices are actually the database article IDs
    # Note: Inner Product returns HIGHER scores for MORE similar vectors
    # Score range: -1 to 1 (for normalized vectors, effectively cosine similarity)
    results = []
    for similarity_score, article_id in zip(scores[0], indices[0]):
        if article_id == -1:  # FAISS returns -1 for invalid results
            continue
        
        results.append({
            'article_id': int(article_id),
            'similarity_score': float(similarity_score),  # Cosine similarity: 1=perfect match, 0=orthogonal
        })
    
    # Results are already sorted by similarity score (descending) from FAISS
    # Higher score = more similar = better match
    
    return results


def load_faiss_bioarchive_index(index_path: str = None, index_type: str = "flat"):
    """
    Load a FAISS index for BioArchive articles.
    Uses FAISS_INDEX_BIOARCHIVE_DIR env variable as base directory.
    Uses global caching to prevent memory leaks from repeated loading.

    Args:
        index_path (str): Optional explicit path to the FAISS index file.
        index_type (str): Type of index to load: "flat", "ivf", "hnsw", or "ivfpq"

    Returns:
        faiss.IndexIDMap: The loaded FAISS index with database IDs
    """
    faiss_dir = os.getenv("FAISS_INDEX_BIOARCHIVE_DIR")

    if index_path is None:
        index_files = {
            "flat": "bioarchive_biobert_flat.index",
            "ivf": "bioarchive_biobert_ivf.index",
            "hnsw": "bioarchive_biobert_hnsw.index",
            "ivfpq": "bioarchive_biobert_ivfpq.index",
        }
        filename = index_files.get(index_type.lower())
        if not filename:
            raise ValueError(f"Invalid index_type: {index_type}. Must be one of: flat, ivf, hnsw, ivfpq")
        index_path = os.path.join(faiss_dir, filename)

    cache_key = f"bioarchive_{index_path}_{index_type}"
    if cache_key in _FAISS_INDEX_CACHE:
        return _FAISS_INDEX_CACHE[cache_key]

    with _get_lock():
        if cache_key in _FAISS_INDEX_CACHE:
            return _FAISS_INDEX_CACHE[cache_key]

        try:
            index = faiss.read_index(index_path)
            index_type_name = os.path.basename(index_path).replace("articles_biobert", "").replace(".index", "").replace("_", "").upper() or "FLAT"
            metric_type = index.metric_type if hasattr(index, 'metric_type') else (index.index.metric_type if hasattr(index, 'index') else 1)
            metric_name = "Inner Product (Cosine Similarity)" if metric_type == 1 else "L2 Distance"

            print(f"✅ [BioArchive] Loaded {index_type_name} index from: {index_path}")
            print(f"📊 [BioArchive] Index contains {index.ntotal} articles")
            print(f"📏 [BioArchive] Metric: {metric_name}")

            if hasattr(index, 'index') and isinstance(index.index, faiss.IndexIVF):
                index.index.nprobe = 50
            if hasattr(index, 'index') and hasattr(index.index, 'hnsw'):
                index.index.hnsw.efSearch = 128

            _FAISS_INDEX_CACHE[cache_key] = index
            print(f"💾 [BioArchive] Cached FAISS index: {cache_key}")
            return index
        except Exception as e:
            print(f"❌ [BioArchive] Failed to load FAISS index: {e}")
            raise


def search_similar_bioarchive_articles(query_embedding: np.ndarray, k: int = 10, index_path: str = None, index_type: str = "flat") -> List[Dict[str, Any]]:
    """
    Search for similar BioArchive articles using the dedicated BioArchive FAISS index.

    Args:
        query_embedding (np.ndarray): Query embedding vector (already normalized or will be normalized).
        k (int): Number of similar articles to return.
        index_path (str): Optional explicit path to FAISS index file.
        index_type (str): Type of index to use: "flat", "ivf", "hnsw", or "ivfpq"

    Returns:
        List[Dict[str, Any]]: List of similar articles with their database IDs and similarity scores.
    """
    index = load_faiss_bioarchive_index(index_path, index_type)

    query_embedding = query_embedding.astype('float32').reshape(1, -1)
    faiss.normalize_L2(query_embedding)

    scores, indices = index.search(query_embedding, k)

    results = []
    for similarity_score, article_id in zip(scores[0], indices[0]):
        if article_id == -1:
            continue
        results.append({
            'article_id': int(article_id),
            'similarity_score': float(similarity_score),
        })

    return results


def clear_faiss_cache():
    """
    Clear the global FAISS index cache.
    Call this after rebuilding indices to force reload.
    """
    global _FAISS_INDEX_CACHE
    _FAISS_INDEX_CACHE.clear()
    print("🗑️ Cleared FAISS index cache")


def get_cache_stats():
    """Get statistics about cached FAISS indices"""
    return {
        "cached_indices": list(_FAISS_INDEX_CACHE.keys()),
        "count": len(_FAISS_INDEX_CACHE)
    }