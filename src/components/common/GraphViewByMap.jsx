import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { formatGraphData } from '../../utils/dataUtils';
import { getNodeTypeColor } from '../../utils/colorUtils';
import Loader from './Loader';

const GraphViewByMap = ({ mapView = 'flat', graphData = { nodes: [], links: [] }, currentSubstoryId = null, currentSubstory = null }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [worldData, setWorldData] = useState(null);
  const [highlightedCountries, setHighlightedCountries] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState(null);
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

  // Extract countries from graphData and match them to map country IDs
  useEffect(() => {
    if (!worldData || !worldData.features || !graphData || !graphData.nodes) {
      setHighlightedCountries([]);
      return;
    }

    // Make case-insensitive check for country nodes
    const countryNodes = graphData.nodes.filter(node => {
      const nodeType = node.node_type || node.type;
      return nodeType && String(nodeType).toLowerCase() === 'country';
    });

    if (countryNodes.length === 0) {
      setHighlightedCountries([]);
      return;
    }

    const countryNames = countryNodes
      .map(node => node.country_name || node.name || node['Country Name'])
      .filter(name => name && name.trim() !== '');

    if (countryNames.length === 0) {
      setHighlightedCountries([]);
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

  // Update container dimensions and calculate map dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        
        setContainerDimensions({
          width: containerWidth,
          height: containerHeight
        });
        
        // Calculate map dimensions: width = 2/1 of container width, height = 1/3 of container width
        const mapWidth = (7 / 4) * containerWidth;
        const mapHeight = (1 / 3) * containerWidth;
        
        setMapDimensions({
          width: mapWidth,
          height: mapHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Render map
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || mapDimensions.width === 0 || !worldData || !worldData.features) return;

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
                // Clicking a different highlighted country - select and show graph
                setSelectedCountryId(featureId);
                setSelectedCountryName(countryName);
                isRotationPausedRef.current = true;
                
                if (centroid && svgRef.current) {
                  // Get the map SVG's actual bounding rect (accounts for centering)
                  const mapSvgRect = svgRef.current.getBoundingClientRect();
                  const absolutePosition = {
                    x: centroid[0] + mapSvgRect.left,
                    y: centroid[1] + mapSvgRect.top
                  };
                  setSelectedCountryPosition(absolutePosition);
                }
                
                // Only fetch country-specific graph data if clicking a different country
                if (currentSubstory && currentSubstory.section_query && countryName) {
                  setLoadingCountryData(true);
                  try {
                    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
                    const sectionQuery = currentSubstory.section_query || currentSubstoryId;
                    const url = `${apiBaseUrl}/api/graph/${encodeURIComponent(sectionQuery)}/country/${encodeURIComponent(countryName)}`;
                    
                    const response = await fetch(url, {
                      method: 'GET',
                      headers: { 'Content-Type': 'application/json' },
                    });
                    
                    if (response.ok) {
                      const rawData = await response.json();
                      const formattedData = formatGraphData(rawData);
                      setCountryGraphData(formattedData);
                    } else {
                      setCountryGraphData({ nodes: [], links: [] });
                    }
                  } catch (error) {
                    console.error('Error fetching country graph data:', error);
                    setCountryGraphData({ nodes: [], links: [] });
                  } finally {
                    setLoadingCountryData(false);
                  }
                }
                
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

  }, [mapView, worldData, mapDimensions, highlightedCountries, selectedCountryId, graphData, currentSubstory, currentSubstoryId]);

  // Render graph in remaining space (excluding map) when country is selected
  useEffect(() => {
    if (!graphSvgRef.current || !containerRef.current || containerDimensions.width === 0 || !countryGraphData || !countryGraphData.nodes || countryGraphData.nodes.length === 0) {
      // Clear graph if no data
      if (graphSvgRef.current) {
        const svg = d3.select(graphSvgRef.current);
        svg.selectAll('*').remove();
      }
      return;
    }

    const svg = d3.select(graphSvgRef.current);
    svg.selectAll('*').remove();

    const width = containerDimensions.width;
    const height = containerDimensions.height;

    // Process links to ensure source and target are node objects
    const processedLinks = (countryGraphData.links || []).map(link => {
      const sourceNode = countryGraphData.nodes.find(n => 
        n.id === link.sourceId || 
        n.id === link.source || 
        n.gid === link.from_gid ||
        (typeof link.source === 'string' && n.id === link.source) ||
        (typeof link.source === 'object' && link.source.id && n.id === link.source.id)
      );
      
      const targetNode = countryGraphData.nodes.find(n => 
        n.id === link.targetId || 
        n.id === link.target || 
        n.gid === link.to_gid ||
        (typeof link.target === 'string' && n.id === link.target) ||
        (typeof link.target === 'object' && link.target.id && n.id === link.target.id)
      );
      
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
    const matchingCountryNode = countryGraphData.nodes.find(node => {
      // Make case-insensitive check for country nodes
      const nodeType = node.node_type || node.type;
      if (!nodeType || String(nodeType).toLowerCase() !== 'country') return false;
      const nodeCountryName = node.country_name || node.name || node['Country Name'] || '';
      const normalizedNodeName = normalizeCountryName(nodeCountryName);
      return normalizedNodeName === selectedCountryNormalized || 
             selectedCountryNormalized.includes(normalizedNodeName) ||
             normalizedNodeName.includes(selectedCountryNormalized);
    });

    // Create hierarchical layout centered on the country node
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusStep = 150; // Distance between hierarchy levels

    // Position the country node at the center
    if (matchingCountryNode) {
      matchingCountryNode.x = centerX;
      matchingCountryNode.y = centerY;
      matchingCountryNode.fx = centerX;
      matchingCountryNode.fy = centerY;
    }

    // Find all nodes connected to the country node and organize them by hierarchy level
    const connectedNodesByLevel = [];
    const visited = new Set();
    
    if (matchingCountryNode) {
      visited.add(matchingCountryNode.id || matchingCountryNode.gid);
      let currentLevel = [matchingCountryNode];
      
      // Build hierarchy levels using BFS
      while (currentLevel.length > 0) {
        const nextLevel = [];
        
        currentLevel.forEach(node => {
          const nodeId = node.id || node.gid;
          
          // Find all connected nodes
          processedLinks.forEach(link => {
            const sourceId = (link.source?.id || link.source?.gid || link.source);
            const targetId = (link.target?.id || link.target?.gid || link.target);
            
            let connectedNodeId = null;
            if (String(sourceId) === String(nodeId)) {
              connectedNodeId = targetId;
            } else if (String(targetId) === String(nodeId)) {
              connectedNodeId = sourceId;
            }
            
            if (connectedNodeId && !visited.has(connectedNodeId)) {
              const connectedNode = countryGraphData.nodes.find(n => 
                String(n.id || n.gid) === String(connectedNodeId)
              );
              if (connectedNode) {
                nextLevel.push(connectedNode);
                visited.add(connectedNodeId);
              }
            }
          });
        });
        
        if (nextLevel.length > 0) {
          connectedNodesByLevel.push(nextLevel);
        }
        currentLevel = nextLevel;
      }
    }

    // Position nodes in circular hierarchical layout
    connectedNodesByLevel.forEach((levelNodes, levelIndex) => {
      const radius = radiusStep * (levelIndex + 1);
      const angleStep = (2 * Math.PI) / levelNodes.length;
      
      levelNodes.forEach((node, index) => {
        const angle = angleStep * index;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
        node.fx = node.x;
        node.fy = node.y;
      });
    });

    // Create a minimal simulation just for rendering (no forces, positions are already set)
    const simulation = d3.forceSimulation(countryGraphData.nodes)
      .force('link', null)
      .force('charge', null)
      .force('center', null)
      .force('collision', null)
      .alpha(0)
      .stop();

    // Create links container (pointer-events so clicks reach graph when SVG has pointer-events-none)
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
      .data(countryGraphData.nodes)
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
        // Highlight node on hover (but keep country node at 2px, Entity nodes have different styling)
        const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
        const nodeType = String(d.node_type || d.type || 'entity').toLowerCase();
        const isEntity = nodeType === 'entity';
        if (!isMatchingCountry && !isEntity) {
          d3.select(this).select('circle')
            .attr('stroke-width', 3.5)
            .attr('opacity', 1);
        } else if (isEntity) {
          // Entity badge opacity stays at 1 on hover (already at 1)
        }
      })
      .on('mouseleave', function(event, d) {
        setGraphTooltip(null);
        // Restore original node style (country node stays at 2px, Entity nodes have different styling)
        const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
        const nodeType = String(d.node_type || d.type || 'entity').toLowerCase();
        const isEntity = nodeType === 'entity';
        if (!isMatchingCountry && !isEntity) {
          d3.select(this).select('circle')
            .attr('stroke-width', 2.5)
            .attr('opacity', 0.9);
        } else if (isEntity) {
          // Entity badge opacity stays at 1 (already at 1)
        }
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

    // Create gradient for country node to match map highlight dots
    const countryGradientId = 'country-node-gradient';
    const countryGradient = svg.append('defs')
      .append('radialGradient')
      .attr('id', countryGradientId)
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');
    
    countryGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#FFFFFF')
      .attr('stop-opacity', 0.8);
    
    countryGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#D9D9D9')
      .attr('stop-opacity', 1);
    
    countryGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#D9D9D9')
      .attr('stop-opacity', 0.6);

    // Create gradient for Entity node accent bar
    const entityAccentGradientId = 'entity-accent-gradient';
    const entityAccentGradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', entityAccentGradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    
    entityAccentGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'rgba(0, 0, 0, 0)');
    
    entityAccentGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'rgba(0, 0, 0, 1)');

    // Add shapes for nodes - circles for non-Entity nodes, rectangular badges for Entity nodes
    const nodeShapes = node.each(function(d) {
      const nodeGroup = d3.select(this);
      const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
      const nodeType = String(d.node_type || d.type || 'entity').toLowerCase();
      const isEntity = nodeType === 'entity';
      
      if (isMatchingCountry) {
        // Country node: invisible larger hit area for easier clicking, then 2px circle
        nodeGroup.append('circle')
          .attr('r', 14)
          .attr('fill', 'transparent')
          .attr('stroke', 'none')
          .attr('pointer-events', 'all');
        nodeGroup.append('circle')
          .attr('r', 2)
          .attr('fill', `url(#${countryGradientId})`)
          .attr('stroke', '#D9D9D9')
          .attr('stroke-width', 1)
          .attr('opacity', 0.9)
          .attr('pointer-events', 'all');
      } else if (isEntity) {
        // Entity node: render as rectangular badge matching Figma design
        const nodeName = d.name || d.id || 'Entity';
        const accentBarWidth = 4;
        const accentBarHeight = 12;
        const padding = 3;
        const gap = 2;
        const badgeHeight = 18; // Based on padding 3px top/bottom + 12px text height
        
        // Create a temporary text element to measure actual text width
        const tempText = nodeGroup.append('text')
          .text(nodeName)
          .attr('font-family', 'Archivo, sans-serif')
          .attr('font-weight', 500)
          .attr('font-size', '14px')
          .attr('letter-spacing', '-0.01em')
          .attr('opacity', 0)
          .attr('visibility', 'hidden');
        
        // Get the actual text width
        const textBBox = tempText.node().getBBox();
        const textWidth = textBBox.width;
        
        // Calculate badge width based on actual text width + padding + accent bar + gap
        const badgeWidth = padding + accentBarWidth + gap + textWidth + padding;
        
        // Remove temporary text element
        tempText.remove();
        
        // Background rectangle
        nodeGroup.append('rect')
          .attr('x', -badgeWidth / 2)
          .attr('y', -badgeHeight / 2)
          .attr('width', badgeWidth)
          .attr('height', badgeHeight)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', 'rgba(44, 100, 157, 0.23)')
          .attr('stroke', 'none')
          .attr('opacity', 1)
          .attr('pointer-events', 'all');
        
        // Left accent bar with gradient
        const accentBarX = -badgeWidth / 2 + padding;
        const accentBarY = -accentBarHeight / 2;
        
        nodeGroup.append('rect')
          .attr('x', accentBarX)
          .attr('y', accentBarY)
          .attr('width', accentBarWidth)
          .attr('height', accentBarHeight)
          .attr('rx', accentBarWidth / 2)
          .attr('ry', accentBarWidth / 2)
          .attr('fill', '#2C649D')
          .attr('opacity', 1);
        
        // Text
        nodeGroup.append('text')
          .text(nodeName)
          .attr('x', accentBarX + accentBarWidth + gap)
          .attr('y', 4) // Vertical centering adjustment
          .attr('font-family', 'Archivo, sans-serif')
          .attr('font-weight', 500)
          .attr('font-size', '12px')
          .attr('fill', '#FFFFFF')
          .attr('letter-spacing', '-0.01em')
          .attr('pointer-events', 'none');
      } else {
        // Other node types: render as circle
        nodeGroup.append('circle')
          .attr('r', 12)
          .attr('fill', getNodeTypeColor(nodeType))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2.5)
          .attr('opacity', 0.9)
          .attr('pointer-events', 'all');
      }
    });

    // Get circles for pulse animation (only country nodes have circles)
    const nodeCircles = nodeShapes.selectAll('circle');

    // Add pulse animation to country node to match map highlight dots
    if (matchingCountryNode) {
      const countryCircle = nodeCircles.filter(d => 
        (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid) &&
        (d.node_type === 'Country' || d.type === 'Country')
      );
      
      const animatePulse = () => {
        countryCircle
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
          .attr('r', 2)
          .on('end', animatePulse);
      };
      
      animatePulse();
    }

    // // Add labels for nodes (hide label for country node to match map style)
    // node.append('text')
    //   .text(d => d.name || d.id || 'Node')
    //   .attr('dx', d => {
    //     const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
    //     return isMatchingCountry ? 0 : 16; // No offset for country node (no label)
    //   })
    //   .attr('dy', 5)
    //   .attr('font-size', d => {
    //     const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
    //     return isMatchingCountry ? '0px' : '12px'; // Hide label for country node
    //   })
    //   .attr('fill', d => {
    //     const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
    //     return isMatchingCountry ? 'transparent' : '#FFFFFF'; // Hide label for country node
    //   })
    //   .attr('font-weight', 'normal')
    //   .attr('font-family', 'system-ui, sans-serif')
    //   .attr('pointer-events', 'none')
    //   .attr('opacity', d => {
    //     const isMatchingCountry = matchingCountryNode && (d.id === matchingCountryNode.id || d.gid === matchingCountryNode.gid);
    //     return isMatchingCountry ? 0 : 1; // Hide label for country node
    //   });

    // Position nodes and links according to hierarchical layout
    // Since simulation is stopped, manually position everything
    const updatePositions = () => {
      // Update both hover area and visible link lines
      link.selectAll('line')
        .attr('x1', d => {
          const source = typeof d.source === 'object' && d.source !== null ? d.source : 
                        (typeof d.source === 'string' ? countryGraphData.nodes.find(n => n.id === d.source) : null);
          return source && source.x !== undefined ? source.x : 0;
        })
        .attr('y1', d => {
          const source = typeof d.source === 'object' && d.source !== null ? d.source : 
                        (typeof d.source === 'string' ? countryGraphData.nodes.find(n => n.id === d.source) : null);
          return source && source.y !== undefined ? source.y : 0;
        })
        .attr('x2', d => {
          const target = typeof d.target === 'object' && d.target !== null ? d.target : 
                        (typeof d.target === 'string' ? countryGraphData.nodes.find(n => n.id === d.target) : null);
          return target && target.x !== undefined ? target.x : 0;
        })
        .attr('y2', d => {
          const target = typeof d.target === 'object' && d.target !== null ? d.target : 
                        (typeof d.target === 'string' ? countryGraphData.nodes.find(n => n.id === d.target) : null);
          return target && target.y !== undefined ? target.y : 0;
        });

      node.attr('transform', d => {
        const x = d.x !== undefined && d.x !== null ? d.x : 0;
        const y = d.y !== undefined && d.y !== null ? d.y : 0;
        return `translate(${x},${y})`;
      });
    };
    
    // Call once to apply hierarchical positioning immediately
    updatePositions();

    function dragstarted(event, d) {
      // No need to restart simulation for hierarchical layout
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
      d.x = event.x;
      d.y = event.y;
      
      // Manually update positions since simulation is stopped
      updatePositions();
    }

    function dragended(event, d) {
      // Keep node fixed at dragged position in hierarchical layout
      d.fx = d.x;
      d.fy = d.y;
    }

    // Cleanup
    return () => {
      if (simulation) {
        simulation.stop();
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
                  
                  if (selectedCountryId === featureId && svgRef.current) {
                    // Get the map SVG's actual bounding rect (accounts for centering)
                    const mapSvgRect = svgRef.current.getBoundingClientRect();
                    const absolutePosition = {
                      x: centroid[0] + mapSvgRect.left,
                      y: centroid[1] + mapSvgRect.top
                    };
                    setSelectedCountryPosition(absolutePosition);
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
      
      {/* Graph visualization in remaining space (excluding map) */}
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
                      <span className="text-[#707070] ml-2">{n.node_type ?? n.type ?? 'entity'}</span>
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
                    <span className="text-[#707070]">Type:</span> {graphTooltip.data.node_type || graphTooltip.data.type || 'Entity'}
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
                      <span className="text-[#707070]">Type:</span> {graphTooltip.data.type}
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
};

export default GraphViewByMap;

