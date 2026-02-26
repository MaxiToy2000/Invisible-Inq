"""
Migration script to create PostgreSQL table for user session storage.
Stores one row per user: user_email (UNIQUE), session_data (JSONB), saved_at.
Save XYZ uses upsert: update existing row or insert if none.
"""
import sys
from neon_database import neon_db
from config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_user_session_table():
    """Create user_session table in PostgreSQL with UNIQUE(user_email) for upsert."""
    if not Config.NEON_DATABASE_URL:
        logger.error("NEON_DATABASE_URL is not configured")
        sys.exit(1)

    try:
        neon_db._ensure_connected()

        # Create table if not exists (with UNIQUE for new installs)
        query = """
        CREATE TABLE IF NOT EXISTS user_session (
            id SERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL UNIQUE,
            session_data JSONB NOT NULL,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        neon_db.execute_query(query)
        logger.info("✓ user_session table created or already exists")

        # If table existed without UNIQUE: remove duplicate rows (keep latest per user), then add UNIQUE
        dedupe_query = """
        DELETE FROM user_session a
        USING user_session b
        WHERE a.user_email = b.user_email AND a.saved_at < b.saved_at;
        """
        neon_db.execute_query(dedupe_query)
        logger.info("✓ duplicate rows removed (keep latest per user)")

        # Add UNIQUE constraint if missing (for tables created before this migration)
        try:
            alter_query = """
            ALTER TABLE user_session
            ADD CONSTRAINT user_session_user_email_key UNIQUE (user_email);
            """
            neon_db.execute_query(alter_query)
            logger.info("✓ UNIQUE constraint on user_email added")
        except Exception as alter_err:
            if "already exists" in str(alter_err).lower() or "duplicate key" in str(alter_err).lower():
                logger.info("✓ UNIQUE constraint on user_email already exists")
            else:
                raise alter_err

        index_query = """
        CREATE INDEX IF NOT EXISTS idx_user_session_user_email
        ON user_session(user_email);
        """
        neon_db.execute_query(index_query)

        logger.info("Migration completed successfully")
    except Exception as e:
        logger.exception("Migration failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    create_user_session_table()
