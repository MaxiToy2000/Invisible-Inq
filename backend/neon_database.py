"""
Neon PostgreSQL Database Handler
Handles connections to Neon PostgreSQL for entity wikidata queries.
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from config import Config
import logging
import time

logger = logging.getLogger(__name__)


class NeonDatabase:
    """
    Database handler for Neon PostgreSQL connections.
    Provides connection management and query execution with retry logic.
    """

    def __init__(self):
        self.connection = None
        self._initialized = False

    def _connect(self):
        """Establish connection to Neon PostgreSQL"""
        try:
            # Close existing connection if any
            if self.connection:
                try:
                    self.connection.close()
                except:
                    pass
                self.connection = None
                self._initialized = False

            if not Config.NEON_DATABASE_URL:
                raise ValueError("NEON_DATABASE_URL is not configured")

            logger.info("Connecting to Neon PostgreSQL...")
            self.connection = psycopg2.connect(
                Config.NEON_DATABASE_URL,
                sslmode='require',
                connect_timeout=30
            )
            # Set autocommit for read queries
            self.connection.autocommit = True
            logger.info("Successfully connected to Neon PostgreSQL")
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to connect to Neon PostgreSQL: {e}")
            raise

    def _ensure_connected(self):
        """Ensure database is connected before executing queries"""
        if not self._initialized or not self.connection or self.connection.closed:
            self._connect()

    def _check_connection(self):
        """Check if connection is still alive"""
        try:
            if self.connection and not self.connection.closed:
                # Try a simple query to verify connection
                with self.connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                return True
        except Exception as e:
            logger.warning(f"Connection check failed: {e}")
        return False

    def execute_query(self, query, parameters=None):
        """
        Execute a query and return results as list of dicts.
        Includes retry logic for connection failures.
        Works for both read and write operations (autocommit is enabled).
        """
        max_retries = 3
        last_error = None

        for attempt in range(max_retries):
            try:
                self._ensure_connected()
                
                with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(query, parameters or ())
                    if cursor.description:
                        return cursor.fetchall()
                    return []
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                # Connection-related errors, try to reconnect
                last_error = e
                logger.warning(f"Connection error on attempt {attempt + 1}/{max_retries}: {e}")
                self._initialized = False
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))  # Exponential backoff
                    continue
            except Exception as e:
                last_error = e
                logger.error(f"Query execution error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                break

        error_msg = f"Query execution failed after {max_retries} attempts: {last_error}"
        logger.error(error_msg)
        raise Exception(error_msg)
    
    def execute_write_query(self, query, parameters=None):
        """
        Execute a write query (INSERT, UPDATE, DELETE).
        Alias for execute_query since autocommit is enabled.
        """
        return self.execute_query(query, parameters)

    def close(self):
        """Close database connection"""
        if self.connection:
            try:
                self.connection.close()
                logger.info("Neon PostgreSQL connection closed")
            except Exception as e:
                logger.warning(f"Error closing Neon connection: {e}")
            finally:
                self.connection = None
                self._initialized = False

    def is_configured(self):
        """Check if Neon database is configured"""
        return bool(Config.NEON_DATABASE_URL)


# Singleton instance
neon_db = NeonDatabase()


