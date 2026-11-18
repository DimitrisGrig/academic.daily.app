from dotenv import load_dotenv
import pytz
import os
from fastapi import Request
import models
from sqlalchemy.orm import Session


load_dotenv()

def convert_to_athens_GMT(datetime_obj):
    # Get the current GMT in athens (GMT+2 or GMT+3) [returns int]
    gmt_offset = get_GMT()

    ### Convert the datetime object to the desired timezone (Athens GMT) ###
    # eest_timezone = pytz.timezone('Etc/GMT-3')  # Eastern European Time with reversed sign
    eest_timezone = pytz.timezone('Etc/GMT' + ('+' if gmt_offset < 0 else '-') + str(abs(gmt_offset)))

    dt_eest = datetime_obj.astimezone(eest_timezone)

    # Format the datetime object back to a string in the desired format
    formatted_datetime = dt_eest.strftime("%Y-%m-%d %H:%M:%S")

    return formatted_datetime


def get_GMT() -> int:
    import pytz
    athens_timezone = pytz.timezone('Europe/Athens')

    # Get the current time in Athens timezone
    athens_time = pytz.datetime.datetime.now(athens_timezone)

    # Get the UTC offset for Athens timezone
    utc_offset = int(athens_time.utcoffset().total_seconds() // 3600)
    return utc_offset



    
def get_user_info(user: dict):
    """ Extract user information from the JWT token """
    return {
            "id": user["user_id"],
            "email": user["email"],
            "session_id": user["session_id"]
    }



import torch
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer
import os
import numpy as np

# Configuration flags
BIOBERT_NUM_THREADS = os.getenv("BIOBERT_NUM_THREADS", "2")
# Set PyTorch thread count to limit CPU usage
torch.set_num_threads(int(BIOBERT_NUM_THREADS))

model_name = "pritamdeka/BioBERT-mnli-snli-scinli-scitail-mednli-stsb"

# LAZY LOADING: Don't load model at import time, load when first needed
_model = None
_tokenizer = None

import threading
_model_lock = threading.Lock()
_tokenizer_lock = threading.Lock()

def get_model():
    """Lazy load the SentenceTransformer model (thread-safe)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:   # double-checked locking
                print("[INFO] Loading BioBERT model...")
                _model = SentenceTransformer(model_name)
                _model.max_seq_length = 512
                print("[INFO] BioBERT model loaded successfully")
    return _model

def get_tokenizer():
    """Lazy load the tokenizer (thread-safe)."""
    global _tokenizer
    if _tokenizer is None:
        with _tokenizer_lock:
            if _tokenizer is None:
                _tokenizer = AutoTokenizer.from_pretrained(model_name)
    return _tokenizer


def _chunk_text(text: str, max_tokens: int = 512, stride: int = 450) -> list[str]:
    """
    Split text into overlapping chunks that each fit into the model's token window.

    Args:
        text (str): Input text.
        max_tokens (int): Maximum tokens per chunk.
        stride (int): Overlap between chunks to preserve continuity.

    Returns:
        list[str]: List of decoded text chunks.
    """
    tokenizer = get_tokenizer()
    token_ids = tokenizer.encode(text, add_special_tokens=False)
    if len(token_ids) <= max_tokens:
        return [text]

    chunks = []
    for start in range(0, len(token_ids), stride):
        end = start + max_tokens
        chunk_ids = token_ids[start:end]
        chunk_text = tokenizer.decode(chunk_ids, skip_special_tokens=True)
        chunks.append(chunk_text)
        if end >= len(token_ids):
            break
    return chunks


def generate_embeddings(text: str) -> np.ndarray:
    """
    Generate embeddings for a single text using chunking and averaging.
    
    Args:
        text (str): Input text to encode.
    
    Returns:
        np.ndarray: 1D normalized embedding vector suitable for cosine similarity.
    """
    model = get_model()
    chunks = _chunk_text(text, max_tokens=512, stride=450)
    chunk_embs = model.encode(chunks, normalize_embeddings=True)
    mean_emb = np.mean(chunk_embs, axis=0)
    return mean_emb

