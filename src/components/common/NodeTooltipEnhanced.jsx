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

  if (type.includes('entity')) return '#034C92';
  if (type.includes('relationship')) return '#016876';
  if (type.includes('funding')) return '#40C057';
  if (type.includes('amount')) return '#61d619';
  if (type.includes('framework')) return '#4B7110';
  if (type.includes('agency')) return '#7950F2';
  if (type.includes('action')) return '#6F6600';
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

// Base tooltip layout - Show only Type, Date, Description (name as title)
const BaseTooltipLayout = ({ node, color, graphData }) => {
  const name = node.name || node.label || node.title || node.id || 'Unknown';
  const nodeType = node.node_type || node.type || node.category || '';
  const subtype = node.subtype || node.sub_type || '';
  const typeDisplay = subtype ? `${nodeType} / ${subtype}` : nodeType;
  const dateVal = node.date || node.Date || node['Relationship Date'] || node['Action Date'] || node['Process Date'] || node['Disb Date'] || '';
  const description = node.text || node.description || node.desc || node.summary || node['Relationship Summary'] || node.properties?.description || node.properties?.text || '';

  let relatedCount = 0;
  if (graphData?.links && graphData?.nodes) {
    const nodeId = node.id;
    const connectedNodeIds = new Set();
    graphData.links.forEach(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      const targetId = link.target?.id || link.targetId || link.target;
      if (sourceId === nodeId) connectedNodeIds.add(targetId);
      if (targetId === nodeId) connectedNodeIds.add(sourceId);
    });
    relatedCount = connectedNodeIds.size;
  }
  if (relatedCount === 0) {
    relatedCount = node.degree || node.related_count || node.count || node.properties?.related_count || 0;
  }

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
      <div
        className="absolute left-3 top-3 bottom-3 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 ml-5 min-w-0 flex flex-col">
        <h3 className="text-white text-xl font-bold mb-2 leading-tight truncate">
          {name}
        </h3>

        {/* Only Type, Date, Description */}
        {typeDisplay && (
          <div className="flex flex-wrap gap-x-2 text-sm mb-1.5">
            <span className="text-[#707070] shrink-0">Type:</span>
            <span className="text-[#B4B4B4]" style={{ color }}>{typeDisplay}</span>
          </div>
        )}
        {dateVal && (
          <div className="flex flex-wrap gap-x-2 text-sm mb-1.5">
            <span className="text-[#707070] shrink-0">Date:</span>
            <span className="text-[#B4B4B4]">{typeof dateVal === 'string' ? dateVal : String(dateVal)}</span>
          </div>
        )}
        {description && (
          <div className="flex flex-wrap gap-x-2 text-sm">
            <span className="text-[#707070] shrink-0">Description:</span>
            <p className="text-[#B4B4B4] leading-relaxed line-clamp-3 mb-0">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Resolve Wikimedia Commons URL to direct image URL (same logic as RightSidebar)
const fetchDirectImageUrl = async (url) => {
  try {
    url = url.replace(/^http:/, 'https:');
    if (url.includes('upload.wikimedia.org')) return url;
    if (!url.includes('commons.wikimedia.org')) return url;
    let filename = null;
    const specialFilePathMatch = url.match(/Special:FilePath\/(.+?)(?:\?|#|$)/);
    if (specialFilePathMatch) {
      try {
        filename = decodeURIComponent(specialFilePathMatch[1]);
      } catch {
        filename = specialFilePathMatch[1].replace(/%20/g, ' ').replace(/%2F/g, '/');
      }
    } else {
      const fileMatch = url.match(/\/wiki\/File:(.+?)(?:\?|#|$)/);
      if (fileMatch) {
        try {
          filename = decodeURIComponent(fileMatch[1]);
        } catch {
          filename = fileMatch[1].replace(/%20/g, ' ').replace(/\+/g, ' ').trim();
        }
      }
    }
    if (!filename) return url;
    filename = filename.replace(/%20/g, ' ').replace(/\+/g, ' ').trim();
    const fileTitle = filename.replace(/ /g, '_');
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    const pages = data.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const imageInfo = pages[pageId]?.imageinfo;
      if (imageInfo?.[0]?.url) return imageInfo[0].url;
    }
    return url;
  } catch {
    return url;
  }
};

const WIKIDATA_ENTITY_TYPES = ['entity', 'person', 'concept', 'data', 'entity_gen'];

// Entity-specific layout - fetches wikidata by node id (same as Node Properties) for image_url/logo_url
// If there is no avatar and no detailed description, fall back to the base tooltip style
const EntityTooltipLayout = ({ node, color, graphData }) => {
  const [imageError, setImageError] = useState(false);
  const [wikidataImageUrl, setWikidataImageUrl] = useState(null);
  const [wikidataInfo, setWikidataInfo] = useState(null);

  const entityName = node.name || node['Entity Name'] || node.entity_name || node.id || 'Unknown';
  const nodeType = node.node_type || node.type || node.category || 'Type';
  const nodeTypeLower = (node.node_type || node.type || node.category || '').toLowerCase();
  const subtype = node.subtype || 'Subtype';
  const degree = node.degree || node.related_count || 857;
  const entityId = node.id ?? node.gid ?? null;

  // Name and type from entity; description from node or wikidata
  const displayName = wikidataInfo?.name || entityName;
  const displayType = nodeType;
  const description = wikidataInfo?.description || node.description || node.summary || '';

  // Reset image error when node changes so new node can show avatar
  useEffect(() => {
    setImageError(false);
  }, [entityId]);

  // Fetch wikidata by node id (same API as RightSidebar) for image, name, type, wikipedia_url, url, alias
  useEffect(() => {
    if (!entityId || entityId === 'Unknown') {
      setWikidataImageUrl(null);
      setWikidataInfo(null);
      return;
    }
    const isWikidataType = WIKIDATA_ENTITY_TYPES.some((t) => nodeTypeLower.includes(t));
    if (!isWikidataType) {
      setWikidataImageUrl(null);
      setWikidataInfo(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        let finalEntityId = String(entityId).trim();
        if (nodeTypeLower.includes('concept')) {
          finalEntityId = (finalEntityId.startsWith('co') ? finalEntityId : 'co' + finalEntityId);
        }
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const url = `${apiBaseUrl}/api/wikidata/${encodeURIComponent(nodeType)}/${encodeURIComponent(finalEntityId)}`;
        const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (!response.ok || cancelled) return;
        const result = await response.json();
        if (cancelled || !result?.found || !result?.data) {
          setWikidataImageUrl(null);
          setWikidataInfo(null);
          return;
        }
        if (!cancelled) setWikidataInfo(result.data);
        const raw = result.data.image_url || result.data.logo_url || null;
        if (!raw || typeof raw !== 'string' || !raw.trim()) {
          setWikidataImageUrl(null);
          return;
        }
        let normalized = raw.trim().replace(/^http:\/\//, 'https://');
        if (normalized.includes('commons.wikimedia.org')) {
          normalized = await fetchDirectImageUrl(normalized);
        }
        if (!cancelled) setWikidataImageUrl(normalized);
      } catch {
        if (!cancelled) {
          setWikidataImageUrl(null);
          setWikidataInfo(null);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
      setWikidataInfo(null);
    };
  }, [entityId, nodeType, nodeTypeLower]);

  // Avatar: prefer wikidata image (same as Node Properties), then node's own image
  const rawNodeImageUrl = (
    node.IMG_SRC || node.image_url || node.image || node.logo_url
    || node.properties?.image_url || node.properties?.image || node.properties?.logo_url || node.properties?.IMG_SRC
  );
  const nodeImageUrl = (typeof rawNodeImageUrl === 'string' && rawNodeImageUrl.trim()) ? rawNodeImageUrl.trim() : null;
  const imageUrl = wikidataImageUrl || nodeImageUrl;

  // If this entity has neither an avatar nor a meaningful description,
  // use the same compact layout as other node types.
  const hasAvatarOrDescription = !!imageUrl || !!description;

  if (!hasAvatarOrDescription) {
    return <BaseTooltipLayout node={node} color={color} graphData={graphData} />;
  }

  return (
    <div
      className="flex flex-row rounded-[15px] relative overflow-hidden"
      style={{
        width: '580px',
        padding: '12px 15px',
        background: '#1a1a1a',
        border: '2px solid #1F1F22',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Left Side - Accent Bar + Image */}
      <div className="flex flex-row flex-shrink-0 self-stretch">
       <div
            className="w-1.5 rounded-lg flex-shrink-0 self-stretch"
            style={{ backgroundColor: '#358EE2' }}
          />
        {imageUrl && !imageError ? (<>
          {/* Image Container */}
          <div
            className="rounded-r-lg overflow-hidden self-stretch"
            style={{
              width: '140px',
              background: '#9CA3AF',
            }}
          >
            <img
                src={imageUrl}
                alt={displayName}
                className="w-full h-full object-cover block"
                loading="lazy"
                onLoad={() => { }}
                onError={() => setImageError(true)}
              />
          </div>
        </>) : (
          <></>
        )}
      </div>

      {/* Middle - Content: name & type from entity, wikipedia_url / url / alias from entity_wikidata */}
      <div className="flex-1 ml-5 min-w-0 flex flex-col">
        {/* Name (from entity / wikidata) */}
        <h3
          className="text-2xl font-bold mb-1 leading-tight"
          style={{ color: '#ffffff' }}
        >
          {displayName}
        </h3>

        {/* Type (from entity) */}
        <div className="flex items-center gap-2 mb-1">
          <FaUser className="text-[#888]" size={14} />
          <span className="text-[#888] text-sm">
            {displayType}{subtype !== 'Subtype' ? `, ${subtype}` : ''}
          </span>
        </div>

        {/* Alias (from entity_wikidata) */}
        {wikidataInfo?.alias || node.alias && (
          <p className="text-[#888] text-xs mb-1">
            Alias: <span className="text-[#B4B4B4]">{wikidataInfo.alias}</span>
          </p>
        )}

        {/* Wikipedia link & URL (from entity_wikidata) */}
        {(wikidataInfo?.wikipedia_url || wikidataInfo?.url) && (
          <div className="flex flex-wrap gap-2 mb-2">
            {wikidataInfo.wikipedia_url && (
              <a
                href={wikidataInfo.wikipedia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#6EA4F4] hover:underline"
              >
                Wikipedia Link
              </a>
            )}
            {wikidataInfo.url && (
              <a
                href={wikidataInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#6EA4F4] hover:underline"
              >
                Social Link
              </a>
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-[#666] text-sm leading-relaxed line-clamp-4">
            {description}
          </p>
        )}
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
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Amount (highlighted in node color) */}
          <span className="text-xl font-bold flex-shrink-0" style={{ color }}>
            {formattedAmount}
          </span>

          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#EF4444] flex-shrink-0">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
    </div>
  );
};

// Tooltip: show only Type, Date, Description (shared pick helper)
const pickTooltip = (node, ...keys) => {
  if (!node) return null;
  for (const k of keys) {
    const v = node[k] ?? node.properties?.[k];
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return null;
};

// Connector tooltip layout: show only Type, Date, Description (name as title)
const ConnectorTooltipLayout = ({ node, color, graphData }) => {
  const name = node.name || node.label || node.title || node['Relationship Name'] || node['Action Summary'] || node.id || 'Unknown';
  const typeVal = pickTooltip(node, 'type', 'node_type', 'category', 'Relationship Type', 'Action Type');
  const dateVal = pickTooltip(node, 'date', 'Date', 'Relationship Date', 'Action Date', 'Process Date', 'Disb Date');
  const descVal = pickTooltip(node, 'description', 'text', 'desc', 'summary', 'Relationship Summary', 'Summary');

  let relatedCount = 0;
  if (graphData?.links && graphData?.nodes) {
    const nodeId = node.id;
    const connectedNodeIds = new Set();
    graphData.links.forEach(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      const targetId = link.target?.id || link.targetId || link.target;
      if (sourceId === nodeId) connectedNodeIds.add(targetId);
      if (targetId === nodeId) connectedNodeIds.add(sourceId);
    });
    relatedCount = connectedNodeIds.size;
  }
  if (relatedCount === 0) {
    relatedCount = node.degree || node.related_count || node.count || 0;
  }

  return (
    <div
      className="flex flex-row rounded-[10px] relative"
      style={{
        width: '520px',
        minHeight: '140px',
        padding: '12px 15px',
        background: '#1a1a1a',
        border: '2px solid #1F1F22',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="absolute left-3 top-3 bottom-3 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 ml-5 min-w-0 flex flex-col overflow-hidden">
        <h3 className="text-white text-xl font-bold mb-2 leading-tight truncate">
          {name}
        </h3>
        {typeVal && (
          <div className="flex flex-wrap gap-x-2 text-sm mb-1.5">
            <span className="text-[#707070] shrink-0">Type:</span>
            <span className="text-[#B4B4B4]" style={{ color }}>{typeVal}</span>
          </div>
        )}
        {dateVal && (
          <div className="flex flex-wrap gap-x-2 text-sm mb-1.5">
            <span className="text-[#707070] shrink-0">Date:</span>
            <span className="text-[#B4B4B4]">{dateVal}</span>
          </div>
        )}
        {descVal && (
          <div className="flex gap-x-2 text-sm">
            <span className="text-[#707070] shrink-0">Description:</span>
            <p className="text-[#B4B4B4] mb-0">{descVal}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Relationship-specific layout: use connector metadata (name, type, category, date, description, process, purpose, quality)
const RelationshipTooltipLayout = ({ node, color, graphData }) => {
  return <ConnectorTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Action-specific layout: use connector metadata (name, type, category, date, description, process, purpose, quality)
const ActionTooltipLayout = ({ node, color, graphData }) => {
  return <ConnectorTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Exchange-specific layout: use connector metadata
const ExchangeTooltipLayout = ({ node, color, graphData }) => {
  return <ConnectorTooltipLayout node={node} color={color} graphData={graphData} />;
};

// Legacy Action layout (Source → ProcessName → Target) - kept for reference, unused
const _ActionTooltipLayoutLegacy = ({ node, color, graphData }) => {
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
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Process Name (highlighted in orange) */}
          <span className="text-xl font-bold flex-shrink-0" style={{ color }}>
            {processName}
          </span>

          {/* Arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#EF4444] flex-shrink-0">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
const WIKIDATA_LAYOUT_TYPES = ['entity', 'person', 'concept', 'data', 'entity_gen'];

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
  if (type.includes('exchange')) return ExchangeTooltipLayout;
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

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
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

