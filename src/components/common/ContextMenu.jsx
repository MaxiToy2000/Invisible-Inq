import { useEffect, useRef } from 'react';
import { FaTrash } from 'react-icons/fa';

const ContextMenu = ({ x, y, onClose, onDelete, node }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleDelete = () => {
    if (onDelete && node) {
      onDelete(node);
    }
    onClose();
  };

  if (!node) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[10000] bg-[#09090B] border border-[#707070] rounded-sm shadow-lg min-w-[200px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleDelete}
        className="w-full text-left px-4 py-1 text-sm text-[#B4B4B4] hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
      >
        <FaTrash className="text-[#707070]" size={14} />
        <span>Delete Node</span>
      </button>
    </div>
  );
};

export default ContextMenu;

