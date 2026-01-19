"""
Migration script to create PostgreSQL tables for user authentication
Creates tables for users, admin_users, and user_activities in the Neon PostgreSQL database
"""
import sys
from neon_database import neon_db
from config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_admin_tables():
    """Create tables for users, admin users, and activities in PostgreSQL"""
    
    if not Config.NEON_DATABASE_URL:
        logger.error("NEON_DATABASE_URL is not configured")
        sys.exit(1)
    
    try:
        # Connect to database
        neon_db._connect()
        
        # Create users table for regular users
        users_table_query = """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            full_name VARCHAR(255),
            hashed_password TEXT,
            profile_picture TEXT,
            auth_provider VARCHAR(50) DEFAULT 'local',
            is_active BOOLEAN DEFAULT TRUE,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        # Create index on email for faster lookups
        users_email_index = """
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        """
        
        # Create users table for admin users
        admin_users_table_query = """
        CREATE TABLE IF NOT EXISTS admin_users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            full_name VARCHAR(255),
            hashed_password TEXT,
            profile_picture TEXT,
            auth_provider VARCHAR(50) DEFAULT 'local',
            is_active BOOLEAN DEFAULT TRUE,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        # Create index on email for faster lookups
        admin_users_email_index = """
        CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
        """
        
        # Create user_activities table
        activities_table_query = """
        CREATE TABLE IF NOT EXISTS user_activities (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            session_id VARCHAR(255) NOT NULL,
            activity_type VARCHAR(100) NOT NULL,
            page_url TEXT,
            section_id VARCHAR(255),
            section_title VARCHAR(500),
            duration_seconds INTEGER,
            metadata JSONB,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        # Create indexes for activities table
        activities_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_user_activities_session_id ON user_activities(session_id);",
            "CREATE INDEX IF NOT EXISTS idx_user_activities_activity_type ON user_activities(activity_type);",
            "CREATE INDEX IF NOT EXISTS idx_user_activities_timestamp ON user_activities(timestamp);",
            "CREATE INDEX IF NOT EXISTS idx_user_activities_section_id ON user_activities(section_id);"
        ]
        
        logger.info("Creating users table (for regular users)...")
        neon_db.execute_query(users_table_query)
        logger.info("✓ users table created")
        
        logger.info("Creating index on users.email...")
        neon_db.execute_query(users_email_index)
        logger.info("✓ Index created")
        
        logger.info("Creating admin_users table...")
        neon_db.execute_query(admin_users_table_query)
        logger.info("✓ admin_users table created")
        
        logger.info("Creating index on admin_users.email...")
        neon_db.execute_query(admin_users_email_index)
        logger.info("✓ Index created")
        
        logger.info("Creating user_activities table...")
        neon_db.execute_query(activities_table_query)
        logger.info("✓ user_activities table created")
        
        for index_query in activities_indexes:
            logger.info(f"Creating index: {index_query[:50]}...")
            neon_db.execute_query(index_query)
        
        logger.info("✓ All indexes created")
        
        logger.info("\n" + "=" * 60)
        logger.info("✅ SUCCESS! PostgreSQL tables created")
        logger.info("=" * 60)
        logger.info("Tables created:")
        logger.info("  - users (for regular users)")
        logger.info("  - admin_users (for admin users)")
        logger.info("  - user_activities")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        sys.exit(1)
    finally:
        neon_db.close()

if __name__ == "__main__":
    create_admin_tables()
