from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError, SessionExpired
from config import Config
import time
import logging

logger = logging.getLogger(__name__)

class Neo4jDatabase:

    def __init__(self):
        self.driver = None
        self._initialized = False

    def _connect(self):
        """Establish a new connection to Neo4j database"""
        try:
            # Close existing driver if any
            if self.driver:
                try:
                    self.driver.close()
                except:
                    pass
                self.driver = None
                self._initialized = False

            logger.info(f"Connecting to Neo4j at {Config.NEO4J_URI}")
            self.driver = GraphDatabase.driver(
                Config.NEO4J_URI,
                auth=(Config.NEO4J_USER, Config.NEO4J_PASSWORD),
                max_connection_lifetime=3600,
                max_connection_pool_size=50,
                connection_acquisition_timeout=120,
                connection_timeout=30,
                keep_alive=True
            )

            # Verify connectivity with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    self.driver.verify_connectivity()
                    logger.info("Successfully connected to Neo4j database")
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Connection attempt {attempt + 1} failed, retrying...")
                        time.sleep(2)
                        continue
                    raise
        except Exception as e:
            error_msg = f"Failed to connect to Neo4j at {Config.NEO4J_URI}: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def close(self):
        """Close the database connection"""
        if self.driver:
            try:
                self.driver.close()
                logger.info("Neo4j connection closed")
            except Exception as e:
                logger.warning(f"Error closing Neo4j connection: {str(e)}")
            finally:
                self.driver = None
                self._initialized = False

    def _check_connection(self):
        """Check if the driver is still alive and can connect"""
        try:
            if self.driver:
                # Try to verify connectivity
                self.driver.verify_connectivity()
                return True
        except Exception as e:
            logger.warning(f"Connection check failed: {str(e)}, will reconnect")
        return False

    def _ensure_connected(self):
        """Ensure database is connected before executing queries"""
        # Check if we need to connect or reconnect
        if not self._initialized or not self._check_connection():
            try:
                self._connect()
                self._initialized = True
            except Exception as e:
                raise Exception(f"Database connection failed: {str(e)}")
    
    def get_session(self):
        """Get a new database session"""
        self._ensure_connected()
        if not self.driver:
            raise Exception("Database driver is not initialized")
        return self.driver.session()

    def execute_query(self, query, parameters=None):
        """Execute a read query with automatic retry and reconnection"""
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Ensure connection is alive
                self._ensure_connected()
                
                with self.get_session() as session:
                    result = session.run(query, parameters or {})
                    return [record.data() for record in result]
            except (ServiceUnavailable, TransientError, SessionExpired) as e:
                # These are connection-related errors, try to reconnect
                last_error = e
                logger.warning(f"Connection error on attempt {attempt + 1}/{max_retries}: {str(e)}")
                if attempt < max_retries - 1:
                    # Mark as not initialized to force reconnect
                    self._initialized = False
                    time.sleep(1 * (attempt + 1))  # Exponential backoff
                    continue
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    logger.warning(f"Query error on attempt {attempt + 1}/{max_retries}: {str(e)}")
                    time.sleep(1)
                    continue
                break
        
        error_msg = f"Query execution failed after {max_retries} attempts: {str(last_error)}"
        logger.error(error_msg)
        raise Exception(error_msg)

    def execute_write_query(self, query, parameters=None):
        """Execute a write query with automatic retry and reconnection"""
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Ensure connection is alive
                self._ensure_connected()
                
                with self.get_session() as session:
                    result = session.run(query, parameters or {})
                    return [record.data() for record in result]
            except (ServiceUnavailable, TransientError, SessionExpired) as e:
                # These are connection-related errors, try to reconnect
                last_error = e
                logger.warning(f"Connection error on write attempt {attempt + 1}/{max_retries}: {str(e)}")
                if attempt < max_retries - 1:
                    # Mark as not initialized to force reconnect
                    self._initialized = False
                    time.sleep(1 * (attempt + 1))  # Exponential backoff
                    continue
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    logger.warning(f"Write query error on attempt {attempt + 1}/{max_retries}: {str(e)}")
                    time.sleep(1)
                    continue
                break
        
        error_msg = f"Write query execution failed after {max_retries} attempts: {str(last_error)}"
        logger.error(error_msg)
        raise Exception(error_msg)

db = Neo4jDatabase()
