import GraphControls from '../graph/GraphControls';
import GlobalActivity from '../common/GlobalActivity';
import ConnectedData from '../common/ConnectedData';
import NeighborsGraph from '../common/NeighborsGraph';
import { isValidUrl, formatUrl } from '../../utils/urlUtils';
import { useState, useEffect, useMemo, useRef } from 'react';
import { FaChevronUp, FaChevronDown, FaChevronLeft, FaChevronRight, FaChevronCircleUp, FaChevronCircleDown, FaSquare, FaCube, FaCalendar, FaList, FaSitemap, FaGlobe, FaLink, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import StringConstants from '../StringConstants';

const RightSidebar = ({
  selectedNode = null,
  selectedEdge = null,
  forceStrength = 35,
  nodeSize = 50,
  labelSize = 50,
  edgeLength = 50,
  edgeThickness = 50,
  is3D = true,
  on3DToggle = () => {},
  onForceChange = () => {},
  onNodeSizeChange = () => {},
  onLabelSizeChange = () => {},
  onEdgeLengthChange = () => {},
  onEdgeThicknessChange = () => {},
  onCollapseChange = () => {},
  onToggleRightSidebar = () => {},
  onActiveTabChange = () => {},
  mapView: externalMapView = null,
  onMapViewChange = () => {},
  onClusterNodeSelect = () => {},
  onSceneContainerChange = () => {},
  nodeTypesWithPropertyKeys = [],
  onClusterConfigChange = () => {},
  clusterMethod = '',
  clusterProperty = '',
  currentSubstory = null,
  onSectionClick = () => {},
  graphData = { nodes: [], links: [] },
  filteredGraphData = null,
  selectedSection = null,
  connectedDataCache = {},
  connectedDataLoading = false,
  connectedDataError = null,
  onSortConfigChange = () => {},
  sortBy: externalSortBy = null,
  sortOrder: externalSortOrder = 'asc',
  sortNodeCategory: externalSortNodeCategory = '',
  sortNodeProperty: externalSortNodeProperty = '',
  multiSelectSubgraph = null,
  externalActiveTab = 'node-properties',
  selectedNodes = new Set(),
  selectedEdges = new Set(),
  hierarchyTreeAxis: externalHierarchyTreeAxis = { x: false, y: false, z: false },
  onHierarchyTreeAxisChange = () => {}
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState(externalActiveTab);
  
  // Sort By state (sync with external state from HomePage)
  const [sortBy, setSortBy] = useState(externalSortBy);
  const [sortOrder, setSortOrder] = useState(externalSortOrder);
  const [sortNodeCategory, setSortNodeCategory] = useState(externalSortNodeCategory);
  const [sortNodeProperty, setSortNodeProperty] = useState(externalSortNodeProperty);
  
  // Wikidata state for entity images
  const [wikidataInfo, setWikidataInfo] = useState(null);
  const [wikidataImageUrl, setWikidataImageUrl] = useState(null);
  const [wikidataLoading, setWikidataLoading] = useState(false);

  // Sync external sortBy with local state
  useEffect(() => {
    setSortBy(externalSortBy);
  }, [externalSortBy]);

  // Sync external sortOrder with local state
  useEffect(() => {
    setSortOrder(externalSortOrder);
  }, [externalSortOrder]);

  // Sync external sort node category and property
  useEffect(() => {
    setSortNodeCategory(externalSortNodeCategory);
    setSortNodeProperty(externalSortNodeProperty);
  }, [externalSortNodeCategory, externalSortNodeProperty]);

  // Sync external activeTab with local state
  useEffect(() => {
    setActiveTab(externalActiveTab);
  }, [externalActiveTab]);
  
  // Pagination state for multi-select
  const [currentPage, setCurrentPage] = useState(0);
  
  // Create combined array of selected items for pagination
  const selectedItems = useMemo(() => {
    const items = [];
    
    // Safely convert Sets to arrays for iteration
    const nodeIds = selectedNodes instanceof Set ? Array.from(selectedNodes) : [];
    const edgeIds = selectedEdges instanceof Set ? Array.from(selectedEdges) : [];
    
    // Use filteredGraphData if available, otherwise fall back to graphData
    const nodeSource = filteredGraphData?.nodes || graphData?.nodes || [];
    const linkSource = filteredGraphData?.links || graphData?.links || [];
    
    
    // Add selected nodes
    if (nodeSource.length > 0 && nodeIds.length > 0) {
      nodeIds.forEach(nodeId => {
        // Try to find node by id, gid, or string conversion
        const node = nodeSource.find(n => {
          const nId = String(n.id || '');
          const nGid = String(n.gid || '');
          const searchId = String(nodeId);
          return nId === searchId || nGid === searchId;
        });
        if (node) {
          items.push({ type: 'node', data: node });
        }
      });
    }
    
    // Add selected edges
    if (linkSource.length > 0 && edgeIds.length > 0) {
      edgeIds.forEach(edgeId => {
        const edge = linkSource.find(l => {
          // Try multiple ways to match the edge ID
          const sourceId = l.source?.id || l.source || l.sourceId;
          const targetId = l.target?.id || l.target || l.targetId;
          const linkId = String(l.id || `${sourceId}->${targetId}`);
          const altLinkId = `${sourceId}->${targetId}`;
          const searchId = String(edgeId);
          
          return linkId === searchId || altLinkId === searchId || String(l.id) === searchId;
        });
        if (edge) {
          items.push({ type: 'edge', data: edge });
        }
      });
    }
    
    return items;
  }, [selectedNodes, selectedEdges, graphData, filteredGraphData]);
  
  // Reset page when selection changes
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedNodes.size, selectedEdges.size]);
  
  // Check if in multi-select mode
  const isMultiSelect = selectedNodes.size > 0 || selectedEdges.size > 0;
  const currentItem = isMultiSelect && selectedItems.length > 0 ? selectedItems[currentPage] : null;
  
  
  // Pagination handlers
  const totalItems = selectedItems.length > 0 ? selectedItems.length : (selectedNodes.size + selectedEdges.size);
  
  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };
  
  const handleNext = () => {
    setCurrentPage(prev => Math.min(totalItems - 1, prev + 1));
  };
  
  // Scene Layout state
  const [timelineAxis, setTimelineAxis] = useState({ x: false, y: false });
  const [calendarAxis, setCalendarAxis] = useState({ x: false, y: false });
  const [calendarMode, setCalendarMode] = useState({ linear: false, truncated: false });
  const [hierarchyTreeAxis, setHierarchyTreeAxis] = useState(externalHierarchyTreeAxis);
  const [mapView, setMapView] = useState(externalMapView || null); // null, 'flat', 'spherical'
  
  // Sync with external state
  useEffect(() => {
    setHierarchyTreeAxis(externalHierarchyTreeAxis);
  }, [externalHierarchyTreeAxis.x, externalHierarchyTreeAxis.y, externalHierarchyTreeAxis.z]);
  
  const handleHierarchyTreeAxisChange = (newAxis) => {
    setHierarchyTreeAxis(newAxis);
    onHierarchyTreeAxisChange(newAxis);
  };
  const [transformPosition, setTransformPosition] = useState({ value: 0.0, axis: 'y' });
  const [transformRotation, setTransformRotation] = useState({ value: 0.0, axis: 'y' });
  const [transformScale, setTransformScale] = useState({ value: 0.0, axis: 'y' });

  const resetSceneStates = (except) => {
    if (except !== 'timeline') setTimelineAxis({ x: false, y: false });
    if (except !== 'calendar') {
      setCalendarAxis({ x: false, y: false });
      setCalendarMode({ linear: false, truncated: false });
    }
    if (except !== 'hierarchy') handleHierarchyTreeAxisChange({ x: false, y: false, z: false });
    if (except !== 'map') {
      setMapView(null);
      onMapViewChange(null);
    }
    if (except !== 'cluster') onClusterNodeSelect('');
  };

  const handleDefaultLayout = () => {
    setTimelineAxis({ x: false, y: false });
    setCalendarAxis({ x: false, y: false });
    setCalendarMode({ linear: false, truncated: false });
    handleHierarchyTreeAxisChange({ x: false, y: false, z: false });
    setMapView(null);
    onMapViewChange(null);
    onClusterNodeSelect('');
    onSceneContainerChange(null); // show default graph container
  };

  // Sync external mapView with internal state
  useEffect(() => {
    if (externalMapView !== mapView) {
      setMapView(externalMapView);
    }
  }, [externalMapView]);
  
  // Notify parent when mapView changes
  const handleMapViewChange = (newMapView) => {
    onMapViewChange(newMapView);
    setMapView(newMapView);
    onSceneContainerChange('map');
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    onCollapseChange(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    onActiveTabChange(activeTab);
  }, [activeTab, onActiveTabChange]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) {
      return 'TBD';
    }
    const stringValue = Array.isArray(value) ? value.join(', ') : String(value);

    if (stringValue.trim() === '-' || stringValue.trim() === '') {
      return 'TBD';
    }
    return stringValue;
  };

  // Determine which node/edge to display based on mode (single select vs multi-select)
  const displayNode = isMultiSelect ? (currentItem?.type === 'node' ? currentItem.data : null) : selectedNode;
  const displayEdge = isMultiSelect ? (currentItem?.type === 'edge' ? currentItem.data : null) : selectedEdge;
  
  // Get entity name for wikidata lookup
  const entityName = displayNode?.name || displayNode?.['Entity Name'] || displayNode?.entity_name || displayNode?.id || null;
  const isEntityNode = displayNode && (displayNode.node_type?.toLowerCase().includes('entity') || displayNode.type?.toLowerCase().includes('entity'));
  
  // Function to fetch direct image URL from Wikimedia Commons API
  const fetchDirectImageUrl = async (url) => {
    try {
      url = url.replace(/^http:/, 'https:');
      
      if (url.includes('upload.wikimedia.org')) {
        return url;
      }
      
      if (url.includes('commons.wikimedia.org')) {
        let filename = null;
        
        const specialFilePathMatch = url.match(/Special:FilePath\/(.+?)(?:\?|#|$)/);
        if (specialFilePathMatch) {
          try {
            filename = decodeURIComponent(specialFilePathMatch[1]);
          } catch (e) {
            filename = specialFilePathMatch[1].replace(/%20/g, ' ').replace(/%2F/g, '/');
          }
        } else {
          const fileMatch = url.match(/\/wiki\/File:(.+?)(?:\?|#|$)/);
          if (fileMatch) {
            try {
              filename = decodeURIComponent(fileMatch[1]);
            } catch (e) {
              filename = fileMatch[1].replace(/%20/g, ' ').replace(/%2F/g, '/');
            }
          }
        }
        
        if (filename) {
          filename = filename.replace(/%20/g, ' ').replace(/\+/g, ' ').trim();
          const fileTitle = filename.replace(/ /g, '_');
          const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
          
          try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            const pages = data.query?.pages;
            if (pages) {
              const pageId = Object.keys(pages)[0];
              const imageInfo = pages[pageId]?.imageinfo;
              if (imageInfo && imageInfo[0]?.url) {
                return imageInfo[0].url;
              }
            }
          } catch (apiError) {
            console.warn('Wikimedia API call failed:', apiError);
          }
        }
      }
      
      return url;
    } catch (e) {
      console.error('Error converting Wikimedia URL:', e);
      return url;
    }
  };
  
  // Fetch wikidata when displayNode changes (for entity nodes)
  useEffect(() => {
    const fetchWikidata = async () => {
      if (!isEntityNode || !entityName || entityName === 'Unknown') {
        setWikidataInfo(null);
        setWikidataImageUrl(null);
        return;
      }
      
      setWikidataLoading(true);
      
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(
          `${apiBaseUrl}/api/entity/wikidata/${encodeURIComponent(entityName)}`,
          { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        if (response.ok) {
          const result = await response.json();
          if (result.found && result.data) {
            setWikidataInfo(result.data);
            
            // Get image URL from wikidata
            const rawImageUrl = result.data.image_url || result.data.logo_url || null;
            if (rawImageUrl) {
              // Normalize URL
              let normalizedUrl = String(rawImageUrl).trim();
              if (normalizedUrl.startsWith('http://')) {
                normalizedUrl = normalizedUrl.replace(/^http:/, 'https:');
              }
              
              // If it's a Wikimedia Commons URL, convert it
              if (normalizedUrl.includes('commons.wikimedia.org')) {
                const directUrl = await fetchDirectImageUrl(normalizedUrl);
                setWikidataImageUrl(directUrl);
              } else {
                setWikidataImageUrl(normalizedUrl);
              }
            } else {
              setWikidataImageUrl(null);
            }
          } else {
            setWikidataInfo(null);
            setWikidataImageUrl(null);
          }
        }
      } catch (err) {
        console.error('Wikidata fetch error:', err);
        setWikidataInfo(null);
        setWikidataImageUrl(null);
      } finally {
        setWikidataLoading(false);
      }
    };

    fetchWikidata();
  }, [entityName, isEntityNode]);
  
  // Determine which image to display (prioritize wikidata image)
  const displayImageUrl = wikidataImageUrl || displayNode?.IMG_SRC || null;
  
  const filteredNodeProperties = displayNode
    ? Object.entries(displayNode)
        .filter(([key, value]) => (
          !key.startsWith('__') &&
          !['x', 'y', 'z', 'vx', 'vy', 'vz', 'fx', 'fy', 'fz', 'index', 'IMG_SRC', 'highlight'].includes(key) &&
          value !== null &&
          typeof value !== 'function' &&
          (typeof value !== 'object' || Array.isArray(value))
        ))
        .slice(0, 8)
    : [];

  const filteredEdgeProperties = displayEdge
    ? Object.entries(displayEdge._originalData || displayEdge)
        .filter(([key, value]) => (
          !key.startsWith('__') &&
          !['index', 'source', 'target', 'sourceId', 'targetId', '_originalData'].includes(key) &&
          value !== null &&
          typeof value !== 'function' &&
          (typeof value !== 'object' || Array.isArray(value))
        ))
        .sort((a, b) => {
          if (a[0] === 'Section') return -1;
          if (b[0] === 'Section') return 1;
          if (a[0] === 'Year') return -1;
          if (b[0] === 'Year') return 1;
          return a[0].localeCompare(b[0]);
        })
    : [];

  return (
    <div className="bg-[#09090B] flex flex-col h-full w-full sticky bottom-0 pb-2 pt-5 overflow-visible relative">
      {}
      {isCollapsed && isMobile && (
        <div className="lg:hidden px-3 py-1 text-[#B4B4B4] flex flex-col">
          {}
          <div className="text-center mt-4">
            {selectedNode && (
              <h3 className="text-xs font-medium text-[#B4B4B4]">
                {selectedNode.name || selectedNode.id || StringConstants.RIGHT_SIDEBAR.SELECTED_NODE}
              </h3>
            )}

            {selectedEdge && (
              <h3 className="text-xs font-medium text-[#B4B4B4]">
                {`${formatValue(selectedEdge.sourceName || selectedEdge.source)} → ${formatValue(selectedEdge.targetName || selectedEdge.target)}`}
              </h3>
            )}

            {!selectedNode && !selectedEdge && (
              <h3 className="text-xs font-medium text-[#B4B4B4]">
                {StringConstants.RIGHT_SIDEBAR.SELECT_STORY_ELEMENT}
              </h3>
            )}
          </div>
        </div>
      )}

      {}
      {/* Tab Scene Layout */}
      {!isCollapsed && (
        <div className="flex flex-row items-center gap-[2px] px-3 pb-2 w-full">
          <button
            onClick={() => setActiveTab('node-properties')}
            className={`box-border flex flex-row justify-center items-center py-[1px] px-2 h-5 rounded-t-[5px] text-xs leading-[14px] cursor-pointer whitespace-nowrap transition-all duration-200 ${
              activeTab === 'node-properties' 
                ? 'bg-[#09090B] border border-b-0 border-[#ffffff] text-white shadow-[0_-2px_4px_rgba(0,0,0,0.2)]' 
                : 'bg-[#24282F] border border-[#363D46] text-[#B4B4B4] hover:bg-[#2A2A2A] hover:text-white'
            }`}
          >
            {StringConstants.TABS.NODE_PROPERTIES}
          </button>
          <button
            onClick={() => setActiveTab('data-visualization')}
            className={`box-border flex flex-row justify-center items-center py-[1px] px-2 h-5 rounded-t-[5px] text-xs leading-[14px] cursor-pointer whitespace-nowrap transition-all duration-200 ${
              activeTab === 'data-visualization' 
                ? 'bg-[#09090B] border border-b-0 border-[#ffffff] text-white shadow-[0_-2px_4px_rgba(0,0,0,0.2)]' 
                : 'bg-[#24282F] border border-[#363D46] text-[#B4B4B4] hover:bg-[#2A2A2A] hover:text-white'
            }`}
          >
            {StringConstants.TABS.DATA_VISUALIZATION}
          </button>
          <button
            onClick={() => setActiveTab('scene-layout')}
            className={`box-border flex flex-row justify-center items-center py-[1px] px-2 h-5 rounded-t-[5px] text-xs leading-[14px] cursor-pointer whitespace-nowrap transition-all duration-200 ${
              activeTab === 'scene-layout' 
                ? 'bg-[#09090B] border border-b-0 border-[#ffffff] text-white shadow-[0_-2px_4px_rgba(0,0,0,0.2)]' 
                : 'bg-[#24282F] border border-[#363D46] text-[#B4B4B4] hover:bg-[#2A2A2A] hover:text-white'
            }`}
          >
            {StringConstants.TABS.SCENE_LAYOUT}
          </button>
        </div>
      )}

      {}
      {/* Tab Content */}
      <div className={`${isCollapsed ? 'hidden' : 'block'} lg:block lg:px-[12px] flex-1 text-[#B4B4B4] overflow-hidden h-[calc(20vh-45px)] lg:h-auto flex flex-col items-center lg:items-start relative`}>
        {}
        {/* Node Properties Tab */}
        {activeTab === 'node-properties' && (
          <>
        {}
        <div className="lg:hidden w-full flex flex-col h-full">
        
          <div className="flex flex-row h-full">
          {}
          <div className="flex-shrink-0 w-1/3 pr-2 h-full flex items-center">
            {/* Only show image at top for non-entity nodes */}
            {displayNode && !isEntityNode && (
              <div className="p-2 bg-[#09090B] rounded shadow-sm flex justify-center border border-[#707070] w-full">
                <div className="w-24 h-24 bg-gray-800 rounded-full overflow-hidden flex items-center justify-center">
                  {displayNode?.IMG_SRC ? (
                    <img
                      src={displayNode.IMG_SRC}
                      alt={displayNode.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <svg className="w-16 h-16 text-[#B4B4B4]" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            )}

            {displayEdge && (
              <div className="p-2 bg-[#09090B] rounded shadow-sm flex justify-center border border-[#707070] w-full">
                <div className="w-24 h-24 bg-gray-800 rounded-full overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <svg className="w-16 h-16 text-[#B4B4B4]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Details for Mobile (Node or Edge) */}
              {(displayNode || displayEdge) && (
            <div className="flex-1 overflow-y-auto pl-2 flex flex-col min-h-0">
                {/* Item Type Header (for multi-select) */}
                {isMultiSelect && (
                  <div className="mb-2 px-2 py-1 bg-[#1A1A1A] rounded border border-[#404040]">
                    <span className="text-xs font-semibold text-[#B4B4B4] uppercase">
                      {currentItem?.type === 'node' ? '📍 NODE' : '🔗 EDGE'}
                    </span>
                  </div>
                )}
                
                {/* Wikidata Information Section (for Entity Nodes) */}
                {displayNode && isEntityNode && wikidataInfo && (
                  <div className="mb-4 flex flex-col space-y-3 pb-4">
                    <div className="flex flex-row">
                      {/* Left Line */}
                      <div className="w-0.5 bg-[#358EE2] flex-shrink-0 ml-3 mr-3 h-full"></div>
                      
                      {/* Content */}
                      <div className="flex-1 flex flex-col">
                        {/* Entity Name */}
                        <h2 className="text-xl font-bold text-white mb-1">
                          {wikidataInfo.name || entityName}
                        </h2>
                    
                    {/* Alias and Type */}
                    <div className="flex flex-col gap-1 mb-2">
                      {wikidataInfo.alias && (
                        <p className="text-sm text-[#B4B4B4]">
                          Alias: <span className="text-white">{wikidataInfo.alias}</span>
                        </p>
                      )}
                      {wikidataInfo.instance_of_label && (
                        <p className="text-sm text-[#B4B4B4]">
                          {wikidataInfo.sex_or_gender_label ? `${wikidataInfo.sex_or_gender_label} - ` : ''}
                          {wikidataInfo.instance_of_label}
                        </p>
                      )}
                    </div>
                    
                    {/* Image - Displayed after alias/type, before "Listed in" */}
                    {displayImageUrl && (
                      <div className="mb-3 flex justify-start">
                        <div className="w-32 h-32 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
                          {wikidataLoading ? (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <svg className="animate-spin w-8 h-8 text-[#B4B4B4]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          ) : (
                            <img
                              src={displayImageUrl}
                              alt={wikidataInfo.name || entityName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('Image failed to load in RightSidebar:', displayImageUrl);
                                e.target.style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Listed In / Category */}
                    {wikidataInfo.instance_of_label && (
                      <div className="mb-2">
                        <p className="text-xs text-[#7D7D7D] mb-1">Listed in:</p>
                        <div className="inline-block px-1 bg-[#1A1A1A] rounded-[4px]">
                          <div className="text-[12px] text-white p-0.5">{wikidataInfo.instance_of_label}</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Description */}
                    {wikidataInfo.description && (
                      <p className="text-sm text-[#F4F4F5] leading-relaxed mb-3">
                        {wikidataInfo.description}
                      </p>
                    )}
                    
                    {/* Key-Value Pairs */}
                    <div className="flex flex-col space-y-2">
                      {wikidataInfo.country_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Country Label:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.country_label}</span>
                        </div>
                      )}
                      {wikidataInfo.headquarters_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Headquarters Label:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.headquarters_label}</span>
                        </div>
                      )}
                      {wikidataInfo.place_of_birth_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Place of Birth:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.place_of_birth_label}</span>
                        </div>
                      )}
                      {wikidataInfo.founded_by_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Founded By:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.founded_by_label}</span>
                        </div>
                      )}
                      {wikidataInfo.industry_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Industry:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.industry_label}</span>
                        </div>
                      )}
                      {wikidataInfo.end_time && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">End Time:</span>
                          <span className="text-sm text-[#F4F4F5]">
                            {new Date(wikidataInfo.end_time).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {wikidataInfo.award_received_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Awards Received:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.award_received_label}</span>
                        </div>
                      )}
                      {wikidataInfo.occupation_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Occupation:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.occupation_label}</span>
                        </div>
                      )}
                      {wikidataInfo.position_held_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Position:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.position_held_label}</span>
                        </div>
                      )}
                      {wikidataInfo.educated_at_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Education:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.educated_at_label}</span>
                        </div>
                      )}
                      {wikidataInfo.date_birth && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Date of Birth:</span>
                          <span className="text-sm text-[#F4F4F5]">
                            {new Date(wikidataInfo.date_birth).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {wikidataInfo.citizenship_label && (
                        <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                          <span className="text-xs text-[#7D7D7D]">Citizenship:</span>
                          <span className="text-sm text-[#F4F4F5]">{wikidataInfo.citizenship_label}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* URL Links Section */}
                    {(wikidataInfo.wikipedia_url || wikidataInfo.url || wikidataInfo.qid) && (
                      <div className="mt-3 pt-3 border-t border-[#404040]">
                        <p className="text-xs text-[#7D7D7D] mb-2">URL</p>
                        <div className="flex flex-col gap-2">
                          {wikidataInfo.wikipedia_url && (
                            <a
                              href={wikidataInfo.wikipedia_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[sm] text-[#6EA4F4] hover:underline"
                            >
                              Wikipedia Link
                            </a>
                          )}
                          {wikidataInfo.url && (
                            <a
                              href={wikidataInfo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#6EA4F4] hover:underline"
                            >
                              Social Link
                            </a>
                          )}
                          {wikidataInfo.qid && (
                            <a
                              href={`https://www.wikidata.org/wiki/${wikidataInfo.qid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#6EA4F4] hover:underline"
                            >
                              Wikidata Link
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                        </div>
                      </div>
                  </div>
                )}
                
                {/* Node Properties - Only show for non-entity nodes, or for entity nodes when wikidata is not available */}
                {displayNode && (!isEntityNode || (isEntityNode && !wikidataInfo)) && filteredNodeProperties.length > 0 && (
                  <div className="flex flex-col space-y-3">
                    {filteredNodeProperties.map(([key, value], index) => {
                      const isUrlProperty = key.toLowerCase().includes('url') || key.toLowerCase() === 'link' || key.toLowerCase().includes('website') || key.toLowerCase().includes('webpage');
                      return (
                        <div key={index} className="mb-1 flex-shrink-0">
                          <h4 className="text-xs font-semibold text-[#7D7D7D] capitalize mb-1 leading-[14px]">{key}:</h4>
                          {isUrlProperty && isValidUrl(String(value)) ? (
                            <a
                              href={formatUrl(String(value))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#6EA4F4] hover:underline break-words leading-[14px] font-normal"
                            >
                              {formatValue(value)}
                            </a>
                          ) : (
                            <p className="text-sm text-[#F4F4F5] break-words capitalize leading-[14px] font-normal">
                              {formatValue(value)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Edge Properties */}
                {displayEdge && filteredEdgeProperties.length > 0 && (
                  <div className="flex flex-col space-y-3">
                    {filteredEdgeProperties.map(([key, value], index) => {
                      const isUrlProperty = key.toLowerCase().includes('url') || key.toLowerCase() === 'link' || key.toLowerCase().includes('website') || key.toLowerCase().includes('webpage');
                      return (
                        <div key={index} className="mb-1 flex-shrink-0">
                          <h4 className="text-xs font-semibold text-[#7D7D7D] capitalize mb-1 leading-[14px]">{key}:</h4>
                          {isUrlProperty && isValidUrl(String(value)) ? (
                            <a
                              href={formatUrl(String(value))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#6EA4F4] hover:underline break-words leading-[14px] font-normal"
                            >
                              {formatValue(value)}
                            </a>
                          ) : (
                            <p className="text-sm text-[#F4F4F5] break-words capitalize leading-[14px] font-normal">
                              {formatValue(value)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              )}

                        {/* Pagination Controls - Only show in Multi-Select mode with multiple items (Mobile) */}
          {((selectedNodes?.size || 0) + (selectedEdges?.size || 0)) > 1 && (
            <div className="mb-2 flex items-center justify-between px-2 py-1 flex-shrink-0 bg-[#1A1A1A] rounded-md border border-[#404040]">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 0}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                  currentPage === 0
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-white hover:bg-gray-700'
                }`}
              >
                <FaChevronLeft size={10} />
                Prev
              </button>
              <span className="text-xs font-medium text-[#F4F4F5]">
                {currentPage + 1} / {selectedItems.length > 0 ? selectedItems.length : (selectedNodes.size + selectedEdges.size)}
              </span>
              <button
                onClick={handleNext}
                disabled={currentPage === totalItems - 1}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                  currentPage === totalItems - 1
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-white hover:bg-gray-700'
                }`}
              >
                Next
                <FaChevronRight size={10} />
              </button>
            </div>
          )}
          </div>
        </div>

        {}
        <div className="hidden lg:block w-full flex flex-col h-full">
              {/* Show content when there's a selected node, edge, or multi-select items */}
              {((selectedNode || selectedEdge) || isMultiSelect) && (
                <div className="flex flex-col h-full">
                {/* Only show top image for non-entity nodes */}
                {displayNode && !isEntityNode && (
                  <div className="mb-4 p-2 bg-[#09090B] rounded shadow-sm flex justify-center w-full border border-[#707070] flex-shrink-0">
                    <div className="w-20 h-20 bg-gray-800 overflow-hidden flex items-center justify-center">
                      {displayNode?.IMG_SRC ? (
                        <img
                          src={displayNode.IMG_SRC}
                          alt={displayNode.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <svg className="w-14 h-14 text-[#B4B4B4]" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                  
                  {/* Scrollable Content Container for Node Properties Tab */}
                  {activeTab === 'node-properties' && (
                    <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                  {/* Wikidata Information Section (for Entity Nodes) - Desktop */}
                  {displayNode && isEntityNode && wikidataInfo && (
                    <div className="w-full flex-shrink-0 mb-4 py-2 pr-2 bg-[#09090B] rounded-md border border-[#707070]">
                      <div className="flex flex-row">
                        {/* Left Line */}
                        <div className="w-1 rounded-full bg-[#358EE2] flex-shrink-0 mx-2 h-full"></div>
                        
                        {/* Content */}
                        <div className="flex-1 flex flex-col">
                          {/* Entity Name */}
                          <h2 className="text-xl font-bold text-white mb-1">
                            {wikidataInfo.name || entityName}
                          </h2>
                      
                      {/* Alias and Type */}
                      <div className="flex flex-col gap-1 mb-2">
                        {wikidataInfo.alias && (
                          <p className="text-sm text-[#B4B4B4]">
                            Alias: <span className="text-white">{wikidataInfo.alias}</span>
                          </p>
                        )}
                        {wikidataInfo.instance_of_label && (
                          <p className="text-sm text-[#B4B4B4]">
                            {wikidataInfo.sex_or_gender_label ? `${wikidataInfo.sex_or_gender_label} - ` : ''}
                            {wikidataInfo.instance_of_label}
                          </p>
                        )}
                      </div>
                      
                      {/* Image - Displayed after alias/type, before "Listed in" */}
                      {displayImageUrl && (
                        <div className="mb-3 flex justify-start">
                          <div className="w-32 h-32 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
                            {wikidataLoading ? (
                              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <svg className="animate-spin w-8 h-8 text-[#B4B4B4]" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </div>
                            ) : (
                              <img
                                src={displayImageUrl}
                                alt={wikidataInfo.name || entityName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Image failed to load in RightSidebar:', displayImageUrl);
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Listed In / Category */}
                      {wikidataInfo.instance_of_label && (
                        <div className="mb-2">
                          <p className="text-xs text-[#7D7D7D] mb-1">Listed in:</p>
                          <div className="inline-block px-1 bg-[#1A1A1A] rounded-[4px]">
                            <div className="text-[12px] text-white p-0.5">{wikidataInfo.instance_of_label}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Description */}
                      {wikidataInfo.description && (
                        <p className="text-sm text-[#F4F4F5] leading-relaxed mb-3">
                          {wikidataInfo.description}
                        </p>
                      )}
                      
                      {/* Key-Value Pairs */}
                      <div className="flex flex-col space-y-2">
                        {wikidataInfo.country_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Country Label:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.country_label}</span>
                          </div>
                        )}
                        {wikidataInfo.headquarters_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Headquarters Label:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.headquarters_label}</span>
                          </div>
                        )}
                        {wikidataInfo.place_of_birth_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Place of Birth:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.place_of_birth_label}</span>
                          </div>
                        )}
                        {wikidataInfo.founded_by_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Founded By:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.founded_by_label}</span>
                          </div>
                        )}
                        {wikidataInfo.industry_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Industry:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.industry_label}</span>
                          </div>
                        )}
                        {wikidataInfo.end_time && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">End Time:</span>
                            <span className="text-sm text-[#F4F4F5]">
                              {new Date(wikidataInfo.end_time).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {wikidataInfo.award_received_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Awards Received:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.award_received_label}</span>
                          </div>
                        )}
                        {wikidataInfo.occupation_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Occupation:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.occupation_label}</span>
                          </div>
                        )}
                        {wikidataInfo.position_held_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Position:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.position_held_label}</span>
                          </div>
                        )}
                        {wikidataInfo.educated_at_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Education:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.educated_at_label}</span>
                          </div>
                        )}
                        {wikidataInfo.date_birth && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Date of Birth:</span>
                            <span className="text-sm text-[#F4F4F5]">
                              {new Date(wikidataInfo.date_birth).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {wikidataInfo.citizenship_label && (
                          <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                            <span className="text-xs text-[#7D7D7D]">Citizenship:</span>
                            <span className="text-sm text-[#F4F4F5]">{wikidataInfo.citizenship_label}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* URL Links Section */}
                      {(wikidataInfo.wikipedia_url || wikidataInfo.url || wikidataInfo.qid) && (
                        <div className="mt-3 pt-3 ">
                          <p className="text-xs text-[#7D7D7D] mb-2">URL</p>
                          <div className="flex flex-col gap-2">
                            {wikidataInfo.wikipedia_url && (
                              <a
                                href={wikidataInfo.wikipedia_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] text-[#6EA4F4] hover:underline"
                              >
                                Wikipedia Link
                              </a>
                            )}
                            {wikidataInfo.url && (
                              <a
                                href={wikidataInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] text-[#6EA4F4] hover:underline"
                              >
                                Social Link
                              </a>
                            )}
                            {wikidataInfo.qid && (
                              <a
                                href={`https://www.wikidata.org/wiki/${wikidataInfo.qid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] text-[#6EA4F4] hover:underline"
                              >
                                Wikidata Link
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Node Details - Only show for non-entity nodes, or for entity nodes when wikidata is not available */}
                  {displayNode && (!isEntityNode || (isEntityNode && !wikidataInfo)) && filteredNodeProperties.length > 0 && (
                    <div className="w-full flex-shrink-0 mb-4">
                      <div className="flex flex-col space-y-3">
                        {filteredNodeProperties.map(([key, value], index) => {
                          const isUrlProperty = key.toLowerCase().includes('url') || key.toLowerCase() === 'link' || key.toLowerCase().includes('website') || key.toLowerCase().includes('webpage');
                          return (
                            <div key={index} className="mb-1 flex-shrink-0">
                              <h4 className="text-xs font-semibold text-[#7D7D7D] capitalize mb-1 leading-[14px]">{key}:</h4>
                              {isUrlProperty && isValidUrl(String(value)) ? (
                                <a
                                  href={formatUrl(String(value))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#6EA4F4] hover:underline break-words leading-[14px] font-normal"
                                >
                                  {formatValue(value)}
                                </a>
                              ) : (
                                <p className="text-sm text-[#F4F4F5] break-words capitalize leading-[14px] font-normal">
                                  {formatValue(value)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Edge Details */}
                  {displayEdge && filteredEdgeProperties.length > 0 && (
                    <div className="w-full flex-shrink-0 mb-4">
                      <div className="flex flex-col space-y-3">
                        {filteredEdgeProperties.map(([key, value], index) => {
                          const isUrlProperty = key.toLowerCase().includes('url') || key.toLowerCase() === 'link' || key.toLowerCase().includes('website') || key.toLowerCase().includes('webpage');
                          return (
                            <div key={index} className="mb-1 flex-shrink-0">
                              <h4 className="text-xs font-semibold text-[#7D7D7D] capitalize mb-1 leading-[14px]">{key}:</h4>
                              {isUrlProperty && isValidUrl(String(value)) ? (
                                <a
                                  href={formatUrl(String(value))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#6EA4F4] hover:underline break-words leading-[14px] font-normal"
                                >
                                  {formatValue(value)}
                                </a>
                              ) : (
                                <p className="text-sm text-[#F4F4F5] break-words capitalize leading-[14px] font-normal">
                                  {formatValue(value)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pagination Controls - Only show in Multi-Select mode with multiple items */}
                  {((selectedNodes?.size || 0) + (selectedEdges?.size || 0)) > 1 && (
                    <div className="mb-3 flex items-center justify-center gap-3 px-2 py-1 flex-shrink-0 rounded-md">
                      <button
                        onClick={handlePrevious}
                        disabled={currentPage === 0}
                        className={`p-1 rounded transition-colors ${
                          currentPage === 0
                            ? 'text-gray-600 cursor-not-allowed'
                            : 'text-white hover:bg-[#333333]'
                        }`}
                      >
                        <FaChevronLeft size={12} />
                      </button>
                      <span className="text-sm font-medium text-[#F4F4F5]">
                        {currentPage + 1} / {selectedItems.length > 0 ? selectedItems.length : (selectedNodes.size + selectedEdges.size)}
                      </span>
                      <button
                        onClick={handleNext}
                        disabled={currentPage === totalItems - 1}
                        className={`p-1 rounded transition-colors ${
                          currentPage === totalItems - 1
                            ? 'text-gray-600 cursor-not-allowed'
                            : 'text-white hover:bg-[#333333]'
                        }`}
                      >
                        <FaChevronRight size={12} />
                      </button>
                    </div>
                  )}

                  {/* Neighbors Graph - Show in BOTH individual and multi-select modes */}
                  {/* This is a separate subgraph visualization in the sidebar, independent from the main THREE.js view */}
                  {/* The deep copy mechanism ensures the main THREE.js graph is not affected */}
                  {(() => {
                    // PRIORITY 1: If displayNode exists (either from individual mode or multi-select pagination),
                    // show the neighbors of that specific node
                    if (displayNode) {
                      return (
                        <div className="w-full flex-1 min-h-0 mt-4 mb-1 flex-auto overflow-hidden">
                          <NeighborsGraph 
                            selectedNode={displayNode} 
                            graphData={graphData}
                            isSubgraph={false}
                          />
                        </div>
                      );
                    }
                    
                    // PRIORITY 2: In MULTI-SELECT mode without a specific displayNode,
                    // show subgraph of all selected nodes and their connections
                    if (isMultiSelect && (selectedNodes.size > 0 || selectedEdges.size > 0)) {
                      // If multiSelectSubgraph is provided, use it
                      if (multiSelectSubgraph && multiSelectSubgraph.nodes && multiSelectSubgraph.nodes.length > 0) {
                        return (
                          <div className="w-full flex-1 min-h-0 mt-4 mb-1 flex-auto overflow-hidden">
                            <NeighborsGraph 
                              selectedNode={null}
                              graphData={multiSelectSubgraph}
                              isSubgraph={true}
                            />
                          </div>
                        );
                      }
                      
                      // Otherwise, compute subgraph from selectedNodes and selectedEdges
                      const selectedNodesList = Array.from(selectedNodes);
                      const selectedEdgesList = Array.from(selectedEdges);
                      
                      // Get nodes for selected edges
                      const edgeNodeIds = new Set();
                      selectedEdgesList.forEach(edgeId => {
                        const edge = graphData.links?.find(l => 
                          (l.id === edgeId) || 
                          (l.source?.id === edgeId) || 
                          (String(l.source?.id || l.source || l.sourceId) + '-' + String(l.target?.id || l.target || l.targetId) === edgeId)
                        );
                        if (edge) {
                          const sourceId = edge.source?.id || edge.sourceId || edge.source;
                          const targetId = edge.target?.id || edge.targetId || edge.target;
                          edgeNodeIds.add(sourceId);
                          edgeNodeIds.add(targetId);
                        }
                      });
                      
                      // Combine selected nodes with nodes from selected edges
                      const allNodeIds = new Set([...selectedNodesList, ...Array.from(edgeNodeIds)]);
                      
                      // Get actual node objects
                      const subgraphNodes = graphData.nodes?.filter(n => allNodeIds.has(n.id || n.gid)) || [];
                      
                      // Get links between these nodes
                      const subgraphLinks = graphData.links?.filter(link => {
                        const sourceId = link.source?.id || link.sourceId || link.source;
                        const targetId = link.target?.id || link.targetId || link.target;
                        return allNodeIds.has(sourceId) && allNodeIds.has(targetId);
                      }) || [];
                      
                      const computedSubgraph = {
                        nodes: subgraphNodes,
                        links: subgraphLinks
                      };
                      
                      if (computedSubgraph.nodes.length > 0) {
                        return (
                          <div className="w-full flex-1 min-h-0 mt-4 mb-1 flex-auto overflow-hidden">
                            <NeighborsGraph 
                              selectedNode={null}
                              graphData={computedSubgraph}
                              isSubgraph={true}
                            />
                          </div>
                        );
                      }
                    }
                    
                    return null;
                  })()}
                </div>
          )}

              {}
          {displayEdge && (
                <div className="mb-4 p-2 bg-[#09090B] rounded shadow-sm flex justify-center w-full border border-[#707070]">
                  <div className="w-20 h-20 bg-gray-800 rounded-full overflow-hidden flex items-center justify-center">
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <svg className="w-14 h-14 text-[#B4B4B4]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
              </div>
                  </div>
            </div>
          )}

                    </div>
                  )}
        </div>
          </>
        )}

        {/* Data Visualization Tab */}
        {activeTab === 'data-visualization' && (
          <div className="w-full h-full flex flex-col overflow-y-auto overflow-x-hidden">
            <div className="w-full flex-shrink-0 min-h-[300px] max-h-[300px]">
              <GlobalActivity graphData={graphData} currentSubstory={currentSubstory} selectedSection={selectedSection} />
            </div>
            <div className="w-full flex-shrink-0 mt-0 mb-1 aspect-square min-h-full">
              <ConnectedData 
                onSectionClick={onSectionClick} 
                graphData={graphData} 
                filteredGraphData={filteredGraphData} 
                currentSubstory={currentSubstory}
                connectedDataCache={connectedDataCache}
                connectedDataLoading={connectedDataLoading}
                connectedDataError={connectedDataError}
              />
            </div>
          </div>
        )}

        {/* Scene Layout Tab */}
        {activeTab === 'scene-layout' && (
          <div className="w-full h-full overflow-hidden">
            <div className={`${isCollapsed ? 'hidden' : 'block'} hidden lg:block`}>
              {/* Force Layout Section - Already implemented via GraphControls */}
              <div className='bg-[#0E0E0E] border border-[#202020] rounded-[5px] pb-[2px]'>
                <h3 className="text-sm text-center font-semibold text-[#B4B4B4] my-[16px]">Force Layout</h3>
              
                {/* 2D/3D Toggle Buttons */}
                <div className="mb-3 ml-[15px]">
                  <div className="inline-flex gap-1 justify-start">
          <button
            onClick={() => on3DToggle(false)}
                      className={`rounded-[5px] border-[#404040] border-[1px] px-[3px] py-[1px] transition-colors flex items-center justify-center text-[13px] ${
              !is3D
                ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                : 'bg-[#09090B] text-[#707070] border-r border-[#707070]'
            }`}
            title="2D View"
          >
                      2D
          </button>
          <button
            onClick={() => on3DToggle(true)}
                      className={`rounded-[5px] ml-[4px] border-[#404040] border-[1px] px-[3px] py-[1px] transition-colors flex items-center justify-center text-[13px] ${
              is3D
                ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                : 'bg-[#09090B] text-[#707070] border-r border-[#707070]'
            }`}
            title="3D View"
          >
                      3D
          </button>
        </div>
      </div>

            <GraphControls
              onForceChange={onForceChange}
              onNodeSizeChange={onNodeSizeChange}
              onLabelSizeChange={onLabelSizeChange}
              onEdgeLengthChange={onEdgeLengthChange}
              onEdgeThicknessChange={onEdgeThicknessChange}
              initialForceStrength={forceStrength}
              initialNodeSize={nodeSize}
              initialLabelSize={labelSize}
              initialEdgeLength={edgeLength}
              initialEdgeThickness={edgeThickness}
              compact={true}
              mobile={isMobile}
            />
            </div>
              <div className='bg-[#0E0E0E] border border-[#202020] rounded-[5px] my-[8px] px-[8px] pb-[2px]'>
              {/* Layout Style Section */}
                <div className="p-2">
                  <h3 className="text-sm text-center font-semibold text-[#ffffff] mb-2 my-[8px]">Layout Style</h3>
                  <button
                    className="w-full px-1 py-1 mt-[8px] rounded-[50px] bg-[#24282F] text-white text-xs border border-[#5C5C5C] hover:bg-[#2A2A2A] transition-colors"
                    onClick={handleDefaultLayout}
                  >
                    {StringConstants.RIGHT_SIDEBAR.DEFAULT} Layout
                  </button>
                </div>

                {/* Sort By Section */}
                <div className="p-2">
                  <h3 className="text-[13px] font-semibold text-[#ffffff] mb-[4px]">{StringConstants.RIGHT_SIDEBAR.SORT_BY}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (sortBy === 'time') {
                          // Toggle sort order if same button is clicked
                          const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                          setSortOrder(newSortOrder);
                          onSortConfigChange('time', sortNodeCategory, sortNodeProperty, newSortOrder);
                        } else {
                          // Set new sort type with default 'asc' order
                          setSortBy('time');
                          setSortOrder('asc');
                          onSortConfigChange('time', sortNodeCategory, sortNodeProperty, 'asc');
                        }
                      }}
                      className={`px-3 py-0.5 h-[20px] rounded-full flex items-center justify-center gap-1 text-[10px] transition-colors whitespace-nowrap ${
                        sortBy === 'time'
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                    >
                      {StringConstants.SORT.TIME}
                      {sortBy === 'time' && (
                        sortOrder === 'asc' ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === 'neighbors') {
                          // Toggle sort order if same button is clicked
                          const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                          setSortOrder(newSortOrder);
                          onSortConfigChange('neighbors', sortNodeCategory, sortNodeProperty, newSortOrder);
                        } else {
                          // Set new sort type with default 'asc' order
                          setSortBy('neighbors');
                          setSortOrder('asc');
                          onSortConfigChange('neighbors', sortNodeCategory, sortNodeProperty, 'asc');
                        }
                      }}
                      className={`px-3 py-0.5 h-[20px] rounded-full flex items-center justify-center gap-1 text-[10px] transition-colors whitespace-nowrap ${
                        sortBy === 'neighbors'
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                    >
                      {StringConstants.SORT.COUNTING_NEIGHBORS}
                      {sortBy === 'neighbors' && (
                        sortOrder === 'asc' ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === 'hierarchy') {
                          // Toggle sort order if same button is clicked
                          const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                          setSortOrder(newSortOrder);
                          onSortConfigChange('hierarchy', sortNodeCategory, sortNodeProperty, newSortOrder);
                        } else {
                          // Set new sort type with default 'asc' order
                          setSortBy('hierarchy');
                          setSortOrder('asc');
                          onSortConfigChange('hierarchy', sortNodeCategory, sortNodeProperty, 'asc');
                        }
                      }}
                      className={`px-3 py-0.5 h-[20px] rounded-full flex items-center justify-center gap-1 text-[10px] transition-colors whitespace-nowrap ${
                        sortBy === 'hierarchy'
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                    >
                      {StringConstants.SORT.HIERARCHY}
                      {sortBy === 'hierarchy' && (
                        sortOrder === 'asc' ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Node Selection Section */}
                <div className="p-2">
                  <div className="space-y-2">
                    <select
                      value={sortNodeCategory}
                      onChange={(e) => {
                        const category = e.target.value;
                        setSortNodeCategory(category);
                        // Update sort config when category changes
                        onSortConfigChange(sortBy, category, sortNodeProperty, sortOrder);
                      }}
                      className="w-full px-3 py-1 rounded-md bg-[#1F1F1F] text-[#F4F4F5] text-[11px] border border-[#424242] hover:bg-[#2A2A2A] transition-colors"
                    >
                      <option value="">Select A Node Category</option>
                      {[
                        'Action',
                        'Agency',
                        'Amount',
                        'Chapter',
                        'Country',
                        'Description',
                        'Entity',
                        'Location',
                        'Place Of Performance',
                        'Process',
                        'Purpose',
                        'Recipient',
                        'Region',
                        'Relationship',
                        'Result',
                        'Section',
                        'Story',
                        'Sub Agency',
                        'Transaction',
                      ].map((label) => (
                        <option key={label} value={label.toLowerCase().replace(/\s+/g, '_')}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sortNodeProperty}
                      onChange={(e) => {
                        const property = e.target.value;
                        setSortNodeProperty(property);
                        // Update sort config when property changes
                        onSortConfigChange(sortBy, sortNodeCategory, property, sortOrder);
                      }}
                      className="w-full px-3 py-1 rounded-md bg-[#1F1F1F] text-[#F4F4F5] text-[11px] border border-[#424242] hover:bg-[#2A2A2A] transition-colors"
                    >
                      <option value="">Select A Node Property</option>
                      {(() => {
                        // Get all unique properties from the connected Neo4j DB
                        if (!nodeTypesWithPropertyKeys || nodeTypesWithPropertyKeys.length === 0) {
                          return null;
                        }
                        
                        // Collect all unique property keys across all node types
                        const allPropertyKeys = new Set();
                        
                        nodeTypesWithPropertyKeys.forEach(item => {
                          const properties = Array.isArray(item.propertyKeys) ? item.propertyKeys : [];
                          properties.forEach(prop => {
                            if (prop && typeof prop === 'string') {
                              allPropertyKeys.add(prop);
                            }
                          });
                        });
                        
                        // Convert to sorted array
                        const sortedProperties = Array.from(allPropertyKeys).sort((a, b) => 
                          a.toLowerCase().localeCompare(b.toLowerCase())
                        );
                        
                        return sortedProperties.map((prop) => (
                          <option key={prop} value={prop}>
                            {prop}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                {/* Calendar Section */}
                <div className="p-2">
                  <h3 className="text-[13px] font-semibold text-[#ffffff] mb-[4px] flex items-center gap-2">
                    <span>{StringConstants.RIGHT_SIDEBAR.CALENDAR}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 1.875C0 0.839466 0.726025 0 1.62162 0V12C0.726025 12 0 11.1605 0 10.125V1.875Z" fill="#9F9FA9"/>
                      <path d="M3.40541 1.875C2.95761 1.875 2.59459 1.45527 2.59459 0.9375C2.59459 0.419733 2.95761 4.16035e-07 3.40541 3.93402e-07L11.1892 0C11.637 -2.26323e-08 12 0.419733 12 0.9375C12 1.45527 11.637 1.875 11.1892 1.875L3.40541 1.875Z" fill="#9F9FA9"/>
                      <path d="M3.40541 5.25C2.95761 5.25 2.59459 4.83027 2.59459 4.3125C2.59459 3.79473 2.95761 3.375 3.40541 3.375L11.1892 3.375C11.637 3.375 12 3.79473 12 4.3125C12 4.83027 11.637 5.25 11.1892 5.25L3.40541 5.25Z" fill="#9F9FA9"/>
                      <path d="M3.40541 8.625C2.95761 8.625 2.59459 8.20527 2.59459 7.6875C2.59459 7.16973 2.95761 6.75 3.40541 6.75L11.1892 6.75C11.637 6.75 12 7.16973 12 7.6875C12 8.20527 11.637 8.625 11.1892 8.625L3.40541 8.625Z" fill="#9F9FA9"/>
                      <path d="M3.40541 12C2.95761 12 2.59459 11.5803 2.59459 11.0625C2.59459 10.5447 2.95761 10.125 3.40541 10.125L11.1892 10.125C11.637 10.125 12 10.5447 12 11.0625C12 11.5803 11.637 12 11.1892 12L3.40541 12Z" fill="#9F9FA9"/>
                    </svg>
                  </h3>
                  <div className="space-y-2">
                    <div className="flex gap-3 items-center">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={calendarAxis.x}
                          onChange={() => {
                            setCalendarAxis({ ...calendarAxis, x: !calendarAxis.x });
                            onSceneContainerChange('calendar');
                          }}
                          className="w-3.5 h-3.5 rounded border border-[#363D46] bg-[#24282F] checked:bg-[#3A3A3A] checked:border-[#707070]"
                        />
                        <span className="text-xs text-[#ffffff]">X</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={calendarAxis.y}
                          onChange={() => {
                            setCalendarAxis({ ...calendarAxis, y: !calendarAxis.y });
                            onSceneContainerChange('calendar');
                          }}
                          className="w-3.5 h-3.5 rounded border border-[#363D46] bg-[#24282F] checked:bg-[#3A3A3A] checked:border-[#707070]"
                        />
                        <span className="text-xs text-[#ffffff]">Y</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          resetSceneStates('calendar');
                          setCalendarMode({ linear: !calendarMode.linear, truncated: false });
                          onSceneContainerChange('calendar');
                        }}
                        className={`px-3 py-0.5 rounded-[20px] text-[10px] lowercase transition-colors ${
                          calendarMode.linear
                            ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                            : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                        }`}
                      >
                        {StringConstants.CALENDAR_MODES.LINEAR.toLowerCase()}
                      </button>
                      <button
                        onClick={() => {
                          resetSceneStates('calendar');
                          setCalendarMode({ linear: false, truncated: !calendarMode.truncated });
                          onSceneContainerChange('calendar');
                        }}
                        className={`px-3 py-0.5 rounded-[20px] text-[10px] lowercase transition-colors ${
                          calendarMode.truncated
                            ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                            : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                        }`}
                      >
                        {StringConstants.CALENDAR_MODES.TRUNCATED.toLowerCase()}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hierarchy Tree Section */}
                <div className="p-2">
                  <h3 className="text-[13px] font-semibold text-[#ffffff] mb-[4px] flex items-center gap-2">
                    <span>{StringConstants.RIGHT_SIDEBAR.HIERARCHY_TREE}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 0C6.73627 3.21834e-08 7.33283 0.596778 7.33301 1.33301C7.33301 1.67051 7.20675 1.97801 7 2.21289V4.8457C9.59015 5.01624 11.6402 7.15772 11.665 9.78516C11.8728 10.0203 12 10.3286 12 10.667C11.9998 11.4031 11.4031 11.9998 10.667 12C9.93072 12 9.33318 11.4032 9.33301 10.667C9.33301 10.3299 9.45871 10.0219 9.66504 9.78711C9.64202 8.26384 8.48499 7.01572 7 6.85156V9.78613C7.20704 10.0211 7.33301 10.3292 7.33301 10.667C7.33283 11.4032 6.73627 12 6 12C5.26373 12 4.66717 11.4032 4.66699 10.667C4.66699 10.3292 4.79296 10.0211 5 9.78613V6.85156C3.51485 7.0159 2.35749 8.26448 2.33496 9.78809C2.541 10.0228 2.66699 10.3301 2.66699 10.667C2.66682 11.4032 2.06928 12 1.33301 12C0.596886 11.9998 0.000176049 11.4031 0 10.667C1.48043e-08 10.3283 0.12692 10.0194 0.334961 9.78418C0.360265 7.1573 2.41032 5.01637 5 4.8457V2.21289C4.79325 1.97801 4.66699 1.67051 4.66699 1.33301C4.66717 0.596778 5.26373 3.22331e-08 6 0Z" fill="#9F9FA9"/>
                    </svg>
                  </h3>
                  <div className="flex gap-3 items-center">
                    <button
                      onClick={() => {
                        resetSceneStates('hierarchy');
                        handleHierarchyTreeAxisChange({ ...hierarchyTreeAxis, x: !hierarchyTreeAxis.x });
                      }}
                      className={`w-[22px] h-[20px] rounded-[20px] flex items-center justify-center text-xs transition-colors ${
                        hierarchyTreeAxis.x
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                      title={StringConstants.RIGHT_SIDEBAR.X_AXIS}
                    >
                      x
                    </button>
                    <button
                      onClick={() => {
                        resetSceneStates('hierarchy');
                        handleHierarchyTreeAxisChange({ ...hierarchyTreeAxis, y: !hierarchyTreeAxis.y });
                      }}
                      className={`w-[22px] h-[20px] rounded-[20px] flex items-center justify-center text-xs transition-colors ${
                        hierarchyTreeAxis.y
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                      title={StringConstants.RIGHT_SIDEBAR.Y_AXIS}
                    >
                      y
                    </button>
                    <button
                      onClick={() => {
                        resetSceneStates('hierarchy');
                        handleHierarchyTreeAxisChange({ ...hierarchyTreeAxis, z: !hierarchyTreeAxis.z });
                      }}
                      className={`w-[22px] h-[20px] rounded-[20px] flex items-center justify-center text-xs transition-colors ${
                        hierarchyTreeAxis.z
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                      title={StringConstants.RIGHT_SIDEBAR.Z_AXIS}
                    >
                      z
                    </button>
                  </div>
                </div>

                {/* Map View Section */}
                <div className="p-2">
                  <h3 className="text-[13px] font-semibold text-[#ffffff] mb-[4px] flex items-center gap-2">
                    <span>{StringConstants.RIGHT_SIDEBAR.MAP_VIEW}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_236_3620)">
                    <path d="M6 0C4.81331 0 3.65328 0.351894 2.66658 1.01118C1.67989 1.67047 0.910851 2.60754 0.456726 3.7039C0.00259972 4.80026 -0.11622 6.00666 0.115291 7.17054C0.346802 8.33443 0.918247 9.40353 1.75736 10.2426C2.59648 11.0818 3.66558 11.6532 4.82946 11.8847C5.99335 12.1162 7.19975 11.9974 8.2961 11.5433C9.39246 11.0892 10.3295 10.3201 10.9888 9.33342C11.6481 8.34673 12 7.18669 12 6C11.9983 4.40923 11.3656 2.88411 10.2407 1.75926C9.1159 0.634414 7.59077 0.00172054 6 0V0ZM6.25 10.4875V9.845C6.25 9.28937 6.02928 8.7565 5.63639 8.36361C5.2435 7.97072 4.71063 7.75 4.155 7.75H4.15C3.94357 7.75001 3.73915 7.70934 3.54844 7.63033C3.35772 7.55132 3.18445 7.4355 3.0385 7.2895L1.512 5.762C1.55278 4.96767 1.80371 4.19841 2.23915 3.53282C2.67459 2.86724 3.27892 2.32918 3.99041 1.97364C4.70189 1.6181 5.49501 1.45783 6.28872 1.50919C7.08243 1.56056 7.84828 1.82172 8.508 2.266C8.3756 2.36316 8.21573 2.4157 8.0515 2.416H7.3345C7.23227 2.416 7.13105 2.43616 7.03662 2.47533C6.94219 2.51449 6.85641 2.5719 6.7842 2.64425C6.71198 2.71661 6.65474 2.8025 6.61576 2.897C6.57677 2.99151 6.55681 3.09277 6.557 3.195V3.716C6.557 3.92221 6.47509 4.11997 6.32928 4.26578C6.18347 4.41159 5.98571 4.4935 5.7795 4.4935V4.4935C5.67723 4.49324 5.57591 4.51315 5.48135 4.55211C5.38679 4.59106 5.30084 4.64829 5.22843 4.72052C5.15602 4.79274 5.09858 4.87854 5.05938 4.973C5.02018 5.06746 5 5.16873 5 5.271V5.792C5 5.99821 5.08192 6.19597 5.22773 6.34178C5.37354 6.48759 5.5713 6.5695 5.7775 6.5695H7.8555C8.06171 6.5695 8.25947 6.65142 8.40528 6.79723C8.55109 6.94303 8.633 7.1408 8.633 7.347V8.107C8.63301 8.20916 8.65315 8.31032 8.69227 8.40469C8.73139 8.49906 8.78873 8.5848 8.861 8.657L9.2775 9.0735C8.48833 9.91745 7.40371 10.424 6.25 10.4875Z" fill="#9F9FA9"/>
                    </g>
                    <defs>
                    <clipPath id="clip0_236_3620">
                    <rect width="12" height="12" fill="white"/>
                    </clipPath>
                    </defs>
                    </svg>
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <button
                    onClick={() => {
                      resetSceneStates('map');
                      handleMapViewChange('flat');
                    }}
                      className={`px-3 py-0.5 rounded-[20px] text-[10px] transition-colors ${
                        mapView === 'flat'
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                    >
                      {StringConstants.MAP_VIEWS.FLAT}
                    </button>
                    <button
                    onClick={() => {
                      resetSceneStates('map');
                      handleMapViewChange('spherical');
                    }}
                      className={`px-3 py-0.5 rounded-[20px] text-[10px] transition-colors ${
                        mapView === 'spherical'
                          ? 'bg-[#3A3A3A] text-white border border-[#707070]'
                          : 'bg-[#24282F] text-[#ffffff] border border-[#363D46] hover:bg-[#2A2A2A]'
                      }`}
                    >
                      {StringConstants.MAP_VIEWS.SPHERICAL}
                    </button>
                  </div>
                </div>

                {/* Cluster Nodes Section */}
                <div className="p-2 mb-[8px]">
                  <h3 className="text-sm font-semibold text-[#ffffff] mb-[4px] flex items-center gap-2">
                    {StringConstants.RIGHT_SIDEBAR.CLUSTER_NODES}
                    <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.95215 0C6.85407 0 8.50428 1.03998 9.33398 2.56445C11.4453 3.11347 13 4.98055 13 7.2002C12.9999 9.851 10.7828 11.9999 8.04785 12C6.14544 12 4.49453 10.9597 3.66504 9.43457C1.55428 8.88517 0 7.01905 0 4.7998C0.000109006 2.149 2.2172 0.000121884 4.95215 0ZM9.8877 4.42383C9.89763 4.54794 9.90429 4.67322 9.9043 4.7998C9.9043 7.21848 8.05895 9.2187 5.6582 9.55078C6.27286 10.1377 7.11681 10.5 8.04785 10.5C9.92808 10.4999 11.452 9.02257 11.4521 7.2002C11.4521 6.03483 10.8287 5.01098 9.8877 4.42383ZM8.04785 3.90039C6.16745 3.90039 4.64258 5.37766 4.64258 7.2002C4.6426 7.51032 4.68797 7.81017 4.77051 8.09473C4.83067 8.0978 4.8912 8.09961 4.95215 8.09961C6.83255 8.09961 8.35742 6.62234 8.35742 4.7998C8.3574 4.48926 8.31127 4.1892 8.22852 3.9043C8.16869 3.90126 8.10845 3.90039 8.04785 3.90039ZM4.95215 1.5C3.07192 1.50012 1.54796 2.97743 1.54785 4.7998C1.54785 5.9647 2.17091 6.98793 3.11133 7.5752C3.10145 7.45142 3.09571 7.32642 3.0957 7.2002C3.0957 4.7818 4.94048 2.78067 7.34082 2.44824C6.72624 1.86184 5.88269 1.5 4.95215 1.5Z" fill="#9F9FA9"/>
                    </svg>
                  </h3>
                  <div className="space-y-1">
                    <select
                      value={clusterMethod}
                      className="w-full px-3 py-0.5 rounded-md bg-[#1F1F1F] text-[#F4F4F5] text-[13px] border border-[#424242] hover:bg-[#2A2A2A] transition-colors"
                      onChange={(e) => {
                        const method = e.target.value;
                        resetSceneStates('cluster');
                        onClusterNodeSelect(method);
                        // Reset property when category changes - user must reselect property
                        onClusterConfigChange(method, '');
                        onSceneContainerChange(method ? 'cluster' : null);
                      }}
                    >
                      <option value="">Select A Node Category</option>
                      {(() => {
                        // Get unique node types from the connected Neo4j DB
                        if (!nodeTypesWithPropertyKeys || nodeTypesWithPropertyKeys.length === 0) {
                          return null;
                        }

                        // Extract unique node types and convert to display format
                        const nodeTypes = Array.from(
                          new Set(
                            nodeTypesWithPropertyKeys
                              .map(item => item.nodeType)
                              .filter(type => type && typeof type === 'string')
                          )
                        ).sort((a, b) => a.localeCompare(b));

                        // Helper function to convert 'entity_gen' to 'Entity Gen'
                        const toDisplayName = (nodeType) => {
                          return nodeType
                            .split('_')
                            .map(word => word)
                            .join(' ');
                        };

                        return nodeTypes.map((nodeType) => (
                          <option key={nodeType} value={nodeType}>
                            {toDisplayName(nodeType)}
                          </option>
                        ));
                      })()}
                    </select>
                    <select 
                      value={clusterProperty}
                      className="w-full px-3 py-0.5 rounded-md bg-[#1F1F1F] text-[#F4F4F5] text-xs border border-[#424242] hover:bg-[#2A2A2A] transition-colors"
                      onChange={(e) => {
                        const property = e.target.value;
                        onClusterConfigChange(clusterMethod, property);
                        if (property || clusterMethod) {
                          onSceneContainerChange('cluster');
                        }
                      }}
                    >
                      <option value="">Select A Node Property</option>
                      {(() => {
                        // Get properties from the connected Neo4j DB (via HomePage `nodeTypesWithPropertyKeys`)
                        if (!clusterMethod || !nodeTypesWithPropertyKeys || nodeTypesWithPropertyKeys.length === 0) {
                          return null;
                        }
                        
                        // Find the node type that matches the cluster method
                        const normalizedMethod = clusterMethod.toLowerCase().replace(/_/g, ' ');
                        const nodeTypeData = nodeTypesWithPropertyKeys.find(item => {
                          const nodeType = item.nodeType || '';
                          const normalizedNodeType = nodeType.toLowerCase().replace(/[`:]/g, '').trim();
                          return normalizedNodeType === normalizedMethod || 
                                 normalizedNodeType.includes(normalizedMethod) ||
                                 normalizedMethod.includes(normalizedNodeType);
                        });

                        // Build a union of ALL property keys across the DB, but prioritize the selected node type first.
                        const selectedTypeProps = Array.isArray(nodeTypeData?.propertyKeys) ? nodeTypeData.propertyKeys : [];
                        const allProps = nodeTypesWithPropertyKeys
                          .flatMap((item) => (Array.isArray(item?.propertyKeys) ? item.propertyKeys : []))
                          .filter((prop) => typeof prop === 'string' && prop.trim() !== '');

                        const orderedUniqueProps = Array.from(
                          new Set([
                            ...selectedTypeProps,
                            ...allProps
                          ])
                        ).sort((a, b) => a.localeCompare(b));

                        return orderedUniqueProps.map((prop) => (
                          <option key={prop} value={prop}>
                            {prop}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {}
      <div className="lg:hidden absolute top-0 left-0 right-0 flex justify-center z-10">
        <button
          onClick={toggleCollapse}
          className="text-white bg-transparent rounded-full p-0 hover:bg-[#333333]"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
        </button>
      </div>
    </div>
  );
};

export default RightSidebar;
