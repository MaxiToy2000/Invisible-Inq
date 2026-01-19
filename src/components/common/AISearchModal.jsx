import { useState, useRef } from 'react';
import ThreeGraphVisualization from '../graph/ThreeGraphVisualization';
import { FaTimes, FaCube, FaSquare, FaSearchPlus, FaSearchMinus, FaExpand, FaExpandArrowsAlt, FaProjectDiagram, FaTable, FaCode, FaDownload, FaDatabase } from 'react-icons/fa';

const AISearchModal = ({ isOpen, onClose, graphData, searchQuery, generatedQuery }) => {
  const [viewMode, setViewMode] = useState('Graph');
  const [showQuery, setShowQuery] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [zoomAction, setZoomAction] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceStrength, setForceStrength] = useState(50);
  const [nodeSize, setNodeSize] = useState(50);
  const [labelSize, setLabelSize] = useState(50);
  const [edgeLength, setEdgeLength] = useState(50);
  const [edgeThickness, setEdgeThickness] = useState(50);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const graphContainerRef = useRef(null);

  if (!isOpen || !graphData) return null;

  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

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

  const handleDownload = () => {
    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-search-results-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
      <div className="bg-[#09090B] border border-[#707070] rounded-lg shadow-lg w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col text-white overflow-hidden">
        {}
        <div className="flex items-center justify-between p-4 border-b border-[#707070] flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">AI Search Results</h2>
            {searchQuery && (
              <span className="text-sm text-[#B4B4B4]">"{searchQuery}"</span>
            )}
            {graphData.nodes && (
              <span className="text-xs text-[#707070]">
                ({graphData.nodes.length} nodes, {graphData.links?.length || 0} links)
              </span>
            )}
            {generatedQuery && (
              <button
                onClick={() => setShowQuery(!showQuery)}
                className="ml-2 px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded transition-colors flex items-center gap-1"
                title={showQuery ? "Hide Query" : "Show Query"}
              >
                <FaDatabase size={14} />
                {showQuery ? 'Hide Query' : 'Show Query'}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
            title="Close"
          >
            <FaTimes className="text-[#B4B4B4]" size={20} />
          </button>
        </div>

        {}
        {generatedQuery && showQuery && (
          <div className="border-b border-[#707070] bg-[#111111] p-4 max-h-64 overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#B4B4B4]">Generated Query</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedQuery);
                }}
                className="text-xs px-2 py-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded transition-colors"
                title="Copy Query"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs text-[#B4B4B4] bg-[#09090B] p-3 rounded border border-[#707070] overflow-x-auto font-mono whitespace-pre-wrap">
              <code>{generatedQuery}</code>
            </pre>
          </div>
        )}

        {}
        <div ref={graphContainerRef} className="flex-1 relative min-h-0 bg-black">
          {}
          {viewMode === 'Graph' && (
            <ThreeGraphVisualization
              data={graphData}
              onNodeClick={setSelectedNode}
              onLinkClick={setSelectedEdge}
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
            />
          )}

          {}
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
                      {graphData.nodes?.map((node, index) => (
                        <tr
                          key={index}
                          className={`border-b border-[#707070] cursor-pointer hover:bg-[#1a1a1a] ${
                            selectedNode?.id === node.id ? 'bg-[#1a1a1a] bg-opacity-20' : ''
                          }`}
                          onClick={() => setSelectedNode(node)}
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
                <h3 className="text-lg font-semibold mb-2">Links</h3>
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
                        const sourceNode = graphData.nodes?.find(n => n.id === link.source || n.id === link.sourceId);
                        const targetNode = graphData.nodes?.find(n => n.id === link.target || n.id === link.targetId);
                        return (
                          <tr
                            key={index}
                            className={`border-b border-[#707070] cursor-pointer hover:bg-[#1a1a1a] ${
                              selectedEdge?.id === link.id ? 'bg-[#1a1a1a] bg-opacity-20' : ''
                            }`}
                            onClick={() => setSelectedEdge(link)}
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

          {}
          {viewMode === 'JSON' && (
            <div className="w-full h-full overflow-auto bg-[#111111]">
              <pre className="text-xs text-[#B4B4B4] bg-[#111111] p-4 rounded font-mono whitespace-pre-wrap">
                <code>{JSON.stringify(graphData, null, 2)}</code>
              </pre>
            </div>
          )}

          {}
          {viewMode === 'Query' && generatedQuery && (
            <div className="w-full h-full overflow-auto bg-[#111111] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#B4B4B4]">Generated Query</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedQuery);
                  }}
                  className="px-3 py-1 text-sm bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded transition-colors"
                  title="Copy Query"
                >
                  Copy Query
                </button>
              </div>
              <pre className="text-xs text-[#B4B4B4] bg-[#09090B] p-4 rounded border border-[#707070] overflow-x-auto font-mono whitespace-pre-wrap">
                <code>{generatedQuery}</code>
              </pre>
            </div>
          )}

          {}
          {viewMode === 'Query' && !generatedQuery && (
            <div className="w-full h-full flex items-center justify-center bg-[#111111]">
              <p className="text-[#B4B4B4]">No query available for this search.</p>
            </div>
          )}

          {}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {}
            <div className="absolute top-4 left-4 pointer-events-auto">
              <div className="flex rounded-sm border border-[#707070] bg-[#09090B] p-0.5 gap-0.5">
                <button
                  onClick={() => setViewMode('Graph')}
                  className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                    viewMode === 'Graph'
                      ? 'bg-[#1a1a1a] bg-opacity-20'
                      : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                  }`}
                  title="Graph View"
                >
                  <FaProjectDiagram className="text-[#B4B4B4]" size={14} />
                </button>
                <button
                  onClick={() => setViewMode('Table')}
                  className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                    viewMode === 'Table'
                      ? 'bg-[#1a1a1a] bg-opacity-20'
                      : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                  }`}
                  title="Table View"
                >
                  <FaTable className="text-[#B4B4B4]" size={14} />
                </button>
                <button
                  onClick={() => setViewMode('JSON')}
                  className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                    viewMode === 'JSON'
                      ? 'bg-[#1a1a1a] bg-opacity-20'
                      : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                  }`}
                  title="JSON View"
                >
                  <FaCode className="text-[#B4B4B4]" size={14} />
                </button>
                {generatedQuery && (
                  <button
                    onClick={() => setViewMode('Query')}
                    className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                      viewMode === 'Query'
                        ? 'bg-[#1a1a1a] bg-opacity-20'
                        : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                    }`}
                    title="Query View"
                  >
                    <FaDatabase className="text-[#B4B4B4]" size={14} />
                  </button>
                )}
              </div>
            </div>

            {}
            <div className="absolute top-4 right-4 pointer-events-auto">
              <div className="flex rounded-sm border border-[#707070] bg-[#09090B] p-0.5 gap-0.5">
                <button
                  onClick={handleDownload}
                  className="w-5 h-5 rounded-[2px] bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                  title="Download Data"
                >
                  <FaDownload className="text-[#B4B4B4]" size={14} />
                </button>
                <button
                  onClick={() => setIs3D(!is3D)}
                  className={`w-5 h-5 rounded-[2px] transition-colors flex items-center justify-center ${
                    is3D
                      ? 'bg-[#1a1a1a] bg-opacity-20'
                      : 'bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
                  }`}
                  title={is3D ? 'Switch to 2D View' : 'Switch to 3D View'}
                >
                  {is3D ? (
                    <FaCube className="text-[#B4B4B4]" size={14} />
                  ) : (
                    <FaSquare className="text-[#B4B4B4]" size={14} />
                  )}
                </button>
              </div>
            </div>

            {}
            <div className="absolute bottom-4 right-4 pointer-events-auto">
              <div className="w-7.5 flex flex-col rounded-sm border border-[#707070] bg-[#09090B] p-0.5 gap-1">
                <button
                  onClick={() => setZoomAction('in')}
                  className="w-5 h-5 rounded-sm bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                  title="Zoom In"
                >
                  <FaSearchPlus className="text-[#B4B4B4]" size={14} />
                </button>
                <button
                  onClick={() => setZoomAction('out')}
                  className="w-5 h-5 rounded-sm bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                  title="Zoom Out"
                >
                  <FaSearchMinus className="text-[#B4B4B4]" size={14} />
                </button>
                <button
                  onClick={() => setZoomAction('fit')}
                  className="w-5 h-5 rounded-sm bg-[#09090B] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors flex items-center justify-center"
                  title="Zoom to Fit"
                >
                  <FaExpand className="text-[#B4B4B4]" size={14} />
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
          </div>

          {}
          {(selectedNode || selectedEdge) && (
            <div className="absolute bottom-4 left-4 pointer-events-auto bg-[#09090B] border border-[#707070] rounded p-4 max-w-sm max-h-96 overflow-auto">
              {selectedNode && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{selectedNode.name || selectedNode.id}</h4>
                    {selectedNode.node_type && (
                      <span className="text-xs px-2 py-1 bg-[#1a1a1a] rounded text-[#B4B4B4]">
                        {selectedNode.node_type}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#B4B4B4] space-y-1">
                    <p><span className="font-medium">ID:</span> {selectedNode.id}</p>
                    {selectedNode.node_type && (
                      <p><span className="font-medium">Type:</span> {selectedNode.node_type}</p>
                    )}
                    {selectedNode.section && (
                      <p><span className="font-medium">Section:</span> {selectedNode.section}</p>
                    )}
                    {selectedNode.degree !== undefined && selectedNode.degree !== null && (
                      <p><span className="font-medium">Degree:</span> {selectedNode.degree}</p>
                    )}
                    {}
                    {Object.entries(selectedNode).map(([key, value]) => {
                      if (['id', 'gid', 'name', 'node_type', 'section', 'category', 'color', 'highlight', 'degree'].includes(key)) {
                        return null;
                      }

                      if (value === null || value === undefined || value === '') {
                        return null;
                      }

                      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <p key={key}>
                          <span className="font-medium">{displayKey}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedEdge && (
                <div>
                  <h4 className="font-semibold mb-2">Relationship</h4>
                  <div className="text-xs text-[#B4B4B4] space-y-1">
                    <p><span className="font-medium">From:</span> {selectedEdge.from_name || selectedEdge.source || selectedEdge.sourceId}</p>
                    <p><span className="font-medium">To:</span> {selectedEdge.to_name || selectedEdge.target || selectedEdge.targetId}</p>
                    {selectedEdge.type && (
                      <p><span className="font-medium">Type:</span> {selectedEdge.type}</p>
                    )}
                    {selectedEdge.label && (
                      <p><span className="font-medium">Label:</span> {selectedEdge.label}</p>
                    )}
                    {selectedEdge.relationship_summary && (
                      <p><span className="font-medium">Summary:</span> {selectedEdge.relationship_summary}</p>
                    )}
                    {selectedEdge.article_title && (
                      <p><span className="font-medium">Article:</span> {selectedEdge.article_title}</p>
                    )}
                    {selectedEdge.article_url && (
                      <p><span className="font-medium">URL:</span> <a href={selectedEdge.article_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{selectedEdge.article_url}</a></p>
                    )}
                    {selectedEdge.relationship_date && (
                      <p><span className="font-medium">Date:</span> {selectedEdge.relationship_date}</p>
                    )}
                    {}
                    {Object.entries(selectedEdge).map(([key, value]) => {
                      if (['id', 'gid', 'from_name', 'to_name', 'source', 'target', 'sourceId', 'targetId', 'type', 'label', 'relationship_summary', 'article_title', 'article_url', 'relationship_date'].includes(key)) {
                        return null;
                      }
                      if (value === null || value === undefined || value === '') {
                        return null;
                      }
                      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <p key={key}>
                          <span className="font-medium">{displayKey}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISearchModal;
