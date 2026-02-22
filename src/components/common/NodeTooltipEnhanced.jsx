import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FaUser, FaBuilding, FaMapMarkerAlt, FaDollarSign, 
  FaHandshake, FaFlag, FaBullseye, FaCog, 
  FaFileAlt, FaGlobe, FaLink, FaLayerGroup,
  FaPlus, FaTimes, FaShareAlt,
  FaBriefcase, FaGraduationCap, FaAward, FaExternalLinkAlt
} from 'react-icons/fa';
import Loader from './Loader';

/**
 * NodeTooltipEnhanced - Comprehensive tooltip component for Three.js graph nodes
 * Displays different layouts and information based on node type
 * 
 * Supported node types with custom layouts:
 * - Entity
 * - Agency
 * - Country
 * - Location
 * - Amount/Transaction
 * - Relationship
 * - Action
 * - Result
 * - Process
 * - Description
 * - And more...
 */

// Icon mapping for different node types
const getNodeIcon = (nodeType) => {
  const type = nodeType?.toLowerCase() || '';
  
  if (type.includes('entity') || type.includes('person')) return FaUser;
  if (type.includes('agency') || type.includes('organization')) return FaBuilding;
  if (type.includes('country')) return FaFlag;
  if (type.includes('location') || type.includes('place')) return FaMapMarkerAlt;
  if (type.includes('amount') || type.includes('transaction')) return FaDollarSign;
  if (type.includes('relationship')) return FaHandshake;
  if (type.includes('action')) return FaCog;
  if (type.includes('result')) return FaBullseye;
  if (type.includes('description')) return FaFileAlt;
  if (type.includes('region')) return FaGlobe;
  if (type.includes('process')) return FaLayerGroup;
  
  return FaLink; // Default icon
};

// Color scheme for different node types - matched to colorUtils.js
const getNodeColor = (nodeType) => {
  const type = nodeType?.toLowerCase() || '';
  
  if (type.includes('entity')) return '#4263EB';
  if (type.includes('relationship')) return '#F03E3E';
  if (type.includes('funding')) return '#40C057';
  if (type.includes('amount')) return '#61d619';
  if (type.includes('agency')) return '#7950F2';
  if (type.includes('action')) return '#FD7E14';
  if (type.includes('country')) return '#9775FA';
  if (type.includes('dba')) return '#FF922B';
  if (type.includes('description')) return '#51CF66';
  if (type.includes('location')) return '#339AF0';
  if (type.includes('place of performance') || type.includes('placeofperformance')) return '#845EF7';
  if (type.includes('process')) return '#20A4F3';
  if (type.includes('recipient')) return '#4ECDC4';
  if (type.includes('region')) return '#95E1D3';
  if (type.includes('result')) return '#F38181';
  
  return '#495057'; // Default
};

// Base tooltip layout - Same style as Amount tooltip with dynamic accent bar color
const BaseTooltipLayout = ({ node, color, graphData }) => {
  const name = node.name || node.label || node.title || node.id || 'Unknown';
  const nodeType = node.node_type || node.type || node.category || '';
  const subtype = node.subtype || node.sub_type || '';
  const description = node.text || node.description || node.desc || node.summary || node.properties?.description || node.properties?.text || '';
  
  // Calculate actual number of connected nodes from graph data
  let relatedCount = 0;
  if (graphData?.links && graphData?.nodes) {
    const nodeId = node.id;
    const connectedNodeIds = new Set();
    
    // Find all links connected to this node
    graphData.links.forEach(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      const targetId = link.target?.id || link.targetId || link.target;
      
      // If this node is the source, add the target
      if (sourceId === nodeId) {
        connectedNodeIds.add(targetId);
      }
      // If this node is the target, add the source
      if (targetId === nodeId) {
        connectedNodeIds.add(sourceId);
      }
    });
    
    relatedCount = connectedNodeIds.size;
  }
  
  // Fallback to node properties if graph data not available
  if (relatedCount === 0) {
    relatedCount = node.degree || node.related_count || node.count || node.properties?.related_count || 0;
  }
  
  // Format type display
  const typeDisplay = subtype ? `${nodeType} / ${subtype}` : nodeType;

  return (
    <div 
      className="flex flex-row rounded-[10px] relative"
      style={{ 
        width: '520px',
        minHeight: '140px',
        padding: '12px 15px',
        background: '#1a1a1a',
        border: '2px solid #1F1F22',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Vertical Accent Bar - Color based on node type */}
      <div 
        className="absolute left-3 top-3 bottom-3 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-5 min-w-0 flex flex-col">
        {/* Node Name */}
        <h3 className="text-white text-xl font-bold mb-1 leading-tight truncate">
          {name}
        </h3>

        {/* Type Information */}
        {typeDisplay && (
          <div className="flex items-center mb-3">
            <span className="text-[#707070] text-xs">
              Type: <span style={{ color }}>{typeDisplay}</span>
            </span>
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-[#909090] text-sm leading-relaxed line-clamp-3">
            {description}
          </p>
        )}
      </div>

      {/* Right Side - Icon Group (matching Figma design) */}
      <div className="flex flex-col items-center justify-between ml-4 flex-shrink-0 self-stretch gap-1.5">
        {/* Top: Chevron/Expand Icon */}
        <button 
          className="flex items-center justify-center text-white hover:text-gray-300 transition-colors pt-[5px]"
          title="Expand"
        >
          <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
            <path d="M1 7L8 1L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Middle: Spacer + Network Icon */}
        <div className="flex-1 flex items-center justify-center">
          <button 
            className="flex items-center justify-center text-white hover:text-gray-300 transition-colors"
            title="Network"
          >
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.8868 9.49648C14.313 9.49671 13.7642 9.73132 13.3674 10.1459L11.7565 9.46128C11.8666 9.13184 11.9246 8.78726 11.9284 8.43992C11.9245 6.57423 10.413 5.06273 8.54735 5.05888C8.26529 5.0624 7.98483 5.10168 7.71266 5.17582L6.78639 3.52685C7.57065 2.66732 7.50962 1.33475 6.65009 0.55049C5.79056 -0.233768 4.45799 -0.17274 3.67373 0.686789C2.88947 1.54632 2.9505 2.87889 3.81003 3.66315C4.19987 4.01886 4.709 4.21529 5.23677 4.21362C5.33807 4.21074 5.43907 4.20061 5.53895 4.18334L6.44971 5.80342C5.08174 6.86865 4.75702 8.80386 5.70234 10.2573L3.03696 12.836C1.94634 12.3522 0.669978 12.8441 0.186142 13.9347C-0.297694 15.0253 0.19421 16.3017 1.28483 16.7855C2.37546 17.2694 3.65182 16.7775 4.13565 15.6868C4.40476 15.0802 4.38016 14.3836 4.06888 13.7975L6.6899 11.2617C8.08241 12.1883 9.94507 11.945 11.0529 10.6919L12.7913 11.4301C12.7864 11.4899 12.7737 11.5477 12.7737 11.6083C12.7737 12.7753 13.7198 13.7214 14.8868 13.7214C16.0539 13.7214 17 12.7753 17 11.6082C17 10.4412 16.0539 9.49508 14.8868 9.49508V9.49648Z" fill="#D7D7D7"/>
          </svg>
          </button>
        </div>

        {/* Bottom: Count Badge */}
        <div 
          className="flex items-center justify-end gap-0.5 self-stretch"
          style={{ 
            background: '#000000',
            border: '0.5px solid #D7D7D7',
            borderRadius: '0 0 5px 0',
            padding: '0 5px 0 0'
          }}
        >
          <svg width="7.5" height="7.5" viewBox="0 0 10 10" fill="white">
            <path d="M5 0V10M0 5H10" stroke="white" strokeWidth="2" />
          </svg>
          <span style={{ 
            fontFamily: 'Open Sans, sans-serif',
            fontWeight: 600,
            fontSize: '10px',
            lineHeight: '1.1em',
            letterSpacing: '-0.025em',
            color: '#D7D7D7'
          }}>
            {relatedCount}
          </span>
        </div>
      </div>
    </div>
  );
};

// Entity-specific layout - displays node information (wikidata fetched in RightSidebar on click)
const EntityTooltipLayout = ({ node, color }) => {
  const [imageError, setImageError] = useState(false);
  
  const entityName = node.name || node['Entity Name'] || node.entity_name || node.id || 'Unknown';
  const nodeType = node.node_type || node.type || 'Type';
  const subtype = node.subtype || node.category || 'Subtype';
  const degree = node.degree || node.related_count || 857;
  
  // Get description from node (wikidata is only fetched in RightSidebar on click)
  const description = node.description || node.summary || '';
  
  // Get image URL from node (wikidata images are only fetched in RightSidebar on click)
  const imageUrl = node.IMG_SRC || null;

  return (
    <div 
      className="flex flex-row rounded-[15px] relative overflow-hidden"
      style={{ 
        width: '580px',
        minHeight: '180px',
        padding: '12px 15px',
        background: '#1a1a1a',
        border: '2px solid #1F1F22',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Left Side - Accent Bar + Image */}
      <div className="flex flex-row flex-shrink-0 self-stretch">
        {/* Left Accent Line */}
        <div 
          className="w-1.5 rounded-lg flex-shrink-0 self-stretch"
          style={{ backgroundColor: '#358EE2' }}
        />
        
        {/* Image Container */}
        <div 
          className="rounded-r-lg overflow-hidden self-stretch"
          style={{ 
            width: '140px',
            minHeight: '140px',
            background: '#9CA3AF',
          }}
        >
          {imageUrl && !imageError ? (
            <img 
              src={imageUrl} 
              alt={entityName}
              className="w-full h-full object-cover block"
              loading="lazy"
              onLoad={() => {}}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-400 to-gray-500">
              <FaUser className="text-white opacity-50" size={48} />
            </div>
          )}
        </div>
      </div>

      {/* Middle - Content */}
      <div className="flex-1 ml-5 min-w-0 flex flex-col">
        {/* Entity Name */}
        <h3 
          className="text-2xl font-bold mb-1 leading-tight"
          style={{ color: '#ffffff' }}
        >
          {entityName}
        </h3>

        {/* Type Info with Icon */}
        <div className="flex items-center gap-2 mb-3">
          <FaUser className="text-[#888]" size={14} />
          <span className="text-[#888] text-sm">
            {nodeType}{subtype !== 'Subtype' ? `, ${subtype}` : ''}
          </span>
        </div>

        {/* Description */}
        <p className="text-[#666] text-sm leading-relaxed line-clamp-4">
          {description}
        </p>
      </div>

      {/* Right Side - Icons */}
      <div className="flex flex-col items-center justify-between ml-4 flex-shrink-0 self-stretch">
        {/* Chevron Up Icon */}
        <button 
          className="flex items-center justify-center text-[#AAAAAA] hover:text-[#888] transition-colors"
          title="Expand"
        >
          <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
            <path d="M2 10L10 2L18 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Network Icon */}
        <button 
          className="flex items-center justify-center text-[#AAAAAA] hover:text-[#888] transition-colors"
          title="View Network"
        >
          <svg width="24" height="24" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.8868 9.49648C14.313 9.49671 13.7642 9.73132 13.3674 10.1459L11.7565 9.46128C11.8666 9.13184 11.9246 8.78726 11.9284 8.43992C11.9245 6.57423 10.413 5.06273 8.54735 5.05888C8.26529 5.0624 7.98483 5.10168 7.71266 5.17582L6.78639 3.52685C7.57065 2.66732 7.50962 1.33475 6.65009 0.55049C5.79056 -0.233768 4.45799 -0.17274 3.67373 0.686789C2.88947 1.54632 2.9505 2.87889 3.81003 3.66315C4.19987 4.01886 4.709 4.21529 5.23677 4.21362C5.33807 4.21074 5.43907 4.20061 5.53895 4.18334L6.44971 5.80342C5.08174 6.86865 4.75702 8.80386 5.70234 10.2573L3.03696 12.836C1.94634 12.3522 0.669978 12.8441 0.186142 13.9347C-0.297694 15.0253 0.19421 16.3017 1.28483 16.7855C2.37546 17.2694 3.65182 16.7775 4.13565 15.6868C4.40476 15.0802 4.38016 14.3836 4.06888 13.7975L6.6899 11.2617C8.08241 12.1883 9.94507 11.945 11.0529 10.6919L12.7913 11.4301C12.7864 11.4899 12.7737 11.5477 12.7737 11.6083C12.7737 12.7753 13.7198 13.7214 14.8868 13.7214C16.0539 13.7214 17 12.7753 17 11.6082C17 10.4412 16.0539 9.49508 14.8868 9.49508V9.49648Z" fill="currentColor"/>
          </svg>
        </button>

        {/* Count Badge */}
        <div 
          className="flex items-center gap-1 px-2 py-1 rounded-md"
          style={{ 
            background: '#FFFFFF',
            border: '1px solid #D0D0D0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <span className="text-[#666] font-semibold text-sm">+</span>
          <span className="text-[#666] font-semibold text-sm">{degree}</span>
        </div>
      </div>
    </div>
  );
};

// Agency-specific layout (placeholder for future customization)
const AgencyTooltipLayout = ({ node, color, graphData }) => {
  return <BaseTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Country-specific layout (placeholder for future customization)
const CountryTooltipLayout = ({ node, color, graphData }) => {
  return <BaseTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Location-specific layout (placeholder for future customization)
const LocationTooltipLayout = ({ node, color, graphData }) => {
  return <BaseTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Amount/Transaction-specific layout - Custom flow design
const AmountTooltipLayout = ({ node, color, graphData }) => {
  // Extract transaction/amount specific data
  const amount = node.Amount || node.amount || node.value || node.properties?.amount || node.name || '0';
  
  // Find connected source and target from graph links
  let sourceEntity = 'Entity Source';
  let targetEntity = 'Entity Target';
  
  if (graphData?.links && graphData?.nodes) {
    const nodeId = node.id;
    
    // Find links connected to this amount node
    const incomingLinks = graphData.links.filter(link => {
      const targetId = link.target?.id || link.targetId || link.target;
      return targetId === nodeId;
    });
    
    const outgoingLinks = graphData.links.filter(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      return sourceId === nodeId;
    });
    
    // Get source node (node that links TO this amount)
    if (incomingLinks.length > 0) {
      const sourceLink = incomingLinks[0];
      const sourceId = sourceLink.source?.id || sourceLink.sourceId || sourceLink.source;
      const sourceNode = graphData.nodes.find(n => n.id === sourceId);
      if (sourceNode) {
        sourceEntity = sourceNode.name || sourceNode.id || 'Entity Source';
      }
    }
    
    // Get target node (node that this amount links TO)
    if (outgoingLinks.length > 0) {
      const targetLink = outgoingLinks[0];
      const targetId = targetLink.target?.id || targetLink.targetId || targetLink.target;
      const targetNode = graphData.nodes.find(n => n.id === targetId);
      if (targetNode) {
        targetEntity = targetNode.name || targetNode.id || 'Entity Target';
      }
    }
  }
  
  // Fallback to node properties if graph data didn't provide values
  if (sourceEntity === 'Entity Source') {
    sourceEntity = node['Distributor Full Name'] || 
                   node.source_entity || 
                   node.source_name ||
                   node.from_name ||
                   node.from_entity ||
                   node.from ||
                   node.sourceName ||
                   node.properties?.source || 
                   node.properties?.source_name ||
                   node.properties?.from ||
                   'Entity Source';
  }
  
  if (targetEntity === 'Entity Target') {
    targetEntity = node['Receiver Name'] || 
                   node.target_entity || 
                   node.target_name ||
                   node.to_name ||
                   node.to_entity ||
                   node.to ||
                   node.targetName ||
                   node.properties?.target || 
                   node.properties?.target_name ||
                   node.properties?.to ||
                   'Entity Target';
  }
  
  // NOTE: `node.section` is section membership (Section Name key), not the node's type.
  const entityType = node.entity_type || node.subtype || node.node_type || node.type || node.properties?.type || 'Type';
  const relatedCount = node.degree || node.related_count || node.count || node.properties?.related_count || null;

  // Format amount with currency
  const formattedAmount = typeof amount === 'number' 
    ? `$${amount.toLocaleString()}` 
    : amount.toString().startsWith('$') 
      ? amount 
      : `$${amount}`;

  // Description text
  const description = node.description || node.desc || node.summary || node.properties?.description || '';

  return (
    <div 
      className="flex flex-row rounded-[10px] relative"
      style={{ 
        width: '520px',
        minHeight: '140px',
        padding: '12px 15px',
        background: '#1a1a1a',
        border: '2px solid #1F1F22',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Vertical Accent Bar - Color based on node type */}
      <div 
        className="absolute left-3 top-3 bottom-3 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-5 min-w-0 flex flex-col">
        {/* Transaction Flow: Source → Amount → Target */}
        <div className="flex items-center gap-2 mb-1">
          {/* Source Entity */}
          <span className="text-[#B0B0B0] text-base font-medium truncate max-w-[120px]">
            {sourceEntity}
          </span>

          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#EF4444] flex-shrink-0">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          {/* Amount (highlighted in node color) */}
          <span className="text-xl font-bold flex-shrink-0" style={{ color }}>
            {formattedAmount}
          </span>

          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#EF4444] flex-shrink-0">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          {/* Target Entity */}
          <span className="text-[#B0B0B0] text-base font-medium truncate max-w-[120px]">
            {targetEntity}
          </span>
        </div>

        {/* Type Information */}
        <div className="flex items-center mb-3">
          <span className="text-[#707070] text-xs">
            Type: <span style={{ color }}>Amount</span>
          </span>
        </div>

        {/* Description */}
        {description && (
          <p className="text-[#909090] text-sm leading-relaxed line-clamp-3">
            {description}
          </p>
        )}
      </div>

      {/* Right Side - Icon Group (matching Figma design) */}
      <div className="flex flex-col items-center justify-between ml-4 flex-shrink-0 self-stretch gap-1.5">
        {/* Top: Chevron/Expand Icon */}
        <button 
          className="flex items-center justify-center text-white hover:text-gray-300 transition-colors pt-[5px]"
          title="Expand"
        >
          <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
            <path d="M1 7L8 1L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Middle: Spacer + Network Icon */}
        <div className="flex-1 flex items-center justify-center">
          <button 
            className="flex items-center justify-center text-white hover:text-gray-300 transition-colors"
            title="Network"
          >
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.8868 9.49648C14.313 9.49671 13.7642 9.73132 13.3674 10.1459L11.7565 9.46128C11.8666 9.13184 11.9246 8.78726 11.9284 8.43992C11.9245 6.57423 10.413 5.06273 8.54735 5.05888C8.26529 5.0624 7.98483 5.10168 7.71266 5.17582L6.78639 3.52685C7.57065 2.66732 7.50962 1.33475 6.65009 0.55049C5.79056 -0.233768 4.45799 -0.17274 3.67373 0.686789C2.88947 1.54632 2.9505 2.87889 3.81003 3.66315C4.19987 4.01886 4.709 4.21529 5.23677 4.21362C5.33807 4.21074 5.43907 4.20061 5.53895 4.18334L6.44971 5.80342C5.08174 6.86865 4.75702 8.80386 5.70234 10.2573L3.03696 12.836C1.94634 12.3522 0.669978 12.8441 0.186142 13.9347C-0.297694 15.0253 0.19421 16.3017 1.28483 16.7855C2.37546 17.2694 3.65182 16.7775 4.13565 15.6868C4.40476 15.0802 4.38016 14.3836 4.06888 13.7975L6.6899 11.2617C8.08241 12.1883 9.94507 11.945 11.0529 10.6919L12.7913 11.4301C12.7864 11.4899 12.7737 11.5477 12.7737 11.6083C12.7737 12.7753 13.7198 13.7214 14.8868 13.7214C16.0539 13.7214 17 12.7753 17 11.6082C17 10.4412 16.0539 9.49508 14.8868 9.49508V9.49648Z" fill="#D7D7D7"/>
            </svg>
          </button>
        </div>

        {/* Bottom: Count Badge */}
          <div 
            className="flex items-center justify-end gap-0.5 self-stretch"
            style={{ 
              background: '#000000',
              border: '0.5px solid #D7D7D7',
              borderRadius: '0 0 5px 0',
              padding: '0 5px 0 0'
            }}
          >
            <svg width="7.5" height="7.5" viewBox="0 0 10 10" fill="white">
              <path d="M5 0V10M0 5H10" stroke="white" strokeWidth="2" />
            </svg>
            <span style={{ 
              fontFamily: 'Open Sans, sans-serif',
              fontWeight: 600,
              fontSize: '10px',
              lineHeight: '1.1em',
              letterSpacing: '-0.025em',
              color: '#D7D7D7'
            }}>
              {Math.floor(Math.random() * 100)}
            </span>
          </div>
      </div>
    </div>
  );
};

// Relationship-specific layout (placeholder for future customization)
const RelationshipTooltipLayout = ({ node, color, graphData }) => {
  return <BaseTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Action-specific layout - Shows Source → ProcessName → Target flow
const ActionTooltipLayout = ({ node, color, graphData }) => {
  // Process/Action name (the node's actual action value/name)
  const processName = node.name || 
                      node.action_text || 
                      node.action_name || 
                      node.label || 
                      node.title ||
                      node.action ||
                      node.properties?.name ||
                      node.properties?.action_text ||
                      node.properties?.action_name ||
                      node.properties?.label ||
                      node.category || 
                      'Action';
  
  // Find connected source and target from graph links
  let sourceEntity = 'Entity Source';
  let targetEntity = 'Entity Target';
  
  if (graphData?.links && graphData?.nodes) {
    const nodeId = node.id;
    
    // Find links connected to this action node
    const incomingLinks = graphData.links.filter(link => {
      const targetId = link.target?.id || link.targetId || link.target;
      return targetId === nodeId;
    });
    
    const outgoingLinks = graphData.links.filter(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      return sourceId === nodeId;
    });
    
    // Get source node (node that links TO this action)
    if (incomingLinks.length > 0) {
      const sourceLink = incomingLinks[0];
      const sourceId = sourceLink.source?.id || sourceLink.sourceId || sourceLink.source;
      const sourceNode = graphData.nodes.find(n => n.id === sourceId);
      if (sourceNode) {
        sourceEntity = sourceNode.name || sourceNode.id || 'Entity Source';
      }
    }
    
    // Get target node (node that this action links TO)
    if (outgoingLinks.length > 0) {
      const targetLink = outgoingLinks[0];
      const targetId = targetLink.target?.id || targetLink.targetId || targetLink.target;
      const targetNode = graphData.nodes.find(n => n.id === targetId);
      if (targetNode) {
        targetEntity = targetNode.name || targetNode.id || 'Entity Target';
      }
    }
  }
  
  // Fallback to node properties if graph data didn't provide values
  if (sourceEntity === 'Entity Source') {
    sourceEntity = node.source_entity || 
                   node.source_name ||
                   node.from_name ||
                   node.from_entity ||
                   node.from ||
                   node.sourceName ||
                   node.actor ||
                   node.properties?.source || 
                   node.properties?.source_name ||
                   node.properties?.from ||
                   node.properties?.actor ||
                   'Entity Source';
  }
  
  if (targetEntity === 'Entity Target') {
    targetEntity = node.target_entity || 
                   node.target_name ||
                   node.to_name ||
                   node.to_entity ||
                   node.to ||
                   node.targetName ||
                   node.subject ||
                   node.object ||
                   node.properties?.target || 
                   node.properties?.target_name ||
                   node.properties?.to ||
                   node.properties?.subject ||
                   'Entity Target';
  }

  // NOTE: `node.section` is section membership (Section Name key), not the node's type.
  const entityType = node.action_type || node.subtype || node.node_type || node.type || node.properties?.type || 'Type';
  
  // Calculate actual number of connected nodes from graph data
  let relatedCount = 0;
  if (graphData?.links && graphData?.nodes) {
    const nodeId = node.id;
    const connectedNodeIds = new Set();
    
    // Find all links connected to this node
    graphData.links.forEach(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      const targetId = link.target?.id || link.targetId || link.target;
      
      // If this node is the source, add the target
      if (sourceId === nodeId) {
        connectedNodeIds.add(targetId);
      }
      // If this node is the target, add the source
      if (targetId === nodeId) {
        connectedNodeIds.add(sourceId);
      }
    });
    
    relatedCount = connectedNodeIds.size;
  }
  
  // Fallback to node properties if graph data not available
  if (relatedCount === 0) {
    relatedCount = node.degree || node.related_count || node.count || node.properties?.related_count || 0;
  }

  // Description text
  const description = node.text || node.description || node.desc || node.summary || node.properties?.description || '';

  return (
    <div 
      className="flex flex-row rounded-[10px] relative"
      style={{ 
        width: '520px',
        minHeight: '140px',
        padding: '12px 15px',
        background: '#1a1a1a',
        border: '2px solid #1F1F22',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Vertical Accent Bar - Orange for Action */}
      <div 
        className="absolute left-3 top-3 bottom-3 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-5 min-w-0 flex flex-col">
        {/* Action Flow: Source → ProcessName → Target */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {/* Source Entity */}
          <span className="text-[#B0B0B0] text-base font-medium truncate max-w-[120px]">
            {sourceEntity}
          </span>

          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#EF4444] flex-shrink-0">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          {/* Process Name (highlighted in orange) */}
          <span className="text-xl font-bold flex-shrink-0" style={{ color }}>
            {processName}
          </span>

          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#EF4444] flex-shrink-0">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          {/* Target Entity */}
          <span className="text-[#B0B0B0] text-base font-medium truncate max-w-[120px]">
            {targetEntity}
          </span>
        </div>

        {/* Type Information */}
        <div className="flex items-center mb-3">
          <span className="text-[#707070] text-xs">
            Type: <span style={{ color }}>{node.type}</span>
          </span>
        </div>

        {/* Description */}
        {node.name && (
          <p className="text-[#606060] text-sm leading-relaxed line-clamp-3">
            {node.text}
          </p>
        )}
      </div> 

      {/* Right Side - Icons only */}
      <div className="flex flex-col items-center justify-between ml-4 flex-shrink-0 self-stretch" style={{ gap: '6px' }}>
        {/* Top: Chevron/Expand Icon */}
        <button 
          className="flex items-center justify-center text-[#505050] hover:text-[#303030] transition-colors"
          title="Expand"
          style={{ padding: '5px 0 0 0' }}
        >
          <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
            <path d="M1 7L8 1L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Middle: Network Icon */}
        <div className="flex-1 flex items-center justify-center">
          <button 
            className="flex items-center justify-center text-[#707070] hover:text-[#505050] transition-colors"
            title="View Network"
          >
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.8868 9.49648C14.313 9.49671 13.7642 9.73132 13.3674 10.1459L11.7565 9.46128C11.8666 9.13184 11.9246 8.78726 11.9284 8.43992C11.9245 6.57423 10.413 5.06273 8.54735 5.05888C8.26529 5.0624 7.98483 5.10168 7.71266 5.17582L6.78639 3.52685C7.57065 2.66732 7.50962 1.33475 6.65009 0.55049C5.79056 -0.233768 4.45799 -0.17274 3.67373 0.686789C2.88947 1.54632 2.9505 2.87889 3.81003 3.66315C4.19987 4.01886 4.709 4.21529 5.23677 4.21362C5.33807 4.21074 5.43907 4.20061 5.53895 4.18334L6.44971 5.80342C5.08174 6.86865 4.75702 8.80386 5.70234 10.2573L3.03696 12.836C1.94634 12.3522 0.669978 12.8441 0.186142 13.9347C-0.297694 15.0253 0.19421 16.3017 1.28483 16.7855C2.37546 17.2694 3.65182 16.7775 4.13565 15.6868C4.40476 15.0802 4.38016 14.3836 4.06888 13.7975L6.6899 11.2617C8.08241 12.1883 9.94507 11.945 11.0529 10.6919L12.7913 11.4301C12.7864 11.4899 12.7737 11.5477 12.7737 11.6083C12.7737 12.7753 13.7198 13.7214 14.8868 13.7214C16.0539 13.7214 17 12.7753 17 11.6082C17 10.4412 16.0539 9.49508 14.8868 9.49508V9.49648Z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        {/* Bottom: Count Badge */}
        <div 
          className="flex items-center justify-end gap-0.5"
          style={{ 
            background: '#FFFFFF',
            border: '0.5px solid #909090',
            borderRadius: '0 0 5px 0',
            padding: '2px 6px'
          }}
        >
          <svg width="7.5" height="7.5" viewBox="0 0 10 10" fill="none">
            <path d="M5 0V10M0 5H10" stroke="#505050" strokeWidth="2" />
          </svg>
          <span style={{ 
            fontFamily: 'Open Sans, sans-serif',
            fontWeight: 600,
            fontSize: '10px',
            lineHeight: '1.1em',
            letterSpacing: '-0.025em',
            color: '#505050'
          }}>
            {relatedCount}
          </span>
        </div>
      </div>
    </div>
  );
};

// Result-specific layout (placeholder for future customization)
const ResultTooltipLayout = ({ node, color, graphData }) => {
  return <BaseTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Process-specific layout (placeholder for future customization)
const ProcessTooltipLayout = ({ node, color, graphData }) => {
  return <BaseTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Node types that use EntityTooltipLayout with wikidata lookup by id
const WIKIDATA_LAYOUT_TYPES = ['entity', 'person', 'concept', 'data', 'entity_gen', 'framework'];

// Get the appropriate layout component based on node type
const getTooltipLayout = (nodeType) => {
  const type = nodeType?.toLowerCase() || '';
  
  if (WIKIDATA_LAYOUT_TYPES.some(t => type.includes(t))) return EntityTooltipLayout;
  if (type.includes('agency') || type.includes('organization')) return AgencyTooltipLayout;
  if (type.includes('country')) return CountryTooltipLayout;
  if (type.includes('location') || type.includes('place')) return LocationTooltipLayout;
  if (type.includes('amount') || type.includes('transaction') || type.includes('funding')) return AmountTooltipLayout;
  if (type.includes('relationship')) return RelationshipTooltipLayout;
  if (type.includes('action')) return ActionTooltipLayout;
  if (type.includes('result')) return ResultTooltipLayout;
  if (type.includes('process')) return ProcessTooltipLayout;
  
  return BaseTooltipLayout; // Default layout
};

/**
 * Main NodeTooltipEnhanced Component
 */
const NodeTooltipEnhanced = ({ node, position, graphData }) => {
  if (!node || !position) return null;

  const nodeType = node.node_type || node.type || node.category || '';
  const color = getNodeColor(nodeType);
  const TooltipLayout = getTooltipLayout(nodeType);
  
  // Allow pointer events for wikidata tooltips (entity, concept, data, entity_gen, framework - for clickable links)
  const isWikidataTooltip = WIKIDATA_LAYOUT_TYPES.some(t => (nodeType || '').toLowerCase().includes(t));

  return (
    <div
      className={`fixed z-[9999] ${isWikidataTooltip ? '' : 'pointer-events-none'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -120%)', // Position above the cursor
      }}
    >
      <TooltipLayout node={node} color={color} graphData={graphData} />
    </div>
  );
};

export default NodeTooltipEnhanced;

