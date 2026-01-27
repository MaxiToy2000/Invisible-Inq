"""
Audit logging service for tracking user actions
Implements User Identity Model requirement: user context attached to actions
"""
from typing import Optional, Dict, Any
from datetime import datetime
import logging
from neon_database import neon_db
from fastapi import Request
from sql_security import validate_limit, validate_offset, build_where_clause

logger = logging.getLogger(__name__)


def log_action(
    user_id: Optional[int],
    user_email: Optional[str],
    action_type: str,
    source: str,  # ingestion, query, editor, etc.
    resource_type: Optional[str] = None,  # node, graph, submission, etc.
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> bool:
    """
    Log a user action to the audit_log table.
    
    Args:
        user_id: User ID (optional for anonymous actions)
        user_email: User email (optional, for easier querying)
        action_type: Type of action (e.g., "create_node", "delete_node", "ingest_url", "run_query")
        source: Source of action (ingestion, query, editor, etc.)
        resource_type: Type of resource affected (node, graph, submission, etc.)
        resource_id: ID of the resource affected
        details: Additional details as JSON
        request: FastAPI Request object (optional, used to extract IP and user agent)
    
    Returns:
        True if logged successfully, False otherwise
    """
    try:
        # Extract IP address and user agent from request if provided
        ip_address = None
        user_agent = None
        if request:
            # Get client IP (handles proxies)
            ip_address = request.client.host if request.client else None
            # Try to get real IP from X-Forwarded-For header
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                ip_address = forwarded_for.split(",")[0].strip()
            user_agent = request.headers.get("User-Agent")
        
        query = """
        INSERT INTO audit_log (
            user_id, user_email, action_type, source, resource_type, resource_id,
            details, ip_address, user_agent, timestamp
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        
        import json
        details_json = json.dumps(details) if details else None
        
        params = (
            user_id,
            user_email,
            action_type,
            source,
            resource_type,
            resource_id,
            details_json,
            ip_address,
            user_agent
        )
        
        neon_db.execute_write_query(query, params)
        logger.debug(f"Audit log created: {action_type} by {user_email or 'anonymous'}")
        return True
        
    except Exception as e:
        logger.error(f"Error logging audit action: {e}")
        # Don't raise exception - audit logging failures shouldn't break the app
        return False


def get_audit_logs(
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    action_type: Optional[str] = None,
    source: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> list:
    """
    Retrieve audit logs with optional filters.
    
    Args:
        user_id: Filter by user ID
        user_email: Filter by user email
        action_type: Filter by action type
        source: Filter by source
        resource_type: Filter by resource type
        resource_id: Filter by resource ID
        start_date: Filter by start date
        end_date: Filter by end date
        limit: Maximum number of results
        offset: Number of results to skip
    
    Returns:
        List of audit log records
    """
    try:
        # Validate limit and offset
        validated_limit = validate_limit(limit)
        validated_offset = validate_offset(offset)
        
        conditions = []
        params = []
        
        if user_id:
            conditions.append("user_id = %s")
            params.append(user_id)
        
        if user_email:
            conditions.append("user_email = %s")
            params.append(user_email)
        
        if action_type:
            conditions.append("action_type = %s")
            params.append(action_type)
        
        if source:
            conditions.append("source = %s")
            params.append(source)
        
        if resource_type:
            conditions.append("resource_type = %s")
            params.append(resource_type)
        
        if resource_id:
            conditions.append("resource_id = %s")
            params.append(resource_id)
        
        if start_date:
            conditions.append("timestamp >= %s")
            params.append(start_date)
        
        if end_date:
            conditions.append("timestamp <= %s")
            params.append(end_date)
        
        # Build WHERE clause safely
        where_clause, params = build_where_clause(conditions, params)
        if not where_clause:
            where_clause = ""
        
        query = """
        SELECT id, user_id, user_email, action_type, source, resource_type, resource_id,
               details, ip_address, user_agent, timestamp
        FROM audit_log
        {where_clause}
        ORDER BY timestamp DESC
        LIMIT %s OFFSET %s
        """.format(where_clause=where_clause)
        
        params.extend([validated_limit, validated_offset])
        
        results = neon_db.execute_query(query, tuple(params))
        
        # Parse JSON details
        import json
        logs = []
        for row in results:
            details = None
            if row.get('details'):
                try:
                    details = json.loads(row['details']) if isinstance(row['details'], str) else row['details']
                except:
                    details = row['details']
            
            logs.append({
                "id": row['id'],
                "user_id": row.get('user_id'),
                "user_email": row.get('user_email'),
                "action_type": row['action_type'],
                "source": row['source'],
                "resource_type": row.get('resource_type'),
                "resource_id": row.get('resource_id'),
                "details": details,
                "ip_address": row.get('ip_address'),
                "user_agent": row.get('user_agent'),
                "timestamp": row['timestamp']
            })
        
        return logs
        
    except Exception as e:
        logger.error(f"Error retrieving audit logs: {e}")
        return []


def get_user_action_summary(user_id: int, days: int = 30) -> Dict[str, Any]:
    """
    Get summary of user actions for a specific user.
    
    Args:
        user_id: User ID
        days: Number of days to look back
    
    Returns:
        Dictionary with action counts and summary
    """
    try:
        from datetime import timedelta
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get action counts by type
        query = """
        SELECT action_type, COUNT(*) as count
        FROM audit_log
        WHERE user_id = %s AND timestamp >= %s
        GROUP BY action_type
        ORDER BY count DESC
        """
        
        results = neon_db.execute_query(query, (user_id, start_date))
        
        action_counts = {row['action_type']: row['count'] for row in results}
        
        # Get total actions
        total_query = """
        SELECT COUNT(*) as total
        FROM audit_log
        WHERE user_id = %s AND timestamp >= %s
        """
        
        total_result = neon_db.execute_query(total_query, (user_id, start_date))
        total_actions = total_result[0]['total'] if total_result else 0
        
        return {
            "user_id": user_id,
            "period_days": days,
            "total_actions": total_actions,
            "action_counts": action_counts
        }
        
    except Exception as e:
        logger.error(f"Error getting user action summary: {e}")
        return {
            "user_id": user_id,
            "period_days": days,
            "total_actions": 0,
            "action_counts": {}
        }
