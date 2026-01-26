"""
Authentication Middleware for FastAPI
Handles JWT token verification and injects user context into request state.
This enables user identity tracking for all requests.
"""
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Optional, List
import logging
from auth import decode_access_token

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware that verifies JWT tokens and injects user context into request state.
    
    - Excludes certain paths (auth endpoints, health checks, docs)
    - Requires authentication for specified paths (admin routes, etc.)
    - For other paths, authentication is optional but user context is injected if token is present
    """
    
    def __init__(
        self,
        app,
        exclude_paths: Optional[List[str]] = None,
        require_auth_paths: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.exclude_paths = exclude_paths or []
        self.require_auth_paths = require_auth_paths or []
    
    def _is_excluded_path(self, path: str) -> bool:
        """Check if path should be excluded from authentication"""
        for exclude_path in self.exclude_paths:
            if path.startswith(exclude_path):
                return True
        return False
    
    def _requires_auth(self, path: str) -> bool:
        """Check if path requires authentication"""
        for require_path in self.require_auth_paths:
            if path.startswith(require_path):
                return True
        return False
    
    async def dispatch(self, request: Request, call_next):
        """Process request and inject user context"""
        # Initialize user context as None
        request.state.user = None
        
        # Skip authentication for excluded paths
        if self._is_excluded_path(request.url.path):
            response = await call_next(request)
            return response
        
        # Try to extract and verify token
        user = None
        authorization = request.headers.get("Authorization")
        
        if authorization:
            try:
                # Extract Bearer token
                if authorization.startswith("Bearer "):
                    token = authorization[7:]  # Remove "Bearer " prefix
                    
                    # Decode and verify token
                    payload = decode_access_token(token)
                    
                    if payload:
                        user_id = payload.get("sub")
                        email = payload.get("email")
                        
                        if user_id and email:
                            user = {
                                "id": str(user_id),
                                "email": email,
                                "full_name": payload.get("full_name"),
                                "profile_picture": payload.get("profile_picture"),
                                "auth_provider": payload.get("auth_provider", "local"),
                                "is_admin": payload.get("is_admin", False),
                                "role": payload.get("role", "user"),  # User Identity Model: role
                                "status": payload.get("status", "active")  # User Identity Model: status
                            }
                            
                            # Check if user is suspended
                            if user.get("status") == "suspended":
                                logger.warning(f"Suspended user attempted access: {email}")
                                user = None  # Don't allow suspended users
            except Exception as e:
                logger.debug(f"Token verification failed: {e}")
                # Continue without user context
        
        # If path requires authentication and no valid user, return 401
        if self._requires_auth(request.url.path):
            if not user:
                return Response(
                    content='{"detail":"Authentication required"}',
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    media_type="application/json",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            # Check if user is active
            if user.get("status") != "active":
                return Response(
                    content='{"detail":"User account is suspended"}',
                    status_code=status.HTTP_403_FORBIDDEN,
                    media_type="application/json"
                )
        
        # Inject user into request state
        request.state.user = user
        
        # Process request
        response = await call_next(request)
        return response


def get_user_from_request(request: Request) -> Optional[dict]:
    """
    Extract user context from request state (injected by AuthenticationMiddleware).
    
    Returns:
        User dict with id, email, role, status, etc. or None if not authenticated
    """
    return getattr(request.state, "user", None)
