import { useState, useEffect, useCallback, useRef } from 'react';
import {
  formatGraphData,
  extractEntityHighlights,
  findNodeById
} from '../utils/dataUtils';
import { useStories } from '../contexts/StoriesContext';

const useGraphData = (apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000', options = {}) => {
  const { allowAutoSelectFirstStory = true } = options;
  const storiesContext = useStories();
  const [localStories, setLocalStories] = useState([]);
  const [currentStoryId, setCurrentStoryId] = useState(null);
  const [currentChapterId, setCurrentChapterId] = useState(null);
  const [currentSectionId, setCurrentSectionId] = useState(null);
  const currentSectionIdRef = useRef(currentSectionId);
  useEffect(() => {
    currentSectionIdRef.current = currentSectionId;
  }, [currentSectionId]);
  const formattedGraphCacheRef = useRef(new Map()); // sectionId -> { data, description, highlights }, max 30
  const FORMATTED_GRAPH_CACHE_MAX = 30;
  const [currentStory, setCurrentStory] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
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
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

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
        const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (import.meta.env?.DEV) {
          console.debug(`[perf] stories fetch: ${((t1 - t0) / 1000).toFixed(2)}s count=${Array.isArray(data) ? data.length : 0}`);
        }

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
      setCurrentSection(null);
      setCurrentChapterId(null);
      setCurrentSectionId(null);
      return;
    }

    const story = stories.find(s => s.id === currentStoryId);
    if (story) {
      setCurrentStory(story);
    } else {
      setCurrentStory(null);
    }
  }, [currentStoryId, stories]);

  // On initial load: auto-select first story only when allowed (e.g. not when at root / for dashboard-first)
  useEffect(() => {
    if (!allowAutoSelectFirstStory || !stories || stories.length === 0 || currentStoryId != null) return;
    setCurrentStoryId(stories[0].id);
  }, [allowAutoSelectFirstStory, stories, currentStoryId]);

  // When a story is selected but no chapter: auto-select first chapter so the graph can load
  useEffect(() => {
    if (!currentStory || !currentStory.chapters || currentStory.chapters.length === 0 || currentChapterId != null) return;
    setCurrentChapterId(currentStory.chapters[0].id);
  }, [currentStory, currentChapterId]);

  // When a chapter is selected but no section: auto-select first section so the graph can load
  useEffect(() => {
    if (!currentChapter || !currentChapter.sections || currentChapter.sections.length === 0 || currentSectionId != null) return;
    setCurrentSectionId(currentChapter.sections[0].id);
  }, [currentChapter, currentSectionId]);

  useEffect(() => {
    if (!currentStoryId || !currentChapterId) {
      setCurrentChapter(null);
      setCurrentSection(null);
      setCurrentSectionId(null);
      return;
    }

    const story = stories.find(s => s.id === currentStoryId);
    if (story && story.chapters) {
      const chapter = story.chapters.find(c => c.id === currentChapterId);
      if (chapter) {
        setCurrentChapter(chapter);
      } else {
        setCurrentChapter(null);
      }
    }
  }, [currentStoryId, currentChapterId, stories]);

  useEffect(() => {
    let isMounted = true;
    let hasLoggedError = false;
    const abortController = new AbortController();

    const loadSectionData = async () => {
        if (!currentStoryId || !currentChapterId || !currentSectionId) {
          if (isMounted) {
            setCurrentSection(null);
            setGraphData({ nodes: [], links: [] });
            setGraphDescription(null);
            setEntityHighlights([]);
            setGraphError(null);
          }
          return;
        }

      // Capture which section this request is for so we can ignore stale responses
      const requestedSectionId = currentSectionId;

      try {
        if (isMounted) {
          setGraphLoading(true);
          setGraphError(null);
          // Keep previous graph visible while loading (don't clear) for smoother perceived speed
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

        const section = chapter.sections.find(s => s.id === currentSectionId);
        if (!section) {
          if (chapter.sections && chapter.sections.length > 0) {
            const firstSection = chapter.sections[0];
            if (isMounted) {
              setCurrentSectionId(firstSection.id);
            }
            return;
          }

          if (!hasLoggedError) {
            console.warn(`Section with ID ${currentSectionId} not found in chapter ${currentChapterId}`);
            hasLoggedError = true;
          }
          throw new Error(`Section with ID ${currentSectionId} not found`);
        }

        if (isMounted) {
          setCurrentSection(section);
        }

        const sectionNameMapping = {
          'Jonna Mazet': 'Jona Mazet'
        };

        // Prefer section id (section_gid) so backend returns nodes for this section only.
        // Fall back to section_query/graphPath when id is not available.
        let graphIdentifier = (section.id != null && section.id !== '')
          ? String(section.id)
          : (currentSectionId != null ? String(currentSectionId) : null);
        if (!graphIdentifier) {
          graphIdentifier = section.section_query || section.graphPath || null;
        }

        if (graphIdentifier && sectionNameMapping[graphIdentifier]) {
          graphIdentifier = sectionNameMapping[graphIdentifier];
        }

        if (!graphIdentifier) {
          throw new Error('No graph identifier available for section');
        }

        const graphUrl = `${apiBaseUrl}/api/graph/${encodeURIComponent(graphIdentifier)}`;
        const tFetchStart = typeof performance !== 'undefined' ? performance.now() : Date.now();

        const apiResponse = await fetch(graphUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
        });

        const tFetchEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (import.meta.env?.DEV) {
          console.debug(`[perf] graph fetch: ${((tFetchEnd - tFetchStart) / 1000).toFixed(2)}s`);
        }

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
        
        const tParseStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const rawGraphData = await apiResponse.json();
        const tParseEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();

        // Ignore response if user has already switched to another section (avoid showing wrong graph)
        if (!isMounted || currentSectionIdRef.current !== requestedSectionId) {
          return;
        }

        // Extract description from response
        const description = rawGraphData.description ?? null;
        const rawNodesLen = rawGraphData?.nodes?.length ?? 0;
        const rawLinksLen = rawGraphData?.links?.length ?? 0;

        const cache = formattedGraphCacheRef.current;
        const cached = cache.get(requestedSectionId);
        const useCached = cached && cached.nodesLen === rawNodesLen && cached.linksLen === rawLinksLen;
        let formattedGraphData;
        let highlights;
        if (useCached) {
          formattedGraphData = cached.data;
          highlights = cached.highlights;
          if (import.meta.env?.DEV) console.debug('[perf] graph: using cached formatted result for', requestedSectionId);
        } else if (rawGraphData && rawGraphData.nodes && rawGraphData.nodes.length > 100) {
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

          const tFormatStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
          formattedGraphData = formatGraphData({
            nodes: limitedNodes,
            links: limitedLinks
          });
          const tFormatEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (import.meta.env?.DEV) {
            console.debug(
              `[perf] graph: parse=${((tParseEnd - tParseStart) / 1000).toFixed(2)}s format=${((tFormatEnd - tFormatStart) / 1000).toFixed(2)}s nodes=${formattedGraphData?.nodes?.length ?? 0} links=${formattedGraphData?.links?.length ?? 0} (limited)`
            );
          }
        } else {
          const tFormatStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
          formattedGraphData = formatGraphData(rawGraphData);
          const tFormatEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (import.meta.env?.DEV) {
            console.debug(
              `[perf] graph: parse=${((tParseEnd - tParseStart) / 1000).toFixed(2)}s format=${((tFormatEnd - tFormatStart) / 1000).toFixed(2)}s nodes=${formattedGraphData?.nodes?.length ?? 0} links=${formattedGraphData?.links?.length ?? 0}`
            );
          }
        }

        if (!useCached) {
          const allHighlights = extractEntityHighlights(formattedGraphData);
          highlights = allHighlights.slice(0, 20);
        }

        if (!useCached) {
          if (cache.size >= FORMATTED_GRAPH_CACHE_MAX) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined) cache.delete(firstKey);
          }
          cache.set(requestedSectionId, { nodesLen: rawNodesLen, linksLen: rawLinksLen, data: formattedGraphData, description, highlights });
        }

        if (isMounted && currentSectionIdRef.current === requestedSectionId) {
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
            console.error('Error loading section data:', err.message);
          }
          hasLoggedError = true;
        }

        if (isMounted && currentSectionIdRef.current === requestedSectionId) {
          const errorMessage = isConnectionError
            ? `Backend server unavailable. Please ensure the backend is running at ${apiBaseUrl}`
            : `Failed to load section data: ${err.message}`;
          setGraphError(errorMessage);
          setGraphLoading(false);

          setGraphData({ nodes: [], links: [] });
          setGraphDescription(null);
          setEntityHighlights([]);
        }
      }
    };

    // Run immediately so fetch starts before any effect re-run can clear it (avoids "no API call" when state corrects)
    loadSectionData();

    return () => {
      abortController.abort();
      isMounted = false;
    };
  }, [currentStoryId, currentChapterId, currentSectionId, stories, apiBaseUrl]);

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

  const selectSection = useCallback((sectionId) => {

    setGraphError(null);

    setSelectedNode(null);
    setSelectedEdge(null);

    if (currentStoryId && currentChapterId && sectionId) {
      const story = stories.find(s => s.id === currentStoryId);
      if (story && story.chapters) {
        const chapter = story.chapters.find(c => c.id === currentChapterId);
        if (chapter && chapter.sections) {
          const section = chapter.sections.find(s => s.id === sectionId);
          if (!section) {
            console.warn(`Section with ID ${sectionId} not found in chapter ${currentChapterId}`);
          }
        }
      }
    }

    setCurrentSectionId(sectionId);
  }, [currentStoryId, currentChapterId, stories]);

  const goToPreviousSection = useCallback(() => {

    setGraphError(null);

    if (!currentStoryId || !currentChapterId || !currentSectionId) return;

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
          if (firstChapter.sections && firstChapter.sections.length > 0) {
            selectSection(firstChapter.sections[0].id);
          }
        }
        return;
      }

      const chapter = story.chapters[chapterIndex];
      if (!chapter.sections || chapter.sections.length === 0) {
        console.warn(`Chapter with ID ${currentChapterId} has no sections`);
        return;
      }

      const currentIndex = chapter.sections.findIndex(s => s.id === currentSectionId);
      if (currentIndex === -1) {
        console.warn(`Section with ID ${currentSectionId} not found in chapter ${currentChapterId}`);

        selectSection(chapter.sections[0].id);
        return;
      }

      if (currentIndex > 0) {
        selectSection(chapter.sections[currentIndex - 1].id);
      } else {
        if (chapterIndex > 0) {
          const prevChapter = story.chapters[chapterIndex - 1];
          if (prevChapter.sections && prevChapter.sections.length > 0) {
            selectChapter(prevChapter.id);
            selectSection(prevChapter.sections[prevChapter.sections.length - 1].id);
          }
        } else {
          const currentStoryIndex = stories.findIndex(s => s.id === currentStoryId);
          if (currentStoryIndex > 0) {
            const prevStory = stories[currentStoryIndex - 1];
            if (prevStory.chapters && prevStory.chapters.length > 0) {
              const lastChapter = prevStory.chapters[prevStory.chapters.length - 1];
              if (lastChapter.sections && lastChapter.sections.length > 0) {
                selectStory(prevStory.id);

                setTimeout(() => {
                  selectChapter(lastChapter.id);

                  setTimeout(() => {
                    selectSection(lastChapter.sections[lastChapter.sections.length - 1].id);
                  }, 50);
                }, 50);
              }
            }
          } else {
            if (stories.length > 0) {
              const lastStory = stories[stories.length - 1];
              if (lastStory.chapters && lastStory.chapters.length > 0) {
                const lastChapter = lastStory.chapters[lastStory.chapters.length - 1];
                if (lastChapter.sections && lastChapter.sections.length > 0) {
                  selectStory(lastStory.id);

                  setTimeout(() => {
                    selectChapter(lastChapter.id);

                    setTimeout(() => {
                      selectSection(lastChapter.sections[lastChapter.sections.length - 1].id);
                    }, 50);
                  }, 50);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error navigating to previous section:', err);
    }
  }, [stories, currentStoryId, currentChapterId, currentSectionId, selectStory, selectChapter, selectSection]);

  const goToNextSection = useCallback(() => {

    setGraphError(null);

    if (!currentStoryId || !currentChapterId || !currentSectionId) return;

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
          if (firstChapter.sections && firstChapter.sections.length > 0) {
            selectSection(firstChapter.sections[0].id);
          }
        }
        return;
      }

      const chapter = story.chapters[chapterIndex];
      if (!chapter.sections || chapter.sections.length === 0) {
        console.warn(`Chapter with ID ${currentChapterId} has no sections`);
        return;
      }

      const currentIndex = chapter.sections.findIndex(s => s.id === currentSectionId);
      if (currentIndex === -1) {
        console.warn(`Section with ID ${currentSectionId} not found in chapter ${currentChapterId}`);

        selectSection(chapter.sections[0].id);
        return;
      }

      if (currentIndex < chapter.sections.length - 1) {
        selectSection(chapter.sections[currentIndex + 1].id);
      } else {
        if (chapterIndex < story.chapters.length - 1) {
          const nextChapter = story.chapters[chapterIndex + 1];
          if (nextChapter.sections && nextChapter.sections.length > 0) {
            selectChapter(nextChapter.id);
            selectSection(nextChapter.sections[0].id);
          }
        } else {
          const currentStoryIndex = stories.findIndex(s => s.id === currentStoryId);
          if (currentStoryIndex < stories.length - 1) {
            const nextStory = stories[currentStoryIndex + 1];
            if (nextStory.chapters && nextStory.chapters.length > 0) {
              const firstChapter = nextStory.chapters[0];
              if (firstChapter.sections && firstChapter.sections.length > 0) {
                selectStory(nextStory.id);

                setTimeout(() => {
                  selectChapter(firstChapter.id);

                  setTimeout(() => {
                    selectSection(firstChapter.sections[0].id);
                  }, 50);
                }, 50);
              }
            }
          } else {
            if (stories.length > 0) {
              const firstStory = stories[0];
              if (firstStory.chapters && firstStory.chapters.length > 0) {
                const firstChapter = firstStory.chapters[0];
                if (firstChapter.sections && firstChapter.sections.length > 0) {
                  selectStory(firstStory.id);

                  setTimeout(() => {
                    selectChapter(firstChapter.id);

                    setTimeout(() => {
                      selectSection(firstChapter.sections[0].id);
                    }, 50);
                  }, 50);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error navigating to next section:', err);
    }
  }, [stories, currentStoryId, currentChapterId, currentSectionId, selectStory, selectChapter, selectSection]);

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
    currentSection,
    currentStoryId,
    currentChapterId,
    currentSectionId,
    graphData,
    graphDescription,
    entityHighlights,
    selectedNode,
    selectedEdge,
    loading,
    error,
    selectStory,
    selectChapter,
    selectSection,
    goToPreviousSection,
    goToNextSection,
    selectNode,
    selectEdge,
    selectEntityById,
    performAISearch,
    executeCypherQuery
  };
};

export default useGraphData;
