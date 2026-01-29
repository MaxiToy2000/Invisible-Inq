# text_id Parsing & Validation

This document describes how text_id references are parsed, validated, and resolved.

## Goal

Ensure every relationship/edge that references source text is grounded in a **real sentence** from a **real chunk** in the correct article.

## Format Rules

Accepted format only:

```
<<chunk-sentence>>
```

Examples:
- `<<1-16>>`
- `<<12-3>>`

Rejected:
- `<<1>>`
- `<<a-b>>`
- `<<0-4>>`

## Validation Steps

1. **Parse**
   - Must match `<<chunk-sentence>>`
   - Both chunk and sentence must be positive integers

2. **Existence**
   - `article_chunk` must contain the requested `chunk_num`
   - `sentence_num` must be within sentence count for that chunk
   - Reference must match the **correct article URL**

3. **Canonical Resolution**
   - Normalize to `<<chunk-sentence>>`
   - Resolve `sentence_text`
   - Attach to relationship for display

4. **Fallback Behavior**
   - If `text_id` missing: mark `citation_status = "uncited"`
   - If invalid: mark `citation_status = "invalid"` and keep raw text
   - No ingestion failures

## Code Paths

### Validator
`backend/text_id_validation.py`

- `parse_text_id()` — strict parsing
- `resolve_text_id()` — validates against `article_chunk`

### Link Formatting
`backend/services.py` → `format_link()`

For each relationship:
- `text_id` is parsed and validated
- `citation_status`, `citation_text`, and `citation_error` are added

## Expected DB Table

`article_chunk` (Neon/Postgres):

Minimum columns used:
- `chunk_num` (int)
- `chunk_text` (text)
- `sentences` (json array, optional)
- `article_url` (text) or `source_url` or `url`

If `sentences` is missing, sentence list is derived by splitting `chunk_text`.

## Output Fields Added to Links

Each relationship includes:
- `text_id` — normalized format
- `citation_status` — `cited | invalid | uncited`
- `citation_text` — resolved sentence text (if valid)
- `citation_error` — reason if invalid

## Notes

- If Neon DB is not configured, validation is skipped and links are marked invalid with error.
- This implementation is **strict** and never auto‑corrects malformed IDs.
