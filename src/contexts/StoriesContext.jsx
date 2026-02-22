import { createContext, useContext, useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const StoriesContext = createContext(null);

/**
 * Fetches /api/stories on mount so the first app render triggers the request
 * regardless of auth or route. HomePage (and useGraphData) consume this so
 * stories are available as soon as the user reaches the home view.
 */
export const StoriesProvider = ({ children }) => {
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadStories = async () => {
      try {
        setStoriesLoading(true);
        setStoriesError(null);

        const url = `${API_BASE_URL}/api/stories`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load story list: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const data = await response.json();

        if (isMounted) {
          setStories(Array.isArray(data) ? data : []);
          setStoriesLoading(false);
        }
      } catch (err) {
        const isConnectionError =
          err.message?.includes('fetch') ||
          err.message?.includes('Failed to fetch') ||
          err.name === 'TypeError';

        if (isMounted) {
          setStoriesError(
            isConnectionError
              ? 'Backend server unavailable. Please ensure the backend is running at ' + API_BASE_URL
              : err.message
          );
          setStoriesLoading(false);
          setStories([]);
        }
      }
    };

    loadStories();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = {
    stories,
    setStories,
    storiesLoading,
    storiesError,
  };

  return (
    <StoriesContext.Provider value={value}>
      {children}
    </StoriesContext.Provider>
  );
};

export const useStories = () => {
  const context = useContext(StoriesContext);
  return context;
};

export default StoriesContext;
