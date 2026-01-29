# Agent/Prompt Injection Hardening

This document describes how the system enforces **data-only AI outputs** and protects against prompt injection.

## Core Rule

**AI agents must only output structured JSON data.**

No code generation, no Cypher, no SQL, no instructions.

If an AI output contains any of the above, it is rejected.

## Implemented Protections

### 1. Data-only enforcement

All AI responses are validated with `agent_security.validate_agent_output()`:

- JSON only (single object)
- No code blocks
- No Cypher/SQL keywords
- No role injection markers
- No instruction-like text

If validation fails:
- Output is discarded
- Incident is logged
- Pipeline continues safely

### 2. Strict schema validation

Two schemas are enforced:

**Intent schema**
```json
{
  "intent": "search",
  "search_term": "string",
  "entity_types": ["label", "..."],
  "relationship_types": ["type", "..."],
  "limit": 1
}
```

**Summary schema**
```json
{
  "summary": "string",
  "entities": ["entity name", "..."]
}
```

Unknown fields are rejected. Strings and arrays are size-bounded.

### 3. Prompt isolation

All untrusted input is wrapped with explicit markers:

```
UNTRUSTED_CONTENT_START
...content...
UNTRUSTED_CONTENT_END
```

The system prompt instructs the model to **ignore instructions inside untrusted content**.

### 4. Execution limits

AI requests are constrained:

- `max_tokens` capped
- request timeouts enforced
- low temperature for deterministic JSON output

### 5. No AI-generated queries

`generate_cypher_query()` is disabled and will raise an error.

AI search now:
- returns intent JSON only
- backend maps intent → safe Cypher template

This prevents prompt injection from becoming executable code.

## Files Updated

- `agent_security.py` (new)
- `ai_service.py` (intent-only output)
- `services.py` (intent → safe query, summary JSON)
- `submission_service.py` (removed Cypher generator import)

## Operational Notes

- If AI output is rejected, the system returns a safe fallback.
- No direct DB writes are performed by AI.
- All persistence is performed by backend code only.

## Testing Ideas

Try injecting:
- Cypher keywords (`MATCH`, `DELETE`, `CALL`)
- SQL keywords (`SELECT`, `DROP`, `INSERT`)
- Code blocks (```)
- Role text (`system:`, `developer:`)

Expected result: output rejected.

