"""
Migration script to add User Identity Model fields (role and status) to users table
This implements the User Identity Model ticket requirements.
"""
import sys
from neon_database import neon_db
from config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_user_identity():
    """Add role and status columns to users and admin_users tables"""
    
    if not Config.NEON_DATABASE_URL:
        logger.error("NEON_DATABASE_URL is not configured")
        sys.exit(1)
    
    try:
        # Connect to database
        neon_db._connect()
        
        # Add role and status columns to users table
        users_identity_columns = """
        DO $$ 
        BEGIN
            -- Add role column (admin / tester / user)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='users' AND column_name='role') THEN
                ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
            END IF;
            
            -- Add status column (active / suspended)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='users' AND column_name='status') THEN
                ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
            END IF;
            
            -- Migrate existing is_admin to role
            UPDATE users 
            SET role = 'admin' 
            WHERE is_admin = TRUE AND (role IS NULL OR role = 'user');
        END $$;
        """
        
        # Add role and status columns to admin_users table
        admin_users_identity_columns = """
        DO $$ 
        BEGIN
            -- Add role column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='admin_users' AND column_name='role') THEN
                ALTER TABLE admin_users ADD COLUMN role VARCHAR(50) DEFAULT 'admin';
            END IF;
            
            -- Add status column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='admin_users' AND column_name='status') THEN
                ALTER TABLE admin_users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
            END IF;
            
            -- Migrate existing is_admin to role
            UPDATE admin_users 
            SET role = 'admin' 
            WHERE is_admin = TRUE AND (role IS NULL OR role = 'user');
        END $$;
        """
        
        # Create audit_log table for tracking user actions
        audit_log_table_query = """
        CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            user_email VARCHAR(255),
            action_type VARCHAR(100) NOT NULL,
            source VARCHAR(50) NOT NULL,  -- ingestion, query, editor, etc.
            resource_type VARCHAR(100),  -- node, graph, submission, etc.
            resource_id VARCHAR(255),
            details JSONB,
            ip_address VARCHAR(45),
            user_agent TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        """
        
        # Create indexes for audit_log
        audit_log_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON audit_log(user_email);",
            "CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);",
            "CREATE INDEX IF NOT EXISTS idx_audit_log_source ON audit_log(source);",
            "CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);",
            "CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);"
        ]
        
        logger.info("Adding role and status columns to users table...")
        neon_db.execute_query(users_identity_columns)
        logger.info("✓ Role and status columns added to users table")
        
        logger.info("Adding role and status columns to admin_users table...")
        neon_db.execute_query(admin_users_identity_columns)
        logger.info("✓ Role and status columns added to admin_users table")
        
        logger.info("Creating audit_log table...")
        try:
            neon_db.execute_query(audit_log_table_query)
            logger.info("✓ audit_log table created")
        except Exception as e:
            logger.error(f"Error creating audit_log table: {e}")
            # Check if table already exists
            check_table_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'audit_log'
            );
            """
            try:
                result = neon_db.execute_query(check_table_query)
                if result and result[0].get('exists'):
                    logger.info("⚠ audit_log table already exists, skipping creation")
                else:
                    raise  # Re-raise if table doesn't exist and creation failed
            except Exception as check_error:
                logger.error(f"Error checking if audit_log exists: {check_error}")
                raise
        
        # Verify table was created
        verify_table_query = """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'audit_log'
        );
        """
        try:
            result = neon_db.execute_query(verify_table_query)
            if result and result[0].get('exists'):
                logger.info("✓ Verified: audit_log table exists")
            else:
                logger.error("✗ ERROR: audit_log table was not created!")
                raise Exception("audit_log table creation failed")
        except Exception as e:
            logger.error(f"Error verifying audit_log table: {e}")
            raise
        
        for index_query in audit_log_indexes:
            logger.info(f"Creating index: {index_query[:60]}...")
            try:
                neon_db.execute_query(index_query)
            except Exception as e:
                logger.warning(f"Warning: Index creation failed (may already exist): {e}")
        
        logger.info("✓ All indexes created")
        
        logger.info("\n" + "=" * 60)
        logger.info("✅ SUCCESS! User Identity Model migration completed")
        logger.info("=" * 60)
        logger.info("Changes made:")
        logger.info("  - users.role (admin / tester / user)")
        logger.info("  - users.status (active / suspended)")
        logger.info("  - admin_users.role")
        logger.info("  - admin_users.status")
        logger.info("  - audit_log table for action tracking")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error during migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        neon_db.close()

if __name__ == "__main__":
    migrate_user_identity()
