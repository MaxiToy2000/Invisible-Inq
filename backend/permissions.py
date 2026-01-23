"""
Permission helpers for User Identity Model
Provides lightweight permission checking for admin-only, tester-only, and read-only operations
"""
from fastapi import HTTPException, status, Request
from typing import Optional, Dict
import logging
from auth_middleware import get_user_from_request

logger = logging.getLogger(__name__)


def require_user(request: Request) -> Dict:
    """
    Require that a user is authenticated.
    Raises 401 if no user is found.
    
    Returns:
        User dict from request state
    """
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return user


def require_active_user(request: Request) -> Dict:
    """
    Require that a user is authenticated and active.
    Raises 401 if not authenticated, 403 if suspended.
    
    Returns:
        Active user dict from request state
    """
    user = require_user(request)
    
    # Check status (User Identity Model)
    user_status = user.get('status', 'active')
    if user_status != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is suspended"
        )
    
    return user


def require_admin(request: Request) -> Dict:
    """
    Require that user is authenticated, active, and has admin role.
    Raises 401 if not authenticated, 403 if not admin or suspended.
    
    Returns:
        Admin user dict from request state
    """
    user = require_active_user(request)
    
    # Check admin role (User Identity Model)
    is_admin = user.get('is_admin', False) or user.get('role') == 'admin'
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return user


def require_tester(request: Request) -> Dict:
    """
    Require that user is authenticated, active, and has tester or admin role.
    Raises 401 if not authenticated, 403 if not tester/admin or suspended.
    
    Returns:
        Tester/admin user dict from request state
    """
    user = require_active_user(request)
    
    # Check tester or admin role (User Identity Model)
    role = user.get('role', 'user')
    is_admin = user.get('is_admin', False) or role == 'admin'
    is_tester = role == 'tester'
    
    if not (is_admin or is_tester):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tester or admin privileges required"
        )
    
    return user


def get_optional_user(request: Request) -> Optional[Dict]:
    """
    Get user from request if available, return None if not authenticated.
    Does not raise exceptions.
    
    Returns:
        User dict or None
    """
    return get_user_from_request(request)


def check_user_permission(user: Dict, required_role: str) -> bool:
    """
    Check if user has the required role.
    
    Args:
        user: User dict
        required_role: Required role ('admin', 'tester', 'user')
    
    Returns:
        True if user has required role or higher
    """
    if not user:
        return False
    
    # Check if user is active
    if user.get('status') != 'active':
        return False
    
    role = user.get('role', 'user')
    is_admin = user.get('is_admin', False) or role == 'admin'
    
    # Role hierarchy: admin > tester > user
    if required_role == 'admin':
        return is_admin
    elif required_role == 'tester':
        return is_admin or role == 'tester'
    elif required_role == 'user':
        return True  # All authenticated users
    
    return False
