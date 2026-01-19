"""
Startup script for the FastAPI backend server WITHOUT auto-reload.
Use this if you're experiencing issues with auto-reload on Windows.
"""
import socket
import logging
import uvicorn
from config import Config

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
        exit(1)
    
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
        exit(1)
    
    try:
        # Run without reload - manually restart when you make changes
        logger.info(f"Starting server on {Config.BACKEND_HOST}:{Config.BACKEND_PORT} (no auto-reload)")
        uvicorn.run(
            "main:app",
            host=Config.BACKEND_HOST,
            port=Config.BACKEND_PORT,
            reload=False,
            log_level="info"
        )
    except OSError as e:
        if "10048" in str(e) or "address already in use" in str(e).lower():
            logger.error(f"Port {Config.BACKEND_PORT} is already in use: {e}")
            print(f"\n{'='*60}")
            print(f"ERROR: Port {Config.BACKEND_PORT} is already in use!")
            print(f"{'='*60}")
            print(f"Please stop the existing server or change BACKEND_PORT in your .env file.")
            print(f"{'='*60}\n")
            exit(1)
        else:
            logger.error(f"Failed to start server: {e}")
            raise
    except Exception as e:
        logger.error(f"Unexpected error starting server: {e}")
        raise

