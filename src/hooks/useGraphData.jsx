import { useState, useEffect, useCallback, useRef } from 'react';
import {
  formatGraphData,
  extractEntityHighlights,
  findNodeById
} from '../utils/dataUtils';
import { useStories } from '../contexts/StoriesContext';

const useGraphData = (apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') => {
  const storiesContext = useStories();
  const [localStories, setLocalStories] = useState([]);
  const [currentStoryId, setCurrentStoryId] = useState(null);
  const [currentChapterId, setCurrentChapterId] = useState(null);
  const [currentSubstoryId, setCurrentSubstoryId] = useState(null);
  const currentSubstoryIdRef = useRef(currentSubstoryId);
  useEffect(() => {
    currentSubstoryIdRef.current = currentSubstoryId;
  }, [currentSubstoryId]);
  const [currentStory, setCurrentStory] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [currentSubstory, setCurrentSubstory] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [graphDescription, setGraphDescription] = useState(null);
  const [entityHighlights, setEntityHighlights] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [localStoriesLoading, setLocalStoriesLoading] = useState(false);
  const [localStoriesError, setLocalStoriesError] = useState(null);

  const stories = storiesContext ? storiesContext.stories : localStories;

  useEffect(() => {
    if (storiesContext) return;
    let isMounted = true;
    let hasLoggedError = false;

    const loadStories = async () => {
      try {
        if (isMounted) setLocalStoriesLoading(true);

        const url = `${apiBaseUrl}/api/stories`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          if (!hasLoggedError) {
            console.error('API Error Response:', {
              status: response.status,
              statusText: response.statusText,
              body: errorText,
              url: url
            });
            hasLoggedError = true;
          }
          throw new Error(`Failed to load story list: ${response.status} ${response.statusText}. ${errorText}`);
        }
        
        const data = await response.json();

        if (isMounted) {
          setLocalStories(Array.isArray(data) ? data : []);
          setLocalStoriesLoading(false);
          setLocalStoriesError(null);
          hasLoggedError = false;
        }
      } catch (err) {
        // Only log connection errors once to avoid console spam
        const isConnectionError = err.message.includes('fetch') || 
                                 err.message.includes('Failed to fetch') ||
                                 err.name === 'TypeError';
        
        if (!hasLoggedError) {
          if (isConnectionError) {
            // Log connection errors with helpful message
            console.warn(
              `⚠️ Backend server not available at ${apiBaseUrl}\n` +
              `Please ensure the backend is running. ` +
              `See backend/README.md for setup instructions.`
            );
          } else {
            // Log other errors normally
            console.error('Error loading stories:', err.message);
          }
          hasLoggedError = true;
        }

        if (isMounted) {
          setLocalStoriesError(isConnectionError ? `Backend server unavailable. Please ensure the backend is running at ${apiBaseUrl}` : err.message);
          setLocalStoriesLoading(false);
          setLocalStories([]);
        }
      }
    };

    loadStories();
    return () => { isMounted = false; };
  }, [apiBaseUrl, storiesContext]);

  useEffect(() => {
    if (!currentStoryId) {
      setCurrentStory(null);
      setCurrentChapter(null);
      setCurrentSubstory(null);
      setCurrentChapterId(null);
      setCurrentSubstoryId(null);
      return;
    }

    const story = stories.find(s => s.id === currentStoryId);
    if (story) {
      setCurrentStory(story);
    } else {
      setCurrentStory(null);
    }
  }, [currentStoryId, stories]);

  useEffect(() => {
    if (!currentStoryId || !currentChapterId) {
      setCurrentChapter(null);
      setCurrentSubstory(null);
      setCurrentSubstoryId(null);
      return;
    }

    const story = stories.find(s => s.id === currentStoryId);
    if (story && story.chapters) {
      const chapter = story.chapters.find(c => c.id === currentChapterId);
      if (chapter) {
        setCurrentChapter(chapter);
        // DON'T auto-select first substory - let user explicitly select it
        // This prevents overriding user selections
      } else {
        setCurrentChapter(null);
      }
    }
  }, [currentStoryId, currentChapterId, stories]);

  useEffect(() => {
    let isMounted = true;
    let hasLoggedError = false;
    const abortController = new AbortController();

    const loadSubstoryData = async () => {
        if (!currentStoryId || !currentChapterId || !currentSubstoryId) {
          if (isMounted) {
            setCurrentSubstory(null);
            setGraphData({ nodes: [], links: [] });
            setGraphDescription(null);
            setEntityHighlights([]);
            setGraphError(null);
          }
          return;
        }

      // Capture which section this request is for so we can ignore stale responses
      const requestedSubstoryId = currentSubstoryId;

      try {
        if (isMounted) {
          setGraphLoading(true);
          setGraphError(null);

          setGraphData({ nodes: [], links: [] });
        }

        const story = stories.find(s => s.id === currentStoryId);
        if (!story) {
          if (!hasLoggedError) {
            console.warn(`Story with ID ${currentStoryId} not found. Available stories:`, stories.map(s => s.id));
            hasLoggedError = true;
          }
          throw new Error(`Story with ID ${currentStoryId} not found`);
        }

        const chapter = story.chapters.find(c => c.id === currentChapterId);
        if (!chapter) {
          if (story.chapters && story.chapters.length > 0) {
            const firstChapter = story.chapters[0];
            if (isMounted) {
              setCurrentChapterId(firstChapter.id);
            }
            return;
          }

          if (!hasLoggedError) {
            console.warn(`Chapter with ID ${currentChapterId} not found in story ${currentStoryId}`);
            hasLoggedError = true;
          }
          throw new Error(`Chapter with ID ${currentChapterId} not found`);
        }

        const substory = chapter.substories.find(s => s.id === currentSubstoryId);
        if (!substory) {
          if (chapter.substories && chapter.substories.length > 0) {
            const firstSubstory = chapter.substories[0];
            if (isMounted) {
              setCurrentSubstoryId(firstSubstory.id);
            }
            return;
          }

          if (!hasLoggedError) {
            console.warn(`Substory with ID ${currentSubstoryId} not found in chapter ${currentChapterId}`);
            hasLoggedError = true;
          }
          throw new Error(`Substory with ID ${currentSubstoryId} not found`);
        }

        if (isMounted) {
          setCurrentSubstory(substory);
        }

        const sectionNameMapping = {
          'Jonna Mazet': 'Jona Mazet'
        };

        // Prefer section id (section_gid) so backend returns nodes for this section only.
        // Fall back to section_query/graphPath when id is not available.
        let graphIdentifier = (substory.id != null && substory.id !== '')
          ? String(substory.id)
          : (currentSubstoryId != null ? String(currentSubstoryId) : null);
        if (!graphIdentifier) {
          graphIdentifier = substory.section_query || substory.graphPath || null;
        }

        if (graphIdentifier && sectionNameMapping[graphIdentifier]) {
          graphIdentifier = sectionNameMapping[graphIdentifier];
        }

        if (!graphIdentifier) {
          throw new Error('No graph identifier available for substory');
        }

        const graphUrl = `${apiBaseUrl}/api/graph/${encodeURIComponent(graphIdentifier)}`;
        
        const apiResponse = await fetch(graphUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
        });
        
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          const isConnectionError = apiResponse.status === 0 || errorText.includes('Failed to fetch');
          
          if (!hasLoggedError) {
            if (isConnectionError) {
              console.warn(`⚠️ Backend server not available at ${apiBaseUrl}`);
            } else {
              console.error('Graph API Error Response:', {
                status: apiResponse.status,
                statusText: apiResponse.statusText,
                body: errorText,
                url: graphUrl
              });
            }
            hasLoggedError = true;
          }
          throw new Error(`Failed to load graph data: ${apiResponse.status} ${apiResponse.statusText}. ${errorText}`);
        }
        
        const rawGraphData = await apiResponse.json();

        // Ignore response if user has already switched to another section (avoid showing wrong graph)
        if (!isMounted || currentSubstoryIdRef.current !== requestedSubstoryId) {
          return;
        }

        // Extract description from response
        const description = rawGraphData.description || null;

        let formattedGraphData;

        if (rawGraphData && rawGraphData.nodes && rawGraphData.nodes.length > 100) {
          const limitedNodes = rawGraphData.nodes.slice(0, 2000);

          const normId = (v) => (v != null && v !== '' ? String(v) : '');
          const nodeIds = new Set(
            limitedNodes
              .map((node) => normId(node.id ?? node.gid ?? node.elementId ?? node.element_id))
              .filter(Boolean)
          );

          const limitedLinks = (rawGraphData.links || []).filter((link) => {
            const sourceId = normId(link.sourceId ?? link.source ?? link.from_gid ?? '');
            const targetId = normId(link.targetId ?? link.target ?? link.to_gid ?? '');
            return sourceId && targetId && nodeIds.has(sourceId) && nodeIds.has(targetId);
          }).slice(0, 5000);

          formattedGraphData = formatGraphData({
            nodes: limitedNodes,
            links: limitedLinks
          });
        } else {
          formattedGraphData = formatGraphData(rawGraphData);
        }

        const allHighlights = extractEntityHighlights(formattedGraphData);
        const highlights = allHighlights.slice(0, 20);

        if (isMounted && currentSubstoryIdRef.current === requestedSubstoryId) {
          setGraphData(formattedGraphData);
          setGraphDescription(description);
          setEntityHighlights(highlights);
          setGraphLoading(false);
          hasLoggedError = false; // Reset error flag on success
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        const isConnectionError = err.message.includes('fetch') || 
                                 err.message.includes('Failed to fetch') ||
                                 err.name === 'TypeError';

        if (!hasLoggedError) {
          if (!isConnectionError) {
            console.error('Error loading substory data:', err.message);
          }
          hasLoggedError = true;
        }

        if (isMounted && currentSubstoryIdRef.current === requestedSubstoryId) {
          const errorMessage = isConnectionError
            ? `Backend server unavailable. Please ensure the backend is running at ${apiBaseUrl}`
            : `Failed to load substory data: ${err.message}`;
          setGraphError(errorMessage);
          setGraphLoading(false);

          setGraphData({ nodes: [], links: [] });
          setGraphDescription(null);
          setEntityHighlights([]);
        }
      }
    };

    // Run immediately so fetch starts before any effect re-run can clear it (avoids "no API call" when state corrects)
    loadSubstoryData();

    return () => {
      abortController.abort();
      isMounted = false;
    };
  }, [currentStoryId, currentChapterId, currentSubstoryId, stories, apiBaseUrl]);

  const selectStory = useCallback((storyId) => {

    setGraphError(null);

    setSelectedNode(null);
    setSelectedEdge(null);

    if (storyId) {
      const story = stories.find(s => s.id === storyId);
      if (!story) {
        console.warn(`Story with ID ${storyId} not found`);
      }
    }

    setCurrentStoryId(storyId);
  }, [stories]);

  const selectChapter = useCallback((chapterId) => {

    setGraphError(null);

    setSelectedNode(null);
    setSelectedEdge(null);

    if (currentStoryId && chapterId) {
      const story = stories.find(s => s.id === currentStoryId);
      if (story && story.chapters) {
        const chapter = story.chapters.find(c => c.id === chapterId);
        if (chapter) {
          setCurrentChapterId(chapterId);

          return;
        }
      }
    }

    setCurrentChapterId(chapterId);
  }, [currentStoryId, stories]);

  const selectSubstory = useCallback((substoryId) => {

    setGraphError(null);

    setSelectedNode(null);
    setSelectedEdge(null);

    if (currentStoryId && currentChapterId && substoryId) {
      const story = stories.find(s => s.id === currentStoryId);
      if (story && story.chapters) {
        const chapter = story.chapters.find(c => c.id === currentChapterId);
        if (chapter && chapter.substories) {
          const substory = chapter.substories.find(s => s.id === substoryId);
          if (!substory) {
            console.warn(`Substory with ID ${substoryId} not found in chapter ${currentChapterId}`);
          }
        }
      }
    }

    setCurrentSubstoryId(substoryId);
  }, [currentStoryId, currentChapterId, stories]);

  const goToPreviousSubstory = useCallback(() => {

    setGraphError(null);

    if (!currentStoryId || !currentChapterId || !currentSubstoryId) return;

    try {
      const story = stories.find(s => s.id === currentStoryId);
      if (!story) {
        console.warn(`Story with ID ${currentStoryId} not found`);
        return;
      }

      const chapterIndex = story.chapters.findIndex(c => c.id === currentChapterId);
      if (chapterIndex === -1) {
        console.warn(`Chapter with ID ${currentChapterId} not found in story ${currentStoryId}`);

        if (story.chapters && story.chapters.length > 0) {
          const firstChapter = story.chapters[0];
          selectChapter(firstChapter.id);
          if (firstChapter.substories && firstChapter.substories.length > 0) {
            selectSubstory(firstChapter.substories[0].id);
          }
        }
        return;
      }

      const chapter = story.chapters[chapterIndex];
      if (!chapter.substories || chapter.substories.length === 0) {
        console.warn(`Chapter with ID ${currentChapterId} has no substories`);
        return;
      }

      const currentIndex = chapter.substories.findIndex(s => s.id === currentSubstoryId);
      if (currentIndex === -1) {
        console.warn(`Substory with ID ${currentSubstoryId} not found in chapter ${currentChapterId}`);

        selectSubstory(chapter.substories[0].id);
        return;
      }

      if (currentIndex > 0) {
        selectSubstory(chapter.substories[currentIndex - 1].id);
      } else {
        if (chapterIndex > 0) {
          const prevChapter = story.chapters[chapterIndex - 1];
          if (prevChapter.substories && prevChapter.substories.length > 0) {
            selectChapter(prevChapter.id);
            selectSubstory(prevChapter.substories[prevChapter.substories.length - 1].id);
          }
        } else {
          const currentStoryIndex = stories.findIndex(s => s.id === currentStoryId);
          if (currentStoryIndex > 0) {
            const prevStory = stories[currentStoryIndex - 1];
            if (prevStory.chapters && prevStory.chapters.length > 0) {
              const lastChapter = prevStory.chapters[prevStory.chapters.length - 1];
              if (lastChapter.substories && lastChapter.substories.length > 0) {
                selectStory(prevStory.id);

                setTimeout(() => {
                  selectChapter(lastChapter.id);

                  setTimeout(() => {
                    selectSubstory(lastChapter.substories[lastChapter.substories.length - 1].id);
                  }, 50);
                }, 50);
              }
            }
          } else {
            if (stories.length > 0) {
              const lastStory = stories[stories.length - 1];
              if (lastStory.chapters && lastStory.chapters.length > 0) {
                const lastChapter = lastStory.chapters[lastStory.chapters.length - 1];
                if (lastChapter.substories && lastChapter.substories.length > 0) {
                  selectStory(lastStory.id);

                  setTimeout(() => {
                    selectChapter(lastChapter.id);

                    setTimeout(() => {
                      selectSubstory(lastChapter.substories[lastChapter.substories.length - 1].id);
                    }, 50);
                  }, 50);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error navigating to previous substory:', err);
    }
  }, [stories, currentStoryId, currentChapterId, currentSubstoryId, selectStory, selectChapter, selectSubstory]);

  const goToNextSubstory = useCallback(() => {

    setGraphError(null);

    if (!currentStoryId || !currentChapterId || !currentSubstoryId) return;

    try {
      const story = stories.find(s => s.id === currentStoryId);
      if (!story) {
        console.warn(`Story with ID ${currentStoryId} not found`);
        return;
      }

      const chapterIndex = story.chapters.findIndex(c => c.id === currentChapterId);
      if (chapterIndex === -1) {
        console.warn(`Chapter with ID ${currentChapterId} not found in story ${currentStoryId}`);

        if (story.chapters && story.chapters.length > 0) {
          const firstChapter = story.chapters[0];
          selectChapter(firstChapter.id);
          if (firstChapter.substories && firstChapter.substories.length > 0) {
            selectSubstory(firstChapter.substories[0].id);
          }
        }
        return;
      }

      const chapter = story.chapters[chapterIndex];
      if (!chapter.substories || chapter.substories.length === 0) {
        console.warn(`Chapter with ID ${currentChapterId} has no substories`);
        return;
      }

      const currentIndex = chapter.substories.findIndex(s => s.id === currentSubstoryId);
      if (currentIndex === -1) {
        console.warn(`Substory with ID ${currentSubstoryId} not found in chapter ${currentChapterId}`);

        selectSubstory(chapter.substories[0].id);
        return;
      }

      if (currentIndex < chapter.substories.length - 1) {
        selectSubstory(chapter.substories[currentIndex + 1].id);
      } else {
        if (chapterIndex < story.chapters.length - 1) {
          const nextChapter = story.chapters[chapterIndex + 1];
          if (nextChapter.substories && nextChapter.substories.length > 0) {
            selectChapter(nextChapter.id);
            selectSubstory(nextChapter.substories[0].id);
          }
        } else {
          const currentStoryIndex = stories.findIndex(s => s.id === currentStoryId);
          if (currentStoryIndex < stories.length - 1) {
            const nextStory = stories[currentStoryIndex + 1];
            if (nextStory.chapters && nextStory.chapters.length > 0) {
              const firstChapter = nextStory.chapters[0];
              if (firstChapter.substories && firstChapter.substories.length > 0) {
                selectStory(nextStory.id);

                setTimeout(() => {
                  selectChapter(firstChapter.id);

                  setTimeout(() => {
                    selectSubstory(firstChapter.substories[0].id);
                  }, 50);
                }, 50);
              }
            }
          } else {
            if (stories.length > 0) {
              const firstStory = stories[0];
              if (firstStory.chapters && firstStory.chapters.length > 0) {
                const firstChapter = firstStory.chapters[0];
                if (firstChapter.substories && firstChapter.substories.length > 0) {
                  selectStory(firstStory.id);

                  setTimeout(() => {
                    selectChapter(firstChapter.id);

                    setTimeout(() => {
                      selectSubstory(firstChapter.substories[0].id);
                    }, 50);
                  }, 50);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error navigating to next substory:', err);
    }
  }, [stories, currentStoryId, currentChapterId, currentSubstoryId, selectStory, selectChapter, selectSubstory]);

  const selectNode = useCallback((node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const selectEdge = useCallback((edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const selectEntityById = useCallback((entityId) => {
    const node = findNodeById(graphData, entityId);
    if (node) {
      selectNode(node);
    }
  }, [graphData, selectNode]);

  const performAISearch = useCallback(async (searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) {
      throw new Error("Please enter a search query");
    }

    try {
      const searchUrl = `${apiBaseUrl}/api/ai/search?query=${encodeURIComponent(searchQuery.trim())}`;
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const isConnectionError = response.status === 0 || errorData.detail?.includes('Failed to fetch');
        
        if (isConnectionError) {
          throw new Error(`Backend server unavailable. Please ensure the backend is running at ${apiBaseUrl}`);
        }
        
        console.error('AI Search Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.detail || `Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const graphData = data.graphData || data;
      const generatedQuery = data.generatedQuery || null;

      const formattedData = formatGraphData(graphData);

      return {
        graphData: formattedData,
        searchQuery: searchQuery.trim(),
        generatedQuery: generatedQuery
      };
    } catch (err) {
      // Only log non-connection errors to avoid console spam
      const isConnectionError = err.message.includes('Backend server unavailable') || 
                               err.message.includes('fetch') ||
                               err.name === 'TypeError';
      
      if (!isConnectionError) {
        console.error('Error performing AI search:', err.message);
      }
      throw err;
    }
  }, [apiBaseUrl]);

  const executeCypherQuery = useCallback(async (cypherQuery) => {
    if (!cypherQuery || !cypherQuery.trim()) {
      throw new Error("Please enter a Cypher query");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/cypher/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: cypherQuery.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const isConnectionError = response.status === 0 || errorData.detail?.includes('Failed to fetch');
        
        if (isConnectionError) {
          throw new Error(`Backend server unavailable. Please ensure the backend is running at ${apiBaseUrl}`);
        }
        
        console.error('Cypher Query Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.detail || `Query execution failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const graphData = data.graphData || data;
      const formattedData = formatGraphData(graphData);

      return {
        graphData: formattedData,
        executedQuery: data.executedQuery || cypherQuery.trim()
      };
    } catch (err) {
      const isConnectionError = err.message.includes('Backend server unavailable') || 
                               err.message.includes('fetch') ||
                               err.name === 'TypeError';
      
      if (!isConnectionError) {
        console.error('Error executing Cypher query:', err.message);
      }
      throw err;
    }
  }, [apiBaseUrl]);

  const loading = (storiesContext ? storiesContext.storiesLoading : localStoriesLoading) || graphLoading;
  const error = graphError || (storiesContext ? storiesContext.storiesError : localStoriesError);

  return {
    stories,
    currentStory,
    currentChapter,
    currentSubstory,
    currentStoryId,
    currentChapterId,
    currentSubstoryId,
    graphData,
    graphDescription,
    entityHighlights,
    selectedNode,
    selectedEdge,
    loading,
    error,
    selectStory,
    selectChapter,
    selectSubstory,
    goToPreviousSubstory,
    goToNextSubstory,
    selectNode,
    selectEdge,
    selectEntityById,
    performAISearch,
    executeCypherQuery
  };
};

export default useGraphData;
