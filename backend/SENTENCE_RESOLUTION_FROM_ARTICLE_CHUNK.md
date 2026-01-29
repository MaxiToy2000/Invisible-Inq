# Sentence Resolution from article_chunk

This document describes how sentence resolution works for `text_id` references.

## Goal

Given a valid `text_id` (e.g. `<<1-16>>`), resolve:

- the **sentence text**
- the **full paragraph** containing that sentence

## Deterministic Lookup

The resolver requires:

- `article_id` **or** `article_url`
- `chunk_num`
- `sentence_num`

Lookup is exact:

- no fuzzy matching
- no guessing

## Paragraph Context

Chunk text is expected to contain sentence markers:

```
<<1-1>> Sentence one.
<<1-2>> Sentence two.
```

Resolution locates the paragraph containing the marker and returns:

- `sentence_text` (marker removed)
- `paragraph_text` (all markers removed)

## Output Structure

```
{
  "valid": true,
  "normalized_text_id": "<<1-16>>",
  "chunk_num": 1,
  "sentence_num": 16,
  "sentence_text": "...",
  "paragraph_text": "...",
  "chunk_text": "...",
  "error": null
}
```

## Failure Behavior

If resolution fails:

- `citation_status = "invalid"`
- `citation_error` is set
- raw relationship text is preserved
- no ingestion failures

## Code

- Resolver: `backend/text_id_resolution.py`
- Link enrichment: `backend/services.py` → `format_link()`

## Notes

- Requires `article_chunk` in Neon/Postgres.
- Supported reference fields: `article_id`, `article_url`, `source_url`, `url`.
