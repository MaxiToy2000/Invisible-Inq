import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/layout/Layout';
import ThreeGraphVisualization from '../components/graph/ThreeGraphVisualization';
import GraphControls from '../components/graph/GraphControls';
import DonationPopup from '../components/common/DonationPopup';
import AISearchModal from '../components/common/AISearchModal';
import useGraphData from '../hooks/useGraphData';
import Loader from '../components/common/Loader';
import { FaProjectDiagram, FaTable, FaCode, FaSearch, FaDownload, FaCube, FaSquare, FaTimes, FaSearchPlus, FaSearchMinus, FaExpand, FaExpandArrowsAlt, FaMousePointer, FaDrawPolygon, FaVectorSquare } from 'react-icons/fa';

const GraphPage = () => {
  const location = useLocation();
  const { showError } = useToast();
  const { isAuthenticated } = useAuth();
  const graphRef = useRef(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const [savedGraphCameraPosition, setSavedGraphCameraPosition] = useState(null);
  const [savePositionStatus, setSavePositionStatus] = useState(null); // 'saving' | 'saved' | 'error' | null

  const {
    stories,
    currentStory,
    currentChapter,
    currentSubstory,
    currentStoryId,
    currentChapterId,
    currentSubstoryId,
    graphData,
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

  // Show error toast for general errors
  useEffect(() => {
    if (error) {
      showError(`Failed to load data: ${error}`, 'Error');
    }
  }, [error, showError]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const storyId = searchParams.get('story');
    const chapterId = searchParams.get('chapter');
    const substoryId = searchParams.get('substory');

    if (storyId) {
      selectStory(storyId);

      if (chapterId) {
        setTimeout(() => {
          selectChapter(chapterId);

          if (substoryId) {
            setTimeout(() => {
              selectSubstory(substoryId);
            }, 100);
          }
        }, 100);
      }
    }
  }, [location.search, selectStory, selectChapter, selectSubstory]);

  const [forceStrength, setForceStrength] = useState(50);
  const [nodeSize, setNodeSize] = useState(50);
  const [labelSize, setLabelSize] = useState(50);
  const [edgeLength, setEdgeLength] = useState(50);
  const [edgeThickness, setEdgeThickness] = useState(50);
  const [showDonationPopup, setShowDonationPopup] = useState(false);
  const [viewMode, setViewMode] = useState('Graph');
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [is3D, setIs3D] = useState(true);
  const [zoomAction, setZoomAction] = useState(null);
  const [selectionMode, setSelectionMode] = useState('individual'); // 'individual' | 'box' | 'lasso'
  const [selectedNodes, setSelectedNodes] = useState(new Set()); // Multi-select nodes
  const [selectedEdges, setSelectedEdges] = useState(new Set()); // Multi-select edges
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rightSidebarActiveTab, setRightSidebarActiveTab] = useState('node-properties');
  const [multiSelectSubgraph, setMultiSelectSubgraph] = useState(null); // Store subgraph for multi-select
  const graphContainerRef = useRef(null);
  const [showAISearchModal, setShowAISearchModal] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiGeneratedQuery, setAiGeneratedQuery] = useState(null);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState(null);

  // Show error toast for AI search errors
  useEffect(() => {
    if (aiSearchError) {
      showError(aiSearchError, 'AI Search Error');
      setAiSearchError(null); // Clear error after showing toast
    }
  }, [aiSearchError, showError]);

  // Load saved graph camera position when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setSavedGraphCameraPosition(null);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    let cancelled = false;
    fetch(`${apiBaseUrl}/api/graph-camera-position`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok || res.status === 204) return null;
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  // Handle selection mode changes
  const handleSelectionModeChange = (newMode) => {
    // Clear any selected nodes/edges
    selectNode(null);
    selectEdge(null);
    setMultiSelectSubgraph(null);
    
    // Switch to node-properties tab
    setRightSidebarActiveTab('node-properties');
    
    // Trigger zoom to fit
    setZoomAction('fit');
    
    // Update selection mode
    setSelectionMode(newMode);
  };

  // Handle node click in multi-select mode - create subgraph
  const handleMultiSelectNodeClick = (node) => {
    if (!node || !graphData) return;
    
    // Find all edges connected to this node
    const connectedEdges = graphData.links.filter(link => {
      const sourceId = link.source?.id || link.source || link.sourceId;
      const targetId = link.target?.id || link.target || link.targetId;
      return sourceId === node.id || targetId === node.id;
    });
    
    // Find all nodes connected via those edges
    const connectedNodeIds = new Set([node.id]);
    connectedEdges.forEach(edge => {
      const sourceId = edge.source?.id || edge.source || edge.sourceId;
      const targetId = edge.target?.id || edge.target || edge.targetId;
      connectedNodeIds.add(sourceId);
      connectedNodeIds.add(targetId);
    });
    
    const connectedNodes = graphData.nodes.filter(n => connectedNodeIds.has(n.id));
    
    // Create subgraph
    const subgraph = {
      nodes: connectedNodes,
      links: connectedEdges
    };
    
    setMultiSelectSubgraph(subgraph);
    selectNode(node); // Still select the node for properties display
    setRightSidebarActiveTab('node-properties'); // Ensure NODE PROPERTIES tab is active
  };

  // Wrapper for node click that checks selection mode
  const handleNodeClick = (node) => {
    if (selectionMode === 'box' || selectionMode === 'lasso') {
      handleMultiSelectNodeClick(node);
    } else {
      selectNode(node);
      setMultiSelectSubgraph(null);
    }
  };

  // Wrapper for edge click that checks selection mode  
  const handleEdgeClick = (edge) => {
    if (selectionMode === 'box' || selectionMode === 'lasso') {
      // For edge clicks in multi-select, show subgraph with source and target nodes
      if (!edge || !graphData) return;
      
      const sourceId = edge.source?.id || edge.source || edge.sourceId;
      const targetId = edge.target?.id || edge.target || edge.targetId;
      
      const sourceNode = graphData.nodes.find(n => n.id === sourceId);
      const targetNode = graphData.nodes.find(n => n.id === targetId);
      
      if (sourceNode && targetNode) {
        const subgraph = {
          nodes: [sourceNode, targetNode],
          links: [edge]
        };
        setMultiSelectSubgraph(subgraph);
        selectEdge(edge);
        setRightSidebarActiveTab('node-properties');
      }
    } else {
      selectEdge(edge);
      setMultiSelectSubgraph(null);
    }
  };

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowDonationPopup(true);
    }, 5 * 60 * 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      setViewMode('Graph');
    }
  }, [graphData]);

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
      onStorySelect={selectStory}
      onChapterSelect={selectChapter}
      onSubstorySelect={selectSubstory}
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
      rightSidebarActiveTab={rightSidebarActiveTab}
      onRightSidebarActiveTabChange={setRightSidebarActiveTab}
      graphData={graphData}
      multiSelectSubgraph={multiSelectSubgraph}
      selectedNodes={selectedNodes}
      selectedEdges={selectedEdges}
      showSavePositionButton={viewMode === 'Graph'}
      onSavePositionClick={isAuthenticated ? handleSavePositionClick : undefined}
      savePositionStatus={savePositionStatus}
      onResetPositionClick={handleResetPositionClick}
    >
      <div className="relative w-full h-full flex flex-col">
        <div className="flex-1 w-full flex flex-col">
          <div
            ref={graphContainerRef}
            className="w-full h-full lg:h-[calc(100vh-32px)] bg-black overflow-hidden relative"
          >
            {}
            {loading && viewMode === 'Graph' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                <Loader size={48} />
              </div>
            )}

            {}
            {!loading && !error && graphData.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-300 p-4">
                  <p className="text-xl font-semibold">No Data</p>
                  <p>Please select a story from the sidebar to visualize the graph.</p>
                </div>
              </div>
            )}

            {}
            {viewMode === 'Graph' && (
                <ThreeGraphVisualization
                  ref={graphRef}
                  data={graphData}
                  onNodeClick={handleNodeClick}
                  loading={loading}
                  onLinkClick={handleEdgeClick}
                  forceStrength={forceStrength}
                  nodeSize={nodeSize}
                  labelSize={labelSize}
                  edgeLength={edgeLength}
                  edgeThickness={edgeThickness}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  zoomAction={zoomAction}
                  onZoomComplete={() => setZoomAction(null)}
                  is3D={is3D}
                  searchTerm={searchTerm}
                  selectionMode={selectionMode}
                  onSelectedNodesChange={(nodes) => {
                    setSelectedNodes(nodes);
                  }}
                  onSelectedEdgesChange={(edges) => {
                    setSelectedEdges(edges);
                  }}
                  initialCameraPosition={savedGraphCameraPosition}
                />
            )}

                {viewMode === 'Table' && (
                  <div className="w-full h-full bg-[#111111] overflow-auto p-4 text-[#B4B4B4]">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Nodes</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#707070]">
                              <th className="text-left p-2 font-medium">Name</th>
                              <th className="text-left p-2 font-medium">Category</th>
                              <th className="text-left p-2 font-medium">ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {graphData.nodes
                              .filter(node =>
                                !searchTerm ||
                                (node.name && node.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                (node.id && node.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                (node.category && node.category.toLowerCase().includes(searchTerm.toLowerCase()))
                              )
                              .map((node, index) => (
                                <tr
                                  key={index}
                                  className={`border-b border-[#707070] cursor-pointer hover:bg-[#1a1a1a] ${
                                    selectedNode?.id === node.id ? 'bg-[#1a1a1a] bg-opacity-20' : ''
                                  }`}
                                  onClick={() => selectNode(node)}
                                >
                                  <td className="p-2">{node.name || node.id}</td>
                                  <td className="p-2">{node.category || '-'}</td>
                                  <td className="p-2 font-mono text-xs">{node.id}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Edges</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#707070]">
                              <th className="text-left p-2 font-medium">Source</th>
                              <th className="text-left p-2 font-medium">Target</th>
                              <th className="text-left p-2 font-medium">Label</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(graphData.links || []).map((link, index) => {
                              const sourceNode = graphData.nodes.find(n => n.id === link.source || n.id === link.sourceId);
                              const targetNode = graphData.nodes.find(n => n.id === link.target || n.id === link.targetId);
                              return (
                                <tr
                                  key={index}
                                  className={`border-b border-[#707070] cursor-pointer hover:bg-[#1a1a1a] ${
                                    selectedEdge?.id === link.id ? 'bg-[#1a1a1a] bg-opacity-20' : ''
                                  }`}
                                  onClick={() => selectEdge(link)}
                                >
                                  <td className="p-2">{sourceNode?.name || link.source || link.sourceId}</td>
                                  <td className="p-2">{targetNode?.name || link.target || link.targetId}</td>
                                  <td className="p-2">{link.label || link.title || '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'JSON' && (
                  <div className="w-full h-full overflow-auto bg-[#111111]">
                    <pre className="text-xs text-[#B4B4B4] bg-[#111111] p-4 rounded font-mono whitespace-pre-wrap">
                      <code>{JSON.stringify(graphData, null, 2)}</code>
                    </pre>
                  </div>
                )}

                {}
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {}
                  <div className="absolute top-4 left-4 pointer-events-auto flex flex-col gap-2">
                    {/* View Mode Buttons */}
                    <div className="flex rounded-lg border border-[#707070] bg-[#09090B] gap-1">
                      <button
                        onClick={() => setViewMode('Graph')}
                        className={`w-16 h-8 rounded-md transition-colors flex items-center justify-center ${
                          viewMode === 'Graph'
                            ? 'bg-[red] bg-opacity-20 border border-[#1a1a1a]'
                            : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                        }`}
                        title="Graph View"
                      >
                        <FaProjectDiagram className={viewMode === 'Graph' ? 'text-[#1a1a1a]' : 'text-[#B4B4B4]'} size={12} />
                      </button>
                      <button
                        onClick={() => setViewMode('Table')}
                        className={`w-16 h-8 rounded-md transition-colors flex items-center justify-center ${
                          viewMode === 'Table'
                            ? 'bg-[#1a1a1a] bg-opacity-20 border border-[#1a1a1a]'
                            : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                        }`}
                        title="Table View"
                      >
                        <FaTable className={viewMode === 'Table' ? 'text-[#1a1a1a]' : 'text-[#B4B4B4]'} size={12} />
                      </button>
                      <button
                        onClick={() => setViewMode('JSON')}
                        className={`w-16 h-8 rounded-md transition-colors flex items-center justify-center ${
                          viewMode === 'JSON'
                            ? 'bg-[#1a1a1a] bg-opacity-20 border border-[#1a1a1a]'
                            : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                        }`}
                        title="JSON View"
                      >
                        <FaCode className={viewMode === 'JSON' ? 'text-[#1a1a1a]' : 'text-[#B4B4B4]'} size={12} />
                      </button>
                    </div>
                    
                    {/* Selection Mode Buttons - Only show in Graph view */}
                    {viewMode === 'Graph' && (
                      <div className="flex rounded-lg border border-[#707070] bg-[#09090B] gap-1">
                        <button
                          onClick={() => handleSelectionModeChange('individual')}
                          className={`w-16 h-8 rounded-md transition-colors flex items-center justify-center ${
                            selectionMode === 'individual'
                              ? 'bg-[#1D9BF0] bg-opacity-30 border border-[#1D9BF0]'
                              : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                          }`}
                          title="Individual Selection"
                        >
                          <FaMousePointer className={selectionMode === 'individual' ? 'text-[#1D9BF0]' : 'text-[#B4B4B4]'} size={12} />
                        </button>
                        <button
                          onClick={() => handleSelectionModeChange('box')}
                          className={`w-16 h-8 rounded-md transition-colors flex items-center justify-center ${
                            selectionMode === 'box'
                              ? 'bg-[#1D9BF0] bg-opacity-30 border border-[#1D9BF0]'
                              : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                          }`}
                          title="Box Selection"
                        >
                          <FaVectorSquare className={selectionMode === 'box' ? 'text-[#1D9BF0]' : 'text-[#B4B4B4]'} size={12} />
                        </button>
                        <button
                          onClick={() => handleSelectionModeChange('lasso')}
                          className={`w-16 h-8 rounded-md transition-colors flex items-center justify-center ${
                            selectionMode === 'lasso'
                              ? 'bg-[#1D9BF0] bg-opacity-30 border border-[#1D9BF0]'
                              : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                          }`}
                          title="Lasso Selection"
                        >
                          <FaDrawPolygon className={selectionMode === 'lasso' ? 'text-[#1D9BF0]' : 'text-[#B4B4B4]'} size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {}
                  <div className="absolute top-4 right-4 pointer-events-auto">
                    <div className="flex rounded-sm border border-[#707070] bg-[#09090B] p-1 gap-1">
                      <button
                        onClick={() => setShowSearch(!showSearch)}
                        className={`w-16 h-8 rounded-md transition-colors flex items-center justify-center ${
                          showSearch
                            ? 'bg-[#1a1a1a] bg-opacity-20 border border-[#1a1a1a]'
                            : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                        }`}
                        title="Search"
                      >
                        <FaSearch className={showSearch ? 'text-[#1a1a1a]' : 'text-[#B4B4B4]'} size={12} />
                      </button>
                      <button
                        onClick={handleDownload}
                        className="w-16 h-8 rounded-md bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                        title="Download Data"
                      >
                        <FaDownload className="text-[#B4B4B4]" size={12} />
                      </button>
                    </div>
                  </div>

                  {}
                  {showSearch && (
                    <div className="absolute top-16 right-4 pointer-events-auto">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search nodes..."
                          className="px-4 py-2 pr-10 rounded-lg border border-[#707070] bg-[#09090B] text-[#B4B4B4] focus:outline-none focus:border-[#1a1a1a] w-64"
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
                  <div className="absolute bottom-4 right-4 pointer-events-auto">
                    <div className="w-5 flex flex-col rounded-sm border border-[#707070] bg-[#09090B] p-1 gap-1">
                      <button
                        onClick={() => setZoomAction('in')}
                        className="w-16 h-8 rounded-md bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                        title="Zoom In"
                      >
                        <FaSearchPlus className="text-[#B4B4B4]" size={12} />
                      </button>
                      <button
                        onClick={() => setZoomAction('out')}
                        className="w-16 h-8 rounded-md bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                        title="Zoom Out"
                      >
                        <FaSearchMinus className="text-[#B4B4B4]" size={12} />
                      </button>
                      <button
                        onClick={() => setZoomAction('fit')}
                        className="w-16 h-8 rounded-md bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                        title="Zoom to Fit"
                      >
                        <FaExpand className="text-[#B4B4B4]" size={12} />
                      </button>
                      <button
                        onClick={toggleFullscreen}
                        className="w-16 h-8 rounded-md bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                        title="Full Screen"
                      >
                        <FaExpandArrowsAlt className="text-[#B4B4B4]" size={12} />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
              {}
          </div>
        </div>

        {showDonationPopup && (
          <DonationPopup onClose={() => setShowDonationPopup(false)} />
        )}
    </Layout>

    {}
    {showAISearchModal && (
      <AISearchModal
        isOpen={showAISearchModal}
        onClose={handleCloseAISearchModal}
        graphData={aiSearchResults}
        searchQuery={aiSearchQuery}
        generatedQuery={aiGeneratedQuery}
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
    </>
  );
};

export default GraphPage;
