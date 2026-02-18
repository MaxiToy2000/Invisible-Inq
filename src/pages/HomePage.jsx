import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import ThreeGraphVisualization from '../components/graph/ThreeGraphVisualization';
import GraphControls from '../components/graph/GraphControls';
import CombinedStoryDropdown from '../components/story/CombinedStoryDropdown';
import useGraphData from '../hooks/useGraphData';
import { useActivityTracking } from '../hooks/useActivityTracking';
import DonationPopup from '../components/common/DonationPopup';
import AISearchModal from '../components/common/AISearchModal';
import AISummaryModal from '../components/common/AISummaryModal';
import StringConstants from '../components/StringConstants';
import AddNodeModal from '../components/common/AddNodeModal';
import ContextMenu from '../components/common/ContextMenu';
import StoryCard from '../components/common/StoryCard';
import GraphViewByMap from '../components/common/GraphViewByMap';
import ClusterContainer from '../components/common/ClusterContainer';
import TimelineContainer from '../components/common/TimelineContainer';
import CalendarContainer from '../components/common/CalendarContainer';
import ConnectedData from '../components/common/ConnectedData';
import VirtualizedTable from '../components/common/VirtualizedTable';
import LazyJSONViewer from '../components/common/LazyJSONViewer';
import ParticlesBackground from '../components/common/ParticlesBackground';
import BackgroundOverlay from '../components/common/BackgroundOverlay';
import Loader from '../components/common/Loader';
import { FaProjectDiagram, FaTable, FaCode, FaSearch, FaDownload, FaCube, FaSquare, FaTimes, FaSearchPlus, FaSearchMinus, FaExpand, FaExpandArrowsAlt, FaPlus, FaFilter, FaSort, FaMousePointer, FaVectorSquare, FaChevronDown, FaSitemap } from 'react-icons/fa';
import { FiUser, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { getNodeTypeColor } from '../utils/colorUtils';

const HomePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const { user, logout, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const [showGraphView, setShowGraphView] = useState(false);
  const [storyStatistics, setStoryStatistics] = useState({});
  const [forceStrength, setForceStrength] = useState(50);
  const [nodeSize, setNodeSize] = useState(50);
  const [labelSize, setLabelSize] = useState(50);
  const [edgeLength, setEdgeLength] = useState(50);
  const [edgeThickness, setEdgeThickness] = useState(50);
  const [showDonationPopup, setShowDonationPopup] = useState(false);
  const [viewMode, setViewMode] = useState('Graph');
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [selectionMode, setSelectionMode] = useState('individual'); // 'individual' | 'box' | 'lasso'
  const [selectedNodes, setSelectedNodes] = useState(new Set()); // Multi-select nodes
  const [selectedEdges, setSelectedEdges] = useState(new Set()); // Multi-select edges
  const [searchTerm, setSearchTerm] = useState(''); // Immediate search term for input
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Debounced for actual search
  const [is3D, setIs3D] = useState(true);
  const [zoomAction, setZoomAction] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const graphContainerRef = useRef(null);
  const [showAISearchModal, setShowAISearchModal] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiGeneratedQuery, setAiGeneratedQuery] = useState(null);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState(null);
  // AI Summary Modal state
  const [showAISummaryModal, setShowAISummaryModal] = useState(false);
  const [aiSummaryQuery, setAiSummaryQuery] = useState('');
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [rightSidebarActiveTab, setRightSidebarActiveTab] = useState('node-properties');
  const [hiddenCategories, setHiddenCategories] = useState(new Set());
  const [mapView, setMapView] = useState(null); // null, 'flat', 'spherical'
  const [selectedClusterType, setSelectedClusterType] = useState('');
  const [clusterMethod, setClusterMethod] = useState(''); // Clustering method/category
  const [clusterProperty, setClusterProperty] = useState(''); // Node property to cluster by
  const [selectedSceneContainer, setSelectedSceneContainer] = useState(null); // 'map' | 'cluster' | 'timeline' | 'calendar'
  const [graphLayoutMode, setGraphLayoutMode] = useState('force'); // 'force' | 'tree' (hierarchical)
  const [hierarchyTreeAxis, setHierarchyTreeAxis] = useState({ x: false, y: false, z: false });
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, node: null });
  const [sortBy, setSortBy] = useState(null); // 'time' | 'neighbors' | 'hierarchy' | null
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [filterNodeType, setFilterNodeType] = useState(null);
  const [filterTimeRange, setFilterTimeRange] = useState({ start: null, end: null });
  const [filterNeighborCount, setFilterNeighborCount] = useState({ min: null, max: null });
  const [filterLimit, setFilterLimit] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortControls, setShowSortControls] = useState(false);

  // Connected Data API state and caching
  const [connectedDataCache, setConnectedDataCache] = useState({});
  const [connectedDataLoading, setConnectedDataLoading] = useState(false);
  const [connectedDataError, setConnectedDataError] = useState(null);
  const [sectionDescription, setSectionDescription] = useState(null);
  const [savedGraphCameraPosition, setSavedGraphCameraPosition] = useState(null); // { position: {x,y,z}, target: {x,y,z} } for restore
  const [savePositionStatus, setSavePositionStatus] = useState(null); // 'saving' | 'saved' | 'error' | null (for LeftSidebar button)
  const graphRef = useRef(null);

  // Ref to track if we're reading from URL to prevent infinite loops
  const isReadingFromURL = useRef(false);
  // Ref to track the last URL we set ourselves (to prevent reading our own updates)
  const lastURLWeSet = useRef(null);

  const {
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
  } = useGraphData();

  // Initialize activity tracking
  useActivityTracking();

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Load saved graph camera position when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setSavedGraphCameraPosition(null);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    let cancelled = false;
    fetch(`${apiBaseUrl}/api/graph-camera-position`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return null;
        if (res.status === 204) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setSavedGraphCameraPosition({
          position: { x: data.position_x, y: data.position_y, z: data.position_z },
          target: { x: data.target_x, y: data.target_y, z: data.target_z },
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, apiBaseUrl]);

  const handleSaveGraphCameraPosition = useCallback(async (state) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${apiBaseUrl}/api/graph-camera-position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        position_x: state.position.x,
        position_y: state.position.y,
        position_z: state.position.z,
        target_x: state.target.x,
        target_y: state.target.y,
        target_z: state.target.z,
      }),
    });
    if (!res.ok) throw new Error('Failed to save');
  }, [apiBaseUrl]);

  const handleSavePositionClick = useCallback(async () => {
    const state = graphRef.current?.getCurrentCameraState?.();
    if (!state || !isAuthenticated) return;
    setSavePositionStatus('saving');
    try {
      await handleSaveGraphCameraPosition(state);
      setSavePositionStatus('saved');
      setTimeout(() => setSavePositionStatus(null), 2000);
    } catch {
      setSavePositionStatus('error');
      setTimeout(() => setSavePositionStatus(null), 2000);
    }
  }, [isAuthenticated, handleSaveGraphCameraPosition]);

  // Reset camera to initial view, then save the actual camera position after reset to DB
  const handleResetPositionClick = useCallback(async () => {
    graphRef.current?.resetCameraToInitial?.();
    if (!isAuthenticated) return;
    const resetTransitionMs = 500;
    await new Promise((r) => setTimeout(r, resetTransitionMs + 100));
    const state = graphRef.current?.getCurrentCameraState?.();
    if (!state) return;
    try {
      await handleSaveGraphCameraPosition(state);
      setSavedGraphCameraPosition(state);
    } catch {
      // camera was still reset visually
    }
  }, [isAuthenticated, handleSaveGraphCameraPosition]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserMenu]);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  // Helper function to normalize title for URL (lowercase, spaces/special chars to underscores)
  const normalizeTitleForURL = useCallback((title) => {
    if (!title) return null;
    return String(title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_') // Replace any non-alphanumeric chars with underscore
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  }, []);

  // Helper function to find title by normalized URL value
  // The normalizedValue from URL is already normalized (lowercase with underscores)
  // We just need to decode it and compare with normalized item titles
  const findTitleByNormalized = useCallback((normalizedValue, items) => {
    if (!normalizedValue || !items || items.length === 0) return null;
    // Decode URL-encoded value and ensure it's lowercase (should already be, but just in case)
    const decoded = decodeURIComponent(normalizedValue).toLowerCase().trim();
    return items.find(item => {
      if (!item || !item.title) return false;
      const itemNormalized = normalizeTitleForURL(item.title);
      return itemNormalized === decoded;
    });
  }, [normalizeTitleForURL]);

  // Helper function to update URL with current selections (using normalized titles for all: story/chapter/substory)
  // storyTitle, chapterTitle, substoryTitle can be passed directly (from option objects) or will be found from IDs
  const updateURLWithSelections = useCallback((storyId, chapterTitle, substoryTitle, storyTitleDirect = null) => {
    // Get current URL params using window.location to avoid stale closure issues
    const currentSearchParams = new URLSearchParams(window.location.search);
    const searchParams = new URLSearchParams();
    
    // Use storyTitleDirect if provided (from option object), otherwise find story title from storyId
    if (storyId) {
      let storyTitle = storyTitleDirect || null;
      // If not provided directly, try to find story title from stories array
      if (!storyTitle && stories.length > 0) {
        const story = stories.find(s => s.id === storyId);
        if (story && story.title) {
          storyTitle = story.title;
        }
      }
      
      if (storyTitle) {
        // Normalize story title: lowercase with underscores (same format as chapter/substory)
        const normalized = normalizeTitleForURL(storyTitle);
        if (normalized) {
          searchParams.set('story', normalized);
        }
      } else {
        // Fallback: if story title not found, use storyId (but this shouldn't happen normally)
        console.warn(`Story title not found for storyId: ${storyId}, using ID as fallback`);
        searchParams.set('story', String(storyId));
      }
    }
    if (chapterTitle) {
      // Normalize chapter title: lowercase with underscores
      const normalized = normalizeTitleForURL(chapterTitle);
      if (normalized) {
        searchParams.set('chapter', normalized);
      }
    }
    if (substoryTitle) {
      // Normalize substory title: lowercase with underscores
      const normalized = normalizeTitleForURL(substoryTitle);
      if (normalized) {
        searchParams.set('substory', normalized);
      }
    }
    
    // Preserve view and scene from current URL
    const currentView = currentSearchParams.get('view');
    const currentScene = currentSearchParams.get('scene');
    if (currentView && currentView !== 'Graph') {
      searchParams.set('view', currentView);
    }
    if (currentScene) {
      searchParams.set('scene', currentScene);
    }
    
    const newSearch = searchParams.toString();
    const newPath = newSearch ? `/?${newSearch}` : '/';
    const currentPath = window.location.pathname + window.location.search;

    // Normalize paths for comparison
    const normalizePath = (path) => {
      if (path === '/') return '/';
      if (path.startsWith('/?')) return path;
      if (path.startsWith('?')) return `/${path}`;
      return path;
    };
    
    const normalizedNewPath = normalizePath(newPath);
    const normalizedCurrentPath = normalizePath(currentPath);
    
    // Mark this URL as one we set ourselves BEFORE navigating
    // This prevents the URL sync useEffect from re-processing our own URL change
    lastURLWeSet.current = normalizedNewPath;
    
    if (normalizedNewPath !== normalizedCurrentPath) {
      navigate(newPath, { replace: true });
    }
  }, [navigate, normalizeTitleForURL, stories]);

  // Wrapper handlers that update both state and URL
  const handleStorySelect = useCallback((storyId, option) => {
    if (!storyId) return;

    // Mark that we're updating from user action, not URL
    isReadingFromURL.current = false;
    
    // Get story title from option object - use label (displayed text) first, then title
    let storyTitle = option?.label || option?.title || null;
    if (!storyTitle && stories.length > 0) {
      const story = stories.find(s => s.id === storyId);
      storyTitle = story?.title || null;
    }

    if (storyTitle) {
      updateURLWithSelections(storyId, null, null, storyTitle);
    } else {
      console.warn('[handleStorySelect] No story title found, updating URL with ID only');
      updateURLWithSelections(storyId, null, null);
    }
    
    // Update state after URL update
    selectStory(storyId);
  }, [selectStory, updateURLWithSelections, stories]);

  const handleChapterSelect = useCallback((chapterId, option) => {
    // Mark that we're updating from user action, not URL
    isReadingFromURL.current = false;
    
    if (!chapterId) {
      // Update URL to remove chapter and substory
      const currentStoryId = currentStory?.id || null;
      if (currentStoryId) {
        const storyTitle = currentStory?.title || null;
        if (storyTitle) {
          updateURLWithSelections(currentStoryId, null, null, storyTitle);
        } else {
          updateURLWithSelections(currentStoryId, null, null);
        }
      }
      selectChapter(null);
      return;
    }

    // Get chapter title from option object - use label (displayed text) first, then title
    let chapterTitle = option?.label || option?.title || null;
    let selectedChapter = option || null;

    // If not in option, find the chapter from the stories array (try currentStory first, then search all stories)
    if (!chapterTitle && currentStory && currentStory.chapters) {
      selectedChapter = currentStory.chapters.find(c => c.id === chapterId);
      if (selectedChapter && selectedChapter.title) {
        chapterTitle = selectedChapter.title;
      }
    }
    
    // If still not found, search all stories
    if (!chapterTitle && stories.length > 0) {
      for (const story of stories) {
        if (story && story.chapters) {
          const chapter = story.chapters.find(c => c.id === chapterId);
          if (chapter && chapter.title) {
            selectedChapter = chapter;
            chapterTitle = chapter.title;
            break;
          }
        }
      }
    }
    
    // If chapter title still not found, we can't update URL properly - log warning and still select
    if (!chapterTitle) {
      console.warn(`Chapter title not found for chapterId: ${chapterId}, currentStoryId: ${currentStoryId}, stories count: ${stories.length}`);
      // Still select the chapter even if title is missing, but don't update URL
      selectChapter(chapterId);
      return;
    }
    
    // Ensure we have a storyId to include in URL
    // If currentStoryId is not set, try to find it from the chapter we just found
    let storyIdForURL = currentStoryId;
    if (!storyIdForURL) {
      const foundStory = stories.find(s => 
        s.chapters && s.chapters.some(c => c.id === chapterId)
      );
      storyIdForURL = foundStory?.id || null;
    }
    
    // Always automatically select the first section if available
    const firstSubstory = selectedChapter?.substories?.[0];
    const firstSubstoryId = firstSubstory?.id || null;
    const firstSubstoryTitle = firstSubstory?.title || null;
    
    // Ensure we have a storyId to include in URL
    const finalStoryId = storyIdForURL || currentStoryId;
    
    if (!finalStoryId) {
      console.warn(`[handleChapterSelect] Story ID not found for chapterId: ${chapterId}`);
      selectChapter(chapterId);
      return;
    }

    const storyTitle = stories.find(s => s.id === finalStoryId)?.title || null;
    updateURLWithSelections(finalStoryId, chapterTitle, firstSubstoryTitle || null, storyTitle || null);
    
    // Update state
    selectChapter(chapterId);
    
    // If there's a first section, select it after a brief delay
    if (firstSubstoryId) {
      setTimeout(() => {
        selectSubstory(firstSubstoryId);
      }, 50);
    }
  }, [selectChapter, selectSubstory, updateURLWithSelections, currentStoryId, currentStory, stories]);

  const handleSubstorySelect = useCallback((substoryId, option) => {
    // Mark that we're updating from user action, not URL
    isReadingFromURL.current = false;
    
    if (!substoryId) {
      // Update URL to remove substory but keep story and chapter
      if (currentStoryId && currentChapterId) {
        const storyTitle = currentStory?.title || null;
        const chapterTitle = currentChapter?.title || null;
        if (storyTitle && chapterTitle) {
          updateURLWithSelections(currentStoryId, chapterTitle, null, storyTitle);
        } else {
          updateURLWithSelections(currentStoryId, chapterTitle, null);
        }
      }
      selectSubstory(null);
      return;
    }

    // Get substory title from option object - use label (displayed text) first, then title
    let substoryTitle = option?.label || option?.title || null;
    let selectedSubstory = option || null;

    // If not in option, find the substory title (try currentChapter first, then search all stories)
    if (!substoryTitle && currentChapter && currentChapter.substories) {
      selectedSubstory = currentChapter.substories.find(s => s.id === substoryId);
      if (selectedSubstory && selectedSubstory.title) {
        substoryTitle = selectedSubstory.title;
      }
    }
    
    // If still not found, search all stories
    if (!substoryTitle && stories.length > 0 && currentStoryId && currentChapterId) {
      const story = stories.find(s => s.id === currentStoryId);
      if (story && story.chapters) {
        const chapter = story.chapters.find(c => c.id === currentChapterId);
        if (chapter && chapter.substories) {
          const substory = chapter.substories.find(s => s.id === substoryId);
          if (substory && substory.title) {
            selectedSubstory = substory;
            substoryTitle = substory.title;
          }
        }
      }
    }
    
    // Find the chapter title from the current story or stories array
    let chapterTitle = null;
    if (currentStory && currentStory.chapters) {
      const chapter = currentStory.chapters.find(c => c.id === currentChapterId);
      if (chapter && chapter.title) {
        chapterTitle = chapter.title;
      }
    } else if (stories.length > 0 && currentStoryId && currentChapterId) {
      // Fallback: search all stories
      const story = stories.find(s => s.id === currentStoryId);
      if (story && story.chapters) {
        const chapter = story.chapters.find(c => c.id === currentChapterId);
        if (chapter && chapter.title) {
          chapterTitle = chapter.title;
        }
      }
    }
    
    // Ensure we have all required information
    if (!currentStoryId || !chapterTitle) {
      console.warn(`[handleSubstorySelect] Missing storyId (${currentStoryId}) or chapterTitle (${chapterTitle})`);
      selectSubstory(substoryId);
      return;
    }
    
    if (!substoryTitle) {
      console.warn(`[handleSubstorySelect] Substory title not found, will update URL without substory`);
    }
    
    // Get story title for URL
    const storyTitle = currentStory?.title || stories.find(s => s.id === currentStoryId)?.title || null;
    updateURLWithSelections(currentStoryId, chapterTitle, substoryTitle || null, storyTitle || null);
    
    // Update state
    selectSubstory(substoryId);
  }, [selectSubstory, updateURLWithSelections, currentStoryId, currentChapterId, currentStory, currentChapter]);

  // Update URL when view mode or scene container changes
  // Defined after useGraphData so it can access currentStoryId, currentChapterId, etc.
  const updateURL = useCallback((updates) => {
    const searchParams = new URLSearchParams(location.search);
    
    // Preserve existing story/chapter/substory parameters
    const storyId = searchParams.get('story') || (currentStoryId ? String(currentStoryId) : null);
    const chapterId = searchParams.get('chapter') || (currentChapterId ? String(currentChapterId) : null);
    const substoryId = searchParams.get('substory') || (currentSubstoryId ? String(currentSubstoryId) : null);
    
    // Update with new values
    if (updates.view !== undefined) {
      if (updates.view && updates.view !== 'Graph') {
        searchParams.set('view', updates.view);
      } else {
        searchParams.delete('view');
      }
    } else if (viewMode && viewMode !== 'Graph') {
      searchParams.set('view', viewMode);
    } else {
      searchParams.delete('view');
    }
    
    if (updates.scene !== undefined) {
      if (updates.scene) {
        searchParams.set('scene', updates.scene);
      } else {
        searchParams.delete('scene');
      }
    } else if (selectedSceneContainer) {
      searchParams.set('scene', selectedSceneContainer);
    } else {
      searchParams.delete('scene');
    }
    
    // Preserve story parameters
    if (storyId) searchParams.set('story', storyId);
    if (chapterId) searchParams.set('chapter', chapterId);
    if (substoryId) searchParams.set('substory', substoryId);
    
    const newSearch = searchParams.toString();
    const newPath = newSearch ? `/?${newSearch}` : '/';
    
    // Use replace: false to allow back button navigation
    navigate(newPath, { replace: false });
  }, [location.search, navigate, currentStoryId, currentChapterId, currentSubstoryId, viewMode, selectedSceneContainer]);

  // Handle cluster node selection (from RightSidebar)
  const handleClusterNodeSelect = useCallback((value) => {
    setSelectedClusterType(value);
    if (value) {
      setSelectedSceneContainer('cluster');
      updateURL({ scene: 'cluster' });
    }
  }, [updateURL]);

  // Handle cluster method and property selection
  const handleClusterConfigChange = useCallback((method, property) => {
    setClusterMethod(method);
    setClusterProperty(property);
    if (method || property) {
      setSelectedSceneContainer('cluster');
      updateURL({ scene: 'cluster' });
    }
  }, [updateURL]);

  // State for node category and property sorting
  const [sortNodeCategory, setSortNodeCategory] = useState('');
  const [sortNodeProperty, setSortNodeProperty] = useState('');

  // Handle sort configuration change from RightSidebar
  const handleSortConfigChange = useCallback((sortType, nodeCategory, nodeProperty, sortOrderParam) => {
    setSortBy(sortType);
    setSortNodeCategory(nodeCategory);
    setSortNodeProperty(nodeProperty);
    if (sortOrderParam) {
      setSortOrder(sortOrderParam);
    }
  }, []);

  // Handle scene container changes coming from RightSidebar (map/timeline/calendar/cluster)
  const handleSceneContainerChange = useCallback((container) => {
    setSelectedSceneContainer(container);
    updateURL({ scene: container });    // When deselecting scene container, ensure viewMode is Graph so Graph view and Save/Reset XYZ show
    if (!container) {
      setViewMode('Graph');
    }
    // If switching away from map, clear mapView? keep mapView; leave as is to preserve selection
  }, [updateURL]);

  // Handle selection mode changes (must be after useGraphData to access selectNode/selectEdge)
  const handleSelectionModeChange = useCallback((newMode) => {
    // Clear any selected nodes/edges from multi-select
    setSelectedNodes(new Set());
    setSelectedEdges(new Set());
    
    // Clear individual node/edge selections
    selectNode(null);
    selectEdge(null);
    
    // Switch to node-properties tab
    setRightSidebarActiveTab('node-properties');
    
    // Trigger zoom to fit
    setZoomAction('fit');
    
    // Update selection mode
    setSelectionMode(newMode);
  }, [selectNode, selectEdge]);

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      showError(`Failed to load stories: ${error}`, 'Error Loading Stories');
    }
  }, [error, showError]);

  // Show error toast for AI search errors
  useEffect(() => {
    if (aiSearchError) {
      showError(aiSearchError, 'AI Search Error');
      setAiSearchError(null); // Clear error after showing toast
    }
  }, [aiSearchError, showError]);

  // ==================== SEARCH OPTIMIZATION SYSTEM ====================
  
  // Search result cache to prevent redundant computations
  const searchCacheRef = useRef(new Map());
  const searchIndexRef = useRef(null);
  const lastSearchTimeRef = useRef(0);
  
  // Build optimized search index for ultra-fast lookups
  const buildSearchIndex = useCallback((nodes) => {
    if (!nodes || nodes.length === 0) return null;
    
    const index = new Map();
    
    nodes.forEach(node => {
      // Pre-compute all searchable text for this node
      const searchableFields = [
        node.name,
        node.id,
        node.node_type,
        node.type,
        node.category,
        ...(node.properties ? Object.values(node.properties).map(v => String(v)) : [])
      ].filter(Boolean);
      
      // Store lowercase version for case-insensitive search
      const searchText = searchableFields.join(' ').toLowerCase();
      
      // Create n-gram index for partial matching (optional but very fast)
      const words = searchText.split(/\s+/);
      
      index.set(node.id, {
        searchText,
        words,
        node
      });
    });
    
    return index;
  }, []);
  
  // Rebuild search index when graph data changes
  useEffect(() => {
    if (graphData && graphData.nodes) {
      searchIndexRef.current = buildSearchIndex(graphData.nodes);
    } else {
      searchIndexRef.current = null;
    }
    // Clear cache when data changes
    searchCacheRef.current.clear();
  }, [graphData, buildSearchIndex]);
  
  // Ultra-fast search function using the index
  const performOptimizedSearch = useCallback((searchTermInput) => {
    if (!searchTermInput || searchTermInput.trim() === '') {
      return new Set(); // Empty search = no matches
    }
    
    // Check cache first
    const cacheKey = searchTermInput.toLowerCase();
    if (searchCacheRef.current.has(cacheKey)) {
      return searchCacheRef.current.get(cacheKey);
    }
    
    const matches = new Set();
    const searchLower = cacheKey;
    
    if (!searchIndexRef.current) {
      return matches;
    }
    
    // Use the index for fast searching
    searchIndexRef.current.forEach((indexEntry, nodeId) => {
      // Simple substring match (very fast with pre-computed lowercase text)
      if (indexEntry.searchText.includes(searchLower)) {
        matches.add(nodeId);
      }
    });
    
    // Cache the result
    searchCacheRef.current.set(cacheKey, matches);
    
    // Limit cache size to prevent memory issues
    if (searchCacheRef.current.size > 100) {
      const firstKey = searchCacheRef.current.keys().next().value;
      searchCacheRef.current.delete(firstKey);
    }
    
    return matches;
  }, []);
  
  // Debounce search term: update debouncedSearchTerm after 150ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150); // 150ms debounce - fast enough to feel instant, slow enough to reduce updates
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Compute search matches when debounced term changes
  const searchMatches = useMemo(() => {
    return performOptimizedSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performOptimizedSearch]);
  
  // ==================== END SEARCH OPTIMIZATION ====================

  // Handle map ordering by entity type
  const handleMapOrderBy = useCallback((entityType) => {
    if (!graphData || !graphData.nodes || !graphData.links) {
      return;
    }

    // Find all nodes of the selected entity type
    const entityTypeNodes = graphData.nodes.filter(node => {
      const nodeType = node.node_type || node.type || node.category;
      return nodeType === entityType;
    });

    if (entityTypeNodes.length === 0) {
      return;
    }

    // Find nodes with location data (latitude/longitude, country info, or location properties)
    const nodesWithLocation = entityTypeNodes.filter(node => {
      // Check for latitude/longitude
      if (node.latitude !== undefined && node.longitude !== undefined) {
        return true;
      }
      if (node.lat !== undefined && node.lng !== undefined) {
        return true;
      }
      if (node.coordinates !== undefined) {
        return true;
      }
      
      // Check for country-related properties
      if (node.country_name || node.countryName || node.country) {
        return true;
      }
      if (node.primary_place_of_performance_country_name) {
        return true;
      }
      if (node.recipient_country_name) {
        return true;
      }
      
      // Check for location-related properties
      if (node.performance_location || node.performanceLocation) {
        return true;
      }
      if (node.entity_city || node.entityCity) {
        return true;
      }
      if (node.global_region || node.globalRegion) {
        return true;
      }
      
      return false;
    });

    // If we found nodes with location data, select the first one as the map-connected node
    if (nodesWithLocation.length > 0) {
      const mapConnectedNode = nodesWithLocation[0];
      if (mapConnectedNode.id || mapConnectedNode.gid) {
        selectEntityById(mapConnectedNode.id || mapConnectedNode.gid);
      }
    }
  }, [graphData, selectEntityById]);

  // Handle section click from ConnectedData - highlight country nodes
  const handleSectionClick = useCallback((sectionLabel, sectionType) => {
    if (!graphData || !graphData.nodes || !graphData.links) {
      return;
    }

    // Map section type to section_query if needed
    // For now, we'll use the sectionType directly or try to match with currentSubstory
    let sectionQuery = null;
    
    if (currentSubstory && currentSubstory.section_query) {
      sectionQuery = currentSubstory.section_query;
    } else {
      // Fallback: try to find section by matching sectionLabel or sectionType
      // This is a simplified approach - in real implementation, you'd match with actual section data
    }

    // Find all nodes that belong to this section
    const sectionNodes = graphData.nodes.filter(node => {
      if (!sectionQuery) return false;
      const nodeSection = node.section || node.section_query;
      return nodeSection === sectionQuery || 
             (typeof nodeSection === 'string' && nodeSection.includes(sectionQuery)) ||
             (typeof sectionQuery === 'string' && sectionQuery.includes(nodeSection));
    });

    if (sectionNodes.length === 0) {
      return;
    }

    // Get IDs of section nodes
    const sectionNodeIds = new Set(sectionNodes.map(n => n.id || n.gid).filter(Boolean));

    // Find country nodes connected to section nodes through links
    const connectedCountryNodes = [];
    const processedCountryIds = new Set();

    graphData.links.forEach(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      const targetId = link.target?.id || link.targetId || link.target;

      // Check if link connects a section node to a country node
      const sourceIsSectionNode = sectionNodeIds.has(sourceId);
      const targetIsSectionNode = sectionNodeIds.has(targetId);

      if (sourceIsSectionNode || targetIsSectionNode) {
        // Check the other end of the link
        const otherNodeId = sourceIsSectionNode ? targetId : sourceId;
        const otherNode = graphData.nodes.find(n => {
          const nodeId = n.id || n.gid;
          return nodeId === otherNodeId || String(nodeId) === String(otherNodeId);
        });

        if (otherNode) {
          const nodeType = String(otherNode.node_type || otherNode.type || '').toLowerCase();
          const isCountry = nodeType === 'country';
          const countryId = otherNode.id || otherNode.gid;

          if (isCountry && countryId && !processedCountryIds.has(countryId)) {
            connectedCountryNodes.push(otherNode);
            processedCountryIds.add(countryId);
          }
        }
      }
    });

    // Also check if any section nodes are country nodes themselves
    sectionNodes.forEach(node => {
      const nodeType = String(node.node_type || node.type || '').toLowerCase();
      if (nodeType === 'country') {
        const countryId = node.id || node.gid;
        if (countryId && !processedCountryIds.has(countryId)) {
          connectedCountryNodes.push(node);
          processedCountryIds.add(countryId);
        }
      }
    });

    // Highlight country nodes by selecting them
    if (connectedCountryNodes.length > 0) {
      // Select the first country node to highlight it
      // You could also use a different highlighting mechanism if needed
      if (connectedCountryNodes[0]) {
        selectEntityById(connectedCountryNodes[0].id || connectedCountryNodes[0].gid);
      }
    }
  }, [graphData, currentSubstory, selectEntityById]);

  // Fetch ConnectedData API in HomePage when section changes (with caching)
  useEffect(() => {
    const fetchConnectedData = async () => {
      const queryToUse = currentSubstory?.section_query || currentSubstory?.id;
      
      if (!queryToUse) {
        setSectionDescription(null);
        return;
      }

      // Check if data is already cached
      if (connectedDataCache[queryToUse]) {
        // Extract description from cached data
        const cachedData = connectedDataCache[queryToUse];
        if (cachedData.description) {
          setSectionDescription(cachedData.description);
        } else {
          setSectionDescription(null);
        }
        return;
      }

      setConnectedDataLoading(true);
      setConnectedDataError(null);

      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const url = `${apiBaseUrl}/api/graph?graph_path=${encodeURIComponent(queryToUse)}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch graph data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Extract and store description from response
        if (data.description) {
          setSectionDescription(data.description);
        } else {
          setSectionDescription(null);
        }
        
        // Store in cache
        setConnectedDataCache(prev => ({
          ...prev,
          [queryToUse]: data
        }));
      } catch (err) {
        console.error('[HomePage] Error fetching ConnectedData:', err);
        const errorMsg = err.message || 'Failed to load connected data';
        setConnectedDataError(errorMsg);
        setSectionDescription(null);
        showError(errorMsg, 'Connected Data Error');
      } finally {
        setConnectedDataLoading(false);
      }
    };

    fetchConnectedData();
  }, [currentSubstory?.section_query, currentSubstory?.id, connectedDataCache]);

  // Read URL parameters on mount and when URL changes (e.g., back button)
  // URL now uses titles for chapter and substory instead of IDs
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Normalize path for comparison (same logic as in updateURLWithSelections)
    const normalizePath = (path) => {
      if (path === '/') return '/';
      if (path.startsWith('/?')) return path;
      if (path.startsWith('?')) return `/${path}`;
      return path;
    };
    
    const normalizedCurrentPath = normalizePath(currentPath);
    
    // CRITICAL: If we're not reading from URL (user initiated the change), don't process URL changes
    // This prevents double-selection when user clicks CHAPTER/SECTION
    // The user's click already updated both URL and state, so we should NOT re-process
    if (!isReadingFromURL.current && lastURLWeSet.current) {
      // This is a URL we set ourselves from a user action - completely ignore it
      // Clear the flag after a delay to allow for future URL changes (like back button)
      setTimeout(() => {
        lastURLWeSet.current = null;
      }, 500);
      return;
    }
    
    // If this is the exact URL we just set ourselves, don't read from it (prevent reset loop)
    if (lastURLWeSet.current === normalizedCurrentPath) {
      // Clear the flag after a delay to allow for future URL changes
      setTimeout(() => {
        lastURLWeSet.current = null;
      }, 500);
      return;
    }
    
    const searchParams = new URLSearchParams(location.search);
    const storyTitleParam = searchParams.get('story'); // Now this is a normalized title, not an ID
    const chapterTitle = searchParams.get('chapter');
    const substoryTitle = searchParams.get('substory');
    const viewParam = searchParams.get('view');
    const sceneParam = searchParams.get('scene');

    // Helper function to find story, chapter, and substory IDs from normalized titles
    const findIdsFromTitles = () => {
      let foundStoryId = null;
      let foundChapterId = null;
      let foundSubstoryId = null;
      
      // Find story by normalized title (same format as chapter/substory)
      if (storyTitleParam && stories.length > 0) {
        const story = findTitleByNormalized(storyTitleParam, stories);
        if (story) {
          foundStoryId = story.id;
        }
      }
      
      // Try to find chapter by normalized title (need story to be found first)
      if (chapterTitle && stories.length > 0) {
        // If we found a story, use it; otherwise try currentStory
        const storyToUse = foundStoryId 
          ? stories.find(s => s.id === foundStoryId)
          : (storyTitleParam ? findTitleByNormalized(storyTitleParam, stories) : null) || currentStory;
          
        if (storyToUse && storyToUse.chapters) {
          // Find chapter by matching normalized title
          const chapter = findTitleByNormalized(chapterTitle, storyToUse.chapters);
          if (chapter) {
            foundChapterId = chapter.id;
          }
        }
      }
      
      // Try to find substory by normalized title (need chapter to be found first)
      if (substoryTitle && stories.length > 0) {
        // Use foundStoryId if available, otherwise try to find story from title param
        const storyToUse = foundStoryId 
          ? stories.find(s => s.id === foundStoryId)
          : (storyTitleParam ? findTitleByNormalized(storyTitleParam, stories) : null);
          
        if (storyToUse && foundChapterId) {
          const chapter = storyToUse.chapters.find(c => c.id === foundChapterId);
          if (chapter && chapter.substories) {
            // Find substory by matching normalized title
            const substory = findTitleByNormalized(substoryTitle, chapter.substories);
            if (substory) {
              foundSubstoryId = substory.id;
            }
          }
        } else if (currentChapter && currentChapter.substories) {
          // Fallback to current chapter if available
          const substory = findTitleByNormalized(substoryTitle, currentChapter.substories);
          if (substory) {
            foundSubstoryId = substory.id;
          }
        }
      }
      
      return { foundStoryId, foundChapterId, foundSubstoryId };
    };

    // Find story, chapter, and substory IDs from normalized titles
    let { foundStoryId: storyIdFromURL, foundChapterId: chapterId, foundSubstoryId: substoryId } = findIdsFromTitles();

    // Additional safety check: If we're not reading from URL and we just set the URL,
    // and the found IDs match current state, this means we're in the middle of a user-initiated selection
    // This should already be caught above, but adding as extra safety
    if (!isReadingFromURL.current && lastURLWeSet.current) {
      // This is definitely our own change - ignore it completely
      setTimeout(() => {
        lastURLWeSet.current = null;
      }, 500);
      return;
    }

    // Check if URL values match current state - if they do, don't update (prevent loops)
    // Compare by checking if current chapter/substory titles match URL titles
    // But be more lenient - if we just updated state, the titles might not match yet
    let urlChapterMatches = true;
    let urlSubstoryMatches = true;
    
    if (chapterTitle) {
      // Compare normalized titles
      const normalizedURLTitle = normalizeTitleForURL(decodeURIComponent(chapterTitle));
      // Check both currentChapter title and if currentChapterId matches
      if (currentChapter?.title) {
        const normalizedCurrentTitle = normalizeTitleForURL(currentChapter.title);
        urlChapterMatches = normalizedCurrentTitle === normalizedURLTitle;
      } else if (currentChapterId) {
        // If chapter is selected but title not loaded yet, try to find it
        const story = stories.find(s => s.id === currentStoryId);
        if (story && story.chapters) {
          const chapter = story.chapters.find(c => c.id === currentChapterId);
          if (chapter?.title) {
            const normalizedCurrentTitle = normalizeTitleForURL(chapter.title);
            urlChapterMatches = normalizedCurrentTitle === normalizedURLTitle;
          } else {
            urlChapterMatches = true; // Can't verify, assume match
          }
        } else {
          // If we can't verify, assume it matches to prevent reset
          urlChapterMatches = true;
        }
      }
    }
    
    if (substoryTitle) {
      // Compare normalized titles
      const normalizedURLTitle = normalizeTitleForURL(decodeURIComponent(substoryTitle));
      // Check both currentSubstory title and if currentSubstoryId matches
      if (currentSubstory?.title) {
        const normalizedCurrentTitle = normalizeTitleForURL(currentSubstory.title);
        urlSubstoryMatches = normalizedCurrentTitle === normalizedURLTitle;
      } else if (currentSubstoryId) {
        // If substory is selected but title not loaded yet, try to find it
        const story = stories.find(s => s.id === currentStoryId);
        if (story && story.chapters) {
          const chapter = story.chapters.find(c => c.id === (chapterId || currentChapterId));
          if (chapter && chapter.substories) {
            const substory = chapter.substories.find(s => s.id === currentSubstoryId);
            if (substory?.title) {
              const normalizedCurrentTitle = normalizeTitleForURL(substory.title);
              urlSubstoryMatches = normalizedCurrentTitle === normalizedURLTitle;
            } else {
              urlSubstoryMatches = true; // Can't verify, assume match
            }
          } else {
            urlSubstoryMatches = true; // Can't verify, assume match
          }
        } else {
          urlSubstoryMatches = true; // Can't verify, assume match
        }
      }
    }
    
    // Check if story matches - compare normalized titles
    let urlStoryMatches = true;
    if (storyTitleParam) {
      const normalizedURLStoryTitle = normalizeTitleForURL(decodeURIComponent(storyTitleParam));
      if (currentStory?.title) {
        const normalizedCurrentStoryTitle = normalizeTitleForURL(currentStory.title);
        urlStoryMatches = normalizedCurrentStoryTitle === normalizedURLStoryTitle;
      } else if (currentStoryId) {
        // If story is selected but title not loaded yet, try to find it
        const story = stories.find(s => s.id === currentStoryId);
        if (story?.title) {
          const normalizedCurrentStoryTitle = normalizeTitleForURL(story.title);
          urlStoryMatches = normalizedCurrentStoryTitle === normalizedURLStoryTitle;
        } else {
          urlStoryMatches = true; // Can't verify, assume match
        }
      }
    }
    
    const urlMatchesState = urlStoryMatches && urlChapterMatches && urlSubstoryMatches;

    // Only read from URL if values don't match current state (i.e., URL was changed externally like back button)
    // OR if we need to find story/chapter/substory but haven't found them yet (stories might not be loaded)
    const needsUpdate = !urlMatchesState || 
      (storyTitleParam && !storyIdFromURL && stories.length > 0) ||
      (chapterTitle && !chapterId && stories.length > 0) || 
      (substoryTitle && !substoryId && stories.length > 0);
    
    if (needsUpdate) {
      isReadingFromURL.current = true;

      // When no story context in URL (e.g. fresh load / default route), always show Graph and no scene
      const hasStoryContextInURL = !!(storyTitleParam || storyIdFromURL);
      if (!hasStoryContextInURL) {
        setViewMode('Graph');
        setSelectedSceneContainer(null);
      } else {
        // Update view mode from URL only when we have story context
        if (viewParam && ['Graph', 'Table', 'JSON'].includes(viewParam)) {
          setViewMode(viewParam);
        }
        // Update scene container from URL only when we have story context
        if (sceneParam && ['map', 'cluster', 'timeline', 'calendar'].includes(sceneParam)) {
          setSelectedSceneContainer(sceneParam);
        } else {
          setSelectedSceneContainer(null);
        }
      }

      // Handle story/chapter/substory selection from URL
      if (storyIdFromURL) {
        // First, select the story
        selectStory(storyIdFromURL);

        // Wait for story to be selected, then find and select chapter
        if (chapterTitle) {
          // If we found chapterId, use it; otherwise try to find it again after story loads
          const selectChapterFromURL = () => {
            // Re-find chapter ID in case stories weren't loaded when we first checked
            let retryChapterId = chapterId;
            if (!retryChapterId && stories.length > 0 && storyIdFromURL) {
              const story = stories.find(s => s.id === storyIdFromURL);
              if (story && story.chapters) {
                const chapter = findTitleByNormalized(chapterTitle, story.chapters);
                if (chapter) {
                  retryChapterId = chapter.id;
                }
              }
            }
            
            if (retryChapterId) {
              selectChapter(retryChapterId);

              // Then find and select substory
              if (substoryTitle) {
                const selectSubstoryFromURL = () => {
                  // Re-find substory ID in case chapter wasn't loaded when we first checked
                  let retrySubstoryId = substoryId;
                  if (!retrySubstoryId && stories.length > 0 && storyIdFromURL && retryChapterId) {
                    const story = stories.find(s => s.id === storyIdFromURL);
                    if (story && story.chapters) {
                      const chapter = story.chapters.find(c => c.id === retryChapterId);
                      if (chapter && chapter.substories) {
                        const substory = findTitleByNormalized(substoryTitle, chapter.substories);
                        if (substory) {
                          retrySubstoryId = substory.id;
                        }
                      }
                    }
                  }
                  
                  if (retrySubstoryId) {
                    selectSubstory(retrySubstoryId);
                  }
                  
                  // Reset flag after all selections are done
                  // Graph will load automatically via useGraphData hook when currentSubstoryId changes
                  setTimeout(() => {
                    isReadingFromURL.current = false;
                  }, 50);
                };
                
                // Wait for chapter to be selected before selecting substory
                setTimeout(selectSubstoryFromURL, 150);
              } else {
                // Reset flag if no substory
                setTimeout(() => {
                  isReadingFromURL.current = false;
                }, 150);
              }
            } else {
              // If chapter not found and stories are loaded, try one more time after a delay
              if (stories.length > 0) {
                setTimeout(() => {
                  // Re-find story from normalized title in case it wasn't found initially
                  const story = storyIdFromURL 
                    ? stories.find(s => s.id === storyIdFromURL)
                    : (storyTitleParam ? findTitleByNormalized(storyTitleParam, stories) : null);
                  if (story && story.chapters) {
                    const chapter = findTitleByNormalized(chapterTitle, story.chapters);
                    if (chapter) {
                      selectChapter(chapter.id);
                      if (substoryTitle) {
                        setTimeout(() => {
                          const chapterForSubstory = story.chapters.find(c => c.id === chapter.id);
                          if (chapterForSubstory && chapterForSubstory.substories) {
                            const substory = findTitleByNormalized(substoryTitle, chapterForSubstory.substories);
                            if (substory) {
                              selectSubstory(substory.id);
                            }
                          }
                          isReadingFromURL.current = false;
                        }, 150);
                      } else {
                        isReadingFromURL.current = false;
                      }
                    } else {
                      isReadingFromURL.current = false;
                    }
                  } else {
                    isReadingFromURL.current = false;
                  }
                }, 200);
              } else {
                // Reset flag if chapter not found and stories not loaded
                setTimeout(() => {
                  isReadingFromURL.current = false;
                }, 150);
              }
            }
          };
          
          // Wait for story to be selected first
          setTimeout(selectChapterFromURL, 100);
        } else {
          // Reset flag if no chapter
          setTimeout(() => {
            isReadingFromURL.current = false;
          }, 50);
        }
      } else {
        // Reset flag if no story
        isReadingFromURL.current = false;
      }
    } else {
      // URL matches state, just update view/scene if needed
      if (viewParam && ['Graph', 'Table', 'JSON'].includes(viewParam) && viewParam !== viewMode) {
        setViewMode(viewParam);
      }
      if (sceneParam && ['map', 'cluster', 'timeline', 'calendar'].includes(sceneParam) && sceneParam !== selectedSceneContainer) {
        setSelectedSceneContainer(sceneParam);
      } else if (!sceneParam && selectedSceneContainer) {
        setSelectedSceneContainer(null);
      }
    }
  }, [location.search, selectStory, selectChapter, selectSubstory, currentStoryId, currentChapterId, currentSubstoryId, currentStory, currentChapter, currentSubstory, stories, findTitleByNormalized, normalizeTitleForURL]);
  // Note: viewMode and selectedSceneContainer removed from deps to prevent race conditions
  // This effect should only run when the URL changes, not when view state changes

  // Note: URL updates are now handled directly in the handlers (handleStorySelect, handleChapterSelect, handleSubstorySelect)
  // This useEffect is removed to prevent conflicts and race conditions

  // Update URL when viewMode changes (only if not reading from URL)
  useEffect(() => {
    // Only update URL if we have a story selected and we're not reading from URL
    if (!isReadingFromURL.current && (currentStoryId || currentSubstoryId)) {
      updateURL({ view: viewMode });
    }
  }, [viewMode, currentStoryId, currentSubstoryId, updateURL]);

  // Update URL when selectedSceneContainer changes (only if not reading from URL)
  useEffect(() => {
    // Only update URL if we have a story selected and we're not reading from URL
    if (!isReadingFromURL.current && (currentStoryId || currentSubstoryId)) {
      updateURL({ scene: selectedSceneContainer });
    }
  }, [selectedSceneContainer, currentStoryId, currentSubstoryId, updateURL]);

  useEffect(() => {
    const hasGraphData = graphData && graphData.nodes && Array.isArray(graphData.nodes) && graphData.nodes.length > 0;
    if (currentStoryId || hasGraphData) {
      setShowGraphView(true);
    } else if (!currentStoryId && !hasGraphData) {
      setShowGraphView(false);
    }
  }, [currentStoryId, graphData]);

  // Fetch statistics for all stories
  useEffect(() => {
    if (!stories || stories.length === 0) return;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const fetchStatistics = async () => {
      const statsPromises = stories.map(async (story) => {
        try {
          const response = await fetch(`${apiBaseUrl}/api/stories/${encodeURIComponent(story.id)}/statistics`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            return { storyId: story.id, statistics: data };
          }
          return { storyId: story.id, statistics: { total_nodes: 0, entity_count: 0, highlighted_nodes: 0, updated_date: null } };
        } catch {
          return { storyId: story.id, statistics: { total_nodes: 0, entity_count: 0, highlighted_nodes: 0, updated_date: null } };
        }
      });

      const results = await Promise.all(statsPromises);
      const statsMap = {};
      results.forEach(({ storyId, statistics }) => {
        statsMap[storyId] = statistics;
      });
      setStoryStatistics(statsMap);
    };

    fetchStatistics();
  }, [stories]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!graphContainerRef.current) return;

    const element = graphContainerRef.current;

    if (!isFullscreen) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Reset graph layout mode to 'force' when graph is redrawn with new data
  useEffect(() => {
    // Reset to force layout when story/chapter/substory changes (graph is redrawn)
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      setGraphLayoutMode('force');
    }
  }, [currentStoryId, currentChapterId, currentSubstoryId]);

  const handleDownload = () => {
    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-data-${currentStoryId}-${currentChapterId}-${currentSubstoryId || 'all'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddNode = () => {
    setShowAddNodeModal(true);
  };

  const handleNodeRightClick = (node, position = null) => {
    // Use the provided position (calculated from node's 3D position) or fallback to center
    const x = position?.x || window.innerWidth / 2;
    const y = position?.y || window.innerHeight / 2;
    
    setContextMenu({
      show: true,
      x,
      y,
      node
    });
  };

  const handleDeleteNode = async (node) => {
    if (!node || (!node.id && !node.gid)) {
      showError('Invalid node selected for deletion', 'Delete Failed');
      return;
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    
    try {
      // Get node ID - prefer gid, fallback to id
      // Handle both string and numeric IDs (including floats)
      let nodeId = node.gid || node.id;
      
      if (nodeId === undefined || nodeId === null) {
        showError('Node ID is missing or invalid', 'Delete Failed');
        return;
      }
      
      // Convert to string, handling numeric IDs (including floats like 12566197.0)
      // If it's a number, convert to string (removing .0 if it's a whole number)
      if (typeof nodeId === 'number') {
        // If it's a whole number (like 12566197.0), convert to integer string
        if (nodeId % 1 === 0) {
          nodeId = String(Math.floor(nodeId));
        } else {
          nodeId = String(nodeId);
        }
      } else {
        nodeId = String(nodeId).trim();
      }
      
      if (!nodeId || nodeId === 'undefined' || nodeId === 'null' || nodeId === '') {
        showError('Node ID is missing or invalid', 'Delete Failed');
        return;
      }
      
      // Send request to backend to delete node and relationships
      const response = await fetch(`${apiBaseUrl}/api/nodes/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          node_id: nodeId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Failed to delete node: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Show success toast notification
      showSuccess(
        `Node "${node.name || node.id}" and all its relationships have been deleted from Neo4j.`,
        'Node Deleted'
      );
      
      // Clear selected node if it was the deleted one
      if (selectedNode && (selectedNode.id === node.id || selectedNode.gid === node.id)) {
        selectNode(null);
      }
      
      // Close context menu
      closeContextMenu();
      
      // Optionally refresh the graph data to reflect the deletion
      // You might want to trigger a graph refresh here
      // For example: fetchGraphData();
      
    } catch (error) {
      console.error('[HomePage] ❌ Error deleting node:', error);
      showError(
        error.message || 'An unexpected error occurred while deleting the node.',
        'Failed to Delete Node'
      );
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, node: null });
  };

  // Calculate neighbor count for a node
  const getNeighborCount = useCallback((node) => {
    if (!graphData.links || !node) return 0;
    
    // Get node ID (check both id and gid)
    const nodeId = node.id || node.gid;
    if (!nodeId) return 0;
    
    // Count links where this node is either source or target
    // Handle both string IDs and node objects in links
    return graphData.links.filter(link => {
      // Extract source and target IDs, handling both string IDs and node objects
      const sourceId = link.sourceId || (link.source && (link.source.id || link.source.gid)) || link.source;
      const targetId = link.targetId || (link.target && (link.target.id || link.target.gid)) || link.target;
      
      // Convert to strings for reliable comparison
      return String(sourceId) === String(nodeId) || String(targetId) === String(nodeId);
    }).length;
  }, [graphData.links]);

  // Get time value for sorting (prioritize relationship_date, then date)
  const getTimeValue = useCallback((node) => {
    if (node.relationship_date) {
      const date = new Date(node.relationship_date);
      return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    if (node.date) {
      const date = new Date(node.date);
      return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    // If no date, put at end
    return 0;
  }, []);

  // Calculate hierarchy level (distance from root nodes - nodes with no incoming edges)
  const getHierarchyLevel = useCallback((node) => {
    if (!graphData.links || !graphData.nodes) return 0;
    
    // Find root nodes (nodes with no incoming edges)
    const allTargetIds = new Set(
      graphData.links.map(link => link.target || link.targetId).filter(Boolean)
    );
    const rootNodes = graphData.nodes.filter(n => 
      n.id && !allTargetIds.has(n.id)
    );
    
    // BFS to calculate hierarchy level
    const visited = new Set();
    const levels = new Map();
    
    // Initialize root nodes at level 0
    rootNodes.forEach(root => {
      if (root.id) {
        levels.set(root.id, 0);
        visited.add(root.id);
      }
    });
    
    // BFS traversal
    const queue = [...rootNodes];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current.id) continue;
      
      const currentLevel = levels.get(current.id) || 0;
      
      // Find all nodes this node connects to
      const outgoingLinks = graphData.links.filter(link => 
        (link.source === current.id || link.sourceId === current.id)
      );
      
      outgoingLinks.forEach(link => {
        const targetId = link.target || link.targetId;
        if (targetId && !visited.has(targetId)) {
          levels.set(targetId, currentLevel + 1);
          visited.add(targetId);
          const targetNode = graphData.nodes.find(n => n.id === targetId);
          if (targetNode) queue.push(targetNode);
        }
      });
    }
    
    return levels.get(node.id) ?? 999; // Default to high level if not found
  }, [graphData.links, graphData.nodes]);

  // Filter nodes based on all active filters
  const filterNodes = useCallback((nodes) => {
    let filtered = [...nodes];

    // Filter out hidden categories (completely remove nodes, not just dim them)
    if (hiddenCategories.size > 0) {
      filtered = filtered.filter(node => {
        const nodeType = node.node_type || node.type || node.category;
        return !nodeType || !hiddenCategories.has(nodeType);
      });
    }

    // Filter by node type
    if (filterNodeType) {
      filtered = filtered.filter(node => {
        const nodeType = node.node_type || node.type || node.category;
        return nodeType === filterNodeType;
      });
    }

    // Filter by time range
    if (filterTimeRange.start || filterTimeRange.end) {
      filtered = filtered.filter(node => {
        const timeValue = getTimeValue(node);
        if (timeValue === 0) return false; // Exclude nodes without dates
        
        if (filterTimeRange.start && timeValue < filterTimeRange.start.getTime()) {
          return false;
        }
        if (filterTimeRange.end && timeValue > filterTimeRange.end.getTime()) {
          return false;
        }
        return true;
      });
    }

    // Filter by neighbor count
    if (filterNeighborCount.min !== null || filterNeighborCount.max !== null) {
      filtered = filtered.filter(node => {
        const neighborCount = getNeighborCount(node);
        if (filterNeighborCount.min !== null && neighborCount < filterNeighborCount.min) {
          return false;
        }
        if (filterNeighborCount.max !== null && neighborCount > filterNeighborCount.max) {
          return false;
        }
        return true;
      });
    }

    // Apply limit
    if (filterLimit && filterLimit > 0) {
      filtered = filtered.slice(0, filterLimit);
    }

    return filtered;
  }, [hiddenCategories, filterNodeType, filterTimeRange, filterNeighborCount, filterLimit, getTimeValue, getNeighborCount]);

  // Filter graph data (nodes and links) for Graph view - memoized to prevent unnecessary re-renders
  const filteredGraphData = useMemo(() => {
    if (!graphData || !graphData.nodes) {
      return { nodes: [], links: [] };
    }

    // Apply user-defined filters (hide categories, search, etc.)
    let filteredNodes = filterNodes(graphData.nodes);

    // Create a set of filtered node IDs for quick lookup
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id || node.gid));

    // Filter links to only include links where BOTH source and target are visible (not hidden)
    let filteredLinks = [];
    if (graphData.links && graphData.links.length > 0) {
      filteredLinks = graphData.links.filter(link => {
        const sourceId = link.source?.id || link.sourceId || link.source;
        const targetId = link.target?.id || link.targetId || link.target;
        // Both nodes must be in the filtered set (both visible)
        return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
      });
    }

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }, [graphData, filterNodes, hiddenCategories]);

  // Memoize onZoomComplete callback to prevent unnecessary re-renders
  const handleZoomComplete = useCallback(() => {
    setZoomAction(null);
  }, []);

  // Sort nodes based on current sort criteria
  const sortNodes = useCallback((nodes) => {
    if (!sortBy && !sortNodeCategory) return nodes;
    
    const sorted = [...nodes].sort((a, b) => {
      // First, sort by category if specified
      if (sortNodeCategory) {
        const normalizedCategory = sortNodeCategory.toLowerCase().replace(/_/g, ' ');
        const aCategory = (a.category || a.node_type || '').toLowerCase().replace(/_/g, ' ');
        const bCategory = (b.category || b.node_type || '').toLowerCase().replace(/_/g, ' ');
        
        // Check if nodes match the selected category
        const aMatchesCategory = aCategory === normalizedCategory || aCategory.includes(normalizedCategory);
        const bMatchesCategory = bCategory === normalizedCategory || bCategory.includes(normalizedCategory);
        
        // Prioritize nodes that match the category
        if (aMatchesCategory && !bMatchesCategory) return -1;
        if (!aMatchesCategory && bMatchesCategory) return 1;
        
        // If both match or both don't match, continue with other sorting
      }
      
      // Then apply the selected sort method
      let aValue, bValue;
      
      switch (sortBy) {
        case 'time':
          aValue = getTimeValue(a);
          bValue = getTimeValue(b);
          break;
        case 'neighbors':
          aValue = getNeighborCount(a);
          bValue = getNeighborCount(b);
          break;
        case 'hierarchy':
          aValue = getHierarchyLevel(a);
          bValue = getHierarchyLevel(b);
          break;
        default:
          // If sortNodeProperty is specified, sort by that property
          if (sortNodeProperty) {
            aValue = a[sortNodeProperty] || a.properties?.[sortNodeProperty] || '';
            bValue = b[sortNodeProperty] || b.properties?.[sortNodeProperty] || '';
            
            // Handle different data types
            if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sortOrder === 'asc' 
                ? aValue.localeCompare(bValue) 
                : bValue.localeCompare(aValue);
            }
          }
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [sortBy, sortOrder, sortNodeCategory, sortNodeProperty, getTimeValue, getNeighborCount, getHierarchyLevel]);

  // Memoized processed data for table view (prevents expensive recomputations)
  const processedTableData = useMemo(() => {
    // Step 1: Apply search filter using pre-computed search matches (ultra-fast!)
    let searchFiltered = graphData.nodes;
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      // Use pre-computed search matches instead of filtering again
      searchFiltered = graphData.nodes.filter(node => searchMatches.has(node.id));
    }

    // Step 2: Apply advanced filters
    const filtered = filterNodes(searchFiltered);

    // Step 3: Apply sorting
    const sorted = sortNodes(filtered);

    return sorted;
  }, [graphData.nodes, debouncedSearchTerm, searchMatches, filterNodes, sortNodes]);

  // Memoized processed links for table view
  const processedLinksData = useMemo(() => {
    return graphData.links || [];
  }, [graphData.links]);

  const handleCreateNode = async (nodeData) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    
    try {
      const sectionGid = currentSubstory?.id || currentSubstoryId || null;

      // Send request to backend to create node in Neo4j
      const response = await fetch(`${apiBaseUrl}/api/nodes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: nodeData.category,
          properties: nodeData.properties,
          // Attach to currently-selected section so it appears in the graph immediately
          // (new DB matches via Section Name key stored in node.section/node.sections).
          section_gid: sectionGid
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Failed to create node: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Show success toast notification
      showSuccess(
        `Node with label "${nodeData.category}" has been created successfully in Neo4j.`,
        'Node Created'
      );
      
      // Optionally refresh the graph data to show the new node
      // You might want to trigger a graph refresh here
      // For example: fetchGraphData();
      
      // Close modal
      setShowAddNodeModal(false);
      
    } catch (error) {
      console.error('[HomePage] ❌ Error creating node:', error);
      showError(
        error.message || 'An unexpected error occurred while creating the node.',
        'Failed to Create Node'
      );
    }
  };

  // Fetch all node types from the database
  const [allNodeTypes, setAllNodeTypes] = useState([]);
  const [nodeTypesWithPropertyKeys, setNodeTypesWithPropertyKeys] = useState([]);
  const [loadingNodeTypes, setLoadingNodeTypes] = useState(false);
  const [nodeTypesDataReady, setNodeTypesDataReady] = useState(false);

  useEffect(() => {
    const fetchNodeTypesAndPropertyKeys = async () => {
      setLoadingNodeTypes(true);
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      
      try {

        // Execute Cypher query to get all node types and their properties
        const cypherQuery = `CALL db.schema.nodeTypeProperties() YIELD nodeType, propertyName, mandatory RETURN nodeType, collect(propertyName) as properties`;

        // Execute Cypher query via API
        const cypherResponse = await fetch(`${apiBaseUrl}/api/cypher/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: cypherQuery }),
        });

        if (cypherResponse.ok) {
          const cypherData = await cypherResponse.json();
          
          // Extract node types and properties from rawResults
          // The query returns: [{nodeType: ":`Relationship`", properties: ["prop1", "prop2", ...]}, ...]
          let processedNodeTypesWithPropertyKeys = [];
          let nodeTypesList = [];
          
          // Check if we have rawResults (the backend should return raw results for this query)
          if (cypherData.rawResults !== null && cypherData.rawResults !== undefined) {
            if (Array.isArray(cypherData.rawResults)) {
              
              if (cypherData.rawResults.length === 0) {
              } else {
                processedNodeTypesWithPropertyKeys = cypherData.rawResults.map((record, idx) => {
                  
                  const nodeType = record.nodeType || record.node_type || '';
                  const properties = record.properties || [];
                  
                  
                  // Clean nodeType string (remove backticks and colons if present)
                  // nodeType format: ":`Relationship`" -> "Relationship"
                  let cleanNodeType = String(nodeType);
                  if (cleanNodeType.startsWith(':`')) {
                    cleanNodeType = cleanNodeType.substring(2);
                  }
                  if (cleanNodeType.endsWith('`')) {
                    cleanNodeType = cleanNodeType.substring(0, cleanNodeType.length - 1);
                  }
                  
                  // Ensure properties is an array
                  const propertiesArray = Array.isArray(properties) ? properties : [];
                  
                  if (propertiesArray.length > 0) {
                    propertiesArray.forEach((prop, propIdx) => {
                    });
                  } else {
                  }
                  
                  // Add to node types list
                  if (cleanNodeType && cleanNodeType.trim() && !nodeTypesList.includes(cleanNodeType)) {
                    nodeTypesList.push(cleanNodeType);
                  }
                  
                  return {
                    nodeType: cleanNodeType,
                    rawNodeType: nodeType,
                    propertyKeys: propertiesArray,
                    propertyCount: propertiesArray.length
                  };
                });
              }
            } else {
            }
          } else {
          }
          
          // Set node types list for dropdown and store full data with property keys
          if (nodeTypesList.length > 0 && processedNodeTypesWithPropertyKeys.length > 0) {
            setAllNodeTypes(nodeTypesList);
            setNodeTypesWithPropertyKeys(processedNodeTypesWithPropertyKeys);
            setNodeTypesDataReady(true);
            
            // Print summary
            processedNodeTypesWithPropertyKeys.forEach((item, index) => {
              if (item.propertyKeys && item.propertyKeys.length > 0) {
                item.propertyKeys.forEach((propKey, idx) => {
                });
              } else {
              }
            });
          } else {
            setAllNodeTypes([]);
            setNodeTypesWithPropertyKeys([]);
            setNodeTypesDataReady(false);
          }

        } else {
          const errorText = await cypherResponse.text().catch(() => '');
          setAllNodeTypes([]);
          setNodeTypesWithPropertyKeys([]);
          setNodeTypesDataReady(false);
        }

      } catch (error) {
        setAllNodeTypes([]);
        setNodeTypesWithPropertyKeys([]);
        setNodeTypesDataReady(false);
      } finally {
        setLoadingNodeTypes(false);
      }
    };

    fetchNodeTypesAndPropertyKeys();
  }, []);

  // Extract existing categories from graphData for the dropdown (as fallback)
  const existingCategories = useMemo(() => {
    
    // Use allNodeTypes from database as primary source
    if (allNodeTypes.length > 0) {
      return allNodeTypes;
    }
    
    // Fallback: extract from graphData
    const categories = new Set();
    if (graphData && graphData.nodes) {
      graphData.nodes.forEach(node => {
        if (node.category) {
          categories.add(node.category);
        }
        if (node.node_type) {
          categories.add(node.node_type);
        }
      });
    }
    
    // If still no categories, return empty array
    if (categories.size === 0) {
      return [];
    }
    
    const sortedCategories = Array.from(categories).sort();
    return sortedCategories;
  }, [graphData, allNodeTypes]);

  // Helper function to calculate 33% of a color (darker version for background)
  const getColorAt33Percent = (hexColor) => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate 33% of each component
    const r33 = Math.round(r * 0.33);
    const g33 = Math.round(g * 0.33);
    const b33 = Math.round(b * 0.33);
    
    // Convert back to hex
    const toHex = (n) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r33)}${toHex(g33)}${toHex(b33)}`;
  };

  // Calculate category counts from graphData and extract all unique node types
  const categoryCounts = useMemo(() => {
    const counts = {};
    if (graphData && graphData.nodes && Array.isArray(graphData.nodes)) {
      graphData.nodes.forEach(node => {
        const nodeType = node.node_type || node.type || 'Entity';
        counts[nodeType] = (counts[nodeType] || 0) + 1;
      });
    }
    return counts;
  }, [graphData]);

  // Dynamically generate display categories from all node types in graphData
  const displayCategories = useMemo(() => {
    // Get all unique node types from graphData
    const nodeTypes = new Set();
    if (graphData && graphData.nodes && Array.isArray(graphData.nodes)) {
      graphData.nodes.forEach(node => {
        const nodeType = node.node_type || node.type || 'Entity';
        if (nodeType) {
          nodeTypes.add(nodeType);
        }
      });
    }

    // Convert to array and sort alphabetically for consistent display
    const sortedTypes = Array.from(nodeTypes).sort();

    // Create category objects with colors from colorUtils
    return sortedTypes.map(nodeType => ({
      name: nodeType,
      count: categoryCounts[nodeType] || 0,
      color: getNodeTypeColor(nodeType)
    }));
  }, [graphData, categoryCounts]);

  const handleStorySelection = (option) => {
    if (option && option.storyId && option.chapterId && option.substoryId) {
      selectStory(option.storyId);

      setTimeout(() => {
        selectChapter(option.chapterId);

        setTimeout(() => {
          selectSubstory(option.substoryId);
        }, 100);
      }, 100);
    }
  };

  const handleAISearch = async (searchQuery) => {
    try {
      setAiSearchLoading(true);
      setAiSearchError(null);
      setAiSearchQuery(searchQuery);

      const results = await performAISearch(searchQuery);

      if (results && results.graphData) {
        setAiSearchResults(results.graphData);
        setAiGeneratedQuery(results.generatedQuery || null);
        setShowAISearchModal(true);
      }

      setAiSearchLoading(false);
    } catch (err) {
      console.error('Error in AI search:', err);
      setAiSearchError(err.message || 'Failed to perform AI search');
      setAiSearchLoading(false);
    }
  };

  const handleCloseAISearchModal = () => {
    setShowAISearchModal(false);
    setAiSearchResults(null);
    setAiSearchQuery('');
    setAiGeneratedQuery(null);
    setAiSearchError(null);
  };

  // AI Summary handlers
  const handleAISummary = (query) => {
    setAiSummaryQuery(query);
    setShowAISummaryModal(true);
  };

  const handleCloseAISummaryModal = () => {
    setShowAISummaryModal(false);
    setAiSummaryQuery('');
  };

  const handleSummaryEntityClick = (node) => {
    // Close the modal and select the node in the graph
    setShowAISummaryModal(false);
    selectNode(node);
    // Zoom to the node
    setZoomAction({ type: 'toNode', node });
  };

  if (!showGraphView) {
    return (
      <div className="flex flex-col min-h-screen bg-black text-white relative overflow-hidden">
        {/* Particles Background */}
        <ParticlesBackground className="z-0 fixed inset-0" />
        {/* Background Overlay */}
        <BackgroundOverlay opacity={0.15} gradient={true} className="z-0 fixed inset-0" />
        {}
        <header className="bg-[#09090B]/80 backdrop-blur-sm text-white shadow-md sticky top-0 z-50 flex h-8 items-center relative">
          {}
          <div className="h-full flex items-center ml-8 pl-2">
            <img
              src="/images/logo-with-text.png"
              alt="Invisible Inqury Logo"
              className="h-8 object-contain"
            />
          </div>

          {}
          <div className="flex-1 flex justify-center items-center select-none cursor-default">
            <nav className="flex items-center">
              <Link
                to="/"
                className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm focus:outline-none outline-none cursor-default"
                aria-label="Home page"
                tabIndex={0}
              >
                Home Page
              </Link>
              <span className="mx-1 lg:mx-2 text-white text-xs lg:text-sm select-none cursor-default">-</span>
              <Link
                to="/about"
                className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm focus:outline-none outline-none cursor-default"
                aria-label="About page"
                tabIndex={0}
              >
                About
              </Link>
              <span className="mx-1 lg:mx-2 text-white text-xs lg:text-sm select-none cursor-default">-</span>
              <Link
                to="/contact"
                className="text-white hover:text-gray-300 transition-colors text-xs lg:text-sm focus:outline-none outline-none cursor-default"
                aria-label="Contact page"
                tabIndex={0}
              >
                Contact
              </Link>
              <span className="mx-1 lg:mx-2 text-white text-xs lg:text-sm select-none cursor-default">-</span>
              <button
                className="text-white hover:text-gray-300 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs lg:text-sm focus:outline-none outline-none"
                aria-label="Donate page"
                tabIndex={0}
                onClick={() => setShowDonationPopup(true)}
              >
                Donate
              </button>
            </nav>
          </div>

          {}
          {/* User Menu and Version Info - Desktop */}
          <div className="hidden lg:flex items-center gap-4 mr-4">
            {isAuthenticated() ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
                >
                  {user?.profile_picture ? (
                    <img
                      src={user.profile_picture}
                      alt={user.full_name || user.email}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                      <FiUser className="w-3 h-3" />
                    </div>
                  )}
                  <span className="text-xs hidden xl:inline">
                    {user?.full_name || user?.email?.split('@')[0]}
                  </span>
                  <FiChevronDown className="w-3 h-3" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#18181B] border border-[#27272A] rounded-md shadow-lg py-1 z-50">
                    <div className="px-4 py-2 border-b border-[#27272A]">
                      <p className="text-sm font-medium text-white truncate">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#27272A] flex items-center gap-2"
                    >
                      <FiLogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-white hover:text-gray-300 transition-colors text-xs"
                >
                  Sign in
                </Link>
                <span className="text-white text-xs">|</span>
                <Link
                  to="/register"
                  className="bg-indigo-600 text-white px-2 py-1 rounded-md hover:bg-indigo-700 transition-colors text-xs"
                >
                  Sign up
                </Link>
              </div>
            )}
            <span className="text-white text-xs">Graph Viewer 1.0</span>
          </div>

          {/* Mobile - Show auth */}
          <div className="lg:hidden flex items-center gap-2 mr-4">
            {isAuthenticated() ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center text-white hover:text-gray-300 transition-colors"
                >
                  {user?.profile_picture ? (
                    <img
                      src={user.profile_picture}
                      alt={user.full_name || user.email}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                      <FiUser className="w-3 h-3" />
                    </div>
                  )}
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#18181B] border border-[#27272A] rounded-md shadow-lg py-1 z-50">
                    <div className="px-4 py-2 border-b border-[#27272A]">
                      <p className="text-sm font-medium text-white truncate">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#27272A] flex items-center gap-2"
                    >
                      <FiLogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="text-white hover:text-gray-300 transition-colors text-xs"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>
        {}
        {showDonationPopup && (
          <DonationPopup onClose={() => setShowDonationPopup(false)} />
        )}
        {}
        <main className="flex-1 flex flex-col bg-transparent w-full relative z-10">
          {}
          {/* Logo section */}
          <div className="flex justify-center items-center px-6 sm:px-8 lg:px-12 xl:px-16 pt-8 pb-6 w-full">
            <img
              src="/images/logo-without-text.png"
              alt="Invisible Inquiry Logo"
              className="h-12 sm:h-12 object-contain"
            />
          </div>

          {/* Centered heading */}
          <div className="flex justify-center items-center px-6 sm:px-8 lg:px-12 xl:px-16 pb-4 w-full">
            <h2 className="text-[18px] font-semibold text-[#F4F4F5">Select An Investigative Story</h2>
          </div>

          <div className="px-6 sm:px-8 lg:px-12 xl:px-24 pb-8 w-full">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-12 gap-4">
                <Loader size={48} />
              </div>
            ) : stories.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-24 gap-6">
                <div className="text-[#F4F4F5] text-6xl opacity-30">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="text-[#F4F4F5] text-2xl font-semibold">No Stories Available</div>
                <div className="text-[#A1A1AA] text-base text-center max-w-md">
                  There are currently no investigative stories to display. Please check back later or contact support if you believe this is an error.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8 md:gap-10 lg:gap-12 w-full">
                {stories.map((story) => {
                  // Calculate total sections for this story
                  const totalSections = story?.chapters?.reduce((sum, chapter) => {
                    return sum + (chapter?.substories?.length || 0);
                  }, 0) || 0;

                  const handleStoryCardClick = () => {
                    if (story?.id) {
                      // Navigate to the story by selecting it
                      selectStory(story.id);
                      // If story has chapters and substories, select the first one
                      if (story.chapters && story.chapters.length > 0) {
                        const firstChapter = story.chapters[0];
                        if (firstChapter.substories && firstChapter.substories.length > 0) {
                          setTimeout(() => {
                            selectChapter(firstChapter.id);
                            setTimeout(() => {
                              selectSubstory(firstChapter.substories[0].id);
                            }, 100);
                          }, 100);
                        }
                      }
                      // Show graph view
                      setShowGraphView(true);
                    }
                  };

                  const handleChapterSelect = (storyId, chapterId) => {
                    if (storyId && chapterId) {
                      // Select the story first
                      selectStory(storyId);
                      // Find the chapter and select it
                      const selectedStory = stories.find(s => s.id === storyId);
                      if (selectedStory) {
                        const selectedChapter = selectedStory.chapters?.find(c => c.id === chapterId);
                        if (selectedChapter) {
                          setTimeout(() => {
                            selectChapter(chapterId);
                            // Select the first substory if available
                            if (selectedChapter.substories && selectedChapter.substories.length > 0) {
                              setTimeout(() => {
                                selectSubstory(selectedChapter.substories[0].id);
                              }, 100);
                            }
                          }, 100);
                        }
                      }
                      // Show graph view
                      setShowGraphView(true);
                    }
                  };

                  const stats = storyStatistics[story.id] || { total_nodes: 0, entity_count: 0, highlighted_nodes: 0, updated_date: null };

                  return (
                    <StoryCard
                      key={story.id}
                      story={story}
                      onClick={handleStoryCardClick}
                      onChapterSelect={handleChapterSelect}
                      totalNodes={stats.total_nodes || 0}
                      entityCount={stats.entity_count || 0}
                      highlightedNodes={stats.highlighted_nodes || 0}
                      updatedDate={stats.updated_date}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
    <Layout
      stories={stories}
      currentStory={currentStory}
      currentChapter={currentChapter}
      currentSubstory={currentSubstory}
      currentStoryId={currentStoryId}
      currentChapterId={currentChapterId}
      currentSubstoryId={currentSubstoryId}
      onStorySelect={handleStorySelect}
      onChapterSelect={handleChapterSelect}
      onSubstorySelect={handleSubstorySelect}
      onPrevious={goToPreviousSubstory}
      onNext={goToNextSubstory}
      selectedNode={selectedNode}
      selectedEdge={selectedEdge}
      forceStrength={forceStrength}
      nodeSize={nodeSize}
      labelSize={labelSize}
      edgeLength={edgeLength}
      edgeThickness={edgeThickness}
      onForceChange={setForceStrength}
      onNodeSizeChange={setNodeSize}
      onLabelSizeChange={setLabelSize}
      onEdgeLengthChange={setEdgeLength}
      onEdgeThicknessChange={setEdgeThickness}
      is3D={is3D}
      on3DToggle={(nextIs3D) => setIs3D(nextIs3D)}
      showRightSidebar={showRightSidebar}
      onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
      onAISearch={handleAISearch}
      onAISummary={handleAISummary}
      graphData={graphData}
      graphDescription={graphDescription}
      sectionDescription={sectionDescription}
      filteredGraphData={filteredGraphData}
      onEntityHighlight={selectEntityById}
      rightSidebarActiveTab={rightSidebarActiveTab}
      onRightSidebarActiveTabChange={setRightSidebarActiveTab}
      mapView={mapView}
      onMapViewChange={setMapView}
      onClusterNodeSelect={handleClusterNodeSelect}
      onSceneContainerChange={handleSceneContainerChange}
      nodeTypesWithPropertyKeys={nodeTypesWithPropertyKeys}
      onClusterConfigChange={handleClusterConfigChange}
      clusterMethod={clusterMethod}
      clusterProperty={clusterProperty}
      connectedDataCache={connectedDataCache}
      connectedDataLoading={connectedDataLoading}
      connectedDataError={connectedDataError}
      onSortConfigChange={handleSortConfigChange}
      sortBy={sortBy}
      sortOrder={sortOrder}
      sortNodeCategory={sortNodeCategory}
      sortNodeProperty={sortNodeProperty}
      selectedNodes={selectedNodes}
      selectedEdges={selectedEdges}
      hierarchyTreeAxis={hierarchyTreeAxis}
      onHierarchyTreeAxisChange={setHierarchyTreeAxis}
      showSavePositionButton={viewMode === 'Graph' && !selectedSceneContainer}
      onSavePositionClick={isAuthenticated ? handleSavePositionClick : undefined}
      savePositionStatus={savePositionStatus}
      onResetPositionClick={handleResetPositionClick}
    >
        <div className="flex flex-col h-full">
          {}
          <div ref={graphContainerRef} className="flex-1 relative min-h-0 h-full bg-[#111111]">
          {}
          {loading && viewMode === 'Graph' && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader size={36} />
            </div>
          )}

          {}
          {/* Show Scene Containers (map/cluster/timeline/calendar) or fallback to Graph/Table/JSON */}
          {(() => {
            const showMapScene = selectedSceneContainer === 'map' && mapView !== null && mapView !== undefined;
            const showOtherScene = selectedSceneContainer && selectedSceneContainer !== 'map';
            return showMapScene || showOtherScene;
          })() ? (
            <>
              {/* Map View - displayed between left and right sidebars */}
              {selectedSceneContainer === 'map' && mapView && (
                <GraphViewByMap 
                  mapView={mapView} 
                  graphData={graphData}
                  currentSubstoryId={currentSubstoryId}
                  currentSubstory={currentSubstory}
                />
              )}
              {/* Other scene containers */}
              {selectedSceneContainer === 'cluster' && (selectedClusterType || clusterMethod || clusterProperty) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2/3 h-1/2">
                    <ClusterContainer 
                      selectedCluster={selectedClusterType} 
                      graphData={graphData}
                      clusterMethod={clusterMethod}
                      clusterProperty={clusterProperty}
                      currentSubstory={currentSubstory}
                    />
                  </div>
                </div>
              )}
              {selectedSceneContainer === 'timeline' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2/3 h-1/2">
                    <TimelineContainer />
                  </div>
                </div>
              )}
              {selectedSceneContainer === 'calendar' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2/3 h-1/2">
                    <CalendarContainer 
                      sectionQuery={currentSubstory?.section_query}
                      currentSubstory={currentSubstory}
                    />
                  </div>
                </div>
              )}
              {selectedSceneContainer === 'connected-data' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2/3 h-1/2">
                    <ConnectedData 
                      graphData={graphData}
                      currentSubstory={currentSubstory}
                      filteredGraphData={filteredGraphData}
                      onSectionClick={handleSectionClick}
                    />
                  </div>
                </div>
              )}
            </>
          ) : viewMode === 'Graph' && (
            <>
              {/* Filter Controls for Graph View */}
              {showFilters && (
                <div className="absolute top-12 right-4 z-20 pointer-events-auto">
                  <div className="bg-[#09090B] border border-[#707070] rounded-sm p-2 shadow-lg">
                    <div className="flex items-center justify-end mb-2">
                      <button
                        onClick={() => {
                          setFilterNodeType(null);
                          setFilterTimeRange({ start: null, end: null });
                          setFilterNeighborCount({ min: null, max: null });
                          setFilterLimit(null);
                        }}
                        className="text-xs text-[#707070] hover:text-[#B4B4B4] transition-colors px-2 py-1"
                      >
                        Clear All
                      </button>
                    </div>

                    {/* Filter Panel */}
                    <div className="mt-2 p-3 bg-[#111111] border border-[#707070] rounded-sm">
                      <div className="grid grid-cols-1 gap-3 min-w-[300px] max-w-[400px]">
                        {/* Node Type Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Node Type</label>
                          <select
                            value={filterNodeType || ''}
                            onChange={(e) => setFilterNodeType(e.target.value || null)}
                            className="w-full bg-[#09090B] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                          >
                            <option value="">All Types</option>
                            {allNodeTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        {/* Time Range Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Time Range</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="date"
                              value={filterTimeRange.start ? filterTimeRange.start.toISOString().split('T')[0] : ''}
                              onChange={(e) => setFilterTimeRange(prev => ({
                                ...prev,
                                start: e.target.value ? new Date(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#09090B] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Start"
                            />
                            <input
                              type="date"
                              value={filterTimeRange.end ? filterTimeRange.end.toISOString().split('T')[0] : ''}
                              onChange={(e) => setFilterTimeRange(prev => ({
                                ...prev,
                                end: e.target.value ? new Date(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#09090B] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="End"
                            />
                          </div>
                        </div>

                        {/* Neighbor Count Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Neighbor Count</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="number"
                              min="0"
                              value={filterNeighborCount.min ?? ''}
                              onChange={(e) => setFilterNeighborCount(prev => ({
                                ...prev,
                                min: e.target.value ? parseInt(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#09090B] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Min"
                            />
                            <input
                              type="number"
                              min="0"
                              value={filterNeighborCount.max ?? ''}
                              onChange={(e) => setFilterNeighborCount(prev => ({
                                ...prev,
                                max: e.target.value ? parseInt(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#09090B] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Max"
                            />
                          </div>
                        </div>

                        {/* Limit Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Limit Results</label>
                          <input
                            type="number"
                            min="1"
                            value={filterLimit ?? ''}
                            onChange={(e) => setFilterLimit(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-[#09090B] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                            placeholder="No limit"
                          />
                        </div>
                      </div>

                      {/* Results Count */}
                      <div className="mt-3 pt-3 border-t border-[#707070] text-xs text-[#707070]">
                        {StringConstants.HOMEPAGE.SHOWING_NODES.replace('{count}', filteredGraphData.nodes.length).replace('{total}', graphData.nodes?.length || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <ThreeGraphVisualization
                ref={graphRef}
                data={filteredGraphData}
                onNodeClick={selectNode}
                onNodeRightClick={handleNodeRightClick}
                onLinkClick={selectEdge}
                loading={loading}
                forceStrength={forceStrength}
                nodeSize={nodeSize}
                labelSize={labelSize}
                edgeLength={edgeLength}
                edgeThickness={edgeThickness}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                zoomAction={zoomAction}
                onZoomComplete={handleZoomComplete}
                is3D={is3D}
                searchTerm={debouncedSearchTerm}
                searchMatches={searchMatches}
                hiddenCategories={hiddenCategories}
                selectionMode={selectionMode}
                onSelectedNodesChange={setSelectedNodes}
                onSelectedEdgesChange={setSelectedEdges}
                graphLayoutMode={graphLayoutMode}
                hierarchyTreeAxis={hierarchyTreeAxis}
                initialCameraPosition={savedGraphCameraPosition}
              />
            </>
          )}

            {viewMode === 'Table' && !selectedSceneContainer && (
              <div className="w-full h-full bg-[#111111] overflow-hidden flex flex-col">
                {/* Header Section */}
                <div className="flex-shrink-0 px-4 pt-12 pb-2">
                  {/* Filter Panel */}
                  {showFilters && (
                    <div className="mb-4 p-3 bg-[#09090B] border border-[#707070] rounded-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* Node Type Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Node Type</label>
                          <select
                            value={filterNodeType || ''}
                            onChange={(e) => setFilterNodeType(e.target.value || null)}
                            className="w-full bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                          >
                            <option value="">All Types</option>
                            {allNodeTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        {/* Time Range Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Time Range</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="date"
                              value={filterTimeRange.start ? filterTimeRange.start.toISOString().split('T')[0] : ''}
                              onChange={(e) => setFilterTimeRange(prev => ({
                                ...prev,
                                start: e.target.value ? new Date(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Start"
                            />
                            <input
                              type="date"
                              value={filterTimeRange.end ? filterTimeRange.end.toISOString().split('T')[0] : ''}
                              onChange={(e) => setFilterTimeRange(prev => ({
                                ...prev,
                                end: e.target.value ? new Date(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="End"
                            />
                          </div>
                        </div>

                        {/* Neighbor Count Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Neighbor Count</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="number"
                              min="0"
                              value={filterNeighborCount.min ?? ''}
                              onChange={(e) => setFilterNeighborCount(prev => ({
                                ...prev,
                                min: e.target.value ? parseInt(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Min"
                            />
                            <input
                              type="number"
                              min="0"
                              value={filterNeighborCount.max ?? ''}
                              onChange={(e) => setFilterNeighborCount(prev => ({
                                ...prev,
                                max: e.target.value ? parseInt(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Max"
                            />
                          </div>
                        </div>

                        {/* Limit Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Limit Results</label>
                          <input
                            type="number"
                            min="1"
                            value={filterLimit ?? ''}
                            onChange={(e) => setFilterLimit(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                            placeholder="No limit"
                          />
                        </div>
                      </div>

                      {/* Clear Filters Button */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => {
                            setFilterNodeType(null);
                            setFilterTimeRange({ start: null, end: null });
                            setFilterNeighborCount({ min: null, max: null });
                            setFilterLimit(null);
                          }}
                          className="text-xs text-[#707070] hover:text-[#B4B4B4] transition-colors"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {/* Virtualized Node Table */}
                <div className="flex-1 min-h-0 px-4">
                  <VirtualizedTable
                    data={processedTableData}
                    columns={[
                      {
                        key: 'name',
                        header: 'Name',
                        width: '30%',
                        minWidth: '150px',
                        render: (node) => node.name || node.id,
                      },
                      {
                        key: 'category',
                        header: 'Category',
                        width: '20%',
                        minWidth: '120px',
                        render: (node) => node.category || node.node_type || '-',
                      },
                      {
                        key: 'id',
                        header: 'ID',
                        width: '25%',
                        minWidth: '150px',
                        render: (node) => (
                          <span className="font-mono text-xs">{node.id}</span>
                        ),
                      },
                      ...(sortBy === 'time' ? [{
                        key: 'date',
                        header: 'Date',
                        width: '15%',
                        minWidth: '120px',
                        render: (node) => (
                          <span className="text-[#707070]">
                            {node.relationship_date || node.date || '-'}
                          </span>
                        ),
                      }] : []),
                      ...(sortBy === 'neighbors' ? [{
                        key: 'neighbors',
                        header: 'Neighbors',
                        width: '10%',
                        minWidth: '80px',
                        render: (node) => (
                          <span className="text-[#707070]">{getNeighborCount(node)}</span>
                        ),
                      }] : []),
                      ...(sortBy === 'hierarchy' ? [{
                        key: 'hierarchy',
                        header: 'Level',
                        width: '10%',
                        minWidth: '80px',
                        render: (node) => (
                          <span className="text-[#707070]">{getHierarchyLevel(node)}</span>
                        ),
                      }] : []),
                    ]}
                    onRowClick={selectNode}
                    selectedRowId={selectedNode?.id}
                    rowHeight={32}
                    headerHeight={40}
                    className="bg-[#111111]"
                  />
                </div>
              </div>
            )}

            {viewMode === 'JSON' && !selectedSceneContainer && (
              <div className="w-full h-full bg-[#111111] overflow-hidden flex flex-col">
                {/* Header Section */}
                <div className="flex-shrink-0 px-4 pt-12 pb-2">
                  {/* Filter Panel */}
                  {showFilters && (
                    <div className="mb-4 p-3 bg-[#09090B] border border-[#707070] rounded-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* Node Type Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Node Type</label>
                          <select
                            value={filterNodeType || ''}
                            onChange={(e) => setFilterNodeType(e.target.value || null)}
                            className="w-full bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                          >
                            <option value="">All Types</option>
                            {allNodeTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        {/* Time Range Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Date Range</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="date"
                              value={filterTimeRange.start || ''}
                              onChange={(e) => setFilterTimeRange(prev => ({
                                ...prev,
                                start: e.target.value || null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                            />
                            <input
                              type="date"
                              value={filterTimeRange.end || ''}
                              onChange={(e) => setFilterTimeRange(prev => ({
                                ...prev,
                                end: e.target.value || null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                            />
                          </div>
                        </div>

                        {/* Neighbor Count Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Connections</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="number"
                              min="0"
                              value={filterNeighborCount.min ?? ''}
                              onChange={(e) => setFilterNeighborCount(prev => ({
                                ...prev,
                                min: e.target.value ? parseInt(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Min"
                            />
                            <input
                              type="number"
                              min="0"
                              value={filterNeighborCount.max ?? ''}
                              onChange={(e) => setFilterNeighborCount(prev => ({
                                ...prev,
                                max: e.target.value ? parseInt(e.target.value) : null
                              }))}
                              className="flex-1 min-w-0 bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                              placeholder="Max"
                            />
                          </div>
                        </div>

                        {/* Limit Filter */}
                        <div className="min-w-0">
                          <label className="block text-xs text-[#707070] mb-1">Limit Results</label>
                          <input
                            type="number"
                            min="1"
                            value={filterLimit ?? ''}
                            onChange={(e) => setFilterLimit(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                            placeholder="No limit"
                          />
                        </div>
                      </div>

                      {/* Clear Filters Button */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => {
                            setFilterNodeType(null);
                            setFilterTimeRange({ start: null, end: null });
                            setFilterNeighborCount({ min: null, max: null });
                            setFilterLimit(null);
                          }}
                          className="text-xs text-[#707070] hover:text-[#B4B4B4] transition-colors"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* JSON Viewer */}
                <div className="flex-1 min-h-0 px-4">
                  <LazyJSONViewer data={{ nodes: processedTableData, links: graphData.links }} maxInitialRender={100} />
                </div>
              </div>
            )}

            {}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {}
              <div className="absolute top-4 left-4 pointer-events-auto">
                <div className="flex rounded-sm border border-[#707070] bg-[#09090B] p-0.5 gap-0.5">
                  <button
                    onClick={() => {
                      // If already in Graph view, toggle layout mode
                      if (viewMode === 'Graph' && !selectedSceneContainer) {
                        // Toggle between tree and force layout
                        const newLayout = graphLayoutMode === 'force' ? 'tree' : 'force';
                        setGraphLayoutMode(newLayout);
                        // Zoom to fit after layout change
                        setTimeout(() => {
                          setZoomAction('fit');
                        }, 100);
                      } else {
                        // Switch to Graph view from other views
                        setViewMode('Graph');
                        setSelectedSceneContainer(null);
                        updateURL({ view: 'Graph', scene: null });
                        // Clear all selections when switching views
                        setSelectedNodes(new Set());
                        setSelectedEdges(new Set());
                        selectNode(null);
                        selectEdge(null);
                      }
                    }}
                    className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                      viewMode === 'Graph' && !selectedSceneContainer
                        ? 'bg-[#1a1a1a] bg-opacity-20'
                        : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                    }`}
                    title={viewMode === 'Graph' && !selectedSceneContainer 
                      ? (graphLayoutMode === 'force' ? 'Graph View - Switch to Tree Layout' : 'Graph View - Switch to Force Layout')
                      : 'Graph View'}
                  >
                    {viewMode === 'Graph' && !selectedSceneContainer ? (
                      graphLayoutMode === 'force' ? (
                        <FaProjectDiagram className="text-[#5C9EFF]" size={14} />
                      ) : (
                        <FaSitemap className="text-[#5C9EFF]" size={14} />
                      )
                    ) : (
                      <FaProjectDiagram className="text-[#B4B4B4]" size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('Table');
                      setSelectedSceneContainer(null);
                      updateURL({ view: 'Table', scene: null });
                      // Clear all selections when switching views
                      setSelectedNodes(new Set());
                      setSelectedEdges(new Set());
                      selectNode(null);
                      selectEdge(null);
                    }}
                    className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                      viewMode === 'Table' && !selectedSceneContainer
                        ? 'bg-[#1a1a1a] bg-opacity-20'
                        : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                    }`}
                    title="Table View"
                  >
                    <FaTable className={viewMode === 'Table' && !selectedSceneContainer ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('JSON');
                      setSelectedSceneContainer(null);
                      updateURL({ view: 'JSON', scene: null });
                      // Clear all selections when switching views
                      setSelectedNodes(new Set());
                      setSelectedEdges(new Set());
                      selectNode(null);
                      selectEdge(null);
                    }}
                    className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                      viewMode === 'JSON' && !selectedSceneContainer
                        ? 'bg-[#1a1a1a] bg-opacity-20'
                        : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                    }`}
                    title="JSON View"
                  >
                    <FaCode className={viewMode === 'JSON' && !selectedSceneContainer ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                  </button>
                </div>
              </div>

              {}
              <div className="absolute top-4 right-4 pointer-events-auto">
                <div className="flex rounded-sm border border-[#707070] bg-[#09090B] p-0.5 gap-0.5">
                  <button
                    onClick={() => {
                      if (showSearch) {
                        setShowSearch(false);
                      } else {
                        setShowSearch(true);
                        setShowFilters(false);
                        setShowSortControls(false);
                      }
                    }}
                    className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                      showSearch
                        ? 'bg-[#1a1a1a] bg-opacity-20'
                        : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                    }`}
                    title="Search"
                  >
                    <FaSearch className={showSearch ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (showFilters) {
                        setShowFilters(false);
                      } else {
                        setShowFilters(true);
                        setShowSearch(false);
                        setShowSortControls(false);
                      }
                    }}
                    className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                      showFilters
                        ? 'bg-[#1a1a1a] bg-opacity-20'
                        : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                    }`}
                    title="Show Filters"
                  >
                    <FaFilter className={showFilters ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (showSortControls) {
                        setShowSortControls(false);
                      } else {
                        setShowSortControls(true);
                        setShowSearch(false);
                        setShowFilters(false);
                      }
                    }}
                    className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                      showSortControls
                        ? 'bg-[#1a1a1a] bg-opacity-20'
                        : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                    }`}
                    title="Sort Options"
                  >
                    <FaSort className={showSortControls ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                  </button>
                  <button
                    onClick={handleAddNode}
                    className="w-5 h-5 rounded-[2px] bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                    title="Add Node"
                  >
                    <FaPlus className="text-[#B4B4B4]" size={14} />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="w-5 h-5 rounded-[2px] bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                    title="Download Data"
                  >
                    <FaDownload className="text-[#B4B4B4]" size={14} />
                  </button>
                </div>
              </div>

              {/* Sort Controls Dropdown */}
              {showSortControls && (
                <div className="absolute top-12 right-4 z-20 pointer-events-auto">
                  <div className="bg-[#09090B] border border-[#707070] rounded-sm p-2 shadow-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#707070]">Sort by:</span>
                      <select
                        value={sortBy || ''}
                        onChange={(e) => {
                          const newSort = e.target.value || null;
                          if (newSort === sortBy) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy(newSort);
                            setSortOrder('asc');
                          }
                        }}
                        className="bg-[#111111] border border-[#707070] rounded-sm px-2 py-1 text-xs text-[#B4B4B4] focus:outline-none focus:border-[#B4B4B4]"
                      >
                        <option value="">None</option>
                        <option value="time">Time</option>
                        <option value="neighbors">Neighbor Count</option>
                        <option value="hierarchy">Hierarchy</option>
                      </select>
                      {sortBy && (
                        <button
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          className="text-xs text-[#5C9EFF] hover:text-[#7BB3FF] transition-colors px-2 py-1"
                          title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                        >
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {}
              {showSearch && (
                <div className="absolute top-10 right-4 pointer-events-auto">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search nodes..."
                      className="h-[24px] text-[12px] px-2 py-1 pr-10 rounded-sm border border-[#707070] bg-[#09090B] text-[#B4B4B4] focus:outline-none focus:border-[#1a1a1a] w-64"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#B4B4B4] hover:text-white transition-colors"
                        title="Clear search"
                      >
                        <FaTimes size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {}
              <div className={`absolute ${showSearch ? 'top-18' : 'top-13'} right-4 pointer-events-auto z-10`}>
                <div className="flex flex-col items-end">
                  {displayCategories.map((category, index) => {
                    const isHidden = hiddenCategories.has(category.name);
                    const borderColor = category.color;
                    const backgroundColor = isHidden ? '#28282D' : getColorAt33Percent(borderColor);
                    const textColor = isHidden ? '#707070' : '#FFFFFF';
                    const secondaryTextColor = isHidden ? '#707070' : '#DBDBDB';
                    const borderStyle = `1px solid ${borderColor}`;
                    
                    const toggleVisibility = (e) => {
                      e.stopPropagation();
                      setHiddenCategories(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(category.name)) {
                          newSet.delete(category.name);
                        } else {
                          newSet.add(category.name);
                        }
                        return newSet;
                      });
                    };

                    if (viewMode === 'Table' || viewMode === 'JSON') return null;

                    return (
                      <div
                        key={index}
                        className="rounded-[5px] h-[20px] text-[12px] font-['Open Sans'] border whitespace-nowrap mb-[4px] pt-[2px] pr-[6px] pb-[2px] pl-2 w-fit hover:cursor-pointer flex items-center gap-2"
                        style={{
                          border: borderStyle,
                          backgroundColor: backgroundColor,
                        }}
                      >
                        <span className="font-semibold" style={{ color: textColor }}>{category.count}</span>
                        <span className="font-normal" style={{ color: secondaryTextColor }}>{category.name}</span>
                        <button
                          onClick={toggleVisibility}
                          className="flex items-center justify-center ml-1 hover:opacity-80 transition-opacity"
                          style={{ color: secondaryTextColor }}
                        >
                          {isHidden ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 1L23 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <path d="M17.94 17.94C16.2306 19.243 14.1491 19.9649 12 20C5 20 1 12 1 12C2.24389 9.68192 3.96914 7.65663 6.06 6.06L17.94 17.94Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              <path d="M9.9 4.24C10.5883 4.0789 11.2931 3.99836 12 4C19 4 23 12 23 12C22.393 13.1356 21.6691 14.2048 20.84 15.19L9.9 4.24Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              <path d="M14.12 14.12C13.8454 14.4148 13.5141 14.6512 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1752 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.481 9.80385 14.1962C9.51897 13.9113 9.29439 13.5719 9.14351 13.1984C8.99262 12.8248 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2218 9.18488 10.8538C9.34884 10.4859 9.58525 10.1546 9.88 9.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              <path d="M12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category Legend & Order Map: only show when MapContainer is displayed */}
              {selectedSceneContainer === 'map' && mapView && (
                <>
                  {/* Icon Button Group Container - Below Category Legend */}
                  <div className={`absolute ${showSearch ? 'top-[340px]' : 'top-[320px]'} right-4 pointer-events-auto z-10`}>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-white text-[14px] font-weight-500 font-archivo pb-0.5">{StringConstants.RIGHT_SIDEBAR.ORDER_MAP_BY}:</span>
                      {/* Dynamically render all node types from Neo4j */}
                      {displayCategories.map((category) => {
                        const bgColor = getColorAt33Percent(category.color);
                        return (
                          <div 
                            key={category.name}
                            onClick={() => handleMapOrderBy(category.name)}
                            className="rounded-[5px] px-1.5 py-0.25 flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: bgColor }}
                          >
                            <div 
                              className="w-1 h-3 rounded"
                              style={{ backgroundColor: category.color }}
                            ></div>
                            <span className="text-white text-[12px] font-weight-500 font-archivo">{category.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {}
              {viewMode === 'Graph' && (
                <div className="absolute bottom-4 left-4 pointer-events-auto">
                  <div className="w-6.5 flex flex-col rounded-sm border border-[#707070] bg-[#09090B] p-0.5 gap-1">
                    <button
                      onClick={() => handleSelectionModeChange('individual')}
                      className={`w-5 h-5 rounded-sm transition-colors flex items-center justify-center ${
                        selectionMode === 'individual'
                          ? 'bg-[#1a1a1a] bg-opacity-20'
                          : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                      }`}
                      title="Individual Select"
                    >
                      <FaMousePointer className={selectionMode === 'individual' ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                    </button>
                    <button
                      onClick={() => handleSelectionModeChange('box')}
                      className={`w-5 h-5 rounded-sm transition-colors flex items-center justify-center ${
                        selectionMode === 'box'
                          ? 'bg-[#1a1a1a] bg-opacity-20'
                          : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                      }`}
                      title="Box Select"
                    >
                      <FaVectorSquare className={selectionMode === 'box' ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                    </button>
                    <button
                      onClick={() => handleSelectionModeChange('lasso')}
                      className={`w-5 h-5 rounded-sm transition-colors flex items-center justify-center ${
                        selectionMode === 'lasso'
                          ? 'bg-[#1a1a1a] bg-opacity-20'
                          : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                      }`}
                      title="Lasso Select"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="14" 
                        height="14" 
                        viewBox="0 0 24 24"
                        className={selectionMode === 'lasso' ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 22a5 5 0 01-2-4"/>
                        <path d="M7 16.93c.96.43 1.96.74 2.99.91"/>
                        <path d="M3.34 14A6.8 6.8 0 012 10c0-4.42 4.48-8 10-8s10 3.58 10 8a7.19 7.19 0 01-.33 2"/>
                        <path d="M5 18a2 2 0 100-4 2 2 0 000 4z"/>
                        <path d="M14.33 22h-.09a.35.35 0 01-.24-.32v-10a.34.34 0 01.33-.34c.08 0 .15.03.21.08l7.34 6a.33.33 0 01-.21.59h-4.49l-2.57 3.85a.35.35 0 01-.28.14v0z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {}
              {viewMode !== 'Table' && (
                <div className="absolute bottom-4 right-4 pointer-events-auto">
                  <div className="w-6.5 flex flex-col rounded-sm border border-[#707070] bg-[#09090B] p-0.5 gap-1">
                    <button
                      onClick={() => setZoomAction('in')}
                      className={`w-5 h-5 rounded-sm transition-colors flex items-center justify-center ${
                        zoomAction === 'in'
                          ? 'bg-[#1a1a1a] bg-opacity-20'
                          : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                      }`}
                      title="Zoom In"
                    >
                      <FaSearchPlus className={zoomAction === 'in' ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                    </button>
                    <button
                      onClick={() => setZoomAction('out')}
                      className={`w-5 h-5 rounded-sm transition-colors flex items-center justify-center ${
                        zoomAction === 'out'
                          ? 'bg-[#1a1a1a] bg-opacity-20'
                          : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                      }`}
                      title="Zoom Out"
                    >
                      <FaSearchMinus className={zoomAction === 'out' ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                    </button>
                    <button
                      onClick={() => setZoomAction('fit')}
                      className={`w-5 h-5 rounded-sm transition-colors flex items-center justify-center ${
                        zoomAction === 'fit'
                          ? 'bg-[#1a1a1a] bg-opacity-20'
                          : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                      }`}
                      title="Zoom to Fit"
                    >
                      <FaExpand className={zoomAction === 'fit' ? 'text-[#5C9EFF]' : 'text-[#B4B4B4]'} size={14} />
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="w-5 h-5 rounded-sm bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                      title="Full Screen"
                    >
                      <FaExpandArrowsAlt className="text-[#B4B4B4]" size={14} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
    </Layout>

    {}
    {showAddNodeModal && (
      <AddNodeModal
        isOpen={showAddNodeModal}
        onClose={() => setShowAddNodeModal(false)}
        onCreate={handleCreateNode}
        existingCategories={existingCategories}
        nodeTypesWithPropertyKeys={nodeTypesWithPropertyKeys}
      />
    )}
    {showAISearchModal && (
      <AISearchModal
        isOpen={showAISearchModal}
        onClose={handleCloseAISearchModal}
        graphData={aiSearchResults}
        searchQuery={aiSearchQuery}
        generatedQuery={aiGeneratedQuery}
      />
    )}

    {/* AI Summary Modal */}
    {showAISummaryModal && (
      <AISummaryModal
        isOpen={showAISummaryModal}
        onClose={handleCloseAISummaryModal}
        query={aiSummaryQuery}
        graphData={graphData}
        onEntityClick={handleSummaryEntityClick}
      />
    )}

    {}
    {aiSearchLoading && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
        <div className="text-white text-center flex flex-col items-center gap-4">
          <Loader size={64} />
        </div>
      </div>
    )}

    {}

    {/* Context Menu */}
    {contextMenu.show && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        node={contextMenu.node}
        onClose={closeContextMenu}
        onDelete={handleDeleteNode}
      />
    )}
  </>
  );
};

export default HomePage;
 