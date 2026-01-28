"""
Cypher Security Utilities for Neo4j Injection Protection

This module provides utilities to prevent Cypher injection attacks by:
1. Validating and sanitizing Cypher queries
2. Whitelisting labels and relationship types
3. Detecting dangerous operations
4. Enforcing query limits and timeouts
5. Validating AI-generated queries
"""
import re
import logging
from typing import Optional, List, Dict, Tuple, Set
from enum import Enum

logger = logging.getLogger(__name__)

# Maximum values for query limits
MAX_NODES_RETURNED = 10000
MAX_RELATIONSHIPS_RETURNED = 50000
MAX_QUERY_LENGTH = 50000
MAX_DEPTH_TRAVERSAL = 10
DEFAULT_QUERY_TIMEOUT = 30  # seconds

# Dangerous Cypher keywords that should be blocked or restricted
DANGEROUS_KEYWORDS = {
    'CREATE DATABASE',
    'DROP DATABASE',
    'CREATE USER',
    'DROP USER',
    'ALTER USER',
    'GRANT',
    'REVOKE',
    'SHOW',
    'CALL dbms',
    'CALL apoc',
    'CALL gds',
    'FOREACH',  # Can be dangerous if used with DELETE
}

# Dangerous procedures (APOC, GDS, etc.)
DANGEROUS_PROCEDURES = {
    'apoc.load',
    'apoc.export',
    'apoc.cypher',
    'apoc.util',
    'apoc.systemdb',
    'apoc.file',
    'apoc.shell',
    'apoc.xml',
    'apoc.json',
    'gds.graph',
    'dbms.security',
    'dbms.procedures',
    'dbms.queryJmx',
    'dbms.shell',
    'dbms.kill',
    'dbms.list',
    'dbms.create',
    'dbms.drop',
}

# Read-only procedures that are safe
SAFE_PROCEDURES = {
    'db.schema',
    'db.labels',
    'db.relationshipTypes',
    'db.propertyKeys',
    'db.indexes',
    'db.constraints',
    'dbms.components',
    'dbms.queryJmx',
}

# Allowed node labels (whitelist approach)
# This should be populated from your actual database schema
ALLOWED_NODE_LABELS = {
    'story', 'chapter', 'section',
    'entity', 'relationship', 'action', 'process', 'result',
    'country', 'place', 'location', 'place_of_performance',
    'event', 'incident', 'milestone',
    'funding', 'event_attend',
}

# Allowed relationship types (whitelist approach)
ALLOWED_RELATIONSHIP_TYPES = {
    'story_chapter', 'chapter_section',
    'related_to', 'connected_to', 'part_of', 'contains',
    'located_in', 'happened_in', 'involves',
}

# Write operations that require special permissions
WRITE_OPERATIONS = {
    'CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH DELETE',
    'REMOVE', 'FOREACH', 'CALL apoc.create', 'CALL apoc.merge',
}


class QuerySecurityLevel(Enum):
    """Security levels for query execution"""
    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    ADMIN = "admin"


def validate_cypher_query(
    query: str,
    security_level: QuerySecurityLevel = QuerySecurityLevel.READ_ONLY,
    allow_write: bool = False,
    max_nodes: int = MAX_NODES_RETURNED,
    max_rels: int = MAX_RELATIONSHIPS_RETURNED
) -> Tuple[bool, Optional[str]]:
    """
    Validate a Cypher query for security issues.
    
    Args:
        query: The Cypher query to validate
        security_level: Security level for query execution
        allow_write: Whether write operations are allowed
        max_nodes: Maximum nodes that can be returned
        max_rels: Maximum relationships that can be returned
    
    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    if not query or not isinstance(query, str):
        return False, "Query must be a non-empty string"
    
    query = query.strip()
    
    if len(query) == 0:
        return False, "Query cannot be empty"
    
    if len(query) > MAX_QUERY_LENGTH:
        return False, f"Query exceeds maximum length of {MAX_QUERY_LENGTH} characters"
    
    query_upper = query.upper()
    
    # Check for dangerous keywords
    for keyword in DANGEROUS_KEYWORDS:
        if keyword.upper() in query_upper:
            return False, f"Dangerous keyword detected: {keyword}"
    
    # Check for dangerous procedures
    for proc in DANGEROUS_PROCEDURES:
        if proc.lower() in query.lower():
            return False, f"Dangerous procedure detected: {proc}"
    
    # Check for database manipulation
    if 'CREATE DATABASE' in query_upper or 'DROP DATABASE' in query_upper:
        return False, "Database creation/deletion is not allowed"
    
    # Check for user management
    if any(op in query_upper for op in ['CREATE USER', 'DROP USER', 'ALTER USER']):
        return False, "User management operations are not allowed"
    
    # Check for write operations if not allowed
    if not allow_write:
        write_ops_found = []
        for op in WRITE_OPERATIONS:
            if op in query_upper:
                write_ops_found.append(op)
        
        if write_ops_found:
            return False, f"Write operations not allowed: {', '.join(write_ops_found)}"
    
    # Check for excessive depth traversal (DoS protection)
    depth_pattern = r'\[.*?(\*|\d+)\.\.(\d+|\*).*?\]'
    matches = re.findall(depth_pattern, query)
    for match in matches:
        if match[1] != '*':
            try:
                depth = int(match[1])
                if depth > MAX_DEPTH_TRAVERSAL:
                    return False, f"Traversal depth {depth} exceeds maximum of {MAX_DEPTH_TRAVERSAL}"
            except ValueError:
                pass
    
    # Check for potential DETACH DELETE without proper safeguards
    if 'DETACH DELETE' in query_upper and not allow_write:
        return False, "DETACH DELETE operations require write permissions"
    
    # Check for LIMIT clauses that are too large
    limit_pattern = r'LIMIT\s+(\d+)'
    limit_matches = re.findall(limit_pattern, query_upper)
    for limit_str in limit_matches:
        try:
            limit_val = int(limit_str)
            if limit_val > max_nodes:
                return False, f"LIMIT value {limit_val} exceeds maximum of {max_nodes}"
        except ValueError:
            pass
    
    return True, None


def validate_label(label: str, allowed_labels: Optional[Set[str]] = None) -> Tuple[bool, Optional[str]]:
    """
    Validate a node label against whitelist.
    
    Args:
        label: The label to validate
        allowed_labels: Set of allowed labels (defaults to ALLOWED_NODE_LABELS)
    
    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    if not label or not isinstance(label, str):
        return False, "Label must be a non-empty string"
    
    label = label.strip()
    
    # Remove backticks if present
    label = label.strip('`')
    
    if len(label) == 0:
        return False, "Label cannot be empty"
    
    # Sanitize: only allow alphanumeric, underscore, space (for labels with spaces)
    if not re.match(r'^[a-zA-Z0-9_\s]+$', label):
        return False, f"Label contains invalid characters: {label}"
    
    # Check against whitelist
    allowed = allowed_labels or ALLOWED_NODE_LABELS
    label_lower = label.lower()
    
    # Normalize for comparison (replace spaces with underscores)
    label_normalized = label_lower.replace(' ', '_')
    
    # Check if label matches any allowed label (exact or normalized)
    if label_lower not in {l.lower() for l in allowed} and label_normalized not in {l.lower().replace(' ', '_') for l in allowed}:
        return False, f"Label '{label}' is not in the allowed whitelist"
    
    return True, None


def validate_relationship_type(rel_type: str, allowed_types: Optional[Set[str]] = None) -> Tuple[bool, Optional[str]]:
    """
    Validate a relationship type against whitelist.
    
    Args:
        rel_type: The relationship type to validate
        allowed_types: Set of allowed types (defaults to ALLOWED_RELATIONSHIP_TYPES)
    
    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    if not rel_type or not isinstance(rel_type, str):
        return False, "Relationship type must be a non-empty string"
    
    rel_type = rel_type.strip()
    
    # Remove brackets and colons if present
    rel_type = rel_type.strip('[]:')
    
    if len(rel_type) == 0:
        return False, "Relationship type cannot be empty"
    
    # Sanitize: only allow alphanumeric, underscore
    if not re.match(r'^[a-zA-Z0-9_]+$', rel_type):
        return False, f"Relationship type contains invalid characters: {rel_type}"
    
    # Check against whitelist
    allowed = allowed_types or ALLOWED_RELATIONSHIP_TYPES
    rel_type_lower = rel_type.lower()
    
    if rel_type_lower not in {t.lower() for t in allowed}:
        return False, f"Relationship type '{rel_type}' is not in the allowed whitelist"
    
    return True, None


def sanitize_label_for_query(label: str) -> Optional[str]:
    """
    Sanitize a label for use in Cypher query.
    Returns None if label is invalid.
    
    Args:
        label: The label to sanitize
    
    Returns:
        Sanitized label or None if invalid
    """
    is_valid, error = validate_label(label)
    if not is_valid:
        logger.warning(f"Invalid label: {error}")
        return None
    
    # Remove backticks and re-add if needed
    label = label.strip('`')
    
    # Add backticks if label contains spaces
    if ' ' in label:
        return f"`{label}`"
    
    return label


def sanitize_relationship_type_for_query(rel_type: str) -> Optional[str]:
    """
    Sanitize a relationship type for use in Cypher query.
    Returns None if type is invalid.
    
    Args:
        rel_type: The relationship type to sanitize
    
    Returns:
        Sanitized relationship type or None if invalid
    """
    is_valid, error = validate_relationship_type(rel_type)
    if not is_valid:
        logger.warning(f"Invalid relationship type: {error}")
        return None
    
    # Remove brackets and colons
    rel_type = rel_type.strip('[]:')
    
    return rel_type


def detect_write_operations(query: str) -> List[str]:
    """
    Detect write operations in a Cypher query.
    
    Args:
        query: The Cypher query to analyze
    
    Returns:
        List of detected write operations
    """
    query_upper = query.upper()
    detected = []
    
    for op in WRITE_OPERATIONS:
        if op in query_upper:
            detected.append(op)
    
    return detected


def validate_ai_generated_query(
    query: str,
    max_nodes: int = MAX_NODES_RETURNED,
    max_rels: int = MAX_RELATIONSHIPS_RETURNED,
    require_limits: bool = True
) -> Tuple[bool, Optional[str], Dict[str, any]]:
    """
    Validate an AI-generated Cypher query with additional guardrails.
    
    Args:
        query: The AI-generated query to validate
        max_nodes: Maximum nodes that can be returned
        max_rels: Maximum relationships that can be returned
        require_limits: Whether LIMIT clauses are required
    
    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str], metadata: Dict)
    """
    metadata = {
        'has_limit': False,
        'estimated_nodes': 0,
        'estimated_rels': 0,
        'has_write_ops': False,
        'write_ops': []
    }
    
    # Basic validation
    is_valid, error = validate_cypher_query(
        query,
        security_level=QuerySecurityLevel.READ_ONLY,
        allow_write=False,
        max_nodes=max_nodes,
        max_rels=max_rels
    )
    
    if not is_valid:
        return False, error, metadata
    
    query_upper = query.upper()
    
    # Check for LIMIT clause
    if 'LIMIT' in query_upper:
        metadata['has_limit'] = True
    
    # Require LIMIT for AI-generated queries to prevent runaway queries
    if require_limits and not metadata['has_limit']:
        return False, "AI-generated queries must include a LIMIT clause", metadata
    
    # Detect write operations
    write_ops = detect_write_operations(query)
    if write_ops:
        metadata['has_write_ops'] = True
        metadata['write_ops'] = write_ops
        return False, f"AI-generated queries cannot contain write operations: {', '.join(write_ops)}", metadata
    
    # Estimate result size (basic heuristic)
    # Count MATCH patterns to estimate nodes
    match_count = len(re.findall(r'MATCH\s+\([^)]+\)', query_upper))
    metadata['estimated_nodes'] = min(match_count * 100, max_nodes)  # Rough estimate
    
    # Count relationship patterns
    rel_count = len(re.findall(r'\[[^\]]*\]', query_upper))
    metadata['estimated_rels'] = min(rel_count * 100, max_rels)  # Rough estimate
    
    return True, None, metadata


def build_safe_label_match(labels: List[str]) -> str:
    """
    Build a safe MATCH clause with validated labels.
    
    Args:
        labels: List of labels to match (will be validated)
    
    Returns:
        Safe MATCH clause string
    """
    validated_labels = []
    
    for label in labels:
        sanitized = sanitize_label_for_query(label)
        if sanitized:
            validated_labels.append(sanitized)
    
    if not validated_labels:
        return "MATCH (n)"
    
    if len(validated_labels) == 1:
        return f"MATCH (n:{validated_labels[0]})"
    
    # Multiple labels: use OR
    label_conditions = " OR ".join([f"n:{label}" for label in validated_labels])
    return f"MATCH (n) WHERE {label_conditions}"


def build_safe_relationship_match(rel_type: Optional[str] = None) -> str:
    """
    Build a safe relationship MATCH clause with validated relationship type.
    
    Args:
        rel_type: Relationship type (will be validated)
    
    Returns:
        Safe relationship MATCH clause string
    """
    if not rel_type:
        return "MATCH (a)-[r]-(b)"
    
    sanitized = sanitize_relationship_type_for_query(rel_type)
    if not sanitized:
        return "MATCH (a)-[r]-(b)"
    
    return f"MATCH (a)-[r:{sanitized}]-(b)"


def extract_parameters_from_query(query: str) -> Set[str]:
    """
    Extract parameter names from a Cypher query.
    
    Args:
        query: The Cypher query
    
    Returns:
        Set of parameter names found in the query
    """
    # Match $param_name patterns
    pattern = r'\$([a-zA-Z_][a-zA-Z0-9_]*)'
    matches = re.findall(pattern, query)
    return set(matches)


def check_parameter_usage(query: str, parameters: Optional[Dict] = None) -> Tuple[bool, Optional[str]]:
    """
    Check if all parameters in query are provided and all provided parameters are used.
    
    Args:
        query: The Cypher query
        parameters: Dictionary of parameters
    
    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    query_params = extract_parameters_from_query(query)
    provided_params = set(parameters.keys()) if parameters else set()
    
    # Check for missing parameters
    missing = query_params - provided_params
    if missing:
        return False, f"Missing parameters: {', '.join(missing)}"
    
    # Check for unused parameters (warning, not error)
    unused = provided_params - query_params
    if unused:
        logger.warning(f"Unused parameters provided: {', '.join(unused)}")
    
    return True, None
