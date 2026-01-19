import React from 'react';

/**
 * Shared empty-state component for areas with no data to display.
 * Accepts optional title and description for contextual messaging.
 */
const EmptyState = ({
  title = 'No data available',
  description = null,
  className = '',
}) => {
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center ${className}`}>
      <div className="flex flex-col items-center gap-2 max-w-md px-4 text-center">
        <div className="text-[#F4F4F5] text-base font-semibold">
          {title}
        </div>
        {description && (
          <div className="text-[#A1A1AA] text-xs">
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;


