import os
import logging
from dotenv import load_dotenv

#
# Environment loading
# - Default: `.env`
# - Some deployments use `.ENV` (uppercase); load it as well if present.
#
load_dotenv()
try:
    if os.path.exists(".ENV"):
        load_dotenv(".ENV")
except Exception:
    # Don't fail startup if dotenv loading has an issue; Config.validate() will catch missing vars.
    pass

logger = logging.getLogger(__name__)

class Config:
    NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")

    # Neon PostgreSQL Configuration
    NEON_DATABASE_URL = os.getenv("NEON_DATABASE_URL", "")
    # Entity/wikidata table (Neon). Override if DB structure changed.
    ENTITY_WIKIDATA_TABLE = os.getenv("ENTITY_WIKIDATA_TABLE", "entity")

    BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))

    CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173").split(",")]

    GROK_API_KEY = os.getenv("GROK_API_KEY", "")
    GROK_API_URL = os.getenv("GROK_API_URL", "https://api.x.ai/v1/chat/completions")
    GROK_MODEL = os.getenv("GROK_MODEL", "grok-3")

    # Authentication Configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-key-in-production-use-openssl-rand-hex-32")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))  # 30 days default
    
    # Google OAuth Configuration
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

    @classmethod
    def validate(cls):
        if not cls.NEO4J_PASSWORD:
            raise ValueError("NEO4J_PASSWORD environment variable is required")
        if not cls.NEON_DATABASE_URL:
            logger.warning("NEON_DATABASE_URL not configured - entity wikidata features will be disabled")
        return True
