"""
Admin user service for managing admin users in PostgreSQL (Neon)
"""
from typing import Optional, Dict
from datetime import datetime
import logging
from neon_database import neon_db
from auth import get_password_hash, verify_password
from models import UserCreate, UserResponse

logger = logging.getLogger(__name__)

def create_admin_user(user_data: UserCreate, auth_provider: str = "local", is_admin: bool = True) -> Optional[UserResponse]:
    """
    Create a new admin user in PostgreSQL database
    
    Args:
        user_data: User creation data
        auth_provider: Authentication provider (local, google)
        is_admin: Whether user should have admin privileges (default True)
    
    Returns:
        UserResponse if successful, None otherwise
    """
    try:
        # Hash password if provided
        hashed_password = None
        if user_data.password:
            hashed_password = get_password_hash(user_data.password)
        
        # Insert user into PostgreSQL
        query = """
        INSERT INTO admin_users (email, full_name, hashed_password, auth_provider, is_active, is_admin, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, email, full_name, profile_picture, auth_provider, is_active, is_admin, created_at, updated_at
        """
        
        params = (
            user_data.email,
            user_data.full_name,
            hashed_password,
            auth_provider,
            True,  # is_active
            is_admin
        )
        
        result = neon_db.execute_query(query, params)
        
        if result and len(result) > 0:
            user_row = result[0]
            
            return UserResponse(
                id=str(user_row['id']),
                email=user_row['email'],
                full_name=user_row['full_name'],
                profile_picture=user_row.get('profile_picture'),
                is_active=user_row.get('is_active', True),
                is_admin=user_row.get('is_admin', False),
                created_at=user_row.get('created_at'),
                auth_provider=user_row.get('auth_provider', 'local')
            )
        
        return None
    except Exception as e:
        logger.error(f"Error creating admin user: {e}")
        # Check if it's a unique constraint violation (user already exists)
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            logger.warning(f"User with email {user_data.email} already exists")
        return None

def get_admin_user_by_email(email: str) -> Optional[Dict]:
    """
    Get admin user by email from PostgreSQL database
    
    Args:
        email: User's email address
    
    Returns:
        User data dict if found, None otherwise
    """
    try:
        query = """
        SELECT id, email, full_name, hashed_password, profile_picture, 
               is_active, is_admin, created_at, updated_at, auth_provider
        FROM admin_users
        WHERE email = %s
        """
        
        result = neon_db.execute_query(query, (email,))
        
        if result and len(result) > 0:
            user_row = result[0]
            
            return {
                "id": str(user_row['id']),
                "email": user_row['email'],
                "full_name": user_row.get('full_name'),
                "hashed_password": user_row.get('hashed_password'),
                "profile_picture": user_row.get('profile_picture'),
                "is_active": user_row.get('is_active', True),
                "is_admin": user_row.get('is_admin', False),
                "created_at": user_row.get('created_at'),
                "auth_provider": user_row.get('auth_provider', 'local')
            }
        
        return None
    except Exception as e:
        logger.error(f"Error getting admin user by email: {e}")
        return None

def get_admin_user_by_id(user_id: str) -> Optional[Dict]:
    """
    Get admin user by ID from PostgreSQL database
    
    Args:
        user_id: User's ID
    
    Returns:
        User data dict if found, None otherwise
    """
    try:
        query = """
        SELECT id, email, full_name, hashed_password, profile_picture, 
               is_active, is_admin, created_at, updated_at, auth_provider
        FROM admin_users
        WHERE id = %s
        """
        
        result = neon_db.execute_query(query, (int(user_id),))
        
        if result and len(result) > 0:
            user_row = result[0]
            
            return {
                "id": str(user_row['id']),
                "email": user_row['email'],
                "full_name": user_row.get('full_name'),
                "hashed_password": user_row.get('hashed_password'),
                "profile_picture": user_row.get('profile_picture'),
                "is_active": user_row.get('is_active', True),
                "is_admin": user_row.get('is_admin', False),
                "created_at": user_row.get('created_at'),
                "auth_provider": user_row.get('auth_provider', 'local')
            }
        
        return None
    except Exception as e:
        logger.error(f"Error getting admin user by ID: {e}")
        return None

def authenticate_admin_user(email: str, password: str) -> Optional[Dict]:
    """
    Authenticate an admin user with email and password
    
    Args:
        email: User's email
        password: Plain text password
    
    Returns:
        User dict if authentication successful, None otherwise
    """
    try:
        user = get_admin_user_by_email(email)
        
        if not user:
            return None
        
        if not user.get('is_active', True):
            logger.warning(f"Inactive user attempted login: {email}")
            return None
        
        # Check password
        hashed_password = user.get('hashed_password')
        if not hashed_password:
            logger.warning(f"User {email} has no password set")
            return None
        
        if not verify_password(password, hashed_password):
            logger.warning(f"Invalid password for user: {email}")
            return None
        
        # Remove password from returned user data
        user.pop('hashed_password', None)
        return user
    except Exception as e:
        logger.error(f"Error authenticating admin user: {e}")
        return None
