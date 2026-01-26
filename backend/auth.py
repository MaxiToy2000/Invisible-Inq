"""
Authentication utilities for JWT token management, password hashing, and OAuth
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import logging
from config import Config

logger = logging.getLogger(__name__)

# HTTP Bearer token for JWT authentication
security = HTTPBearer()

# JWT Configuration
SECRET_KEY = Config.JWT_SECRET_KEY if hasattr(Config, 'JWT_SECRET_KEY') else "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"Error verifying password: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    # Bcrypt has a 72-byte limit, ensure password is within limit
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        raise ValueError(f"Password cannot be longer than 72 bytes (got {len(password_bytes)} bytes). Please use a shorter password.")
    
    # Generate salt and hash password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise credentials_exception
        
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None or email is None:
            raise credentials_exception
        
        # Return user data from token (User Identity Model: include role and status)
        return {
            "id": user_id,
            "email": email,
            "full_name": payload.get("full_name"),
            "profile_picture": payload.get("profile_picture"),
            "auth_provider": payload.get("auth_provider", "local"),
            "is_admin": payload.get("is_admin", False),
            "role": payload.get("role", "user"),  # User Identity Model: role
            "status": payload.get("status", "active")  # User Identity Model: status
        }
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise credentials_exception

async def verify_google_token(token: str) -> Optional[dict]:
    """Verify Google OAuth token and return user info"""
    try:
        # Get Google Client ID from config
        google_client_id = getattr(Config, 'GOOGLE_CLIENT_ID', None)
        
        if not google_client_id:
            logger.error("GOOGLE_CLIENT_ID not configured")
            return None
        
        # Verify the token
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            google_client_id
        )
        
        # ID token is valid. Get user info.
        return {
            "email": idinfo.get("email"),
            "full_name": idinfo.get("name"),
            "profile_picture": idinfo.get("picture"),
            "google_id": idinfo.get("sub"),
            "email_verified": idinfo.get("email_verified", False)
        }
    except ValueError as e:
        # Invalid token
        logger.error(f"Invalid Google token: {e}")
        return None
    except Exception as e:
        logger.error(f"Error verifying Google token: {e}")
        return None

# Optional: Admin user dependency
async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    """Dependency to ensure user is active"""
    # In a real application, you would check if user is active in database
    # For now, we'll just return the current user
    return current_user

async def get_current_admin_user(current_user: dict = Depends(get_current_user)):
    """Dependency to ensure user is an admin"""
    # Check both is_admin (backward compatibility) and role
    is_admin = current_user.get('is_admin', False) or current_user.get('role') == 'admin'
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

# Note: get_user_from_request is available from auth_middleware
# Import it directly in files that need it: from auth_middleware import get_user_from_request
