"""
Migration script to create PostgreSQL tables for subscriptions, submissions, and rate limiting
"""
import sys
from neon_database import neon_db
from config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_subscription_tables():
    """Create tables for subscriptions, submissions, and rate limiting in PostgreSQL"""
    
    if not Config.NEON_DATABASE_URL:
        logger.error("NEON_DATABASE_URL is not configured")
        sys.exit(1)
    
    try:
        # Connect to database
        neon_db._connect()
        
        # Add subscription columns to users table
        users_subscription_columns = """
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='users' AND column_name='subscription_tier') THEN
                ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free';
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='users' AND column_name='subscription_status') THEN
                ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'active';
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='users' AND column_name='subscription_start_date') THEN
                ALTER TABLE users ADD COLUMN subscription_start_date TIMESTAMP;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='users' AND column_name='subscription_end_date') THEN
                ALTER TABLE users ADD COLUMN subscription_end_date TIMESTAMP;
            END IF;
        END $$;
        """
        
        # Add subscription columns to admin_users table (for consistency)
        admin_users_subscription_columns = """
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='admin_users' AND column_name='subscription_tier') THEN
                ALTER TABLE admin_users ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free';
            END IF;
        END $$;
        """
        
        # Create submissions table
        submissions_table_query = """
        CREATE TABLE IF NOT EXISTS submissions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            submission_type VARCHAR(50) NOT NULL,
            input_data TEXT,
            input_url TEXT,
            file_path TEXT,
            file_name TEXT,
            file_size INTEGER,
            status VARCHAR(50) DEFAULT 'pending',
            processing_result JSONB,
            tags TEXT[],
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """
        
        # Create rate_limit_tracking table
        rate_limit_tracking_query = """
        CREATE TABLE IF NOT EXISTS rate_limit_tracking (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            submission_id INTEGER,
            request_type VARCHAR(50) NOT NULL,
            request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL
        );
        """
        
        # Create indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);",
            "CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);",
            "CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);",
            "CREATE INDEX IF NOT EXISTS idx_rate_limit_user_id ON rate_limit_tracking(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp ON rate_limit_tracking(request_timestamp);",
            "CREATE INDEX IF NOT EXISTS idx_rate_limit_user_timestamp ON rate_limit_tracking(user_id, request_timestamp);"
        ]
        
        logger.info("Adding subscription columns to users table...")
        neon_db.execute_query(users_subscription_columns)
        logger.info("✓ Subscription columns added to users table")
        
        logger.info("Adding subscription columns to admin_users table...")
        neon_db.execute_query(admin_users_subscription_columns)
        logger.info("✓ Subscription columns added to admin_users table")
        
        logger.info("Creating submissions table...")
        neon_db.execute_query(submissions_table_query)
        logger.info("✓ submissions table created")
        
        logger.info("Creating rate_limit_tracking table...")
        neon_db.execute_query(rate_limit_tracking_query)
        logger.info("✓ rate_limit_tracking table created")
        
        for index_query in indexes:
            logger.info(f"Creating index: {index_query[:60]}...")
            neon_db.execute_query(index_query)
        
        logger.info("✓ All indexes created")
        
        logger.info("\n" + "=" * 60)
        logger.info("✅ SUCCESS! Subscription tables created")
        logger.info("=" * 60)
        logger.info("Tables/columns created:")
        logger.info("  - users.subscription_tier, subscription_status, etc.")
        logger.info("  - admin_users.subscription_tier")
        logger.info("  - submissions")
        logger.info("  - rate_limit_tracking")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        neon_db.close()

if __name__ == "__main__":
    create_subscription_tables()
