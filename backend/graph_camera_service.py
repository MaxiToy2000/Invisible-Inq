"""
Graph camera position service for PostgreSQL.
Stores and retrieves the last saved graph view (camera position + target) per subscriber email.
"""
from typing import Optional
from datetime import datetime
from neon_database import neon_db
import logging

logger = logging.getLogger(__name__)


def save_camera_position(
    subscriber_email: str,
    position_x: float,
    position_y: float,
    position_z: float,
    target_x: float,
    target_y: float,
    target_z: float,
) -> bool:
    """
    Save or update the graph camera position for a subscriber.
    Uses upsert: insert new row per save (keep history) or update latest by email.
    We store one row per user (latest overwrites) by deleting previous and inserting.
    """
    try:
        delete_query = """
        DELETE FROM graph_camera_positions WHERE subscriber_email = %s
        """
        neon_db.execute_write_query(delete_query, (subscriber_email,))

        insert_query = """
        INSERT INTO graph_camera_positions
        (subscriber_email, position_x, position_y, position_z, target_x, target_y, target_z, saved_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        neon_db.execute_write_query(
            insert_query,
            (subscriber_email, position_x, position_y, position_z, target_x, target_y, target_z),
        )
        return True
    except Exception as e:
        logger.exception("Error saving graph camera position: %s", e)
        return False


def get_camera_position(subscriber_email: str) -> Optional[dict]:
    """
    Get the most recent saved graph camera position for a subscriber.
    Returns dict with position_x, position_y, position_z, target_x, target_y, target_z, saved_at,
    or None if not found.
    """
    try:
        query = """
        SELECT subscriber_email, position_x, position_y, position_z,
               target_x, target_y, target_z, saved_at
        FROM graph_camera_positions
        WHERE subscriber_email = %s
        ORDER BY saved_at DESC
        LIMIT 1
        """
        rows = neon_db.execute_query(query, (subscriber_email,))
        if not rows:
            return None
        row = rows[0]
        return {
            "subscriber_email": row["subscriber_email"],
            "position_x": float(row["position_x"]),
            "position_y": float(row["position_y"]),
            "position_z": float(row["position_z"]),
            "target_x": float(row["target_x"]),
            "target_y": float(row["target_y"]),
            "target_z": float(row["target_z"]),
            "saved_at": row["saved_at"],
        }
    except Exception as e:
        logger.exception("Error getting graph camera position: %s", e)
        return None
