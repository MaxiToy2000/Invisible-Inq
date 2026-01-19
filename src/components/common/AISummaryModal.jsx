import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FaTimes, FaSpinner, FaExclamationTriangle, FaSearch, FaRedo } from 'react-icons/fa';
import { getNodeTypeColor } from '../../utils/colorUtils';
import Loader from './Loader';

/**
 * AISummaryModal - Displays AI-generated summaries with embedded entity buttons
 * 
 * The summary text contains [[Entity Name]] markers that are rendered as
 * clickable buttons. Clicking a button highlights/selects that entity in the graph.
 */
const AISummaryModal = ({ 
  isOpen, 
  onClose, 
  query: initialQuery = '',
  graphData = null,
  onEntityClick = null,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens with new query
  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
      // Auto-fetch summary when modal opens with a query
      fetchSummary(initialQuery);
    }
  }, [isOpen, initialQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSummary(null);
      setError(null);
      renderedEntitiesRef.current.clear();
    }
  }, [isOpen]);

  // Reset rendered entities when summary changes
  useEffect(() => {
    if (summary) {
      renderedEntitiesRef.current.clear();
    }
  }, [summary]);

  const fetchSummary = useCallback(async (searchQuery) => {
    if (!searchQuery?.trim() || !graphData) {
      setError('Please enter a question and ensure graph data is loaded.');
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      // Optimize graphData to send only essential information
      const optimizedGraphData = {
        nodes: (graphData.nodes || []).map(node => ({
          id: node.id,
          name: node.name || node['Entity Name'] || node.entity_name || node.id,
          type: node.node_type || node.type || node.category || 'Unknown',
          label: node.label || node.name || node.id
        })),
        links: (graphData.links || []).map(link => ({
          source: link.source?.id || link.sourceId || link.source,
          target: link.target?.id || link.targetId || link.target,
          type: link.type || link.relationship || 'Unknown'
        }))
      };

      const response = await fetch(`${apiBaseUrl}/api/ai/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          graphData: optimizedGraphData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching AI summary:', err);
      setError(err.message || 'Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, graphData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      fetchSummary(query);
    }
  };

  const handleRetry = () => {
    if (query.trim()) {
      fetchSummary(query);
    }
  };

  // Build a map of entity names to nodes for quick lookup
  const entityNodeMap = useMemo(() => {
    const map = new Map();
    if (graphData?.nodes) {
      graphData.nodes.forEach(node => {
        const name = node.name || node.entity_name || node.id;
        if (name) {
          map.set(name.toLowerCase(), node);
        }
      });
    }
    return map;
  }, [graphData]);

  // Track which entities have been rendered to avoid duplicates (use ref to persist across renders)
  const renderedEntitiesRef = useRef(new Set());

  // Parse summary text and render [[Entity]] as clickable buttons
  const renderSummaryWithButtons = useCallback((text) => {
    if (!text) return null;

    // Reset rendered entities for each new summary render
    renderedEntitiesRef.current.clear();

    // Split by [[...]] pattern
    const parts = text.split(/(\[\[[^\]]+\]\])/g);

    return parts.map((part, index) => {
      // Check if this part is an entity marker
      const entityMatch = part.match(/^\[\[([^\]]+)\]\]$/);
      
      if (entityMatch) {
        const entityName = entityMatch[1];
        const entityKey = entityName.toLowerCase();
        
        // Check if this entity has already been rendered
        if (renderedEntitiesRef.current.has(entityKey)) {
          // Entity already rendered - just show as plain text with link styling
          return (
            <span
              key={`entity-duplicate-${index}`}
              className="text-[#6EA4F4] hover:underline cursor-pointer"
              onClick={() => {
                const node = entityNodeMap.get(entityKey);
                if (node && onEntityClick) {
                  onEntityClick(node);
                }
              }}
              title={`Click to highlight ${entityName} in graph`}
            >
              {entityName}
            </span>
          );
        }
        
        // Mark as rendered
        renderedEntitiesRef.current.add(entityKey);
        
        const node = entityNodeMap.get(entityKey);
        
        if (node) {
          const nodeType = node.node_type || node.type || 'Entity';
          const color = getNodeTypeColor(nodeType);
          
          return (
            <button
              key={`entity-${index}`}
              onClick={() => {
                if (onEntityClick) {
                  onEntityClick(node);
                }
              }}
              className="inline-flex items-center px-2 py-0.5 mx-0.5 text-sm font-medium rounded-full 
                         text-white hover:opacity-80 transition-all duration-200 
                         hover:scale-105 cursor-pointer border border-transparent
                         hover:border-white/30 shadow-sm"
              style={{ 
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}40`
              }}
              title={`Click to highlight ${entityName} in graph`}
            >
              {entityName}
            </button>
          );
        } else {
          // Entity not found in graph - render as text with subtle styling
          return (
            <span 
              key={`entity-notfound-${index}`}
              className="inline-flex items-center px-2 py-0.5 mx-0.5 text-sm font-medium 
                         rounded-full bg-[#1a1a1a] text-[#707070] border border-[#404040]"
              title={`${entityName} (not found in current graph)`}
            >
              {entityName}
            </span>
          );
        }
      }
      
      // Regular text
      return <span key={`text-${index}`}>{part}</span>;
    });
  }, [entityNodeMap, onEntityClick]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-[#09090B] border border-[#707070] rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#707070] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#404040] flex items-center justify-center">
              <FaSearch className="text-[#B4B4B4]" size={14} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Analysis</h2>
              <p className="text-xs text-[#707070]">Ask questions about your graph data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            title="Close"
          >
            <FaTimes className="text-[#B4B4B4] hover:text-white" size={18} />
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-[#707070] flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about this graph..."
              className="w-full pl-4 pr-12 py-3 bg-[#1a1a1a] border border-[#404040] rounded-lg 
                         text-white placeholder:text-[#707070] focus:outline-none focus:border-[#5C9EFF]
                         focus:ring-1 focus:ring-[#5C9EFF]/30 transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg
                         bg-[#5C9EFF] hover:bg-[#7BB3FF] disabled:bg-[#1a1a1a] disabled:cursor-not-allowed
                         disabled:border disabled:border-[#404040] transition-colors"
              title="Generate Summary"
            >
              {loading ? (
                <FaSpinner className="animate-spin text-white" size={14} />
              ) : (
                <FaSearch className="text-white" size={14} />
              )}
            </button>
          </div>
          {graphData && (
            <div className="mt-2 text-xs text-[#707070]">
              Analyzing {graphData.nodes?.length || 0} nodes and {graphData.links?.length || 0} relationships
            </div>
          )}
        </form>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#707070]">
              <Loader size={48} />
              <p className="text-sm text-[#B4B4B4]">Analyzing graph data...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#404040] flex items-center justify-center">
                <FaExclamationTriangle className="text-[#F03E3E]" size={20} />
              </div>
              <div className="text-center">
                <p className="text-[#F03E3E] font-medium mb-1">Error</p>
                <p className="text-sm text-[#707070] max-w-md">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] 
                           border border-[#404040] rounded-lg text-sm text-[#B4B4B4] transition-colors"
              >
                <FaRedo size={12} />
                Try Again
              </button>
            </div>
          )}

          {/* Summary Display */}
          {summary && !loading && !error && (
            <div className="space-y-4">
              {/* Query Badge */}
              <div className="flex items-start gap-2">
                <span className="px-2 py-1 bg-[#1a1a1a] border border-[#404040] text-[#B4B4B4] text-xs rounded-full flex-shrink-0">
                  Q
                </span>
                <p className="text-sm text-[#B4B4B4]">{summary.query}</p>
              </div>

              {/* Summary Text with Entity Buttons */}
              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#404040]">
                <div className="flex items-start gap-2">
                  <span className="px-2 py-1 bg-[#1a1a1a] border border-[#404040] text-[#B4B4B4] text-xs rounded-full flex-shrink-0 mt-0.5">
                    A
                  </span>
                  <div className="text-[#F4F4F5] leading-relaxed text-sm whitespace-pre-wrap">
                    {renderSummaryWithButtons(summary.summary)}
                  </div>
                </div>
              </div>

              {/* Mentioned Entities */}
              {summary.entities && summary.entities.length > 0 && (() => {
                // Filter out duplicate entities by name (case-insensitive)
                const uniqueEntities = summary.entities.filter((entity, index, self) => 
                  index === self.findIndex(e => e.name.toLowerCase() === entity.name.toLowerCase())
                );
                
                return (
                  <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#404040]">
                    <p className="text-xs text-[#707070] mb-2">
                      Entities mentioned ({uniqueEntities.length}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueEntities.map((entity, idx) => {
                        const node = entityNodeMap.get(entity.name.toLowerCase());
                        const nodeType = node?.node_type || node?.type || 'Entity';
                        const color = getNodeTypeColor(nodeType);
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => node && onEntityClick && onEntityClick(node)}
                            className="px-2 py-1 text-xs rounded-full text-white hover:opacity-80 
                                       transition-opacity cursor-pointer"
                            style={{ backgroundColor: color }}
                          >
                            {entity.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Stats Footer */}
              <div className="flex items-center justify-between text-xs text-[#707070] pt-2 border-t border-[#404040]">
                <span>
                  Based on {summary.node_count} nodes, {summary.link_count} relationships
                </span>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1 hover:text-[#B4B4B4] transition-colors"
                >
                  <FaRedo size={10} />
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !summary && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#707070]">
              <FaSearch size={32} className="opacity-30" />
              <p className="text-sm text-center text-[#B4B4B4]">
                Enter a question above to get an AI-powered<br />
                analysis of your graph data
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISummaryModal;


