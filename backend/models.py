from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from enum import Enum

# User Identity Model Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    TESTER = "tester"
    USER = "user"

class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"

class Substory(BaseModel):
    id: str
    title: str
    headline: str
    brief: str
    graphPath: Optional[str] = None
    section_query: Optional[str] = None

class Chapter(BaseModel):
    id: str
    title: str
    headline: str
    brief: str
    substories: List[Substory]
    total_nodes: Optional[int] = 0

class Story(BaseModel):
    id: str
    title: str
    headline: str
    brief: str
    path: str
    chapters: List[Chapter]

class Node(BaseModel):
    id: str
    name: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    highlight: Optional[bool] = None
    type: Optional[str] = None

    class Config:
        extra = "allow"

class Link(BaseModel):
    id: str
    sourceId: str
    targetId: str
    title: Optional[str] = None
    label: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    curvature: Optional[float] = None
    curveRotation: Optional[float] = None

    class Config:
        extra = "allow"

class GraphData(BaseModel):
    nodes: List[Node]
    links: List[Link]

class StoriesResponse(BaseModel):
    stories: List[Story]

# Authentication Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    profile_picture: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False  # Deprecated: use role instead, kept for backward compatibility
    role: Optional[str] = "user"  # admin, tester, user
    status: Optional[str] = "active"  # active, suspended
    created_at: Optional[datetime] = None
    auth_provider: Optional[str] = "local"  # local, google

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token

# User Activity Tracking Models
class ActivityType(BaseModel):
    page_view: str = "page_view"
    section_view: str = "section_view"
    graph_interaction: str = "graph_interaction"
    search: str = "search"

class UserActivityCreate(BaseModel):
    user_id: Optional[str] = None  # Optional for anonymous users
    session_id: str
    activity_type: str
    page_url: Optional[str] = None
    section_id: Optional[str] = None
    section_title: Optional[str] = None
    duration_seconds: Optional[int] = None
    metadata: Optional[Dict] = None

class UserActivityResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    session_id: str
    activity_type: str
    page_url: Optional[str] = None
    section_id: Optional[str] = None
    section_title: Optional[str] = None
    duration_seconds: Optional[int] = None
    metadata: Optional[Dict] = None
    timestamp: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str
    admin_key: Optional[str] = None  # Optional admin verification key

# Subscription Models
class SubscriptionTier(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"

class SubscriptionPlan(BaseModel):
    tier: str
    name: str
    requests_per_second: int
    requests_per_month: int
    price: Optional[float] = None
    features: List[str] = []

class UserSubscriptionResponse(BaseModel):
    user_id: str
    subscription_tier: str
    subscription_status: str
    subscription_start_date: Optional[datetime] = None
    subscription_end_date: Optional[datetime] = None
    requests_this_month: int
    monthly_limit: int
    requests_per_second_limit: int

# Submission Models
class SubmissionType(str, Enum):
    URL = "url"
    TEXT = "text"
    PDF = "pdf"

class SubmissionCreate(BaseModel):
    submission_type: str  # url, text, pdf
    input_data: Optional[str] = None  # For text submissions
    input_url: Optional[str] = None  # For URL submissions
    tags: Optional[List[str]] = []

class SubmissionResponse(BaseModel):
    id: str
    user_id: str
    submission_type: str
    input_data: Optional[str] = None
    input_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    status: str  # pending, processing, completed, failed
    processing_result: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = []
    created_at: datetime
    processed_at: Optional[datetime] = None

class SubmissionUpdateRequest(BaseModel):
    subscription_tier: Optional[str] = None
    subscription_status: Optional[str] = None
