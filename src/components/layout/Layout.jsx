import React, { useState, useEffect, useCallback } from 'react';
import { FaChevronRight, FaChevronLeft, FaChevronCircleUp, FaChevronCircleDown, FaBars } from 'react-icons/fa';
import { useToast } from '../../contexts/ToastContext';
import ToastContainer from '../common/ToastContainer';
import Header from './Header';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';

const Layout = ({
  children,
  stories = [],
  currentStory = null,
  currentChapter = null,
  currentSection = null,
  currentStoryId = null,
  currentChapterId = null,
  currentSectionId = null,
  onStorySelect,
  onChapterSelect,
  onSectionSelect,
  onPrevious,
  onNext,
  selectedNode = null,
  selectedEdge = null,
  forceStrength = 50,
  nodeSize = 50,
  labelSize = 50,
  edgeLength = 50,
  edgeThickness = 50,
  onForceChange,
  onNodeSizeChange,
  onLabelSizeChange,
  onEdgeLengthChange,
  onEdgeThicknessChange,
  is3D = true,
  on3DToggle = () => {},
  showRightSidebar = true,
  onToggleRightSidebar = () => {},
  onAISearch = null,
  onAISummary = null,
  graphData = { nodes: [], links: [] },
  graphDescription = null,
  sectionDescription = null,
  onEntityHighlight = null,
  rightSidebarActiveTab = 'node-properties',
  onRightSidebarActiveTabChange = () => {},
  mapView = null,
  onMapViewChange = () => {},
  onClusterNodeSelect = () => {},
  onSceneContainerChange = () => {},
  nodeTypesWithPropertyKeys = [],
  onClusterConfigChange = () => {},
  clusterMethod = '',
  clusterProperty = '',
  onSectionClick = () => {},
  filteredGraphData = null,
  onSortConfigChange = () => {},
  sortBy = null,
  sortOrder = 'asc',
  sortNodeCategory = '',
  sortNodeProperty = '',
  multiSelectSubgraph = null,
  selectedNodes = new Set(),
  selectedEdges = new Set(),
  hierarchyTreeAxis = { x: false, y: false, z: false },
  onHierarchyTreeAxisChange = () => {},
  showSavePositionButton = false,
  onSavePositionClick = null,
  savePositionStatus = null,
  resetPositionStatus = null,
  onResetPositionClick = null,
  rightSidebarRef = null,
  graphViewByMapRef = null,
  onHomePageClick = null,
}) => {
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLeftSidebarCollapse = useCallback((collapsed) => {
    setLeftSidebarCollapsed(collapsed);
  }, []);

  const handleRightSidebarCollapse = useCallback((collapsed) => {
    setRightSidebarCollapsed(collapsed);
  }, []);

  const { toasts, removeToast } = useToast();

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-black text-white overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {}
      <div
        className={`hidden lg:block w-full lg:w-80 flex-shrink-0 ${
          isMobile ? 'border-b-2' : ''
        } ${
          isMobile && leftSidebarCollapsed ? 'h-[60px]' : isMobile ? 'h-[25vh]' : 'h-full'
        }`}
      >
        <LeftSidebar
          stories={stories}
          currentStory={currentStory}
          currentChapter={currentChapter}
          currentSection={currentSection}
          currentStoryId={currentStoryId}
          currentChapterId={currentChapterId}
          currentSectionId={currentSectionId}
          onStorySelect={onStorySelect}
          onChapterSelect={onChapterSelect}
          onSectionSelect={onSectionSelect}
          onPrevious={onPrevious}
          onNext={onNext}
          onCollapseChange={handleLeftSidebarCollapse}
          onAISearch={onAISearch}
          onAISummary={onAISummary}
          graphData={graphData}
          graphDescription={graphDescription}
          sectionDescription={sectionDescription}
          onEntityHighlight={onEntityHighlight}
          showSavePositionButton={showSavePositionButton}
          onSavePositionClick={onSavePositionClick}
          savePositionStatus={savePositionStatus}
          resetPositionStatus={resetPositionStatus}
          onResetPositionClick={onResetPositionClick}
        />
      </div>

      {}
      <div className="flex flex-col flex-1 min-w-0 order-first lg:order-none">
        {}
        <Header
          stories={stories}
          currentStoryId={currentStoryId}
          currentChapterId={currentChapterId}
          currentSectionId={currentSectionId}
          onStorySelect={onStorySelect}
          onChapterSelect={onChapterSelect}
          onSectionSelect={onSectionSelect}
          showStoryDropdown={true}
          onHomePageClick={onHomePageClick}
        />

        {}
        <main
          className={`bg-black overflow-hidden ${
            isMobile ? 'flex-none h-[60vh]' : 'flex-1'
          }`}
        >
          {children}
        </main>
      </div>

      {}
      {/* Floating Right Sidebar Toggle Button - desktop / large screens */}
      <div
        className={`hidden lg:block fixed z-50 pointer-events-auto transition-all duration-300 ${
          showRightSidebar
            ? 'right-[345px] top-1/8 -translate-y-1/2'
            : 'right-2 top-1/8 -translate-y-1/2'
        }`}
      >
        <button
          onClick={onToggleRightSidebar}
          className="group relative flex items-center justify-start transition-all duration-3000"
          title={showRightSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          {showRightSidebar ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#B4B4B4] group-hover:text-[#5C9EFF] transition-colors"
            >
              <rect
                x="1"
                y="1"
                width="14"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
              <line
                x1="8"
                y1="1"
                x2="8"
                y2="15"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <line
                x1="4"
                y1="6"
                x2="6"
                y2="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="4"
                y1="10"
                x2="6"
                y2="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path d="M11 8L9 6L9 10L11 8Z" fill="currentColor" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#B4B4B4] group-hover:text-[#5C9EFF] transition-colors"
            >
              <rect
                x="1"
                y="1"
                width="14"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
              <line
                x1="8"
                y1="1"
                x2="8"
                y2="15"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M5 8L7 6L7 10L5 8Z" fill="currentColor" />
              <line
                x1="10"
                y1="6"
                x2="12"
                y2="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="10"
                y1="10"
                x2="12"
                y2="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {showRightSidebar && (
      <div
        className={`w-full lg:w-85 flex-shrink-0 relative ${
          isMobile ? 'border-t-2 bg-[#09090B] z-10' : 'h-full'
        } ${
          isMobile && rightSidebarCollapsed ? 'h-[45px]' : isMobile ? 'h-[40vh]' : 'h-full'
        }`}
      >
        <RightSidebar
          ref={rightSidebarRef}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          forceStrength={forceStrength}
          nodeSize={nodeSize}
          labelSize={labelSize}
          edgeLength={edgeLength}
          edgeThickness={edgeThickness}
          is3D={is3D}
          on3DToggle={on3DToggle}
          onForceChange={onForceChange}
          onNodeSizeChange={onNodeSizeChange}
          onLabelSizeChange={onLabelSizeChange}
          onEdgeLengthChange={onEdgeLengthChange}
          onEdgeThicknessChange={onEdgeThicknessChange}
          onCollapseChange={handleRightSidebarCollapse}
          onToggleRightSidebar={onToggleRightSidebar}
          onActiveTabChange={onRightSidebarActiveTabChange}
          mapView={mapView}
          onMapViewChange={onMapViewChange}
          onClusterNodeSelect={onClusterNodeSelect}
          onSceneContainerChange={onSceneContainerChange}
          nodeTypesWithPropertyKeys={nodeTypesWithPropertyKeys}
          onClusterConfigChange={onClusterConfigChange}
          clusterMethod={clusterMethod}
          clusterProperty={clusterProperty}
          currentSection={currentSection}
          onSectionClick={onSectionClick}
          graphData={graphData}
          filteredGraphData={filteredGraphData}
          onSortConfigChange={onSortConfigChange}
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortNodeCategory={sortNodeCategory}
          sortNodeProperty={sortNodeProperty}
          multiSelectSubgraph={multiSelectSubgraph}
          externalActiveTab={rightSidebarActiveTab}
          selectedNodes={selectedNodes}
          selectedEdges={selectedEdges}
          hierarchyTreeAxis={hierarchyTreeAxis}
          onHierarchyTreeAxisChange={onHierarchyTreeAxisChange}
        />
      </div>
      )}
    </div>
  );
};

export default React.memo(Layout);
