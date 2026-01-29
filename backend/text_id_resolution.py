"""
Sentence Resolution from article_chunk.

Given a text_id like <<1-16>>, resolve the sentence and its paragraph
from article_chunk for the correct article.
"""
import logging
import re
from typing import Any, Dict, Optional, Tuple

from neon_database import neon_db

logger = logging.getLogger(__name__)

TEXT_ID_PATTERN = re.compile(r"^<<\s*(\d+)\s*-\s*(\d+)\s*>>$")
MARKER_PATTERN = re.compile(r"<<\s*\d+\s*-\s*\d+\s*>>")


def parse_text_id(text_id: str) -> Tuple[Optional[int], Optional[int], Optional[str]]:
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


def _strip_markers(text: str) -> str:
    cleaned = MARKER_PATTERN.sub("", text)
    return re.sub(r"\s+", " ", cleaned).strip()


def _find_paragraph_with_marker(chunk_text: str, text_id: str) -> Tuple[Optional[str], Optional[str]]:
    if not chunk_text:
        return None, None

    paragraphs = re.split(r"\n\s*\n", chunk_text.strip())
    for paragraph in paragraphs:
        if text_id in paragraph:
            # Sentence text: the line containing the marker
            sentence_text = None
            for line in paragraph.splitlines():
                if text_id in line:
                    sentence_text = _strip_markers(line)
                    break
            paragraph_text = _strip_markers(paragraph)
            return paragraph_text, sentence_text
    return None, None


def resolve_sentence_reference(
    text_id: str,
    article_id: Optional[str] = None,
    article_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resolve sentence + paragraph for a text_id from article_chunk.

    Returns:
        {
          "valid": bool,
          "normalized_text_id": str|None,
          "chunk_num": int|None,
          "sentence_num": int|None,
          "sentence_text": str|None,
          "paragraph_text": str|None,
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
            "paragraph_text": None,
            "chunk_text": None,
            "error": error,
        }

    if not neon_db.is_configured():
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "paragraph_text": None,
            "chunk_text": None,
            "error": "article_chunk validation unavailable (Neon not configured)",
        }

    if not article_id and not article_url:
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "paragraph_text": None,
            "chunk_text": None,
            "error": "article_id or article_url is required to resolve text_id",
        }

    conditions = ["chunk_num = %s"]
    params = [chunk_num]

    if article_id:
        conditions.append("article_id = %s")
        params.append(article_id)
    else:
        conditions.append("(article_url = %s OR source_url = %s OR url = %s)")
        params.extend([article_url, article_url, article_url])

    query = f"""
    SELECT chunk_num, chunk_text, sentences
    FROM article_chunk
    WHERE {' AND '.join(conditions)}
    LIMIT 1
    """

    try:
        results = neon_db.execute_query(query, tuple(params))
    except Exception as exc:
        logger.warning(f"Failed to query article_chunk: {exc}")
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "paragraph_text": None,
            "chunk_text": None,
            "error": "article_chunk lookup failed",
        }

    if not results:
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "paragraph_text": None,
            "chunk_text": None,
            "error": "chunk not found for article reference",
        }

    row = results[0]
    chunk_text = row.get("chunk_text") or ""

    paragraph_text, sentence_text = _find_paragraph_with_marker(
        chunk_text, normalize_text_id(chunk_num, sentence_num)
    )

    if not paragraph_text:
        return {
            "valid": False,
            "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
            "chunk_num": chunk_num,
            "sentence_num": sentence_num,
            "sentence_text": None,
            "paragraph_text": None,
            "chunk_text": chunk_text,
            "error": "sentence marker not found in chunk_text",
        }

    return {
        "valid": True,
        "normalized_text_id": normalize_text_id(chunk_num, sentence_num),
        "chunk_num": chunk_num,
        "sentence_num": sentence_num,
        "sentence_text": sentence_text,
        "paragraph_text": paragraph_text,
        "chunk_text": chunk_text,
        "error": None,
    }
