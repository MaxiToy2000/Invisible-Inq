import { useState, useEffect } from 'react';
import { FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const EditableContent = ({
  content,
  storageKey,
  onSave,
  className = '',
  tag: Tag = 'div',
  editable = true,
  placeholder = 'Click edit to add content...'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [savedContent, setSavedContent] = useState(content);

  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSavedContent(parsed);
          setEditedContent(parsed);
        } catch (e) {
          setSavedContent(saved);
          setEditedContent(saved);
        }
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (content !== undefined) {
      setSavedContent(content);
      setEditedContent(content);
    }
  }, [content]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    const contentToSave = typeof editedContent === 'string'
      ? editedContent
      : JSON.stringify(editedContent);

    if (storageKey) {
      localStorage.setItem(storageKey, contentToSave);
    }

    setSavedContent(editedContent);
    setIsEditing(false);

    if (onSave) {
      onSave(editedContent);
    }
  };

  const handleCancel = () => {
    setEditedContent(savedContent);
    setIsEditing(false);
  };

  const handleChange = (e) => {
    const newValue = e.target.value;

    setEditedContent(newValue);
  };

  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const hasHtml = (content) => {
    if (!content) return false;
    return /<[a-z][\s\S]*>/i.test(content);
  };

  if (!editable) {
    return <Tag className={className} dangerouslySetInnerHTML={{ __html: savedContent || placeholder }} />;
  }

  const displayContent = savedContent || placeholder;
  const isHtml = hasHtml(displayContent);

  return (
    <div className={`relative group ${className}`}>
      {isEditing ? (
        <div className="space-y-2">
          {typeof editedContent === 'string' ? (
            <textarea
              value={isHtml ? stripHtml(editedContent) : editedContent}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-[#707070] rounded-md shadow-sm bg-[#222222] text-white focus:outline-none focus:ring-gray-500 focus:border-gray-400 min-h-[100px] font-mono text-sm"
              placeholder={placeholder}
            />
          ) : (
            <div className="text-gray-400 text-sm">Complex content editing not yet supported</div>
          )}
          {isHtml && (
            <p className="text-xs text-gray-500">
              Note: HTML tags will be removed. You can add basic formatting using plain text.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#2699FB] text-white rounded hover:bg-[#1a7dd4] transition-colors text-sm"
            >
              <FaSave size={12} />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#707070] text-white rounded hover:bg-[#5a5a5a] transition-colors text-sm"
            >
              <FaTimes size={12} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          {isHtml ? (
            <Tag
              className={className}
              dangerouslySetInnerHTML={{ __html: displayContent }}
            />
          ) : (
            <Tag className={className}>{displayContent}</Tag>
          )}
          <button
            onClick={handleEdit}
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 bg-[#3A3A3A] text-white rounded hover:bg-[#4A4A4A] text-xs z-10"
            title="Edit content"
          >
            <FaEdit size={14} />
            Edit
          </button>
        </div>
      )}
    </div>
  );
};

export default EditableContent;
