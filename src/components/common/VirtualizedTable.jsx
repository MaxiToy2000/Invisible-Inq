import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import EmptyState from './EmptyState';

/**
 * VirtualizedTable - High-performance table component for large datasets
 * Uses virtual scrolling to only render visible rows
 */
const VirtualizedTable = ({
  data = [],
  columns = [],
  onRowClick = null,
  selectedRowId = null,
  rowHeight = 32,
  headerHeight = 40,
  overscan = 5,
  className = '',
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Update container height on mount and resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      const height = containerRef.current?.clientHeight || 600;
      setContainerHeight(height);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Calculate visible range
  const { startIndex, endIndex, visibleRows, totalHeight } = useMemo(() => {
    const viewportHeight = containerHeight - headerHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(
      data.length,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan
    );

    const visible = data.slice(start, end);
    const total = data.length * rowHeight;

    return {
      startIndex: start,
      endIndex: end,
      visibleRows: visible,
      totalHeight: total,
    };
  }, [data, scrollTop, rowHeight, containerHeight, headerHeight, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  // Get offset for visible rows
  const offsetY = startIndex * rowHeight;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onScroll={handleScroll}
      className="h-full"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[#111111] border-b border-[#707070]"
        style={{ height: `${headerHeight}px` }}
      >
        <div className="flex">
          {columns.map((column, index) => (
            <div
              key={index}
              className="text-left p-2 font-medium text-[#B4B4B4] text-xs"
              style={{
                width: column.width || `${100 / columns.length}%`,
                minWidth: column.minWidth || '100px',
              }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Virtual scrolling container */}
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {/* Visible rows */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleRows.map((row, index) => {
            const actualIndex = startIndex + index;
            const isSelected = selectedRowId && row.id === selectedRowId;

            return (
              <div
                key={row.id || actualIndex}
                className={`flex border-b border-[#707070] cursor-pointer hover:bg-[#1a1a1a] transition-colors ${
                  isSelected ? 'bg-[#1a1a1a] bg-opacity-20' : ''
                }`}
                style={{ height: `${rowHeight}px` }}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column, colIndex) => (
                  <div
                    key={colIndex}
                    className="p-2 text-[#B4B4B4] text-xs flex items-center overflow-hidden"
                    style={{
                      width: column.width || `${100 / columns.length}%`,
                      minWidth: column.minWidth || '100px',
                    }}
                  >
                    {column.render
                      ? column.render(row, actualIndex)
                      : row[column.key] || '-'}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state when there is no data */}
      {data.length === 0 && (
        <div className="absolute inset-0">
          <EmptyState />
        </div>
      )}

      {/* Row count indicator */}
      <div className="sticky bottom-0 z-10 bg-[#111111] border-t border-[#707070] px-2 py-1 text-xs text-[#707070]">
        {data.length > 0 && (
          <>
            Showing rows {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length}
          </>
        )}
      </div>
    </div>
  );
};

export default VirtualizedTable;

