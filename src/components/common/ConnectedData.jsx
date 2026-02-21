import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import StringConstants from '../StringConstants';

// Mockup data matching the exact relationships from the image
// Structure: 7 entities in SRC (left), 4 entities in TRG (right), 3 funding entities, 4 actions
const mockupData = {
  actions: [
    // Middle section: 2 Entity Name (SRC) → Action Name Specific Text → 1 Entity (TRG)
    { src_en: 'Entity Name', trg_en: 'Entity', act_typ: 'Action Name Specific Text' },
    { src_en: 'Entity Name', trg_en: 'Entity', act_typ: 'Action Name Specific Text' },
    // Bottom section: 4 sources (1 Entity + 3 Entity Name) → 4 actions → 1 Entity Name (TRG)
    { src_en: 'Entity', trg_en: 'Entity Name', act_typ: 'Action Type' },
    { src_en: 'Entity Name', trg_en: 'Entity Name', act_typ: 'Action Type' },
    { src_en: 'Entity Name', trg_en: 'Entity Name', act_typ: 'Action Type' },
    { src_en: 'Entity Name', trg_en: 'Entity Name', act_typ: 'Action Name Specifi...' }
  ],
  funding: [
    // Top section: 1 Entity (SRC) → $1,000,000 → splits to 2 Entities (TRG)
    { distributor: 'Entity', recipient: 'Entity', amount: '$1,000,000' },
    { distributor: 'Entity', recipient: 'Entity', amount: '$1,000,000' },
    // Top section: 1 Entity (SRC) → $1,000 → $1,000 → 1 Entity (TRG)
    // Note: The chain is represented as Entity → $1,000 → Entity
    { distributor: 'Entity', recipient: 'Entity', amount: '$1,000' }
  ]
};

// Constants from Entity.tsx
const fixedNodeWidth = 120;
const fixedNodeHeight = 24;
const padding = 8;
const lineHeight = 24;
const minNodeWidth = 80; // Minimum width for nodes
const maxNodeWidth = 200; // Maximum width for nodes

// Function to calculate text width
const calculateTextWidth = (text, fontSize = 16, fontFamily = 'Archivo') => {
  // Create a temporary canvas element to measure text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = `${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(text);
  return metrics.width;
};

// Function to truncate entity text to 13 characters
const truncateEntityText = (text) => {
  if (!text || typeof text !== 'string') return text;
  if (text.length <= 13) return text;
  return text.substring(0, 13) + '...';
};

const ConnectedData = ({
  onSectionClick,
  graphData = { nodes: [], links: [] },
  currentSubstory = null,
  filteredGraphData = null,
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [svgWidth, setSvgWidth] = useState(383);
  const [svgHeight, setSvgHeight] = useState(400);
  const [viewBox, setViewBox] = useState('0 0 500 400');

  // Use current section's graphData from useGraphData (single source; no duplicate fetch)
  const apiGraphData = graphData?.nodes?.length > 0 ? graphData : null;

  // Transform API graph data into source-middle-target relationships
  const transformGraphDataToRelationships = (data) => {
    if (!data || !data.nodes || !data.links) {
      return [];
    }

    const relationships = [];
    const nodeMap = new Map();

    const normalizeType = (raw) => {
      if (!raw) return '';
      return String(raw)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    };

    const getNodeId = (node) => node?.id ?? node?.gid;

    const getNodeType = (node) =>
      normalizeType(
        node?.node_type ??
          node?.type ??
          node?.category ??
          (Array.isArray(node?.labels) ? node.labels[0] : undefined)
      );

    const isEntity = (node) => {
      const t = getNodeType(node);
      // "entity" is the common case; include other common "actor" node types as entities for display.
      return (
        t === 'entity' ||
        t === 'entity_gen' ||
        t === 'organization' ||
        t === 'person' ||
        t === 'recipient' ||
        t === 'agency' ||
        t === 'department' ||
        t === 'foundation' ||
        t === 'committee' ||
        t === 'council' ||
        t === 'institution' ||
        t === 'university' ||
        t === 'country' ||
        t === 'location' ||
        t === 'place_of_performance' ||
        t === 'region' ||
        t === 'usaid_program_region'
      );
    };

    const isFundingMiddle = (node) => {
      const t = getNodeType(node);
      // Older data sometimes models money as "amount"; keep it as funding middle for the UI.
      return t === 'funding' || t === 'amount' || t === 'disb_or_trans' || t === 'transaction';
    };

    const isActionMiddle = (node) => {
      const t = getNodeType(node);
      return t === 'action';
    };

    const getDisplayName = (node, fallback = 'Entity') => {
      return (
        node?.entity_name ||
        node?.name ||
        node?.label ||
        node?.title ||
        node?.country_name ||
        node?.['Country Name'] ||
        fallback
      );
    };

    const getMiddleLabel = (node, fallback = 'Unknown') => {
      return (
        node?.amount ||
        node?.value ||
        node?.action_text ||
        node?.act_typ ||
        node?.name ||
        node?.label ||
        node?.title ||
        fallback
      );
    };
    
    // Create a map of nodes by ID
    data.nodes.forEach(node => {
      const nodeId = getNodeId(node);
      if (nodeId) {
        nodeMap.set(nodeId, node);
      }
    });

    // Process links to create relationships
    // Look for patterns: Entity -> (Funding/Amount/Action) -> Entity
    data.links.forEach(link => {
      const sourceId = link.sourceId || link.source;
      const targetId = link.targetId || link.target;
      
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);

      if (!sourceNode || !targetNode) return;

      const sourceIsEntity = isEntity(sourceNode);
      const targetIsEntity = isEntity(targetNode);
      const sourceIsMiddle = isFundingMiddle(sourceNode) || isActionMiddle(sourceNode);
      const targetIsMiddle = isFundingMiddle(targetNode) || isActionMiddle(targetNode);

      // Pattern 1: Entity -> Amount/Action (middle node)
      if (sourceIsEntity && targetIsMiddle) {
        // Find target Entity connected to this middle node
        const middleToTargetLinks = data.links.filter(l => {
          const linkSourceId = l.sourceId || l.source;
          return linkSourceId === targetId;
        });

        middleToTargetLinks.forEach(middleLink => {
          const finalTargetId = middleLink.targetId || middleLink.target;
          const finalTargetNode = nodeMap.get(finalTargetId);
          
          if (finalTargetNode && isEntity(finalTargetNode)) {
            const middleLabel = getMiddleLabel(targetNode);
            const relationshipType = isFundingMiddle(targetNode) ? 'funding' : 'action';
            
            relationships.push({
              source: getDisplayName(sourceNode),
              middle: middleLabel,
              target: getDisplayName(finalTargetNode),
              type: relationshipType
            });
          }
        });
      } 
      // Pattern 2: Amount/Action (middle) -> Entity
      else if (sourceIsMiddle && targetIsEntity) {
        // Find source Entity connected to this middle node
        const sourceToMiddleLinks = data.links.filter(l => {
          const linkTargetId = l.targetId || l.target;
          return linkTargetId === sourceId;
        });

        sourceToMiddleLinks.forEach(sourceLink => {
          const sourceEntityId = sourceLink.sourceId || sourceLink.source;
          const sourceEntityNode = nodeMap.get(sourceEntityId);
          
          if (sourceEntityNode && isEntity(sourceEntityNode)) {
            const middleLabel = getMiddleLabel(sourceNode);
            const relationshipType = isFundingMiddle(sourceNode) ? 'funding' : 'action';
            
            relationships.push({
              source: getDisplayName(sourceEntityNode),
              middle: middleLabel,
              target: getDisplayName(targetNode),
              type: relationshipType
            });
          }
        });
      }
    });

    return relationships;
  };

  useEffect(() => {
    if (!svgRef.current) return;

    // Use API data if available, otherwise use props, otherwise use mockup
    const dataToUse = apiGraphData || filteredGraphData || graphData;
    let relationships = [];

    // Transform API/prop data if available
    if (dataToUse && dataToUse.nodes && dataToUse.nodes.length > 0) {
      relationships = transformGraphDataToRelationships(dataToUse);
    }

    // Fallback to mockup data if no relationships found and no section selected
    if (relationships.length === 0 && (!currentSubstory || !currentSubstory.section_query)) {
      // Process mockup data
      // Process funding items
      mockupData.funding.forEach((item) => {
        if (item?.distributor && item?.recipient && item?.amount) {
          relationships.push({
            source: item.distributor.trim(),
            middle: item.amount,
            target: item.recipient.trim(),
            type: 'funding'
          });
        }
      });

      // Process action items
      mockupData.actions.forEach((item) => {
        if (item?.src_en && item?.trg_en && item?.act_typ) {
          relationships.push({
            source: item.src_en.trim(),
            middle: item.act_typ.trim(),
            target: item.trg_en.trim(),
            type: 'action'
          });
        }
      });
    }

    // Separate funding and action relationships (funding first)
    const fundingRelationships = relationships.filter((rel) => rel.type === 'funding');
    const actionRelationships = relationships.filter((rel) => rel.type === 'action');
    const orderedRelationships = [...fundingRelationships, ...actionRelationships];

    // Count interconnections for each node to determine spacing
    const nodeConnectionCounts = new Map();
    relationships.forEach(rel => {
      // Count connections for source nodes
      const sourceKey = rel.source;
      nodeConnectionCounts.set(sourceKey, (nodeConnectionCounts.get(sourceKey) || 0) + 1);
      
      // Count connections for target nodes
      const targetKey = rel.target;
      nodeConnectionCounts.set(targetKey, (nodeConnectionCounts.get(targetKey) || 0) + 1);
    });
    
    // Determine if we have many interconnections (threshold: 3+ connections)
    const hasManyInterconnections = Array.from(nodeConnectionCounts.values()).some(count => count >= 3);

    // Track node metadata per section
    // For targets, we need to handle splits - same label but different positions
    const sourceMeta = new Map();
    const targetMeta = new Map();
    const middleMeta = new Map();
    // Track target nodes with their relationship context to handle splits
    const targetNodesByRelationship = new Map();

    const sourceCounters = { funding: 0, action: 0 };
    const targetCounters = { funding: 0, action: 0 };
    const middleCounters = { funding: 0, action: 0 };

    // First pass: identify unique sources and middles
    // Use source label + section as key to ensure same entities share the same position
    orderedRelationships.forEach((rel, relIndex) => {
      const section = rel.type === 'funding' ? 'funding' : 'action';
      
      // Create source key based on label and section only
      // This ensures all relationships from the same source entity use the same visual node
      const sourceKey = `${rel.source}-${section}`;
      
      // Only create new source node if this key hasn't appeared yet
      if (!sourceMeta.has(sourceKey)) {
        sourceMeta.set(sourceKey, { 
          section, 
          index: sourceCounters[section], 
          originalName: rel.source
        });
        sourceCounters[section] += 1;
      }

      if (!middleMeta.has(rel.middle)) {
        middleMeta.set(rel.middle, {
          section,
          index: middleCounters[section],
          nodeType: rel.type === 'funding' ? 'monetary' : 'action'
        });
        middleCounters[section] += 1;
      }
    });

    // Second pass: handle targets
    // Use target label + section as key to ensure same entities share the same position
    orderedRelationships.forEach((rel, relIndex) => {
      const section = rel.type === 'funding' ? 'funding' : 'action';
      
      // Create target key based on label and section only
      // This ensures all relationships to the same target entity use the same visual node
      const targetKey = `${rel.target}-${section}`;
      
      if (!targetNodesByRelationship.has(targetKey)) {
        targetNodesByRelationship.set(targetKey, {
          label: rel.target,
          section,
          index: targetCounters[section],
          relationshipIndex: relIndex
        });
        
        // Also update targetMeta for positioning
        targetMeta.set(targetKey, { 
          section, 
          index: targetCounters[section],
          originalName: rel.target
        });
        targetCounters[section] += 1;
      }
    });

    const nodes = [];
    const nodeMap = new Map();

    const leftX = 0;
    const columnGap = 50; // Gap between columns
    const nodeGap = 8;
    const targetNodeGap = 24; // Larger gap for target nodes (right column)
    const sectionGap = 36;
    const startY = 20;
    
    // Increase spacing for nodes with many interconnections
    const adjustedTargetNodeGap = hasManyInterconnections ? targetNodeGap * 1.5 : targetNodeGap; // 1.5x spacing for right column
    const adjustedActionNodeGap = hasManyInterconnections ? nodeGap * 1.5 : nodeGap; // For action section (lower) nodes
    
    // Middle and right X positions will be calculated after nodes are created
    let middleX = 210;
    let rightX = 380;

    // Calculate base Y positions for each section
    const getBaseY = (section) => {
      const fundingSourceNodes = Array.from(sourceMeta.entries())
        .filter(([_, meta]) => meta.section === 'funding')
        .map(([key, meta]) => ({ key, index: meta.index }))
        .sort((a, b) => a.index - b.index);

      const fundingMiddleNodes = Array.from(middleMeta.entries())
        .filter(([_, meta]) => meta.section === 'funding')
        .map(([key, meta]) => ({ key, index: meta.index }))
        .sort((a, b) => a.index - b.index);

      const fundingTargetNodes = Array.from(targetMeta.entries())
        .filter(([_, meta]) => meta.section === 'funding')
        .map(([key, meta]) => ({ key, index: meta.index }))
        .sort((a, b) => a.index - b.index);

      let fundingHeight = 0;
      if (fundingSourceNodes.length > 0 || fundingMiddleNodes.length > 0 || fundingTargetNodes.length > 0) {
        const maxRows = Math.max(fundingSourceNodes.length, fundingMiddleNodes.length, fundingTargetNodes.length);
        let maxColumnHeight = 0;

        [fundingSourceNodes, fundingMiddleNodes, fundingTargetNodes].forEach(columnNodes => {
          let columnY = startY;
          columnNodes.forEach(() => {
            columnY += fixedNodeHeight + nodeGap;
          });
          if (columnNodes.length > 0) {
            columnY -= nodeGap;
          }
          maxColumnHeight = Math.max(maxColumnHeight, columnY - startY);
        });

        fundingHeight = maxColumnHeight;
      }

      return section === 'funding' ? startY : startY + fundingHeight + sectionGap;
    };

    // Calculate node positions
    const calculateNodePositions = (metaMap, section, gap = nodeGap) => {
      const positions = new Map();
      const sectionNodes = [];

      metaMap.forEach((meta, key) => {
        if (meta.section === section) {
          sectionNodes.push({ key, index: meta.index });
        }
      });

      sectionNodes.sort((a, b) => a.index - b.index);

      let currentY = getBaseY(section);
      sectionNodes.forEach(({ key }) => {
        positions.set(key, currentY);
        currentY += fixedNodeHeight + gap;
      });

      return positions;
    };

    const sourcePositionsFunding = calculateNodePositions(sourceMeta, 'funding');
    const sourcePositionsAction = calculateNodePositions(sourceMeta, 'action', adjustedActionNodeGap); // Use adjusted gap for action section
    const middlePositionsFunding = calculateNodePositions(middleMeta, 'funding');
    const middlePositionsAction = calculateNodePositions(middleMeta, 'action');
    // Use larger gap for target nodes (right column) - increase if many interconnections
    const targetPositionsFunding = calculateNodePositions(targetMeta, 'funding', adjustedTargetNodeGap);
    const targetPositionsAction = calculateNodePositions(targetMeta, 'action', adjustedTargetNodeGap);
    
    // Calculate positions for target nodes considering splits
    const targetPositionsByRelationship = new Map();
    const targetGroupsBySourceMiddle = new Map();
    
    // Group targets by source-middle pairs to handle splits
    targetNodesByRelationship.forEach((data, key) => {
      const parts = key.split('-');
      const sourceMiddleKey = `${parts[0]}-${parts[1]}`;
      
      if (!targetGroupsBySourceMiddle.has(sourceMiddleKey)) {
        targetGroupsBySourceMiddle.set(sourceMiddleKey, []);
      }
      targetGroupsBySourceMiddle.get(sourceMiddleKey).push({ key, data });
    });
    
    // Calculate positions for each target node, handling splits
    targetGroupsBySourceMiddle.forEach((nodes, sourceMiddleKey) => {
      const section = nodes[0].data.section;
      
      // Get the base position for the first target with this label
      const basePosition = section === 'funding' 
        ? (targetPositionsFunding.get(nodes[0].data.label) || getBaseY(section))
        : (targetPositionsAction.get(nodes[0].data.label) || getBaseY(section));
      
      // For splits, offset additional nodes vertically
      // If single node, use base position; if multiple, spread them
      if (nodes.length === 1) {
        targetPositionsByRelationship.set(nodes[0].key, basePosition);
      } else {
        // Multiple nodes (split) - spread them around the base position
        // Use larger gap for split nodes in target column - increase if many interconnections
        const baseSplitGap = 100; // Base increased gap for split nodes
        const splitGap = hasManyInterconnections ? baseSplitGap * 1.5 : baseSplitGap; // Increase spacing for many interconnections
        const totalHeight = (nodes.length - 1) * (fixedNodeHeight + splitGap);
        const startOffset = -totalHeight / 2;
        nodes.forEach((nodeData, splitIndex) => {
          const y = basePosition + startOffset + splitIndex * (fixedNodeHeight + splitGap);
          targetPositionsByRelationship.set(nodeData.key, y);
        });
      }
    });

    // Create source nodes (left-aligned)
    sourceMeta.forEach((meta, sourceKey) => {
      const originalLabel = meta.originalName || sourceKey.split('-')[0] || 'Entity';
      const label = truncateEntityText(originalLabel); // Truncate to 13 characters
      const y = meta.section === 'funding'
        ? sourcePositionsFunding.get(sourceKey)
        : sourcePositionsAction.get(sourceKey);
      // Calculate dynamic width based on text content (use truncated label for width calculation)
      const textWidth = calculateTextWidth(label, 16, 'Archivo');
      const dynamicWidth = Math.max(minNodeWidth, Math.min(maxNodeWidth, textWidth + padding * 2));
      const node = {
        id: `source-${sourceKey}`,
        type: 'entity',
        label: label,
        x: leftX, // Left-aligned: x position is the left edge
        y: y,
        width: dynamicWidth,
        height: fixedNodeHeight
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // Calculate max source width for column positioning
    const maxSourceWidth = nodes.filter(n => n.type === 'entity' && n.x === leftX)
      .reduce((max, node) => Math.max(max, node.width), minNodeWidth);

    // Calculate middle column: find max width and center nodes
    const middleNodeWidths = [];
    middleMeta.forEach((meta, middleLabel) => {
      const truncatedLabel = truncateEntityText(middleLabel); // Truncate to 13 characters
      const textWidth = calculateTextWidth(truncatedLabel, 16, 'Archivo');
      const dynamicWidth = Math.max(minNodeWidth, Math.min(maxNodeWidth, textWidth + padding * 2));
      middleNodeWidths.push(dynamicWidth);
    });
    const maxMiddleWidth = middleNodeWidths.length > 0 ? Math.max(...middleNodeWidths) : minNodeWidth;
    middleX = leftX + maxSourceWidth + columnGap; // Column start position
    const middleColumnCenterX = middleX + (maxMiddleWidth / 2); // Center of middle column

    // Create middle nodes (center-aligned within column)
    middleMeta.forEach((meta, middleLabel) => {
      const truncatedLabel = truncateEntityText(middleLabel); // Truncate to 13 characters
      const y = meta.section === 'funding'
        ? middlePositionsFunding.get(middleLabel)
        : middlePositionsAction.get(middleLabel);
      // Calculate dynamic width based on text content (use truncated label for width calculation)
      const textWidth = calculateTextWidth(truncatedLabel, 16, 'Archivo');
      const dynamicWidth = Math.max(minNodeWidth, Math.min(maxNodeWidth, textWidth + padding * 2));
      // Center the node within the column: x = columnCenter - (nodeWidth / 2)
      const nodeX = middleColumnCenterX - (dynamicWidth / 2);
      const node = {
        id: `middle-${middleLabel}`,
        type: meta.nodeType,
        label: truncatedLabel,
        x: nodeX, // Center-aligned: x position centers the node
        y: y,
        width: dynamicWidth,
        height: fixedNodeHeight
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // Calculate right column: find max width and center nodes
    const targetNodeWidths = [];
    targetNodesByRelationship.forEach((data, key) => {
      const originalLabel = data.label || 'Entity';
      const label = truncateEntityText(originalLabel); // Truncate to 13 characters
      const textWidth = calculateTextWidth(label, 16, 'Archivo');
      const dynamicWidth = Math.max(minNodeWidth, Math.min(maxNodeWidth, textWidth + padding * 2));
      targetNodeWidths.push(dynamicWidth);
    });
    const maxTargetWidth = targetNodeWidths.length > 0 ? Math.max(...targetNodeWidths) : minNodeWidth;
    const rightColumnCenterX = middleX + maxMiddleWidth + columnGap + (maxTargetWidth / 2);
    rightX = middleX + maxMiddleWidth + columnGap; // Column start position

    // Create target nodes (center-aligned within column)
    targetNodesByRelationship.forEach((data, key) => {
      const originalLabel = data.label || 'Entity';
      const label = truncateEntityText(originalLabel); // Truncate to 13 characters
      const y = targetPositionsByRelationship.get(key);
      // Calculate dynamic width based on text content (use truncated label for width calculation)
      const textWidth = calculateTextWidth(label, 16, 'Archivo');
      const dynamicWidth = Math.max(minNodeWidth, Math.min(maxNodeWidth, textWidth + padding * 2));
      // Center the node within the column: x = columnCenter - (nodeWidth / 2)
      const nodeX = rightColumnCenterX - (dynamicWidth / 2);
      const node = {
        id: `target-${key}`,
        type: 'entity',
        label: label,
        x: nodeX, // Center-aligned: x position centers the node
        y: y,
        width: dynamicWidth,
        height: fixedNodeHeight
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // Create links
    const links = [];

    orderedRelationships.forEach((rel, relIndex) => {
      const section = rel.type === 'funding' ? 'funding' : 'action';
      
      // Use simplified keys to find nodes
      const sourceKey = `${rel.source}-${section}`;
      const targetKey = `${rel.target}-${section}`;
      
      const sourceNode = nodeMap.get(`source-${sourceKey}`);
      const middleNode = nodeMap.get(`middle-${rel.middle}`);
      const targetNode = nodeMap.get(`target-${targetKey}`);

      if (sourceNode && middleNode && targetNode) {
        // Source -> Middle link (only create once per source-middle pair)
        const existingLink = links.find(l => 
          l.source === sourceNode.id && l.target === middleNode.id
        );
        
        if (!existingLink) {
          links.push({
            source: sourceNode.id,
            target: middleNode.id,
            gradientType: rel.type === 'funding' ? 'blue-green' : 'blue-orange',
            path: ''
          });
        }

        // Middle -> Target link (only create once per middle-target pair to avoid duplicate lines)
        const existingMiddleTargetLink = links.find(l =>
          l.source === middleNode.id && l.target === targetNode.id
        );
        
        if (!existingMiddleTargetLink) {
          links.push({
            source: middleNode.id,
            target: targetNode.id,
            gradientType: rel.type === 'funding' ? 'green-blue' : 'orange-blue',
            path: ''
          });
        }
      }
    });

    // Calculate paths for links
    const getConnectionPoint = (node, side) => {
      const centerY = node.y + node.height / 2;
      if (side === 'left') {
        return { x: node.x, y: centerY };
      } else {
        return { x: node.x + node.width, y: centerY };
      }
    };

    const createCurvedPath = (start, end) => {
      const dx = end.x - start.x;
      const control1X = start.x + dx * 0.4;
      const control1Y = start.y;
      const control2X = end.x - dx * 0.4;
      const control2Y = end.y;
      return `M${start.x} ${start.y}C${control1X} ${control1Y} ${control2X} ${control2Y} ${end.x} ${end.y}`;
    };

    links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);

      if (sourceNode && targetNode) {
        const startPoint = getConnectionPoint(sourceNode, 'right');
        const endPoint = getConnectionPoint(targetNode, 'left');
        link.path = createCurvedPath(startPoint, endPoint);
      }
    });

    // Calculate viewBox
    const minX = nodes.length > 0 ? Math.min(...nodes.map(node => node.x)) : 100;
    const maxRightEdge = nodes.length > 0 ? Math.max(...nodes.map(node => node.x + node.width)) : 600;
    const contentWidth = maxRightEdge - minX;

    const minY = nodes.length > 0 ? Math.min(...nodes.map(node => node.y)) : 20;
    const maxBottomEdge = nodes.length > 0 ? Math.max(...nodes.map(node => node.y + node.height)) : 400;
    const contentHeight = maxBottomEdge - minY;

    const viewBoxWidth = 500;
    const viewBoxPadding = 20;
    const contentHeightWithPadding = contentHeight + viewBoxPadding * 2;
    const viewBoxHeight = contentHeightWithPadding;
    
    const actualPadding = (viewBoxHeight - contentHeight) / 2;
    const viewBoxX = Math.max(0, minX - (viewBoxWidth - contentWidth) / 2 - 30);
    const viewBoxY = Math.max(0, minY - actualPadding);
    const calculatedViewBox = `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`;

    setSvgWidth(viewBoxWidth);
    setSvgHeight(viewBoxHeight);
    setViewBox(calculatedViewBox);

    // Render the graph
    renderGraph(nodes, links, viewBoxWidth, calculatedViewBox, leftX);
  }, [graphData, currentSubstory, filteredGraphData, apiGraphData]);

  const renderGraph = (nodes, links, width, viewBoxStr, leftX) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', viewBoxStr);

    const defs = svg.append('defs');

    // Draw nodes first (so they appear on top)
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    nodes.forEach((node) => {
      const nodeG = nodeGroup.append('g').attr('class', `node ${node.type}`);

      let borderColor = '#006DD3';
      let bgColor = '#1D2535';
      let overlayColor = '#1F3046';
      let textColor = '#FFFFFF';

      if (node.type === 'monetary') {
        borderColor = '#397314';
        overlayColor = 'rgba(97, 214, 25, 0.1)';
      } else if (node.type === 'action') {
        borderColor = '#EE7621';
        overlayColor = 'rgba(238, 118, 33, 0.1)';
      }

      const backgroundRadius = 4;
      const overlayRadius = 4;
      const borderWidth = 4;

      // Create foreignObject with div for HTML content
      const foreignObject = nodeG.append('foreignObject')
        .attr('x', node.x)
        .attr('y', node.y)
        .attr('width', node.width)
        .attr('height', node.height);

      const nodeDiv = foreignObject.append('xhtml:div')
        .style('width', '100%')
        .style('height', '100%')
        .style('background-color', bgColor)
        .style('border-radius', `${backgroundRadius}px`)
        .style('position', 'relative')
        .style('overflow', 'hidden')
        .style('pointer-events', 'auto');

      // Add click handler for section nodes (monetary/action middle nodes)
      if (node.type === 'monetary' || node.type === 'action') {
        nodeDiv.on('click', function(event) {
          event.stopPropagation();
          if (onSectionClick) {
            // Determine section type from node type
            const sectionType = node.type === 'monetary' ? 'funding' : 'action';
            onSectionClick(node.label, sectionType);
          }
        });
        nodeDiv.style('cursor', 'pointer');
      }

      // Overlay layer
      const overlayDiv = nodeDiv.append('xhtml:div')
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '0')
        .style('width', '100%')
        .style('height', '100%')
        .style('background-color', overlayColor)
        .style('border-radius', `${overlayRadius}px`)
        .style('pointer-events', 'none');

      // Determine text alignment based on column
      // Left column: left-aligned, Middle and Right columns: center-aligned
      const isLeftColumn = node.x === leftX;
      const textAlign = isLeftColumn ? 'left' : 'center';
      const justifyContent = isLeftColumn ? 'flex-start' : 'center';

      // Text content div
      const textContentDiv = nodeDiv.append('xhtml:div')
        .style('position', 'relative')
        .style('z-index', '1')
        .style('padding-left', `${padding}px`)
        .style('padding-right', `${padding}px`)
        .style('color', textColor)
        .style('font-family', 'Archivo')
        .style('font-size', '16px')
        .style('font-weight', '400')
        .style('line-height', `${lineHeight}px`)
        .style('height', '100%')
        .style('width', '100%')
        .style('box-sizing', 'border-box')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', justifyContent)
        .style('overflow', 'hidden');

      // Inner span for ellipsis
      const textSpan = textContentDiv.append('xhtml:span')
        .style('display', 'block')
        .style('width', '100%')
        .style('min-width', '0')
        .style('overflow', 'hidden')
        .style('text-overflow', 'ellipsis')
        .style('white-space', 'nowrap')
        .style('text-align', textAlign)
        .text(node.label);

      // Border paths
      const leftPath = `
        M ${node.x + borderWidth} ${node.y}
        H ${node.x + overlayRadius}
        Q ${node.x} ${node.y} ${node.x} ${node.y + overlayRadius}
        V ${node.y + node.height - overlayRadius}
        Q ${node.x} ${node.y + node.height} ${node.x + overlayRadius} ${node.y + node.height}
        H ${node.x + borderWidth}
        Z
      `;

      nodeG.append('path')
        .attr('d', leftPath)
        .attr('fill', borderColor)
        .attr('fill-opacity', 0.67);

      const rightPath = `
        M ${node.x + node.width - borderWidth} ${node.y}
        H ${node.x + node.width - overlayRadius}
        Q ${node.x + node.width} ${node.y} ${node.x + node.width} ${node.y + overlayRadius}
        V ${node.y + node.height - overlayRadius}
        Q ${node.x + node.width} ${node.y + node.height} ${node.x + node.width - overlayRadius} ${node.y + node.height}
        H ${node.x + node.width - borderWidth}
        Z
      `;

      nodeG.append('path')
        .attr('d', rightPath)
        .attr('fill', borderColor)
        .attr('fill-opacity', 0.67);
    });

    // Draw links after nodes
    const linkGroup = svg.append('g').attr('class', 'links');

    links.forEach((link, index) => {
      const gradientId = `${link.gradientType}-gradient-${index}`;

      // Parse path to get start and end points
      let startPoint = { x: 0, y: 0 };
      let endPoint = { x: 0, y: 0 };

      try {
        const numbers = link.path.match(/[\d.]+/g);
        if (numbers && numbers.length >= 6) {
          startPoint = { x: parseFloat(numbers[0]), y: parseFloat(numbers[1]) };
          endPoint = { x: parseFloat(numbers[numbers.length - 2]), y: parseFloat(numbers[numbers.length - 1]) };
        } else {
          const tempPath = svg.append('path')
            .attr('d', link.path)
            .style('visibility', 'hidden');

          const pathNode = tempPath.node();
          if (pathNode) {
            const pathLength = pathNode.getTotalLength();
            if (pathLength > 0) {
              startPoint = pathNode.getPointAtLength(0);
              endPoint = pathNode.getPointAtLength(pathLength);
            }
          }

          tempPath.remove();
        }
      } catch (err) {
        const numbers = link.path.match(/[\d.]+/g);
        if (numbers && numbers.length >= 2) {
          startPoint = { x: parseFloat(numbers[0]) || 0, y: parseFloat(numbers[1]) || 0 };
          if (numbers.length >= 4) {
            endPoint = { x: parseFloat(numbers[numbers.length - 2]) || 0, y: parseFloat(numbers[numbers.length - 1]) || 0 };
          }
        }
      }

      // Create gradient aligned with path direction
      const gradient = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', startPoint.x)
        .attr('y1', startPoint.y)
        .attr('x2', endPoint.x)
        .attr('y2', endPoint.y);

      // Set gradient stops based on type
      if (link.gradientType === 'blue-green') {
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', 'rgba(53, 142, 226, 1)');
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', '#61d619');
      } else if (link.gradientType === 'green-blue') {
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', 'rgba(97, 214, 25, 1)');
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', 'rgba(53, 142, 226, 1)');
      } else if (link.gradientType === 'blue-orange') {
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', 'rgba(53, 142, 226, 1)');
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', 'rgba(238, 118, 33, 1)');
      } else if (link.gradientType === 'orange-blue') {
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', 'rgba(238, 118, 33, 1)');
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', 'rgba(53, 142, 226, 1)');
      }

      linkGroup.append('path')
        .attr('d', link.path)
        .attr('stroke', `url(#${gradientId})`)
        .attr('stroke-width', 11)
        .attr('stroke-opacity', 0.5)
        .attr('fill', 'none');
    });
  };

  return (
    <div className='bg-[#0E0E0E] border border-[#202020] rounded-[5px] mt-[16px] pb-[2px]'>
      <div ref={containerRef} className="w-full p-4">
        <div className="mb-4">
          <div className="text-center">
            <span className="text-white text-[14px] font-medium">{StringConstants.HOMEPAGE.CONNECTED_DATA}</span>
          </div>
        </div>
        <div className="w-full overflow-x-auto overflow-y-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height={svgHeight}
            viewBox={viewBox}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="bg-transparent block pointer-events-auto"
          />
        </div>
      </div>
    </div>
  );
};

export default ConnectedData;
