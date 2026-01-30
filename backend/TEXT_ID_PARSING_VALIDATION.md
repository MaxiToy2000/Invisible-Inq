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

4. **Raw-text Fallback Behavior**
   - If `text_id` missing: mark `citation_status = "uncited"`, preserve raw extracted text
   - If invalid: mark `citation_status = "invalid"`, preserve raw extracted text
   - If sentence resolution returns null: same as invalid
   - No ingestion failures — relationships are never dropped

## Raw-text Fallback Logic

When citation resolution fails, the relationship is **preserved** with raw extracted text instead of being dropped.

### Fallback Triggers
- No `text_id` provided
- `text_id` fails validation (parse error, wrong format)
- Sentence resolution returns null (chunk not found, sentence out of range, etc.)

### Fallback Behavior
1. **Preserve extracted meaning** — Store raw extracted text (`text`, `summary`, `Relationship Summary`, etc.) on the relationship
2. **Explicit quality marking** — `citation_status` = `uncited` or `invalid`; `citation_score` = 0.3 (uncited) or 0.5 (invalid)
3. **UI & AI-safe** — Graph viewer shows raw text only; no sentence highlighting; AI knows this is weaker evidence

### What Fallback Does NOT Do
- Does not fabricate sentence IDs
- Does not auto-correct citations
- Does not upgrade fallback data later
- Does not modify chunking

## Code Paths

### Validator
`backend/text_id_validation.py`

- `parse_text_id()` — strict parsing
- `resolve_text_id()` — validates against `article_chunk`

### Resolver
`backend/text_id_resolution.py`

- `resolve_sentence_reference()` — resolves sentence + paragraph from `article_chunk`

### Link Formatting
`backend/services.py` → `format_link()`

For each relationship:
- Merges `properties(rd.rel)` into top-level for resolution
- `text_id` is parsed and validated
- `citation_status`, `citation_text`, `citation_error`, `citation_score`, `raw_text` are added
- Raw extracted text is preserved for fallback when resolution fails

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
- `text_id` — normalized format (if provided)
- `citation_status` — `cited | invalid | uncited`
- `citation_score` — 1.0 (cited), 0.5 (invalid), 0.3 (uncited)
- `citation_text` — resolved sentence text (if cited) or raw extracted text (if fallback)
- `citation_error` — reason if invalid
- `raw_text` — raw extracted text from agent (preserved for reference)

## Notes

- If Neon DB is not configured, validation is skipped and links are marked invalid with error.
- This implementation is **strict** and never auto‑corrects malformed IDs.
- Fallback relationships are visually distinguished in the graph (reduced opacity) and in the sidebar (citation badge).
