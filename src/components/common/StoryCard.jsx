import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';

const StoryCard = ({ story, onClick, onChapterSelect, totalNodes = 0, entityCount = 0, highlightedNodes = 0, updatedDate = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const dropdownRef = useRef(null);
  
  // Calculate total number of chapters
  const totalChapters = story?.chapters?.length || 0;
  
  // Calculate total nodes across all chapters
  const calculatedTotalNodes = story?.chapters?.reduce((sum, chapter) => {
    return sum + (chapter?.total_nodes || 0);
  }, 0) || 0;
  
  // Use calculated total if available, otherwise fall back to prop
  const displayTotalNodes = calculatedTotalNodes > 0 ? calculatedTotalNodes : totalNodes;
  
  // Calculate total sections across all chapters
  const totalSections = story?.chapters?.reduce((sum, chapter) => {
    return sum + (chapter?.substories?.length || 0);
  }, 0) || 0;

  // Format date if provided
  const formattedDate = updatedDate 
    ? new Date(updatedDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  // Format numbers with commas
  const formatNumber = (num) => {
    if (num === 0) return '0';
    return num.toLocaleString('en-US');
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const toggleDropdown = (e) => {
    e.stopPropagation(); // Prevent card click
    setIsOpen(!isOpen);
  };
  
  const handleChapterClick = (chapter, e) => {
    e.stopPropagation(); // Prevent card click
    setSelectedChapter(chapter);
    setIsOpen(false);
    if (onChapterSelect && chapter) {
      onChapterSelect(story.id, chapter.id);
    }
  };

  const displayText = selectedChapter 
    ? `${selectedChapter.title} → ${story?.title || 'Untitled Story'}`
    : story?.title || 'Untitled Story';

  return (
    <div 
      className="flex flex-col w-full cursor-pointer group transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-md hover:shadow-white/10 gap-[15px] p-[1px] relative min-h-0 border border-[#d3d3d3] rounded-[5px]"
      onClick={onClick}
    >
      {/* Top section with light grey background - approximately half the card height */}
      <div 
        className="relative w-full overflow-hidden transition-all duration-300 group-hover:brightness-110 rounded-[5px] bg-[#D3D3D3] aspect-[297/191]"
      >
        {/* Hover overlay effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* UPDATING pill badge in top-left */}
        <div
          className="absolute top-0 left-0 z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg bg-[#00B25F] rounded-full px-3 py-1 m-2 text-[11px] font-semibold text-white uppercase tracking-[0.5px]"
        >
          NEW
        </div>
      </div>

      {/* Dark grey horizontal bar with title */}

        
        {/* Chapter Select Dropdown - Similar to CombinedStoryDropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={toggleDropdown}
            className="w-full py-2.5 px-4 border border-[#707070] rounded-lg text-white bg-[#1F1F1F] flex items-center justify-left text-sm font-bold transition-all duration-300 group-hover:text-[#FFD700]"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <FaChevronDown className={`mr-2 transition-transform ${isOpen ? 'transform rotate-180' : ''} text-xs text-white`} />
            <span className="truncate">{displayText}</span>
          </button>

          {/* Dropdown Menu */}
          {isOpen && story?.chapters && story.chapters.length > 0 && (
            <div className="absolute z-50 w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded shadow-lg max-h-68 overflow-auto top-full left-0 right-0">
              <ul className="py-1">
                {/* Story Header */}
                <li
                  className="px-2 py-1 font-bold bg-[#1f1f1f] text-[#F4F4F5] sticky top-0 z-10 text-sm"
                  role="presentation"
                >
                  {story?.title || 'Untitled Story'}
                </li>
                {/* Chapter Options */}
                {story.chapters.map((chapter) => (
                  <li
                    key={chapter.id}
                    className="px-2 py-1 cursor-pointer text-sm hover:bg-[#2C2C37] pl-5 text-[#F4F4F5]"
                    onClick={(e) => handleChapterClick(chapter, e)}
                    role="option"
                    aria-selected={selectedChapter?.id === chapter.id}
                  >
                    {chapter.title} → {story.title} ({formatNumber(chapter.total_nodes || 0)} nodes)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      {/* Bottom section with black background - fills remaining space */}
      <div
        className="w-full transition-all duration-300 group-hover:bg-[#0A0A0A] group-hover:shadow-inner bg-black pt-1 rounded-lg flex-1 px-2 pb-2 min-h-0"
      >
        {/* Introduction paragraph */}
        <p
          className="transition-colors duration-300 group-hover:text-gray-200 text-white text-sm leading-[1.6] mb-3"
        >
          {story?.brief ? story.brief : 'Explore this investigative story to uncover connections and insights.'}
        </p>

        {/* Statistics */}
        <div className="flex flex-col gap-0.5">
          <div 
            className="transition-all duration-300 group-hover:translate-x-1 text-[#7D7D7D] text-[13px]"
          >
            chapters: <strong className="transition-colors text-[15px] font-['Archivo'] text-white duration-300 group-hover:text-[#ffffff]">{formatNumber(totalChapters)}</strong>
          </div>
          <div 
            className="transition-all duration-300 delay-100 group-hover:translate-x-1 text-[#7D7D7D] text-[13px]"
          >
            sections: <strong className="transition-colors text-[15px] font-['Archivo'] text-white duration-300 group-hover:text-[#ffffff]">{formatNumber(totalSections)}</strong>
          </div>
          <div 
            className="transition-all duration-300 group-hover:translate-x-1 text-[#7D7D7D] text-[13px]"
          >
            nodes: <strong className="transition-colors text-[15px] font-['Archivo'] text-white duration-300 group-hover:text-[#ffffff]">{formatNumber(displayTotalNodes)}</strong>
          </div>
          <div 
            className="transition-all duration-300 delay-75 group-hover:translate-x-1 text-[#7D7D7D] text-[13px]"
          >
            entities mentioned: <strong className="transition-colors text-[15px] font-['Archivo'] text-white duration-300 group-hover:text-[#ffffff]">{formatNumber(entityCount)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

StoryCard.propTypes = {
  story: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    headline: PropTypes.string,
    brief: PropTypes.string,
    chapters: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      substories: PropTypes.array
    }))
  }),
  onClick: PropTypes.func,
  onChapterSelect: PropTypes.func,
  totalNodes: PropTypes.number,
  entityCount: PropTypes.number,
  highlightedNodes: PropTypes.number,
  updatedDate: PropTypes.string
};

export default StoryCard;

