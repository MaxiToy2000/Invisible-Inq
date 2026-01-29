"""
Agent/Prompt Injection Hardening utilities.

AI agents must only return structured JSON data. Any output that contains
code, Cypher/SQL keywords, instructions, or role injection markers is rejected.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Output limits
MAX_OUTPUT_LENGTH = 20000
MAX_STRING_LENGTH = 2000
MAX_ARRAY_LENGTH = 200

# Disallowed content patterns
CODE_FENCE_PATTERN = re.compile(r"```", re.MULTILINE)
ROLE_INJECTION_PATTERN = re.compile(r"\b(system|developer|assistant)\b\s*:", re.IGNORECASE)

CYTHER_SQL_KEYWORDS = re.compile(
    r"\b("
    r"MATCH|CREATE|MERGE|DELETE|DETACH|CALL|RETURN|WITH|UNWIND|SET|REMOVE|DROP|ALTER|GRANT|REVOKE|"
    r"SELECT|INSERT|UPDATE|JOIN|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET"
    r")\b",
    re.IGNORECASE,
)

INSTRUCTION_PATTERNS = re.compile(
    r"\b("
    r"ignore previous|system prompt|developer message|act as|you are now|"
    r"execute|run|shell|bash|powershell|python|sql|cypher"
    r")\b",
    re.IGNORECASE,
)


def isolate_untrusted_content(content: str) -> str:
    """Wrap untrusted content to prevent instruction injection."""
    safe_content = content if content is not None else ""
    return (
        "UNTRUSTED_CONTENT_START\n"
        f"{safe_content}\n"
        "UNTRUSTED_CONTENT_END"
    )


def contains_disallowed_content(text: str) -> Tuple[bool, Optional[str]]:
    """Check if text contains code, queries, or instruction injection."""
    if not text:
        return False, None

    if len(text) > MAX_OUTPUT_LENGTH:
        return True, "Output exceeds maximum allowed length"

    if CODE_FENCE_PATTERN.search(text):
        return True, "Code blocks are not allowed"

    if ROLE_INJECTION_PATTERN.search(text):
        return True, "Role injection markers detected"

    if CYTHER_SQL_KEYWORDS.search(text):
        return True, "Cypher/SQL keywords detected"

    if INSTRUCTION_PATTERNS.search(text):
        return True, "Instructional content detected"

    return False, None


def parse_json_strict(text: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Parse JSON and ensure it is a single object."""
    try:
        parsed = json.loads(text)
    except Exception as exc:
        return None, f"Invalid JSON output: {exc}"

    if not isinstance(parsed, dict):
        return None, "Output must be a JSON object"

    return parsed, None


def _validate_string(value: Any, field_name: str) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        return f"Field '{field_name}' must be a string"
    if len(value) > MAX_STRING_LENGTH:
        return f"Field '{field_name}' exceeds max length {MAX_STRING_LENGTH}"
    return None


def _validate_string_array(value: Any, field_name: str) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, list):
        return f"Field '{field_name}' must be an array"
    if len(value) > MAX_ARRAY_LENGTH:
        return f"Field '{field_name}' exceeds max length {MAX_ARRAY_LENGTH}"
    for item in value:
        if not isinstance(item, str):
            return f"Field '{field_name}' must contain strings"
        if len(item) > MAX_STRING_LENGTH:
            return f"Field '{field_name}' contains an item exceeding max length"
    return None


def validate_intent_schema(data: Dict[str, Any]) -> Optional[str]:
    """Validate AI intent JSON schema."""
    allowed_fields = {"intent", "search_term", "entity_types", "relationship_types", "limit"}
    extra_fields = set(data.keys()) - allowed_fields
    if extra_fields:
        return f"Unexpected fields: {', '.join(sorted(extra_fields))}"

    if data.get("intent") not in {"search", "summarize"}:
        return "Field 'intent' must be 'search' or 'summarize'"

    error = _validate_string(data.get("search_term"), "search_term")
    if error:
        return error

    error = _validate_string_array(data.get("entity_types"), "entity_types")
    if error:
        return error

    error = _validate_string_array(data.get("relationship_types"), "relationship_types")
    if error:
        return error

    limit = data.get("limit")
    if limit is not None:
        if not isinstance(limit, int):
            return "Field 'limit' must be an integer"
        if limit < 1 or limit > 500:
            return "Field 'limit' must be between 1 and 500"

    return None


def validate_summary_schema(data: Dict[str, Any]) -> Optional[str]:
    """Validate AI summary JSON schema."""
    allowed_fields = {"summary", "entities"}
    extra_fields = set(data.keys()) - allowed_fields
    if extra_fields:
        return f"Unexpected fields: {', '.join(sorted(extra_fields))}"

    error = _validate_string(data.get("summary"), "summary")
    if error:
        return error

    error = _validate_string_array(data.get("entities"), "entities")
    if error:
        return error

    return None


def validate_agent_output(text: str, schema: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Validate agent output against strict rules and schema.

    schema: "intent" | "summary"
    """
    if not text:
        return None, "Empty agent output"

    disallowed, reason = contains_disallowed_content(text)
    if disallowed:
        return None, reason

    parsed, error = parse_json_strict(text)
    if error:
        return None, error

    if schema == "intent":
        schema_error = validate_intent_schema(parsed)
    elif schema == "summary":
        schema_error = validate_summary_schema(parsed)
    else:
        schema_error = f"Unknown schema '{schema}'"

    if schema_error:
        return None, schema_error

    return parsed, None
