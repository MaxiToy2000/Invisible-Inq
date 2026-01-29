"""
text_id Parsing & Validation utilities.

Validates <<chunk-sentence>> references against article_chunk data.
"""
import logging
import re
from typing import Any, Dict, Optional, Tuple

from neon_database import neon_db

logger = logging.getLogger(__name__)

TEXT_ID_PATTERN = re.compile(r"^<<\s*(\d+)\s*-\s*(\d+)\s*>>$")


def parse_text_id(text_id: str) -> Tuple[Optional[int], Optional[int], Optional[str]]:
    """Parse and validate <<chunk-sentence>> format."""
    if not text_id or not isinstance(text_id, str):
        return None, None, "text_id must be a string"

    match = TEXT_ID_PATTERN.match(text_id.strip())
    if not match:
        return None, None, "text_id must match <<chunk-sentence>>"

    chunk_num = int(match.group(1))
    sentence_num = int(match.group(2))

    if chunk_num <= 0 or sentence_num <= 0:
        return None, None, "chunk and sentence numbers must be positive"

    return chunk_num, sentence_num, None


def normalize_text_id(chunk_num: int, sentence_num: int) -> str:
    return f"<<{chunk_num}-{sentence_num}>>"


def _split_sentences(text: str) -> list:
    # Simple sentence splitter fallback
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def resolve_text_id(text_id: str, article_url: Optional[str]) -> Dict[str, Any]:
    """
    Validate text_id against article_chunk table and resolve sentence text.

    Returns:
        {
          "valid": bool,
          "normalized_text_id": str|None,
          "chunk_num": int|None,
          "sentence_num": int|None,
          "sentence_text": str|None,
          "chunk_text": str|None,
          "error": str|None
        }
    """
    chunk_num, sentence_num, error = parse_text_id(text_id)
    if error:
        return {
            "valid": False,
            "normalized_text_id": None,
            "chunk_num": None,
            "sentence_num": None,
            "sentence_text": None,
            "chunk_text": None,
            "error": error
        }

    if not neon_db.is_configured():
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "chunk_text": None,
            "error": "article_chunk validation unavailable (Neon not configured)"
        }

    if not article_url:
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "chunk_text": None,
            "error": "article_url is required to resolve text_id"
        }

    # Query article_chunk table. Try multiple column names for URL.
    query = """
    SELECT chunk_num, chunk_text, sentences
    FROM article_chunk
    WHERE chunk_num = %s
      AND (
        article_url = %s
        OR source_url = %s
        OR url = %s
      )
    LIMIT 1
    """
    try:
        results = neon_db.execute_query(query, (chunk_num, article_url, article_url, article_url))
    except Exception as exc:
        logger.warning(f"Failed to query article_chunk: {exc}")
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "chunk_text": None,
            "error": "article_chunk lookup failed"
        }

    if not results:
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "chunk_text": None,
            "error": "chunk not found for article_url"
        }

    row = results[0]
    chunk_text = row.get("chunk_text") or ""

    # Prefer pre-split sentences if available
    sentences = row.get("sentences")
    if isinstance(sentences, str):
        # Try to parse JSON list if stored as JSON string
        try:
            import json
            sentences = json.loads(sentences)
        except Exception:
            sentences = None

    if not isinstance(sentences, list):
        sentences = _split_sentences(chunk_text)

    if sentence_num > len(sentences):
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "chunk_text": chunk_text,
            "error": "sentence index out of range"
        }

    sentence_text = sentences[sentence_num - 1] if sentences else None

    return {
        "valid": True,
        "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
        "chunk_num": chunk_num,
        "sentence_num": sentence_num,
        "sentence_text": sentence_text,
        "chunk_text": chunk_text,
        "error": None
    }
