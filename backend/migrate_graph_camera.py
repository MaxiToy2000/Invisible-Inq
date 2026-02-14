"""
Migration script to create PostgreSQL table for graph camera position storage.
Stores subscriber email, camera position (x,y,z), look-at target (x,y,z), and saved time.
"""
import sys
from neon_database import neon_db
from config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_graph_camera_table():
    """Create graph_camera_positions table in PostgreSQL."""
    if not Config.NEON_DATABASE_URL:
        logger.error("NEON_DATABASE_URL is not configured")
        sys.exit(1)

    try:
        neon_db._ensure_connected()

        query = """
        CREATE TABLE IF NOT EXISTS graph_camera_positions (
            id SERIAL PRIMARY KEY,
            subscriber_email VARCHAR(255) NOT NULL,
            position_x DOUBLE PRECISION NOT NULL,
            position_y DOUBLE PRECISION NOT NULL,
            position_z DOUBLE PRECISION NOT NULL,
            target_x DOUBLE PRECISION NOT NULL,
            target_y DOUBLE PRECISION NOT NULL,
            target_z DOUBLE PRECISION NOT NULL,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        neon_db.execute_query(query)
        logger.info("✓ graph_camera_positions table created")

        index_query = """
        CREATE INDEX IF NOT EXISTS idx_graph_camera_positions_subscriber_email
        ON graph_camera_positions(subscriber_email);
        """
        neon_db.execute_query(index_query)
        logger.info("✓ index on subscriber_email created")

        logger.info("Migration completed successfully")
    except Exception as e:
        logger.exception("Migration failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    create_graph_camera_table()
