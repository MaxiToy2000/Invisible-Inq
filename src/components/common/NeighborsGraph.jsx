import React, { useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { getNodeTypeColor } from '../../utils/colorUtils';
import EmptyState from './EmptyState';

const canonicalId = (n) => String(n?.id ?? n?.gid ?? '');

function deduplicateNodesById(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    const id = canonicalId(node);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Safe deep copy function that handles circular references and functions
// Defined outside component to avoid recreation on every render
const safeDeepCopy = (node) => {
  if (!node) return {};
  
  // Create a new object with only serializable properties
  const copy = {};
  for (const key in node) {
    if (node.hasOwnProperty(key)) {
      const value = node[key];
      // Skip functions, undefined, and D3 internal properties
      if (typeof value === 'function' || value === undefined || key.startsWith('__')) {
        continue;
      }
      // Handle objects and arrays recursively (but avoid deep nesting)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // For complex objects, just skip them to avoid circular references
        continue;
      }
      // Copy primitive values and arrays
      copy[key] = value;
    }
  }
  return copy;
};

const NeighborsGraph = ({ selectedNode, graphData, onClose, isSubgraph = false }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomRef = useRef(null);

  // Extract neighbors and links for the selected node, or use subgraph directly
  const neighborData = useMemo(() => {
    // If displaying a subgraph, use all nodes and links directly
    if (isSubgraph && graphData && graphData.nodes && graphData.links) {
      // Count node types
      const nodeTypeCounts = {};
      graphData.nodes.forEach(node => {
        const nodeType = node.node_type || node.type || 'Unknown';
        nodeTypeCounts[nodeType] = (nodeTypeCounts[nodeType] || 0) + 1;
      });

      // Deduplicate so the same node (same id/gid) never appears twice, then deep copy
      const copiedNodes = deduplicateNodesById(graphData.nodes).map(node => safeDeepCopy(node));

      // Process links to ensure source/target are node objects from our copies
      const processedLinks = graphData.links.map(link => {
        const sourceId = link.sourceId || link.source?.id || link.source;
        const targetId = link.targetId || link.target?.id || link.target;
        
        const source = copiedNodes.find(n => String(n.id || n.gid) === String(sourceId));
        const target = copiedNodes.find(n => String(n.id || n.gid) === String(targetId));
        
        return {
          ...link,
          source: source || link.source,
          target: target || link.target,
          sourceId: source?.id || source?.gid || sourceId,
          targetId: target?.id || target?.gid || targetId
        };
      }).filter(link => link.source && link.target);

      return {
        nodes: copiedNodes,
        links: processedLinks,
        nodeTypeCounts,
        neighborCount: copiedNodes.length
      };
    }

    // Original logic for single node neighbors
    if (!selectedNode || !graphData || !graphData.nodes || !graphData.links) {
      return { nodes: [], links: [], nodeTypeCounts: {} };
    }

    const nodeId = selectedNode.id || selectedNode.gid;
    if (!nodeId) return { nodes: [], links: [], nodeTypeCounts: {} };

    // Find all links connected to the selected node
    const connectedLinks = graphData.links.filter(link => {
      const sourceId = link.sourceId || link.source?.id || link.source;
      const targetId = link.targetId || link.target?.id || link.target;
      return String(sourceId) === String(nodeId) || String(targetId) === String(nodeId);
    });

    // Get all neighbor node IDs
    const neighborIds = new Set();
    connectedLinks.forEach(link => {
      const sourceId = link.sourceId || link.source?.id || link.source;
      const targetId = link.targetId || link.target?.id || link.target;
      if (String(sourceId) === String(nodeId)) {
        neighborIds.add(String(targetId));
      } else {
        neighborIds.add(String(sourceId));
      }
    });

    // Get neighbor nodes (dedupe so same id never appears twice)
    const neighborNodes = deduplicateNodesById(
      graphData.nodes.filter(node => neighborIds.has(String(node.id || node.gid)))
    );

    // Count node types
    const nodeTypeCounts = {};
    neighborNodes.forEach(node => {
      const nodeType = node.node_type || node.type || 'Unknown';
      nodeTypeCounts[nodeType] = (nodeTypeCounts[nodeType] || 0) + 1;
    });

    // CRITICAL: Create DEEP copies of nodes to prevent D3 simulation from modifying
    // the original node positions in the main THREE.js graph
    const copiedSelectedNode = safeDeepCopy(selectedNode);
    const copiedNeighborNodes = neighborNodes.map(node => safeDeepCopy(node));
    const allCopiedNodes = deduplicateNodesById([copiedSelectedNode, ...copiedNeighborNodes]);

    // Create links for the neighbor graph (only between selected node and neighbors)
    const neighborLinks = connectedLinks.map(link => {
      const sourceId = link.sourceId || link.source?.id || link.source;
      const targetId = link.targetId || link.target?.id || link.target;
      
      // Determine which is the selected node and which is the neighbor
      // Use our copied nodes instead of original references
      let source, target;
      if (String(sourceId) === String(nodeId)) {
        source = copiedSelectedNode;
        target = copiedNeighborNodes.find(n => String(n.id || n.gid) === String(targetId));
      } else {
        source = copiedNeighborNodes.find(n => String(n.id || n.gid) === String(sourceId));
        target = copiedSelectedNode;
      }

      return {
        ...link,
        source,
        target,
        sourceId: source?.id || source?.gid,
        targetId: target?.id || target?.gid
      };
    }).filter(link => link.source && link.target);

    return {
      nodes: allCopiedNodes,
      links: neighborLinks,
      nodeTypeCounts,
      neighborCount: neighborNodes.length
    };
  }, [selectedNode, graphData, isSubgraph]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || neighborData.nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('cursor', 'grab');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3]) // Min zoom 0.5x, max zoom 3x
      .on('zoom', (event) => {
        g.attr('transform', `translate(${margin.left + event.transform.x},${margin.top + event.transform.y}) scale(${event.transform.k})`);
      })
      .on('start', () => {
        svg.style('cursor', 'grabbing');
      })
      .on('end', () => {
        svg.style('cursor', 'grab');
      });

    // Apply zoom behavior to SVG
    svg.call(zoom);
    zoomRef.current = zoom;

    // Double-click to reset zoom
    svg.on('dblclick.zoom', () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));
    });

    const simulationWidth = width - margin.left - margin.right;
    const simulationHeight = height - margin.top - margin.bottom;

    // Function to zoom to fit all nodes
    const zoomToFit = () => {
      if (neighborData.nodes.length === 0) return;

      // Calculate bounding box of all nodes
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      neighborData.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          const isSelected = selectedNode && (node.id === selectedNode.id || node.gid === selectedNode.gid);
          const radius = isSelected ? 20 : 15;
          minX = Math.min(minX, node.x - radius);
          maxX = Math.max(maxX, node.x + radius);
          minY = Math.min(minY, node.y - radius);
          maxY = Math.max(maxY, node.y + radius);
        }
      });

      // Add padding
      const padding = 40;
      minX -= padding;
      maxX += padding;
      minY -= padding;
      maxY += padding;

      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;

      if (graphWidth === 0 || graphHeight === 0) return;

      // Calculate scale to fit
      const scaleX = simulationWidth / graphWidth;
      const scaleY = simulationHeight / graphHeight;
      const scale = Math.min(scaleX, scaleY, 3); // Don't zoom in more than 3x

      // Calculate center of graph
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Calculate translation to center the graph
      const translateX = simulationWidth / 2 - centerX * scale;
      const translateY = simulationHeight / 2 - centerY * scale;

      // Apply zoom transform with animation
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
    };

    // Clear any existing D3 simulation properties from copied nodes to ensure fresh start
    neighborData.nodes.forEach(node => {
      delete node.vx;
      delete node.vy;
      delete node.vz;
      delete node.fx;
      delete node.fy;
      delete node.fz;
      delete node.index;
    });

    // Create force simulation
    const simulation = d3.forceSimulation(neighborData.nodes)
      .force('link', d3.forceLink(neighborData.links)
        .id(d => d.id || d.gid)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(simulationWidth / 2, simulationHeight / 2))
      .force('collision', d3.forceCollide().radius(35));

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(neighborData.links)
      .enter()
      .append('line')
      .attr('stroke', '#9BAFBD')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .attr('marker-end', 'url(#arrowhead)');

    // Create arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#9BAFBD');

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(neighborData.nodes)
      .enter()
      .append('g')
      .attr('class', d => {
        const isSelected = selectedNode && (d.id === selectedNode.id || d.gid === selectedNode.gid);
        return isSelected ? 'node selected' : 'node';
      })
      .style('cursor', 'pointer');

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => {
        const isSelected = selectedNode && (d.id === selectedNode.id || d.gid === selectedNode.gid);
        return isSelected ? 20 : 15;
      })
      .attr('fill', d => {
        const nodeType = d.node_type || d.type || 'Unknown';
        // Use centralized color mapping from colorUtils
        return getNodeTypeColor(nodeType);
      })
      .attr('stroke', d => {
        const isSelected = selectedNode && (d.id === selectedNode.id || d.gid === selectedNode.gid);
        return isSelected ? '#ffffff' : 'transparent';
      })
      .attr('stroke-width', d => {
        const isSelected = selectedNode && (d.id === selectedNode.id || d.gid === selectedNode.gid);
        return isSelected ? 3 : 0;
      });

    // Add labels
    node.append('text')
      .text(d => {
        const name = d.name || d.entity_name || d.action_summary || d.process_result || 
                    d.process_summary || d.title || d.id || d.gid || 'Node';
        return name.length > 20 ? name.substring(0, 20) + '...' : name;
      })
      .attr('dy', d => {
        const isSelected = selectedNode && (d.id === selectedNode.id || d.gid === selectedNode.gid);
        return isSelected ? 35 : 30;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '11px')
      .attr('font-family', 'Archivo, system-ui, "Segoe UI", sans-serif')
      .attr('font-weight', '400')
      .attr('pointer-events', 'none');

    // Add link labels (text elements) - only show if link has a label
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(neighborData.links.filter(d => {
        const label = d.label || d.type || d.relationship_name || d.relationship_type || '';
        return label.trim() !== '';
      }))
      .enter()
      .append('text')
      .attr('class', 'link-label')
      .attr('text-anchor', 'middle')
      .attr('fill', '#9BAFBD')
      .attr('font-size', '10px')
      .attr('font-family', 'Archivo, system-ui, "Segoe UI", sans-serif')
      .attr('font-weight', '400')
      .attr('pointer-events', 'none')
      .text(d => {
        const label = d.label || d.type || d.relationship_name || d.relationship_type || '';
        return label.length > 20 ? label.substring(0, 20) + '...' : label;
      });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);

      // Update link label positions (midpoint of the link)
      if (linkLabels) {
        linkLabels
          .attr('x', d => (d.source.x + d.target.x) / 2)
          .attr('y', d => (d.source.y + d.target.y) / 2);
      }
    });

    // Zoom to fit when simulation ends (especially important for subgraphs)
    simulation.on('end', () => {
      setTimeout(() => {
        zoomToFit();
      }, 100);
    });

    // Also zoom to fit after a delay as fallback (in case 'end' event doesn't fire)
    const zoomTimeout = setTimeout(() => {
      if (simulation.alpha() < 0.1) {
        zoomToFit();
      }
    }, 2000);

    // Cleanup
    return () => {
      simulation.stop();
      clearTimeout(zoomTimeout);
    };
  }, [neighborData, selectedNode, isSubgraph]);

  // Check if we should show empty state
  const shouldShowEmpty = isSubgraph 
    ? neighborData.nodes.length === 0
    : (!selectedNode || neighborData.neighborCount === 0);

  if (shouldShowEmpty) {
    return (
      <EmptyState
        title={isSubgraph ? "No nodes selected" : "No neighbors found"}
        description={isSubgraph ? "Select nodes to view their connections." : "Select a different node to explore its connections."}
      />
    );
  }

  return (
    <div ref={containerRef} className="w-full h-[320px] relative bg-[#09090B] border border-[#707070] border-b border-b-[#707070] rounded-[5px]">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-[#24282F] border border-[#707070] flex items-center justify-center text-white hover:bg-[#2A2A2A] transition-colors"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Legend */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-3">
        {Object.entries(neighborData.nodeTypeCounts).map(([nodeType, count]) => {
          // Use centralized color mapping from colorUtils
          const color = getNodeTypeColor(nodeType);
          
          return (
            <div key={nodeType} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-[#B4B4B4] font-normal">
                {nodeType}({count})
              </span>
            </div>
          );
        })}
      </div>

      {/* SVG Graph */}
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default NeighborsGraph;

