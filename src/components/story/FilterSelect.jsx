import { useState, useEffect, useRef } from 'react';
import { FaChevronDown, FaSearch } from 'react-icons/fa';

const FilterSelect = ({
  label,
  options = [],
  selectedValue = null,
  onSelect,
  placeholder = 'Select...',
  disabled = false,
  isLoading = false,
  hasChildSelected = false,
  dropdownWidth = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOptions = searchTerm
    ? options.filter(option => {
        const displayText = option.label || option.title || option.name || String(option.value || '');
        return displayText.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : options;

  const selectedOption = options.find(opt => {
    const optValue = opt.value || opt.id;
    return optValue === selectedValue;
  });
  const selectedLabel = selectedOption
    ? (selectedOption.label || selectedOption.title || selectedOption.name || String(selectedValue))
    : placeholder;

  const handleSelect = (option) => {
    const value = option.value || option.id;
    if (onSelect) {
      onSelect(value, option);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`${hasChildSelected ? 'mt-2' : 'mt-4'}`}>
      <div className="relative inline-block" ref={dropdownRef}>
        {}
        <button
          type="button"
          onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
          disabled={disabled || isLoading}
          className={`${hasChildSelected ? `text-[14px]` : `text-[18px]`}
            inline-flex items-center py-0.5 px-3 rounded-lg
            text-sm font-bold truncate
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            focus:outline-none transition-colors
            ${isOpen
              ? 'bg-[#3A3A3A] text-white border-none'
              : hasChildSelected
                ? 'bg-[#2C2C37] text-white border border-[#4A4A4A] hover:bg-[#3A3A3A]'
                : 'bg-[#09090B] text-white border border-[#4A4A4A] hover:bg-[#3A3A3A]'
            }
          `}
          style={dropdownWidth ? { maxWidth: `${dropdownWidth - 24}px` } : undefined}
          title={selectedLabel && selectedLabel !== placeholder ? selectedLabel : undefined}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label || placeholder}
        >
          <FaChevronDown
            className={`mr-2 flex-shrink-0 transition-transform text-white ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            size={14}
          />
          <span className="text-left text-white font-bold truncate block max-w-full">
            {isLoading ? 'Loading...' : selectedLabel}
          </span>
        </button>

        {}
        {isOpen && !disabled && !isLoading && (
          <div
            className="absolute z-50 mt-1 bg-[#1F1F1F] border border-[#1F1F1F] rounded shadow-lg max-h-64 overflow-auto left-0 right-auto"
            style={dropdownWidth ? { width: `${dropdownWidth - 24}px` } : { width: '100%' }}
          >
            {}
            {options.length > 5 && (
              <div className="sticky top-0 bg-[#1F1F1F] p-1.5">
                <div className="relative">
                  <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs" />
                  <input
                    type="text"
                    className="w-full pl-6 pr-3 py-1 border border-[#707070] rounded text-[#F4F4F5] bg-[#1F1F1F] text-sm"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {}
            <ul className="py-1" role="listbox">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const value = option.value || option.id;
                  const label = option.label || option.title || option.name || String(value);
                  const isSelected = value === selectedValue;
                  
                  // Create a unique key by combining value/id with index to ensure uniqueness
                  // This prevents duplicate key errors even if values are duplicated
                  const uniqueKey = value != null ? `${value}-${index}` : `option-${index}`;

                  return (
                    <li
                      key={uniqueKey}
                      className={`                        px-2 py-1 cursor-pointer text-sm
                        ${isSelected
                          ? 'bg-[#2C2C37] font-bold text-[#F4F4F5]'
                          : 'hover:bg-[#2C2C37] text-[#F4F4F5]'
                        }
                      `}
                      onClick={() => handleSelect(option)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {label}
                    </li>
                  );
                })
              ) : (
                <li className="px-2 py-1 text-gray-500 italic text-sm">
                  No options available
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterSelect;
