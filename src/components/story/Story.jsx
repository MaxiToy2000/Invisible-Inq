import React from 'react';
import PropTypes from 'prop-types';
import { FaArrowLeftLong, FaArrowRightLong } from 'react-icons/fa6';

const Story = ({
  stories = [],
  currentStory = null,
  entityHighlights = [],
  onStorySelect,
  onPrevious,
  onNext,
  onEntitySelect,
  storyType = 'regular'
}) => {
  const handleStorySelect = (e) => {
    if (onStorySelect) onStorySelect(e.target.value);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col">
        {}
        <div className="mb-4">
          <select
            className="w-full p-2 border border-gray-300 rounded text-gray-800 bg-white"
            value={currentStory?.id || ''}
            onChange={handleStorySelect}
            aria-label="Select a story"
          >
            <option value="">{storyType === 'sample' ? 'Sample Story' : 'Story'}</option>
            {stories.map(story => (
              <option key={story.id} value={story.id}>
                {story.title}
              </option>
            ))}
          </select>
        </div>

        {}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2 text-gray-800">Story Title</h3>
          <p className="text-sm text-gray-700 mb-4">
            {currentStory?.brief || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut malesuada diam. Nullam id orci egestas lacinia."}
          </p>
        </div>

        {}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Chapter Title</h3>
          <p className="text-sm text-gray-700">
            {currentStory?.chapter?.brief || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut malesuada diam. Nullam id orci egestas lacinia. Sed et perniciosis unde neque varius odio error sit malesuada accumsan aeternium ipsum luctorum."}
          </p>
        </div>

        {}
        {entityHighlights.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium mb-2 text-gray-800">Entity Highlights</h4>
            <ul className="space-y-1">
              {entityHighlights.map(entity => (
                <li
                  key={entity.id}
                  className="cursor-pointer text-blue-700 hover:underline text-xs"
                  onClick={() => onEntitySelect && onEntitySelect(entity.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onEntitySelect && onEntitySelect(entity.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select entity: ${entity.name}`}
                >
                  {entity.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {}
      <div className="mt-auto">
        <div className="flex justify-between items-center space-x-2">
          <button
            onClick={onPrevious}
            onKeyDown={(e) => e.key === 'Enter' && onPrevious()}
            className="p-0 text-[#2699FB] text-sm flex items-center nav-link-button"
            aria-label="Go to previous story"
            tabIndex={0}
          >
            <FaArrowLeftLong className="mr-1" /> Prev
          </button>
          <button
            onClick={onNext}
            onKeyDown={(e) => e.key === 'Enter' && onNext()}
            className="p-0 text-[#2699FB] text-sm flex items-center nav-link-button"
            aria-label="Go to next story"
            tabIndex={0}
          >
            Next <FaArrowRightLong className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

Story.propTypes = {
  stories: PropTypes.array,
  currentStory: PropTypes.object,
  entityHighlights: PropTypes.array,
  onStorySelect: PropTypes.func,
  onPrevious: PropTypes.func,
  onNext: PropTypes.func,
  onEntitySelect: PropTypes.func,
  storyType: PropTypes.oneOf(['regular', 'sample'])
};

export default Story;
