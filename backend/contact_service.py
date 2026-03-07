"""
Contact form service for PostgreSQL.
Saves every contact form submission (first name, last name, email, phone, message, sign_up_for_updates).
When sign_up_for_updates is True, the contact is on the mailing list for inquiryinvisible@gmail.com.
"""
from neon_database import neon_db
from config import Config
import logging

logger = logging.getLogger(__name__)


def save_contact_submission(
    first_name: str,
    last_name: str,
    email: str,
    phone: str,
    content: str,
    sign_up_for_updates: bool,
) -> bool:
    """
    Save a contact form submission to PostgreSQL (every submit).
    Stores first name, last name, email, phone, message content, and sign_up_for_updates.
    When sign_up_for_updates is True, the user gets news emails from inquiryinvisible@gmail.com.
    """
    if not Config.NEON_DATABASE_URL or not neon_db.is_configured():
        logger.warning("Neon PostgreSQL not configured; contact submission not saved")
        return False

    try:
        query = """
        INSERT INTO contact_submissions
            (first_name, last_name, email, phone, content, sign_up_for_updates)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        neon_db.execute_write_query(
            query,
            (
                (first_name or "").strip()[:255],
                (last_name or "").strip()[:255],
                (email or "").strip()[:255],
                (phone or "").strip()[:100],
                (content or "")[:10000],
                bool(sign_up_for_updates),
            ),
        )
        logger.info("Contact submission saved for email=%s (sign_up_for_updates=%s)", email, sign_up_for_updates)
        return True
    except Exception as e:
        logger.error("Failed to save contact submission: %s", e)
        return False
