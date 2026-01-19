import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getNodeTypeColor } from '../../utils/colorUtils';

const MapGraphVisualization = ({ graphData = { nodes: [], links: [] }, position = { x: 0, y: 0 } }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (!svgRef.current || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    // Process links to ensure source and target are node objects
    const processedLinks = (graphData.links || []).map(link => {
      // Try multiple ways to find source and target nodes
      const sourceNode = graphData.nodes.find(n => 
        n.id === link.sourceId || 
        n.id === link.source || 
        n.gid === link.from_gid ||
        (typeof link.source === 'string' && n.id === link.source) ||
        (typeof link.source === 'object' && link.source.id && n.id === link.source.id)
      );
      
      const targetNode = graphData.nodes.find(n => 
        n.id === link.targetId || 
        n.id === link.target || 
        n.gid === link.to_gid ||
        (typeof link.target === 'string' && n.id === link.target) ||
        (typeof link.target === 'object' && link.target.id && n.id === link.target.id)
      );
      
      if (!sourceNode) {
        console.warn('📊 [MapGraphVisualization] Source node not found for link:', {
          link: link,
          sourceId: link.sourceId,
          source: link.source,
          from_gid: link.from_gid
        });
      }
      
      if (!targetNode) {
        console.warn('📊 [MapGraphVisualization] Target node not found for link:', {
          link: link,
          targetId: link.targetId,
          target: link.target,
          to_gid: link.to_gid
        });
      }
      
      return {
        ...link,
        source: sourceNode || link.source,
        target: targetNode || link.target
      };
    }).filter(link => {
      const hasValidSource = link.source && (typeof link.source === 'object' || typeof link.source === 'string');
      const hasValidTarget = link.target && (typeof link.target === 'object' || typeof link.target === 'string');
      return hasValidSource && hasValidTarget;
    });

    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(processedLinks).id(d => {
        const nodeId = d.id || d.gid || String(d);
        return nodeId;
      }).distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create links
    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(processedLinks)
      .enter()
      .append('line')
      .attr('stroke', '#DBDBDB')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.6);

    // Create nodes
    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles for nodes
    node.append('circle')
      .attr('r', 8)
      .attr('fill', d => {
        const nodeType = d.node_type || d.type || 'Entity';
        return getNodeTypeColor(nodeType);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Add labels for nodes
    node.append('text')
      .text(d => d.name || d.id)
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('font-size', '12px')
      .attr('fill', '#FFFFFF')
      .attr('font-family', 'system-ui, sans-serif');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => {
          const source = typeof d.source === 'object' && d.source !== null ? d.source : 
                        (typeof d.source === 'string' ? graphData.nodes.find(n => n.id === d.source) : null);
          return source && source.x !== undefined ? source.x : 0;
        })
        .attr('y1', d => {
          const source = typeof d.source === 'object' && d.source !== null ? d.source : 
                        (typeof d.source === 'string' ? graphData.nodes.find(n => n.id === d.source) : null);
          return source && source.y !== undefined ? source.y : 0;
        })
        .attr('x2', d => {
          const target = typeof d.target === 'object' && d.target !== null ? d.target : 
                        (typeof d.target === 'string' ? graphData.nodes.find(n => n.id === d.target) : null);
          return target && target.x !== undefined ? target.x : 0;
        })
        .attr('y2', d => {
          const target = typeof d.target === 'object' && d.target !== null ? d.target : 
                        (typeof d.target === 'string' ? graphData.nodes.find(n => n.id === d.target) : null);
          return target && target.y !== undefined ? target.y : 0;
        });

      node.attr('transform', d => {
        const x = d.x !== undefined && d.x !== null ? d.x : 0;
        const y = d.y !== undefined && d.y !== null ? d.y : 0;
        return `translate(${x},${y})`;
      });
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      if (simulation) {
        simulation.stop();
      }
    };
  }, [graphData, dimensions]);

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute pointer-events-auto bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        zIndex: 1000
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      />
    </div>
  );
};

export default MapGraphVisualization;

