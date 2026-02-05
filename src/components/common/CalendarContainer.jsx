import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import EmptyState from './EmptyState';
import Loader from './Loader';

// Calendar "Linear" layout with dynamic timeline + free-floating items
// Timeline items (Milestone/Result/Action) are locked left-to-right in sequence
// Free-floating items (Entity/Location/etc.) appear based on connections to visible timeline items
const CalendarContainer = ({ sectionQuery = null, currentSubstory = null }) => {
  const { showError } = useToast();
  const designWidth = 1600;
  const designHeight = 1200;
  const scale = 1.5;

  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewportOffset, setViewportOffset] = useState(0); // for future scrolling/panning
  const svgRef = useRef(null);

  useEffect(() => {
    const fetchCalendarData = async () => {
      const queryToUse = sectionQuery || currentSubstory?.section_query || currentSubstory?.id;
      if (!queryToUse) {
        setCalendarData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const url = `${apiBaseUrl}/api/calendar?section_query=${encodeURIComponent(queryToUse)}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const txt = await response.text().catch(() => '');
          throw new Error(`Failed to fetch calendar data: ${response.status} ${response.statusText} ${txt}`);
        }

        const data = await response.json();
        setCalendarData(data);
      } catch (e) {
        console.error('[CalendarContainer] fetch error:', e);
        const errorMsg = e.message || 'Failed to load calendar data';
        setError(errorMsg);
        showError(errorMsg, 'Calendar Data Error');
        setCalendarData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [sectionQuery, currentSubstory?.section_query, currentSubstory?.id]);

  // Parse date safely
  const safeParseDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) return d;
    const m = String(dateStr).match(/\d{4}-\d{2}-\d{2}/);
    if (m) {
      const dd = new Date(m[0]);
      if (!Number.isNaN(dd.getTime())) return dd;
    }
    return null;
  };

  const toPillText = (dateStr) => {
    const d = safeParseDate(dateStr);
    if (!d) return { month: '—', day: '—', year: String(new Date().getFullYear()) };
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = String(d.getDate());
    const year = String(d.getFullYear());
    return { month, day, year };
  };

  // Process data: separate timeline and floating items, compute layout
  const layoutData = useMemo(() => {
    if (!calendarData) return null;

    const timelineItems = Array.isArray(calendarData.timeline_items) ? calendarData.timeline_items : [];
    const floatingItems = Array.isArray(calendarData.floating_items) ? calendarData.floating_items : [];
    const relationships = Array.isArray(calendarData.relationships) ? calendarData.relationships : [];

    // Group timeline items by date for the left rail
    const dateGroups = {};
    const allDates = [];

    for (const item of timelineItems) {
      if (!item?.date) continue;
      const dateKey = String(item.date);
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
        allDates.push(dateKey);
      }
      dateGroups[dateKey].push(item);
    }

    // Sort dates newest first
    allDates.sort((a, b) => {
      const da = safeParseDate(a);
      const db = safeParseDate(b);
      if (!da || !db) return String(b).localeCompare(String(a));
      return db.getTime() - da.getTime();
    });

    const year = allDates.length ? toPillText(allDates[0]).year : String(new Date().getFullYear());

    // Layout: timeline items from top to bottom, left side
    // Rail: x=80, datePills centered at x=80, cards start at x=120
  const railX = 80;
  const railY = 60;
    const cardStartX = 120;
    const startY = 140;
    const dateGapY = 180; // vertical gap between date groups

    const dateLayout = [];
    const timelineLayout = [];
    let currentY = startY;

    for (const dateKey of allDates.slice(0, 10)) { // limit to first 10 dates
      const items = dateGroups[dateKey] || [];
      dateLayout.push({
        dateKey,
        x: railX,
        y: currentY,
      });

      // Layout each timeline item horizontally, staggered
      let offsetX = cardStartX;
      for (const item of items.slice(0, 6)) { // limit to 6 items per date
        timelineLayout.push({
          ...item,
          x: offsetX,
          y: currentY - 30,
        });
        offsetX += 300; // horizontal spacing
      }

      currentY += dateGapY;
    }

    // Build connection map: which floating items connect to which timeline items
    const timelineGids = new Set(timelineItems.map((t) => t.gid));
    const floatingGids = new Set(floatingItems.map((f) => f.gid));

    const connectionMap = {}; // floatingGid -> [timelineGid, ...]
    for (const rel of relationships) {
      const { source_gid, target_gid } = rel;
      if (timelineGids.has(source_gid) && floatingGids.has(target_gid)) {
        if (!connectionMap[target_gid]) connectionMap[target_gid] = [];
        connectionMap[target_gid].push(source_gid);
      }
      if (timelineGids.has(target_gid) && floatingGids.has(source_gid)) {
        if (!connectionMap[source_gid]) connectionMap[source_gid] = [];
        connectionMap[source_gid].push(target_gid);
      }
    }

    // Filter floating items: only show those connected to visible timeline items
    const visibleTimelineGids = new Set(timelineLayout.map((t) => t.gid));
    const visibleFloatingItems = floatingItems.filter((f) => {
      const connections = connectionMap[f.gid] || [];
      return connections.some((tGid) => visibleTimelineGids.has(tGid));
    });

    // Position floating items near their connected timeline items
    const floatingLayout = [];
    for (const floatItem of visibleFloatingItems) {
      const connectedTimelineGids = connectionMap[floatItem.gid] || [];
      const connectedTimelineNodes = timelineLayout.filter((t) => connectedTimelineGids.includes(t.gid));

      if (connectedTimelineNodes.length === 0) continue;

      // Average position of connected nodes
      const avgX =
        connectedTimelineNodes.reduce((sum, n) => sum + (n.x || 0), 0) / connectedTimelineNodes.length;
      const avgY =
        connectedTimelineNodes.reduce((sum, n) => sum + (n.y || 0), 0) / connectedTimelineNodes.length;

      floatingLayout.push({
        ...floatItem,
        x: avgX + 200 + Math.random() * 100, // offset to the right + random scatter
        y: avgY + 50 + Math.random() * 50,
        connectedTo: connectedTimelineGids,
      });
    }

    return {
      year,
      dateLayout,
      timelineLayout,
      floatingLayout,
      relationships,
      timelineGids: visibleTimelineGids,
    };
  }, [calendarData, viewportOffset]);

  // ========== RENDERING COMPONENTS ==========

  const DatePill = ({ x, y, dateKey }) => {
    const { month, day } = toPillText(dateKey);
  const pillWidth = 30;
  const pillHeight = 177;
  const pillRadius = 30;

  const pillPath = (w, h, r, offsetX = 0, offsetY = 0) => {
    const x0 = offsetX;
    const y0 = offsetY;
    const x1 = x0 + w;
    const y1 = y0 + h;
    const rr = r;
    return `M ${x0} ${y0 + rr} Q ${x0} ${y0} ${x0 + rr} ${y0} H ${x1} V ${y1} H ${x0 + rr} Q ${x0} ${y1} ${x0} ${y1 - rr} Z`;
  };

    return (
      <g transform={`translate(${x}, ${y})`}>
        <path
          d={pillPath(pillWidth, pillHeight, pillRadius, -pillWidth / 2, -pillHeight / 2)}
          fill="#232D35"
        />
        <text
          x={0}
          y={-6}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="11"
          fontFamily="Archivo, system-ui"
          fontWeight="700"
        >
          {month}
        </text>
        <text
          x={0}
          y={10}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="14"
          fontFamily="Archivo, system-ui"
          fontWeight="400"
        >
          {day}
        </text>
      </g>
    );
  };

  const TimelineCard = ({ item }) => {
    const { x, y, node_type, name, description } = item;
    const width = 260;
    const height = 160;

    // Color mapping by node type
    const colorMap = {
      Result: { bar: '#9B4829', grad: 'url(#milestone-result-grad)' },
      Action: { bar: '#9B8B29', grad: 'url(#result-action-grad)' },
      // Milestone would go here if we had it
    };

    const colors = colorMap[node_type] || { bar: '#FB3C3C', grad: 'url(#milestone-result-grad)' };

    return (
      <g transform={`translate(${x}, ${y})`}>
        <rect width={width} height={height} rx={6} ry={6} fill="#1F1F22" stroke="#222222" />
        <rect x={6} y={6} width={3.5} height={height - 12} rx={2} ry={2} fill={colors.bar} />
        <rect x={6} y={6} width={3.5} height={height - 12} rx={2} ry={2} fill="url(#leftline-overlay)" />
        <text x={22} y={30} fill="#FFFFFF" fontSize="14" fontFamily="Archivo, system-ui" fontWeight="600">
          {(name || 'Untitled').substring(0, 30)}
        </text>
        <text x={22} y={48} fill="#8E8E8E" fontSize="10" fontFamily="Archivo, system-ui">
          Type: {node_type}
        </text>
        <foreignObject x={22} y={64} width={width - 44} height={height - 80}>
          <div
            style={{
              color: '#999',
              fontSize: '11px',
              fontFamily: 'Archivo, system-ui',
              lineHeight: '1.4',
              overflow: 'hidden',
            }}
          >
            {(description || '').substring(0, 150)}...
          </div>
        </foreignObject>
      </g>
    );
  };

  const FloatingPill = ({ item }) => {
    const { x, y, name, node_type } = item;
    const pillWidth = 120;
    const pillHeight = 28;

    // Color mapping by node type
    const colorMap = {
      Entity: { fill: '#1F3B59', stroke: '#2D4F73' },
      Location: { fill: '#3C2E83', stroke: '#7B5BEB' },
      Country: { fill: '#0C243B', stroke: '#1E4E8C' },
      Recipient: { fill: '#1F3B59', stroke: '#2D4F73' },
      Region: { fill: '#1E5B60', stroke: '#1A4A52' },
      Agency: { fill: '#1F3B59', stroke: '#2D4F73' },
      'Place Of Performance': { fill: '#3C2E83', stroke: '#7B5BEB' },
      Process: { fill: '#4F1D35', stroke: '#4F1D35' },
    };

    const colors = colorMap[node_type] || { fill: '#1F3B59', stroke: '#2D4F73' };

    return (
      <g transform={`translate(${x}, ${y})`}>
        <rect
          x={-pillWidth / 2}
          y={-pillHeight / 2}
          width={pillWidth}
          height={pillHeight}
          rx={6}
          ry={6}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={1}
        />
        <rect
          x={-pillWidth / 2 + 6}
          y={-pillHeight / 2 + 6}
          width={4}
          height={pillHeight - 12}
          rx={2}
          ry={2}
          fill={colors.stroke}
        />
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="12"
          fontFamily="Archivo, system-ui"
          fontWeight="500"
        >
          {(name || 'Item').substring(0, 12)}
        </text>
      </g>
    );
  };

  const ConnectionLine = ({ from, to }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return null; // too close

    return (
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#9BAFBD"
        strokeWidth={1.5}
        opacity={0.4}
      />
    );
  };

  // ========== MAIN RENDER ==========

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <Loader size={48} />
      </div>
    );
  }

  if (error) {
    return null; // Error is shown via toast
  }

  if (!layoutData || layoutData.timelineLayout.length === 0) {
    return (
      <EmptyState
        title="No calendar data available"
      />
    );
  }

  const { year, dateLayout, timelineLayout, floatingLayout, relationships, timelineGids } = layoutData;

  const scaleWrapperStyle = {
    width: `${100 * scale}%`,
    height: `${100 * scale}%`,
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
  };

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <div style={scaleWrapperStyle}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${designWidth} ${designHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block' }}
        >
        <defs>
          <linearGradient id="milestone-result-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FB3C3C" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#9B4829" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="result-action-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E25E2E" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#CBC532" stopOpacity="0.4" />
          </linearGradient>
            <linearGradient id="leftline-overlay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
          </linearGradient>
        </defs>

          <rect x={0} y={0} width={designWidth} height={designHeight} fill="transparent" />

          {/* Left rail with year label */}
          <g>
            <rect x={40} y={60} width={20} height={1000} rx={10} fill="#272B2F" />
            <g transform={`translate(50, 100) rotate(-90)`}>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="14"
                fontFamily="Archivo, system-ui"
                fontWeight="700"
              >
                {year}
              </text>
            </g>
        </g>

          {/* Date pills */}
          {dateLayout.map((date, idx) => (
            <DatePill key={`date-${idx}`} x={date.x} y={date.y} dateKey={date.dateKey} />
        ))}

          {/* Connection lines first (behind cards) */}
          {floatingLayout.map((floatItem, idx) => {
            const connectedTimelineNodes = timelineLayout.filter((t) =>
              (floatItem.connectedTo || []).includes(t.gid)
            );
            return connectedTimelineNodes.map((timelineNode, connIdx) => (
              <ConnectionLine
                key={`conn-${idx}-${connIdx}`}
                from={{ x: timelineNode.x + 130, y: timelineNode.y + 80 }}
                to={{ x: floatItem.x, y: floatItem.y }}
              />
            ));
          })}

          {/* Timeline cards */}
          {timelineLayout.map((item, idx) => (
            <TimelineCard key={`timeline-${idx}`} item={item} />
          ))}

          {/* Floating pills */}
          {floatingLayout.map((item, idx) => (
            <FloatingPill key={`floating-${idx}`} item={item} />
          ))}
      </svg>
    </div>
    </div>
  );
};

export default CalendarContainer;
