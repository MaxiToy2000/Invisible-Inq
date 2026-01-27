# Postgres Injection Protection Implementation

This document describes the Postgres injection protection measures implemented in this codebase.

## Overview

Postgres injection protection prevents malicious user input from being executed as SQL commands. All user inputs are treated as data only, never as executable SQL.

## Implementation Components

### 1. Parameterized Queries Everywhere

**Status: ✅ Implemented**

All Postgres queries use parameterized queries with `%s` placeholders. User input is never directly interpolated into SQL strings.

**Example:**
```python
# ✅ Safe - Parameterized
query = "SELECT * FROM users WHERE email = %s"
result = neon_db.execute_query(query, (user_email,))

# ❌ Unsafe - String interpolation (NOT USED)
query = f"SELECT * FROM users WHERE email = '{user_email}'"  # NEVER DO THIS
```

**Files using parameterized queries:**
- `submission_service.py` - All queries use `%s` placeholders
- `user_service.py` - All queries use `%s` placeholders
- `audit_service.py` - All queries use `%s` placeholders
- `activity_service.py` - All queries use `%s` placeholders
- `services.py` - All queries use `%s` placeholders

### 2. Input Validation at Boundaries

**Status: ✅ Implemented**

All user inputs are validated before being used in queries.

#### 2.1 Limit and Offset Validation

**Module:** `sql_security.py`

- `validate_limit()` - Validates LIMIT values (max: 10,000)
- `validate_offset()` - Validates OFFSET values (max: 100,000)
- Prevents negative values
- Converts invalid types to defaults

**Usage:**
```python
from sql_security import validate_limit, validate_offset

validated_limit = validate_limit(limit, default=100)
validated_offset = validate_offset(offset)
```

**Applied in:**
- `activity_service.py` - `get_activities()`
- `audit_service.py` - `get_audit_logs()`
- `user_service.py` - `get_all_users()`
- `submission_service.py` - `get_user_submissions()`, `get_all_submissions()`

#### 2.2 ID Validation

**Module:** `sql_security.py`

- `validate_id()` - Validates UUID or numeric ID formats
- Prevents injection through ID parameters

**Usage:**
```python
from sql_security import validate_id

validated_id = validate_id(submission_id)
if not validated_id:
    return None  # Invalid ID
```

**Applied in:**
- `submission_service.py` - `get_submission()`, `process_submission()`

#### 2.3 String Input Validation

**Module:** `sql_security.py`

- `validate_string_input()` - Validates and sanitizes string inputs
- Enforces maximum length limits
- Trims whitespace

**Usage:**
```python
from sql_security import validate_string_input

validated_search = validate_string_input(search_term, max_length=1000)
```

**Applied in:**
- `services.py` - `search_entity_wikidata()`

### 3. Column Name Whitelisting

**Status: ✅ Implemented**

Dynamic column selection uses whitelists to prevent injection.

**Module:** `sql_security.py`

- `validate_column_name()` - Validates column names against whitelist
- `sanitize_identifier()` - Sanitizes SQL identifiers (alphanumeric, underscore, dot only)

**Usage:**
```python
from sql_security import validate_column_name, build_set_clause

# For UPDATE statements
allowed_fields = ['full_name', 'profile_picture']
set_clause, params = build_set_clause(allowed_fields, updates)
```

**Applied in:**
- `user_service.py` - `update_user_profile()` - Only allows updates to whitelisted fields

### 4. Safe WHERE Clause Construction

**Status: ✅ Implemented**

Dynamic WHERE clauses are built safely using parameterized conditions.

**Module:** `sql_security.py`

- `build_where_clause()` - Safely builds WHERE clauses from condition lists
- Ensures all conditions use `%s` placeholders
- Prevents string interpolation in WHERE clauses

**Usage:**
```python
from sql_security import build_where_clause

conditions = []
params = []

if user_id:
    conditions.append("user_id = %s")  # Must use %s
    params.append(user_id)

where_clause, params = build_where_clause(conditions, params)
```

**Applied in:**
- `activity_service.py` - `get_activities()`
- `audit_service.py` - `get_audit_logs()`

### 5. Sort Field Validation

**Status: ✅ Available (Not Currently Used)**

The `sql_security.py` module includes `validate_sort_field()` for validating ORDER BY fields.

**Usage:**
```python
from sql_security import validate_sort_field

allowed_sort_fields = ['created_at', 'email', 'full_name']
validated_sort = validate_sort_field(sort_field, allowed_sort_fields, default='created_at')
```

**Note:** Currently, all queries use hardcoded ORDER BY clauses. If dynamic sorting is needed in the future, use this function.

## Security Best Practices

### ✅ DO:

1. **Always use parameterized queries:**
   ```python
   query = "SELECT * FROM table WHERE id = %s"
   result = neon_db.execute_query(query, (id_value,))
   ```

2. **Validate all user inputs:**
   ```python
   validated_limit = validate_limit(limit)
   validated_id = validate_id(user_id)
   ```

3. **Use whitelists for dynamic column/field selection:**
   ```python
   allowed_fields = ['field1', 'field2']
   set_clause, params = build_set_clause(allowed_fields, updates)
   ```

4. **Build WHERE clauses safely:**
   ```python
   conditions = ["field = %s"]  # Always use %s
   where_clause, params = build_where_clause(conditions, params)
   ```

### ❌ DON'T:

1. **Never use string interpolation in SQL:**
   ```python
   # ❌ NEVER DO THIS:
   query = f"SELECT * FROM users WHERE email = '{email}'"
   query = "SELECT * FROM users WHERE email = '" + email + "'"
   ```

2. **Never trust user input for column/table names:**
   ```python
   # ❌ NEVER DO THIS:
   query = f"SELECT * FROM {table_name}"  # Use whitelist instead
   query = f"ORDER BY {sort_field}"  # Use validate_sort_field()
   ```

3. **Never skip input validation:**
   ```python
   # ❌ NEVER DO THIS:
   result = neon_db.execute_query(query, (user_input,))  # Validate first!
   ```

## Database Role Configuration (Recommendations)

### Current Status

The application currently uses a single database connection with full privileges. For production, implement least-privilege database roles.

### Recommended Role Structure

#### 1. Application Role (Read-Write)
- **Name:** `app_user`
- **Permissions:**
  - SELECT, INSERT, UPDATE, DELETE on application tables
  - NO DROP, ALTER, CREATE, TRUNCATE privileges
  - NO access to system tables

#### 2. Read-Only Role (Analytics/Reporting)
- **Name:** `app_readonly`
- **Permissions:**
  - SELECT only on application tables
  - NO write privileges

#### 3. Admin Role (Migrations/Setup)
- **Name:** `app_admin`
- **Permissions:**
  - Full privileges for migrations
  - Only used during deployment/migrations

### Implementation Steps

1. **Create roles in PostgreSQL:**
   ```sql
   -- Application user (read-write)
   CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
   
   -- Read-only user (for analytics)
   CREATE ROLE app_readonly WITH LOGIN PASSWORD 'secure_password';
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
   
   -- Admin user (for migrations)
   CREATE ROLE app_admin WITH LOGIN PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_admin;
   ```

2. **Update connection strings:**
   - Use `app_user` for normal application operations
   - Use `app_readonly` for analytics/reporting endpoints
   - Use `app_admin` only during migrations

3. **Update `neon_database.py`:**
   ```python
   # Add role selection based on operation type
   def get_connection(self, read_only=False):
       if read_only:
           # Use app_readonly role
           ...
       else:
           # Use app_user role
           ...
   ```

### Table-Specific Permissions

For additional security, grant permissions per table:

```sql
-- Grant specific permissions per table
GRANT SELECT, INSERT, UPDATE ON submissions TO app_user;
GRANT SELECT ON submissions TO app_readonly;

GRANT SELECT, INSERT, UPDATE ON users TO app_user;
GRANT SELECT ON users TO app_readonly;

-- Audit logs: write-only for app_user, read for admin
GRANT INSERT ON audit_log TO app_user;
GRANT SELECT ON audit_log TO app_admin;
```

## Testing

### Manual Testing Checklist

1. ✅ Test limit/offset validation:
   - Negative values → Should default to 0
   - Values > MAX → Should cap to MAX
   - Non-numeric values → Should default

2. ✅ Test ID validation:
   - Invalid UUID format → Should return None
   - SQL injection attempts in ID → Should be rejected

3. ✅ Test string input validation:
   - Very long strings → Should be truncated
   - Special characters → Should be handled safely via parameterization

4. ✅ Test WHERE clause building:
   - Empty conditions → Should return "WHERE 1=1" or empty
   - Multiple conditions → Should join with AND

### SQL Injection Test Cases

Try these malicious inputs (should all be safely handled):

1. **Basic injection:**
   ```
   user_id: "1' OR '1'='1"
   ```
   Should be treated as literal string, not SQL.

2. **Union attack:**
   ```
   search_term: "test' UNION SELECT * FROM users--"
   ```
   Should be treated as literal string.

3. **Comment injection:**
   ```
   id: "1; DROP TABLE users; --"
   ```
   Should be rejected by ID validation or treated as literal.

## Files Modified

1. **New Files:**
   - `sql_security.py` - Security utilities module

2. **Modified Files:**
   - `activity_service.py` - Added input validation and safe WHERE clause building
   - `audit_service.py` - Added input validation and safe WHERE clause building
   - `user_service.py` - Added input validation and safe SET clause building
   - `submission_service.py` - Added ID and limit/offset validation
   - `services.py` - Added string input validation for search

3. **Documentation:**
   - `POSTGRES_INJECTION_PROTECTION.md` - This file

## Future Enhancements

1. **Query Logging:** Log all SQL queries with parameters (sanitized) for audit
2. **Rate Limiting:** Already implemented, but can be enhanced
3. **Input Sanitization:** Additional sanitization for specific data types (URLs, emails, etc.)
4. **Prepared Statements:** Consider using prepared statements for frequently executed queries
5. **Database Role Implementation:** Implement the recommended role structure above

## References

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [psycopg2 Documentation](https://www.psycopg.org/docs/)
