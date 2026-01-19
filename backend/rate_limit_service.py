"""
Rate limiting service for user submissions
Checks per-second and per-month limits based on subscription tier
"""
from typing import Optional, Tuple
from datetime import datetime, timedelta
from neon_database import neon_db
from subscription_service import get_user_subscription, get_subscription_plan
import logging

logger = logging.getLogger(__name__)

def check_rate_limit(user_id: str) -> Tuple[bool, Optional[str]]:
    """
    Check if user can make a request based on rate limits
    Returns (allowed: bool, error_message: Optional[str])
    """
    try:
        subscription = get_user_subscription(user_id)
        if not subscription:
            # Default to free tier if subscription not found
            subscription = get_user_subscription(user_id) or type('obj', (object,), {
                'subscription_tier': 'free',
                'requests_per_second_limit': 1,
                'requests_per_month': 10,
                'requests_this_month': 0
            })
        
        # Get subscription plan for limits
        plan = get_subscription_plan(subscription.subscription_tier if hasattr(subscription, 'subscription_tier') else 'free')
        if not plan:
            plan = get_subscription_plan('free')
        
        # Check monthly limit
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        
        monthly_count_query = """
        SELECT COUNT(*) as count
        FROM rate_limit_tracking
        WHERE user_id = %s AND request_timestamp >= %s
        """
        monthly_result = neon_db.execute_query(monthly_count_query, (user_id, month_start))
        requests_this_month = monthly_result[0]['count'] if monthly_result else 0
        
        if requests_this_month >= plan.requests_per_month:
            return False, f"Monthly limit reached ({plan.requests_per_month} requests). Please upgrade your subscription."
        
        # Check per-second limit (requests in the last second)
        one_second_ago = now - timedelta(seconds=1)
        per_second_count_query = """
        SELECT COUNT(*) as count
        FROM rate_limit_tracking
        WHERE user_id = %s AND request_timestamp >= %s
        """
        per_second_result = neon_db.execute_query(per_second_count_query, (user_id, one_second_ago))
        requests_last_second = per_second_result[0]['count'] if per_second_result else 0
        
        if requests_last_second >= plan.requests_per_second:
            return False, f"Rate limit exceeded ({plan.requests_per_second} requests per second). Please slow down."
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        return False, "Error checking rate limits"

def record_request(user_id: str, submission_id: Optional[int] = None, request_type: str = "submission") -> bool:
    """Record a request for rate limiting purposes"""
    try:
        query = """
        INSERT INTO rate_limit_tracking (user_id, submission_id, request_type, request_timestamp)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        """
        neon_db.execute_write_query(query, (user_id, submission_id, request_type))
        return True
    except Exception as e:
        logger.error(f"Error recording request: {e}")
        return False
