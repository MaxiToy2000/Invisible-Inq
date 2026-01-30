"""
SQL Security Utilities for Postgres Injection Protection

This module provides utilities to prevent SQL injection attacks by:
1. Validating and sanitizing input parameters
2. Whitelisting column names and sort fields
3. Validating limits and offsets
4. Ensuring safe dynamic query construction
"""
import re
import logging
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)

# Maximum values for limits and offsets to prevent resource exhaustion
MAX_LIMIT = 10000
MAX_OFFSET = 100000
DEFAULT_LIMIT = 100
DEFAULT_OFFSET = 0

# Maximum length for string inputs
MAX_STRING_LENGTH = 10000

# SQL injection patterns to reject in user queries (e.g. AI search input)
SQL_INJECTION_PATTERNS = [
    r'1\s*=\s*1',           # 1=1, 1 = 1
    r'1\s*=\s*2',           # 1=2
    r"'\s*or\s*'1'\s*=\s*'1",  # ' or '1'='1
    r'"\s*or\s*"1"\s*=\s*"1',  # " or "1"="1
    r'or\s+1\s*=\s*1\b',    # or 1=1
    r'and\s+1\s*=\s*1\b',  # and 1=1
    r';\s*drop\s+table',    # ; DROP TABLE
    r';\s*delete\s+from',   # ; DELETE FROM
    r'union\s+select',      # UNION SELECT
]
SQL_INJECTION_RE = re.compile('|'.join(f'({p})' for p in SQL_INJECTION_PATTERNS), re.IGNORECASE)


def contains_sql_injection_pattern(text: str) -> bool:
    """
    Check if text contains common SQL injection patterns.
    Used to reject malicious input before processing (e.g. AI search queries).
    """
    if not text or not isinstance(text, str):
        return False
    return bool(SQL_INJECTION_RE.search(text))


def validate_limit(limit: Optional[int], default: int = DEFAULT_LIMIT, max_limit: int = MAX_LIMIT) -> int:
    """
    Validate and sanitize LIMIT parameter.
    
    Args:
        limit: The limit value to validate
        default: Default value if limit is None or invalid
        max_limit: Maximum allowed limit value
    
    Returns:
        Validated limit value
    """
    if limit is None:
        return default
    
    try:
        limit_int = int(limit)
    except (ValueError, TypeError):
        logger.warning(f"Invalid limit value: {limit}, using default: {default}")
        return default
    
    if limit_int < 0:
        logger.warning(f"Negative limit value: {limit_int}, using default: {default}")
        return default
    
    if limit_int > max_limit:
        logger.warning(f"Limit value {limit_int} exceeds maximum {max_limit}, capping to {max_limit}")
        return max_limit
    
    return limit_int


def validate_offset(offset: Optional[int], default: int = DEFAULT_OFFSET, max_offset: int = MAX_OFFSET) -> int:
    """
    Validate and sanitize OFFSET parameter.
    
    Args:
        offset: The offset value to validate
        default: Default value if offset is None or invalid
        max_offset: Maximum allowed offset value
    
    Returns:
        Validated offset value
    """
    if offset is None:
        return default
    
    try:
        offset_int = int(offset)
    except (ValueError, TypeError):
        logger.warning(f"Invalid offset value: {offset}, using default: {default}")
        return default
    
    if offset_int < 0:
        logger.warning(f"Negative offset value: {offset_int}, using default: {default}")
        return default
    
    if offset_int > max_offset:
        logger.warning(f"Offset value {offset_int} exceeds maximum {max_offset}, capping to {max_offset}")
        return max_offset
    
    return offset_int


def validate_string_input(value: Optional[str], max_length: int = MAX_STRING_LENGTH, allow_empty: bool = True) -> Optional[str]:
    """
    Validate and sanitize string input for SQL queries.
    
    Args:
        value: The string value to validate
        max_length: Maximum allowed length
        allow_empty: Whether empty strings are allowed
    
    Returns:
        Validated string or None if invalid
    """
    if value is None:
        return None
    
    if not isinstance(value, str):
        logger.warning(f"Non-string value provided: {type(value)}")
        return None
    
    # Trim whitespace
    value = value.strip()
    
    if not allow_empty and len(value) == 0:
        return None
    
    if len(value) > max_length:
        logger.warning(f"String value exceeds maximum length {max_length}, truncating")
        value = value[:max_length]
    
    return value


def sanitize_identifier(identifier: str) -> Optional[str]:
    """
    Sanitize SQL identifier (table name, column name) to prevent injection.
    
    Only allows alphanumeric characters, underscores, and dots (for schema.table).
    This is a strict whitelist approach.
    
    Args:
        identifier: The identifier to sanitize
    
    Returns:
        Sanitized identifier or None if invalid
    """
    if not identifier or not isinstance(identifier, str):
        return None
    
    # Remove whitespace
    identifier = identifier.strip()
    
    if len(identifier) == 0:
        return None
    
    # Only allow alphanumeric, underscore, and dot (for qualified names like schema.table)
    # This is a strict whitelist - no special characters that could be used for injection
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_.]*$', identifier):
        logger.warning(f"Invalid identifier format: {identifier}")
        return None
    
    # Additional check: prevent SQL keywords in identifiers (basic protection)
    sql_keywords = {
        'select', 'insert', 'update', 'delete', 'drop', 'alter', 'create',
        'table', 'database', 'schema', 'union', 'exec', 'execute', 'script'
    }
    
    if identifier.lower() in sql_keywords:
        logger.warning(f"Identifier matches SQL keyword: {identifier}")
        return None
    
    return identifier


def validate_column_name(column_name: str, allowed_columns: List[str]) -> Optional[str]:
    """
    Validate column name against a whitelist.
    
    This is the recommended approach for dynamic column selection.
    
    Args:
        column_name: The column name to validate
        allowed_columns: List of allowed column names
    
    Returns:
        Validated column name or None if not in whitelist
    """
    if not column_name or not isinstance(column_name, str):
        return None
    
    column_name = column_name.strip()
    
    # First sanitize the identifier
    sanitized = sanitize_identifier(column_name)
    if not sanitized:
        return None
    
    # Check against whitelist
    if sanitized.lower() not in [col.lower() for col in allowed_columns]:
        logger.warning(f"Column name '{column_name}' not in whitelist: {allowed_columns}")
        return None
    
    # Return the original case from whitelist if available, otherwise sanitized
    for allowed_col in allowed_columns:
        if allowed_col.lower() == sanitized.lower():
            return allowed_col
    
    return sanitized


def validate_sort_field(sort_field: str, allowed_fields: List[str], default: Optional[str] = None) -> Optional[str]:
    """
    Validate sort field (ORDER BY column) against a whitelist.
    
    Args:
        sort_field: The sort field to validate
        allowed_fields: List of allowed sort fields
        default: Default sort field if provided field is invalid
    
    Returns:
        Validated sort field or default/None if invalid
    """
    if not sort_field or not isinstance(sort_field, str):
        return default
    
    sort_field = sort_field.strip()
    
    # Remove potential DESC/ASC suffix for validation (we'll add it back safely)
    sort_field_base = re.sub(r'\s+(desc|asc)$', '', sort_field, flags=re.IGNORECASE).strip()
    
    # Validate against whitelist
    validated = validate_column_name(sort_field_base, allowed_fields)
    if not validated:
        logger.warning(f"Sort field '{sort_field}' not in whitelist: {allowed_fields}")
        return default
    
    # Check if DESC/ASC was specified
    sort_direction = 'ASC'
    if re.search(r'\s+desc$', sort_field, re.IGNORECASE):
        sort_direction = 'DESC'
    elif re.search(r'\s+asc$', sort_field, re.IGNORECASE):
        sort_direction = 'ASC'
    
    return f"{validated} {sort_direction}"


def build_where_clause(conditions: List[str], params: List) -> Tuple[str, List]:
    """
    Safely build WHERE clause from conditions list.
    
    This ensures all conditions use parameterized placeholders (%s).
    
    Args:
        conditions: List of condition strings with %s placeholders
        params: List of parameter values
    
    Returns:
        Tuple of (where_clause_string, params_list)
    
    Example:
        conditions = ["user_id = %s", "status = %s"]
        params = [123, "active"]
        Returns: ("WHERE user_id = %s AND status = %s", [123, "active"])
    """
    if not conditions:
        return "", params
    
    # Validate that all conditions contain %s (parameterized)
    for condition in conditions:
        if '%s' not in condition:
            raise ValueError(f"Condition must use parameterized placeholder (%s): {condition}")
    
    where_clause = " AND ".join(conditions)
    return f"WHERE {where_clause}", params


def build_set_clause(allowed_fields: List[str], updates: dict) -> Tuple[str, List]:
    """
    Safely build SET clause for UPDATE statements.
    
    Only allows updates to fields in the whitelist.
    
    Args:
        allowed_fields: List of allowed field names
        updates: Dictionary of field_name -> value
    
    Returns:
        Tuple of (set_clause_string, params_list)
    
    Example:
        allowed_fields = ["full_name", "profile_picture"]
        updates = {"full_name": "John Doe"}
        Returns: ("full_name = %s", ["John Doe"])
    """
    set_clauses = []
    params = []
    
    for field, value in updates.items():
        # Validate field name
        validated_field = validate_column_name(field, allowed_fields)
        if not validated_field:
            logger.warning(f"Skipping update to non-whitelisted field: {field}")
            continue
        
        if value is not None:
            set_clauses.append(f"{validated_field} = %s")
            params.append(value)
    
    if not set_clauses:
        return "", []
    
    return ", ".join(set_clauses), params


def validate_id(id_value: Optional[str]) -> Optional[str]:
    """
    Validate ID parameter (UUID or integer string).
    
    Args:
        id_value: The ID value to validate
    
    Returns:
        Validated ID string or None if invalid
    """
    if id_value is None:
        return None
    
    if not isinstance(id_value, str):
        id_value = str(id_value)
    
    id_value = id_value.strip()
    
    if len(id_value) == 0:
        return None
    
    # Allow UUID format or numeric IDs
    # UUID: 8-4-4-4-12 hex digits
    # Numeric: digits only
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    numeric_pattern = r'^\d+$'
    
    if re.match(uuid_pattern, id_value, re.IGNORECASE) or re.match(numeric_pattern, id_value):
        return id_value
    
    logger.warning(f"Invalid ID format: {id_value}")
    return None
