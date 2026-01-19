import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FaExpandArrowsAlt, FaCompressArrowsAlt } from 'react-icons/fa';
import EmptyState from './EmptyState';

/**
 * LazyJSONViewer - Efficient JSON viewer for large datasets
 * Features:
 * - Collapsible tree structure
 * - Lazy rendering of nested objects
 * - Virtual scrolling for large arrays
 * - Progressive loading
 */
const LazyJSONViewer = ({ data, maxInitialRender = 100 }) => {
  const [expandedPaths, setExpandedPaths] = useState(new Set(['root']));
  const [renderChunk, setRenderChunk] = useState(maxInitialRender);
  const containerRef = useRef(null);

  // Determine value type
  const getValueType = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
  };

  // Toggle expansion state
  const toggleExpand = useCallback((path) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Render value with proper formatting
  const renderValue = (value) => {
    const type = getValueType(value);

    switch (type) {
      case 'string':
        return <span className="text-[#98C379]">"{value}"</span>;
      case 'number':
        return <span className="text-[#D19A66]">{value}</span>;
      case 'boolean':
        return <span className="text-[#56B6C2]">{String(value)}</span>;
      case 'null':
        return <span className="text-[#C678DD]">null</span>;
      case 'undefined':
        return <span className="text-[#5C6370]">undefined</span>;
      default:
        return <span className="text-[#B4B4B4]">{String(value)}</span>;
    }
  };

  // Render tree node
  const renderNode = useCallback((value, key, path, level = 0) => {
    const type = getValueType(value);
    const isExpanded = expandedPaths.has(path);
    const indent = level * 20;

    // For primitive values
    if (!['object', 'array'].includes(type)) {
      return (
        <div
          key={path}
          className="font-mono text-xs leading-relaxed"
          style={{ paddingLeft: `${indent}px` }}
        >
          <span className="text-[#E06C75]">{key}: </span>
          {renderValue(value)}
        </div>
      );
    }

    // For objects and arrays
    const isArray = Array.isArray(value);
    const entries = isArray ? value : Object.entries(value || {});
    const count = isArray ? value.length : Object.keys(value || {}).length;
    const previewText = isArray
      ? `Array(${count})`
      : `Object{${count}}`;

    return (
      <div key={path}>
        {/* Header */}
        <div
          className="font-mono text-xs leading-relaxed cursor-pointer hover:bg-[#1a1a1a] rounded px-1"
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => toggleExpand(path)}
        >
          <span className="inline-block w-3 text-[#5C6370]">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="text-[#E06C75]">{key}: </span>
          <span className="text-[#5C6370]">{previewText}</span>
        </div>

        {/* Children */}
        {isExpanded && (
          <div>
            {isArray ? (
              // Render array items (with chunking for large arrays)
              value.slice(0, renderChunk).map((item, index) =>
                renderNode(item, `[${index}]`, `${path}.${index}`, level + 1)
              )
            ) : (
              // Render object properties
              Object.entries(value || {}).map(([childKey, childValue]) =>
                renderNode(childValue, childKey, `${path}.${childKey}`, level + 1)
              )
            )}
            
            {/* Show load more button for large arrays */}
            {isArray && value.length > renderChunk && (
              <div
                className="font-mono text-xs leading-relaxed cursor-pointer text-[#5C9EFF] hover:text-[#7BB3FF] pl-1"
                style={{ paddingLeft: `${indent + 20}px` }}
                onClick={() => setRenderChunk(prev => prev + maxInitialRender)}
              >
                ... Load more ({value.length - renderChunk} remaining)
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [expandedPaths, toggleExpand, renderChunk, maxInitialRender]);

  // Handle expand all / collapse all
  const expandAll = useCallback(() => {
    const getAllPaths = (obj, currentPath = 'root', paths = new Set()) => {
      paths.add(currentPath);
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          const newPath = `${currentPath}.${key}`;
          getAllPaths(obj[key], newPath, paths);
        });
      }
      return paths;
    };
    setExpandedPaths(getAllPaths(data));
  }, [data]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['root']));
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#111111] overflow-auto">
      {/* JSON Tree */}
      <div className="p-4 pt-0">
        {data ? (
          renderNode(data, 'root', 'root', 0)
        ) : (
          <EmptyState title="No JSON data available" />
        )}
      </div>
    </div>
  );
};

export default LazyJSONViewer;

