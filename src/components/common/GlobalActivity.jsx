import { useState, useMemo, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country name mapping for better matching
const countryNameMap = {
  'SAU': ['Saudi Arabia', 'Saudi', 'SAU'],
  'BRA': ['Brazil', 'BRA'],
  'IND': ['India', 'IND'],
  'JPN': ['Japan', 'JPN'],
  'USA': ['United States', 'United States of America', 'USA', 'US'],
  'CAN': ['Canada', 'CAN'],
  'MEX': ['Mexico', 'MEX'],
  'ARG': ['Argentina', 'ARG'],
  'CHL': ['Chile', 'CHL'],
  'GBR': ['United Kingdom', 'UK', 'Great Britain', 'GBR'],
  'FRA': ['France', 'FRA'],
  'DEU': ['Germany', 'DEU'],
  'ESP': ['Spain', 'ESP'],
  'ITA': ['Italy', 'ITA'],
  'SWE': ['Sweden', 'SWE'],
  'NOR': ['Norway', 'NOR'],
  'TUR': ['Turkey', 'TUR'],
  'RUS': ['Russia', 'RUS'],
  'EGY': ['Egypt', 'EGY'],
  'ZAF': ['South Africa', 'ZAF'],
  'CHN': ['China', 'CHN'],
  'KOR': ['South Korea', 'Korea', 'KOR'],
  'AUS': ['Australia', 'AUS'],
  'NZL': ['New Zealand', 'NZL']
};

const GlobalActivity = ({ graphData, currentSubstory, onSectionClick, onHighlightCountries }) => {
  const [activeCountries] = useState([
    'USA', 'CAN', 'MEX', 'BRA', 'ARG', 'CHL',
    'GBR', 'FRA', 'DEU', 'ESP', 'ITA', 'SWE',
    'NOR', 'TUR', 'RUS', 'EGY', 'SAU', 'ZAF',
    'IND', 'CHN', 'JPN', 'KOR', 'AUS', 'NZL'
  ]);
  const [dotRadius, setDotRadius] = useState(4);
  const animationFrameRef = useRef(null);
  const animationStartTimeRef = useRef(null);
  const [tooltipData, setTooltipData] = useState(null);

  // Helper function to normalize country names (same as GraphViewByMap)
  const normalizeCountryName = (name) => {
    if (!name) return '';
    return String(name)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  };

  // Find highlighted countries based on selected section from LeftSidebar (currentSubstory)
  const highlightedCountries = useMemo(() => {
    // Check if we have graph data
    if (!graphData || !graphData.nodes || !graphData.links) {
      return new Set();
    }

    // IMPORTANT: graphData is already filtered by the backend to only include nodes
    // where node.gr_id == section.graph_name (for the currently selected section).
    // Therefore, ALL nodes in graphData.nodes belong to the current section.
    // No additional filtering is needed.
    const sectionNodes = graphData.nodes;

    if (sectionNodes.length === 0) {
      return new Set();
    }

    // Get IDs of section nodes
    const sectionNodeIds = new Set(sectionNodes.map(n => String(n.id || n.gid)).filter(Boolean));

    // Find country nodes connected to section nodes
    const connectedCountryNodes = [];
    const processedCountryIds = new Set();

    graphData.links.forEach(link => {
      const sourceId = String(link.source?.id || link.sourceId || link.source || '');
      const targetId = String(link.target?.id || link.targetId || link.target || '');

      const sourceIsSectionNode = sectionNodeIds.has(sourceId);
      const targetIsSectionNode = sectionNodeIds.has(targetId);

      if (sourceIsSectionNode || targetIsSectionNode) {
        const otherNodeId = sourceIsSectionNode ? targetId : sourceId;
        const otherNode = graphData.nodes.find(n => 
          String(n.id || n.gid) === otherNodeId
        );

        if (otherNode) {
          const nodeType = otherNode.node_type || otherNode.type;
          // Make case-insensitive check for country nodes
          const isCountry = nodeType && String(nodeType).toLowerCase() === 'country';
          const countryId = String(otherNode.id || otherNode.gid);

          if (isCountry && countryId && !processedCountryIds.has(countryId)) {
            connectedCountryNodes.push(otherNode);
            processedCountryIds.add(countryId);
          }
        }
      }
    });

    // Also check if any section nodes are country nodes themselves
    sectionNodes.forEach(node => {
      const nodeType = node.node_type || node.type;
      // Make case-insensitive check for country nodes
      if (nodeType && String(nodeType).toLowerCase() === 'country') {
        const countryId = String(node.id || node.gid);
        if (countryId && !processedCountryIds.has(countryId)) {
          connectedCountryNodes.push(node);
          processedCountryIds.add(countryId);
        }
      }
    });

    // Store country node names for matching (will be matched against geographies in render)
    const countryNamesToMatch = connectedCountryNodes
      .map(countryNode => countryNode.country_name || countryNode.name || countryNode['Country Name'] || '')
      .filter(name => name && name.trim() !== '');

    // Return country names instead of codes - will be matched against geographies during render
    return new Set(countryNamesToMatch);
  }, [graphData]);

  // Get country node information for a given country name
  const getCountryNodeInfo = (countryName) => {
    if (!graphData || !graphData.nodes || !countryName) return null;
    
    const normalizedName = normalizeCountryName(countryName);
    
    // Find matching country node
    const countryNode = graphData.nodes.find(node => {
      const nodeType = node.node_type || node.type;
      // Make case-insensitive check for country nodes
      if (!nodeType || String(nodeType).toLowerCase() !== 'country') return false;
      
      const nodeCountryName = node.country_name || node.name || node['Country Name'] || '';
      const normalizedNodeName = normalizeCountryName(nodeCountryName);
      
      return normalizedNodeName === normalizedName ||
             normalizedNodeName.includes(normalizedName) ||
             normalizedName.includes(normalizedNodeName);
    });
    
    return countryNode;
  };

  // Helper function to check if geography matches any highlighted country name
  const isGeographyHighlighted = (geo) => {
    if (!highlightedCountries || highlightedCountries.size === 0) return false;
    
    const mapCountryName = geo.properties?.NAME || geo.properties?.name || geo.properties?.NAME_LONG || geo.properties?.NAME_EN || '';
    if (!mapCountryName) return false;
    
    const normalizedMapName = normalizeCountryName(mapCountryName);
    
    // Check if any highlighted country name matches this geography
    for (const countryName of highlightedCountries) {
      const normalizedGraphName = normalizeCountryName(countryName);
      
      // Exact match
      if (normalizedGraphName === normalizedMapName) {
        return true;
      }
      
      // Partial match (only if both are non-empty)
      if (normalizedGraphName && normalizedMapName && 
          (normalizedGraphName.includes(normalizedMapName) || 
           normalizedMapName.includes(normalizedGraphName))) {
        return true;
      }
    }
    
    return false;
  };

  // Animate dot radius: zoom in, zoom out, zoom in, zoom out (repeating)
  useEffect(() => {
    if (highlightedCountries.size === 0) {
      setDotRadius(4);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = (timestamp) => {
      if (!animationStartTimeRef.current) {
        animationStartTimeRef.current = timestamp;
      }

      const elapsed = timestamp - animationStartTimeRef.current;
      const cycleDuration = 2400; // 2.4 seconds for full cycle (zoom in, out, in, out)
      const progress = (elapsed % cycleDuration) / cycleDuration;

      let radius;
      if (progress < 0.25) {
        // 0-25%: zoom in (4 -> 6.8)
        const t = progress / 0.25;
        radius = 4 + (6.8 - 4) * t;
      } else if (progress < 0.5) {
        // 25-50%: zoom out (6.8 -> 4.8)
        const t = (progress - 0.25) / 0.25;
        radius = 6.8 - (6.8 - 4.8) * t;
      } else if (progress < 0.75) {
        // 50-75%: zoom in (4.8 -> 6.2)
        const t = (progress - 0.5) / 0.25;
        radius = 4.8 + (6.2 - 4.8) * t;
      } else {
        // 75-100%: zoom out (6.2 -> 4)
        const t = (progress - 0.75) / 0.25;
        radius = 6.2 - (6.2 - 4) * t;
      }

      setDotRadius(radius);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationStartTimeRef.current = null;
    };
  }, [highlightedCountries.size]);

  // Handle section click - find country nodes connected to nodes in that section
  const handleSectionClick = (sectionQuery) => {
    if (!graphData || !graphData.nodes || !graphData.links) {
      return;
    }

    // IMPORTANT: graphData is already filtered by the backend to only include nodes
    // where node.gr_id == section.graph_name (for the currently selected section).
    // Therefore, ALL nodes in graphData.nodes belong to the current section.
    const sectionNodes = graphData.nodes;

    if (sectionNodes.length === 0) {
      return;
    }

    // Get IDs of section nodes
    const sectionNodeIds = new Set(sectionNodes.map(n => n.id || n.gid));

    // Find country nodes connected to section nodes through links
    const connectedCountryNodes = [];
    const processedCountryIds = new Set();

    graphData.links.forEach(link => {
      const sourceId = link.source?.id || link.sourceId || link.source;
      const targetId = link.target?.id || link.targetId || link.target;

      // Check if link connects a section node to a country node
      const sourceIsSectionNode = sectionNodeIds.has(sourceId);
      const targetIsSectionNode = sectionNodeIds.has(targetId);

      if (sourceIsSectionNode || targetIsSectionNode) {
        // Check the other end of the link
        const otherNodeId = sourceIsSectionNode ? targetId : sourceId;
        const otherNode = graphData.nodes.find(n => 
          (n.id || n.gid) === otherNodeId
        );

        if (otherNode) {
          const nodeType = otherNode.node_type || otherNode.type;
          // Make case-insensitive check for country nodes
          const isCountry = nodeType && String(nodeType).toLowerCase() === 'country';
          const countryId = otherNode.id || otherNode.gid;

          if (isCountry && countryId && !processedCountryIds.has(countryId)) {
            connectedCountryNodes.push(otherNode);
            processedCountryIds.add(countryId);
          }
        }
      }
    });

    // Also check if any section nodes are country nodes themselves
    sectionNodes.forEach(node => {
      const nodeType = node.node_type || node.type;
      if (nodeType === 'Country') {
        const countryId = node.id || node.gid;
        if (countryId && !processedCountryIds.has(countryId)) {
          connectedCountryNodes.push(node);
          processedCountryIds.add(countryId);
        }
      }
    });

    // Call the highlight callback with country node IDs
    if (onHighlightCountries && connectedCountryNodes.length > 0) {
      const countryIds = connectedCountryNodes.map(node => node.id || node.gid).filter(Boolean);
      onHighlightCountries(countryIds);
    }
  };

  const countryCount = activeCountries.length;

  return (
    <div className='bg-[#0E0E0E] border border-[#202020] rounded-[5px] pb-[2px]'>
      <div className="w-full flex-shrink-0" style={{ minHeight: '300px', maxHeight: '300px' }}>

        {/* Header Section */}
        <div className="absolute top-0 left-0 py-[8px] right-0 z-10 flex justify-center items-center px-[16px]">
          {/* Global Activity Button */}
          <div className="text-center">
            <span className="text-white  text-[14px] font-medium">Global Activity</span>
          </div>
        </div>

        {/* World Map */}
        <div className="w-full h-full pt-[40px] pb-8 overflow-hidden" style={{ clipPath: 'inset(0 0 15% 0)' }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 120,
              center: [0, 25]
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => {
                    // Filter out Antarctica and other southern continents
                    if (geo.properties.ISO_A3 === 'ATA') return false; // Antarctica
                    
                    // Filter out geographies that are primarily in the far southern hemisphere
                    const coordinates = geo.geometry.coordinates;
                    if (geo.geometry.type === 'Polygon') {
                      const coords = coordinates[0];
                      const avgLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
                      return avgLat > -60; // Hide anything below -60 degrees latitude
                    } else if (geo.geometry.type === 'MultiPolygon') {
                      let totalLat = 0;
                      let count = 0;
                      coordinates.forEach(polygon => {
                        polygon[0].forEach(coord => {
                          totalLat += coord[1];
                          count++;
                        });
                      });
                      const avgLat = totalLat / count;
                      return avgLat > -60; // Hide anything below -60 degrees latitude
                    }
                    return true;
                  })
                  .map((geo) => {
                    // Check if this geography matches any highlighted country
                    const isHighlighted = isGeographyHighlighted(geo);
                    
                    // Keep normal styling for countries (no red fill/stroke)
                    const defaultFill = '#273145';
                    const defaultStroke = '#525978';
                    const strokeWidth = 0.5;
                    
                    const countryName = geo.properties?.NAME || geo.properties?.name || geo.properties?.NAME_LONG || geo.properties?.NAME_EN || '';
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={defaultFill}
                        stroke={defaultStroke}
                        strokeWidth={strokeWidth}
                        style={{
                          default: {
                            fill: defaultFill,
                            stroke: defaultStroke,
                            outline: 'none',
                            transition: 'all 0.3s ease',
                            pointerEvents: isHighlighted ? 'all' : 'none',
                            opacity: 0.8,
                            cursor: isHighlighted ? 'pointer' : 'default'
                          },
                          hover: {
                            fill: isHighlighted ? 'rgba(32, 164, 243, 0.8)' : defaultFill,
                            stroke: isHighlighted ? '#0C8CE9' : '#525978',
                            outline: 'none',
                            cursor: isHighlighted ? 'pointer' : 'default',
                            opacity: 1
                          },
                          pressed: {
                            fill: defaultFill,
                            stroke: defaultStroke,
                            outline: 'none',
                            opacity: 0.8
                          }
                        }}
                        onMouseEnter={(event) => {
                          if (isHighlighted && countryName) {
                            const countryInfo = getCountryNodeInfo(countryName);
                            setTooltipData({
                              countryName: countryName,
                              countryInfo: countryInfo,
                              position: {
                                x: event.clientX,
                                y: event.clientY
                              }
                            });
                          }
                        }}
                        onMouseLeave={() => {
                          if (isHighlighted) {
                            setTooltipData(null);
                          }
                        }}
                        onMouseMove={(event) => {
                          if (isHighlighted && tooltipData) {
                            setTooltipData(prev => ({
                              ...prev,
                              position: {
                                x: event.clientX,
                                y: event.clientY
                              }
                            }));
                          }
                        }}
                      />
                    );
                  })
              }
            </Geographies>
            
            {/* SVG defs for dot gradient */}
            <defs>
              <radialGradient id="dot-gradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#D9D9D9" stopOpacity="1" />
                <stop offset="100%" stopColor="#D9D9D9" stopOpacity="0.6" />
              </radialGradient>
            </defs>
            
            {/* Highlight dots for countries - render dots for highlighted countries */}
            <Geographies geography={geoUrl}>
              {({ geographies }) => {
                const coordsToRender = [];
                
                geographies
                  .filter((geo) => {
                    // Filter out Antarctica and other southern continents
                    if (geo.properties.ISO_A3 === 'ATA') return false;
                    
                    // Filter out geographies that are primarily in the far southern hemisphere
                    const coordinates = geo.geometry.coordinates;
                    if (geo.geometry.type === 'Polygon') {
                      const coords = coordinates[0];
                      const avgLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
                      return avgLat > -60;
                    } else if (geo.geometry.type === 'MultiPolygon') {
                      let totalLat = 0;
                      let count = 0;
                      coordinates.forEach(polygon => {
                        polygon[0].forEach(coord => {
                          totalLat += coord[1];
                          count++;
                        });
                      });
                      const avgLat = totalLat / count;
                      return avgLat > -60;
                    }
                    return true;
                  })
                  .forEach((geo) => {
                    const isHighlighted = isGeographyHighlighted(geo);
                    
                    if (isHighlighted) {
                      // Calculate centroid for the geography
                      const coordinates = geo.geometry.coordinates;
                      let centroid = [0, 0];
                      let totalWeight = 0;
                      
                      if (geo.geometry.type === 'Polygon') {
                        const coords = coordinates[0];
                        coords.forEach(coord => {
                          centroid[0] += coord[0];
                          centroid[1] += coord[1];
                          totalWeight += 1;
                        });
                        if (totalWeight > 0) {
                          centroid[0] /= totalWeight;
                          centroid[1] /= totalWeight;
                        }
                      } else if (geo.geometry.type === 'MultiPolygon') {
                        coordinates.forEach(polygon => {
                          polygon[0].forEach(coord => {
                            centroid[0] += coord[0];
                            centroid[1] += coord[1];
                            totalWeight += 1;
                          });
                        });
                        if (totalWeight > 0) {
                          centroid[0] /= totalWeight;
                          centroid[1] /= totalWeight;
                        }
                      }
                      
                      if (centroid[0] !== 0 && centroid[1] !== 0) {
                        coordsToRender.push({ coordinates: centroid, key: `dot-${geo.rsmKey}` });
                      }
                    }
                  });
                
                return coordsToRender.map(({ coordinates, key }) => (
                  <Marker key={key} coordinates={coordinates}>
                    <circle
                      r={dotRadius}
                      fill="url(#dot-gradient)"
                      stroke="#D9D9D9"
                      strokeWidth={1}
                      opacity={0.9}
                    />
                  </Marker>
                ));
              }}
            </Geographies>
          </ComposableMap>
        </div>
      </div>
      
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
                {tooltipData.countryInfo.id && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">ID:</span> {tooltipData.countryInfo.id}
                  </div>
                )}
                {tooltipData.countryInfo.gid && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">GID:</span> {tooltipData.countryInfo.gid}
                  </div>
                )}
                {tooltipData.countryInfo.country_name && tooltipData.countryInfo.country_name !== tooltipData.countryName && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">Country Name:</span> {tooltipData.countryInfo.country_name}
                  </div>
                )}
                {tooltipData.countryInfo.section && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">Section:</span> {tooltipData.countryInfo.section}
                  </div>
                )}
                {tooltipData.countryInfo.section_query && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">Section Query:</span> {tooltipData.countryInfo.section_query}
                  </div>
                )}
                {(tooltipData.countryInfo.node_type || tooltipData.countryInfo.type) && (
                  <div className="text-[#707070] text-[10px]">
                    <span className="text-[#9F9FA9]">Type:</span> {tooltipData.countryInfo.node_type || tooltipData.countryInfo.type}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalActivity;

