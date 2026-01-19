"""
User activity tracking service for analytics
Uses PostgreSQL (Neon) instead of Neo4j
"""
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import logging
from neon_database import neon_db
from models import UserActivityCreate, UserActivityResponse
import json

logger = logging.getLogger(__name__)

def create_activity(activity_data: UserActivityCreate) -> Optional[UserActivityResponse]:
    """
    Create a new activity record in PostgreSQL database
    
    Args:
        activity_data: Activity data to record
    
    Returns:
        UserActivityResponse if successful, None otherwise
    """
    try:
        # Insert activity into PostgreSQL
        query = """
        INSERT INTO user_activities (user_id, session_id, activity_type, page_url, 
                                     section_id, section_title, duration_seconds, metadata, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        RETURNING id, user_id, session_id, activity_type, page_url, section_id, 
                  section_title, duration_seconds, metadata, timestamp
        """
        
        # Convert metadata dict to JSON string if present
        metadata_json = None
        if activity_data.metadata:
            metadata_json = json.dumps(activity_data.metadata)
        
        params = (
            activity_data.user_id,
            activity_data.session_id,
            activity_data.activity_type,
            activity_data.page_url,
            activity_data.section_id,
            activity_data.section_title,
            activity_data.duration_seconds,
            metadata_json
        )
        
        result = neon_db.execute_query(query, params)
        
        if result and len(result) > 0:
            activity_row = result[0]
            
            # Parse metadata JSON back to dict
            metadata = None
            if activity_row.get('metadata'):
                try:
                    metadata = json.loads(activity_row['metadata']) if isinstance(activity_row['metadata'], str) else activity_row['metadata']
                except:
                    metadata = activity_row.get('metadata')
            
            return UserActivityResponse(
                id=str(activity_row['id']),
                user_id=activity_row.get('user_id'),
                session_id=activity_row.get('session_id'),
                activity_type=activity_row.get('activity_type'),
                page_url=activity_row.get('page_url'),
                section_id=activity_row.get('section_id'),
                section_title=activity_row.get('section_title'),
                duration_seconds=activity_row.get('duration_seconds'),
                metadata=metadata,
                timestamp=activity_row.get('timestamp')
            )
        
        return None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error creating activity: {error_msg}")
        # Check if table doesn't exist
        if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
            logger.error("PostgreSQL 'user_activities' table does not exist. Please run migration script.")
        # Re-raise exception so caller can handle it
        raise

def get_activities(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    activity_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    skip: int = 0
) -> List[UserActivityResponse]:
    """
    Get activities with optional filters
    
    Args:
        user_id: Filter by user ID
        session_id: Filter by session ID
        activity_type: Filter by activity type
        start_date: Filter by start date
        end_date: Filter by end date
        limit: Maximum number of results
        skip: Number of results to skip
    
    Returns:
        List of UserActivityResponse objects
    """
    try:
        # Build query with filters
        where_clauses = []
        params = []
        
        if user_id:
            where_clauses.append("ua.user_id = %s")
            params.append(user_id)
        
        if session_id:
            where_clauses.append("ua.session_id = %s")
            params.append(session_id)
        
        if activity_type:
            where_clauses.append("ua.activity_type = %s")
            params.append(activity_type)
        
        if start_date:
            where_clauses.append("ua.timestamp >= %s")
            params.append(start_date)
        
        if end_date:
            where_clauses.append("ua.timestamp <= %s")
            params.append(end_date)
        
        where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        query = f"""
        SELECT ua.id, ua.user_id, ua.session_id, ua.activity_type, ua.page_url,
               ua.section_id, ua.section_title, ua.duration_seconds, ua.metadata,
               ua.timestamp, 
               COALESCE(u.email, au.email) as user_email, 
               COALESCE(u.full_name, au.full_name) as user_name
        FROM user_activities ua
        LEFT JOIN users u ON ua.user_id = CAST(u.id AS VARCHAR)
        LEFT JOIN admin_users au ON ua.user_id = CAST(au.id AS VARCHAR)
        WHERE {where_clause}
        ORDER BY ua.timestamp DESC
        LIMIT %s OFFSET %s
        """
        
        params.extend([limit, skip])
        
        result = neon_db.execute_query(query, tuple(params))
        
        activities = []
        for row in result:
            # Parse metadata JSON
            metadata = None
            if row.get('metadata'):
                try:
                    metadata = json.loads(row['metadata']) if isinstance(row['metadata'], str) else row['metadata']
                except:
                    metadata = row.get('metadata')
            
            activities.append(UserActivityResponse(
                id=str(row['id']),
                user_id=row.get('user_id'),
                session_id=row.get('session_id'),
                activity_type=row.get('activity_type'),
                page_url=row.get('page_url'),
                section_id=row.get('section_id'),
                section_title=row.get('section_title'),
                duration_seconds=row.get('duration_seconds'),
                metadata=metadata,
                timestamp=row.get('timestamp'),
                user_email=row.get('user_email'),
                user_name=row.get('user_name')
            ))
        
        return activities
    except Exception as e:
        logger.error(f"Error getting activities: {e}")
        return []

def get_activity_statistics(days: int = 7) -> Dict:
    """
    Get activity statistics for the dashboard
    
    Args:
        days: Number of days to look back
    
    Returns:
        Dictionary with statistics
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Total activities
        total_query = """
        SELECT COUNT(*) as total
        FROM user_activities
        WHERE timestamp >= %s
        """
        
        # Unique users
        unique_users_query = """
        SELECT COUNT(DISTINCT user_id) as unique_users
        FROM user_activities
        WHERE timestamp >= %s AND user_id IS NOT NULL
        """
        
        # Unique sessions
        unique_sessions_query = """
        SELECT COUNT(DISTINCT session_id) as unique_sessions
        FROM user_activities
        WHERE timestamp >= %s
        """
        
        # Total duration
        total_duration_query = """
        SELECT COALESCE(SUM(duration_seconds), 0) as total_duration
        FROM user_activities
        WHERE timestamp >= %s AND duration_seconds IS NOT NULL
        """
        
        # Activity by type
        by_type_query = """
        SELECT activity_type as type, COUNT(*) as count
        FROM user_activities
        WHERE timestamp >= %s
        GROUP BY activity_type
        ORDER BY count DESC
        """
        
        # Top sections viewed
        top_sections_query = """
        SELECT section_title as section, COUNT(*) as views
        FROM user_activities
        WHERE timestamp >= %s 
          AND section_title IS NOT NULL 
          AND activity_type IN ('section_view', 'page_view')
        GROUP BY section_title
        ORDER BY views DESC
        LIMIT 10
        """
        
        # Activities by day
        by_day_query = """
        SELECT DATE(timestamp) as day, COUNT(*) as count
        FROM user_activities
        WHERE timestamp >= %s
        GROUP BY DATE(timestamp)
        ORDER BY day ASC
        """
        
        params = (start_date,)
        
        total_result = neon_db.execute_query(total_query, params)
        unique_users_result = neon_db.execute_query(unique_users_query, params)
        unique_sessions_result = neon_db.execute_query(unique_sessions_query, params)
        total_duration_result = neon_db.execute_query(total_duration_query, params)
        by_type_result = neon_db.execute_query(by_type_query, params)
        top_sections_result = neon_db.execute_query(top_sections_query, params)
        by_day_result = neon_db.execute_query(by_day_query, params)
        
        return {
            "total_activities": total_result[0].get('total', 0) if total_result else 0,
            "unique_users": unique_users_result[0].get('unique_users', 0) if unique_users_result else 0,
            "unique_sessions": unique_sessions_result[0].get('unique_sessions', 0) if unique_sessions_result else 0,
            "total_duration_seconds": int(total_duration_result[0].get('total_duration', 0)) if total_duration_result else 0,
            "activities_by_type": [{"type": r.get('type'), "count": r.get('count')} for r in by_type_result],
            "top_sections": [{"section": r.get('section'), "views": r.get('views')} for r in top_sections_result],
            "activities_by_day": [{"date": str(r.get('day')), "count": r.get('count')} for r in by_day_result],
            "period_days": days
        }
    except Exception as e:
        logger.error(f"Error getting activity statistics: {e}")
        return {
            "total_activities": 0,
            "unique_users": 0,
            "unique_sessions": 0,
            "total_duration_seconds": 0,
            "activities_by_type": [],
            "top_sections": [],
            "activities_by_day": [],
            "period_days": days,
            "error": str(e)
        }

def get_user_activity_summary(user_id: str, days: int = 30) -> Dict:
    """
    Get activity summary for a specific user
    
    Args:
        user_id: User ID
        days: Number of days to look back
    
    Returns:
        Dictionary with user activity summary
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        query = """
        SELECT activity_type as type, 
               COUNT(*) as count,
               COALESCE(SUM(duration_seconds), 0) as total_duration
        FROM user_activities
        WHERE user_id = %s AND timestamp >= %s
        GROUP BY activity_type
        ORDER BY count DESC
        """
        
        params = (user_id, start_date)
        result = neon_db.execute_query(query, params)
        
        return {
            "user_id": user_id,
            "period_days": days,
            "activities": [
                {
                    "type": r.get('type'),
                    "count": r.get('count'),
                    "total_duration_seconds": int(r.get('total_duration', 0))
                }
                for r in result
            ]
        }
    except Exception as e:
        logger.error(f"Error getting user activity summary: {e}")
        return {
            "user_id": user_id,
            "period_days": days,
            "activities": [],
            "error": str(e)
        }
