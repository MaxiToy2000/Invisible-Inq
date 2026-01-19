import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Generate or retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};

export const useActivityTracking = () => {
  const location = useLocation();
  const { user } = useAuth();
  const pageStartTime = useRef(Date.now());
  const currentSection = useRef(null);

  // Track activity
  const trackActivity = useCallback(async (activityData) => {
    try {
      const sessionId = getSessionId();
      const userId = user?.id || null;

      const payload = {
        user_id: userId,
        session_id: sessionId,
        ...activityData
      };

      await fetch(`${API_BASE_URL}/api/activity/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  }, [user]);

  // Track page view
  const trackPageView = useCallback((pageUrl, metadata = {}) => {
    trackActivity({
      activity_type: 'page_view',
      page_url: pageUrl,
      metadata
    });
  }, [trackActivity]);

  // Track section view
  const trackSectionView = useCallback((sectionId, sectionTitle, metadata = {}) => {
    currentSection.current = { sectionId, sectionTitle };
    pageStartTime.current = Date.now();
    
    trackActivity({
      activity_type: 'section_view',
      section_id: sectionId,
      section_title: sectionTitle,
      page_url: location.pathname,
      metadata
    });
  }, [trackActivity, location.pathname]);

  // Track section duration when leaving
  const trackSectionDuration = useCallback(() => {
    if (currentSection.current) {
      const duration = Math.floor((Date.now() - pageStartTime.current) / 1000);
      
      trackActivity({
        activity_type: 'section_view',
        section_id: currentSection.current.sectionId,
        section_title: currentSection.current.sectionTitle,
        page_url: location.pathname,
        duration_seconds: duration
      });
      
      currentSection.current = null;
    }
  }, [trackActivity, location.pathname]);

  // Track search
  const trackSearch = useCallback((searchQuery, metadata = {}) => {
    trackActivity({
      activity_type: 'search',
      page_url: location.pathname,
      metadata: { query: searchQuery, ...metadata }
    });
  }, [trackActivity, location.pathname]);

  // Track graph interaction
  const trackGraphInteraction = useCallback((interactionType, metadata = {}) => {
    trackActivity({
      activity_type: 'graph_interaction',
      page_url: location.pathname,
      metadata: { interaction_type: interactionType, ...metadata }
    });
  }, [trackActivity, location.pathname]);

  // Track page view on location change
  useEffect(() => {
    // Track section duration if leaving a section
    trackSectionDuration();
    
    // Track new page view
    trackPageView(location.pathname);
    
    // Reset page start time
    pageStartTime.current = Date.now();
  }, [location.pathname, trackPageView, trackSectionDuration]);

  // Track page duration on unmount
  useEffect(() => {
    return () => {
      trackSectionDuration();
    };
  }, [trackSectionDuration]);

  return {
    trackPageView,
    trackSectionView,
    trackSectionDuration,
    trackSearch,
    trackGraphInteraction
  };
};

export default useActivityTracking;
