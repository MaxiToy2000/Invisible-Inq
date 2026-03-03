"""
User session service for PostgreSQL.
Stores and retrieves the latest saved user session (full UI state) per user email.
"""
from typing import Optional, Any, Dict
from datetime import datetime
from neon_database import neon_db
import logging
import json

logger = logging.getLogger(__name__)


def save_user_session(user_email: str, session_data: Dict[str, Any]) -> bool:
    """
    Upsert user session: update existing row for this user if one exists, otherwise insert.
    One row per user (latest session overwrites). Returns True on success.
    """
    try:
        session_json = json.dumps(session_data) if isinstance(session_data, dict) else session_data
        upsert_query = """
        INSERT INTO user_session (user_email, session_data, saved_at)
        VALUES (%s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (user_email) DO UPDATE SET
            session_data = EXCLUDED.session_data,
            saved_at = CURRENT_TIMESTAMP
        """
        neon_db.execute_write_query(upsert_query, (user_email, session_json))
        return True
    except Exception as e:
        logger.exception("Error saving user session: %s", e)
        return False


def delete_user_session(user_email: str) -> bool:
    """
    Delete the user_session row for this user. Returns True on success.
    """
    try:
        query = "DELETE FROM user_session WHERE user_email = %s"
        neon_db.execute_write_query(query, (user_email,))
        return True
    except Exception as e:
        logger.exception("Error deleting user session: %s", e)
        return False


def get_latest_user_session(user_email: str) -> Optional[Dict[str, Any]]:
    """
    Get the saved user session for this user (one row per user after upsert).
    Returns dict with id, user_email, session_data (parsed), saved_at, or None if not found.
    """
    try:
        query = """
        SELECT id, user_email, session_data, saved_at
        FROM user_session
        WHERE user_email = %s
        LIMIT 1
        """
        rows = neon_db.execute_query(query, (user_email,))
        if not rows:
            return None
        row = rows[0]
        session_data = row["session_data"]
        if isinstance(session_data, str):
            session_data = json.loads(session_data)
        return {
            "id": row["id"],
            "user_email": row["user_email"],
            "session_data": session_data,
            "saved_at": row["saved_at"],
        }
    except Exception as e:
        logger.exception("Error getting user session: %s", e)
        return None
