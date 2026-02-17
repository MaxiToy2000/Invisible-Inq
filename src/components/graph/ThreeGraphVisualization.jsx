import React, { useRef, useEffect, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import * as d3 from 'd3-force-3d';
import * as THREE from 'three';
import { getCategoryColor, getNodeTypeColor } from '../../utils/colorUtils';
import {
  setActiveGraphInstance,
  cleanupGraphInstance,
  releaseUnusedWebGLContexts
} from '../../utils/webGLUtils';
import NodeTooltipEnhanced from '../common/NodeTooltipEnhanced';

/**
 * Helper function to check if a link is the selected edge
 * This handles different ways the link and selectedEdge might be structured
 */
const isSelectedEdge = (link, selectedEdge) => {
  if (!link || !selectedEdge) return false;

  // First, try to match by ID which is the most accurate way
  if (link.id && selectedEdge.id && link.id === selectedEdge.id) {
    return true;
  }

  // If IDs don't match or aren't available, try to match by source/target and curvature
  // Get source and target IDs from the link
  const linkSourceId = link.source.id || link.source;
  const linkTargetId = link.target.id || link.target;

  // Get source and target IDs from the selectedEdge
  const selectedSourceId = selectedEdge.source?.id || selectedEdge.source || selectedEdge.sourceId;
  const selectedTargetId = selectedEdge.target?.id || selectedEdge.target || selectedEdge.targetId;

  // If source and target match, check curvature to distinguish between multiple edges
  if (linkSourceId === selectedSourceId && linkTargetId === selectedTargetId) {
    // If both have curvature defined, make sure they match closely
    if (link.curvature !== undefined && selectedEdge.curvature !== undefined) {
      // Allow for small floating point differences
      return Math.abs(link.curvature - selectedEdge.curvature) < 0.01;
    }

    // If only one has curvature defined, they're probably not the same edge
    if ((link.curvature !== undefined) !== (selectedEdge.curvature !== undefined)) {
      return false;
    }

    // If neither has curvature defined, they might be the same edge
    // In this case, we'll rely on the ID check above
    return false;
  }

  return false;
};

/**
 * Helper function to get link styling properties based on selection state
 * Returns an object with color, width, opacity, and gradient properties
 */
const getLinkStyling = (link, selectedEdge, nodeColors = {}, linkColors = {}, edgeThickness = 25, hiddenCategories = new Set(), graphData = null, searchMatches = new Set(), searchTerm = '', selectedEdges = new Set()) => {
  // Check if this edge is selected (either single selection or multi-selection from box select)
  const linkId = link.id || `${link.source?.id || link.source}->${link.target?.id || link.target}`;
  const isSelected = (selectedEdge && isSelectedEdge(link, selectedEdge)) || selectedEdges.has(linkId);

  // Get source and target node IDs
  const sourceId = link?.source?.id || link?.sourceId || link?.source;
  const targetId = link?.target?.id || link?.targetId || link?.target;

  // Check if source or target node types are hidden
  let isSourceHidden = false;
  let isTargetHidden = false;
  let isSourceDimmed = false;
  let isTargetDimmed = false;
  const darkGray = '#404040';
  const searchDimmedColor = '#2A2A2A';

  if (graphData && graphData.nodes) {
    const sourceNode = graphData.nodes.find(n => (n.id || n.gid) === sourceId);
    const targetNode = graphData.nodes.find(n => (n.id || n.gid) === targetId);
    
    if (sourceNode) {
      const sourceNodeType = sourceNode.node_type || sourceNode.type || sourceNode.category;
      isSourceHidden = sourceNodeType && hiddenCategories.has(sourceNodeType);
      // Check if source node is dimmed due to search
      isSourceDimmed = searchTerm && searchTerm.trim() !== '' && !searchMatches.has(sourceId);
    }
    
    if (targetNode) {
      const targetNodeType = targetNode.node_type || targetNode.type || targetNode.category;
      isTargetHidden = targetNodeType && hiddenCategories.has(targetNodeType);
      // Check if target node is dimmed due to search
      isTargetDimmed = searchTerm && searchTerm.trim() !== '' && !searchMatches.has(targetId);
    }
  }

  // If either source or target is hidden, use dark gray for the edge
  const isEdgeHidden = isSourceHidden || isTargetHidden;
  // If either source or target is dimmed by search, dim the edge
  const isEdgeDimmed = isSourceDimmed || isTargetDimmed;

  // Get default color from linkColors if available, otherwise use link's own properties
  let defaultColor = linkColors[link?.id] ||
                      link?.color ||
                      (link?.category ? getCategoryColor(link.category) : '#ADB5BD');
  
  // Override with dark gray if edge is hidden
  if (isEdgeHidden) {
    defaultColor = darkGray;
  } else if (isEdgeDimmed) {
    // Dim edge if either connected node doesn't match search
    defaultColor = searchDimmedColor;
  }

  // Calculate normalized edge thickness (0.2 to 1.1 range)
  const normalizedThickness = 0.15 + (edgeThickness / 100) ; // Adjusted to keep same initial value with 50% slider

  // Get source and target node colors for gradient
  // Use cached colors or get from node type
  let sourceColor = nodeColors[sourceId];
  let targetColor = nodeColors[targetId];
  
  // If colors not in cache, get from node type
  if (!sourceColor && graphData && graphData.nodes) {
    const sourceNode = graphData.nodes.find(n => (n.id || n.gid) === sourceId);
    if (sourceNode) {
      const sourceNodeType = sourceNode.node_type || sourceNode.type || sourceNode.category;
      sourceColor = sourceNodeType ? getNodeTypeColor(sourceNodeType) : '#1f77b4';
    } else {
      sourceColor = '#1f77b4';
    }
  } else if (!sourceColor) {
    sourceColor = '#1f77b4';
  }
  
  if (!targetColor && graphData && graphData.nodes) {
    const targetNode = graphData.nodes.find(n => (n.id || n.gid) === targetId);
    if (targetNode) {
      const targetNodeType = targetNode.node_type || targetNode.type || targetNode.category;
      targetColor = targetNodeType ? getNodeTypeColor(targetNodeType) : '#1f77b4';
    } else {
      targetColor = '#1f77b4';
    }
  } else if (!targetColor) {
    targetColor = '#1f77b4';
  }

  // Override with dark gray if nodes are hidden, or dimmed color if they don't match search
  if (isSourceHidden) {
    sourceColor = darkGray;
  } else if (isSourceDimmed) {
    sourceColor = searchDimmedColor;
  }
  
  if (isTargetHidden) {
    targetColor = darkGray;
  } else if (isTargetDimmed) {
    targetColor = searchDimmedColor;
  }

  // Calculate opacity - reduce for dimmed edges
  let edgeOpacity = 0.9;
  if (isSelected) {
    edgeOpacity = 1.0;
  } else if (isEdgeDimmed) {
    edgeOpacity = 0.3; // Significantly reduce opacity for non-matching search results
  }

  return {
    color: isSelected ? '#ffffff' : defaultColor, // White for selected edges
    sourceColor: sourceColor,
    targetColor: targetColor,
    width: isSelected ? normalizedThickness * 2.5 : normalizedThickness, // 2.5x width for selected edges
    opacity: edgeOpacity,
    isSelected: isSelected
  };
};

// ==================== PERFORMANCE OPTIMIZATION UTILITIES ====================

/**
 * Material cache to prevent creating new materials on every render
 */
class MaterialCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Limit cache size to prevent memory leaks
  }

  getKey(color, opacity, isGradient, sourceColor, targetColor) {
    return `${color}-${opacity}-${isGradient}-${sourceColor || ''}-${targetColor || ''}`;
  }

  get(color, opacity, isGradient, sourceColor, targetColor) {
    const key = this.getKey(color, opacity, isGradient, sourceColor, targetColor);
    return this.cache.get(key);
  }

  set(color, opacity, isGradient, sourceColor, targetColor, material) {
    const key = this.getKey(color, opacity, isGradient, sourceColor, targetColor);
    
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      const oldMaterial = this.cache.get(firstKey);
      if (oldMaterial && oldMaterial.dispose) {
        oldMaterial.dispose();
      }
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, material);
  }

  clear() {
    this.cache.forEach(material => {
      if (material && material.dispose) {
        material.dispose();
      }
    });
    this.cache.clear();
  }
}

/**
 * Debounce utility for expensive operations
 */
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Optimized sprite text creation with pooling
 */
class SpriteTextPool {
  constructor(maxSize = 500) {
    this.pool = [];
    this.maxSize = maxSize;
  }

  get(text, size, color) {
    let sprite;
    if (this.pool.length > 0) {
      sprite = this.pool.pop();
      sprite.text = text;
      sprite.textHeight = size;
      sprite.color = color;
    } else {
      sprite = new SpriteText(text);
      sprite.textHeight = size;
      sprite.color = color;
      sprite.backgroundColor = false;
      sprite.fontFace = 'Archivo';
      sprite.fontWeight = '500';
    }
    return sprite;
  }

  release(sprite) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(sprite);
    } else {
      // Dispose if pool is full
      if (sprite.material) sprite.material.dispose();
      if (sprite.geometry) sprite.geometry.dispose();
    }
  }

  clear() {
    this.pool.forEach(sprite => {
      if (sprite.material) sprite.material.dispose();
      if (sprite.geometry) sprite.geometry.dispose();
    });
    this.pool = [];
  }
}

/**
 * Helper function to calculate optimal camera distance based on node count
 * Returns a distance value for the camera z-position
 */
const calculateOptimalCameraDistance = (nodeCount) => {
  // Small graphs (< 20 nodes): closer view (z: 100-140)
  // Medium graphs (20-100 nodes): medium distance (z: 140-200)
  // Large graphs (100-500 nodes): further away (z: 200-350)
  // Very large graphs (> 500 nodes): far distance (z: 350-800+)
  let cameraDistance;

  if (nodeCount < 20) {
    // Small graphs: closer view
    cameraDistance = 105 + nodeCount * 3;
  } else if (nodeCount < 100) {
    // Medium graphs: medium distance with slower growth
    cameraDistance = 140 + (nodeCount - 20) * 1.5;
  } else if (nodeCount < 500) {
    // Large graphs: further away with faster growth
    cameraDistance = 200 + (nodeCount - 100) * 2.5; // Increased from 0.25 to 0.5
  } else if (nodeCount < 1000) {
    // Very large graphs: much further away
    cameraDistance = 350 + (nodeCount - 500) * 0.75; // Starts at 350, grows faster
  } else if (nodeCount < 2000) {
    // Extremely large graphs: very far distance
    cameraDistance = 600 + (nodeCount - 1000) * 0.2; // Starts at 600, slower growth
  } else {
    // Massive graphs: maximum distance
    cameraDistance = 800 + Math.log(nodeCount - 1999) * 50; // Logarithmic scaling for very large graphs
  }

  return cameraDistance;
};

/**
 * Helper function to calculate the distance from a node to the camera
 * Used for determining which edges should be rendered in front
 */
const calculateDistanceToCamera = (node, camera) => {
  if (!node || !node.x || !node.y || !node.z || !camera) return Infinity;

  // Create a vector for the node position
  const nodePosition = new THREE.Vector3(node.x, node.y, node.z);

  // Get the camera position
  const cameraPosition = new THREE.Vector3();
  camera.getWorldPosition(cameraPosition);

  // Calculate the distance
  return nodePosition.distanceTo(cameraPosition);
};

/**
 * Helper function to update the render order of edges based on their connected nodes' distances from the camera
 * Edges connected to nodes closer to the camera should be rendered in front
 * Nodes should always be rendered on top of edges
 */
const updateEdgeRenderOrder = (graphData, camera, graph) => {
  if (!graphData || !graphData.links || !camera || !graph) return;

  try {
    // Get the object3d for each link and node - check if scene exists first
    const scene = graph.scene?.();
    if (!scene || !scene.children) return;
    
    const linkObjects = scene.children.find(obj => obj.name === 'links')?.children || [];
    const nodeObjects = scene.children.find(obj => obj.name === 'nodes')?.children || [];

    if (linkObjects.length === 0) return;

    // Calculate the distance of each node to the camera
    const nodeDistances = {};
    graphData.nodes.forEach(node => {
      nodeDistances[node.id] = calculateDistanceToCamera(node, camera);
    });

    // Update the render order of each link based on the minimum distance of its connected nodes
    linkObjects.forEach((linkObj, index) => {
      if (index >= graphData.links.length) return;

      const link = graphData.links[index];
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;

      // Get the distances of the source and target nodes
      const sourceDistance = nodeDistances[sourceId] || Infinity;
      const targetDistance = nodeDistances[targetId] || Infinity;

      // Use the minimum distance to determine render order
      // Smaller distances (nodes closer to camera) should have higher render order (rendered later)
      const minDistance = Math.min(sourceDistance, targetDistance);

      // Invert the distance to get the render order (closer = higher render order)
      // Multiply by -1 to invert the order (closer objects have higher render order)
      // Scale by 1000 to ensure significant differences in render order
      // Keep edge render order in the range of 0-999 to ensure nodes are always on top
      linkObj.renderOrder = Math.min(999, -minDistance * 1000);
    });

    // Set a very high render order for all nodes to ensure they're always on top
    // This value should be higher than any possible edge render order
    nodeObjects.forEach(nodeObj => {
      nodeObj.renderOrder = 1000; // Higher than any edge render order
    });
  } catch (error) {
    // Scene might be disposed or graph is being cleaned up, ignore
    console.warn("Error updating edge render order:", error);
  }
};

/**
 * Helper function to check if a node matches the search term
 * Returns true if the node matches (should be highlighted), false if it should be darkened
 */
const nodeMatchesSearch = (node, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return true; // No search term, all nodes match
  
  const term = searchTerm.toLowerCase().trim();
  
  // Check node name
  if (node.name && node.name.toLowerCase().includes(term)) return true;
  
  // Check node id
  if (node.id && node.id.toString().toLowerCase().includes(term)) return true;
  
  // Check node category/type
  if (node.category && node.category.toLowerCase().includes(term)) return true;
  if (node.node_type && node.node_type.toLowerCase().includes(term)) return true;
  if (node.type && node.type.toLowerCase().includes(term)) return true;
  
  // Check node properties
  if (node.properties) {
    const propsString = JSON.stringify(node.properties).toLowerCase();
    if (propsString.includes(term)) return true;
  }
  
  return false; // No match
};


/**
 * Helper function to completely reset and restart the simulation
 * This is the most aggressive approach and is used when slider values change
 */
const completelyResetSimulation = (graph, isInitialLoad = false) => {
  if (!graph) return;

  // Skip complete reset during initial load to prevent graph disappearing
  if (isInitialLoad) {
    // Just reheat the simulation instead
    if (graph._simulation) {
      graph._simulation.alpha(0.8).restart();
    }
    return;
  }

  try {
    // Store current graph data
    const graphData = graph.graphData();

    // Make sure we have data before proceeding
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      console.warn("Cannot reset simulation: No graph data available");
      return;
    }

    // Stop the current simulation
    if (graph._simulation) {
      graph._simulation.stop();
    }

    // Reset the simulation by re-initializing it with the same data
    // This effectively creates a new simulation with the current parameters
    graph.graphData({ nodes: [], links: [] }); // Clear data first
    setTimeout(() => {
      graph.graphData(graphData); // Re-add the data

      // Make sure the animation is running
      if (typeof graph.resumeAnimation === 'function') {
        graph.resumeAnimation();
      }

      // Refresh the graph to apply changes immediately
      graph.refresh();
    }, 0);
  } catch (error) {
    console.error("Error completely resetting simulation:", error);
  }
};

/**
 * 3D graph visualization component using ForceGraph3D
 * Wrapped in React.memo + forwardRef; ref exposes getCurrentCameraState() for parent "Save position" buttons.
 */
const ThreeGraphVisualization = React.memo(forwardRef(({
  data,
  onNodeClick,
  onNodeRightClick,
  onLinkClick,
  forceStrength = 50,
  nodeSize = 50,
  labelSize = 50,
  edgeLength = 20,
  edgeThickness = 25,
  selectedNode = null,
  selectedEdge = null,
  is3D = true,
  hiddenCategories = new Set(),
  zoomAction = null,
  onZoomComplete = null,
  searchTerm = '',
  searchMatches = new Set(), // Pre-computed search matches from parent
  selectionMode = 'individual', // 'individual' | 'box' | 'lasso'
  loading = false, // Whether graph data is still loading
  onSelectedNodesChange = () => {}, // Callback when selected nodes change
  onSelectedEdgesChange = () => {}, // Callback when selected edges change
  graphLayoutMode = 'force', // 'force' | 'tree' (hierarchical)
  hierarchyTreeAxis = { x: false, y: false, z: false }, // Hierarchy tree axis configuration
  initialCameraPosition = null, // { position: {x,y,z}, target: {x,y,z} } to restore saved view
  onSavePosition = null, // (state) => void; when provided, "Save XYZ position" button is shown inside graph
}, ref) => {
  // Callback validation (only log once on mount or when callbacks change)
  // console.log('🟣 ThreeGraphVisualization - selectionMode:', selectionMode);

  const containerRef = useRef();
  const graphRef = useRef();
  const pinnedNodesRef = useRef(new Set()); // Tracks manually moved nodes that are pinned
  const previousSelectedNodeRef = useRef(null); // Tracks the previously selected node
  const nodeColorsRef = useRef({});
  const nodeDataMapRef = useRef(new Map()); // Store original node data by ID for label lookups
  const isInitialLoadRef = useRef(true); // Track if this is the initial load
  const debounceTimerRef = useRef(null); // For debouncing slider changes
  const lastForceStrengthRef = useRef(forceStrength); // Track last applied force strength
  const lastEdgeLengthRef = useRef(edgeLength); // Track last applied edge length
  const lastCameraDistanceRef = useRef(null); // Track last camera-target distance for mode switches
  const isMountedRef = useRef(true); // Track if component is mounted to prevent state updates after unmount
  
  // Box selection state
  const [boxSelection, setBoxSelection] = useState({
    isSelecting: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
  });
  
  // Lasso selection state
  const [lassoSelection, setLassoSelection] = useState({
    isSelecting: false,
    path: [] // Array of {x, y} points
  });
  
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectedEdges, setSelectedEdges] = useState(new Set());
  const previousSelectedNodesRef = useRef(new Set()); // Track previous selected nodes
  const previousSelectedEdgesRef = useRef(new Set()); // Track previous selected edges
  const searchMatchesRef = useRef(new Set()); // Track which nodes match the current search
  const previousSearchMatchesRef = useRef(new Set()); // Track previous search matches for incremental updates
  const nodeOrEdgeClickedRef = useRef(false); // Track if a node or edge was just clicked to prevent selection start
  const hoveredNodeRef = useRef(null); // Track currently hovered node for drag detection
  const [cursorStyle, setCursorStyle] = useState('default'); // Dynamic cursor state for multi-select
  const selectedNodesRef = useRef(new Set()); // Ref to track selectedNodes for handlers
  const selectedRegionRef = useRef(null); // Ref to track selectedRegion for handlers
  const [isHoveringSelected, setIsHoveringSelected] = useState(false); // Track if hovering over selected items
  const [selectedRegion, setSelectedRegion] = useState(null); // Store the selected region bounds/path
  const [webglError, setWebglError] = useState(null); // Track WebGL initialization errors
  const [savePositionStatus, setSavePositionStatus] = useState(null); // 'saving' | 'saved' | 'error' | null
  const nodeLookupMapRef = useRef(new Map()); // Fast O(1) node lookup map
  const previousDataRef = useRef(null); // Track previous data for incremental updates
  const appliedInitialCameraRef = useRef(false); // Whether we already applied initialCameraPosition
  
  // Region-based subgraph dragging state
  const regionDragRef = useRef({
    isDragging: false,
    startMouseX: 0,
    startMouseY: 0,
    initialNodePositions: new Map() // Map of nodeId -> {x, y, z}
  });
  
  // Keep refs in sync with state to avoid useEffect re-runs
  useEffect(() => {
    selectedNodesRef.current = selectedNodes;
  }, [selectedNodes]);
  
  useEffect(() => {
    selectedRegionRef.current = selectedRegion;
  }, [selectedRegion]);
  
  // Build fast node lookup map for O(1) access during drag operations
  useEffect(() => {
    if (!data || !data.nodes) {
      nodeLookupMapRef.current.clear();
      return;
    }
    
    // Rebuild lookup map when data changes
    const lookupMap = new Map();
    data.nodes.forEach(node => {
      if (node.id) {
        lookupMap.set(node.id, node);
      }
    });
    nodeLookupMapRef.current = lookupMap;
  }, [data]);

  // Notify parent when selected nodes/edges change
  useEffect(() => {
    // Only notify parent if selection actually changed
    const prev = previousSelectedNodesRef.current;
    if (selectedNodes.size !== prev.size || Array.from(selectedNodes).some(id => !prev.has(id))) {
      previousSelectedNodesRef.current = new Set(selectedNodes);
      onSelectedNodesChange(new Set(selectedNodes));
    }
  }, [selectedNodes, onSelectedNodesChange]);
  
  useEffect(() => {
    // Only notify parent if selection actually changed
    const prev = previousSelectedEdgesRef.current;
    if (selectedEdges.size !== prev.size || Array.from(selectedEdges).some(id => !prev.has(id))) {
      previousSelectedEdgesRef.current = new Set(selectedEdges);
      onSelectedEdgesChange(new Set(selectedEdges));
    }
  }, [selectedEdges, onSelectedEdgesChange]);
  
  // Track mounted state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Performance optimization caches
  const materialCacheRef = useRef(null);
  const spritePoolRef = useRef(null);
  const renderFrameRef = useRef(null); // RequestAnimationFrame handle for batched updates
  
  // Initialize performance caches
  if (!materialCacheRef.current) {
    materialCacheRef.current = new MaterialCache();
  }
  if (!spritePoolRef.current) {
    spritePoolRef.current = new SpriteTextPool();
  }
  
  // Tooltip state for node hover
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const hoverTimeoutRef = useRef(null);

  // Calculate normalized values for the graph - memoized for performance
  const normalizedForce = useMemo(() => 
    -30 + (forceStrength / 100) * 25, [forceStrength]
  );
  const normalizedCenterForce = useMemo(() => 
    0.03 + (forceStrength / 100) * 0.05, [forceStrength]
  );
  const normalizedAxisForce = useMemo(() => 
    0.01 + (forceStrength / 100) * 0.03, [forceStrength]
  );
  const normalizedNodeSize = useMemo(() => 
    4 + (nodeSize / 100) * 8, [nodeSize]
  );
  const normalizedLabelSize = useMemo(() => 
    1.2 + (labelSize / 100) * 1.8, [labelSize]
  );
  const normalizedEdgeLength = useMemo(() => 
    20 + (edgeLength / 100) * 24, [edgeLength]
  );

  // Check if there are no nodes or edges to display (once loading has completed)
  const hasNoData = !data || !data.nodes || data.nodes.length === 0;

  // Memoize link colors calculation to avoid recomputation
  const linkColors = useMemo(() => {
    const colors = {};
    if (data && data.links) {
      data.links.forEach(l => {
        colors[l.id] = l.color || (l.category ? getCategoryColor(l.category) : '#ADB5BD');
      });
    }
    return colors;
  }, [data]);

  // Use pre-computed search matches from parent (ultra-fast!)
  // Implements incremental updates - only refreshes nodes that changed match status
  useEffect(() => {
    if (!graphRef.current) {
      searchMatchesRef.current = searchMatches;
      return;
    }

    const currentMatches = searchMatches;
    const previousMatches = previousSearchMatchesRef.current;
    
    // Calculate which nodes changed their match status
    const changedNodes = new Set();
    
    // Find newly matched nodes
    currentMatches.forEach(nodeId => {
      if (!previousMatches.has(nodeId)) {
        changedNodes.add(nodeId);
      }
    });
    
    // Find newly unmatched nodes
    previousMatches.forEach(nodeId => {
      if (!currentMatches.has(nodeId)) {
        changedNodes.add(nodeId);
      }
    });
    
    // Update refs
    searchMatchesRef.current = currentMatches;
    previousSearchMatchesRef.current = new Set(currentMatches);
    
    // Only refresh if there are actual changes
    if (changedNodes.size > 0 || (currentMatches.size === 0 && previousMatches.size > 0)) {
      // Batch the refresh in the next animation frame for smooth performance
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
      }
      
      renderFrameRef.current = requestAnimationFrame(() => {
        if (graphRef.current) {
          // Lightweight refresh - only updates visuals, not positions
          graphRef.current.nodeColor(graphRef.current.nodeColor());
          graphRef.current.linkColor(graphRef.current.linkColor());
          graphRef.current.linkWidth(graphRef.current.linkWidth());
          graphRef.current.linkOpacity(graphRef.current.linkOpacity());
        }
      });
    }
  }, [searchMatches]);

  // Cleanup graph instance when transitioning to empty state or when data becomes invalid
  useEffect(() => {
    // Only cleanup if we're not loading and have no data, or if container/data is invalid
    if (loading) return; // Don't cleanup while loading
    
    const shouldCleanup = !data || !data.nodes || data.nodes.length === 0;
    
    // Don't cleanup if we're doing an incremental update (graph exists and has previous data)
    // Check if this might be an incremental update scenario
    const mightBeIncrementalUpdate = graphRef.current && previousDataRef.current && 
                                      previousDataRef.current.nodes && previousDataRef.current.nodes.length > 0 &&
                                      data && data.nodes && data.nodes.length > 0;
    
    // Only cleanup if we should cleanup AND it's not an incremental update scenario
    if (shouldCleanup && graphRef.current && !mightBeIncrementalUpdate) {
      try {
        // Dispose of any gradient textures created for links
        try {
          // Clean up link materials - check if scene exists first
          const scene = graphRef.current.scene?.();
          if (scene && scene.children) {
            const linkObjects = scene.children.find(obj => obj.name === 'links')?.children || [];
            linkObjects.forEach(linkObj => {
              if (linkObj.material && linkObj.material.map) {
                linkObj.material.map.dispose();
              }
            });
          }
        } catch (error) {
          // Scene might already be disposed, ignore
          console.warn("Error disposing gradient textures:", error);
        }

        // Use the centralized cleanup function
        // This will handle all DOM cleanup for ForceGraph3D
        cleanupGraphInstance(graphRef.current);

        // Don't manually remove children - ForceGraph3D's cleanup handles its own DOM
        // React will handle any React-managed children

        // Clear the reference
        graphRef.current = null;

        // Try to release any unused WebGL contexts
        releaseUnusedWebGLContexts();
      } catch (error) {
        console.error("Error during graph cleanup:", error);
      }
    }
  }, [loading, data]);

  // Initialize the graph or update incrementally
  useEffect(() => {
    // Don't initialize if loading or if we have no data (will show empty state)
    if (loading || !containerRef.current || !data || !data.nodes || !data.links || data.nodes.length === 0) {
      return;
    }

    // Check if this is an incremental update (graph already exists and data changed)
    const isIncrementalUpdate = graphRef.current && previousDataRef.current && 
                                 previousDataRef.current.nodes && previousDataRef.current.nodes.length > 0;

    if (isIncrementalUpdate) {
      // Incremental update: preserve node positions and only update changed nodes/links
      const currentGraphData = graphRef.current.graphData();
      const previousData = previousDataRef.current;
      
      // Create maps for fast lookup
      const previousNodeMap = new Map(previousData.nodes.map(n => [n.id, n]));
      const previousLinkMap = new Map();
      previousData.links.forEach(link => {
        const linkId = link.id || `${link.sourceId || link.source}->${link.targetId || link.target}`;
        previousLinkMap.set(linkId, link);
      });
      
      const newNodeMap = new Map(data.nodes.map(n => [n.id, n]));
      const newLinkMap = new Map();
      data.links.forEach(link => {
        const linkId = link.id || `${link.sourceId || link.source}->${link.targetId || link.target}`;
        newLinkMap.set(linkId, link);
      });
      
      // Preserve positions for existing nodes
      const updatedNodes = data.nodes.map(newNode => {
        const previousNode = previousNodeMap.get(newNode.id);
        if (previousNode && currentGraphData && currentGraphData.nodes) {
          // Find the node in the current graph data to get its current position
          const currentNode = currentGraphData.nodes.find(n => {
            const nodeId = n.id || n.gid;
            return String(nodeId) === String(newNode.id);
          });
          
          if (currentNode && (currentNode.x !== undefined || currentNode.fx !== undefined)) {
            // Preserve position if node still exists in graph
            newNode.x = currentNode.x;
            newNode.y = currentNode.y;
            newNode.z = currentNode.z;
            // Preserve pinned state
            if (currentNode.fx !== undefined) newNode.fx = currentNode.fx;
            if (currentNode.fy !== undefined) newNode.fy = currentNode.fy;
            if (currentNode.fz !== undefined) newNode.fz = currentNode.fz;
          }
        }
        return newNode;
      });
      
      // Preserve link properties (curvature, rotation) for existing links
      let updatedLinks = data.links.map(newLink => {
        const linkId = newLink.id || `${newLink.sourceId || newLink.source}->${newLink.targetId || newLink.target}`;
        const previousLink = previousLinkMap.get(linkId);
        if (previousLink) {
          // Preserve curvature and rotation if they existed
          if (previousLink.curvature !== undefined) {
            newLink.curvature = previousLink.curvature;
          }
          if (previousLink.curveRotation !== undefined) {
            newLink.curveRotation = previousLink.curveRotation;
          }
        }
        return newLink;
      });
      
      // Process curvature for new links (if in force layout mode)
      if (graphLayoutMode !== 'tree' && updatedLinks.length > 0) {
        const connectionMap = new Map();
        updatedLinks.forEach(link => {
          const sourceId = link.sourceId || link.source;
          const targetId = link.targetId || link.target;
          const linkKey = [sourceId, targetId].sort().join('->');
          if (!connectionMap.has(linkKey)) {
            connectionMap.set(linkKey, []);
          }
          connectionMap.get(linkKey).push(link);
        });
        
        connectionMap.forEach((links) => {
          if (links.length > 1) {
            links.forEach((link, i) => {
              if (link.curvature === undefined) {
                const baseCurvature = 0.5;
                link.curvature = baseCurvature * (1 + i * 0.5);
              }
              if (link.curveRotation === undefined) {
                link.curveRotation = (i * Math.PI * 2) / links.length;
              }
            });
          }
        });
      }
      
      // Update node colors for new/updated nodes
      data.nodes.forEach(node => {
        const nodeType = node.node_type || node.type || node.category;
        const isHidden = nodeType && hiddenCategories.has(nodeType);
        const matchesSearch = nodeMatchesSearch(node, searchTerm);
        
        if (matchesSearch) {
          searchMatchesRef.current.add(node.id);
        }
        
        if (isHidden) {
          nodeColorsRef.current[node.id] = '#404040';
        } else if (!matchesSearch && searchTerm && searchTerm.trim() !== '') {
          nodeColorsRef.current[node.id] = '#2A2A2A';
        } else {
          nodeColorsRef.current[node.id] = node.color || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4');
        }
      });
      
      // Update graph data incrementally (this will add/remove nodes/links smoothly)
      // Use requestAnimationFrame to avoid conflicts with React's reconciliation
      try {
        if (graphRef.current && containerRef.current && containerRef.current.parentNode) {
          // Update graph data - ForceGraph3D will handle DOM updates internally
          graphRef.current.graphData({ nodes: updatedNodes, links: updatedLinks });
          
          // Update previous data reference
          previousDataRef.current = { nodes: [...updatedNodes], links: [...updatedLinks] };
          
          // Refresh the graph to apply changes
          graphRef.current.refresh();
        }
      } catch (error) {
        console.warn("Error during incremental graph update:", error);
        // If incremental update fails, fall back to full initialization
        // Don't return here, let it continue to full initialization
        previousDataRef.current = null;
      }
      
      // Only skip full initialization if incremental update succeeded
      if (previousDataRef.current) {
        return;
      }
    }

    // Full initialization (first load or major change)
    // Store original curvature and rotation values if they exist
    const linkPropertiesMap = new Map();
    if (graphRef.current) {
      const currentData = graphRef.current.graphData();
      if (currentData && currentData.links) {
        currentData.links.forEach(link => {
          // ForceGraph3D uses source/target internally, so we need to extract the IDs
          const sourceId = link.source.id || link.source;
          const targetId = link.target.id || link.target;
          const linkId = link.id || `${sourceId}->${targetId}`;

          if (link.curvature !== undefined || link.curveRotation !== undefined) {
            linkPropertiesMap.set(linkId, {
              curvature: link.curvature,
              curveRotation: link.curveRotation
            });
          }
        });
      }
    }

    // Apply stored properties to new data if possible
    if (linkPropertiesMap.size > 0) {
      data.links.forEach(link => {
        // All data now uses sourceId/targetId format
        const sourceId = link.sourceId;
        const targetId = link.targetId;
        const linkId = link.id || `${sourceId}->${targetId}`;

        if (linkPropertiesMap.has(linkId)) {
          const props = linkPropertiesMap.get(linkId);
          link.curvature = props.curvature;
          link.curveRotation = props.curveRotation;
        }
      });
    }

    // Clean up any existing graph instance first to prevent WebGL context issues
    // Only do full cleanup if this is NOT an incremental update
    if (graphRef.current && !isIncrementalUpdate) {
      try {
        // Use the centralized cleanup function
        // Use the centralized cleanup function
        // This will handle all DOM cleanup for ForceGraph3D
        cleanupGraphInstance(graphRef.current);

        // Don't manually remove children - ForceGraph3D's cleanup handles its own DOM
        // React will handle any React-managed children

        // Clear the reference
        graphRef.current = null;
      } catch (error) {
        console.warn("Error during graph cleanup in initialization:", error);
      }
    }

    // Initialize a new graph instance with error handling
    try {
      graphRef.current = ForceGraph3D()(containerRef.current);
      
      // Register this as the active graph instance
      setActiveGraphInstance(graphRef.current);
      
      // Clear any previous WebGL errors if initialization succeeded
      setWebglError(null);
    } catch (error) {
      console.error('Error initializing ForceGraph3D:', error);
      const errorMessage = String(error?.message || error || 'Unknown error');
      
      // Check if it's a WebGL context error (various patterns)
      if (errorMessage.includes('WebGL') || 
          errorMessage.includes('WebGL context') || 
          errorMessage.includes('BindToCurrentSequence') ||
          errorMessage.includes('Could not create a WebGL context')) {
        setWebglError('WebGL is not available in your browser or environment. The 3D graph visualization cannot be displayed.');
      } else {
        setWebglError(`Failed to initialize graph: ${errorMessage}`);
      }
      
      // Don't continue initialization if graph creation failed
      return;
    }

    // Create a custom link material function that supports gradients
    graphRef.current.linkMaterial((link) => {
      // Get the styling for this link
      const graphData = graphRef.current.graphData();
      const nodeColors = nodeColorsRef.current;

      const styling = getLinkStyling(link, selectedEdge, nodeColors, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm, selectedEdges);

      // Check cache first for performance
      const isCurved = link.curvature && link.curvature > 0;
      const cachedMaterial = materialCacheRef.current.get(
        styling.color,
        styling.opacity,
        !styling.isSelected,
        styling.sourceColor,
        styling.targetColor
      );

      if (cachedMaterial) {
        return cachedMaterial;
      }

      // Create a material based on whether it's selected or should have a gradient
      let material;
      if (styling.isSelected) {
        // For selected links, use a solid white color with higher opacity
        material = new THREE.MeshLambertMaterial({
          color: '#ffffff', // Ensure it's always white for highlighted edges
          transparent: true,
          opacity: 1.0, // Full opacity for highlighted edges
          depthWrite: false,
          depthTest: true,
          alphaTest: 0.01
        });
      } else {
        // For regular links, create a gradient material
        // Convert hex colors to THREE.Color objects
        const sourceColor = new THREE.Color(styling.sourceColor);
        const targetColor = new THREE.Color(styling.targetColor);

        // Create a gradient texture for the edge
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Create a gradient - horizontal for curved edges, vertical for straight edges
        let gradient;
        if (isCurved) {
          // Horizontal gradient for curved edges
          gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          // For curved edges, source color on left, target color on right
          gradient.addColorStop(0, `rgb(${sourceColor.r * 255}, ${sourceColor.g * 255}, ${sourceColor.b * 255})`);
          gradient.addColorStop(1, `rgb(${targetColor.r * 255}, ${targetColor.g * 255}, ${targetColor.b * 255})`);
        } else {
          // Vertical gradient for straight edges
          gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
          // For straight edges, target color on top, source color on bottom (reversed)
          gradient.addColorStop(0, `rgb(${targetColor.r * 255}, ${targetColor.g * 255}, ${targetColor.b * 255})`);
          gradient.addColorStop(1, `rgb(${sourceColor.r * 255}, ${sourceColor.g * 255}, ${sourceColor.b * 255})`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Create a texture from the canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Return a standard material with the gradient texture
        material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: styling.opacity,
          depthWrite: false,
          depthTest: true,
          alphaTest: 0.01
        });
      }

      // Cache the material for reuse
      materialCacheRef.current.set(
        styling.color,
        styling.opacity,
        !styling.isSelected,
        styling.sourceColor,
        styling.targetColor,
        material
      );

      return material;
    });

    // For curved links, we'll use the default ForceGraph3D rendering
    // The gradient will be applied through the linkMaterial function we set up earlier

    // Ensure nodes are always rendered on top of edges
    // This is done by setting a custom node three object with a high renderOrder
    const originalNodeThreeObject = graphRef.current.nodeThreeObject();
    graphRef.current.nodeThreeObject(node => {
      const obj = originalNodeThreeObject ? originalNodeThreeObject(node) : null;
      if (obj) {
        obj.renderOrder = 1000; // Higher than any edge render order
      }
      return obj;
    });

    // Enhanced resize handler with mutation observer for container size changes
    const handleResize = () => {
      if (!containerRef.current || !graphRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Set dimensions based on current container size
      const width = rect.width;
      const height = rect.height;

      // Store these dimensions on the graph instance to maintain consistency
      graphRef.current._fixedWidth = width;
      graphRef.current._fixedHeight = height;

      graphRef.current.width(width).height(height);
    };

    // Initial resize
    handleResize();

    // Add window resize listener
    window.addEventListener('resize', handleResize);

    // Set up a ResizeObserver to detect container size changes
    // This is especially important for mobile view when sidebars collapse/expand
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Pre-compute node and link colors for better performance
    // This will be updated when hiddenCategories or searchTerm changes
    nodeColorsRef.current = {};
    nodeDataMapRef.current = new Map(); // Reset and populate node data map
    searchMatchesRef.current = new Set();
    const darkGray = '#404040';
    const searchDimmedColor = '#2A2A2A'; // Darker gray for non-matching search results
    
    data.nodes.forEach(node => {
      // Store complete node data in map for label lookups (especially for Amount/Funding nodes)
      nodeDataMapRef.current.set(node.id, node);
      
      const nodeType = node.node_type || node.type || node.category;
      const isHidden = nodeType && hiddenCategories.has(nodeType);
      const matchesSearch = nodeMatchesSearch(node, searchTerm);
      
      // Track nodes that match search
      if (matchesSearch) {
        searchMatchesRef.current.add(node.id);
      }
      
      if (isHidden) {
        nodeColorsRef.current[node.id] = darkGray;
      } else if (!matchesSearch && searchTerm && searchTerm.trim() !== '') {
        // Dim nodes that don't match search
        nodeColorsRef.current[node.id] = searchDimmedColor;
      } else {
        // Use getNodeTypeColor to set color based on node type
        nodeColorsRef.current[node.id] = node.color || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4');
      }
    });

    // Process data to identify multiple connections between the same nodes
    // and assign curvature and rotation values to make them visible
    // Skip curvature calculation in tree layout to preserve edge shapes
    if (data && data.links && data.links.length > 0 && graphLayoutMode !== 'tree') {
      // Create a map to track connections between node pairs
      const connectionMap = new Map();

      // First pass: count connections between each node pair
      data.links.forEach(link => {
        // All data now uses sourceId/targetId format
        const sourceId = link.sourceId;
        const targetId = link.targetId;

        // Create a unique key for this node pair (order alphabetically to handle bidirectional links)
        const linkKey = [sourceId, targetId].sort().join('->');

        if (!connectionMap.has(linkKey)) {
          connectionMap.set(linkKey, []);
        }
        connectionMap.get(linkKey).push(link);
      });

      // Second pass: assign curvature and rotation to links with multiple connections
      connectionMap.forEach((links) => {
        if (links.length > 1) {
          // Multiple links between the same nodes - assign curvature and rotation
          links.forEach((link, i) => {
            // Only assign if curvature doesn't already exist (preserve existing values)
            if (link.curvature === undefined) {
              // Base curvature - adjust as needed
              const baseCurvature = 0.5;
              // Assign increasing curvature for each additional link
              link.curvature = baseCurvature * (1 + i * 0.5);
            }
            // Only assign if curveRotation doesn't already exist (preserve existing values)
            if (link.curveRotation === undefined) {
              // Distribute links evenly around the connection line
              link.curveRotation = (i * Math.PI * 2) / links.length;
            }
          });
        }
      });
    }

  // Configure graph with basic settings
    graphRef.current
      .backgroundColor('#111111')
      .graphData(data)
      // Node label: for AMOUNT/FUNDING nodes, show amount with $ instead of ID/GID
      .nodeLabel(node => {
        // Get original node data from nodeDataMapRef for reliable access to all properties
        const originalNode = nodeDataMapRef.current.get(node.id) || data.nodes.find(n => n.id === node.id) || node;
        const nodeType = (originalNode.node_type || originalNode.type || originalNode.category || '').toLowerCase();
        
        if (nodeType === 'amount' || nodeType === 'funding') {
          // Check multiple property names for the amount value (same order as tooltip)
          let amount = originalNode.Amount ?? originalNode.amount ?? originalNode.value ?? 
                      originalNode.properties?.Amount ?? originalNode.properties?.amount ?? 
                      originalNode.properties?.value ?? null;
          
          // If still not found, search for any property containing 'amount' in the name
          if (amount === null && originalNode) {
            for (const key of Object.keys(originalNode)) {
              if (key.toLowerCase().includes('amount') && originalNode[key] !== null && originalNode[key] !== undefined) {
                amount = originalNode[key];
                break;
              }
            }
          }
          
          if (amount !== null && amount !== undefined) {
            // Format number with commas and $ prefix
            const amountStr = String(amount);
            const cleanAmount = amountStr.replace(/[^0-9.-]/g, '');
            const numAmount = parseFloat(cleanAmount);
            if (!isNaN(numAmount)) {
              return '$' + numAmount.toLocaleString();
            }
            return '$' + amountStr;
          }
        }
        return originalNode.name || originalNode.id;
      })
      .nodeColor(node => {
        const nodeType = node.node_type || node.type || node.category;
        const isHidden = nodeType && hiddenCategories.has(nodeType);
        if (isHidden) {
          return '#404040'; // Dark gray for hidden nodes
        }
        // Use cached color or get color from node type
        return nodeColorsRef.current[node.id] || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4');
      })
      .linkCurvature(link => {
        // In tree layout, always use 0 curvature to keep edges straight
        if (graphLayoutMode === 'tree') {
          return 0;
        }
        return link.curvature || 0;
      })
      .linkCurveRotation(link => {
        // In tree layout, always use 0 rotation to keep edges straight
        if (graphLayoutMode === 'tree') {
          return 0;
        }
        return link.curveRotation || 0;
      })
      .linkColor(link => {
        // Use the helper function to get link styling
        if (!graphRef.current) return '#cccccc';
        const graphData = graphRef.current.graphData();
        if (!graphData) return '#cccccc';
        const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
        return styling.color;
      })
      .linkWidth(link => {
        // Use the helper function to get link styling
        if (!graphRef.current) return 1;
        const graphData = graphRef.current.graphData();
        if (!graphData) return 1;
        const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
        return styling.width;
      })
      .linkOpacity(link => {
        // Use the helper function to get link styling
        if (!graphRef.current) return 0.5;
        const graphData = graphRef.current.graphData();
        if (!graphData) return 0.5;
        const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
        return styling.opacity;
      })
      .linkLabel(link => {
        // Show label for selected edge or if link has a title
        if (!graphRef.current) return null;
        const graphData = graphRef.current.graphData();
        if (!graphData) return null;
        const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
        // If the link is selected (styling.opacity is 1.0 for selected links)
        if (styling.opacity === 1.0) {
          return link.title || link.label || 'Link';
        }
        return null; // No label for non-selected edges
      })
      .d3AlphaDecay(0.05)
      .d3VelocityDecay(0.4)
      // Optimize cooldown based on dataset size for faster rendering
      .cooldownTicks(data.nodes.length > 100 ? 30 : 50)
      .cooldownTime(data.nodes.length > 100 ? 3500 : 4000)
      // Add warmup for faster initial layout
      .warmupTicks(data.nodes.length > 100 ? 50 : 100)
      // Configure forces for better clustering behavior
      // Link force - maintains distance between connected nodes
      .d3Force('link', d3.forceLink()
        .distance(normalizedEdgeLength)
        .id(node => node.id)
      )
      // Center force - pulls nodes toward the center to prevent them from drifting away
      .d3Force('center', d3.forceCenter(0, 0, 0).strength(normalizedCenterForce)) // Using normalized center force value
      // X, Y, and Z forces - create a more balanced 3D distribution using d3-force-3d
      .d3Force('x', d3.forceX().strength(normalizedAxisForce)) // Using normalized axis force value
      .d3Force('y', d3.forceY().strength(normalizedAxisForce)) // Using normalized axis force value
      .d3Force('z', d3.forceZ().strength(normalizedAxisForce)) // Using native forceZ from d3-force-3d
      // Collision force - prevents nodes from overlapping
      .d3Force('collision', d3.forceCollide(normalizedNodeSize * 1.5))
      // Charge force - creates repulsion between nodes
      .d3Force('charge', d3.forceManyBody().strength(normalizedForce))
      // Add a tick event handler to update edge render order on each frame
      .onEngineTick(() => {
        // Update edge render order based on node distances from camera
        if (graphRef.current) {
          const graphData = graphRef.current.graphData();
          const camera = graphRef.current.camera();
          updateEdgeRenderOrder(graphData, camera, graphRef.current);
          
        }
      })
      .onNodeClick(node => {
        // Mark that a node was clicked to prevent selection from starting
        nodeOrEdgeClickedRef.current = true;
        setTimeout(() => { nodeOrEdgeClickedRef.current = false; }, 100);
        
        // CRITICAL: In individual mode, freeze the simulation BEFORE any other processing
        // This prevents connected nodes from moving due to force simulation when a node is clicked
        if (selectionMode === 'individual' && graphRef.current?._simulation) {
          // Immediately stop any ongoing simulation by setting alpha to 0
          graphRef.current._simulation.alpha(0);
          graphRef.current._simulation.stop();
        }
        
        // Always allow node clicks; camera controls are disabled in box/lasso modes
        // so clicks won't rotate the graph, only select nodes.
        if (onNodeClick && node) {
          try {
            // Get the original node data from the graph data
            const originalNode = data.nodes.find(n => n.id === node.id);
            // Use the original node data to ensure all properties are included
            const cleanNodeData = originalNode ? { ...originalNode } : {
              id: node.id,
              name: node.name,
              category: node.category
            };
            onNodeClick(cleanNodeData);
          } catch (error) {
            console.error("Error in node click handler:", error);
          }
        }
        
        // Ensure controls are properly re-enabled after node click in individual mode
        // This fixes the issue where rotation is blocked after clicking a node
        // The issue occurs because node clicks can consume mouse events, preventing
        // OrbitControls from receiving proper mouseup events, leaving it in a "dragging" state
        if (selectionMode === 'individual' && graphRef.current?.controls) {
          // Use a small delay to ensure the click event has fully processed
          setTimeout(() => {
            const controls = graphRef.current?.controls();
            if (controls) {
              // Force reset controls state to ensure rotation works immediately after node click
              controls.enabled = true;
              controls.enableRotate = true;
              controls.enablePan = true;
              controls.enableZoom = true;
              controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
              };
              
              // Reset internal dragging state if it exists
              // OrbitControls tracks mouse state internally, so we need to ensure it's cleared
              if (controls.domElement) {
                // Dispatch a mouseup event to the controls' DOM element to clear any stuck drag state
                const mouseUpEvent = new MouseEvent('mouseup', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                controls.domElement.dispatchEvent(mouseUpEvent);
              }
              
              controls.update();
            }
          }, 10); // Small delay to ensure click processing is complete
        }
      })
      .onNodeHover((node, prevNode) => {
        // Track the currently hovered node for drag detection
        hoveredNodeRef.current = node;
        
        // Clear any existing timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }

        if (node) {
          // Update cursor if in multi-select mode and hovering over a selected node
          if ((selectionMode === 'box' || selectionMode === 'lasso') && selectedNodes.has(node.id)) {
            setCursorStyle('grab');
          } else if (selectionMode === 'box' || selectionMode === 'lasso') {
            setCursorStyle('default');
          }
          
          // Set a small delay before showing tooltip to avoid flickering
          hoverTimeoutRef.current = setTimeout(() => {
            try {
              // Get the original node data
              const originalNode = data.nodes.find(n => n.id === node.id);
              const cleanNodeData = originalNode ? { ...originalNode } : node;

              // Calculate screen position of the node
              if (graphRef.current && containerRef.current) {
                const camera = graphRef.current.camera();
                const renderer = graphRef.current.renderer();

                if (camera && renderer && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
                  // Create a 3D vector for the node position
                  const nodePosition = new THREE.Vector3(node.x, node.y, node.z);

                  // Project 3D position to screen coordinates
                  const vector = nodePosition.project(camera);

                  // Get the canvas/container dimensions
                  const container = containerRef.current;
                  const rect = container.getBoundingClientRect();

                  // Convert normalized device coordinates to screen coordinates
                  const x = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
                  const y = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;

                  setHoveredNode(cleanNodeData);
                  setTooltipPosition({ x, y });
                }
              }
            } catch (error) {
              console.error("Error in node hover handler:", error);
            }
          }, 300); // 300ms delay before showing tooltip
        } else {
          // Hide tooltip when not hovering
          setHoveredNode(null);
          setTooltipPosition(null);
          
          // Reset cursor if in multi-select mode
          if (selectionMode === 'box' || selectionMode === 'lasso') {
            setCursorStyle('default');
          }
        }
      })
      .onNodeRightClick(node => {
        if (onNodeRightClick && node) {
          try {
            // Get the original node data from the graph data
            const originalNode = data.nodes.find(n => n.id === node.id);
            // Use the original node data to ensure all properties are included
            const cleanNodeData = originalNode ? { ...originalNode } : {
              id: node.id,
              name: node.name,
              category: node.category
            };
            
            // Calculate screen position of the node
            let screenPosition = null;
            if (graphRef.current) {
              const camera = graphRef.current.camera();
              const renderer = graphRef.current.renderer();
              
              if (camera && renderer && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
                // Create a 3D vector for the node position
                const nodePosition = new THREE.Vector3(node.x, node.y, node.z);
                
                // Project 3D position to screen coordinates
                const vector = nodePosition.project(camera);
                
                // Get the canvas/container dimensions
                const container = containerRef.current;
                const rect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
                
                // Convert normalized device coordinates to screen coordinates
                const x = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
                const y = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;
                
                // Add offset to position menu below the node
                const menuOffsetY = 30; // Offset below the node
                
                screenPosition = { x, y: y + menuOffsetY };
              }
            }
            
            // Call the handler with node data and screen position
            onNodeRightClick(cleanNodeData, screenPosition);
          } catch (error) {
            console.error("Error in node right-click handler:", error);
          }
        }
      })
      .onLinkClick(link => {
        // Mark that an edge was clicked to prevent selection from starting
        nodeOrEdgeClickedRef.current = true;
        setTimeout(() => { nodeOrEdgeClickedRef.current = false; }, 100);
        
        if (onLinkClick && link) {
          try {
            // Get the original link data from the graph data
            // First try to find by ID which is the most accurate way to identify a specific link
            let originalLink = null;

            if (link.id) {
              // Try to find the link by its unique ID first
              originalLink = data.links.find(l => l.id === link.id);
            }

            // If not found by ID, try to find by source/target and index
            if (!originalLink) {
              const sourceId = link.source.id || link.source;
              const targetId = link.target.id || link.target;

              // Get all links between these two nodes
              const linksBetweenNodes = data.links.filter(l =>
                l.sourceId === sourceId && l.targetId === targetId
              );

              // If there are multiple links between the same nodes, try to match by curvature
              if (linksBetweenNodes.length > 1 && link.curvature !== undefined) {
                // Find the link with the closest curvature value
                originalLink = linksBetweenNodes.reduce((closest, current) => {
                  const currentDiff = Math.abs((current.curvature || 0) - link.curvature);
                  const closestDiff = closest ? Math.abs((closest.curvature || 0) - link.curvature) : Infinity;
                  return currentDiff < closestDiff ? current : closest;
                }, null);
              } else if (linksBetweenNodes.length > 0) {
                // If we can't match by curvature or there's only one link, use the first one
                originalLink = linksBetweenNodes[0];
              }
            }

            if (originalLink) {
              // Use the original link data with all properties
              onLinkClick(originalLink);
            } else {
              // Fallback if original link not found
              const sourceId = link.source.id || link.source;
              const targetId = link.target.id || link.target;
              const fallbackLink = {
                sourceId: sourceId,
                targetId: targetId,
                id: link.id
              };
              onLinkClick(fallbackLink);
            }
          } catch (error) {
            console.error("Error in link click handler:", error);
          }
        }
      })
      // Add node drag event handlers
      .onNodeDrag((node) => {
        // In INDIVIDUAL mode, only allow dragging if there's significant movement
        // This prevents accidental pinning when just clicking
        if (selectionMode === 'individual') {
          // Store initial position if not set
          if (!node.__dragStartPos) {
            node.__dragStartPos = { x: node.x, y: node.y, z: node.z };
          }
          
          // Calculate drag distance
          const dragDist = Math.sqrt(
            Math.pow(node.x - node.__dragStartPos.x, 2) +
            Math.pow(node.y - node.__dragStartPos.y, 2) +
            Math.pow(node.z - node.__dragStartPos.z, 2)
          );
          
          // Only pin if there's been significant drag movement (threshold of 1 unit)
          // This prevents accidental pinning from clicks
          if (dragDist > 1) {
            node.fx = node.x;
            node.fy = node.y;
            node.fz = node.z;
          }
          return;
        }
        
        // Check if we're in multi-select mode and dragging a selected node
        if ((selectionMode === 'box' || selectionMode === 'lasso') && selectedNodes.has(node.id)) {
          // Check if graphRef is still valid
          if (!graphRef.current) return;
          
          const graphData = graphRef.current.graphData();
          if (!graphData || !graphData.nodes) return;
          
          const draggedNode = graphData.nodes.find(n => n.id === node.id);
          
          if (isMountedRef.current) {
            setCursorStyle('grabbing');
          }
          
          // Store initial positions if not already stored (first drag event)
          if (!draggedNode.__initialDragPos) {
            graphData.nodes.forEach(n => {
              if (selectedNodes.has(n.id)) {
                n.__initialDragPos = { x: n.x, y: n.y, z: n.z };
              }
            });
          }
          
          // Group drag: calculate the delta and move all selected nodes
          if (draggedNode.__initialDragPos) {
            const deltaX = node.x - draggedNode.__initialDragPos.x;
            const deltaY = node.y - draggedNode.__initialDragPos.y;
            const deltaZ = node.z - draggedNode.__initialDragPos.z;
            
            // Move all selected nodes by the same delta
            graphData.nodes.forEach(n => {
              if (selectedNodes.has(n.id) && n.id !== node.id && n.__initialDragPos) {
                n.fx = n.__initialDragPos.x + deltaX;
                n.fy = n.__initialDragPos.y + deltaY;
                n.fz = n.__initialDragPos.z + deltaZ;
                n.x = n.fx;
                n.y = n.fy;
                n.z = n.fz;
              }
            });
          }
          
          // Pin the dragged node at its current position
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        } else {
          // Box/lasso mode but node not in selection
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        }
      })
      .onNodeDragEnd(node => {
        // Pin the node when it's dragged (fix its position)
        if (node) {
          // In INDIVIDUAL mode, only pin if there was significant drag movement
          if (selectionMode === 'individual') {
            // Check if there was actual drag movement
            if (node.__dragStartPos) {
              const dragDist = Math.sqrt(
                Math.pow(node.x - node.__dragStartPos.x, 2) +
                Math.pow(node.y - node.__dragStartPos.y, 2) +
                Math.pow(node.z - node.__dragStartPos.z, 2)
              );
              
              // Only pin if there was significant movement (threshold of 1 unit)
              if (dragDist > 1) {
                pinnedNodesRef.current.add(node.id);
                node.fx = node.x;
                node.fy = node.y;
                node.fz = node.z;
              }
              // Clean up the drag start position
              delete node.__dragStartPos;
            }
            return;
          }
          
          // Mark the node as being manually dragged
          pinnedNodesRef.current.add(node.id);

          // If group dragging in multi-select mode
          if ((selectionMode === 'box' || selectionMode === 'lasso') && selectedNodes.has(node.id)) {
            // Check if graphRef is still valid
            if (graphRef.current) {
              const graphData = graphRef.current.graphData();
              if (graphData && graphData.nodes) {
                // Mark all selected nodes as pinned and clear their initial positions
                selectedNodes.forEach(nodeId => {
                  pinnedNodesRef.current.add(nodeId);
                  const selectedNode = graphData.nodes.find(n => n.id === nodeId);
                  if (selectedNode) {
                    selectedNode.fx = selectedNode.x;
                    selectedNode.fy = selectedNode.y;
                    selectedNode.fz = selectedNode.z;
                    // Clear initial drag position
                    delete selectedNode.__initialDragPos;
                  }
                });
              }
            }
          }

          // Keep the node pinned after drag
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
          
          
          // Cursor will be updated by the mousemove handler when mouse moves
          // Set to default for now, but it will change to 'grab' if still in region
          if (selectionMode !== 'individual' && isMountedRef.current) {
            setCursorStyle('default');
          }
        }
      })
      // Enable node dragging - but it will be disabled for individual mode to prevent accidental movement
      .enableNodeDrag(selectionMode !== 'individual');

    // Configure controls
    if (graphRef.current.controls) {
      const controls = graphRef.current.controls();
      controls.panSpeed = 0.1;
      controls.rotateSpeed = 0.7;
      controls.zoomSpeed = 1.5; // Increased from 1.2 for faster zoom
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;

      // Always enable zoom
      controls.enableZoom = true;
      controls.autoRotate = false;  
      
      // Set controls based on selection mode
      if (selectionMode === 'individual') {
        // Enable rotation and pan for individual selection mode
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,   // Left mouse button for rotation
          MIDDLE: THREE.MOUSE.DOLLY,  // Middle mouse button for zoom
          RIGHT: THREE.MOUSE.PAN      // Right mouse button for pan
        };
      } else {
        // Disable rotation and pan for box/lasso selection modes, but keep zoom enabled
        controls.enabled = true; // Keep enabled to allow zoom
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = true; // Explicitly enable zoom
        // Keep zoom enabled via middle mouse or scroll
        controls.mouseButtons = {
          LEFT: null,                 // Disable left mouse button
          MIDDLE: THREE.MOUSE.DOLLY,  // Middle mouse button for zoom
          RIGHT: null                 // Disable right mouse button
        };
      }

      // Add event listener to update edge render order when camera moves
      controls.addEventListener('change', () => {
        if (graphRef.current) {
          const graphData = graphRef.current.graphData();
          const camera = graphRef.current.camera();
          updateEdgeRenderOrder(graphData, camera, graphRef.current);
        }
      });

      // Adjust min and max distance based on node count
      const nodeCount = data.nodes.length;

      if (controls.minDistance !== undefined) {
        // Minimum distance increases with node count to prevent getting too close to large graphs
        // For small graphs, allow closer zoom (min: 5)
        // For large graphs, prevent getting too close (max: 35)
        if (nodeCount < 50) {
          controls.minDistance = 5; // Small graphs - allow very close zoom
        } else if (nodeCount < 200) {
          controls.minDistance = 8; // Medium graphs - slightly further but still close
        } else if (nodeCount < 500) {
          controls.minDistance = 15; // Large graphs - moderate zoom
        } else {
          controls.minDistance = 20 + Math.min(Math.log10(nodeCount) * 7, 15); // Very large graphs - keep distance (20-35 range)
        }
      }

      if (controls.maxDistance !== undefined) {
        // Maximum distance increases with node count to allow zooming out further for large graphs
        // Small graphs (< 50 nodes): max distance 1000
        // Medium graphs (50-200 nodes): max distance 1500
        // Large graphs (200-1000 nodes): max distance 2000-3000
        // Very large graphs (> 1000 nodes): max distance 3500+
        if (nodeCount < 50) {
          controls.maxDistance = 1000; // Increased from 800
        } else if (nodeCount < 200) {
          controls.maxDistance = 1500; // Increased from 1200
        } else if (nodeCount < 1000) {
          controls.maxDistance = 2000 + Math.floor((nodeCount - 200) / 800 * 1000); // Range: 2000-3000
        } else {
          controls.maxDistance = 3000 + Math.floor(Math.log10(nodeCount) * 500); // Logarithmic scaling for very large graphs
        }
      }
    }

    // Note: Axis arrows are now only displayed when a node is clicked
    // See the selectedNode useEffect for axis arrow implementation

    // *** CRITICAL: Load the graph data into ForceGraph3D ***
    // This must be done AFTER all configuration but BEFORE setting camera position
    graphRef.current.graphData({ nodes: data.nodes, links: data.links });

    // Set camera position: use saved position if provided, else default by node count
    if (data.nodes.length > 0) {
      if (initialCameraPosition?.position && initialCameraPosition?.target && !appliedInitialCameraRef.current) {
        graphRef.current.cameraPosition(
          initialCameraPosition.position,
          initialCameraPosition.target,
          500
        );
        appliedInitialCameraRef.current = true;
      } else {
        const nodeCount = data.nodes.length;
        const cameraDistance = calculateOptimalCameraDistance(nodeCount);
        graphRef.current.cameraPosition(
          { x: 0, y: 0, z: cameraDistance },
          { x: 0, y: 0, z: 0 },
          0
        );
      }


      // Ensure the simulation is properly heated for initial load
      if (graphRef.current._simulation) {
        // Set alpha to a high value to ensure the simulation starts with energy
        graphRef.current._simulation.alpha(0.8).restart();
      }

      // Mark initial load as complete after a short delay
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
    }

    // Store current data as previous for next incremental update
    previousDataRef.current = { nodes: [...data.nodes], links: [...data.links] };

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);

      // Disconnect the ResizeObserver
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (graphRef.current) {
        // Dispose of any gradient textures created for links
        try {
          // Clean up link materials - check if scene exists first
          const scene = graphRef.current.scene?.();
          if (scene && scene.children) {
            const linkObjects = scene.children.find(obj => obj.name === 'links')?.children || [];
            linkObjects.forEach(linkObj => {
              if (linkObj.material && linkObj.material.map) {
                linkObj.material.map.dispose();
              }
            });
          }
        } catch (error) {
          // Scene might already be disposed, ignore
          console.warn("Error disposing gradient textures:", error);
        }

        // Use the centralized cleanup function
        cleanupGraphInstance(graphRef.current);

        // Don't manually remove children - ForceGraph3D's cleanup handles its own DOM
        // React will handle any React-managed children

        // Clear the reference
        graphRef.current = null;

        // Try to release any unused WebGL contexts
        releaseUnusedWebGLContexts();
      }
    };
  }, [data, onNodeClick, graphLayoutMode, hiddenCategories, searchTerm]);

  // Apply saved camera position when it becomes available (e.g. loaded async after mount)
  useEffect(() => {
    if (!graphRef.current || !initialCameraPosition?.position || !initialCameraPosition?.target || appliedInitialCameraRef.current) return;
    if (!data?.nodes?.length) return;
    try {
      graphRef.current.cameraPosition(
        initialCameraPosition.position,
        initialCameraPosition.target,
        500
      );
      appliedInitialCameraRef.current = true;
    } catch (e) {
      console.warn('Failed to apply initial camera position', e);
    }
  }, [initialCameraPosition, data?.nodes?.length]);

  // Show navigation info text only when graph data is actually visible
  useEffect(() => {
    if (!graphRef.current) return;

    const hasNodes = data && data.nodes && data.nodes.length > 0;

    try {
      graphRef.current.showNavInfo(!loading && hasNodes);
    } catch (error) {
      console.error('Error updating navigation info visibility:', error);
    }
  }, [loading, data]);

  // Update node size with balanced approach for performance
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes) return;

    try {
      // Update node size
      graphRef.current.nodeVal(normalizedNodeSize);

      // Get graph data
      const graphData = graphRef.current.graphData();

      // Apply velocities to more nodes to make the change immediately visible
      if (graphData && graphData.nodes && graphData.nodes.length > 0) {
        // Affect more nodes when node size changes to make the effect more visible
        const nodesToAffect = Math.min(10, Math.floor(graphData.nodes.length * 0.15));

        for (let i = 0; i < nodesToAffect; i++) {
          const randomIndex = Math.floor(Math.random() * graphData.nodes.length);
          const node = graphData.nodes[randomIndex];

          // Skip pinned nodes
          if (node.fx !== undefined || node.fy !== undefined || node.fz !== undefined ||
              (node.id && pinnedNodesRef.current.has(node.id))) continue;

          // Apply stronger velocities
          const velocityScale = 0.8;
          node.vx = (Math.random() - 0.5) * velocityScale;
          node.vy = (Math.random() - 0.5) * velocityScale;
          node.vz = (Math.random() - 0.5) * velocityScale;
        }
      }

      // Strongly reheat the simulation to make changes immediately visible
      if (graphRef.current._simulation) {
        // Set alpha to a higher value (0.7) to ensure the simulation is properly reheated
        graphRef.current._simulation.alpha(0.7).restart();
        // Extend animation duration by 2 seconds when slider is adjusted
        const currentCooldownTime = data.nodes.length > 100 ? 3500 : 4000;
        graphRef.current.cooldownTime(currentCooldownTime + 2000);
      }

      // Ensure animation is running
      if (typeof graphRef.current.resumeAnimation === 'function') {
        graphRef.current.resumeAnimation();
      }

      // Refresh the graph to apply changes immediately
      graphRef.current.refresh();

    } catch (error) {
      console.error("Error updating node size:", error);
    }
  }, [normalizedNodeSize, data]);

  // Update edge length and thickness when they change
  useEffect(() => {
    if (!graphRef.current) return;

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Check if the edge length has actually changed
    if (edgeLength === lastEdgeLengthRef.current && edgeThickness === lastEdgeLengthRef.current) {
      return; // No change, skip update
    }

    // Update the last applied edge length
    lastEdgeLengthRef.current = edgeLength;

    // Always update the basic properties immediately
    try {
      // Update link distance using the public API
      if (graphRef.current.d3Force) {
        const linkForce = graphRef.current.d3Force('link');
        if (linkForce && typeof linkForce.distance === 'function') {
          linkForce.distance(normalizedEdgeLength);

          // Adjust link strength based on edge length
          // Shorter edges have stronger links to keep connected nodes closer
          if (typeof linkForce.strength === 'function') {
            const linkStrength = 1 - (edgeLength / 200); // Inverse relationship with edge length
            linkForce.strength(link => {
              // Give more strength to links with fewer connections
              const sourceConnections = link.source.links?.length || 1;
              const targetConnections = link.target.links?.length || 1;
              const connectionFactor = 1 / Math.sqrt((sourceConnections + targetConnections) / 2);
              return Math.min(1, linkStrength * connectionFactor);
            });
          }
        }
      }

      // Update link width to reflect the new edge thickness
      const graphData = graphRef.current.graphData();

      // Update link appearance
      graphRef.current
        .linkWidth(link => {
          // Use the helper function to get link styling
          const graphData = graphRef.current.graphData();
          const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
          return styling.width;
        })
        .linkCurvature(link => link.curvature || 0)
        .linkCurveRotation(link => link.curveRotation || 0);

      // Gently reheat the simulation for immediate visual feedback
      if (graphRef.current._simulation) {
        graphRef.current._simulation.alpha(0.3).restart();
        // Extend animation duration by 2 seconds when slider is adjusted
        const graphData = graphRef.current.graphData();
        const currentCooldownTime = graphData && graphData.nodes ? (graphData.nodes.length > 100 ? 3500 : 4000) : 4000;
        if (graphRef.current.cooldownTime) {
          graphRef.current.cooldownTime(currentCooldownTime + 2000);
        }
      }


      // Debounce the more expensive operations (complete reset and node velocity changes)
      // This will only execute after the user stops moving the slider for a short period
      debounceTimerRef.current = setTimeout(() => {
        try {
          if (!graphRef.current) return;

          // Skip simulation reset during initial load
          if (isInitialLoadRef.current) {
            // Just reheat the simulation instead
            if (graphRef.current._simulation) {
              graphRef.current._simulation.alpha(0.8).restart();
              // Extend animation duration by 2 seconds when slider is adjusted
              const graphData = graphRef.current.graphData();
              const currentCooldownTime = graphData && graphData.nodes ? (graphData.nodes.length > 100 ? 3500 : 4000) : 4000;
              if (graphRef.current.cooldownTime) {
                graphRef.current.cooldownTime(currentCooldownTime + 2000);
              }
            }
          } else {
            // Completely reset and restart the simulation to make changes immediately visible
            completelyResetSimulation(graphRef.current, false);
            // Extend animation duration by 2 seconds when slider is adjusted
            const graphData = graphRef.current.graphData();
            const currentCooldownTime = graphData && graphData.nodes ? (graphData.nodes.length > 100 ? 3500 : 4000) : 4000;
            if (graphRef.current.cooldownTime) {
              graphRef.current.cooldownTime(currentCooldownTime + 2000);
            }
          }

          // Apply stronger velocities to more nodes to make the change more visible
          const graphData = graphRef.current.graphData();
          if (graphData && graphData.nodes && graphData.nodes.length > 0) {
            // Affect more nodes when edge length changes to make the effect more visible
            const nodesToAffect = Math.min(20, Math.floor(graphData.nodes.length * 0.3));

            for (let i = 0; i < nodesToAffect; i++) {
              const randomIndex = Math.floor(Math.random() * graphData.nodes.length);
              const node = graphData.nodes[randomIndex];

              // Skip pinned nodes
              if (node.fx !== undefined || node.fy !== undefined || node.fz !== undefined ||
                  (node.id && pinnedNodesRef.current.has(node.id))) continue;

              // Apply stronger velocities to make the change more visible
              const velocityScale = 2.0;
              node.vx = (Math.random() - 0.5) * velocityScale;
              node.vy = (Math.random() - 0.5) * velocityScale;
              node.vz = (Math.random() - 0.5) * velocityScale;
            }
          }
        } catch (error) {
          console.error("Error in debounced edge length update:", error);
        }
      }, 50); // 50ms debounce time - very short for immediate feedback while still preventing excessive updates
    } catch (error) {
      console.error("Error updating edge properties:", error);
    }
  }, [normalizedEdgeLength, edgeThickness, selectedEdge]);

  // Update force strength with balanced approach for performance
  useEffect(() => {
    if (!graphRef.current) return;

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Check if the force strength has actually changed
    if (forceStrength === lastForceStrengthRef.current) {
      return; // No change, skip update
    }

    // Update the last applied force strength
    lastForceStrengthRef.current = forceStrength;

    // Always update the basic properties immediately
    try {
      // Update force strength using the public API
      if (graphRef.current.d3Force) {
        // Update charge force strength
        const chargeForce = graphRef.current.d3Force('charge');
        if (chargeForce && typeof chargeForce.strength === 'function') {
          chargeForce.strength(normalizedForce);
        }

        // Update center force strength based on force strength
        const centerForce = graphRef.current.d3Force('center');
        if (centerForce && typeof centerForce.strength === 'function') {
          // Stronger center force when force strength is higher
          centerForce.strength(normalizedCenterForce); // Using normalized center force value
        }

        // Update collision force radius based on node size and force strength
        const collisionForce = graphRef.current.d3Force('collision');
        if (collisionForce && typeof collisionForce.radius === 'function') {
          // Larger collision radius when force strength is higher
          collisionForce.radius(normalizedNodeSize * (1.2 + (forceStrength / 100) * 0.8));
        }

        // Update X and Y force strengths
        const xForce = graphRef.current.d3Force('x');
        const yForce = graphRef.current.d3Force('y');
        if (xForce && typeof xForce.strength === 'function') {
          xForce.strength(normalizedAxisForce); // Using normalized axis force value
        }
        if (yForce && typeof yForce.strength === 'function') {
          yForce.strength(normalizedAxisForce); // Using normalized axis force value
        }

        // Update Z force when force strength changes using native d3-force-3d
        const zForce = graphRef.current.d3Force('z');
        if (zForce && typeof zForce.strength === 'function') {
          zForce.strength(normalizedAxisForce); // Using normalized axis force value
        }
      }

      // Gently reheat the simulation for immediate visual feedback
      if (graphRef.current._simulation) {
        graphRef.current._simulation.alpha(0.3).restart();
        // Extend animation duration by 2 seconds when slider is adjusted
        const graphData = graphRef.current.graphData();
        const currentCooldownTime = graphData && graphData.nodes ? (graphData.nodes.length > 100 ? 3500 : 4000) : 4000;
        if (graphRef.current.cooldownTime) {
          graphRef.current.cooldownTime(currentCooldownTime + 2000);
        }
      }


      // Debounce the more expensive operations (complete reset and node velocity changes)
      // This will only execute after the user stops moving the slider for a short period
      debounceTimerRef.current = setTimeout(() => {
        try {
          if (!graphRef.current) return;

          // Skip simulation reset during initial load
          if (isInitialLoadRef.current) {
            // Just reheat the simulation instead
            if (graphRef.current._simulation) {
              graphRef.current._simulation.alpha(0.8).restart();
              // Extend animation duration by 2 seconds when slider is adjusted
              const graphData = graphRef.current.graphData();
              const currentCooldownTime = graphData && graphData.nodes ? (graphData.nodes.length > 100 ? 3500 : 4000) : 4000;
              if (graphRef.current.cooldownTime) {
                graphRef.current.cooldownTime(currentCooldownTime + 2000);
              }
            }
          } else {
            // Completely reset and restart the simulation to make changes immediately visible
            completelyResetSimulation(graphRef.current, false);
            // Extend animation duration by 2 seconds when slider is adjusted
            const graphData = graphRef.current.graphData();
            const currentCooldownTime = graphData && graphData.nodes ? (graphData.nodes.length > 100 ? 3500 : 4000) : 4000;
            if (graphRef.current.cooldownTime) {
              graphRef.current.cooldownTime(currentCooldownTime + 2000);
            }
          }

          // Apply stronger velocities to more nodes to make the change immediately visible
          const graphData = graphRef.current.graphData();
          if (graphData && graphData.nodes && graphData.nodes.length > 0) {
            // Affect more nodes when force strength changes to make the effect more visible
            const nodesToAffect = Math.min(20, Math.floor(graphData.nodes.length * 0.3));

            for (let i = 0; i < nodesToAffect; i++) {
              const randomIndex = Math.floor(Math.random() * graphData.nodes.length);
              const node = graphData.nodes[randomIndex];

              // Skip pinned nodes
              if (node.fx !== undefined || node.fy !== undefined || node.fz !== undefined ||
                  (node.id && pinnedNodesRef.current.has(node.id))) continue;

              // Apply stronger velocities in all directions based on force strength
              const velocityScale = 2.0 + (forceStrength / 100) * 1.0;
              node.vx = (Math.random() - 0.5) * velocityScale;
              node.vy = (Math.random() - 0.5) * velocityScale;
              node.vz = (Math.random() - 0.5) * velocityScale;
            }
          }
        } catch (error) {
          console.error("Error in debounced force strength update:", error);
        }
      }, 50); // 50ms debounce time - very short for immediate feedback while still preventing excessive updates
    } catch (error) {
      console.error("Error updating force strength:", error);
    }
  }, [normalizedForce]);

  // Maintain fixed dimensions when data changes
  useEffect(() => {
    if (!graphRef.current || !graphRef.current._fixedWidth || !graphRef.current._fixedHeight) return;

    // Apply the stored fixed dimensions to maintain consistent size
    graphRef.current.width(graphRef.current._fixedWidth).height(graphRef.current._fixedHeight);
  }, [data]);

  // Update node appearance (node size, label size and selection) with balanced approach
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes) return;

    try {
      // Update node three object for node size, label size and selection highlighting
      graphRef.current.nodeThreeObject(node => {
        try {
          // Check if node type is hidden
          const nodeType = node.node_type || node.type || node.category;
          const isHidden = nodeType && hiddenCategories.has(nodeType);
          const darkGray = '#404040';
          
          // Use cached node color, or get color from node type, or dark gray if hidden
          let color = isHidden ? darkGray : (nodeColorsRef.current[node.id] || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4'));
          // Check if this node is selected (either single selection or multi-selection)
          const isSelected = (selectedNode && node.id === selectedNode.id) || selectedNodes.has(node.id);
          // Get the original node data from nodeDataMapRef for reliable access to all properties
          // This map is populated with complete node data when data changes
          const originalNode = nodeDataMapRef.current.get(node.id) || data.nodes.find(n => n.id === node.id) || node;
          
          // Resolve label text: for AMOUNT/FUNDING nodes, show amount with $ instead of ID/GID
          const nodeTypeLower = (nodeType || '').toLowerCase();
          let labelText;
          
          if (nodeTypeLower === 'amount' || nodeTypeLower === 'funding') {
            // For Amount/Funding nodes, get amount value
            // Check ALL possible property names - same logic as tooltip
            let amount = null;
            
            // Direct property access (most common names) - check originalNode first (complete data)
            amount = originalNode.Amount ?? originalNode.amount ?? originalNode.value ?? 
                    originalNode.properties?.Amount ?? originalNode.properties?.amount ?? 
                    originalNode.properties?.value ?? null;
            
            // If still not found, search for any property containing 'amount' in the name
            if (amount === null && originalNode) {
              for (const key of Object.keys(originalNode)) {
                if (key.toLowerCase().includes('amount') && originalNode[key] !== null && originalNode[key] !== undefined) {
                  amount = originalNode[key];
                  break;
                }
              }
            }
            
            // Also check the ForceGraph internal node object
            if (amount === null) {
              amount = node.Amount ?? node.amount ?? node.value ?? null;
              if (amount === null) {
                for (const key of Object.keys(node)) {
                  if (key.toLowerCase().includes('amount') && node[key] !== null && node[key] !== undefined) {
                    amount = node[key];
                    break;
                  }
                }
              }
            }
            
            if (amount !== null && amount !== undefined) {
              // Format number with commas and $ prefix
              const amountStr = String(amount);
              // Remove any existing $ and non-numeric chars except decimal point
              const cleanAmount = amountStr.replace(/[^0-9.-]/g, '');
              const numAmount = parseFloat(cleanAmount);
              
              if (!isNaN(numAmount)) {
                labelText = '$' + numAmount.toLocaleString();
              } else {
                // If can't parse as number, just add $ prefix
                labelText = '$' + amountStr;
              }
            } else {
              // Fallback: use name but still format with $ if it looks numeric
              const nameStr = String(originalNode.name || originalNode.id || '');
              const cleanName = nameStr.replace(/[^0-9.-]/g, '');
              const numName = parseFloat(cleanName);
              if (!isNaN(numName) && numName > 0) {
                labelText = '$' + numName.toLocaleString();
              } else {
                labelText = originalNode.name || originalNode.id;
              }
            }
          } else {
            // For other node types, use name or id
            labelText = originalNode.name || originalNode.id;
          }
          // Create sprite
          const sprite = new SpriteText(labelText);
          sprite.color = '#fff';
          sprite.textHeight = normalizedLabelSize;
          sprite.backgroundColor = color;
          // Calculate padding based on both node size and label size
          // For minimum node and label sizes, we want minimal padding
          const basePadding = 0.2; // Reduced from 0.5 for smaller minimum padding
          const nodeSizeComponent = (normalizedNodeSize - 4) * 0.12; // Reduced from 0.15

          // Calculate padding that scales with node size but is also affected by label size
          let calculatedPadding = basePadding + nodeSizeComponent;

          // Further reduce padding when both node size and label size are small
          if (normalizedNodeSize < 6 && normalizedLabelSize < 1.8) {
            calculatedPadding = Math.max(0.1, calculatedPadding * 0.7); // Reduce padding but keep a minimum
          }

          sprite.padding = calculatedPadding;

          // Calculate border radius based on node size and label size
          // We need to consider both node size and label size to prevent distortion
          const minNodeSize = 4; // Minimum normalized node size
          const maxNodeSize = 12; // Maximum normalized node size
          const minBorderRadius = 0.5; // Minimum border radius
          const maxBorderRadius = 2.5; // Reduced maximum border radius to prevent distortion

          // Calculate the border radius proportionally to the node size
          const borderRadiusScale = (normalizedNodeSize - minNodeSize) / (maxNodeSize - minNodeSize);

          // Base border radius calculation
          let calculatedBorderRadius = minBorderRadius + borderRadiusScale * (maxBorderRadius - minBorderRadius);

          // Apply additional constraints based on the ratio between node size and label size
          // When label size is small and node size is large, we need to limit the border radius
          const sizeRatio = normalizedNodeSize / normalizedLabelSize;

          // If node is much larger than the label, cap the border radius
          if (sizeRatio > 3) {
            // Apply a stricter cap when the ratio is very high
            calculatedBorderRadius = Math.min(calculatedBorderRadius, 1.8);
          }

          // Final border radius with absolute maximum cap
          sprite.borderRadius = Math.min(calculatedBorderRadius, 2.5);

          // Add border for selected nodes
          if (isSelected) {
            sprite.borderColor = '#ffffff';
            sprite.borderWidth = 0.5; // Doubled from 0.25 to 0.5 for more visible selection

            // Add minimal extra padding for selected nodes, scaled by node size
            const extraPadding = Math.max(0.1, normalizedNodeSize * 0.02);
            sprite.padding += extraPadding;
          }

          // Ensure nodes are always rendered on top of edges
          sprite.renderOrder = 1000; // Higher than any edge render order

          return sprite;
        } catch (error) {
          console.error("Error creating node sprite:", error);
          return null;
        }
      });

      // NOTE: Removed velocity-applying code from here to prevent graph movement when clicking nodes
      // The velocity code was causing nodes to shift when selectedNode changed because this 
      // useEffect has selectedNode in its dependencies. Velocity application for label size 
      // changes is now handled in a separate effect below.

      // Ensure animation is running
      if (typeof graphRef.current.resumeAnimation === 'function') {
        graphRef.current.resumeAnimation();
      }

      // Refresh the graph to update node appearance (especially for selected node border)
      graphRef.current.refresh();

    } catch (error) {
      console.error("Error updating node appearance:", error);
    }
  }, [normalizedLabelSize, normalizedNodeSize, selectedNode, selectedNodes, data, hiddenCategories]);

  // Update visual appearance when multi-selection (box/lasso) changes
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes) return;

    try {
      // Refresh node appearance to show selection highlights
      graphRef.current.nodeThreeObject(node => {
        try {
          const nodeType = node.node_type || node.type || node.category;
          const isHidden = nodeType && hiddenCategories.has(nodeType);
          const darkGray = '#404040';
          
          let color = isHidden ? darkGray : (nodeColorsRef.current[node.id] || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4'));
          const isSelected = (selectedNode && node.id === selectedNode.id) || selectedNodes.has(node.id);
          
          // Get the original node data from nodeDataMapRef for reliable access to all properties
          const originalNode = nodeDataMapRef.current.get(node.id) || node;
          
          // Resolve label text: for AMOUNT/FUNDING nodes, show amount with $ instead of ID/GID
          const nodeTypeLower = (nodeType || '').toLowerCase();
          let labelText;
          
          if (nodeTypeLower === 'amount' || nodeTypeLower === 'funding') {
            // For Amount/Funding nodes, get amount value - same logic as tooltip
            let amount = originalNode.Amount ?? originalNode.amount ?? originalNode.value ?? 
                        originalNode.properties?.Amount ?? originalNode.properties?.amount ?? 
                        originalNode.properties?.value ?? null;
            
            // Search for any property containing 'amount' in the name
            if (amount === null && originalNode) {
              for (const key of Object.keys(originalNode)) {
                if (key.toLowerCase().includes('amount') && originalNode[key] !== null && originalNode[key] !== undefined) {
                  amount = originalNode[key];
                  break;
                }
              }
            }
            
            if (amount !== null && amount !== undefined) {
              const amountStr = String(amount);
              const cleanAmount = amountStr.replace(/[^0-9.-]/g, '');
              const numAmount = parseFloat(cleanAmount);
              labelText = !isNaN(numAmount) ? '$' + numAmount.toLocaleString() : '$' + amountStr;
            } else {
              labelText = originalNode.name || originalNode.id;
            }
          } else {
            labelText = originalNode.name || originalNode.id;
          }
          
          const sprite = new SpriteText(labelText);
          sprite.color = '#fff';
          sprite.textHeight = normalizedLabelSize;
          sprite.backgroundColor = color;
          
          const basePadding = 0.2;
          const nodeSizeComponent = (normalizedNodeSize - 4) * 0.12;
          let calculatedPadding = basePadding + nodeSizeComponent;
          
          if (normalizedNodeSize < 6 && normalizedLabelSize < 1.8) {
            calculatedPadding = Math.max(0.1, calculatedPadding * 0.7);
          }
          
          sprite.padding = calculatedPadding;
          
          const minNodeSize = 4;
          const maxNodeSize = 12;
          const minBorderRadius = 0.5;
          const maxBorderRadius = 2.5;
          const borderRadiusScale = (normalizedNodeSize - minNodeSize) / (maxNodeSize - minNodeSize);
          let calculatedBorderRadius = minBorderRadius + borderRadiusScale * (maxBorderRadius - minBorderRadius);
          const sizeRatio = normalizedNodeSize / normalizedLabelSize;
          
          if (sizeRatio > 3) {
            calculatedBorderRadius = Math.min(calculatedBorderRadius, 1.8);
          }
          
          sprite.borderRadius = Math.min(calculatedBorderRadius, 2.5);
          
          if (isSelected) {
            sprite.borderColor = '#ffffff';
            sprite.borderWidth = 0.5;
            const extraPadding = Math.max(0.1, normalizedNodeSize * 0.02);
            sprite.padding += extraPadding;
          }
          
          sprite.renderOrder = 1000;
          return sprite;
        } catch (error) {
          console.error("Error creating node sprite:", error);
          return null;
        }
      });

      // Refresh link appearance to show selection highlights
      graphRef.current.linkColor(graphRef.current.linkColor());
      graphRef.current.linkWidth(graphRef.current.linkWidth());
      graphRef.current.linkOpacity(graphRef.current.linkOpacity());

      // Trigger graph refresh
      graphRef.current.refresh();
    } catch (error) {
      console.error("Error updating multi-selection appearance:", error);
    }
  }, [selectedNodes, selectedEdges, selectedNode, normalizedNodeSize, normalizedLabelSize, hiddenCategories, data]);

  // Update node and edge colors when hiddenCategories or searchTerm changes
  // IMPORTANT: Only update colors, never reset graph structure/positions
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes) return;

    const darkGray = '#404040';
    const searchDimmedColor = '#2A2A2A';
    
    // Update search matches
    searchMatchesRef.current = new Set();
    data.nodes.forEach(node => {
      if (nodeMatchesSearch(node, searchTerm)) {
        searchMatchesRef.current.add(node.id);
      }
    });
    
    // Update node colors cache based on hiddenCategories and searchTerm
    data.nodes.forEach(node => {
      const nodeType = node.node_type || node.type || node.category;
      const isHidden = nodeType && hiddenCategories.has(nodeType);
      const matchesSearch = searchMatchesRef.current.has(node.id);
      
      if (isHidden) {
        nodeColorsRef.current[node.id] = darkGray;
      } else if (!matchesSearch && searchTerm && searchTerm.trim() !== '') {
        // Dim nodes that don't match search
        nodeColorsRef.current[node.id] = searchDimmedColor;
      } else {
        // Restore original color if not hidden - use getNodeTypeColor based on node type
        nodeColorsRef.current[node.id] = node.color || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4');
      }
    });

    // Get current graph data (don't modify it, just use it for reference)
    const currentGraphData = graphRef.current.graphData();
    if (!currentGraphData || !currentGraphData.nodes) return;

    // Update graph node colors function (this updates colors without resetting positions)
    graphRef.current.nodeColor(node => {
      const nodeType = node.node_type || node.type || node.category;
      const isHidden = nodeType && hiddenCategories.has(nodeType);
      const matchesSearch = searchMatchesRef.current.has(node.id);
      
      if (isHidden) {
        return darkGray;
      }
      if (!matchesSearch && searchTerm && searchTerm.trim() !== '') {
        return searchDimmedColor;
      }
      // Use cached color or get color from node type
      return nodeColorsRef.current[node.id] || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4');
    });

    // Update nodeThreeObject to reflect hidden state
    // ForceGraph3D will automatically recreate sprites for existing nodes when this function changes
    graphRef.current.nodeThreeObject(node => {
      try {
        // Check if node type is hidden
        const nodeType = node.node_type || node.type || node.category;
        const isHidden = nodeType && hiddenCategories.has(nodeType);
        const darkGray = '#404040';
        
        // Use cached node color, or get color from node type, or dark gray if hidden
        let color = isHidden ? darkGray : (nodeColorsRef.current[node.id] || (nodeType ? getNodeTypeColor(nodeType) : '#1f77b4'));
        // Check if this node is selected (either single selection or multi-selection)
        const isSelected = (selectedNode && node.id === selectedNode.id) || selectedNodes.has(node.id);
        
        // Get the original node data from nodeDataMapRef for reliable access to all properties
        const originalNode = nodeDataMapRef.current.get(node.id) || node;
        
        // Resolve label text: for AMOUNT/FUNDING nodes, show amount with $ instead of ID/GID
        const nodeTypeLower = (nodeType || '').toLowerCase();
        let labelText;
        
        if (nodeTypeLower === 'amount' || nodeTypeLower === 'funding') {
          // For Amount/Funding nodes, get amount value - same logic as tooltip
          let amount = originalNode.Amount ?? originalNode.amount ?? originalNode.value ?? 
                      originalNode.properties?.Amount ?? originalNode.properties?.amount ?? 
                      originalNode.properties?.value ?? null;
          
          // Search for any property containing 'amount' in the name
          if (amount === null && originalNode) {
            for (const key of Object.keys(originalNode)) {
              if (key.toLowerCase().includes('amount') && originalNode[key] !== null && originalNode[key] !== undefined) {
                amount = originalNode[key];
                break;
              }
            }
          }
          
          if (amount !== null && amount !== undefined) {
            const amountStr = String(amount);
            const cleanAmount = amountStr.replace(/[^0-9.-]/g, '');
            const numAmount = parseFloat(cleanAmount);
            labelText = !isNaN(numAmount) ? '$' + numAmount.toLocaleString() : '$' + amountStr;
          } else {
            labelText = originalNode.name || originalNode.id;
          }
        } else {
          labelText = originalNode.name || originalNode.id;
        }
        
        // Create sprite
        const sprite = new SpriteText(labelText);
        sprite.color = '#fff';
        sprite.textHeight = normalizedLabelSize;
        sprite.backgroundColor = color;
        // Calculate padding based on both node size and label size
        const basePadding = 0.2;
        const nodeSizeComponent = (normalizedNodeSize - 4) * 0.12;
        let calculatedPadding = basePadding + nodeSizeComponent;

        if (normalizedNodeSize < 6 && normalizedLabelSize < 1.8) {
          calculatedPadding = Math.max(0.1, calculatedPadding * 0.7);
        }

        sprite.padding = calculatedPadding;

        // Calculate border radius
        const minNodeSize = 4;
        const maxNodeSize = 12;
        const minBorderRadius = 0.5;
        const maxBorderRadius = 2.5;
        const borderRadiusScale = (normalizedNodeSize - minNodeSize) / (maxNodeSize - minNodeSize);
        let calculatedBorderRadius = minBorderRadius + borderRadiusScale * (maxBorderRadius - minBorderRadius);
        const sizeRatio = normalizedNodeSize / normalizedLabelSize;

        if (sizeRatio > 3) {
          calculatedBorderRadius = Math.min(calculatedBorderRadius, 1.8);
        }

        sprite.borderRadius = Math.min(calculatedBorderRadius, 2.5);

        // Add border for selected nodes
        if (isSelected) {
          sprite.borderColor = '#ffffff';
          sprite.borderWidth = 0.5;
          const extraPadding = Math.max(0.1, normalizedNodeSize * 0.02);
          sprite.padding += extraPadding;
        }

        // Ensure nodes are always rendered on top of edges
        sprite.renderOrder = 1000;

        return sprite;
      } catch (error) {
        console.error("Error creating node sprite:", error);
        return null;
      }
    });

    // Update linkMaterial to use current hiddenCategories
    graphRef.current.linkMaterial((link) => {
      // Check if graphRef is still valid (component may have unmounted)
      if (!graphRef.current) return null;
      
      const graphData = graphRef.current.graphData();
      if (!graphData) return null;
      
      const nodeColors = nodeColorsRef.current;

      const styling = getLinkStyling(link, selectedEdge, nodeColors, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm, selectedEdges);

      // Check cache first for performance
      const isCurved = link.curvature && link.curvature > 0;
      const cachedMaterial = materialCacheRef.current.get(
        styling.color,
        styling.opacity,
        !styling.isSelected,
        styling.sourceColor,
        styling.targetColor
      );

      if (cachedMaterial) {
        return cachedMaterial;
      }

      // Create a material based on whether it's selected or should have a gradient
      let material;
      if (styling.isSelected) {
        material = new THREE.MeshLambertMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 1.0,
          depthWrite: false,
          depthTest: true,
          alphaTest: 0.01
        });
      } else {
        const sourceColor = new THREE.Color(styling.sourceColor);
        const targetColor = new THREE.Color(styling.targetColor);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        let gradient;
        if (isCurved) {
          gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, `rgb(${sourceColor.r * 255}, ${sourceColor.g * 255}, ${sourceColor.b * 255})`);
          gradient.addColorStop(1, `rgb(${targetColor.r * 255}, ${targetColor.g * 255}, ${targetColor.b * 255})`);
        } else {
          gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
          gradient.addColorStop(0, `rgb(${targetColor.r * 255}, ${targetColor.g * 255}, ${targetColor.b * 255})`);
          gradient.addColorStop(1, `rgb(${sourceColor.r * 255}, ${sourceColor.g * 255}, ${sourceColor.b * 255})`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: styling.opacity,
          depthWrite: false,
          depthTest: true,
          alphaTest: 0.01
        });
      }

      // Cache the material for reuse
      materialCacheRef.current.set(
        styling.color,
        styling.opacity,
        !styling.isSelected,
        styling.sourceColor,
        styling.targetColor,
        material
      );

      return material;
    });

    // Update link colors, width, and opacity functions
    const graphData = graphRef.current.graphData();

    graphRef.current
      .linkColor(link => {
        const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
        return styling.color;
      })
      .linkWidth(link => {
        const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
        return styling.width;
      })
      .linkOpacity(link => {
        const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
        return styling.opacity;
      });

    // CRITICAL: Only refresh visual appearance, NEVER reset graph structure
    // The updated functions (nodeColor, nodeThreeObject, linkMaterial, etc.) will be used
    // for the next render cycle, updating colors without affecting positions
    graphRef.current.refresh();
    
    // DO NOT restart simulation, DO NOT clear graph data, DO NOT re-set graph data
    // These operations would reset node positions and destroy the graph structure
    // NOTE: selectedNode removed from dependencies to prevent unnecessary updates that cause node shifts
    // Selection highlighting is handled by dedicated useEffects above
  }, [hiddenCategories, data, selectedEdge, edgeThickness, normalizedLabelSize, normalizedNodeSize, searchTerm, Array.from(selectedNodes).join(','), Array.from(selectedEdges).join(',')]);

  // Track previously selected node for reference only
  // Note: We no longer pin/unpin nodes on selection - only camera focuses on them
  // This ensures the graph shape remains stable when clicking nodes
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes) return;

    // Update the previous selected node reference (for tracking purposes only)
    if (selectedNode) {
      previousSelectedNodeRef.current = selectedNode.id;
      
      // CRITICAL: Freeze the simulation to prevent nodes from moving
      // This applies to BOTH individual and multi-select modes
      if (graphRef.current._simulation) {
        graphRef.current._simulation.alpha(0);
        graphRef.current._simulation.stop();
      }
      
      // Do NOT call refresh() - it can restart simulation and cause hierarchical rearrangement
      // Selection highlighting is handled by dedicated useEffects
      return;
    } else {
      previousSelectedNodeRef.current = null;
    }

    // Only refresh when deselecting (selectedNode is null)
    // In tree layout, avoid refreshing to prevent edge shape changes
    if (graphRef.current && graphLayoutMode !== 'tree') {
      graphRef.current.refresh();
    }
  }, [selectedNode, data, graphLayoutMode, selectionMode]);

  // Smoothly move camera to the selected node and show axis arrows
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes) return;

    const scene = graphRef.current.scene();
    if (!scene) return;

    // Remove existing axis helpers (cleanup in case any remain)
    const existingAxes = scene.children.filter(obj => obj.userData?.isAxisHelper);
    existingAxes.forEach(axis => scene.remove(axis));

    // If no node is selected, don't proceed with camera focus
    if (!selectedNode) {
      return;
    }

    // Skip camera focusing during box or lasso selection modes
    if (selectionMode === 'box' || selectionMode === 'lasso') {
      return;
    }

    let animationFrameId = null;
    let focusTimer = null;

    focusTimer = setTimeout(() => {
      const camera = graphRef.current.camera();
      const controls = graphRef.current.controls();
      const graphData = graphRef.current.graphData();

      if (!camera || !controls || !graphData) return;

      const node = graphData.nodes.find(n => n.id === selectedNode.id);
      if (!node || node.x === undefined || node.y === undefined || node.z === undefined) {
        return;
      }

      const nodePosition = new THREE.Vector3(node.x, node.y, node.z);
      const nodeCount = graphData.nodes.length;

      // Choose an offset distance based on graph size
      let focusDistance;
      if (nodeCount < 50) {
        focusDistance = 30;
      } else if (nodeCount < 200) {
        focusDistance = 50;
      } else if (nodeCount < 500) {
        focusDistance = 80;
      } else {
        focusDistance = 120;
      }

      const cameraOffset = new THREE.Vector3(
        focusDistance * 0.6,
        focusDistance * 0.6,
        focusDistance
      );
      const cameraPosition = nodePosition.clone().add(cameraOffset);

      const animateCamera = () => {
        const currentTarget = controls.target.clone();
        const currentPosition = camera.position.clone();
        const targetPosition = nodePosition.clone();
        const newCameraPosition = cameraPosition.clone();

        const lerpFactor = 0.15;
        const newTarget = currentTarget.lerp(targetPosition, lerpFactor);
        const newPos = currentPosition.lerp(newCameraPosition, lerpFactor);

        controls.target.copy(newTarget);
        camera.position.copy(newPos);
        controls.update();

        const distanceToTarget = newTarget.distanceTo(targetPosition);
        const distanceToPos = newPos.distanceTo(newCameraPosition);

        if (distanceToTarget > 0.5 || distanceToPos > 0.5) {
          animationFrameId = requestAnimationFrame(animateCamera);
        }
      };

      animateCamera();
    }, 200);

    return () => {
      if (focusTimer) {
        clearTimeout(focusTimer);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [selectedNode, data, selectionMode]);

  // Handle selected edge highlighting and edge thickness changes
  useEffect(() => {
    if (!graphRef.current || !data) return;

    // Force a refresh when the selected edge changes or edge thickness changes to ensure highlighting is applied
    if (graphRef.current) {
      // Update link appearance to reflect the selected edge
      // Get link colors from the current graph data
      const graphData = graphRef.current.graphData();

      graphRef.current
        .linkColor(link => {
          // Use the helper function to get link styling
          const graphData = graphRef.current.graphData();
          const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
          return styling.color;
        })
        .linkWidth(link => {
          // Use the helper function to get link styling
          const graphData = graphRef.current.graphData();
          const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
          return styling.width;
        })
        .linkOpacity(link => {
          // Use the helper function to get link styling
          const graphData = graphRef.current.graphData();
          const styling = getLinkStyling(link, selectedEdge, nodeColorsRef.current, linkColors, edgeThickness, hiddenCategories, graphData, searchMatchesRef.current, searchTerm);
          return styling.opacity;
        })
        .linkCurvature(link => link.curvature || 0)
        .linkCurveRotation(link => link.curveRotation || 0);

      // Refresh the graph to apply changes immediately
      graphRef.current.refresh();

      // Update edge render order after refresh
      setTimeout(() => {
        if (graphRef.current) {
          const graphData = graphRef.current.graphData();
          const camera = graphRef.current.camera();
          updateEdgeRenderOrder(graphData, camera, graphRef.current);
        }
      }, 50);
    }
  }, [selectedEdge, data, edgeThickness]);

  // Toggle between 2D and 3D views
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes) return;

    const graphData = graphRef.current.graphData();
    const camera = graphRef.current.camera();
    const controls = graphRef.current.controls();

    if (!graphData || !camera || !controls) return;

    if (!is3D) {
      // Preserve current camera-target distance to avoid apparent shrink
      const currentTarget = controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
      const currentDistance = camera.position.distanceTo(currentTarget);
      lastCameraDistanceRef.current = currentDistance;

      // Flatten nodes on Z and disable rotation
      graphData.nodes.forEach(node => {
        node.z = 0;
        node.fz = 0;
        node.vz = 0;
        // Keep current xy pinning, but z should not stay pinned in 2D mode
        node.fx = node.fx;
        node.fy = node.fy;
        node.fz = 0;
      });

      const zForce = graphRef.current.d3Force && graphRef.current.d3Force('z');
      if (zForce && typeof zForce.strength === 'function') {
        zForce.strength(0);
      }

      // Lock camera to top-down view
      controls.enableRotate = false;
      controls.minPolarAngle = Math.PI / 2;
      controls.maxPolarAngle = Math.PI / 2;
      const zDistance = currentDistance || calculateOptimalCameraDistance(graphData.nodes.length);
      camera.position.set(currentTarget.x, currentTarget.y, currentTarget.z + zDistance);
      controls.target.copy(currentTarget);
      controls.update();
    } else {
      // Re-enable Z force and rotation
      const zForce = graphRef.current.d3Force && graphRef.current.d3Force('z');
      if (zForce && typeof zForce.strength === 'function') {
        // Stronger Z force on re-entry to 3D to accentuate depth
        zForce.strength(normalizedAxisForce * 1.6);
      }

      graphData.nodes.forEach(node => {
        // Unpin z and gently unpin x/y unless manually pinned
        if (!pinnedNodesRef.current.has(node.id)) {
          node.fx = undefined;
          node.fy = undefined;
        }
        node.fz = undefined;
        // Give nodes a strong Z nudge so depth is obvious
        const zSpread = Math.max(25, Math.sqrt(graphData.nodes.length) * 3);
        const jitter = (Math.random() - 0.5) * zSpread; // larger spread to see depth
        node.z = (Math.abs(node.z || 0) < 0.0001 ? jitter : node.z + jitter * 0.4);
        node.vz = (Math.random() - 0.5) * 2.5;
      });

      // Enable rotation only if in individual selection mode
      if (selectionMode === 'individual') {
        controls.enableRotate = true;
      } else {
        controls.enableRotate = false; // Keep disabled in multi-select modes
      }
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;

      //      Reset camera distance suitable for current node count
      const nodeCount = graphData.nodes.length;
      const cameraDistance = lastCameraDistanceRef.current || calculateOptimalCameraDistance(nodeCount);
      graphRef.current.cameraPosition(
        { x: 0, y: 0, z: cameraDistance },
        { x: 0, y: 0, z: 0 },
        0
      );

      // Reheat simulation so Z changes take effect
      if (graphRef.current._simulation) {
        graphRef.current._simulation.alpha(1.0).restart();
      }
      if (typeof graphRef.current.resumeAnimation === 'function') {
        graphRef.current.resumeAnimation();
      }
    }

    graphRef.current.refresh();

    // Update axis arrow positions if a node is selected
  }, [is3D, data, normalizedAxisForce]);

  // Track previous hierarchyTreeAxis to detect actual changes
  const prevHierarchyTreeAxisRef = useRef(hierarchyTreeAxis);

  // Handle hierarchy tree axis-based layering (X, Y, Z axis layering by node_type)
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes || !data.nodes.length) return;
    if (!hierarchyTreeAxis) return;

    // Check if any axis is enabled
    const isAnyAxisEnabled = hierarchyTreeAxis.x || hierarchyTreeAxis.y || hierarchyTreeAxis.z;
    if (!isAnyAxisEnabled) {
      // Always unpin nodes when hierarchy axis is cleared (e.g. "Default Layout") so graph can return to default
      const graphData = graphRef.current.graphData();
      if (graphData && graphData.nodes) {
        graphData.nodes.forEach(node => {
          node.fx = null;
          node.fy = null;
          node.fz = null;
        });
      }
      prevHierarchyTreeAxisRef.current = { x: false, y: false, z: false };
      // Restore standard forces and restart only when not in tree layout (tree has its own forces)
      if (graphLayoutMode !== 'tree') {
        graphRef.current.d3Force('x', d3.forceX(0).strength(normalizedAxisForce));
        graphRef.current.d3Force('y', d3.forceY(0).strength(normalizedAxisForce));
        graphRef.current.d3Force('z', d3.forceZ(0).strength(normalizedAxisForce));
        if (graphRef.current._simulation) {
          graphRef.current._simulation.alpha(0.3).restart();
        }
      } else if (graphRef.current._simulation) {
        graphRef.current._simulation.alpha(0.3).restart();
      }
      if (graphData) graphRef.current.graphData(graphData);
      graphRef.current.refresh();
      return;
    }

    // Check if the axis configuration actually changed
    const prev = prevHierarchyTreeAxisRef.current;
    const hasChanged = 
      !prev || 
      prev.x !== hierarchyTreeAxis.x || 
      prev.y !== hierarchyTreeAxis.y || 
      prev.z !== hierarchyTreeAxis.z;
    
    // Update ref for next comparison
    prevHierarchyTreeAxisRef.current = { 
      x: hierarchyTreeAxis.x, 
      y: hierarchyTreeAxis.y, 
      z: hierarchyTreeAxis.z 
    };
    
    // If nothing changed, skip processing
    if (!hasChanged) {
      return;
    }

    const graphData = graphRef.current.graphData();
    if (!graphData || !graphData.nodes || !graphData.nodes.length) return;

    // Group nodes by node_type
    const nodeTypeGroups = new Map();
    graphData.nodes.forEach(node => {
      const nodeType = node.node_type || node.type || node.category || 'Unknown';
      if (!nodeTypeGroups.has(nodeType)) {
        nodeTypeGroups.set(nodeType, []);
      }
      nodeTypeGroups.get(nodeType).push(node);
    });

    const nodeTypes = Array.from(nodeTypeGroups.keys());
    const layerSpacing = normalizedNodeSize * 4; // Spacing between layers
    const numLayers = nodeTypes.length;
    
    // Determine which axis to use for layering (priority: X > Y > Z)
    let layeringAxis = null;
    if (hierarchyTreeAxis.x) layeringAxis = 'x';
    else if (hierarchyTreeAxis.y) layeringAxis = 'y';
    else if (hierarchyTreeAxis.z) layeringAxis = 'z';

    if (!layeringAxis) return;

    // Calculate layer positions along the selected axis
    const startPos = -(numLayers - 1) * layerSpacing / 2;
    const nodeTypePositionMap = new Map();
    nodeTypes.forEach((nodeType, index) => {
      nodeTypePositionMap.set(nodeType, startPos + index * layerSpacing);
    });

    // Configure forces and pin positions based on selected axis
    if (layeringAxis === 'x') {
      // Layer along X axis
      graphRef.current.d3Force('x', d3.forceX((node) => {
        const nodeType = node.node_type || node.type || node.category || 'Unknown';
        return nodeTypePositionMap.get(nodeType) || 0;
      }).strength(1.0));
      graphRef.current.d3Force('y', d3.forceY(0).strength(0.3));
      graphRef.current.d3Force('z', d3.forceZ(0).strength(0.3));
      
      // Pin X positions, allow Y and Z to spread
      graphData.nodes.forEach(node => {
        const nodeType = node.node_type || node.type || node.category || 'Unknown';
        const targetX = nodeTypePositionMap.get(nodeType) || 0;
        node.x = targetX;
        node.fx = targetX;
        node.fy = null;
        node.fz = null;
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
      });
    } else if (layeringAxis === 'y') {
      // Layer along Y axis
      graphRef.current.d3Force('y', d3.forceY((node) => {
        const nodeType = node.node_type || node.type || node.category || 'Unknown';
        return nodeTypePositionMap.get(nodeType) || 0;
      }).strength(1.0));
      graphRef.current.d3Force('x', d3.forceX(0).strength(0.3));
      graphRef.current.d3Force('z', d3.forceZ(0).strength(0.3));
      
      // Pin Y positions, allow X and Z to spread
      graphData.nodes.forEach(node => {
        const nodeType = node.node_type || node.type || node.category || 'Unknown';
        const targetY = nodeTypePositionMap.get(nodeType) || 0;
        node.y = targetY;
        node.fy = targetY;
        node.fx = null;
        node.fz = null;
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
      });
    } else if (layeringAxis === 'z') {
      // Layer along Z axis
      graphRef.current.d3Force('z', d3.forceZ((node) => {
        const nodeType = node.node_type || node.type || node.category || 'Unknown';
        return nodeTypePositionMap.get(nodeType) || 0;
      }).strength(1.0));
      graphRef.current.d3Force('x', d3.forceX(0).strength(0.3));
      graphRef.current.d3Force('y', d3.forceY(0).strength(0.3));
      
      // Pin Z positions, allow X and Y to spread
      graphData.nodes.forEach(node => {
        const nodeType = node.node_type || node.type || node.category || 'Unknown';
        const targetZ = nodeTypePositionMap.get(nodeType) || 0;
        node.z = targetZ;
        node.fz = targetZ;
        node.fx = null;
        node.fy = null;
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
      });
    }

    graphRef.current.graphData(graphData);

    // Force simulation restart
    if (graphRef.current._simulation) {
      graphRef.current._simulation.stop();
    }
    
    graphRef.current.refresh();
    
    requestAnimationFrame(() => {
      if (graphRef.current && graphRef.current._simulation) {
        graphRef.current._simulation.alpha(1.0).restart();
        graphRef.current.refresh();
        
        requestAnimationFrame(() => {
          if (graphRef.current) {
            graphRef.current.refresh();
          }
        });
      }
    });

    // Reset camera to fit the layered layout
    setTimeout(() => {
      if (graphRef.current && graphData && graphData.nodes.length > 0) {
        const nodeCount = graphData.nodes.length;
        const cameraDistance = calculateOptimalCameraDistance(nodeCount);
        graphRef.current.cameraPosition(
          { x: 0, y: 0, z: cameraDistance },
          { x: 0, y: 0, z: 0 },
          1000
        );
      }
    }, 500);
  }, [hierarchyTreeAxis, data, normalizedNodeSize, normalizedAxisForce, graphLayoutMode]);

  // Track previous graphLayoutMode to detect actual changes
  const prevGraphLayoutModeRef = useRef(graphLayoutMode);

  // Handle graph layout mode changes (tree/hierarchical vs force-based)
  useEffect(() => {
    if (!graphRef.current || !data || !data.nodes || !data.nodes.length) return;
    
    // Check if layout mode actually changed
    if (prevGraphLayoutModeRef.current === graphLayoutMode) {
      return;
    }
    
    // Update ref for next comparison
    prevGraphLayoutModeRef.current = graphLayoutMode;

    const graphData = graphRef.current.graphData();
    if (!graphData || !graphData.nodes || !graphData.nodes.length) return;

    if (graphLayoutMode === 'tree') {
      // Hierarchical/Tree Layout: Top-down tree structure (like the attached image)
      // Build hierarchy levels using BFS from root nodes (nodes with no incoming edges)
      
      // Create node map for quick lookup
      const nodeMap = new Map();
      graphData.nodes.forEach(node => {
        nodeMap.set(node.id, node);
      });

      // Find root nodes (nodes with no incoming edges)
      const allTargetIds = new Set();
      graphData.links.forEach(link => {
        const targetId = link.target?.id || link.targetId || link.target;
        if (targetId) allTargetIds.add(targetId);
      });
      
      const rootNodes = graphData.nodes.filter(node => 
        node.id && !allTargetIds.has(node.id)
      );

      // If no root nodes found, use nodes with the least incoming edges
      if (rootNodes.length === 0) {
        const incomingCount = new Map();
        graphData.links.forEach(link => {
          const targetId = link.target?.id || link.targetId || link.target;
          if (targetId) {
            incomingCount.set(targetId, (incomingCount.get(targetId) || 0) + 1);
          }
        });
        const minIncoming = Math.min(...Array.from(incomingCount.values()), 0);
        rootNodes.push(...graphData.nodes.filter(node => 
          node.id && (incomingCount.get(node.id) || 0) === minIncoming
        ));
      }

      // Assign hierarchy levels using BFS
      const nodeLevels = new Map();
      const visited = new Set();
      const queue = [];
      
      // Initialize root nodes at level 0
      rootNodes.forEach(root => {
        if (root.id) {
          nodeLevels.set(root.id, 0);
          visited.add(root.id);
          queue.push({ node: root, level: 0 });
        }
      });

      // BFS traversal to assign levels
      while (queue.length > 0) {
        const { node, level } = queue.shift();
        if (!node.id) continue;

        // Find children (nodes connected FROM this node)
        const children = graphData.links
          .filter(link => {
            const sourceId = link.source?.id || link.sourceId || link.source;
            return sourceId === node.id;
          })
          .map(link => {
            const targetId = link.target?.id || link.targetId || link.target;
            return targetId ? nodeMap.get(targetId) : null;
          })
          .filter(child => child && !visited.has(child.id));

        children.forEach(child => {
          if (child.id) {
            nodeLevels.set(child.id, level + 1);
            visited.add(child.id);
            queue.push({ node: child, level: level + 1 });
          }
        });
      }

      // Assign default level for unvisited nodes (isolated nodes)
      graphData.nodes.forEach(node => {
        if (node.id && !nodeLevels.has(node.id)) {
          nodeLevels.set(node.id, 999); // High level for isolated nodes
        }
      });

      // Group nodes by level
      const levelGroups = new Map();
      graphData.nodes.forEach(node => {
        if (node.id) {
          const level = nodeLevels.get(node.id) || 0;
          if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
          }
          levelGroups.get(level).push(node);
        }
      });

      // Calculate positions for each level
      const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
      // Calculate level spacing for better visual appearance
      // Use a comfortable spacing that's proportional to node size but provides good visual separation
      const levelSpacing = normalizedNodeSize * 4; // Vertical spacing between levels (2x node width for better visual balance)
      
      // Calculate maximum nodes in any level to determine horizontal span
      const maxNodesInLevel = Math.max(...Array.from(levelGroups.values()).map(nodes => nodes.length));
      const verticalSpan = levels.length > 1 ? (levels.length - 1) * levelSpacing : levelSpacing;
      
      // Calculate node spacing to make layout approximately square
      // Target: horizontal span ≈ vertical span
      const targetHorizontalSpan = verticalSpan;
      const nodeSpacing = maxNodesInLevel > 1 
        ? targetHorizontalSpan / (maxNodesInLevel - 1)
        : 100; // Default spacing if only one node
      
      // Start from top (positive Y) and go down (negative Y)
      const topY = (levels.length - 1) * levelSpacing / 2;
      
      const nodePositions = new Map();
      levels.forEach(level => {
        const nodesInLevel = levelGroups.get(level);
        const y = topY - level * levelSpacing;
        const totalWidth = (nodesInLevel.length - 1) * nodeSpacing;
        const startX = -totalWidth / 2;

        nodesInLevel.forEach((node, index) => {
          if (node.id) {
            const x = startX + index * nodeSpacing;
            nodePositions.set(node.id, { x, y });
          }
        });
      });

      // Configure forces for hierarchical layout
      // X force: Spread nodes horizontally within each level
      graphRef.current.d3Force('x', d3.forceX((node) => {
        const pos = nodePositions.get(node.id);
        return pos ? pos.x : 0;
      }).strength(1.0));

      // Y force: Position nodes by hierarchy level (vertical arrangement)
      graphRef.current.d3Force('y', d3.forceY((node) => {
        const pos = nodePositions.get(node.id);
        return pos ? pos.y : 0;
      }).strength(1.0));

      // Reduce Z force to keep layout more 2D-like
      graphRef.current.d3Force('z', d3.forceZ().strength(0.1));

      // Set initial positions and pin coordinates for all nodes
      // This keeps nodes tightly positioned, minimizing connecting line length
      graphData.nodes.forEach(node => {
        if (node.id) {
          const pos = nodePositions.get(node.id);
          if (pos) {
            node.x = pos.x;
            node.y = pos.y;
            node.fx = pos.x; // Pin X position (horizontal within level)
            node.fy = pos.y; // Pin Y position (vertical level)
            node.fz = null;
            
            // Reset velocities
            node.vx = 0;
            node.vy = 0;
            node.vz = 0;
          }
        }
      });
      
      graphRef.current.graphData(graphData);

      // Force simulation restart
      if (graphRef.current._simulation) {
        graphRef.current._simulation.stop();
      }
      
      graphRef.current.refresh();
      
      requestAnimationFrame(() => {
        if (graphRef.current && graphRef.current._simulation) {
          graphRef.current._simulation.alpha(1.0).restart();
          graphRef.current.refresh();
          
          requestAnimationFrame(() => {
            if (graphRef.current) {
              graphRef.current.refresh();
            }
          });
        }
      });

      // Reset camera to fit the hierarchical tree layout (top-down structure)
      // Calculate actual bounding box and zoom to fit
      setTimeout(() => {
        if (graphRef.current && graphData && graphData.nodes.length > 0) {
          // Calculate actual bounding box of the tree layout
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          
          nodePositions.forEach((pos) => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
          });
          
          const width = maxX - minX;
          const height = maxY - minY;
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          
          // Add padding for node size
          const padding = normalizedNodeSize * 2;
          const paddedWidth = width + padding * 2;
          const paddedHeight = height + padding * 2;
          
          // Calculate camera distance to fit the layout
          // Use the larger dimension to ensure everything fits
          const maxDimension = Math.max(paddedWidth, paddedHeight);
          
          // Calculate camera distance using field of view (FOV is typically 75 degrees)
          // distance = (dimension / 2) / tan(FOV / 2)
          const fov = 75 * (Math.PI / 180); // Convert to radians
          const cameraDistance = (maxDimension / 2) / Math.tan(fov / 2);
          
          // Add some extra margin for better visibility
          const finalDistance = cameraDistance * 1.3;
          
          // Position camera to view the hierarchical layout centered
          graphRef.current.cameraPosition(
            { x: centerX, y: centerY, z: finalDistance },
            { x: centerX, y: centerY, z: 0 },
            1000
          );
        }
      }, 500);
    } else {
      // Force-Based Layout: Restore original force-directed layout
      if (graphData.nodes) {
        graphData.nodes.forEach(node => {
          // Unpin all positions
          node.fx = null;
          node.fy = null;
          node.fz = null;
          
          // Give nodes initial velocity to help them spread out
          node.vx = (Math.random() - 0.5) * 3;
          node.vy = (Math.random() - 0.5) * 3;
          node.vz = (Math.random() - 0.5) * 3;
        });
      }

      // Restore standard forces
      graphRef.current.d3Force('y', d3.forceY(0).strength(normalizedAxisForce));
      graphRef.current.d3Force('x', d3.forceX(0).strength(normalizedAxisForce));
      graphRef.current.d3Force('z', d3.forceZ(0).strength(normalizedAxisForce));
      
      graphRef.current.graphData(graphData);

      // Ensure all other forces are properly configured
      const chargeForce = graphRef.current.d3Force('charge');
      if (chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength(normalizedForce);
      }
      
      const centerForce = graphRef.current.d3Force('center');
      if (centerForce && typeof centerForce.strength === 'function') {
        centerForce.strength(normalizedCenterForce);
      }

      // Force simulation restart
      if (graphRef.current._simulation) {
        graphRef.current._simulation.stop();
      }
      
      graphRef.current.refresh();
      
      requestAnimationFrame(() => {
        if (graphRef.current && graphRef.current._simulation) {
          graphRef.current._simulation.alpha(1.0).restart();
          graphRef.current.refresh();
          
          requestAnimationFrame(() => {
            if (graphRef.current) {
              graphRef.current.refresh();
              
              requestAnimationFrame(() => {
                if (graphRef.current) {
                  graphRef.current.refresh();
                }
              });
            }
          });
        }
      });

      // Reset camera to fit the force-based layout
      setTimeout(() => {
        if (graphRef.current && graphData && graphData.nodes.length > 0) {
          const nodeCount = graphData.nodes.length;
          const cameraDistance = calculateOptimalCameraDistance(nodeCount);
          graphRef.current.cameraPosition(
            { x: 0, y: 0, z: cameraDistance },
            { x: 0, y: 0, z: 0 },
            1000
          );
        }
      }, 800);
    }
  }, [graphLayoutMode, data, normalizedAxisForce, normalizedForce, normalizedCenterForce]);

  // Handle zoom actions (zoom in, zoom out, zoom to fit)
  useEffect(() => {
    if (!graphRef.current || !zoomAction) return;

    const camera = graphRef.current.camera();
    const controls = graphRef.current.controls();
    
    if (!camera || !controls) return;

    try {
      if (zoomAction === 'in') {
        // Zoom in: move camera closer to target
        const direction = new THREE.Vector3();
        direction.subVectors(controls.target, camera.position).normalize();
        const distance = camera.position.distanceTo(controls.target);
        const zoomDistance = distance * 0.2; // Move 20% closer
        
        camera.position.add(direction.multiplyScalar(zoomDistance));
        controls.update();
      } else if (zoomAction === 'out') {
        // Zoom out: move camera farther from target
        const direction = new THREE.Vector3();
        direction.subVectors(camera.position, controls.target).normalize();
        const distance = camera.position.distanceTo(controls.target);
        const zoomDistance = distance * 0.25; // Move 25% farther
        
        camera.position.add(direction.multiplyScalar(zoomDistance));
        controls.update();
      } else if (zoomAction === 'fit') {
        // Zoom to fit: calculate optimal camera distance for all nodes
        const graphData = graphRef.current.graphData();
        if (graphData && graphData.nodes && graphData.nodes.length > 0) {
          // Check if we're in tree layout mode
          if (graphLayoutMode === 'tree') {
            // For tree layout, calculate bounding box and fit to view
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            
            graphData.nodes.forEach(node => {
              if (node.x !== undefined && node.y !== undefined) {
                minX = Math.min(minX, node.x);
                maxX = Math.max(maxX, node.x);
                minY = Math.min(minY, node.y);
                maxY = Math.max(maxY, node.y);
              }
            });
            
            if (minX !== Infinity && maxX !== -Infinity) {
              const width = maxX - minX;
              const height = maxY - minY;
              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;
              
              // Add padding for node size
              const padding = normalizedNodeSize * 2;
              const paddedWidth = width + padding * 2;
              const paddedHeight = height + padding * 2;
              
              // Calculate camera distance to fit the layout
              const maxDimension = Math.max(paddedWidth, paddedHeight);
              const fov = 75 * (Math.PI / 180);
              const cameraDistance = (maxDimension / 2) / Math.tan(fov / 2);
              const finalDistance = cameraDistance * 1.3;
              
              // Animate camera to fit the tree layout
              graphRef.current.cameraPosition(
                { x: centerX, y: centerY, z: finalDistance },
                { x: centerX, y: centerY, z: 0 },
                1000
              );
            }
          } else {
            // For force-based layout, use standard calculation
            const nodeCount = graphData.nodes.length;
            const cameraDistance = calculateOptimalCameraDistance(nodeCount);
            
            // Animate camera to optimal position
            graphRef.current.cameraPosition(
              { x: 0, y: 0, z: cameraDistance },
              { x: 0, y: 0, z: 0 },
              1000 // 1 second animation
            );
          }
        }
      }

      // Call the completion callback after a short delay to allow animation
      if (onZoomComplete) {
        setTimeout(() => {
          onZoomComplete();
        }, zoomAction === 'fit' ? 1000 : 100);
      }
    } catch (error) {
      console.error('Error handling zoom action:', error);
      if (onZoomComplete) {
        onZoomComplete();
      }
    }
  }, [zoomAction, onZoomComplete, graphLayoutMode, normalizedNodeSize]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup performance caches on unmount
  useEffect(() => {
    return () => {
      if (materialCacheRef.current) {
        materialCacheRef.current.clear();
      }
      if (spritePoolRef.current) {
        spritePoolRef.current.clear();
      }
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
      }
    };
  }, []);

  // Point-in-polygon algorithm (ray casting)
  const isPointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Control graph rotation based on selection mode - only allow rotation in 'individual' mode
  useEffect(() => {
    if (!graphRef.current || !graphRef.current.controls) return;
    
    const controls = graphRef.current.controls();
    
    if (selectionMode === 'individual') {
      // Enable all controls in individual selection mode
      controls.enabled = true;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.enableZoom = true;
      // Restore normal mouse button configuration
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,   // Left mouse button for rotation
        MIDDLE: THREE.MOUSE.DOLLY,  // Middle mouse button for zoom
        RIGHT: THREE.MOUSE.PAN      // Right mouse button for pan
      };
      controls.update();
      
      // CRITICAL: Disable node dragging in individual mode to prevent accidental node movement
      // This prevents nodes (especially connected ones) from being moved when clicking
      if (graphRef.current.enableNodeDrag) {
        graphRef.current.enableNodeDrag(false);
      }
      
      // Clear multi-selection when switching to individual mode
      setSelectedNodes(new Set());
      setSelectedEdges(new Set());
    } else {
      // In box/lasso selection modes: disable rotation and pan, but keep zoom enabled
      controls.enabled = true; // Keep enabled to allow zoom
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.enableZoom = true; // Explicitly enable zoom
      // Explicitly set mouse buttons to prevent rotation/pan
      controls.mouseButtons = {
        LEFT: null,                 // Disable left mouse button (prevent rotation)
        MIDDLE: THREE.MOUSE.DOLLY,  // Middle mouse button for zoom
        RIGHT: null                 // Disable right mouse button (prevent pan)
      };
      controls.update();
      
      // Enable node dragging in multi-select modes for group drag functionality
      if (graphRef.current.enableNodeDrag) {
        graphRef.current.enableNodeDrag(true);
      }
    }
    
    return () => {
      // Cleanup: ensure controls are re-enabled when component unmounts
      if (graphRef.current && graphRef.current.controls) {
        const controls = graphRef.current.controls();
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.update();
      }
    };
  }, [selectionMode]);

  // Box selection mouse handlers
  useEffect(() => {
    if (selectionMode !== 'box' || !containerRef.current) return;

    const container = containerRef.current;
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    
    const handleMouseDown = (e) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      
      // Don't interfere with node/edge clicks
      if (nodeOrEdgeClickedRef.current) return;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check if clicking inside an existing selected region
      // If so, start region-based subgraph dragging
      if (selectedRegionRef.current && selectedNodesRef.current.size > 0) {
        let isInsideRegion = false;
        
        if (selectedRegionRef.current.type === 'box') {
          isInsideRegion = mouseX >= selectedRegionRef.current.minX && 
                          mouseX <= selectedRegionRef.current.maxX && 
                          mouseY >= selectedRegionRef.current.minY && 
                          mouseY <= selectedRegionRef.current.maxY;
        }
        
        // If clicking inside selected region, start region-based subgraph dragging
        if (isInsideRegion) {
          // Check if clicking on a node (let the node drag handler handle it)
          if (hoveredNodeRef.current && selectedNodesRef.current.has(hoveredNodeRef.current.id)) {
            return; // Let the built-in node drag handler handle this
          }
          
          // Start region-based dragging for the subgraph
          const graph = graphRef.current;
          if (graph) {
            const graphData = graph.graphData();
            if (graphData && graphData.nodes) {
              // Store initial positions of all selected nodes
              const initialPositions = new Map();
              graphData.nodes.forEach(node => {
                if (selectedNodesRef.current.has(node.id)) {
                  initialPositions.set(node.id, { x: node.x, y: node.y, z: node.z || 0 });
                }
              });
              
              regionDragRef.current = {
                isDragging: true,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                initialNodePositions: initialPositions
              };
              
              // Disable controls during region drag
              const controls = graph.controls();
              if (controls) {
                controls.enabled = false;
                controls.enableRotate = false;
                controls.enablePan = false;
                controls.enableZoom = false;
              }
              
              if (isMountedRef.current) {
                setCursorStyle('grabbing');
              }
              
              e.preventDefault();
              e.stopPropagation();
            }
          }
          return;
        }
      }
      
      // Clear previous selection data (nodes, edges, region) but keep visual drawing continuous
      // This ensures nodes/edges are deselected while allowing smooth drawing from click point
      if (isMountedRef.current) {
        const emptySet = new Set();
        setSelectedNodes(emptySet);
        setSelectedEdges(emptySet);
        setIsHoveringSelected(false);
        setSelectedRegion(null);
        selectedNodesRef.current = emptySet;
        selectedRegionRef.current = null;
      }
      
      // Change cursor to crosshair when starting selection
      if (isMountedRef.current) {
        setCursorStyle('crosshair');
      }
      
      // Disable ALL controls during selection drag (including zoom to prevent interference)
      const controls = graphRef.current?.controls();
      if (controls) {
        controls.enabled = false;
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = false; // Disable zoom during drag to prevent interference
        controls.update();
      }
      
      // Start new selection IMMEDIATELY from the click point
      // Set local state first for immediate response
      isSelecting = true;
      startX = mouseX;
      startY = mouseY;
      endX = mouseX;
      endY = mouseY;
      
      // Update visual state immediately so drawing starts from first click point
      if (isMountedRef.current) {
        setBoxSelection({
          isSelecting: true,
          startX,
          startY,
          endX,
          endY
        });
      }
    };

    const handleMouseMove = (e) => {
      // Handle region-based subgraph dragging
      if (regionDragRef.current.isDragging) {
        const graph = graphRef.current;
        if (!graph) return;
        
        const graphData = graph.graphData();
        if (!graphData || !graphData.nodes) return;
        
        // Calculate mouse delta in screen space
        const deltaScreenX = e.clientX - regionDragRef.current.startMouseX;
        const deltaScreenY = e.clientY - regionDragRef.current.startMouseY;
        
        // Convert screen delta to 3D world delta
        // Use camera to project/unproject for accurate 3D movement
        const camera = graph.camera();
        const rect = container.getBoundingClientRect();
        
        // Get a reference point in 3D space (center of selected nodes)
        let centerX = 0, centerY = 0, centerZ = 0;
        let count = 0;
        regionDragRef.current.initialNodePositions.forEach((pos) => {
          centerX += pos.x;
          centerY += pos.y;
          centerZ += pos.z;
          count++;
        });
        if (count > 0) {
          centerX /= count;
          centerY /= count;
          centerZ /= count;
        }
        
        // Project center to screen, apply delta, then unproject back
        const centerVec = new THREE.Vector3(centerX, centerY, centerZ);
        centerVec.project(camera);
        
        // Convert to screen coordinates, apply delta, convert back to NDC
        const screenX = (centerVec.x + 1) / 2 * rect.width;
        const screenY = (-centerVec.y + 1) / 2 * rect.height;
        const newScreenX = screenX + deltaScreenX;
        const newScreenY = screenY + deltaScreenY;
        const newNdcX = (newScreenX / rect.width) * 2 - 1;
        const newNdcY = -(newScreenY / rect.height) * 2 + 1;
        
        // Unproject back to 3D
        const newCenterVec = new THREE.Vector3(newNdcX, newNdcY, centerVec.z);
        newCenterVec.unproject(camera);
        
        // Calculate 3D delta
        const delta3DX = newCenterVec.x - centerX;
        const delta3DY = newCenterVec.y - centerY;
        const delta3DZ = newCenterVec.z - centerZ;
        
        // Move all selected nodes by the 3D delta
        graphData.nodes.forEach(node => {
          if (regionDragRef.current.initialNodePositions.has(node.id)) {
            const initialPos = regionDragRef.current.initialNodePositions.get(node.id);
            node.x = initialPos.x + delta3DX;
            node.y = initialPos.y + delta3DY;
            node.z = initialPos.z + delta3DZ;
            // Pin the node at its new position
            node.fx = node.x;
            node.fy = node.y;
            node.fz = node.z;
          }
        });
        
        // Trigger re-render
        graph.graphData(graphData);
        
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Handle box selection drawing
      if (!isSelecting) return;
      
      // Continuously enforce ALL controls disabled during drag
      const controls = graphRef.current?.controls();
      if (controls) {
        controls.enabled = false;
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = false; // Keep zoom disabled during drag
      }
      
      const rect = container.getBoundingClientRect();
      endX = e.clientX - rect.left;
      endY = e.clientY - rect.top;
      
      if (isMountedRef.current) {
        setBoxSelection({
          isSelecting: true,
          startX,
          startY,
          endX,
          endY
        });
      }
    };

    const handleMouseUp = (e) => {
      // Handle region-based subgraph drag end
      if (regionDragRef.current.isDragging) {
        const graph = graphRef.current;
        if (graph) {
          const graphData = graph.graphData();
          if (graphData && graphData.nodes) {
            // Pin all selected nodes at their final positions
            regionDragRef.current.initialNodePositions.forEach((_, nodeId) => {
              const node = graphData.nodes.find(n => n.id === nodeId);
              if (node) {
                pinnedNodesRef.current.add(node.id);
                node.fx = node.x;
                node.fy = node.y;
                node.fz = node.z;
              }
            });
            
            // Update the selected region to match new node positions
            const camera = graph.camera();
            const rect = container.getBoundingClientRect();
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            
            regionDragRef.current.initialNodePositions.forEach((_, nodeId) => {
              const node = graphData.nodes.find(n => n.id === nodeId);
              if (node) {
                const vector = new THREE.Vector3(node.x, node.y, node.z || 0);
                vector.project(camera);
                const screenX = (vector.x + 1) / 2 * rect.width;
                const screenY = (-vector.y + 1) / 2 * rect.height;
                minX = Math.min(minX, screenX);
                maxX = Math.max(maxX, screenX);
                minY = Math.min(minY, screenY);
                maxY = Math.max(maxY, screenY);
              }
            });
            
            // Update the region bounds with some padding
            const padding = 20;
            if (isMountedRef.current) {
              const newRegion = {
                type: 'box',
                minX: minX - padding,
                maxX: maxX + padding,
                minY: minY - padding,
                maxY: maxY + padding
              };
              setSelectedRegion(newRegion);
              selectedRegionRef.current = newRegion;
            }
          }
          
          // Re-enable controls
          const controls = graph.controls();
          if (controls) {
            controls.enabled = true;
            controls.enableRotate = false; // Keep rotate disabled in multi-select
            controls.enablePan = false; // Keep pan disabled in multi-select
            controls.enableZoom = true; // Allow zoom
          }
        }
        
        // Reset region drag state
        regionDragRef.current = {
          isDragging: false,
          startMouseX: 0,
          startMouseY: 0,
          initialNodePositions: new Map()
        };
        
        if (isMountedRef.current) {
          setCursorStyle('grab');
        }
        
        return;
      }
      
      // Handle selection end
      if (!isSelecting) return;
      
      // Calculate which nodes are within the selection box
      const rect = container.getBoundingClientRect();
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);
      
      // Get node screen positions from the graph
      const graph = graphRef.current;
      if (graph && data.nodes) {
        const camera = graph.camera();
        const selectedNodeIds = new Set();
        
        data.nodes.forEach(node => {
          // Get node 3D position
          const nodeObj = graph.graphData().nodes.find(n => n.id === node.id);
          if (!nodeObj) return;
          
          // Project 3D position to 2D screen coordinates
          const vector = new THREE.Vector3(nodeObj.x, nodeObj.y, nodeObj.z || 0);
          vector.project(camera);
          
          // Convert normalized device coordinates to screen coordinates
          const screenX = (vector.x + 1) / 2 * rect.width;
          const screenY = (-vector.y + 1) / 2 * rect.height;
          
          // Check if node is within selection box
          if (screenX >= minX && screenX <= maxX && 
              screenY >= minY && screenY <= maxY) {
            selectedNodeIds.add(node.id);
          }
        });
        
        if (isMountedRef.current) {
          setSelectedNodes(selectedNodeIds);
          selectedNodesRef.current = selectedNodeIds;
        }
        
        // Select edges that connect the selected nodes
        const selectedEdgeIds = new Set();
        if (data.links && selectedNodeIds.size > 0) {
          data.links.forEach(link => {
            const sourceId = link.source?.id || link.source || link.sourceId;
            const targetId = link.target?.id || link.target || link.targetId;
            
            // If both source and target are in the selection, select the edge
            if (selectedNodeIds.has(sourceId) && selectedNodeIds.has(targetId)) {
              selectedEdgeIds.add(link.id || `${sourceId}->${targetId}`);
            }
          });
        }
        
        if (isMountedRef.current) {
          setSelectedEdges(selectedEdgeIds);
          
          // Store the selected region for cursor detection
          if (selectedNodeIds.size > 0) {
            const region = {
              type: 'box',
              minX,
              maxX,
              minY,
              maxY
            };
            setSelectedRegion(region);
            selectedRegionRef.current = region;
          } else {
            setSelectedRegion(null);
            selectedRegionRef.current = null;
          }
        }
        
        // Call onNodeClick with the first selected node for sidebar display
        if (onNodeClick && selectedNodeIds.size > 0) {
          const firstSelectedId = Array.from(selectedNodeIds)[0];
          const firstNode = data.nodes.find(n => n.id === firstSelectedId);
          if (firstNode) {
            onNodeClick(firstNode);
          }
        }
      }
      
      // Reset selection box and cursor
      isSelecting = false;
      if (isMountedRef.current) {
        setCursorStyle('default');
        setBoxSelection({
          isSelecting: false,
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0
        });
      }
      
      // Re-enable controls for multi-select mode (zoom enabled, rotate/pan disabled)
      const controls = graphRef.current?.controls();
      if (controls) {
        controls.enabled = true; // Enable controls to allow zoom
        controls.enableRotate = false; // Keep rotation disabled
        controls.enablePan = false; // Keep pan disabled
        controls.enableZoom = true; // Keep zoom enabled
        // Explicitly set mouse buttons to prevent rotation/pan
        controls.mouseButtons = {
          LEFT: null,                 // Disable left mouse button (prevent rotation)
          MIDDLE: THREE.MOUSE.DOLLY,  // Middle mouse button for zoom
          RIGHT: null                 // Disable right mouse button (prevent pan)
        };
        controls.update();
      }
    };

    // Use capture phase to intercept events before they reach the graph controls
    container.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [selectionMode, data.nodes, data.links, onNodeClick]);

  // Lasso selection mouse handlers
  useEffect(() => {
    if (selectionMode !== 'lasso' || !containerRef.current) return;

    const container = containerRef.current;
    let isSelecting = false;
    let path = [];
    
    const handleMouseDown = (e) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      
      // Don't interfere with node/edge clicks
      if (nodeOrEdgeClickedRef.current) return;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check if clicking inside an existing selected region
      // If so, start region-based subgraph dragging
      if (selectedRegionRef.current && selectedNodesRef.current.size > 0) {
        let isInsideRegion = false;
        
        if (selectedRegionRef.current.type === 'lasso' && selectedRegionRef.current.path) {
          // Use point-in-polygon algorithm for lasso
          isInsideRegion = isPointInPolygon(mouseX, mouseY, selectedRegionRef.current.path);
        }
        
        // If clicking inside selected region, start region-based subgraph dragging
        if (isInsideRegion) {
          // Check if clicking on a node (let the node drag handler handle it)
          if (hoveredNodeRef.current && selectedNodesRef.current.has(hoveredNodeRef.current.id)) {
            return; // Let the built-in node drag handler handle this
          }
          
          // Start region-based dragging for the subgraph
          const graph = graphRef.current;
          if (graph) {
            const graphData = graph.graphData();
            if (graphData && graphData.nodes) {
              // Store initial positions of all selected nodes
              const initialPositions = new Map();
              graphData.nodes.forEach(node => {
                if (selectedNodesRef.current.has(node.id)) {
                  initialPositions.set(node.id, { x: node.x, y: node.y, z: node.z || 0 });
                }
              });
              
              regionDragRef.current = {
                isDragging: true,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                initialNodePositions: initialPositions
              };
              
              // Disable controls during region drag
              const controls = graph.controls();
              if (controls) {
                controls.enabled = false;
                controls.enableRotate = false;
                controls.enablePan = false;
                controls.enableZoom = false;
              }
              
              if (isMountedRef.current) {
                setCursorStyle('grabbing');
              }
              
              e.preventDefault();
              e.stopPropagation();
            }
          }
          return;
        }
      }
      
      // Clear previous selection data (nodes, edges, region) but keep visual drawing continuous
      // This ensures nodes/edges are deselected while allowing smooth drawing from click point
      if (isMountedRef.current) {
        const emptySet = new Set();
        setSelectedNodes(emptySet);
        setSelectedEdges(emptySet);
        setIsHoveringSelected(false);
        setSelectedRegion(null);
        selectedNodesRef.current = emptySet;
        selectedRegionRef.current = null;
      }
      
      // Change cursor to crosshair when starting selection
      if (isMountedRef.current) {
        setCursorStyle('crosshair');
      }
      
      // Disable ALL controls during selection drag (including zoom to prevent interference)
      const controls = graphRef.current?.controls();
      if (controls) {
        controls.enabled = false;
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = false; // Disable zoom during drag to prevent interference
        controls.update();
      }
      
      // Start new selection IMMEDIATELY from the click point
      // Set local state first for immediate response
      const startPoint = {
        x: mouseX,
        y: mouseY
      };
      
      isSelecting = true;
      path = [startPoint];
      
      // Update visual state immediately so drawing starts from first click point
      if (isMountedRef.current) {
        setLassoSelection({
          isSelecting: true,
          path: [startPoint]
        });
      }
    };

    const handleMouseMove = (e) => {
      // Handle region-based subgraph dragging
      if (regionDragRef.current.isDragging) {
        const graph = graphRef.current;
        if (!graph) return;
        
        const graphData = graph.graphData();
        if (!graphData || !graphData.nodes) return;
        
        // Calculate mouse delta in screen space
        const deltaScreenX = e.clientX - regionDragRef.current.startMouseX;
        const deltaScreenY = e.clientY - regionDragRef.current.startMouseY;
        
        // Convert screen delta to 3D world delta
        const camera = graph.camera();
        const rect = container.getBoundingClientRect();
        
        // Get a reference point in 3D space (center of selected nodes)
        let centerX = 0, centerY = 0, centerZ = 0;
        let count = 0;
        regionDragRef.current.initialNodePositions.forEach((pos) => {
          centerX += pos.x;
          centerY += pos.y;
          centerZ += pos.z;
          count++;
        });
        if (count > 0) {
          centerX /= count;
          centerY /= count;
          centerZ /= count;
        }
        
        // Project center to screen, apply delta, then unproject back
        const centerVec = new THREE.Vector3(centerX, centerY, centerZ);
        centerVec.project(camera);
        
        // Convert to screen coordinates, apply delta, convert back to NDC
        const screenX = (centerVec.x + 1) / 2 * rect.width;
        const screenY = (-centerVec.y + 1) / 2 * rect.height;
        const newScreenX = screenX + deltaScreenX;
        const newScreenY = screenY + deltaScreenY;
        const newNdcX = (newScreenX / rect.width) * 2 - 1;
        const newNdcY = -(newScreenY / rect.height) * 2 + 1;
        
        // Unproject back to 3D
        const newCenterVec = new THREE.Vector3(newNdcX, newNdcY, centerVec.z);
        newCenterVec.unproject(camera);
        
        // Calculate 3D delta
        const delta3DX = newCenterVec.x - centerX;
        const delta3DY = newCenterVec.y - centerY;
        const delta3DZ = newCenterVec.z - centerZ;
        
        // Move all selected nodes by the 3D delta
        graphData.nodes.forEach(node => {
          if (regionDragRef.current.initialNodePositions.has(node.id)) {
            const initialPos = regionDragRef.current.initialNodePositions.get(node.id);
            node.x = initialPos.x + delta3DX;
            node.y = initialPos.y + delta3DY;
            node.z = initialPos.z + delta3DZ;
            // Pin the node at its new position
            node.fx = node.x;
            node.fy = node.y;
            node.fz = node.z;
          }
        });
        
        // Trigger re-render
        graph.graphData(graphData);
        
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Handle lasso selection drawing
      if (!isSelecting) return;
      
      // Continuously enforce ALL controls disabled during drag
      const controls = graphRef.current?.controls();
      if (controls) {
        controls.enabled = false;
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = false; // Keep zoom disabled during drag
      }
      
      const rect = container.getBoundingClientRect();
      const newPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // Add point to path (throttle to avoid too many points)
      path = [...path, newPoint];
      
      if (isMountedRef.current) {
        setLassoSelection({
          isSelecting: true,
          path: path
        });
      }
    };

    const handleMouseUp = (e) => {
      // Handle region-based subgraph drag end
      if (regionDragRef.current.isDragging) {
        const graph = graphRef.current;
        if (graph) {
          const graphData = graph.graphData();
          if (graphData && graphData.nodes) {
            // Pin all selected nodes at their final positions
            regionDragRef.current.initialNodePositions.forEach((_, nodeId) => {
              const node = graphData.nodes.find(n => n.id === nodeId);
              if (node) {
                pinnedNodesRef.current.add(node.id);
                node.fx = node.x;
                node.fy = node.y;
                node.fz = node.z;
              }
            });
            
            // Update the selected region to match new node positions (as lasso path)
            const camera = graph.camera();
            const rect = container.getBoundingClientRect();
            const newPath = [];
            
            regionDragRef.current.initialNodePositions.forEach((_, nodeId) => {
              const node = graphData.nodes.find(n => n.id === nodeId);
              if (node) {
                const vector = new THREE.Vector3(node.x, node.y, node.z || 0);
                vector.project(camera);
                const screenX = (vector.x + 1) / 2 * rect.width;
                const screenY = (-vector.y + 1) / 2 * rect.height;
                newPath.push({ x: screenX, y: screenY });
              }
            });
            
            // Create a convex hull or bounding box for the new region
            if (newPath.length > 0 && isMountedRef.current) {
              // Calculate bounding box with padding
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
              newPath.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
              });
              const padding = 20;
              
              // Create a box-based region from the lasso result
              const newRegion = {
                type: 'lasso',
                path: [
                  { x: minX - padding, y: minY - padding },
                  { x: maxX + padding, y: minY - padding },
                  { x: maxX + padding, y: maxY + padding },
                  { x: minX - padding, y: maxY + padding }
                ]
              };
              setSelectedRegion(newRegion);
              selectedRegionRef.current = newRegion;
            }
          }
          
          // Re-enable controls
          const controls = graph.controls();
          if (controls) {
            controls.enabled = true;
            controls.enableRotate = false;
            controls.enablePan = false;
            controls.enableZoom = true;
          }
        }
        
        // Reset region drag state
        regionDragRef.current = {
          isDragging: false,
          startMouseX: 0,
          startMouseY: 0,
          initialNodePositions: new Map()
        };
        
        if (isMountedRef.current) {
          setCursorStyle('grab');
        }
        
        return;
      }
      
      // Handle lasso selection end
      if (!isSelecting) return;
      
      // Calculate which nodes are within the lasso path using point-in-polygon algorithm
      const rect = container.getBoundingClientRect();
      
      // Need at least 3 points to form a polygon
      if (path.length < 3) {
        isSelecting = false;
        path = [];
        if (isMountedRef.current) {
          setLassoSelection({
            isSelecting: false,
            path: []
          });
        }
        return;
      }
      
      // Get node screen positions from the graph
      const graph = graphRef.current;
      if (graph && data.nodes) {
        const camera = graph.camera();
        const selectedNodeIds = new Set();
        
        data.nodes.forEach(node => {
          // Get node 3D position
          const nodeObj = graph.graphData().nodes.find(n => n.id === node.id);
          if (!nodeObj) return;
          
          // Project 3D position to 2D screen coordinates
          const vector = new THREE.Vector3(nodeObj.x, nodeObj.y, nodeObj.z || 0);
          vector.project(camera);
          
          // Convert normalized device coordinates to screen coordinates
          const screenX = (vector.x + 1) / 2 * rect.width;
          const screenY = (-vector.y + 1) / 2 * rect.height;
          
          // Check if node is within lasso path using point-in-polygon algorithm
          if (isPointInPolygon(screenX, screenY, path)) {
            selectedNodeIds.add(node.id);
          }
        });
        
        if (isMountedRef.current) {
          setSelectedNodes(selectedNodeIds);
          selectedNodesRef.current = selectedNodeIds;
        }
        
        // Select edges that connect the selected nodes
        const selectedEdgeIds = new Set();
        if (data.links && selectedNodeIds.size > 0) {
          data.links.forEach(link => {
            const sourceId = link.source?.id || link.source || link.sourceId;
            const targetId = link.target?.id || link.target || link.targetId;
            
            // If both source and target are in the selection, select the edge
            if (selectedNodeIds.has(sourceId) && selectedNodeIds.has(targetId)) {
              selectedEdgeIds.add(link.id || `${sourceId}->${targetId}`);
            }
          });
        }
        
        if (isMountedRef.current) {
          setSelectedEdges(selectedEdgeIds);
          
          // Store the selected region for cursor detection (with bounding box)
          if (selectedNodeIds.size > 0 && path.length >= 3) {
            // Calculate bounding box of the lasso path
            const xs = path.map(p => p.x);
            const ys = path.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            
            const region = {
              type: 'lasso',
              path: [...path],
              minX,
              maxX,
              minY,
              maxY
            };
            setSelectedRegion(region);
            selectedRegionRef.current = region;
          } else {
            setSelectedRegion(null);
            selectedRegionRef.current = null;
          }
        }
        
        // Call onNodeClick with the first selected node for sidebar display
        if (onNodeClick && selectedNodeIds.size > 0) {
          const firstSelectedId = Array.from(selectedNodeIds)[0];
          const firstNode = data.nodes.find(n => n.id === firstSelectedId);
          if (firstNode) {
            onNodeClick(firstNode);
          }
        }
      }
      
      // Reset lasso selection and cursor
      isSelecting = false;
      path = [];
      if (isMountedRef.current) {
        setCursorStyle('default');
        setLassoSelection({
          isSelecting: false,
          path: []
        });
      }
      
      // Re-enable controls for multi-select mode (zoom enabled, rotate/pan disabled)
      const controls = graphRef.current?.controls();
      if (controls) {
        controls.enabled = true; // Enable controls to allow zoom
        controls.enableRotate = false; // Keep rotation disabled
        controls.enablePan = false; // Keep pan disabled
        controls.enableZoom = true; // Keep zoom enabled
        // Explicitly set mouse buttons to prevent rotation/pan
        controls.mouseButtons = {
          LEFT: null,                 // Disable left mouse button (prevent rotation)
          MIDDLE: THREE.MOUSE.DOLLY,  // Middle mouse button for zoom
          RIGHT: null                 // Disable right mouse button (prevent pan)
        };
        controls.update();
      }
    };

    // Use capture phase to intercept events before they reach the graph controls
    container.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [selectionMode, data.nodes, data.links, onNodeClick]);

  // Handle cursor detection within selected region
  useEffect(() => {
    if ((selectionMode !== 'box' && selectionMode !== 'lasso') || !containerRef.current || !selectedRegion || selectedNodes.size === 0) {
      return;
    }

    const container = containerRef.current;
    
    const handleContainerMouseMove = (e) => {
      // Don't change cursor during selection
      if (boxSelection.isSelecting || lassoSelection.isSelecting) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      let isInsideRegion = false;
      
      if (selectedRegion.type === 'box') {
        // Check if cursor is within box bounds
        isInsideRegion = mouseX >= selectedRegion.minX && 
                        mouseX <= selectedRegion.maxX && 
                        mouseY >= selectedRegion.minY && 
                        mouseY <= selectedRegion.maxY;
      } else if (selectedRegion.type === 'lasso') {
        // Check if cursor is within lasso path using point-in-polygon
        isInsideRegion = isPointInPolygon(mouseX, mouseY, selectedRegion.path);
      }
      
      // Update cursor based on position
      if (isMountedRef.current) {
        if (isInsideRegion) {
          setCursorStyle('grab');
          setIsHoveringSelected(true);
        } else {
          setCursorStyle('default');
          setIsHoveringSelected(false);
        }
      }
    };

    container.addEventListener('mousemove', handleContainerMouseMove);

    return () => {
      container.removeEventListener('mousemove', handleContainerMouseMove);
    };
  }, [selectionMode, selectedRegion, selectedNodes.size, boxSelection.isSelecting, lassoSelection.isSelecting]);

  // Clear selected region when selection is cleared
  useEffect(() => {
    if (selectedNodes.size === 0 && isMountedRef.current) {
      setSelectedRegion(null);
      setCursorStyle('default');
      setIsHoveringSelected(false);
    }
  }, [selectedNodes.size]);

  // Get current camera position and target from the graph (for save position)
  const getCurrentCameraState = useCallback(() => {
    if (!graphRef.current) return null;
    try {
      const camera = graphRef.current.camera();
      const controls = graphRef.current.controls?.();
      if (!camera || !controls) return null;
      const pos = new THREE.Vector3();
      camera.getWorldPosition(pos);
      const target = controls.target;
      return {
        position: { x: pos.x, y: pos.y, z: pos.z },
        target: { x: target.x, y: target.y, z: target.z },
      };
    } catch (e) {
      return null;
    }
  }, []);

  const resetCameraToInitial = useCallback(() => {
    if (!graphRef.current) return;
    try {
      const graphData = graphRef.current.graphData();
      const nodeCount = graphData?.nodes?.length ?? 0;
      const cameraDistance = nodeCount > 0 ? calculateOptimalCameraDistance(nodeCount) : 200;
      graphRef.current.cameraPosition(
        { x: 0, y: 0, z: cameraDistance },
        { x: 0, y: 0, z: 0 },
        500
      );
    } catch (e) {
      console.warn('Reset camera failed', e);
    }
  }, []);

  const handleSavePosition = useCallback(async () => {
    const state = getCurrentCameraState();
    if (!state || !onSavePosition) return;
    setSavePositionStatus('saving');
    try {
      await onSavePosition(state);
      if (isMountedRef.current) setSavePositionStatus('saved');
      setTimeout(() => { if (isMountedRef.current) setSavePositionStatus(null); }, 2000);
    } catch (e) {
      if (isMountedRef.current) setSavePositionStatus('error');
      setTimeout(() => { if (isMountedRef.current) setSavePositionStatus(null); }, 2000);
    }
  }, [getCurrentCameraState, onSavePosition]);

  useImperativeHandle(ref, () => ({
    getCurrentCameraState,
    resetCameraToInitial,
  }), [getCurrentCameraState, resetCameraToInitial]);

  // Show error state if WebGL initialization failed
  if (webglError) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative flex items-center justify-center bg-[#09090B]"
      >
        <div className="text-center px-8 py-6 bg-[#18181B] border border-[#3F3F46] rounded-lg max-w-md">
          <div className="text-red-400 text-xl font-semibold mb-2">WebGL Not Available</div>
          <div className="text-gray-300 text-sm mb-4">{webglError}</div>
          <div className="text-gray-400 text-xs">
            This may occur in virtualized environments or when WebGL is disabled in your browser.
            Please try using a different browser or enabling hardware acceleration.
          </div>
        </div>
      </div>
    );
  }

  // Use full height of parent container regardless of device
  // If no data, display empty state component (only after loading is complete)
  if (!loading && hasNoData) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-6 max-w-md px-6">
            <div className="text-[#F4F4F5] text-6xl opacity-20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-32 h-32">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div className="text-[#F4F4F5] text-2xl font-semibold text-center">No Graph Data Available</div>
            <div className="text-[#A1A1AA] text-base text-center">
              There are currently no nodes or edges to display in this graph view. Please select a story or section with data to visualize.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`w-full h-full relative ${selectionMode === 'individual' ? 'cursor-default' : ''}`}
        style={selectionMode !== 'individual' ? { cursor: cursorStyle } : undefined}
      >
        {/* Box selection visual overlay */}
        {selectionMode === 'box' && boxSelection.isSelecting && (
          <div
            className="absolute pointer-events-none z-[1000] border border-dashed border-[#1D9BF0]"
            style={{
              left: `${Math.min(boxSelection.startX, boxSelection.endX)}px`,
              top: `${Math.min(boxSelection.startY, boxSelection.endY)}px`,
              width: `${Math.abs(boxSelection.endX - boxSelection.startX)}px`,
              height: `${Math.abs(boxSelection.endY - boxSelection.startY)}px`,
              // Slightly lighter/brighter fill while keeping the dark theme
              backgroundColor: 'rgba(30, 64, 175, 0.28)', // lighter blue-tinted overlay
              boxShadow: '0 0 0 1px rgba(37, 99, 235, 0.7)',
            }}
          />
        )}
        
        {/* Lasso selection visual overlay - styled to match Box Select */}
        {selectionMode === 'lasso' && lassoSelection.isSelecting && lassoSelection.path.length > 0 && (
          <svg
            className="absolute pointer-events-none z-[1000] left-0 top-0 w-full h-full"
          >
            <polyline
              points={lassoSelection.path.map(p => `${p.x},${p.y}`).join(' ')}
              // Same blue color as Box Select, but dashed to match style
              stroke="#1D9BF0"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              // Slightly lighter, blue-tinted fill to match Box Select overlay
              fill="rgba(30, 64, 175, 0.22)"
            />
          </svg>
        )}
        {/* Save XYZ position button - top right (only when onSavePosition provided) */}
        {typeof onSavePosition === 'function' && (
          <div className="absolute top-4 right-4 z-[1100] pointer-events-auto">
            <button
              type="button"
              onClick={handleSavePosition}
              disabled={savePositionStatus === 'saving' || !data?.nodes?.length}
              className="px-3 py-1.5 rounded-sm text-xs font-medium bg-[#09090B]/95 border border-[#3F3F46] text-[#E4E4E7] hover:bg-[#18181B] hover:border-[#71717A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Save current camera position to restore next time you sign in"
            >
              {savePositionStatus === 'saving' ? 'Saving…' : savePositionStatus === 'saved' ? 'Saved' : savePositionStatus === 'error' ? 'Error' : 'Save XYZ position'}
            </button>
          </div>
        )}
      </div>
      {/* Territory/Selection summary overlay */}
      <div className="pointer-events-none absolute bottom-4 left-12 z-[1100]">
        <div className="bg-[#09090B]/90 border border-[#3F3F46] rounded-sm px-2 py-1 text-[11px] text-[#E4E4E7] flex items-center gap-2">
          {selectionMode === 'individual' ? (
            // Individual mode: Show total nodes and edges in territory
            <>
              <span className="font-semibold">
                {data.nodes?.length || 0} {data.nodes?.length === 1 ? 'node' : 'nodes'}
              </span>
              <span className="text-[#71717A]">
                {data.links?.length || 0} {data.links?.length === 1 ? 'edge' : 'edges'}
              </span>
            </>
          ) : (
            // Multi-select mode: Show selected/total format
            <>
              <span className="font-semibold">
              <span>{data.nodes?.length || 0}</span>
                <span className="text-[#71717A]">/</span>
                <span className="text-[#1D9BF0]">{selectedNodes.size}</span>
                {' '}{selectedNodes.size === 1 && (data.nodes?.length || 0) === 1 ? 'node' : 'nodes'} selected
              </span>
              <span className="text-[#71717A]">
                <span>{data.links?.length || 0}</span>
                <span>/</span>
                <span className="text-[#1D9BF0]">{selectedEdges.size}</span>
                {' '}{selectedEdges.size === 1 && (data.links?.length || 0) === 1 ? 'edge' : 'edges'} selected
              </span>
            </>
          )}
        </div>
      </div>
      {/* Tooltip for node hover - Enhanced with node-type specific layouts */}
      <NodeTooltipEnhanced node={hoveredNode} position={tooltipPosition} graphData={data} />
    </>
  );
}));
// NOTE: Removed custom comparison function to allow onSelectedNodesChange and onSelectedEdgesChange callbacks to update
// Can add back later with optimized comparison if needed

export default ThreeGraphVisualization;
