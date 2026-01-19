"""
Startup script for the FastAPI backend server.
This script handles Windows-specific multiprocessing issues.
"""
import os
import sys
import socket
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def is_port_in_use(host: str, port: int) -> bool:
    """Check if a port is already in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return False
        except OSError:
            return True

if __name__ == "__main__":
    # Set environment variable to disable platform caching issues on Windows
    if sys.platform == 'win32':
        os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
        # Workaround for Windows multiprocessing + neo4j issue
        os.environ['PYTHONINSPECT'] = ''
    
    import uvicorn
    from config import Config
    
    # Validate configuration
    try:
        Config.validate()
        logger.info("Configuration validated successfully")
    except ValueError as e:
        logger.error(f"Configuration validation failed: {e}")
        print(f"\n{'='*60}")
        print(f"ERROR: Configuration validation failed!")
        print(f"{'='*60}")
        print(f"{e}")
        print(f"Please check your .env file and ensure all required variables are set.")
        print(f"{'='*60}\n")
        sys.exit(1)
    
    # Check port availability
    if is_port_in_use(Config.BACKEND_HOST, Config.BACKEND_PORT):
        logger.error(f"Port {Config.BACKEND_PORT} is already in use")
        print(f"\n{'='*60}")
        print(f"ERROR: Port {Config.BACKEND_PORT} is already in use!")
        print(f"{'='*60}")
        print(f"Please do one of the following:")
        print(f"1. Stop the existing server using port {Config.BACKEND_PORT}")
        print(f"2. Change BACKEND_PORT in your .env file to a different port")
        print(f"3. Kill the process using: netstat -ano | findstr :{Config.BACKEND_PORT}")
        print(f"{'='*60}\n")
        sys.exit(1)
    
    # Get the absolute path to the backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Run uvicorn with watchfiles reloader and longer delays for Windows
    # Increase request body size limit to 50MB (default is 1MB)
    config = {
        "app": "main:app",
        "host": Config.BACKEND_HOST,
        "port": Config.BACKEND_PORT,
        "reload": True,
        "reload_dirs": [backend_dir],
        "reload_delay": 1.0,  # Longer delay for Windows
        "log_level": "info",
        "timeout_graceful_shutdown": 10,
        "limit_concurrency": 1000,
        "limit_max_requests": 10000,
        "limit_max_requests_jitter": 1000
    }
    
    # On Windows, use a single reload dir and longer timeout
    if sys.platform == 'win32':
        config["reload_delay"] = 2.0
        config["timeout_keep_alive"] = 10
    
    try:
        logger.info(f"Starting server on {Config.BACKEND_HOST}:{Config.BACKEND_PORT} (with auto-reload)")
        uvicorn.run(**config)
    except OSError as e:
        if "10048" in str(e) or "address already in use" in str(e).lower():
            logger.error(f"Port {Config.BACKEND_PORT} is already in use: {e}")
            print(f"\n{'='*60}")
            print(f"ERROR: Port {Config.BACKEND_PORT} is already in use!")
            print(f"{'='*60}")
            print(f"Please stop the existing server or change BACKEND_PORT in your .env file.")
            print(f"{'='*60}\n")
            sys.exit(1)
        else:
            logger.error(f"Failed to start server: {e}")
            raise
    except Exception as e:
        logger.error(f"Unexpected error starting server: {e}")
        raise

