"""
BM25 lexical index over articles (title + ". " + abstract).

The index is built offline (see build_bm25_index.py) into a directory of .npy
files that are memory-mapped at query time, so every gunicorn worker shares the
same OS page cache instead of holding its own copy in RAM.

Tokenization matches the offline retrieval experiment exactly:
lowercase, then split on anything that is not [a-z0-9].

On-disk layout (term-major postings, i.e. CSC with terms as columns):
    vocab_blob.npy     uint8   all terms (sorted, utf-8) concatenated
    vocab_offsets.npy  int64   len(vocab)+1 offsets into vocab_blob
    indptr.npy         int64   len(vocab)+1 offsets into postings
    postings_doc.npy   int32   doc index (row into doc_ids) per posting
    postings_w.npy     float32 precomputed BM25 weight per posting
    doc_ids.npy        int64   article id per doc index
    meta.json                  N, avgdl, k1, b, build time
"""

import bisect
import json
import os
import re
import shutil
import threading
import time
from collections import Counter
from array import array
from typing import Dict, Iterable, List, Tuple

import numpy as np

_TOKEN_RE = re.compile(r"[a-z0-9]+")

_BM25_INDEX_CACHE = {}
_BM25_INDEX_LOCK = threading.Lock()


def tokenize(text: str) -> List[str]:
    """Lowercase + simple alphanumeric splitting (same as the offline experiment)."""
    return _TOKEN_RE.findall(text.lower())


def article_text(title, abstract) -> str:
    return f"{title or ''}. {abstract or ''}"


def get_bm25_index_dir() -> str:
    index_dir = os.getenv("BM25_INDEX_DIR")
    if index_dir:
        return index_dir
    return os.path.join(os.getenv("FAISS_INDEX_DIR", "."), "bm25")


class _Vocab:
    """Sorted, memory-mapped term list supporting binary-search lookup."""

    def __init__(self, blob: np.ndarray, offsets: np.ndarray):
        self._blob = blob
        self._offsets = offsets

    def __len__(self):
        return len(self._offsets) - 1

    def __getitem__(self, i: int) -> bytes:
        return self._blob[self._offsets[i]:self._offsets[i + 1]].tobytes()

    def lookup(self, term: str) -> int:
        key = term.encode("utf-8")
        i = bisect.bisect_left(self, key)
        if i < len(self) and self[i] == key:
            return i
        return -1


class BM25Index:
    def __init__(self, index_dir: str):
        def load(name):
            return np.load(os.path.join(index_dir, name), mmap_mode="r")

        self.vocab = _Vocab(load("vocab_blob.npy"), load("vocab_offsets.npy"))
        self.indptr = load("indptr.npy")
        self.postings_doc = load("postings_doc.npy")
        self.postings_w = load("postings_w.npy")
        self.doc_ids = load("doc_ids.npy")
        with open(os.path.join(index_dir, "meta.json")) as f:
            self.meta = json.load(f)

    def search(self, query: str, k: int = 10) -> List[Dict]:
        # Repeated query terms count once per occurrence (standard BM25 query-side tf)
        term_counts = Counter(tokenize(query))
        doc_parts, weight_parts = [], []
        for term, qtf in term_counts.items():
            t = self.vocab.lookup(term)
            if t < 0:
                continue
            start, end = int(self.indptr[t]), int(self.indptr[t + 1])
            doc_parts.append(self.postings_doc[start:end])
            weight_parts.append(self.postings_w[start:end] * np.float32(qtf))

        if not doc_parts:
            return []

        scores = np.bincount(
            np.concatenate(doc_parts),
            weights=np.concatenate(weight_parts),
            minlength=len(self.doc_ids),
        )
        matched = np.count_nonzero(scores)
        k = min(k, matched)
        if k == 0:
            return []

        top = np.argpartition(-scores, k - 1)[:k]
        top = top[np.argsort(-scores[top], kind="stable")]
        return [
            {"article_id": int(self.doc_ids[i]), "bm25_score": float(scores[i])}
            for i in top
        ]


def load_bm25_index(index_dir: str = None) -> BM25Index:
    index_dir = index_dir or get_bm25_index_dir()
    if index_dir in _BM25_INDEX_CACHE:
        return _BM25_INDEX_CACHE[index_dir]
    with _BM25_INDEX_LOCK:
        if index_dir not in _BM25_INDEX_CACHE:
            index = BM25Index(index_dir)
            print(f"✅ Loaded BM25 index from: {index_dir} ({index.meta['num_docs']} articles, {len(index.vocab)} terms)")
            _BM25_INDEX_CACHE[index_dir] = index
        return _BM25_INDEX_CACHE[index_dir]


def clear_bm25_cache():
    with _BM25_INDEX_LOCK:
        _BM25_INDEX_CACHE.clear()


def search_bm25(query: str, k: int = 10, index_dir: str = None) -> List[Dict]:
    return load_bm25_index(index_dir).search(query, k)


def build_bm25_index(rows: Iterable[Tuple[int, str]], out_dir: str, k1: float = 1.2, b: float = 0.75):
    """
    Build the index from (article_id, text) rows and write it to out_dir.

    Written to a temporary sibling directory and swapped in at the end, so
    running workers keep reading their already-mmapped (old) files safely.
    Uses Lucene/Elasticsearch BM25: idf = ln(1 + (N - df + 0.5) / (df + 0.5)).
    """
    term_to_id: Dict[str, int] = {}
    post_term = array("i")   # doc-major postings: term id
    post_tf = array("f")     # doc-major postings: term frequency (later BM25 weight)
    doc_lens = array("i")
    doc_nnz = array("i")
    doc_ids = array("q")

    t0 = time.time()
    for n, (article_id, text) in enumerate(rows, 1):
        counts = Counter(tokenize(text))
        for term, tf in counts.items():
            t = term_to_id.get(term)
            if t is None:
                t = term_to_id[term] = len(term_to_id)
            post_term.append(t)
            post_tf.append(tf)
        doc_lens.append(sum(counts.values()))
        doc_nnz.append(len(counts))
        doc_ids.append(article_id)
        if n % 50000 == 0:
            print(f"  tokenized {n} articles ({time.time() - t0:.0f}s, {len(term_to_id)} terms)")

    num_docs, num_terms = len(doc_ids), len(term_to_id)
    if num_docs == 0:
        raise ValueError("No articles to index.")

    terms = np.frombuffer(post_term, dtype=np.int32)
    weights = np.frombuffer(post_tf, dtype=np.float32).copy()
    del post_tf
    lens = np.frombuffer(doc_lens, dtype=np.int32).astype(np.float32)
    nnz_per_doc = np.frombuffer(doc_nnz, dtype=np.int32)
    avgdl = float(lens.mean()) or 1.0

    # BM25 weight per posting, computed in place: idf * tf*(k1+1) / (tf + k1*norm)
    df = np.bincount(terms, minlength=num_terms).astype(np.float32)
    idf = np.log1p((num_docs - df + 0.5) / (df + 0.5)).astype(np.float32)
    norm = np.repeat(k1 * (1 - b + b * lens / avgdl), nnz_per_doc)
    weights *= k1 + 1
    weights /= weights / (k1 + 1) + norm
    del norm
    weights *= idf[terms]

    # Reorder postings term-major, with term ids remapped to sorted-vocab order
    sorted_terms = sorted(term_to_id, key=lambda s: s.encode("utf-8"))
    remap = np.empty(num_terms, dtype=np.int32)
    remap[[term_to_id[s] for s in sorted_terms]] = np.arange(num_terms, dtype=np.int32)
    del term_to_id
    terms = remap[terms]
    indptr = np.zeros(num_terms + 1, dtype=np.int64)
    np.cumsum(np.bincount(terms, minlength=num_terms), out=indptr[1:])
    order = np.argsort(terms, kind="stable")
    del terms

    tmp_dir = out_dir.rstrip("/") + ".tmp"
    shutil.rmtree(tmp_dir, ignore_errors=True)
    os.makedirs(tmp_dir)

    doc_index = np.repeat(np.arange(num_docs, dtype=np.int32), nnz_per_doc)
    np.save(os.path.join(tmp_dir, "postings_doc.npy"), doc_index[order])
    del doc_index
    np.save(os.path.join(tmp_dir, "postings_w.npy"), weights[order])
    del weights, order

    encoded = [s.encode("utf-8") for s in sorted_terms]
    offsets = np.zeros(num_terms + 1, dtype=np.int64)
    np.cumsum([len(e) for e in encoded], out=offsets[1:])
    np.save(os.path.join(tmp_dir, "vocab_blob.npy"), np.frombuffer(b"".join(encoded), dtype=np.uint8))
    np.save(os.path.join(tmp_dir, "vocab_offsets.npy"), offsets)
    np.save(os.path.join(tmp_dir, "indptr.npy"), indptr)
    np.save(os.path.join(tmp_dir, "doc_ids.npy"), np.frombuffer(doc_ids, dtype=np.int64))
    meta = {
        "num_docs": num_docs,
        "num_terms": num_terms,
        "num_postings": int(indptr[-1]),
        "avgdl": avgdl,
        "k1": k1,
        "b": b,
        "tokenizer": _TOKEN_RE.pattern + " on lowercased title + '. ' + abstract",
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(os.path.join(tmp_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    old_dir = out_dir.rstrip("/") + ".old"
    shutil.rmtree(old_dir, ignore_errors=True)
    if os.path.exists(out_dir):
        os.rename(out_dir, old_dir)
    os.rename(tmp_dir, out_dir)
    shutil.rmtree(old_dir, ignore_errors=True)

    print(f"✅ BM25 index written to {out_dir} in {time.time() - t0:.0f}s: {meta}")
    return meta
