"""
Build the BM25 index used by /public/benchmark_search_BM25.

Indexes title + ". " + abstract of every row in `articles` (no embeddings are
touched). Re-run whenever new articles should become searchable; running
workers pick up the new index after the periodic cache clear (or a restart).

Usage:
    python build_bm25_index.py                 # writes to $BM25_INDEX_DIR or $FAISS_INDEX_DIR/bm25
    python build_bm25_index.py --out /path/to/bm25 --k1 1.2 --b 0.75
"""

import argparse

from sqlalchemy import text

from database import engine
from vector_store.bm25 import article_text, build_bm25_index, get_bm25_index_dir


def iter_articles():
    with engine.connect().execution_options(stream_results=True, yield_per=5000) as conn:
        result = conn.execute(text("SELECT id, title, abstract FROM articles ORDER BY id"))
        for article_id, title, abstract in result:
            yield article_id, article_text(title, abstract)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=get_bm25_index_dir(), help="Output directory for the index")
    parser.add_argument("--k1", type=float, default=1.2)
    parser.add_argument("--b", type=float, default=0.75)
    args = parser.parse_args()

    print(f"Building BM25 index into {args.out} (k1={args.k1}, b={args.b})")
    build_bm25_index(iter_articles(), args.out, k1=args.k1, b=args.b)
