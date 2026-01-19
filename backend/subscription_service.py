"""
Subscription management service for PostgreSQL
Handles subscription tiers, limits, and tracking
"""
from typing import Optional, Dict
from datetime import datetime, timedelta
from neon_database import neon_db
from models import UserSubscriptionResponse, SubscriptionPlan
import logging

logger = logging.getLogger(__name__)

# Subscription tier definitions
SUBSCRIPTION_PLANS: Dict[str, SubscriptionPlan] = {
    "free": SubscriptionPlan(
        tier="free",
        name="Free",
        requests_per_second=1,
        requests_per_month=10,
        price=0.0,
        features=["Basic graph visualization", "10 submissions per month"]
    ),
    "basic": SubscriptionPlan(
        tier="basic",
        name="Basic",
        requests_per_second=2,
        requests_per_month=100,
        price=9.99,
        features=["Advanced graph visualization", "100 submissions per month", "Priority processing"]
    ),
    "pro": SubscriptionPlan(
        tier="pro",
        name="Pro",
        requests_per_second=5,
        requests_per_month=1000,
        price=49.99,
        features=["Unlimited graph visualization", "1000 submissions per month", "Fast processing", "Custom tags"]
    ),
    "enterprise": SubscriptionPlan(
        tier="enterprise",
        name="Enterprise",
        requests_per_second=10,
        requests_per_month=10000,
        price=199.99,
        features=["Unlimited everything", "10000+ submissions per month", "Highest priority", "API access", "Custom integrations"]
    )
}

def get_subscription_plan(tier: str) -> Optional[SubscriptionPlan]:
    """Get subscription plan details for a tier"""
    return SUBSCRIPTION_PLANS.get(tier.lower())

def get_user_subscription(user_id: str) -> Optional[UserSubscriptionResponse]:
    """Get user subscription details"""
    try:
        query = """
        SELECT 
            id, subscription_tier, subscription_status, 
            subscription_start_date, subscription_end_date
        FROM users
        WHERE id = %s
        """
        result = neon_db.execute_query(query, (user_id,))
        
        if not result or len(result) == 0:
            return None
        
        user = result[0]
        tier = user.get('subscription_tier', 'free')
        plan = get_subscription_plan(tier)
        
        if not plan:
            plan = get_subscription_plan('free')
        
        # Get requests this month
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        
        count_query = """
        SELECT COUNT(*) as count
        FROM rate_limit_tracking
        WHERE user_id = %s AND request_timestamp >= %s
        """
        count_result = neon_db.execute_query(count_query, (user_id, month_start))
        requests_this_month = count_result[0]['count'] if count_result else 0
        
        return UserSubscriptionResponse(
            user_id=str(user['id']),
            subscription_tier=tier,
            subscription_status=user.get('subscription_status', 'active'),
            subscription_start_date=user.get('subscription_start_date'),
            subscription_end_date=user.get('subscription_end_date'),
            requests_this_month=requests_this_month,
            monthly_limit=plan.requests_per_month,
            requests_per_second_limit=plan.requests_per_second
        )
    except Exception as e:
        logger.error(f"Error getting user subscription: {e}")
        return None

def update_user_subscription(user_id: str, tier: str, status: str = "active") -> bool:
    """Update user subscription tier and status"""
    try:
        query = """
        UPDATE users
        SET subscription_tier = %s,
            subscription_status = %s,
            subscription_start_date = COALESCE(subscription_start_date, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id
        """
        result = neon_db.execute_write_query(query, (tier, status, user_id))
        return len(result) > 0
    except Exception as e:
        logger.error(f"Error updating user subscription: {e}")
        return False
