import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getNodeTypeColor } from '../../utils/colorUtils';

const MapHierarchyVisualization = ({ graphData = { nodes: [], links: [] }, position = { x: 0, y: 0 } }) => {
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
    const verticalSpacing = 60;
    const horizontalSpacing = 40;
    const baseNodeHeight = 22;
    const paddingX = 4;
    const borderRadius = 5;

    // Create main group
    const groupOffsetX = 20;
    const groupOffsetY = 20;
    const g = svg.append('g')
      .attr('transform', `translate(${groupOffsetX}, ${groupOffsetY})`);

    // Helper function to get node colors based on node type
    const getNodeColors = (nodeType) => {
      const color = getNodeTypeColor(nodeType || 'Entity');
      // Convert hex to RGB and create darker background
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      return {
        bg: `rgb(${Math.round(r * 0.2)}, ${Math.round(g * 0.2)}, ${Math.round(b * 0.2)})`,
        border: color,
        text: '#FFFFFF',
        accent: color
      };
    };

    // Helper function to measure text width
    const measureText = (text, fontSize, fontWeight) => {
      const tempText = svg.append('text')
        .attr('font-size', fontSize)
        .attr('font-weight', fontWeight)
        .attr('font-family', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .text(text);
      const bbox = tempText.node().getBBox();
      tempText.remove();
      return bbox.width;
    };

    // Calculate node widths based on text content
    const calculateNodeWidth = (text, minWidth = 60) => {
      const fontSize = '13px';
      const fontWeight = '400';
      const textWidth = measureText(text, fontSize, fontWeight);
      const accentBarWidth = 4;
      const accentBarMargin = 6;
      return Math.max(minWidth, textWidth + (paddingX * 2) + accentBarWidth + accentBarMargin + 10);
    };

    // Build hierarchy from graph data
    // Find country node (root) or use node with most connections as root
    const countryNode = graphData.nodes.find(n => 
      (n.node_type === 'Country' || n.type === 'Country') && 
      (n.country_name || n.name)
    );

    // If no country node, find the node with most connections
    let rootNode = countryNode;
    if (!rootNode) {
      const nodeConnections = new Map();
      graphData.nodes.forEach(node => {
        const connections = (graphData.links || []).filter(link => {
          const sourceId = link.sourceId || link.source || link.from_gid;
          const targetId = link.targetId || link.target || link.to_gid;
          return sourceId === node.id || targetId === node.id;
        }).length;
        nodeConnections.set(node.id, connections);
      });
      
      const maxConnections = Math.max(...Array.from(nodeConnections.values()));
      rootNode = graphData.nodes.find(n => nodeConnections.get(n.id) === maxConnections) || graphData.nodes[0];
    }

    if (!rootNode) {
      console.warn('📊 [MapHierarchyVisualization] No root node found');
      return;
    }

    // Build a tree structure from the graph
    const nodeMap = new Map();
    graphData.nodes.forEach(node => {
      nodeMap.set(node.id, { 
        ...node, 
        children: [], 
        level: 0, 
        x: 0, 
        y: 0, 
        width: 0, 
        height: baseNodeHeight,
        _visited: false
      });
    });

    // Process links to build parent-child relationships
    const processedLinks = (graphData.links || []).map(link => {
      const sourceId = link.sourceId || link.source || link.from_gid;
      const targetId = link.targetId || link.target || link.to_gid;
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);
      return { source: sourceNode, target: targetNode, link };
    }).filter(l => l.source && l.target);

    // Build tree structure starting from root
    const root = nodeMap.get(rootNode.id);
    if (!root) return;

    // Assign levels and build tree (BFS approach)
    const assignLevels = (startNode, visited = new Set()) => {
      const queue = [{ node: startNode, level: 0 }];
      visited.add(startNode.id);
      startNode.level = 0;

      while (queue.length > 0) {
        const { node, level } = queue.shift();
        node.level = level;

        // Find children (nodes connected FROM this node)
        const outgoingLinks = processedLinks.filter(l => l.source.id === node.id);
        const children = outgoingLinks
          .map(l => l.target)
          .filter(child => !visited.has(child.id));

        node.children = children;
        children.forEach(child => {
          visited.add(child.id);
          queue.push({ node: child, level: level + 1 });
        });
      }
    };

    assignLevels(root, new Set());

    // Calculate positions using hierarchical layout (improved)
    const calculatePositions = (node, startX = 0, startY = 0) => {
      node.x = startX;
      node.y = startY;
      
      const nodeName = node.name || node.id || 'Node';
      node.width = calculateNodeWidth(nodeName);
      
      if (node.children.length === 0) {
        return node.width;
      }

      // Calculate positions for children
      let currentX = startX;
      let totalWidth = 0;
      const childWidths = [];

      node.children.forEach((child) => {
        const childWidth = calculatePositions(child, currentX, startY + verticalSpacing);
        childWidths.push(childWidth);
        currentX += childWidth + horizontalSpacing;
        totalWidth += childWidth + horizontalSpacing;
      });

      // Center parent above children
      const childrenWidth = totalWidth - horizontalSpacing;
      if (childrenWidth > node.width) {
        node.x = startX;
        // Adjust children to be centered under parent
        const offset = (childrenWidth - node.width) / 2;
        node.children.forEach((child, index) => {
          child.x = startX + offset + childWidths.slice(0, index).reduce((sum, w) => sum + w + horizontalSpacing, 0);
        });
        return childrenWidth;
      } else {
        // Center children under parent
        const offset = (node.width - childrenWidth) / 2;
        node.children.forEach((child, index) => {
          child.x = startX + offset + childWidths.slice(0, index).reduce((sum, w) => sum + w + horizontalSpacing, 0);
        });
        return node.width;
      }
    };

    calculatePositions(root, 0, 0);

    // Collect all nodes in order
    const allNodes = [];
    const collectNodes = (node) => {
      allNodes.push(node);
      node.children.forEach(collectNodes);
    };
    collectNodes(root);

    // Draw links (only parent-child relationships in the tree)
    const linkGroup = g.append('g').attr('class', 'links');
    const drawTreeLinks = (node) => {
      node.children.forEach(child => {
        const sourceX = node.x + node.width / 2;
        const sourceY = node.y + node.height;
        const targetX = child.x + child.width / 2;
        const targetY = child.y;

        linkGroup.append('path')
          .attr('class', 'link')
          .attr('d', `M ${sourceX},${sourceY} L ${targetX},${targetY}`)
          .attr('fill', 'none')
          .attr('stroke', '#DBDBDB')
          .attr('stroke-width', 1);
        
        // Recursively draw links for children
        drawTreeLinks(child);
      });
    };
    drawTreeLinks(root);

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    allNodes.forEach((nodeData) => {
      const node = nodeGroup.append('g')
        .attr('class', `node ${nodeData.id}`)
        .attr('transform', `translate(${nodeData.x}, ${nodeData.y})`);
      
      const nodeType = nodeData.node_type || nodeData.type || 'Entity';
      const colors = getNodeColors(nodeType);
      const nodeName = nodeData.name || nodeData.id || 'Node';

      // Main background
      node.append('rect')
        .attr('width', nodeData.width)
        .attr('height', nodeData.height)
        .attr('rx', borderRadius)
        .attr('ry', borderRadius)
        .attr('fill', colors.bg)
        .attr('stroke', colors.border)
        .attr('stroke-width', 1);

      // Left accent bar
      const accentBarHeight = 13;
      const accentBarY = (nodeData.height - accentBarHeight) / 2;
      node.append('rect')
        .attr('x', paddingX + 2.5)
        .attr('y', accentBarY)
        .attr('width', 4)
        .attr('height', accentBarHeight)
        .attr('rx', 2)
        .attr('fill', colors.accent);

      // Node text
      node.append('text')
        .attr('x', nodeData.width / 2)
        .attr('y', nodeData.height / 2 + 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.text)
        .attr('font-size', '13px')
        .attr('font-weight', '400')
        .attr('font-family', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .text(nodeName);
    });

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

export default MapHierarchyVisualization;

