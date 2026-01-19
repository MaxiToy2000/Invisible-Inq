import React from 'react';

/**
 * NodeTooltip - Displays detailed information about a node on hover
 * Matches the design with image, title, type/subtype, and description
 */
const NodeTooltip = ({ node, position }) => {
  if (!node || !position) return null;

  // Extract node information
  const name = node.name || node.id || 'Unknown';
  const nodeType = node.node_type || node.type || node.category || '';
  const subtype = node.subtype || node.sub_type || '';
  const description = node.description || node.desc || node.properties?.description || '';
  const imageUrl = node.image || node.image_url || node.properties?.image || null;

  // Create type display string
  const typeDisplay = [nodeType, subtype].filter(Boolean).join(', ');

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className="-translate-x-1/2 -translate-y-[120%]"
    >
      <div className="bg-[#1E1E1E] border-l-4 border-[#5C9EFF] rounded-lg shadow-2xl overflow-hidden max-w-[400px] min-w-[300px]">
        <div className="flex">
          {/* Image Section */}
          {imageUrl ? (
            <div className="flex-shrink-0 w-32 h-full bg-[#2A2A2A]">
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-32 h-full bg-gradient-to-br from-[#2A2A2A] to-[#1E1E1E] flex items-center justify-center">
              <div className="text-[#5C9EFF] text-4xl font-bold opacity-30">
                {name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Content Section */}
          <div className="flex-1 p-4 min-h-[160px]">
            {/* Entity Name */}
            <h3 className="text-white text-lg font-semibold mb-1 font-['Archivo'] leading-tight">
              {name}
            </h3>

            {/* Type, Subtype */}
            {typeDisplay && (
              <div className="flex items-center gap-1 mb-3">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0"
                >
                  <path
                    d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
                    stroke="#9CA3AF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[#9CA3AF] text-sm font-['Archivo']">
                  {typeDisplay}
                </span>
              </div>
            )}

            {/* Description */}
            {description && (
              <p className="text-[#B4B4B4] text-sm leading-relaxed font-['Archivo'] line-clamp-4">
                {description.length > 200
                  ? `${description.substring(0, 200)}...`
                  : description}
              </p>
            )}

            {/* Show properties if no description */}
            {!description && node.properties && (
              <div className="text-[#B4B4B4] text-xs space-y-1">
                {Object.entries(node.properties)
                  .slice(0, 3)
                  .map(([key, value]) => {
                    if (typeof value === 'object' || key === 'image') return null;
                    return (
                      <div key={key} className="flex gap-2">
                        <span className="text-[#707070] capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="text-[#B4B4B4] truncate">
                          {String(value).substring(0, 50)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeTooltip;
