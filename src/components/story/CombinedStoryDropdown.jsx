import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaSearch, FaChevronDown } from 'react-icons/fa';

const CombinedStoryDropdown = ({
  stories = [],
  selectedStoryId = null,
  selectedChapterId = null,
  selectedSubstoryId = null,
  onStorySelect,
  onChapterSelect,
  onSubstorySelect,
  onOptionSelect,
  inHeader = false,
  isMobileFullWidth = false,
  isGraphPage = false,
  placeholder = 'Select a story'
}) => {
  const [options, setOptions] = useState([]);
  const [selectedValue, setSelectedValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const newOptions = [];

    stories.forEach(story => {
      newOptions.push({
        value: `header-${story.id}`,
        label: `${story.title}`,
        storyId: story.id,
        chapterId: null,
        substoryId: null,
        isHeader: true
      });

      if (story.chapters && story.chapters.length > 0) {
        story.chapters.forEach(chapter => {
          if (chapter.substories && chapter.substories.length > 0) {
            chapter.substories.forEach(substory => {
              newOptions.push({
                value: `${story.id}-${chapter.id}-${substory.id}`,
                label: `   ${chapter.title} > ${substory.title}`,
                storyId: story.id,
                chapterId: chapter.id,
                substoryId: substory.id
              });
            });
          }
        });
      }
    });

    setOptions(newOptions);
  }, [stories]);

  useEffect(() => {
    if (selectedStoryId && selectedChapterId && selectedSubstoryId) {
      setSelectedValue(`${selectedStoryId}-${selectedChapterId}-${selectedSubstoryId}`);
    } else {
      setSelectedValue('');
    }
  }, [selectedStoryId, selectedChapterId, selectedSubstoryId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  const handleOptionSelect = (option) => {
    if (option.isHeader) {
      return;
    }

    setSelectedValue(option.value);
    setIsOpen(false);
    setSearchTerm('');

    if (onOptionSelect) {
      onOptionSelect(option);
      return;
    }

    if (onStorySelect) onStorySelect(option.storyId);

    setTimeout(() => {
      if (onChapterSelect) onChapterSelect(option.chapterId);

      setTimeout(() => {
        if (onSubstorySelect) onSubstorySelect(option.substoryId);
      }, 50);
    }, 50);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  const filteredOptions = searchTerm
    ? (() => {
        const matchingStoryIds = options
          .filter(option => option.isHeader && option.label.toLowerCase().includes(searchTerm))
          .map(option => option.storyId);

        const filtered = options.filter(option => {
          if (option.label.toLowerCase().includes(searchTerm)) {
            return true;
          }

          if (option.isHeader && options.some(o =>
            !o.isHeader &&
            o.storyId === option.storyId &&
            o.label.toLowerCase().includes(searchTerm)
          )) {
            return true;
          }

          if (!option.isHeader && matchingStoryIds.includes(option.storyId)) {
            return true;
          }

          return false;
        });

        const seen = new Set();
        return filtered.filter(option => {
          if (seen.has(option.value)) {
            return false;
          }
          seen.add(option.value);
          return true;
        });
      })()
    : options;

  const selectedOption = options.find(option => option.value === selectedValue);
  const selectedLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={inHeader ? "h-full" : isMobileFullWidth ? "w-full h-full" : "space-y-1.5"}>
      {}
      {false && !inHeader && !isMobileFullWidth && (
        <label htmlFor="combined-story-select" className="block text-sm font-medium text-black mb-0.5">
          Story Selection
        </label>
      )}
      <div className={`relative ${inHeader ? "h-full" : ""} ${isMobileFullWidth ? "w-full h-full" : ""}`} ref={dropdownRef}>
        {}
        <button
          type="button"
          className={`w-full
            ${inHeader ? "h-full" : isMobileFullWidth ? "h-full" : "py-2.5"}
            ${inHeader ? "px-3" : isMobileFullWidth ? "px-4" : "px-4"}
            ${inHeader ? "border-r" : isMobileFullWidth ? "border-none" : "border"} border-[#707070]
            ${inHeader ? "rounded-none" : isMobileFullWidth ? "rounded-none" : "rounded-lg"}
            text-white bg-[#1F1F1F] flex items-center justify-center text-sm font-bold`}
          onClick={toggleDropdown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <FaChevronDown className={`mr-2 transition-transform ${isOpen ? 'transform rotate-180' : ''} text-xs text-white`} />
          <span className="truncate">{selectedLabel}</span>
        </button>

        {}
        {isOpen && (
          <div className={`absolute z-50 ${inHeader ? "mt-0" : isMobileFullWidth ? "mt-0" : "mt-1"} w-full bg-[#1F1F1F] border border-[#1F1F1F] rounded shadow-lg ${isGraphPage ? "max-h-[32rem]" : "max-h-68"} overflow-auto`}>
            {}
            <div className="sticky top-0 bg-[#1F1F1F] p-1.5 border-b border-[#707070]">
              <div className="relative">
                <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-6 pr-3 py-1 border border-[#707070] rounded text-[#F4F4F5] bg-[#1F1F1F] text-sm"
                  placeholder="Search stories..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
            </div>

            {}
            <ul className="py-1">
              {filteredOptions.map((option, index) => {
                const uniqueKey = `${option.value}-${index}`;
                return (
                  <li
                    key={uniqueKey}
                    className={`                      px-2 py-1 cursor-pointer text-sm
                      ${option.isHeader
                        ? 'font-bold bg-[#1f1f1f] text-[#F4F4F5] sticky top-[38px] z-10'
                        : 'hover:bg-[#2C2C37] pl-5 text-[#F4F4F5]'}
                      ${option.value === selectedValue ? 'bg-blue-50 font-bold' : ''}
                    `}
                    onClick={() => handleOptionSelect(option)}
                    role={option.isHeader ? 'presentation' : 'option'}
                    aria-selected={option.value === selectedValue}
                  >
                    {option.label}
                  </li>
                );
              })}
              {filteredOptions.length === 0 && (
                <li className="px-2 py-1 text-gray-500 italic text-sm">No results found</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

CombinedStoryDropdown.propTypes = {
  stories: PropTypes.array,
  selectedStoryId: PropTypes.string,
  selectedChapterId: PropTypes.string,
  selectedSubstoryId: PropTypes.string,
  onStorySelect: PropTypes.func,
  onChapterSelect: PropTypes.func,
  onSubstorySelect: PropTypes.func,
  onOptionSelect: PropTypes.func,
  inHeader: PropTypes.bool,
  isMobileFullWidth: PropTypes.bool,
  isGraphPage: PropTypes.bool,
  placeholder: PropTypes.string
};

export default CombinedStoryDropdown;
