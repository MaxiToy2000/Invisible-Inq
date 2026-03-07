"""
Migration script to create PostgreSQL table for contact form submissions.
Stores first name, last name, email, phone, message content, and sign-up-for-updates flag.
When sign_up_for_updates is true, the user is saved for mailing list / news emails (inquiryinvisible@gmail.com).
"""
import sys
from neon_database import neon_db
from config import Config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_contact_table():
    """Create contact_submissions table in PostgreSQL."""
    if not Config.NEON_DATABASE_URL:
        logger.error("NEON_DATABASE_URL is not configured")
        sys.exit(1)

    try:
        neon_db._connect()

        contact_table_query = """
        CREATE TABLE IF NOT EXISTS contact_submissions (
            id SERIAL PRIMARY KEY,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(100),
            content TEXT,
            sign_up_for_updates BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        logger.info("Creating contact_submissions table...")
        neon_db.execute_query(contact_table_query)
        logger.info("✓ contact_submissions table created")

        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);",
            "CREATE INDEX IF NOT EXISTS idx_contact_submissions_sign_up ON contact_submissions(sign_up_for_updates);",
            "CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at);",
        ]
        for index_query in indexes:
            neon_db.execute_query(index_query)
        logger.info("✓ Indexes created")

        logger.info("\n✅ SUCCESS! contact_submissions table ready for Contact us / mailing list data.")
    except Exception as e:
        logger.error(f"Error creating contact table: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        neon_db.close()


if __name__ == "__main__":
    create_contact_table()
