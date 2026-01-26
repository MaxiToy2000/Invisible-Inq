import { useState, useRef, useEffect } from 'react';
import { FaTimes, FaPlus, FaChevronDown, FaArrowsAlt, FaWindowMaximize, FaWindowRestore, FaExpandArrowsAlt } from 'react-icons/fa';

const AddNodeModal = ({ isOpen, onClose, onCreate, existingCategories = [], nodeTypesWithPropertyKeys = [] }) => {
  // New DB uses lowercase labels (e.g. "entity", "relationship")
  const [category, setCategory] = useState('entity');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [properties, setProperties] = useState([{ name: '', value: '' }]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef(null);
  const categoryInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter categories based on input
  const filteredCategories = existingCategories.filter(cat =>
    cat.toLowerCase().includes(category.toLowerCase())
  );

  // Initialize properties when modal opens with default category
  useEffect(() => {
    if (isOpen && category && nodeTypesWithPropertyKeys.length > 0) {
      const nodeTypeData = nodeTypesWithPropertyKeys.find(
        item => item.nodeType === category
      );
      
      if (nodeTypeData && nodeTypeData.propertyKeys && nodeTypeData.propertyKeys.length > 0) {
        const newProperties = nodeTypeData.propertyKeys.map(key => ({
          name: key,
          value: ''
        }));
        setProperties(newProperties);
      }
    }
  }, [isOpen, category, nodeTypesWithPropertyKeys]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          categoryInputRef.current && !categoryInputRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCategoryDropdown]);

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!isOpen) return null;

  const handleAddProperty = () => {
    setProperties([...properties, { name: '', value: '' }]);
  };

  const handleRemoveProperty = (index) => {
    if (properties.length > 1) {
      setProperties(properties.filter((_, i) => i !== index));
    }
  };

  const handlePropertyChange = (index, field, value) => {
    const updated = [...properties];
    updated[index][field] = value;
    setProperties(updated);
  };

  const handleCategorySelect = (selectedCategory) => {
    setCategory(selectedCategory);
    setShowCategoryDropdown(false);
    
    // Find the property keys for the selected category
    const nodeTypeData = nodeTypesWithPropertyKeys.find(
      item => item.nodeType === selectedCategory
    );
  
    // Set properties based on nodeTypeData property keys
    if (nodeTypeData && nodeTypeData.propertyKeys && nodeTypeData.propertyKeys.length > 0) {
      // Create properties array with each property key as a name and empty value
      const newProperties = nodeTypeData.propertyKeys.map(key => ({
        name: key,
        value: ''
      }));
      setProperties(newProperties);
    } else {
      // If no property keys found, reset to single empty property
      setProperties([{ name: '', value: '' }]);
    }
  };


  const handleCreate = () => {
    const filteredProperties = properties.filter(
      prop => prop.name.trim() !== '' && prop.value.trim() !== ''
    );
    
    const nodeData = {
      category: category.trim() || 'Uncategorized',
      properties: filteredProperties.reduce((acc, prop) => {
        acc[prop.name] = prop.value;
        return acc;
      }, {})
    };

    if (onCreate) {
      onCreate(nodeData);
    }
    
    // Reset form
    setCategory('entity');
    setProperties([{ name: '', value: '' }]);
    onClose();
  };

  const handleCancel = () => {
    setCategory('entity');
    setProperties([{ name: '', value: '' }]);
    onClose();
  };

  const handleStartDrag = (e) => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`bg-[#09090B] border border-[#707070] rounded-lg shadow-lg text-white overflow-hidden flex flex-col ${
          isMaximized ? 'w-full h-full max-w-[95vw] max-h-[95vh]' : 'w-full max-w-2xl max-h-[90vh]'
        }`}
        style={!isMaximized && (position.x !== 0 || position.y !== 0) ? {
          transform: `translate(${position.x}px, ${position.y}px)`
        } : {}}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b border-[#707070] flex-shrink-0 cursor-move"
          onMouseDown={handleStartDrag}
        >
          <div className="flex items-center gap-2">
            <FaPlus className="text-[#B4B4B4]" size={16} />
            <h2 className="text-lg font-semibold">Add Node</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Move button */}
            <button
              className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
              title="Move"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleStartDrag(e);
              }}
            >
              <FaExpandArrowsAlt className="text-[#B4B4B4]" size={14} />
            </button>
            {/* Maximize/Restore button */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <FaWindowRestore className="text-[#B4B4B4]" size={14} />
              ) : (
                <FaWindowMaximize className="text-[#B4B4B4]" size={14} />
              )}
            </button>
            {/* Close button */}
            <button
              onClick={handleCancel}
              className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
              title="Close"
            >
              <FaTimes className="text-[#B4B4B4]" size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Category Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-[#B4B4B4] mb-2">
              Category
            </label>
            <div className="relative">
              <input
                ref={categoryInputRef}
                type="text"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setShowCategoryDropdown(true);
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                placeholder="Select Category or enter a new Category label"
                className="w-full h-10 px-3 pr-10 rounded-sm border border-[#707070] bg-[#09090B] text-[#B4B4B4] placeholder-[#707070] focus:outline-none focus:border-[#B4B4B4] transition-colors"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <FaChevronDown className="text-[#707070]" size={12} />
              </div>
              
              {/* Dropdown */}
              {showCategoryDropdown && filteredCategories.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-10 w-full mt-1 bg-[#09090B] border border-[#707070] rounded-sm shadow-lg max-h-48 overflow-y-auto"
                >
                  {/* Category options */}
                  {filteredCategories.map((cat, index) => (
                    <button
                      key={index}
                      onClick={() => handleCategorySelect(cat)}
                      className="w-full text-left px-3 py-2 text-sm text-[#B4B4B4] hover:bg-[#1a1a1a] transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Properties Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[#B4B4B4]">
                Properties
              </label>
              <button
                onClick={handleAddProperty}
                className="text-xs text-[#5C9EFF] hover:text-[#7BB3FF] transition-colors"
              >
                + Add Property
              </button>
            </div>
            
            {/* Property Headers */}
            <div className="grid grid-cols-2 gap-2 mb-2 pb-2 border-b border-[#707070]">
              <div className="text-xs font-medium text-[#B4B4B4]">Property Name</div>
              <div className="text-xs font-medium text-[#B4B4B4]">Property Value</div>
            </div>

            {/* Property Inputs */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {properties.map((property, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 items-center">
                  <input
                    type="text"
                    value={property.name}
                    onChange={(e) => handlePropertyChange(index, 'name', e.target.value)}
                    placeholder="Property Name"
                    className="h-8 px-2 rounded-sm border border-[#707070] bg-[#09090B] text-[#B4B4B4] placeholder-[#707070] focus:outline-none focus:border-[#B4B4B4] transition-colors text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={property.value}
                      onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                      placeholder="Property Value"
                      className="flex-1 h-8 px-2 rounded-sm border border-[#707070] bg-[#09090B] text-[#B4B4B4] placeholder-[#707070] focus:outline-none focus:border-[#B4B4B4] transition-colors text-sm"
                    />
                    {properties.length > 1 && (
                      <button
                        onClick={() => handleRemoveProperty(index)}
                        className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                        title="Remove Property"
                      >
                        <FaTimes className="text-[#707070] hover:text-[#B4B4B4]" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#707070] flex-shrink-0">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#B4B4B4] transition-colors text-sm font-medium"
          >
            <FaTimes size={12} />
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#5C9EFF] hover:bg-[#7BB3FF] text-white transition-colors text-sm font-medium"
          >
            <FaPlus size={12} />
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddNodeModal;

