import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { getNodeTypeColor } from '../../utils/colorUtils';
import { StringConstants } from '../StringConstants';
import Loader from './Loader';

const getColorAt33Percent = (hexColor) => {
  const hex = String(hexColor).replace('#', '');
  if (hex.length !== 6) return hexColor;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const toHex = (n) => { const h = Math.max(0, Math.min(255, n)).toString(16); return h.length === 1 ? '0' + h : h; };
  return `#${toHex(Math.round(r * 0.33))}${toHex(Math.round(g * 0.33))}${toHex(Math.round(b * 0.33))}`;
};

const getNodeTypeDisplayName = (node) => {
  const t = String(node?.node_type ?? node?.type ?? 'entity').toLowerCase().trim();
  if (t === 'action') return StringConstants.MAP_VIEW_NODE_TYPES.ACTION;
  if (t === 'entity') return StringConstants.MAP_VIEW_NODE_TYPES.ENTITY;
  if (t === 'country') return StringConstants.MAP_VIEW_NODE_TYPES.COUNTRY;
  if (t === 'relationship') return StringConstants.MAP_VIEW_NODE_TYPES.RELATIONSHIP;
  return node?.node_type ?? node?.type ?? 'entity';
};

const GraphViewByMap = forwardRef(({ mapView = 'flat', graphData = { nodes: [], links: [] }, currentSectionId = null, currentSection = null }, ref) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [worldData, setWorldData] = useState(null);
  const [highlightedCountries, setHighlightedCountries] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState(null);

  useImperativeHandle(ref, () => ({
    getSessionState: () => ({ selectedCountryId }),
    restoreSession: (session) => {
      if (session?.selectedCountryId !== undefined) setSelectedCountryId(session.selectedCountryId);
    },
  }), [selectedCountryId]);
  const [selectedCountryPosition, setSelectedCountryPosition] = useState(null);
  const [selectedCountryName, setSelectedCountryName] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [graphTooltip, setGraphTooltip] = useState(null); // Tooltip for graph nodes/edges
  const [countryGraphData, setCountryGraphData] = useState({ nodes: [], links: [] });
  const [loadingCountryData, setLoadingCountryData] = useState(false);
  const [showRelatedPanel, setShowRelatedPanel] = useState(false);
  const graphSvgRef = useRef(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);
  const bounceAnimationsRef = useRef(new Map());
  const isRotationPausedRef = useRef(false);
  const countryDataMap = useRef(new Map());
  const prevSectionIdRef = useRef(undefined);
  const graphSimulationRef = useRef(null);

  // On section/section change (Map view): clear map, show loading; new map appears when data is loaded
  useEffect(() => {
    if (prevSectionIdRef.current !== undefined && prevSectionIdRef.current !== currentSectionId) {
      setLoadingCountryData(true);
      setSelectedCountryId(null);
      setSelectedCountryPosition(null);
      setSelectedCountryName(null);
      setCountryGraphData({ nodes: [], links: [] });
      setShowRelatedPanel(false);
      setHighlightedCountries([]);
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
      if (graphSvgRef.current) {
        d3.select(graphSvgRef.current).selectAll('*').remove();
      }
    }
    prevSectionIdRef.current = currentSectionId;
  }, [currentSectionId]);

  // Helper function to get consistent country ID
  const getCountryId = (feature, index) => {
    if (feature.id !== undefined && feature.id !== null) {
      return String(feature.id);
    }
    if (feature.properties?.NAME) {
      return String(feature.properties.NAME);
    }
    if (feature.properties?.name) {
      return String(feature.properties.name);
    }
    return String(index);
  };

  // Load world map data
  useEffect(() => {
    const loadWorldMap = async () => {
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topoData = await response.json();
        const countriesTopo = topoData.objects.countries;
        const geojson = topojson.feature(topoData, countriesTopo);
        setWorldData(geojson);
      } catch (error) {
        console.error('Error loading world map data:', error);
        try {
          const response = await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
          const geojson = await response.json();
          setWorldData(geojson);
        } catch (fallbackError) {
          console.error('Error loading fallback world map data:', fallbackError);
          setWorldData(null);
        }
      }
    };

    loadWorldMap();
  }, []);

  // Extract countries from graphData and match them to map country IDs; turn off map loading when data is ready
  useEffect(() => {
    if (!worldData || !worldData.features || !graphData || !graphData.nodes) {
      setHighlightedCountries([]);
      setLoadingCountryData(false);
      return;
    }

    // Make case-insensitive check for country nodes
    const countryNodes = graphData.nodes.filter(node => {
      const nodeType = node.node_type || node.type;
      return nodeType && String(nodeType).toLowerCase() === 'country';
    });

    if (countryNodes.length === 0) {
      setHighlightedCountries([]);
      setLoadingCountryData(false);
      return;
    }

    const countryNames = countryNodes
      .map(node => node.country_name || node.name || node['Country Name'])
      .filter(name => name && name.trim() !== '');

    if (countryNames.length === 0) {
      setHighlightedCountries([]);
      setLoadingCountryData(false);
      return;
    }

    const normalizeCountryName = (name) => {
      if (!name) return '';
      return String(name)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
    };

    const matchedCountryIds = [];
    
    worldData.features.forEach((feature, index) => {
      const featureId = getCountryId(feature, index);
      const mapCountryName = feature.properties?.NAME || feature.properties?.name || '';
      const normalizedMapName = normalizeCountryName(mapCountryName);

      for (const countryName of countryNames) {
        const normalizedGraphName = normalizeCountryName(countryName);
        
        if (normalizedGraphName === normalizedMapName) {
          matchedCountryIds.push(featureId);
          return;
        }
        
        if (normalizedGraphName && normalizedMapName && 
            (normalizedGraphName.includes(normalizedMapName) || 
             normalizedMapName.includes(normalizedGraphName))) {
          matchedCountryIds.push(featureId);
          return;
        }
      }
    });

    const uniqueMatchedIds = [...new Set(matchedCountryIds)];
    setHighlightedCountries(uniqueMatchedIds);
    setLoadingCountryData(false);
  }, [worldData, graphData]);

  // Create a map of country names to country node data
  useEffect(() => {
    if (!graphData || !graphData.nodes) {
      countryDataMap.current.clear();
      return;
    }

    // Make case-insensitive check for country nodes
    const countryNodes = graphData.nodes.filter(node => {
      const nodeType = node.node_type || node.type;
      return nodeType && String(nodeType).toLowerCase() === 'country';
    });

    countryDataMap.current.clear();
    countryNodes.forEach(node => {
      const countryName = node.country_name || node.name || node['Country Name'];
      if (countryName) {
        const normalizedName = String(countryName).toLowerCase().trim();
        if (!countryDataMap.current.has(normalizedName)) {
          countryDataMap.current.set(normalizedName, node);
        }
      }
    });
  }, [graphData]);

  // Build country subgraph from current section graphData (nodes + links within 2 hops of country node)
  const buildCountrySubgraphFromSection = (sectionGraphData, countryName) => {
    if (!sectionGraphData?.nodes?.length || !countryName) return { nodes: [], links: [] };
    const normalize = (name) => (name ?? '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
    const targetNorm = normalize(countryName);
    const countryNode = sectionGraphData.nodes.find(node => {
      const nodeType = node.node_type || node.type;
      if (!nodeType || String(nodeType).toLowerCase() !== 'country') return false;
      const n = normalize(node.country_name || node.name || node['Country Name'] || '');
      return n === targetNorm || targetNorm.includes(n) || n.includes(targetNorm);
    });
    if (!countryNode) return { nodes: [], links: [] };
    const nodeIds = new Set([String(countryNode.id ?? countryNode.gid)]);
    const links = sectionGraphData.links || [];
    for (let hop = 0; hop < 2; hop++) {
      links.forEach(link => {
        const src = link.sourceId ?? link.source ?? link.from_gid;
        const tgt = link.targetId ?? link.target ?? link.to_gid;
        const srcId = typeof src === 'object' ? (src?.id ?? src?.gid) : src;
        const tgtId = typeof tgt === 'object' ? (tgt?.id ?? tgt?.gid) : tgt;
        if (nodeIds.has(String(srcId))) nodeIds.add(String(tgtId));
        if (nodeIds.has(String(tgtId))) nodeIds.add(String(srcId));
      });
    }
    const subNodes = sectionGraphData.nodes.filter(n => nodeIds.has(String(n.id ?? n.gid)));
    const subLinks = links.filter(link => {
      const src = link.sourceId ?? link.source ?? link.from_gid;
      const tgt = link.targetId ?? link.target ?? link.to_gid;
      const srcId = typeof src === 'object' ? (src?.id ?? src?.gid) : src;
      const tgtId = typeof tgt === 'object' ? (tgt?.id ?? tgt?.gid) : tgt;
      return nodeIds.has(String(srcId)) && nodeIds.has(String(tgtId));
    });
    return { nodes: subNodes, links: subLinks };
  };

  // Update container dimensions and calculate map dimensions (throttled via rAF)
  useEffect(() => {
    let rafId = null;
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setContainerDimensions({ width: rect.width, height: rect.height });
      const mapWidth = (7 / 4) * rect.width;
      const mapHeight = (1 / 3) * rect.width;
      setMapDimensions({ width: mapWidth, height: mapHeight });
    };
    const scheduleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateDimensions();
      });
    };
    updateDimensions();
    window.addEventListener('resize', scheduleResize);
    return () => {
      window.removeEventListener('resize', scheduleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Render map (DOM updates batched in rAF)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || mapDimensions.width === 0 || !worldData || !worldData.features) return;

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const width = mapDimensions.width;
    const height = mapDimensions.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const resolvedView = mapView === 'hemisphere' ? 'spherical' : mapView;

    let projection;
    let path;

    if (resolvedView === 'flat') {
      projection = d3.geoMercator();
      
      const featuresWithoutAntarctica = worldData.features.filter(feature => {
        const featureName = (feature.properties?.NAME || feature.properties?.name || '').toLowerCase();
        return !featureName.includes('antarctica') && !featureName.includes('antarctic');
      });
      
      const filteredGeoJson = {
        type: 'FeatureCollection',
        features: featuresWithoutAntarctica
      };
      
      projection.fitSize([width - 40, height - 40], filteredGeoJson);
      path = d3.geoPath().projection(projection);
    } else if (resolvedView === 'spherical') {
      const radius = Math.min(width, height) / 2 - 20;
      projection = d3.geoOrthographic()
        .scale(radius)
        .translate([centerX, centerY])
        .clipAngle(180)
        .rotate([rotationRef.current.y, -rotationRef.current.x]);
      path = d3.geoPath().projection(projection);
    }

    // Background click handler
    const backgroundRect = svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'all')
      .style('cursor', 'default')
      .lower();
    
    backgroundRect.on('click', function(event) {
      if (selectedCountryId) {
        setSelectedCountryId(null);
        setSelectedCountryPosition(null);
        setSelectedCountryName(null);
        setCountryGraphData({ nodes: [], links: [] });
        setShowRelatedPanel(false);
        isRotationPausedRef.current = false;
        svg.selectAll('.countries path').attr('stroke', '#525978');
      }
    });

    // Ocean fill for spherical view
    if (resolvedView === 'spherical') {
      svg.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', Math.min(width, height) / 2 - 20)
        .attr('fill', '#0b172a')
        .attr('stroke', '#0b172a')
        .attr('opacity', 1)
        .lower();
    }

    // Draw countries
    const countriesGroup = svg.append('g').attr('class', 'countries');
    const dotsGroup = svg.append('g').attr('class', 'highlight-dots');

    if (worldData.features) {
      const normalizedHighlighted = highlightedCountries.map(h => String(h));
      
      worldData.features.forEach((feature, index) => {
        if (resolvedView === 'flat') {
          const featureName = (feature.properties?.NAME || feature.properties?.name || '').toLowerCase();
          if (featureName.includes('antarctica') || featureName.includes('antarctic')) {
            return;
          }
        }
        
        const featureId = getCountryId(feature, index);
        const isHighlighted = normalizedHighlighted.includes(featureId);
        
        const countryPath = countriesGroup.append('path')
          .datum(feature)
          .attr('d', path)
          .attr('fill', '#273145')
          .attr('stroke', selectedCountryId === featureId && isHighlighted ? '#0C8CE9' : '#525978')
          .attr('stroke-width', isHighlighted ? 1.5 : 0.5)
          .attr('opacity', 1)
          .style('cursor', isHighlighted ? 'pointer' : 'default')
          .on('mouseenter', function(event) {
            if (!selectedCountryId || selectedCountryId !== featureId) {
              d3.select(this).attr('stroke', '#0C8CE9');
            }
            
            if (isHighlighted) {
              const countryName = feature.properties?.NAME || feature.properties?.name || '';
              const normalizedName = String(countryName).toLowerCase().trim();
              
              let countryInfo = null;
              for (const [key, value] of countryDataMap.current.entries()) {
                if (normalizedName === key || 
                    normalizedName.includes(key) || 
                    key.includes(normalizedName)) {
                  countryInfo = value;
                  break;
                }
              }
              
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (containerRect) {
                setTooltipData({
                  countryName: countryName,
                  countryInfo: countryInfo,
                  position: {
                    x: event.clientX,
                    y: event.clientY
                  }
                });
              }
            }
          })
          .on('mouseleave', function() {
            if (!selectedCountryId || selectedCountryId !== featureId) {
              d3.select(this).attr('stroke', '#525978');
            }
            setTooltipData(null);
          })
          .on('mousemove', function(event) {
            if (isHighlighted) {
              setTooltipData(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  position: {
                    x: event.clientX,
                    y: event.clientY
                  }
                };
              });
            }
          })
          .on('click', async function(event) {
            event.stopPropagation();
            if (isHighlighted) {
              const centroid = path.centroid(feature);
              const containerRect = containerRef.current?.getBoundingClientRect();
              const mapCountryName = feature.properties?.NAME || feature.properties?.name || '';
              
              const normalizeCountryName = (name) => {
                if (!name) return '';
                return String(name)
                  .toLowerCase()
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/[^\w\s]/g, '');
              };
              
              const normalizedMapName = normalizeCountryName(mapCountryName);
              const countryNode = graphData.nodes.find(node => {
                // Make case-insensitive check for country nodes
                const nodeType = node.node_type || node.type;
                if (!nodeType || String(nodeType).toLowerCase() !== 'country') return false;
                const nodeCountryName = node.country_name || node.name || node['Country Name'] || '';
                const normalizedNodeName = normalizeCountryName(nodeCountryName);
                return normalizedNodeName === normalizedMapName || 
                       normalizedMapName.includes(normalizedNodeName) ||
                       normalizedNodeName.includes(normalizedMapName);
              });
              
              const countryName = countryNode ? (countryNode.country_name || countryNode.name || countryNode['Country Name'] || mapCountryName) : mapCountryName;
              
              if (selectedCountryId === featureId) {
                // Clicking the same country - deselect and clear graph
                setSelectedCountryId(null);
                setSelectedCountryPosition(null);
                setSelectedCountryName(null);
                setCountryGraphData({ nodes: [], links: [] });
                setShowRelatedPanel(false);
                isRotationPausedRef.current = false;
                d3.select(this).attr('stroke', '#525978');
              } else {
                // Clicking a different highlighted country - select and show graph from current section only
                setSelectedCountryId(featureId);
                setSelectedCountryName(countryName);
                isRotationPausedRef.current = true;

                if (centroid && svgRef.current && containerRef.current) {
                  const mapSvgRect = svgRef.current.getBoundingClientRect();
                  const containerRect = containerRef.current.getBoundingClientRect();
                  setSelectedCountryPosition({
                    x: centroid[0] + mapSvgRect.left - containerRect.left,
                    y: centroid[1] + mapSvgRect.top - containerRect.top
                  });
                }

                const subgraph = buildCountrySubgraphFromSection(graphData, countryName);
                setCountryGraphData(subgraph);
                
                const svgSelection = d3.select(svgRef.current);
                svgSelection.selectAll('.countries path').each(function(d) {
                  const pathFeature = d;
                  const pathIndex = worldData.features.indexOf(pathFeature);
                  const pathFeatureId = getCountryId(pathFeature, pathIndex);
                  if (pathFeatureId === featureId) {
                    d3.select(this).attr('stroke', '#0C8CE9');
                  } else {
                    d3.select(this).attr('stroke', '#525978');
                  }
                });
              }
            }
          });

        // Draw highlight dots
        if (isHighlighted) {
          const centroid = path.centroid(feature);
          if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
            const gradientId = `dot-gradient-${index}`;
            const gradient = svg.append('defs')
              .append('radialGradient')
              .attr('id', gradientId)
              .attr('cx', '50%')
              .attr('cy', '50%')
              .attr('r', '50%');
            
            gradient.append('stop')
              .attr('offset', '0%')
              .attr('stop-color', '#FFFFFF')
              .attr('stop-opacity', 0.8);
            
            gradient.append('stop')
              .attr('offset', '50%')
              .attr('stop-color', '#D9D9D9')
              .attr('stop-opacity', 1);
            
            gradient.append('stop')
              .attr('offset', '100%')
              .attr('stop-color', '#D9D9D9')
              .attr('stop-opacity', 0.6);

            const dot = dotsGroup.append('circle')
              .attr('cx', centroid[0])
              .attr('cy', centroid[1])
              .attr('r', 2)
              .attr('fill', `url(#${gradientId})`)
              .attr('stroke', '#D9D9D9')
              .attr('stroke-width', 1)
              .attr('opacity', 0.9)
              .attr('class', `highlight-dot-${featureId}`);

            const animatePulse = () => {
              dot
                .transition('pulse')
                .duration(600)
                .ease(d3.easeQuadInOut)
                .attr('r', 3.4)
                .transition('pulse')
                .duration(600)
                .ease(d3.easeQuadInOut)
                .attr('r', 2.4)
                .transition('pulse')
                .duration(600)
                .ease(d3.easeQuadInOut)
                .attr('r', 3.1)
                .transition('pulse')
                .duration(600)
                .ease(d3.easeQuadInOut)
                .attr('r', 2.0)
                .on('end', animatePulse);
            };
            
            bounceAnimationsRef.current.set(featureId, animatePulse);
            
            setTimeout(() => {
              animatePulse();
            }, index * 150);
          }
        }
      });
    }

    // Sphere outline for spherical view
    if (resolvedView === 'spherical') {
      svg.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', Math.min(width, height) / 2 - 20)
        .attr('fill', 'none')
        .attr('stroke', '#555555')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);
    }

    // Keep selected dot position in sync with container (so line stays attached on resize)
    if (selectedCountryId && worldData.features && containerRef.current && svgRef.current) {
      for (let i = 0; i < worldData.features.length; i++) {
        const feature = worldData.features[i];
        if (resolvedView === 'flat') {
          const featureName = (feature.properties?.NAME || feature.properties?.name || '').toLowerCase();
          if (featureName.includes('antarctica') || featureName.includes('antarctic')) continue;
        }
        const featureId = getCountryId(feature, i);
        if (featureId === selectedCountryId) {
          const centroid = path.centroid(feature);
          if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
            const mapSvgRect = svgRef.current.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            setSelectedCountryPosition({
              x: centroid[0] + mapSvgRect.left - containerRect.left,
              y: centroid[1] + mapSvgRect.top - containerRect.top
            });
          }
          break;
        }
      }
    }

    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [mapView, worldData, mapDimensions, highlightedCountries, selectedCountryId, graphData, currentSection, currentSectionId, containerDimensions]);

  // Render graph in remaining space (excluding map) when country is selected (DOM updates batched in rAF)
  useEffect(() => {
    if (!graphSvgRef.current || !containerRef.current || containerDimensions.width === 0 || !countryGraphData || !countryGraphData.nodes || countryGraphData.nodes.length === 0) {
      if (graphSvgRef.current) {
        d3.select(graphSvgRef.current).selectAll('*').remove();
      }
      graphSimulationRef.current = null;
      return;
    }

    let cancelled = false;
    let simulation = null;
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !graphSvgRef.current) return;
      const svg = d3.select(graphSvgRef.current);
      svg.selectAll('*').remove();

      const width = containerDimensions.width;
    const height = containerDimensions.height;

    // Only show country, action, entity (no relationship or other types)
    const ALLOWED_CARD_TYPES = new Set(['country', 'action', 'entity']);
    const displayNodes = countryGraphData.nodes.filter(n => {
      const t = String(n.node_type || n.type || '').toLowerCase().trim();
      return ALLOWED_CARD_TYPES.has(t);
    });
    if (displayNodes.length === 0) {
      const svgEl = d3.select(graphSvgRef.current);
      if (!svgEl.empty()) svgEl.selectAll('*').remove();
      return;
    }
    const displayNodeIds = new Set(displayNodes.map(n => String(n.id ?? n.gid)));
    const displayLinks = (countryGraphData.links || []).filter(link => {
      const src = link.sourceId ?? link.source ?? link.from_gid;
      const tgt = link.targetId ?? link.target ?? link.to_gid;
      const srcId = typeof src === 'object' ? (src?.id ?? src?.gid) : src;
      const tgtId = typeof tgt === 'object' ? (tgt?.id ?? tgt?.gid) : tgt;
      return displayNodeIds.has(String(srcId)) && displayNodeIds.has(String(tgtId));
    });

    // Process links to ensure source and target are node objects (from displayNodes only)
    const processedLinks = displayLinks.map(link => {
      const sourceNode = displayNodes.find(n =>
        n.id === link.sourceId || n.id === link.source || n.gid === link.from_gid ||
        (typeof link.source === 'string' && n.id === link.source) ||
        (typeof link.source === 'object' && link.source?.id != null && n.id === link.source.id)
      );
      const targetNode = displayNodes.find(n =>
        n.id === link.targetId || n.id === link.target || n.gid === link.to_gid ||
        (typeof link.target === 'string' && n.id === link.target) ||
        (typeof link.target === 'object' && link.target?.id != null && n.id === link.target.id)
      );
      return { ...link, source: sourceNode || link.source, target: targetNode || link.target };
    }).filter(link => {
      const hasValidSource = link.source && (typeof link.source === 'object' || typeof link.source === 'string');
      const hasValidTarget = link.target && (typeof link.target === 'object' || typeof link.target === 'string');
      return hasValidSource && hasValidTarget;
    });

    // Find the country node that will be the center of the hierarchy
    const normalizeCountryName = (name) => {
      if (!name) return '';
      return String(name)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
    };

    const selectedCountryNormalized = normalizeCountryName(selectedCountryName);
    const matchingCountryNode = displayNodes.find(node => {
      const nodeType = node.node_type || node.type;
      if (!nodeType || String(nodeType).toLowerCase() !== 'country') return false;
      const nodeCountryName = node.country_name || node.name || node['Country Name'] || '';
      const normalizedNodeName = normalizeCountryName(nodeCountryName);
      return normalizedNodeName === selectedCountryNormalized ||
             selectedCountryNormalized.includes(normalizedNodeName) ||
             normalizedNodeName.includes(selectedCountryNormalized);
    });

    // Card layout: smaller cards, flexible placement (top/bottom/left/right wherever fits)
    const CARD_WIDTH = 132;
    const CARD_HEIGHT = 36;
    const ROW_GAP = 14;
    const COL_GAP = 14;
    const MAIN_PADDING = 20;

    const mapOffsetX = (width - mapDimensions.width) / 2;
    const mapOffsetY = (height - mapDimensions.height) / 2;
    const mapLeft = mapOffsetX;
    const mapTop = mapOffsetY;
    const mapRight = mapOffsetX + mapDimensions.width;
    const mapBottom = mapOffsetY + mapDimensions.height;
    const MAP_MARGIN = 16;
    // Compute dot position in container coords so line stays connected (avoids async state mismatch)
    let dotX = selectedCountryPosition?.x != null ? selectedCountryPosition.x : width / 2;
    let dotY = selectedCountryPosition?.y != null ? selectedCountryPosition.y : height / 2;
    if (selectedCountryId && worldData?.features && mapDimensions.width > 0 && mapView === 'flat') {
      const mapW = mapDimensions.width;
      const mapH = mapDimensions.height;
      const featuresWithoutAntarctica = worldData.features.filter(f => {
        const name = (f.properties?.NAME || f.properties?.name || '').toLowerCase();
        return !name.includes('antarctica') && !name.includes('antarctic');
      });
      const filteredGeoJson = { type: 'FeatureCollection', features: featuresWithoutAntarctica };
      const proj = d3.geoMercator().fitSize([mapW - 40, mapH - 40], filteredGeoJson);
      const path = d3.geoPath().projection(proj);
      for (let i = 0; i < worldData.features.length; i++) {
        const feature = worldData.features[i];
        if (getCountryId(feature, i) === selectedCountryId) {
          const centroid = path.centroid(feature);
          if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
            dotX = mapOffsetX + centroid[0];
            dotY = mapOffsetY + centroid[1];
          }
          break;
        }
      }
    }

    const countryId = matchingCountryNode ? String(matchingCountryNode.id ?? matchingCountryNode.gid) : null;
    const actionNodes = displayNodes.filter(n => {
      if (!countryId) return false;
      const t = String(n.node_type || n.type || '').toLowerCase();
      return t === 'action' && processedLinks.some(link => {
        const a = String(link.source?.id ?? link.source?.gid ?? link.source);
        const b = String(link.target?.id ?? link.target?.gid ?? link.target);
        return (a === countryId || b === countryId) && (a === String(n.id ?? n.gid) || b === String(n.id ?? n.gid));
      });
    });
    const entityNodes = displayNodes.filter(n => {
      const t = String(n.node_type || n.type || '').toLowerCase().trim();
      if (t === 'entity') {
        const nid = String(n.id ?? n.gid);
        return processedLinks.some(link => {
          const a = String(link.source?.id ?? link.source?.gid ?? link.source);
          const b = String(link.target?.id ?? link.target?.gid ?? link.target);
          return (a === nid || b === nid) && actionNodes.some(act => String(act.id ?? act.gid) === a || String(act.id ?? act.gid) === b);
        });
      }
      return false;
    });
    // Country always at bottom; entity + action in the rest of the screen (can be anywhere including on the map). No overlap.
    const BAND_GAP = 16;
    const countryBandTop = mapBottom + MAP_MARGIN;
    const countryBandH = Math.max(40, height - MAIN_PADDING - countryBandTop);
    const countryBandCenterY = countryBandTop + countryBandH / 2;
    const areaForOtherTop = MAIN_PADDING;
    const areaForOtherBottom = countryBandTop - BAND_GAP;
    const availableHeightForOther = Math.max(0, areaForOtherBottom - areaForOtherTop);
    const totalGaps = 2 * BAND_GAP;
    const remainderAbove = Math.max(0, availableHeightForOther - totalGaps);
    const minBand = 20;
    const entityBandH = Math.max(minBand, Math.min(Math.floor(remainderAbove * 0.4), remainderAbove - minBand));
    const actionBandH = Math.max(minBand, remainderAbove - entityBandH - totalGaps);
    const entityBandTop = areaForOtherTop;
    const actionBandTop = entityBandTop + entityBandH + BAND_GAP;
    const actionBandCenterY = actionBandTop + actionBandH / 2;
    const entityBandCenterY = entityBandTop + entityBandH / 2;

    const halfW = 110;
    const halfH = 32;
    const contentMinX = MAIN_PADDING + halfW;
    const contentMaxX = width - MAIN_PADDING - halfW;
    const screenCenterX = width / 2;
    const placeThreshold = 0.2 * width;
    const centerX = (() => {
      if (dotX < screenCenterX - placeThreshold) return (dotX + contentMaxX) / 2;
      if (dotX > screenCenterX + placeThreshold) return (contentMinX + dotX) / 2;
      return dotX < screenCenterX ? (dotX + contentMaxX) / 2 : (contentMinX + dotX) / 2;
    })();
    const nodesCenterX = Math.max(contentMinX, Math.min(contentMaxX, centerX));
    const jitter = (i, seed) => ((i * 7 + seed) % 17) - 8;
    const contentMinYTop = areaForOtherTop + halfH;
    const contentMaxYTop = areaForOtherBottom - halfH;
    const contentMinYCountry = countryBandTop + halfH;
    const contentMaxYCountry = height - MAIN_PADDING - halfH;

    if (matchingCountryNode) {
      matchingCountryNode.x = nodesCenterX;
      matchingCountryNode.y = countryBandCenterY;
      matchingCountryNode.fx = matchingCountryNode.x;
      matchingCountryNode.fy = matchingCountryNode.y;
    }

    const ACTION_ROWS = 2;
    const ENTITY_ROWS = 3;
    actionNodes.forEach((node, i) => {
      const n = actionNodes.length;
      const rows = Math.min(ACTION_ROWS, n);
      const cols = Math.max(1, Math.ceil(n / rows));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const stepX = cols <= 1 ? 0 : Math.max(80, (width - MAIN_PADDING * 2 - 80) / (cols - 1));
      const stepY = 40;
      const baseX = nodesCenterX + (col - (cols - 1) / 2) * stepX + jitter(i, 1);
      const baseY = actionBandCenterY + (row - (rows - 1) / 2) * stepY + jitter(i, 3);
      node.x = Math.max(contentMinX, Math.min(contentMaxX, baseX));
      node.y = Math.max(contentMinYTop, Math.min(contentMaxYTop, actionBandTop + actionBandH - 20, baseY));
      node.fx = node.x;
      node.fy = node.y;
    });

    entityNodes.forEach((node, i) => {
      const n = entityNodes.length;
      const rows = Math.min(ENTITY_ROWS, n);
      const cols = Math.max(1, Math.ceil(n / rows));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const stepX = cols <= 1 ? 0 : Math.max(80, (width - MAIN_PADDING * 2 - 80) / (cols - 1));
      const stepY = 38;
      const baseX = nodesCenterX + (col - (cols - 1) / 2) * stepX + jitter(i, 5);
      const baseY = entityBandCenterY + (row - (rows - 1) / 2) * stepY + jitter(i, 7);
      node.x = Math.max(contentMinX, Math.min(contentMaxX, baseX));
      node.y = Math.max(contentMinYTop, Math.min(contentMaxYTop, entityBandTop + entityBandH - 16, baseY));
      node.fx = node.x;
      node.fy = node.y;
    });

    const getBbox = () => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      displayNodes.forEach(n => {
        if (n.x != null && n.y != null) {
          minX = Math.min(minX, n.x - halfW);
          maxX = Math.max(maxX, n.x + halfW);
          minY = Math.min(minY, n.y - halfH);
          maxY = Math.max(maxY, n.y + halfH);
        }
      });
      return { minX, maxX, minY, maxY };
    };

    // Collision resolution: ensure minimum clearance so no node overlaps another
    const MIN_CENTER_DIST = 150;
    const isCountryNode = (n) => countryId != null && (String(n.id ?? n.gid) === countryId);
    const isEntity = (n) => entityNodes.includes(n);
    const isAction = (n) => actionNodes.includes(n);
    const sameBand = (a, b) => (isEntity(a) && isEntity(b)) || (isAction(a) && isAction(b));
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let i = 0; i < displayNodes.length; i++) {
        for (let j = i + 1; j < displayNodes.length; j++) {
          const a = displayNodes[i];
          const b = displayNodes[j];
          if (a.x == null || a.y == null || b.x == null || b.y == null) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < MIN_CENTER_DIST && d > 0.01) {
            const fixA = isCountryNode(a);
            const fixB = isCountryNode(b);
            if (sameBand(a, b)) {
              const targetMinDx = MIN_CENTER_DIST;
              const newDx = Math.abs(dx) < targetMinDx ? (dx >= 0 ? targetMinDx : -targetMinDx) : dx;
              const sepX = newDx - dx;
              const moveA = fixA ? 0 : -sepX / 2;
              const moveB = fixB ? 0 : sepX / 2;
              if (!fixA) {
                a.x += moveA;
                a.fx = a.x;
              }
              if (!fixB) {
                b.x += moveB;
                b.fx = b.x;
              }
            } else {
              const overlap = MIN_CENTER_DIST - d;
              const ux = dx / d;
              const uy = dy / d;
              if (fixA && !fixB) {
                b.x += ux * overlap;
                b.y += uy * overlap;
                b.fx = b.x;
                b.fy = b.y;
              } else if (!fixA && fixB) {
                a.x -= ux * overlap;
                a.y -= uy * overlap;
                a.fx = a.x;
                a.fy = a.y;
              } else {
                a.x -= ux * (overlap / 2);
                a.y -= uy * (overlap / 2);
                a.fx = a.x;
                a.fy = a.y;
                b.x += ux * (overlap / 2);
                b.y += uy * (overlap / 2);
                b.fx = b.x;
                b.fy = b.y;
              }
            }
            moved = true;
          }
        }
      }
      // Clamp all nodes to content bounds (no overflow, stay within main area)
      if (matchingCountryNode && matchingCountryNode.x != null) {
        matchingCountryNode.x = Math.max(contentMinX, Math.min(contentMaxX, matchingCountryNode.x));
        matchingCountryNode.y = Math.max(contentMinYCountry, Math.min(contentMaxYCountry, matchingCountryNode.y));
        matchingCountryNode.fx = matchingCountryNode.x;
        matchingCountryNode.fy = matchingCountryNode.y;
      }
      actionNodes.forEach(n => {
        if (n.x != null && n.y != null) {
          n.x = Math.max(contentMinX, Math.min(contentMaxX, n.x));
          n.y = Math.max(contentMinYTop, Math.min(contentMaxYTop, n.y));
          n.fx = n.x;
          n.fy = n.y;
        }
      });
      entityNodes.forEach(n => {
        if (n.x != null && n.y != null) {
          n.x = Math.max(contentMinX, Math.min(contentMaxX, n.x));
          n.y = Math.max(contentMinYTop, Math.min(contentMaxYTop, n.y));
          n.fx = n.x;
          n.fy = n.y;
        }
      });
      if (!moved) break;
    }

    // Final clamp so no node can be off-screen (no shift; nodes already in bands)
    displayNodes.forEach(n => {
      if (n.x == null || n.y == null) return;
      const isCountry = matchingCountryNode && (String(n.id ?? n.gid) === countryId);
      n.x = Math.max(contentMinX, Math.min(contentMaxX, n.x));
      n.y = isCountry
        ? Math.max(contentMinYCountry, Math.min(contentMaxYCountry, n.y))
        : Math.max(contentMinYTop, Math.min(contentMaxYTop, n.y));
      n.fx = n.x;
      n.fy = n.y;
    });
    const countryCenterXFinal = matchingCountryNode?.x ?? nodesCenterX;
    const countryCenterYFinal = matchingCountryNode?.y ?? countryBandCenterY;
    const countryCardTopY = matchingCountryNode
      ? countryCenterYFinal - (matchingCountryNode.countryCardHalfHeight ?? 18)
      : countryCenterYFinal;

    simulation = d3.forceSimulation(displayNodes)
      .force('link', null)
      .force('charge', null)
      .force('center', null)
      .alpha(0)
      .stop();
    graphSimulationRef.current = simulation;

    const linkContainer = svg.append('g')
      .attr('class', 'graph-links')
      .attr('pointer-events', 'auto');

    // Create links with hover area (invisible wider stroke for easier hovering)
    const link = linkContainer
      .selectAll('g.link-group')
      .data(processedLinks)
      .enter()
      .append('g')
      .attr('class', 'link-group')
      .style('cursor', 'pointer')
      .style('pointer-events', 'auto') // Enable pointer events for links
      .on('mouseenter', function(event, d) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setGraphTooltip({
            type: 'edge',
            data: d,
            position: {
              x: event.clientX,
              y: event.clientY
            }
          });
        }
        // Highlight the link on hover
        d3.select(this).select('line.visible-link')
          .attr('stroke', '#6EA4F4')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 0.8);
      })
      .on('mouseleave', function() {
        setGraphTooltip(null);
        // Restore original link style
        d3.select(this).select('line.visible-link')
          .attr('stroke', '#DBDBDB')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.5);
      })
      .on('mousemove', function(event) {
        setGraphTooltip(prev => {
          if (prev && prev.type === 'edge') {
            return {
              ...prev,
              position: {
                x: event.clientX,
                y: event.clientY
              }
            };
          }
          return prev;
        });
      });

    // Add invisible wider stroke for easier hovering
    link.append('line')
      .attr('class', 'hover-area')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10) // Wide invisible area for easy hovering
      .attr('stroke-opacity', 0);

    // Add visible link line
    link.append('line')
      .attr('class', 'visible-link')
      .attr('stroke', '#DBDBDB')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.5);

    // Country node position is already set by the hierarchical layout above
    // (centered in the graph area with other nodes arranged in circular levels around it)

    // Create nodes (graph-nodes container has pointer-events so clicks register)
    const node = svg.append('g')
      .attr('class', 'graph-nodes')
      .attr('pointer-events', 'auto')
      .selectAll('g')
      .data(displayNodes)
      .enter()
      .append('g')
      .attr('class', d => {
        const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
        return isMatchingCountry ? 'graph-node country-node-selected' : 'graph-node';
      })
      .style('cursor', 'pointer')
      .style('pointer-events', 'auto')
      .on('click', function(event, d) {
        event.stopPropagation();
        const isCountryNode = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
        if (isCountryNode) {
          setShowRelatedPanel(prev => !prev);
        }
      })
      .on('mouseenter', function(event, d) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setGraphTooltip({
            type: 'node',
            data: d,
            position: {
              x: event.clientX,
              y: event.clientY
            }
          });
        }
        const el = d3.select(this);
        if (!el.select('rect').empty()) el.select('rect').attr('stroke', '#6EA4F4').attr('stroke-width', 1.5);
        if (!el.select('circle').empty()) el.select('circle').attr('stroke-width', 2.5);
      })
      .on('mouseleave', function() {
        setGraphTooltip(null);
        const el = d3.select(this);
        if (!el.select('rect').empty()) el.select('rect').attr('stroke', '#525978').attr('stroke-width', 1);
        if (!el.select('circle').empty()) el.select('circle').attr('stroke-width', 2);
      })
      .on('mousemove', function(event) {
        setGraphTooltip(prev => {
          if (prev && prev.type === 'node') {
            return {
              ...prev,
              position: {
                x: event.clientX,
                y: event.clientY
              }
            };
          }
          return prev;
        });
      })
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Country node: full card. Other nodes: rounded pill/badge (text only, like graph view)
    const accentBarW = 3;
    const cardPad = 6;
    const cardRx = 4;
    const cardH = CARD_HEIGHT;

    const getNodeLabel = (d) => d.country_name || d.name || d.entity_name || d['Country Name'] || d.id || d.gid || '—';
    const getNodeTypeLabel = getNodeTypeDisplayName;
    const MAX_CHARS_PER_LINE = 20;
    const wrapTextLines = (str, maxChars = MAX_CHARS_PER_LINE) => {
      if (!str) return [''];
      const s = String(str);
      if (s.length <= maxChars) return [s];
      const lines = [];
      for (let i = 0; i < s.length; i += maxChars) lines.push(s.slice(i, i + maxChars));
      return lines;
    };

    node.each(function(d) {
      const nodeGroup = d3.select(this);
      const nodeTypeLower = String(d.node_type || d.type || '').toLowerCase().trim();
      const isCountry =
        matchingCountryNode &&
        (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid) &&
        nodeTypeLower === 'country';

      if (isCountry) {
        const label = getNodeLabel(d);
        const typeLabel = getNodeTypeLabel(d);
        const labelLines = wrapTextLines(label, MAX_CHARS_PER_LINE);
        const lineHeight = 14;
        const titleBlockH = labelLines.length * lineHeight;
        const cardHActual = Math.max(cardH, cardPad * 2 + titleBlockH + 14);
        d.countryCardHalfHeight = cardHActual / 2;
        const tempSub = nodeGroup.append('text').text(`Type: ${typeLabel}`).attr('font-size', '9px').attr('opacity', 0).attr('visibility', 'hidden');
        let tw = 48;
        labelLines.forEach(line => {
          const t = nodeGroup.append('text').text(line).attr('font-size', '11px').attr('font-weight', 600).attr('opacity', 0).attr('visibility', 'hidden');
          tw = Math.max(tw, t.node().getBBox().width);
          t.remove();
        });
        const sw = tempSub.node().getBBox().width;
        tempSub.remove();
        const cardW = Math.min(220, Math.max(CARD_WIDTH, cardPad + accentBarW + 6 + Math.max(tw, sw) + cardPad));

        nodeGroup.append('rect')
          .attr('x', -cardW / 2)
          .attr('y', -cardHActual / 2)
          .attr('width', cardW)
          .attr('height', cardHActual)
          .attr('rx', cardRx)
          .attr('ry', cardRx)
          .attr('fill', '#273145')
          .attr('stroke', '#525978')
          .attr('stroke-width', 1)
          .attr('pointer-events', 'all');
        const countryAccentBarH = cardHActual * 0.7;
        nodeGroup.append('rect')
          .attr('x', -cardW / 2 + cardPad)
          .attr('y', -cardHActual / 2 + (cardHActual - countryAccentBarH) / 2)
          .attr('width', accentBarW)
          .attr('height', countryAccentBarH)
          .attr('rx', 2)
          .attr('ry', 2)
          .attr('fill', '#FD7E14')
          .attr('pointer-events', 'none');
        const contentBlockH = titleBlockH + 14;
        const countryContentStartY = -cardHActual / 2 + (cardHActual - contentBlockH) / 2;
        const countryText = nodeGroup.append('text')
          .attr('x', -cardW / 2 + cardPad + accentBarW + 6)
          .attr('y', countryContentStartY + 11)
          .attr('font-family', 'Archivo, sans-serif')
          .attr('font-size', '11px')
          .attr('font-weight', 600)
          .attr('fill', '#FFFFFF')
          .attr('pointer-events', 'none');
        labelLines.forEach((line, i) => {
          countryText.append('tspan')
            .attr('x', -cardW / 2 + cardPad + accentBarW + 6)
            .attr('dy', i === 0 ? 0 : lineHeight)
            .text(line);
        });
        nodeGroup.append('text')
          .text(`Type: ${typeLabel}`)
          .attr('x', -cardW / 2 + cardPad + accentBarW + 6)
          .attr('y', countryContentStartY + titleBlockH + 10)
          .attr('font-family', 'Archivo, sans-serif')
          .attr('font-size', '9px')
          .attr('fill', '#9F9FA9')
          .attr('pointer-events', 'none');
      } else {
        // Order Map By style for action/entity: dimmed bg, left color bar, white text; full text with wrap every 20 chars
        const label = getNodeLabel(d);
        const labelLines = wrapTextLines(label, MAX_CHARS_PER_LINE);
        const color = getNodeTypeColor(d.node_type || d.type || 'Entity');
        const bgColor = getColorAt33Percent(color);
        const barW = 4;
        const padH = 6;
        const padV = 6;
        const gap = 4;
        const pillRx = 5;
        const lineHeight = 14;
        let textW = 0;
        labelLines.forEach(line => {
          const t = nodeGroup.append('text').text(line).attr('font-size', '12px').attr('font-weight', 500).attr('font-family', 'Archivo, sans-serif').attr('opacity', 0).attr('visibility', 'hidden');
          textW = Math.max(textW, Math.min(180, t.node().getBBox().width));
          t.remove();
        });
        if (labelLines.length === 0) textW = 40;
        const pillW = padH + barW + gap + textW + padH;
        const pillH = Math.max(20, padV * 2 + labelLines.length * lineHeight);
        const barH = pillH * 0.7;
        nodeGroup.append('rect')
          .attr('x', -pillW / 2)
          .attr('y', -pillH / 2)
          .attr('width', pillW)
          .attr('height', pillH)
          .attr('rx', pillRx)
          .attr('ry', pillRx)
          .attr('fill', bgColor)
          .attr('stroke', '#525978')
          .attr('stroke-width', 1)
          .attr('pointer-events', 'all');
        nodeGroup.append('rect')
          .attr('x', -pillW / 2 + padH)
          .attr('y', -barH / 2)
          .attr('width', barW)
          .attr('height', barH)
          .attr('rx', 2)
          .attr('ry', 2)
          .attr('fill', color)
          .attr('pointer-events', 'none');
        const pillTextBlockH = labelLines.length * lineHeight;
        const pillTextY = labelLines.length <= 1
          ? 0
          : -pillH / 2 + (pillH - pillTextBlockH) / 2 + lineHeight;
        const pillTextX = -pillW / 2 + padH + barW + gap;
        const pillText = nodeGroup.append('text')
          .attr('x', pillTextX)
          .attr('y', pillTextY)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', labelLines.length <= 1 ? 'middle' : 'auto')
          .attr('font-size', '12px')
          .attr('font-weight', 500)
          .attr('fill', '#FFFFFF')
          .attr('font-family', 'Archivo, sans-serif')
          .attr('pointer-events', 'none');
        labelLines.forEach((line, i) => {
          pillText.append('tspan')
            .attr('x', pillTextX)
            .attr('dy', i === 0 ? 0 : lineHeight)
            .text(line);
        });
      }
    });

    // Line from map dot to bottom of country card (stays attached when node is dragged)
    if (matchingCountryNode && selectedCountryId) {
      const lineGroup = svg.append('g').attr('class', 'dot-to-country-line').attr('pointer-events', 'none');
      lineGroup.append('line')
        .attr('x1', dotX)
        .attr('y1', dotY)
        .attr('x2', countryCenterXFinal)
        .attr('y2', countryCardTopY)
        .attr('stroke', '#DBDBDB')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.8);
    }

    // Position nodes and links according to hierarchical layout
    // Since simulation is stopped, manually position everything
    const updatePositions = () => {
      // Update both hover area and visible link lines
      link.selectAll('line')
        .attr('x1', d => {
          const source = typeof d.source === 'object' && d.source !== null ? d.source : 
                        (typeof d.source === 'string' ? displayNodes.find(n => n.id === d.source) : null);
          return source && source.x !== undefined ? source.x : 0;
        })
        .attr('y1', d => {
          const source = typeof d.source === 'object' && d.source !== null ? d.source : 
                        (typeof d.source === 'string' ? displayNodes.find(n => n.id === d.source) : null);
          return source && source.y !== undefined ? source.y : 0;
        })
        .attr('x2', d => {
          const target = typeof d.target === 'object' && d.target !== null ? d.target : 
                        (typeof d.target === 'string' ? displayNodes.find(n => n.id === d.target) : null);
          return target && target.x !== undefined ? target.x : 0;
        })
        .attr('y2', d => {
          const target = typeof d.target === 'object' && d.target !== null ? d.target : 
                        (typeof d.target === 'string' ? displayNodes.find(n => n.id === d.target) : null);
          return target && target.y !== undefined ? target.y : 0;
        });

      node.attr('transform', d => {
        const x = d.x !== undefined && d.x !== null ? d.x : 0;
        const y = d.y !== undefined && d.y !== null ? d.y : 0;
        return `translate(${x},${y})`;
      });

      // Keep dot-to-country line attached to top of country card when node is dragged
      const dotLine = svg.select('.dot-to-country-line line');
      if (!dotLine.empty() && matchingCountryNode && matchingCountryNode.x != null && matchingCountryNode.y != null) {
        const topY = matchingCountryNode.y - (matchingCountryNode.countryCardHalfHeight ?? 18);
        dotLine
          .attr('x2', matchingCountryNode.x)
          .attr('y2', topY);
      }
    };
    
    // Call once to apply hierarchical positioning immediately
    updatePositions();

    function dragstarted(event, d) {
      // No need to restart simulation for hierarchical layout
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      const isCountry = isCountryNode(d);
      const minY = isCountry ? contentMinYCountry : contentMinYTop;
      const maxY = isCountry ? contentMaxYCountry : contentMaxYTop;
      const x = Math.max(contentMinX, Math.min(contentMaxX, event.x));
      const y = Math.max(minY, Math.min(maxY, event.y));
      d.fx = x;
      d.fy = y;
      d.x = x;
      d.y = y;
      updatePositions();
    }

    function dragended(event, d) {
      // Keep node fixed at dragged position in hierarchical layout
      d.fx = d.x;
      d.fy = d.y;
    }

    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (graphSimulationRef.current) {
        graphSimulationRef.current.stop();
        graphSimulationRef.current = null;
      }
    };
  }, [countryGraphData, containerDimensions, selectedCountryName, selectedCountryPosition, selectedCountryId, mapDimensions, worldData, mapView]);

  // Animation loop for rotating spherical maps
  useEffect(() => {
    const resolvedView = mapView === 'hemisphere' ? 'spherical' : mapView;

    if (resolvedView !== 'spherical') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = () => {
      if (!isRotationPausedRef.current) {
        rotationRef.current.y += 0.1;
      }
      
      if (svgRef.current && containerRef.current && mapDimensions.width > 0 && worldData) {
        const svg = d3.select(svgRef.current);
        const width = mapDimensions.width;
        const height = mapDimensions.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 20;

        const projection = d3.geoOrthographic()
          .scale(radius)
          .translate([centerX, centerY])
          .clipAngle(180)
          .rotate([rotationRef.current.y, -rotationRef.current.x]);

        const path = d3.geoPath().projection(projection);

        svg.selectAll('.countries path')
          .attr('d', path);

        if (worldData && worldData.features) {
          const normalizedHighlighted = highlightedCountries.map(h => String(h));
          const containerRect = containerRef.current?.getBoundingClientRect();

          worldData.features.forEach((feature, index) => {
            const featureId = getCountryId(feature, index);
            if (normalizedHighlighted.includes(featureId)) {
              const centroid = path.centroid(feature);
              if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
                const dotSelector = `.highlight-dot-${featureId}`;
                const dot = svg.select(dotSelector);
                if (!dot.empty()) {
                  dot
                    .attr('cx', centroid[0])
                    .attr('cy', centroid[1]);
                  
                  if (selectedCountryId === featureId && svgRef.current && containerRef.current) {
                    const mapSvgRect = svgRef.current.getBoundingClientRect();
                    const containerRect = containerRef.current.getBoundingClientRect();
                    setSelectedCountryPosition({
                      x: centroid[0] + mapSvgRect.left - containerRect.left,
                      y: centroid[1] + mapSvgRect.top - containerRect.top
                    });
                  }
                }
              }
            }
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [mapView, worldData, mapDimensions, highlightedCountries, selectedCountryId]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-[#111111] relative overflow-hidden flex items-center justify-center"
    >
      {!worldData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-[#B4B4B4] flex flex-col items-center gap-4">
            <Loader size={48} />
          </div>
        </div>
      )}
      {/* Map SVG */}
      <svg
        ref={svgRef}
        width={mapDimensions.width || 0}
        height={mapDimensions.height || 0}
        className="block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1]"
      />
      
      {/* Graph visualization: line from dot to country card + card nodes (top-left) */}
      <svg
        ref={graphSvgRef}
        width={containerDimensions.width || 0}
        height={containerDimensions.height || 0}
        className="block absolute top-0 left-0 z-10 pointer-events-none"
      />
      
      {/* Loading indicator */}
      {loadingCountryData && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl py-4 px-6 flex flex-col items-center gap-3">
            <Loader size={48} />
          </div>
        </div>
      )}

      {/* Related nodes & relationships panel (when country node in graph is clicked) */}
      {showRelatedPanel && selectedCountryName && countryGraphData?.nodes?.length > 0 && (() => {
        const normalize = (name) => (name ?? '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
        const selectedNorm = normalize(selectedCountryName);
        const countryNode = countryGraphData.nodes.find(n => {
          const type = (n.node_type || n.type || '').toString().toLowerCase();
          if (type !== 'country') return false;
          const name = normalize(n.country_name || n.name || n['Country Name'] || '');
          return name === selectedNorm || selectedNorm.includes(name) || name.includes(selectedNorm);
        });
        const countryId = countryNode?.id ?? countryNode?.gid;
        const relatedNodes = countryGraphData.nodes.filter(n => (n.id ?? n.gid) !== countryId);
        const links = countryGraphData.links || [];
        const relationships = links.filter(link => {
          const src = link.sourceId ?? link.source ?? link.from_gid;
          const tgt = link.targetId ?? link.target ?? link.to_gid;
          const srcId = typeof src === 'object' ? (src?.id ?? src?.gid) : src;
          const tgtId = typeof tgt === 'object' ? (tgt?.id ?? tgt?.gid) : tgt;
          return String(srcId) === String(countryId) || String(tgtId) === String(countryId);
        });
        const getNodeName = (id) => {
          const n = countryGraphData.nodes.find(node => String(node.id ?? node.gid) === String(id));
          return n?.name ?? n?.entity_name ?? n?.country_name ?? n?.id ?? n?.gid ?? id;
        };
        return (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-2xl max-h-[50vh] overflow-hidden flex flex-col bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A] shrink-0">
              <h3 className="text-white text-sm font-semibold">Related to {selectedCountryName}</h3>
              <button
                type="button"
                onClick={() => setShowRelatedPanel(false)}
                className="text-[#9F9FA9] hover:text-white p-1 rounded"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 space-y-4">
              <div>
                <h4 className="text-[#B4B4B4] text-xs font-medium uppercase tracking-wide mb-2">Related nodes ({relatedNodes.length})</h4>
                <ul className="space-y-1.5">
                  {relatedNodes.slice(0, 50).map((n, i) => (
                    <li key={n.id ?? n.gid ?? i} className="text-[#E4E4E7] text-xs">
                      <span className="font-medium">{n.name ?? n.entity_name ?? n.country_name ?? n.id ?? n.gid ?? '—'}</span>
                      <span className="text-[#707070] ml-2">{getNodeTypeDisplayName(n)}</span>
                    </li>
                  ))}
                  {relatedNodes.length > 50 && <li className="text-[#707070] text-xs">… and {relatedNodes.length - 50} more</li>}
                </ul>
              </div>
              <div>
                <h4 className="text-[#B4B4B4] text-xs font-medium uppercase tracking-wide mb-2">Relationships ({relationships.length})</h4>
                <ul className="space-y-1.5">
                  {relationships.slice(0, 30).map((link, i) => {
                    const srcId = link.sourceId ?? link.source ?? link.from_gid;
                    const tgtId = link.targetId ?? link.target ?? link.to_gid;
                    const fromName = getNodeName(typeof srcId === 'object' ? (srcId?.id ?? srcId?.gid) : srcId);
                    const toName = getNodeName(typeof tgtId === 'object' ? (tgtId?.id ?? tgtId?.gid) : tgtId);
                    const label = link.relationship_summary ?? link.label ?? link.type ?? '—';
                    return (
                      <li key={i} className="text-[#E4E4E7] text-xs">
                        <span className="font-medium">{fromName}</span>
                        <span className="text-[#707070] mx-1">→</span>
                        <span className="font-medium">{toName}</span>
                        {label && label !== '—' && <span className="text-[#9F9FA9] ml-2">({label})</span>}
                      </li>
                    );
                  })}
                  {relationships.length > 30 && <li className="text-[#707070] text-xs">… and {relationships.length - 30} more</li>}
                </ul>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Country Tooltip */}
      {tooltipData && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${tooltipData.position.x + 10}px`,
            top: `${tooltipData.position.y + 10}px`,
          }}
        >
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl py-2 px-3 min-w-[250px] max-w-[350px]">
            <h3 className="text-white text-[12px] font-bold mb-1">
              {tooltipData.countryName}
            </h3>
            
            {tooltipData.countryInfo && (
              <div className="space-y-0">
                {tooltipData.countryInfo.degree !== undefined && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">Connections:</span> {tooltipData.countryInfo.degree}
                  </div>
                )}
                {tooltipData.countryInfo.section && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">Section:</span> {tooltipData.countryInfo.section}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Graph Node/Edge Tooltip */}
      {graphTooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${graphTooltip.position.x + 15}px`,
            top: `${graphTooltip.position.y + 15}px`,
          }}
        >
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl py-3 px-4 min-w-[280px] max-w-[400px]">
            {graphTooltip.type === 'node' ? (
              <>
                <h3 className="text-white text-[13px] font-bold mb-2">
                  {graphTooltip.data.name || graphTooltip.data.id || 'Node'}
                </h3>
                <div className="space-y-1.5">
                  <div className="text-[#9F9FA9] text-[11px]">
                    <span className="text-[#707070]">Type:</span> {getNodeTypeDisplayName(graphTooltip.data)}
                  </div>
                  {graphTooltip.data.id && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">ID:</span> {graphTooltip.data.id}
                    </div>
                  )}
                  {graphTooltip.data.gid && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">GID:</span> {graphTooltip.data.gid}
                    </div>
                  )}
                  {graphTooltip.data.country_name && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Country:</span> {graphTooltip.data.country_name}
                    </div>
                  )}
                  {graphTooltip.data.entity_name && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Entity Name:</span> {graphTooltip.data.entity_name}
                    </div>
                  )}
                  {graphTooltip.data.degree !== undefined && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Connections:</span> {graphTooltip.data.degree}
                    </div>
                  )}
                  {graphTooltip.data.section && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Section:</span> {graphTooltip.data.section}
                    </div>
                  )}
                  {graphTooltip.data.purpose && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Purpose:</span> {graphTooltip.data.purpose}
                    </div>
                  )}
                  {graphTooltip.data.amount && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Amount:</span> {graphTooltip.data.amount}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-white text-[13px] font-bold mb-2">
                  Connection
                </h3>
                <div className="space-y-1.5">
                  <div className="text-[#9F9FA9] text-[11px]">
                    <span className="text-[#707070]">From:</span> {
                      typeof graphTooltip.data.source === 'object' 
                        ? (graphTooltip.data.source.name || graphTooltip.data.source.id || 'Unknown')
                        : graphTooltip.data.sourceName || graphTooltip.data.source || 'Unknown'
                    }
                  </div>
                  <div className="text-[#9F9FA9] text-[11px]">
                    <span className="text-[#707070]">To:</span> {
                      typeof graphTooltip.data.target === 'object' 
                        ? (graphTooltip.data.target.name || graphTooltip.data.target.id || 'Unknown')
                        : graphTooltip.data.targetName || graphTooltip.data.target || 'Unknown'
                    }
                  </div>
                  {graphTooltip.data.relationship_summary && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Relationship:</span> {graphTooltip.data.relationship_summary}
                    </div>
                  )}
                  {graphTooltip.data.label && !graphTooltip.data.relationship_summary && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Label:</span> {graphTooltip.data.label}
                    </div>
                  )}
                  {graphTooltip.data.article_title && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Article:</span> {graphTooltip.data.article_title}
                    </div>
                  )}
                  {graphTooltip.data.article_url && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">URL:</span> 
                      <a 
                        href={graphTooltip.data.article_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#6EA4F4] hover:underline ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {graphTooltip.data.article_url.length > 40 
                          ? graphTooltip.data.article_url.substring(0, 40) + '...' 
                          : graphTooltip.data.article_url}
                      </a>
                    </div>
                  )}
                  {graphTooltip.data.relationship_date && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Date:</span> {graphTooltip.data.relationship_date}
                    </div>
                  )}
                  {graphTooltip.data.relationship_quality && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Quality:</span> {graphTooltip.data.relationship_quality}
                    </div>
                  )}
                  {graphTooltip.data.type && (
                    <div className="text-[#9F9FA9] text-[11px]">
                      <span className="text-[#707070]">Type:</span> {getNodeTypeDisplayName(graphTooltip.data)}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
});

GraphViewByMap.displayName = 'GraphViewByMap';

export default React.memo(GraphViewByMap);

