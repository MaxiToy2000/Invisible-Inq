import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';

const ClusterContainer = ({
  selectedCluster,
  clusterMethod = '',
  clusterProperty = '',
  currentSubstory = null
}) => {
  const { showError } = useToast();
  const width = 800;
  const height = 800;

  // Radii reduced to 3/5 to contain all entities comfortably
  const circleA = { x: 320, y: 320, r: Math.round(360 * 0.6) }; // r ≈ 216
  const circleB = { x: 480, y: 440, r: Math.round(330 * 0.6) }; // r ≈ 198

  // Helper to place points via polar coords
  const polar = (cx, cy, r, deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Build evenly distributed pills:
  // - 3 in overlap
  // - 3 in circle A only
  // - 2 in circle B only
  const overlapCenter = { x: (circleA.x + circleB.x) / 2, y: (circleA.y + circleB.y) / 2 };
  const overlapR = Math.min(circleA.r, circleB.r) * 0.35;

  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClusterData = async () => {
      if (!clusterMethod || !clusterProperty) {
        setClusterData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const params = new URLSearchParams({
          node_type: clusterMethod,
          property_key: clusterProperty,
          cluster_limit: '5',
          node_limit: '10',
        });

        const sectionQuery = currentSubstory?.section_query || null;
        if (sectionQuery) {
          params.set('section_query', sectionQuery);
        }

        const response = await fetch(`${apiBaseUrl}/api/cluster?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const txt = await response.text().catch(() => '');
          throw new Error(`Failed to fetch cluster data: ${response.status} ${response.statusText} ${txt}`);
        }

        const data = await response.json();
        setClusterData(data);
      } catch (e) {
        console.error('[ClusterContainer] cluster fetch error:', e);
        const errorMsg = e.message || 'Failed to load cluster data';
        setError(errorMsg);
        showError(errorMsg, 'Cluster Data Error');
        setClusterData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchClusterData();
  }, [clusterMethod, clusterProperty, currentSubstory?.section_query]);

  const clusters = useMemo(() => {
    const raw = clusterData?.clusters || clusterData?.clusterData?.clusters || [];
    return Array.isArray(raw) ? raw : [];
  }, [clusterData]);

  const clusterA = clusters[0] || null;
  const clusterB = clusters[1] || null;

  const pills = useMemo(() => {
    // Place pills based on actual backend data:
    // - overlap: nodes that appear in both top-2 clusters (usually empty for scalar properties)
    // - circle A only: nodes from clusterA not in clusterB
    // - circle B only: nodes from clusterB not in clusterA
    const overlapCenter = { x: (circleA.x + circleB.x) / 2, y: (circleA.y + circleB.y) / 2 };
    const overlapR = Math.min(circleA.r, circleB.r) * 0.35;

    const baseSlots = [
      // Overlap (3)
      { ...polar(overlapCenter.x, overlapCenter.y, overlapR * 0.6, 0), slot: 'overlap' },
      { ...polar(overlapCenter.x, overlapCenter.y, overlapR * 0.6, 120), slot: 'overlap' },
      { ...polar(overlapCenter.x, overlapCenter.y, overlapR * 0.6, 240), slot: 'overlap' },
      // Circle A only (3)
      { ...polar(circleA.x, circleA.y, circleA.r * 0.55, -50), slot: 'a' },
      { ...polar(circleA.x, circleA.y, circleA.r * 0.55, 70), slot: 'a' },
      { ...polar(circleA.x, circleA.y, circleA.r * 0.65, 190), slot: 'a' },
      // Circle B only (2)
      { ...polar(circleB.x, circleB.y, circleB.r * 0.55, -30), slot: 'b' },
      { ...polar(circleB.x, circleB.y, circleB.r * 0.6, 150), slot: 'b' },
    ];

    const nodesA = Array.isArray(clusterA?.nodes) ? clusterA.nodes : [];
    const nodesB = Array.isArray(clusterB?.nodes) ? clusterB.nodes : [];
    const idsB = new Set(nodesB.map(n => n?.id).filter(Boolean));
    const idsA = new Set(nodesA.map(n => n?.id).filter(Boolean));

    const overlapNodes = nodesA.filter(n => n?.id && idsB.has(n.id));
    const aOnly = nodesA.filter(n => n?.id ? !idsB.has(n.id) : true);
    const bOnly = nodesB.filter(n => n?.id ? !idsA.has(n.id) : true);

    const pickTexts = (arr, count) => arr.slice(0, count).map(n => String(n?.name || n?.id || 'Entity'));

    const overlapTexts = pickTexts(overlapNodes, 3);
    const aTexts = pickTexts(aOnly, 3);
    const bTexts = pickTexts(bOnly, 2);

    const filled = [];
    let oi = 0, ai = 0, bi = 0;
    baseSlots.forEach(s => {
      let text = 'Entity';
      if (s.slot === 'overlap') text = overlapTexts[oi++] || '—';
      if (s.slot === 'a') text = aTexts[ai++] || '—';
      if (s.slot === 'b') text = bTexts[bi++] || '—';
      filled.push({ x: s.x, y: s.y, text });
    });

    return filled;
  }, [clusterA, clusterB, circleA.x, circleA.y, circleA.r, circleB.x, circleB.y, circleB.r]);

  const labelStyle = {
    fontSize: 18,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fill: '#FFFFFF'
  };

  if (loading) {
    return (
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3" style={{ zIndex: 5 }}>
        <Loader size={48} />
      </div>
    );
  }

  if (error) {
    return null; // Error is shown via toast
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: 5 }}
    >
      <svg
        width={width}
        height={height}
        style={{
          overflow: 'visible'
        }}
      >
        {/* Circles */}
        <defs>
          <radialGradient id="cluster-circle-grad" cx="50%" cy="50%" r="50%">
            <stop offset="55.77%" stopColor="rgba(0,0,0,0.1)" />
            <stop offset="100%" stopColor="rgba(9,8,8,0.1)" />
          </radialGradient>
        </defs>
        <g style={{ mixBlendMode: 'screen' }}>
                <circle
            cx={circleA.x}
            cy={circleA.y}
            r={circleA.r}
                  fill="url(#cluster-circle-grad)"
            stroke="#232323"
            strokeWidth={1}
            style={{ filter: 'drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.1))' }}
          />
                  <circle
            cx={circleB.x}
            cy={circleB.y}
            r={circleB.r}
            fill="url(#cluster-circle-grad)"
            stroke="#232323"
            strokeWidth={1}
            style={{ filter: 'drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.1s))' }}
                  />
                </g>

        {/* Labels */}
        <text x={circleA.x} y={circleA.y - circleA.r - 18} textAnchor="middle" style={labelStyle}>
          {clusterA ? `${clusterA.value} (${clusterA.count})` : 'Cluster A'}
        </text>
        <text x={circleB.x} y={circleB.y - circleB.r - 18} textAnchor="middle" style={labelStyle}>
          {clusterB ? `${clusterB.value} (${clusterB.count})` : 'Cluster B'}
        </text>

        {/* Pills */}
        {pills.map((p, idx) => {
          const barWidth = 4;
          const barHeight = 14;
          const pillHeight = 22;
          const paddingX = 6;
          const approxCharWidth = 7; // approximate
          const textWidth = Math.max(0, p.text.length * approxCharWidth);
            const pillWidth = paddingX * 2 + barWidth + textWidth;
            const barX = -pillWidth / 2 + paddingX;
            const barY = -pillHeight / 2 + (pillHeight - barHeight) / 2;
            const textX = 0;
          const textY = 4; // baseline adjust

            return (
            <g key={idx} transform={`translate(${p.x}, ${p.y})`}>
                <rect
                  x={-pillWidth / 2}
                  y={-pillHeight / 2}
                rx={5}
                ry={5}
                  width={pillWidth}
                  height={pillHeight}
                  fill="#0C243B"
                  stroke="none"
                  opacity={0.95}
                />
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                rx={2}
                  fill="#218FF8"
                />
                  <text
                    x={textX}
                    y={textY}
                    textAnchor="middle"
                    fill="#FFFFFF"
                fontSize="13"
                    fontFamily='Archivo, system-ui, -apple-system, "Segoe UI", sans-serif'
                    fontWeight="300"
                  >
                {p.text}
                  </text>
              </g>
            );
        })}
      </svg>
    </div>
  );
};

export default ClusterContainer;

