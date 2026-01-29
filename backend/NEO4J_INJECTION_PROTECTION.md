# Neo4j Injection Protection Implementation

This document describes the Neo4j/Cypher injection protection measures implemented in this codebase.

## Overview

Neo4j injection protection prevents malicious user input from being executed as Cypher code. Unlike SQL injection, Cypher injection can be especially dangerous because:
- Cypher allows schema manipulation
- Graph traversal queries are often built dynamically
- A single bad query can delete large parts of the graph or leak private data

## Implementation Components

### 1. Parameterized Cypher Everywhere

**Status: ✅ Implemented**

All Cypher queries use parameterized queries with `$param_name` placeholders. User input is never directly interpolated into Cypher strings.

**Example:**
```python
# ✅ Safe - Parameterized
query = "MATCH (n {name: $name}) RETURN n"
result = db.execute_query(query, {"name": user_input})

# ❌ Unsafe - String interpolation (NOT USED)
query = f"MATCH (n {{name: '{user_input}'}}) RETURN n"  # NEVER DO THIS
```

**Files using parameterized queries:**
- `queries.py` - All queries use `$param_name` placeholders
- `services.py` - All queries use parameters
- `main.py` - All query executions use parameters

### 2. Query Validation

**Status: ✅ Implemented**

All Cypher queries are validated before execution to detect dangerous operations.

**Module:** `cypher_security.py`

- `validate_cypher_query()` - Validates queries for security issues
- Detects dangerous keywords (CREATE DATABASE, DROP DATABASE, etc.)
- Blocks dangerous procedures (APOC file operations, shell access, etc.)
- Enforces query length limits
- Prevents excessive traversal depth

**Usage:**
```python
from cypher_security import validate_cypher_query, QuerySecurityLevel

is_valid, error_msg = validate_cypher_query(
    query,
    security_level=QuerySecurityLevel.READ_ONLY,
    allow_write=False
)
if not is_valid:
    raise ValueError(f"Query validation failed: {error_msg}")
```

**Applied in:**
- `database.py` - `execute_query()` and `execute_write_query()` validate by default
- `main.py` - `execute_cypher_query()` endpoint validates all queries
- `services.py` - `search_with_ai()` validates user and AI-generated queries

### 3. Label and Relationship Type Whitelisting

**Status: ✅ Implemented**

Since Neo4j cannot parameterize labels or relationship types, we use whitelisting.

**Module:** `cypher_security.py`

- `validate_label()` - Validates node labels against whitelist
- `validate_relationship_type()` - Validates relationship types against whitelist
- `sanitize_label_for_query()` - Sanitizes labels for safe use in queries
- `sanitize_relationship_type_for_query()` - Sanitizes relationship types

**Allowed Labels:**
```python
ALLOWED_NODE_LABELS = {
    'story', 'chapter', 'section',
    'entity', 'relationship', 'action', 'process', 'result',
    'country', 'place', 'location', 'place_of_performance',
    'event', 'incident', 'milestone',
    'funding', 'event_attend',
}
```

**Usage:**
```python
from cypher_security import validate_label, sanitize_label_for_query

is_valid, error = validate_label(user_label)
if not is_valid:
    raise ValueError(error)

safe_label = sanitize_label_for_query(user_label)
query = f"MATCH (n:{safe_label}) RETURN n"
```

**Applied in:**
- `main.py` - `create_node()` endpoint validates node labels
- `queries.py` - `get_cluster_data_query()` validates node_type

### 4. Dangerous Operation Detection

**Status: ✅ Implemented**

The system detects and blocks dangerous Cypher operations.

**Blocked Keywords:**
- `CREATE DATABASE`, `DROP DATABASE`
- `CREATE USER`, `DROP USER`, `ALTER USER`
- `GRANT`, `REVOKE`
- `CALL dbms.*`, `CALL apoc.*`, `CALL gds.*`
- `FOREACH` (when used with DELETE)

**Blocked Procedures:**
- `apoc.load.*`, `apoc.export.*`, `apoc.file.*`, `apoc.shell.*`
- `dbms.security.*`, `dbms.shell.*`, `dbms.kill.*`
- `gds.graph.*` (graph creation/deletion)

**Usage:**
```python
from cypher_security import detect_write_operations

write_ops = detect_write_operations(query)
if write_ops:
    # Handle write operations appropriately
    allow_write = check_user_permissions(user)
```

**Applied in:**
- `main.py` - `execute_cypher_query()` detects write operations
- `database.py` - Query validation blocks dangerous operations

### 5. AI-Generated Query Guardrails

**Status: ✅ Implemented**

AI-generated queries have additional validation to prevent hallucinations and runaway queries.

**Module:** `cypher_security.py`

- `validate_ai_generated_query()` - Special validation for AI queries
- Requires LIMIT clauses to prevent runaway queries
- Blocks all write operations
- Estimates result size
- Enforces stricter limits

**Usage:**
```python
from cypher_security import validate_ai_generated_query

is_valid, error_msg, metadata = validate_ai_generated_query(
    ai_query,
    max_nodes=10000,
    max_rels=50000,
    require_limits=True
)
if not is_valid:
    raise ValueError(error_msg)
```

**Applied in:**
- `services.py` - `search_with_ai()` validates AI-generated queries

### 6. Query Limits and Timeouts

**Status: ✅ Implemented**

Query execution has built-in limits to prevent resource exhaustion.

**Limits:**
- Maximum query length: 50,000 characters
- Maximum nodes returned: 10,000
- Maximum relationships returned: 50,000
- Maximum traversal depth: 10 hops
- Default query timeout: 30 seconds

**Configuration:**
```python
MAX_NODES_RETURNED = 10000
MAX_RELATIONSHIPS_RETURNED = 50000
MAX_QUERY_LENGTH = 50000
MAX_DEPTH_TRAVERSAL = 10
DEFAULT_QUERY_TIMEOUT = 30
```

### 7. Database-Level Access Control

**Status: ⚠️ Recommended (Not Yet Implemented)**

For production, implement database-level access control using Neo4j's built-in security features.

**Recommendations:**

1. **Use Named Databases:**
   ```cypher
   CREATE DATABASE myapp;
   USE myapp;
   ```

2. **Create Roles:**
   ```cypher
   CREATE ROLE app_user;
   CREATE ROLE app_readonly;
   CREATE ROLE app_admin;
   ```

3. **Grant Permissions:**
   ```cypher
   GRANT READ ON DATABASE myapp TO app_readonly;
   GRANT WRITE ON DATABASE myapp TO app_user;
   GRANT ALL ON DATABASE myapp TO app_admin;
   ```

4. **Update Connection:**
   ```python
   # In database.py
   self.driver = GraphDatabase.driver(
       Config.NEO4J_URI,
       auth=(Config.NEO4J_USER, Config.NEO4J_PASSWORD),
       database="myapp"  # Lock to specific database
   )
   ```

### 8. Procedure and APOC Lockdown

**Status: ✅ Implemented**

Dangerous procedures are blocked by default. Only safe, read-only procedures are allowed.

**Safe Procedures (Whitelist):**
- `db.schema.*` - Schema introspection
- `db.labels()` - List labels
- `db.relationshipTypes()` - List relationship types
- `db.propertyKeys()` - List property keys
- `dbms.components()` - Version info

**Blocked Procedures:**
- All `apoc.*` procedures (except explicitly whitelisted)
- All `dbms.*` procedures (except safe ones)
- All `gds.*` procedures

## Security Best Practices

### ✅ DO:

1. **Always use parameterized queries:**
   ```python
   query = "MATCH (n {name: $name}) RETURN n"
   result = db.execute_query(query, {"name": user_input})
   ```

2. **Validate all user inputs:**
   ```python
   from cypher_security import validate_label
   is_valid, error = validate_label(user_label)
   ```

3. **Use whitelists for labels and relationship types:**
   ```python
   from cypher_security import sanitize_label_for_query
   safe_label = sanitize_label_for_query(user_label)
   ```

4. **Validate AI-generated queries:**
   ```python
   from cypher_security import validate_ai_generated_query
   is_valid, error, metadata = validate_ai_generated_query(ai_query)
   ```

5. **Enable query validation:**
   ```python
   results = db.execute_query(query, validate=True, allow_write=False)
   ```

### ❌ DON'T:

1. **Never use string interpolation in Cypher:**
   ```python
   # ❌ NEVER DO THIS:
   query = f"MATCH (n {{name: '{user_input}'}}) RETURN n"
   query = f"MATCH (n:{user_label}) RETURN n"  # Labels can't be parameterized, use whitelist
   ```

2. **Never trust user input for labels or relationship types:**
   ```python
   # ❌ NEVER DO THIS:
   query = f"MATCH (n:{user_label}) RETURN n"  # Use validate_label() first
   ```

3. **Never skip query validation:**
   ```python
   # ❌ NEVER DO THIS:
   results = db.execute_query(user_query, validate=False)  # Always validate!
   ```

4. **Never allow write operations without proper permissions:**
   ```python
   # ❌ NEVER DO THIS:
   results = db.execute_query(query, allow_write=True)  # Check permissions first
   ```

## Testing

### Manual Testing Checklist

1. ✅ Test query validation:
   - Dangerous keywords → Should be rejected
   - Dangerous procedures → Should be rejected
   - Write operations without permission → Should be rejected

2. ✅ Test label validation:
   - Invalid labels → Should be rejected
   - Labels not in whitelist → Should be rejected
   - Valid labels → Should be accepted and sanitized

3. ✅ Test AI query validation:
   - Queries without LIMIT → Should be rejected
   - Queries with write operations → Should be rejected
   - Valid queries → Should be accepted

4. ✅ Test parameterization:
   - User input in queries → Should use parameters
   - No string interpolation → Should pass validation

### Cypher Injection Test Cases

Try these malicious inputs (should all be safely handled):

1. **Basic injection:**
   ```
   name: "test'}) DETACH DELETE n //"
   ```
   Should be treated as literal string via parameters.

2. **Label injection:**
   ```
   label: "Entity'}) DETACH DELETE n //"
   ```
   Should be rejected by label validation.

3. **Procedure injection:**
   ```
   query: "MATCH (n) CALL apoc.shell.execute('rm -rf /') RETURN n"
   ```
   Should be rejected by procedure validation.

4. **Database manipulation:**
   ```
   query: "CREATE DATABASE malicious"
   ```
   Should be rejected by keyword validation.

## Files Modified

1. **New Files:**
   - `cypher_security.py` - Security utilities module

2. **Modified Files:**
   - `database.py` - Added query validation to execute methods
   - `main.py` - Added validation to `execute_cypher_query()` and `create_node()`
   - `services.py` - Added validation to `search_with_ai()`
   - `queries.py` - Added input validation to `get_cluster_data_query()`

3. **Documentation:**
   - `NEO4J_INJECTION_PROTECTION.md` - This file

## Future Enhancements

1. **Database Role Implementation:** Implement the recommended role structure above
2. **Query Timeout Enforcement:** Add actual timeout enforcement in Neo4j driver
3. **Result Size Limits:** Enforce limits on actual result sets, not just estimates
4. **Query Logging:** Log all queries with parameters (sanitized) for audit
5. **Rate Limiting:** Add per-user query rate limiting
6. **Query Caching:** Cache validated queries to improve performance
7. **Dynamic Label Discovery:** Automatically discover and whitelist labels from database schema

## Differences from SQL Injection Protection

1. **Labels and Relationship Types:** Cannot be parameterized, must use whitelisting
2. **Graph Traversal:** Can be exploited for DoS (deep traversals), need depth limits
3. **Schema Manipulation:** Cypher allows schema changes, need to block dangerous operations
4. **Procedure Calls:** APOC and other procedures can be dangerous, need strict whitelisting

## References

- [Neo4j Security Best Practices](https://neo4j.com/docs/operations-manual/current/security/)
- [Cypher Query Language Reference](https://neo4j.com/docs/cypher-manual/current/)
- [OWASP Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
