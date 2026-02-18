# Import platform fix first to avoid Windows multiprocessing issues
import platform_fix

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import time
import logging
import os
import aiofiles
from config import Config
from services import get_all_stories, get_graph_data, get_graph_data_by_section_and_country, get_gr_id_description, search_with_ai, get_story_statistics, get_all_node_types, get_calendar_data, get_cluster_data, get_entity_wikidata, get_wikidata_by_id, search_entity_wikidata
from models import GraphData, UserCreate, UserLogin, Token, UserResponse, GoogleAuthRequest, UserActivityCreate, UserActivityResponse, AdminLoginRequest, SubmissionCreate, SubmissionResponse, UserSubscriptionResponse, SubmissionUpdateRequest, GraphCameraPositionSave, GraphCameraPositionResponse
from pydantic import BaseModel
from auth import create_access_token, verify_google_token, get_current_user, get_current_admin_user
from user_service import create_user, authenticate_user, get_user_by_email, create_or_update_google_user, get_user_by_id, get_all_users, get_user_statistics
from activity_service import create_activity, get_activities, get_activity_statistics, get_user_activity_summary
from submission_service import create_submission, process_submission, get_submission, get_user_submissions, get_all_submissions
from subscription_service import get_user_subscription, update_user_subscription, get_subscription_plan, SUBSCRIPTION_PLANS
from graph_camera_service import save_camera_position, get_camera_position
from rate_limit_service import check_rate_limit, record_request
from datetime import timedelta, datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Validate configuration
try:
    Config.validate()
    logger.info("Configuration validated successfully")
except ValueError as e:
    logger.error(f"Configuration validation failed: {e}")
    raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - handles startup and shutdown"""
    # Startup: Initialize database connection
    logger.info("Starting application...")
    try:
        from database import db
        # Test database connection on startup
        try:
            result = db.execute_query("RETURN 1 as test")
            if result and result[0].get("test") == 1:
                logger.info("Database connection verified successfully")
            else:
                logger.warning("Database connection test returned unexpected result")
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            logger.warning("Application will continue, but database operations may fail")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        logger.warning("Application will continue, but database operations may fail")
    
    yield
    
    # Shutdown: Close database connection
    logger.info("Shutting down application...")
    try:
        from database import db
        db.close()
        logger.info("Database connection closed")
    except Exception as e:
        logger.warning(f"Error closing database connection: {e}")

app = FastAPI(
    title="Graph Visualization API",
    description="API for serving graph data from Neo4j database",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Graph Visualization API",
        "version": "1.0.0",
        "endpoints": {
            "stories": "/api/stories",
            "graph_data": "/api/graph/{substory_id} or /api/graph?graph_path=...",
            "calendar": "/api/calendar?section_query=...",
            "ai_search": "/api/ai/search?query=...",
            "auth": {
                "register": "/api/auth/register",
                "login": "/api/auth/login",
                "google": "/api/auth/google",
                "me": "/api/auth/me",
                "admin_login": "/api/auth/admin/login"
            },
            "admin": {
                "dashboard": "/api/admin/dashboard",
                "activities": "/api/admin/activities",
                "statistics": "/api/admin/statistics"
            },
            "activity": "/api/activity/track",
            "health": "/health"
        }
    }

# ============== Authentication Endpoints ==============

@app.post("/api/auth/register", response_model=Token)
async def register_user(user_data: UserCreate):
    """
    Register a new user with email and password
    """
    try:
        # Check if user already exists
        existing_user = get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists"
            )
        
        # Create new user
        try:
            new_user = create_user(user_data, auth_provider="local")
        except ValueError as e:
            # User already exists or validation error
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )
        except RuntimeError as e:
            # Database not initialized or schema out of date
            logger.error(f"Database initialization error: {e}")
            raise HTTPException(
                status_code=500,
                detail=str(e)
            )
        
        if not new_user:
            raise HTTPException(
                status_code=500,
                detail="Failed to create user"
            )
        
        # Create access token (include role, status, is_admin for auth context)
        access_token = create_access_token(
            data={
                "sub": new_user.id,
                "email": new_user.email,
                "full_name": new_user.full_name,
                "profile_picture": new_user.profile_picture,
                "auth_provider": new_user.auth_provider,
                "is_admin": getattr(new_user, "is_admin", False),
                "role": getattr(new_user, "role", "user"),
                "status": getattr(new_user, "status", "active"),
            }
        )
        logger.info(f"New user registered: {new_user.email}")
        return Token(access_token=access_token, token_type="bearer", user=new_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error during registration: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {str(e)}"
        )

@app.post("/api/auth/login", response_model=Token)
async def login_user(user_credentials: UserLogin):
    """
    Login with email and password
    """
    email_for_log = (user_credentials.email or "").strip()
    logger.debug(f"[auth/login] Request for email={email_for_log!r}")

    try:
        # Authenticate user
        try:
            user = authenticate_user(user_credentials.email, user_credentials.password)
            logger.debug(f"[auth/login] authenticate_user returned: user_id={user['id'] if user else None}")
        except Exception as e:
            error_msg = str(e)
            logger.exception(f"[auth/login] authenticate_user raised: {error_msg}")
            # Check if it's a database table issue
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("Database tables not initialized")
                raise HTTPException(
                    status_code=500,
                    detail="Database not initialized. Please contact administrator."
                )
            # Re-raise other exceptions
            raise

        if not user:
            logger.warning(f"[auth/login] Rejected with 401: no user returned for email={email_for_log!r}")
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password"
            )

        # Check if user is active
        if not user.get('is_active', True):
            logger.warning(f"[auth/login] Rejected with 403: user inactive for email={email_for_log!r}")
            raise HTTPException(
                status_code=403,
                detail="User account is disabled"
            )

        # Create access token (include role, status, is_admin)
        access_token = create_access_token(
            data={
                "sub": user['id'],
                "email": user['email'],
                "full_name": user.get('full_name'),
                "profile_picture": user.get('profile_picture'),
                "auth_provider": user.get('auth_provider', 'local'),
                "is_admin": user.get('is_admin', False),
                "role": user.get('role', 'user'),
                "status": user.get('status', 'active'),
            }
        )
        logger.debug(f"[auth/login] Success: user_id={user['id']}, email={user['email']}")
        user_response = UserResponse(
            id=user['id'],
            email=user['email'],
            full_name=user.get('full_name'),
            profile_picture=user.get('profile_picture'),
            is_active=user.get('is_active', True),
            created_at=user.get('created_at'),
            updated_at=user.get('updated_at'),
            auth_provider=user.get('auth_provider', 'local'),
            role=user.get('role', 'user'),
            status=user.get('status', 'active'),
        )
        return Token(access_token=access_token, token_type="bearer", user=user_response)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error during login: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Login failed: {str(e)}"
        )

@app.post("/api/auth/google", response_model=Token)
async def google_auth(auth_request: GoogleAuthRequest):
    """
    Authenticate with Google OAuth
    """
    try:
        # Verify Google token
        google_user_info = await verify_google_token(auth_request.credential)
        
        if not google_user_info:
            raise HTTPException(
                status_code=401,
                detail="Invalid Google authentication token"
            )
        
        # Check email verification
        if not google_user_info.get('email_verified', False):
            raise HTTPException(
                status_code=403,
                detail="Google account email is not verified"
            )
        
        # Create or update user
        user = create_or_update_google_user(google_user_info)
        
        if not user:
            raise HTTPException(
                status_code=500,
                detail="Failed to create/update user from Google account"
            )
        
        # Create access token
        access_token = create_access_token(
            data={
                "sub": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "profile_picture": user.profile_picture,
                "auth_provider": "google"
            }
        )
        
        logger.info(f"User authenticated with Google: {user.email}")
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error during Google authentication: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Google authentication failed: {str(e)}"
        )

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    try:
        # Fetch fresh user data from database
        user = get_user_by_id(current_user['id'])
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        return UserResponse(
            id=user['id'],
            email=user['email'],
            full_name=user.get('full_name'),
            profile_picture=user.get('profile_picture'),
            is_active=user.get('is_active', True),
            created_at=user.get('created_at'),
            updated_at=user.get('updated_at'),
            auth_provider=user.get('auth_provider', 'local'),
            role=user.get('role', 'user'),
            status=user.get('status', 'active'),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching user info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user information: {str(e)}"
        )

# ============== Admin Authentication Endpoints ==============

@app.post("/api/auth/admin/login", response_model=Token)
async def admin_login(credentials: AdminLoginRequest):
    """
    Admin login with additional verification
    Uses PostgreSQL (Neon) for admin user authentication
    """
    try:
        # Import admin user service (PostgreSQL)
        from admin_user_service import authenticate_admin_user
        
        # Authenticate admin user from PostgreSQL
        user = authenticate_admin_user(credentials.email, credentials.password)
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password"
            )
        
        # Check if user is admin
        if not user.get('is_admin', False):
            logger.warning(f"Non-admin user attempted admin login: {user['email']}")
            raise HTTPException(
                status_code=403,
                detail="Admin privileges required"
            )
        
        # Create access token with admin flag
        access_token = create_access_token(
            data={
                "sub": user['id'],
                "email": user['email'],
                "full_name": user.get('full_name'),
                "profile_picture": user.get('profile_picture'),
                "auth_provider": user.get('auth_provider', 'local'),
                "is_admin": True
            }
        )
        
        logger.info(f"Admin user logged in: {user['email']}")
        
        user_response = UserResponse(
            id=user['id'],
            email=user['email'],
            full_name=user.get('full_name'),
            profile_picture=user.get('profile_picture'),
            is_active=user.get('is_active', True),
            is_admin=user.get('is_admin', False),
            created_at=user.get('created_at'),
            updated_at=user.get('updated_at'),
            auth_provider=user.get('auth_provider', 'local'),
            role=user.get('role', 'user'),
            status=user.get('status', 'active'),
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error during admin login: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Admin login failed: {str(e)}"
        )

# ============== Activity Tracking Endpoints ==============

@app.post("/api/activity/track", response_model=UserActivityResponse)
async def track_activity(activity: UserActivityCreate):
    """
    Track user activity (page views, section views, etc.)
    Can be called by authenticated or anonymous users
    """
    try:
        try:
            result = create_activity(activity)
        except Exception as e:
            error_msg = str(e)
            # Check if table doesn't exist
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("Database tables not initialized")
                raise HTTPException(
                    status_code=500,
                    detail="Database not initialized. Please contact administrator."
                )
            # Re-raise other exceptions
            raise
        
        if not result:
            raise HTTPException(
                status_code=500,
                detail="Failed to create activity record"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error tracking activity: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Activity tracking failed: {str(e)}"
        )

# ============== Admin Dashboard Endpoints ==============

@app.get("/api/admin/statistics")
async def get_admin_statistics(
    days: int = 7,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get activity statistics for admin dashboard (Admin only)
    """
    try:
        stats = get_activity_statistics(days=days)
        return stats
    except Exception as e:
        logger.exception(f"Error fetching admin statistics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch statistics: {str(e)}"
        )

@app.get("/api/admin/activities", response_model=List[UserActivityResponse])
async def get_admin_activities(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    activity_type: Optional[str] = None,
    days: int = 7,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get user activities with filters (Admin only)
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days) if days else None
        
        activities = get_activities(
            user_id=user_id,
            session_id=session_id,
            activity_type=activity_type,
            start_date=start_date,
            limit=limit,
            skip=skip
        )
        
        return activities
    except Exception as e:
        logger.exception(f"Error fetching activities: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch activities: {str(e)}"
        )

@app.get("/api/admin/users/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get activity summary for a specific user (Admin only)
    """
    try:
        summary = get_user_activity_summary(user_id, days=days)
        return summary
    except Exception as e:
        logger.exception(f"Error fetching user activity: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user activity: {str(e)}"
        )

# ============== Submission Endpoints ==============

@app.post("/api/submissions", response_model=SubmissionResponse)
async def create_submission_endpoint(
    submission_type: str = Form(...),
    input_data: Optional[str] = Form(None),
    input_url: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON string array
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new submission (URL, text, or PDF)
    Requires authentication and rate limit check
    """
    try:
        user_id = current_user['id']
        
        # Check rate limit
        allowed, error_msg = check_rate_limit(user_id)
        if not allowed:
            raise HTTPException(status_code=429, detail=error_msg)
        
        # Validate submission type
        if submission_type not in ['url', 'text', 'pdf']:
            raise HTTPException(status_code=400, detail="Invalid submission_type. Must be 'url', 'text', or 'pdf'")
        
        # Handle PDF upload
        file_path = None
        file_name = None
        file_size = None
        
        if submission_type == 'pdf':
            if not file:
                raise HTTPException(status_code=400, detail="PDF file is required for PDF submissions")
            
            # Validate file type
            if not file.filename.endswith('.pdf'):
                raise HTTPException(status_code=400, detail="Only PDF files are allowed")
            
            # Save file
            upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            
            file_name = file.filename
            file_path = os.path.join(upload_dir, f"{user_id}_{int(time.time())}_{file_name}")
            
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                file_size = len(content)
                await f.write(content)
        
        elif submission_type == 'url':
            if not input_url:
                raise HTTPException(status_code=400, detail="input_url is required for URL submissions")
        
        elif submission_type == 'text':
            if not input_data:
                raise HTTPException(status_code=400, detail="input_data is required for text submissions")
        
        # Parse tags
        tags_list = []
        if tags:
            try:
                import json
                tags_list = json.loads(tags)
            except:
                tags_list = []
        
        # Create submission
        submission_data = SubmissionCreate(
            submission_type=submission_type,
            input_data=input_data,
            input_url=input_url,
            tags=tags_list
        )
        
        submission = create_submission(user_id, submission_data, file_path, file_name, file_size)
        
        if not submission:
            raise HTTPException(status_code=500, detail="Failed to create submission")
        
        # Record request for rate limiting
        record_request(user_id, int(submission.id), "submission")
        
        # Process submission asynchronously (in production, use a task queue)
        # For now, process synchronously
        try:
            processed_submission = process_submission(submission.id)
            if processed_submission:
                return processed_submission
        except Exception as e:
            logger.error(f"Error processing submission: {e}")
            # Return submission even if processing fails
            pass
        
        return submission
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating submission: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create submission: {str(e)}")

@app.get("/api/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission_endpoint(
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a submission by ID"""
    try:
        submission = get_submission(submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        # Check if user owns this submission or is admin
        if submission.user_id != current_user['id'] and not current_user.get('is_admin'):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return submission
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting submission: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get submission: {str(e)}")

@app.get("/api/submissions", response_model=List[SubmissionResponse])
async def get_user_submissions_endpoint(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all submissions for the current user"""
    try:
        submissions = get_user_submissions(current_user['id'], limit, offset)
        return submissions
    except Exception as e:
        logger.exception(f"Error getting user submissions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get submissions: {str(e)}")

@app.get("/api/subscription", response_model=UserSubscriptionResponse)
async def get_user_subscription_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's subscription details"""
    try:
        subscription = get_user_subscription(current_user['id'])
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        return subscription
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get subscription: {str(e)}")

# ============== Graph camera position (save/restore view) ==============

@app.post("/api/graph-camera-position")
async def save_graph_camera_position_endpoint(
    body: GraphCameraPositionSave,
    current_user: dict = Depends(get_current_user),
):
    """Save the current graph camera position for the authenticated user (by email)."""
    try:
        email = current_user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="User email not found")
        ok = save_camera_position(
            subscriber_email=email,
            position_x=body.position_x,
            position_y=body.position_y,
            position_z=body.position_z,
            target_x=body.target_x,
            target_y=body.target_y,
            target_z=body.target_z,
        )
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to save camera position")
        return {"message": "Camera position saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error saving graph camera position: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/graph-camera-position", response_model=Optional[GraphCameraPositionResponse])
async def get_graph_camera_position_endpoint(
    current_user: dict = Depends(get_current_user),
):
    """Get the last saved graph camera position for the authenticated user."""
    try:
        email = current_user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="User email not found")
        row = get_camera_position(subscriber_email=email)
        if not row:
            return None
        return GraphCameraPositionResponse(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting graph camera position: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

# ============== Admin Submission Endpoints ==============

@app.get("/api/admin/submissions")
async def get_admin_submissions(
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get all submissions (Admin only)"""
    try:
        submissions = get_all_submissions(limit, offset)
        return submissions
    except Exception as e:
        logger.exception(f"Error getting all submissions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get submissions: {str(e)}")

@app.put("/api/admin/users/{user_id}/subscription")
async def update_user_subscription_endpoint(
    user_id: str,
    update_data: SubmissionUpdateRequest,
    current_user: dict = Depends(get_current_admin_user)
):
    """Update user subscription (Admin only)"""
    try:
        if update_data.subscription_tier:
            plan = get_subscription_plan(update_data.subscription_tier)
            if not plan:
                raise HTTPException(status_code=400, detail=f"Invalid subscription tier: {update_data.subscription_tier}")
        
        if not update_data.subscription_tier:
            raise HTTPException(status_code=400, detail="subscription_tier is required")
        
        status = update_data.subscription_status or "active"
        success = update_user_subscription(user_id, update_data.subscription_tier, status)
        
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "Subscription updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update subscription: {str(e)}")

@app.get("/api/admin/subscription-plans")
async def get_subscription_plans_endpoint(
    current_user: dict = Depends(get_current_admin_user)
):
    """Get all available subscription plans (Admin only)"""
    try:
        return list(SUBSCRIPTION_PLANS.values())
    except Exception as e:
        logger.exception(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get subscription plans: {str(e)}")

@app.get("/api/admin/users")
async def get_all_users_endpoint(
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get all users (Admin only)"""
    try:
        users = get_all_users(limit, offset)
        return users
    except Exception as e:
        logger.exception(f"Error getting users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get users: {str(e)}")

@app.get("/api/admin/users/statistics")
async def get_user_statistics_endpoint(
    current_user: dict = Depends(get_current_admin_user)
):
    """Get user statistics (Admin only)"""
    try:
        stats = get_user_statistics()
        return stats
    except Exception as e:
        logger.exception(f"Error getting user statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get user statistics: {str(e)}")

@app.get("/api/admin/dashboard")
async def get_admin_dashboard(
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get comprehensive dashboard data for admin (Admin only)
    """
    try:
        # Get statistics for last 7 days
        stats_7d = get_activity_statistics(days=7)
        # Get statistics for last 30 days
        stats_30d = get_activity_statistics(days=30)
        
        # Get recent activities
        recent_activities = get_activities(limit=20, skip=0)
        
        return {
            "stats_7_days": stats_7d,
            "stats_30_days": stats_30d,
            "recent_activities": [activity.model_dump() for activity in recent_activities],
            "admin_user": current_user
        }
    except Exception as e:
        logger.exception(f"Error fetching dashboard data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch dashboard data: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Check the health of the API and database connection"""
    from database import db
    from config import Config
    
    health_status = {
        "api": "healthy",
        "database": "unknown",
        "database_uri": Config.NEO4J_URI,
        "database_user": Config.NEO4J_USER,
        "timestamp": None
    }
    
    try:
        # Try to connect and execute a simple query
        result = db.execute_query("RETURN 1 as test")
        if result and result[0].get("test") == 1:
            health_status["database"] = "connected"
            health_status["timestamp"] = time.time()
        else:
            health_status["database"] = "error: Query returned unexpected result"
            return health_status
    except Exception as e:
        error_msg = str(e)
        health_status["database"] = f"error: {error_msg}"
        health_status["error_details"] = error_msg
        # Don't raise exception, just return the status for diagnostics
        return health_status
    
    return health_status

@app.get("/api/stories", response_model=List[dict])
async def get_stories():
    try:
        stories = get_all_stories()

        return [story.model_dump() for story in stories]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stories: {str(e)}")

@app.get("/api/graph/{substory_id}", response_model=dict)
async def get_graph_by_substory_id(substory_id: str):
    """Get graph data for a substory/section. Numeric substory_id is treated as section_gid, else as section_query."""
    try:
        if substory_id.isdigit() or (substory_id.replace('.', '').isdigit()):
            graph_data = get_graph_data(section_gid=substory_id)
        else:
            graph_data = get_graph_data(section_query=substory_id)
        out = graph_data.model_dump()
        description = get_gr_id_description(substory_id)
        if description is not None:
            out["description"] = description
        return out
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching graph data for substory {substory_id}: {str(e)}"
        )

@app.get("/api/graph", response_model=dict)
async def get_graph_by_path(graph_path: Optional[str] = None):
    """Get graph data by graph_path (same as section_query). Requires graph_path query parameter."""
    if not graph_path:
        raise HTTPException(status_code=400, detail="graph_path parameter is required")

    try:
        graph_data = get_graph_data(graph_path=graph_path)
        out = graph_data.model_dump()
        description = get_gr_id_description(graph_path)
        if description is not None:
            out["description"] = description
        return out
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching graph data for path {graph_path}: {str(e)}"
        )

@app.get("/api/graph/{substory_id}/country/{country_name}", response_model=dict)
async def get_graph_by_substory_and_country(substory_id: str, country_name: str):
    """Get graph data for a section filtered by country"""
    try:
        # First, get the section_query from the substory
        # The substory_id might be a section_query or we need to look it up
        # For now, treat substory_id as section_query (same as get_graph_by_substory_id)
        section_query = substory_id
        
        graph_data = get_graph_data_by_section_and_country(section_query, country_name)
        return graph_data.model_dump()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching graph data for substory {substory_id} and country {country_name}: {str(e)}"
        )

@app.get("/api/calendar", response_model=dict)
async def get_calendar_by_section(section_query: Optional[str] = None, section_gid: Optional[str] = None, section_title: Optional[str] = None):
    """Get calendar/timeline data for a section based on relationships with all nodes"""
    logger.debug(f"Calendar endpoint: section_query={section_query}, section_gid={section_gid}, section_title={section_title}")
    
    if not section_query and not section_gid and not section_title:
        logger.warning("Calendar endpoint called without any section parameter")
        raise HTTPException(status_code=400, detail="At least one of section_query, section_gid, or section_title must be provided")
    
    try:
        logger.debug(f"Fetching calendar data for section_query={section_query}")
        calendar_data = get_calendar_data(
            section_gid=section_gid,
            section_query=section_query,
            section_title=section_title
        )
        logger.debug(f"Retrieved calendar data: {len(calendar_data.get('calendar_items', []))} items")
        return calendar_data
    except ValueError as e:
        logger.warning(f"Validation error in calendar endpoint: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching calendar data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching calendar data: {str(e)}"
        )


@app.get("/api/cluster", response_model=dict)
async def get_cluster_endpoint(
    node_type: str,
    property_key: str,
    section_query: Optional[str] = None,
    cluster_limit: int = 5,
    node_limit: int = 10
):
    """
    Get clustered node samples grouped by a property key for a given node type.

    - `node_type`: normalized label from frontend (e.g. "entity", "place_of_performance")
    - `property_key`: Neo4j property name (exact key)
    - `section_query`: optional filter to a section (matches `n.section`)
    """
    try:
        return get_cluster_data(
            node_type=node_type,
            property_key=property_key,
            section_query=section_query,
            cluster_limit=cluster_limit,
            node_limit=node_limit
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching cluster data: {str(e)}")

@app.get("/api/stories/{story_id}/statistics", response_model=dict)
async def get_story_statistics_endpoint(story_id: str):
    """Get statistics for a story (total nodes, entity count, etc.)"""
    try:
        statistics = get_story_statistics(story_id)
        return statistics
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching statistics for story {story_id}: {str(e)}"
        )

@app.get("/api/node-types", response_model=List[str])
async def get_node_types():
    """Get all distinct node types from the database"""
    try:
        node_types = get_all_node_types()
        return node_types
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching node types: {str(e)}"
        )

# ============== Wikidata Endpoint (registered early to avoid route conflicts) ==============
@app.get("/api/wikidata/{node_type}/{node_id}")
async def get_wikidata_by_node(node_type: str, node_id: str):
    """
    Get wikidata information by node type and node id.
    Supports node types: entity, concept, data, entity_gen, framework.
    """
    try:
        from urllib.parse import unquote
        node_type = unquote(node_type)
        node_id = unquote(node_id)
        if not node_id or not node_id.strip():
            raise HTTPException(status_code=400, detail="Node id is required")
        if not node_type or not node_type.strip():
            raise HTTPException(status_code=400, detail="Node type is required")
        result = get_wikidata_by_id(node_id.strip(), node_type.strip())
        logger.debug(f"Wikidata request: node_type={node_type}, node_id={node_id}, found={result.get('found')}")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error fetching wikidata for node_type '{node_type}' node_id '{node_id}': {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching wikidata: {str(e)}")



# ============== Entity Wikidata Endpoints ==============

@app.get("/api/entity/wikidata/{entity_name}")
async def get_entity_wikidata_by_name(entity_name: str):
    """
    Get detailed wikidata information for an entity by name.
    Returns comprehensive information from the entity_wikidata table in the wuhan database.
    """
    try:
        from urllib.parse import unquote
        
        # Decode URL-encoded entity name
        entity_name = unquote(entity_name)
        
        if not entity_name or not entity_name.strip():
            raise HTTPException(status_code=400, detail="Entity name is required")
        
        result = get_entity_wikidata(entity_name.strip())
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error fetching entity wikidata for '{entity_name}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching entity wikidata: {str(e)}"
        )


@app.get("/api/entity/wikidata")
async def search_entity_wikidata_endpoint(name: Optional[str] = None, q: Optional[str] = None, limit: int = 10):
    """
    Search for entities in the wikidata table.
    Supports both 'name' and 'q' query parameters for flexibility.
    
    Args:
        name: Entity name to search for
        q: Alternative query parameter for search
        limit: Maximum number of results (default: 10, max: 50)
    """
    try:
        search_term = name or q
        if not search_term or not search_term.strip():
            raise HTTPException(status_code=400, detail="Search term is required (use 'name' or 'q' parameter)")
        
        # Limit the results to prevent abuse
        actual_limit = min(max(1, limit), 50)
        
        result = search_entity_wikidata(search_term.strip(), actual_limit)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error searching entity wikidata: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error searching entity wikidata: {str(e)}"
        )


class SearchQuery(BaseModel):
    query: str

class SummaryRequest(BaseModel):
    query: str  # User's question about the graph
    graphData: dict  # The current graph data with nodes and links

@app.post("/api/ai/summary", response_model=dict)
async def generate_ai_summary(request: SummaryRequest):
    """
    Generate an AI summary of graph data with embedded entity markers.
    
    The summary will use [[Entity Name]] markers for entities that exist in the graph,
    allowing the frontend to render them as clickable buttons.
    """
    try:
        if not request.query or not request.query.strip():
            raise HTTPException(status_code=400, detail="Query is required")
        
        if not request.graphData:
            raise HTTPException(status_code=400, detail="Graph data is required")
        
        from services import generate_graph_summary
        
        summary_data = generate_graph_summary(
            query=request.query.strip(),
            graph_data=request.graphData
        )
        
        return summary_data
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error generating AI summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating AI summary: {str(e)}"
        )

@app.post("/api/ai/search", response_model=dict)
async def ai_search(search_query: SearchQuery):
    try:
        if not search_query.query or not search_query.query.strip():
            raise HTTPException(status_code=400, detail="Query parameter is required")

        graph_data, generated_query = search_with_ai(search_query.query.strip())
        return {
            "graphData": graph_data.model_dump(),
            "generatedQuery": generated_query
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error performing AI search: {str(e)}"
        )

@app.get("/api/ai/search", response_model=dict)
async def ai_search_get(query: str):
    try:
        if not query or not query.strip():
            raise HTTPException(status_code=400, detail="Query parameter is required")

        graph_data, generated_query = search_with_ai(query.strip())
        return {
            "graphData": graph_data.model_dump(),
            "generatedQuery": generated_query
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error performing AI search: {str(e)}"
        )

class CypherQuery(BaseModel):
    query: str

class CreateNodeRequest(BaseModel):
    category: str  # Node label/type
    properties: dict  # Node properties
    # Optional: attach this new node to the currently selected section (new DB uses :section gid -> gr_id).
    section_gid: Optional[str] = None

@app.post("/api/cypher/execute", response_model=dict)
async def execute_cypher_query(cypher_query: CypherQuery):
    try:
        if not cypher_query.query or not cypher_query.query.strip():
            raise HTTPException(status_code=400, detail="Cypher query is required")

        query = cypher_query.query.strip()

        from services import extract_graph_data_from_cypher_results
        from database import db

        try:
            results = db.execute_query(query)
        except Exception as db_error:
            error_msg = str(db_error)
            raise HTTPException(
                status_code=400,
                detail=f"Cypher query execution failed: {error_msg}"
            )

        if not results:
            return {
                "graphData": GraphData(nodes=[], links=[]).model_dump(),
                "executedQuery": query,
                "rawResults": []
            }

        # Check if this is a schema query (like CALL db.schema.nodeTypeProperties())
        # Schema queries return simple records, not graph data
        is_schema_query = "CALL db.schema" in query.upper() or "db.schema" in query
        
        # Try to extract graph data first
        graph_data = extract_graph_data_from_cypher_results(results)
        
        # BACKEND LOG: Graph data extraction results
        # Check if we have actual graph data (nodes or links)
        has_graph_data = (graph_data.nodes and len(graph_data.nodes) > 0) or (graph_data.links and len(graph_data.links) > 0)
        
        
        # Check if results look like simple records (not graph data)
        # Simple records typically have keys like nodeType, properties, etc. and don't have gid
        is_simple_record = False
        if results and len(results) > 0:
            first_record = results[0]
            if isinstance(first_record, dict):
                # Check if it has schema-like keys (nodeType, properties) or other non-graph keys
                record_keys = list(first_record.keys())
                schema_keys = ["nodeType", "properties", "propertyName", "mandatory"]
                has_schema_keys = any(key in record_keys for key in schema_keys)
                has_gid = "gid" in record_keys
                # If it has schema keys but no gid, it's likely a simple record
                is_simple_record = has_schema_keys and not has_gid
        
        # If it's a schema query, simple record, or no graph data was extracted, return raw results
        if is_schema_query or is_simple_record or not has_graph_data:
            reason = "schema query" if is_schema_query else ("simple record" if is_simple_record else "no graph data")
            # Convert results to JSON-serializable format
            # Neo4j records might contain special types that need conversion
            import json
            def make_serializable(obj):
                """Recursively convert object to JSON-serializable format"""
                if obj is None:
                    return None
                elif isinstance(obj, (str, int, float, bool)):
                    return obj
                elif isinstance(obj, list):
                    return [make_serializable(item) for item in obj]
                elif isinstance(obj, dict):
                    return {key: make_serializable(value) for key, value in obj.items()}
                else:
                    # For any other type, convert to string
                    try:
                        # Try to convert to JSON first
                        json.dumps(obj)
                        return obj
                    except (TypeError, ValueError):
                        return str(obj)
            
            serializable_results = [make_serializable(record) for record in results]
            
            response = {
                "graphData": GraphData(nodes=[], links=[]).model_dump(),
                "executedQuery": query,
                "rawResults": serializable_results  # Return serializable results
            }
            return response
        
        response = {
            "graphData": graph_data.model_dump(),
            "executedQuery": query,
            "rawResults": None
        }
        return response
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"[BACKEND] ❌ Unexpected error in execute_cypher_query:")
        logger.error(f"[BACKEND] Error type: {type(e).__name__}")
        logger.error(f"[BACKEND] Error message: {str(e)}")
        logger.error(f"[BACKEND] Full traceback:\n{error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Error executing Cypher query: {str(e)}"
        )

@app.post("/api/nodes/create")
async def create_node(node_request: CreateNodeRequest):
    """
    Create a new node in Neo4j with the specified label and properties.
    
    Args:
        node_request: Contains category (node label) and properties (dict of property key-value pairs)
    
    Returns:
        Created node data with generated ID
    """
    try:
        from database import db
        
        # Validate inputs
        if not node_request.category or not node_request.category.strip():
            raise HTTPException(status_code=400, detail="Category (node label) is required")
        
        category = node_request.category.strip()
        properties = node_request.properties or {}

        # If a section_gid was provided, resolve the section's `graph name` and assign it to node's gr_id.
        # New DB: Cross-property matching - section.`graph name` matches node.gr_id
        section_gid = (node_request.section_gid or "").strip() if node_request.section_gid else None
        if section_gid:
            try:
                section_lookup = db.execute_query(
                    """
                    MATCH (s:section)
                    WHERE toString(s.gid) = toString($gid)
                    RETURN s.`graph name` AS graph_name
                    LIMIT 1
                    """,
                    {"gid": section_gid},
                )
                if section_lookup and section_lookup[0].get("graph_name") is not None:
                    graph_name = section_lookup[0].get("graph_name")
                    # Primary membership field - node.gr_id = section.`graph name`
                    properties.setdefault("gr_id", graph_name)
            except Exception as e:
                logger.warning(f"[BACKEND] Could not resolve section `graph name` for section_gid={section_gid}: {e}")

        # Ensure every created node has a stable gid (new DB relies on gid heavily)
        if "gid" not in properties or properties.get("gid") in [None, ""]:
            import uuid
            properties["gid"] = uuid.uuid4().hex
        
        # Clean category label - remove backticks if present, we'll add them properly
        clean_category = category
        if clean_category.startswith(':`'):
            clean_category = clean_category[2:]
        if clean_category.endswith('`'):
            clean_category = clean_category[:-1]
        
        # Build Cypher CREATE query
        # Handle node labels with spaces using backticks
        if ' ' in clean_category or '-' in clean_category:
            node_label = f"`{clean_category}`"
        else:
            node_label = clean_category
        
        # Build property assignments
        # Property names with spaces need backticks in Cypher
        property_assignments = []
        params = {}
        
        for prop_key, prop_value in properties.items():
            if prop_key and prop_key.strip() and prop_value is not None:
                # Clean property key
                clean_prop_key = prop_key.strip()
                
                # Use backticks for property names with spaces
                if ' ' in clean_prop_key or '-' in clean_prop_key:
                    cypher_prop_key = f"`{clean_prop_key}`"
                else:
                    cypher_prop_key = clean_prop_key
                
                # Use parameterized query for values
                param_name = f"prop_{len(params)}"
                property_assignments.append(f"{cypher_prop_key}: ${param_name}")
                params[param_name] = prop_value
        
        # If no properties, create node with just the label
        if not property_assignments:
            query = f"CREATE (n:{node_label}) RETURN n"
        else:
            props_str = ", ".join(property_assignments)
            query = f"CREATE (n:{node_label} {{{props_str}}}) RETURN n"
        
        logger.debug(f"[BACKEND] Creating node with label: {node_label}, query: {query[:80]}...")

        # Execute write query
        try:
            results = db.execute_write_query(query, params)
            
            if not results or len(results) == 0:
                raise HTTPException(
                    status_code=500,
                    detail="Node creation failed: No result returned"
                )
            
            # Extract created node data
            # Neo4j returns records as dicts via record.data(), but 'n' might still be a Node object
            result_record = results[0]
            created_node = result_record.get('n', {})
            
            # Convert Neo4j Node object to dict
            # Neo4j Node objects have a _properties attribute
            if hasattr(created_node, '_properties'):
                # It's a Neo4j Node object, extract properties
                node_data = dict(created_node._properties)
                # Add element_id if available (Neo4j 5.x+)
                if hasattr(created_node, 'element_id'):
                    node_data['element_id'] = created_node.element_id
                # Add id if available (Neo4j 4.x)
                if hasattr(created_node, 'id'):
                    node_data['id'] = created_node.id
            elif isinstance(created_node, dict):
                # It's already a dict
                node_data = created_node
            else:
                # Fallback: try to convert to dict
                try:
                    node_data = dict(created_node) if created_node else {}
                except (TypeError, ValueError):
                    # If conversion fails, create empty dict
                    node_data = {}
            
            logger.debug(f"[BACKEND] Node created: {node_data}")

            return {
                "success": True,
                "node": node_data,
                "message": f"Node with label '{category}' created successfully"
            }
            
        except Exception as db_error:
            error_msg = str(db_error)
            logger.error(f"[BACKEND] ❌ Database error creating node: {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to create node: {error_msg}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[BACKEND] ❌ Error creating node: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating node: {str(e)}"
        )

class DeleteNodeRequest(BaseModel):
    node_id: str  # Node ID (gid) to delete

@app.delete("/api/nodes/delete")
async def delete_node(node_request: DeleteNodeRequest):
    """
    Delete a node and all its relationships from Neo4j.
    
    Args:
        node_request: Contains node_id (gid) of the node to delete
    
    Returns:
        Success response with deletion details
    """
    try:
        from database import db
        
        # Validate inputs
        if not node_request.node_id:
            raise HTTPException(status_code=400, detail="Node ID is required")
        
        # Convert to string and strip whitespace
        # Handle both string and numeric IDs
        node_id_str = str(node_request.node_id).strip()
        
        if not node_id_str or node_id_str.lower() in ['none', 'null', 'undefined', '']:
            raise HTTPException(status_code=400, detail="Node ID is required and must be valid")
        
        logger.debug(f"[BACKEND] Deleting node with ID: {node_id_str}")

        # First, try to find the node to see what properties it has
        # This helps with debugging and ensures we match correctly
        find_query = """
        MATCH (n)
        WHERE n.gid = $node_id 
           OR toString(n.gid) = $node_id
           OR (toFloat($node_id) IS NOT NULL AND n.gid = toFloat($node_id))
           OR (toInteger($node_id) IS NOT NULL AND n.gid = toInteger($node_id))
           OR toString(id(n)) = $node_id
           OR (toFloat($node_id) IS NOT NULL AND id(n) = toInteger(toFloat($node_id)))
           OR elementId(n) = $node_id
        RETURN n, id(n) as internal_id, n.gid as gid_value, toString(n.gid) as gid_string, labels(n) as node_labels
        LIMIT 1
        """
        
        find_params = {"node_id": node_id_str}
        
        # Try to find the node first
        try:
            find_results = db.execute_query(find_query, find_params)
            if find_results and len(find_results) > 0:
                node_info = find_results[0]
                logger.debug(f"[BACKEND] Found node: internal_id={node_info.get('internal_id')}, gid={node_info.get('gid_value')}, labels={node_info.get('node_labels')}")
            else:
                logger.warning(f"[BACKEND] Node not found with initial query, trying alternative matching strategies")
        except Exception as find_error:
            logger.warning(f"[BACKEND] Error in find query: {find_error}, proceeding with delete query")
        
        # Build Cypher query to delete node and all its relationships
        # DETACH DELETE removes the node and all its relationships
        # Try multiple matching strategies to handle different ID formats
        # Handle cases where gid might be stored as number or string
        query = """
        MATCH (n)
        WHERE 
           n.gid = $node_id 
           OR toString(n.gid) = $node_id
           OR (toFloat($node_id) IS NOT NULL AND n.gid = toFloat($node_id))
           OR (toInteger($node_id) IS NOT NULL AND n.gid = toInteger($node_id))
           OR toString(id(n)) = $node_id
           OR (toFloat($node_id) IS NOT NULL AND id(n) = toInteger(toFloat($node_id)))
           OR elementId(n) = $node_id
        DETACH DELETE n
        RETURN count(n) as deleted_count
        """
        
        params = {"node_id": node_id_str}
        
        # Execute write query
        try:
            results = db.execute_write_query(query, params)

            if not results or len(results) == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Node with ID '{node_id_str}' not found - query returned no results"
                )
            
            deleted_count = results[0].get('deleted_count', 0)

            if deleted_count == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Node with ID '{node_id_str}' not found or already deleted (matched 0 nodes)"
                )
            
            logger.debug(f"[BACKEND] Node deleted. Count: {deleted_count}")

            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": f"Node with ID '{node_id_str}' and all its relationships deleted successfully"
            }
            
        except HTTPException:
            raise
        except Exception as db_error:
            error_msg = str(db_error)
            logger.error(f"[BACKEND] ❌ Database error deleting node: {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to delete node: {error_msg}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[BACKEND] ❌ Error deleting node: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting node: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    import socket
    
    # Check if port is already in use
    def is_port_in_use(host: str, port: int) -> bool:
        """Check if a port is already in use"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return False
            except OSError:
                return True
    
    # Check port availability
    if is_port_in_use(Config.BACKEND_HOST, Config.BACKEND_PORT):
        logger.error(
            f"Port {Config.BACKEND_PORT} is already in use. "
            f"Please stop the existing server or change BACKEND_PORT in your .env file."
        )
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
        logger.info(f"Starting server on {Config.BACKEND_HOST}:{Config.BACKEND_PORT}")
        uvicorn.run(
            "main:app",
            host=Config.BACKEND_HOST,
            port=Config.BACKEND_PORT,
            reload=False,  # Use run.py for development with auto-reload
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
        else:
            logger.error(f"Failed to start server: {e}")
            raise
    except Exception as e:
        logger.error(f"Unexpected error starting server: {e}")
        raise
