import { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const Toast = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.autoClose) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        // Wait for exit animation to complete before removing
        setTimeout(() => {
          onRemove(toast.id);
        }, 300); // Match animation duration
      }, toast.duration || 3000);

      return () => clearTimeout(timer);
    }
  }, [toast, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Match animation duration
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-[#1a3a1a]',
          border: 'border-[#4ade80]',
          icon: <FaCheckCircle className="text-[#4ade80]" size={20} />,
          text: 'text-[#4ade80]'
        };
      case 'error':
        return {
          bg: 'bg-[#3a1a1a]',
          border: 'border-[#f87171]',
          icon: <FaExclamationCircle className="text-[#f87171]" size={20} />,
          text: 'text-[#f87171]'
        };
      case 'warning':
        return {
          bg: 'bg-[#3a3a1a]',
          border: 'border-[#fbbf24]',
          icon: <FaExclamationTriangle className="text-[#fbbf24]" size={20} />,
          text: 'text-[#fbbf24]'
        };
      default:
        return {
          bg: 'bg-[#1a1a1a]',
          border: 'border-[#707070]',
          icon: null,
          text: 'text-[#B4B4B4]'
        };
    }
  };

  const styles = getToastStyles();

  return (
    <div
      className={`
        ${styles.bg} ${styles.border} border-l-4
        rounded-sm shadow-lg p-4 mb-3
        flex items-start gap-3
        min-w-[300px] max-w-[500px]
        ${isExiting ? 'animate-slide-out-to-right' : 'animate-slide-in-from-top'}
        backdrop-blur-sm
      `}
      role="alert"
    >
      {styles.icon && (
        <div className="flex-shrink-0 mt-0.5">
          {styles.icon}
        </div>
      )}
      <div className="flex-1">
        {toast.title && (
          <div className={`${styles.text} font-semibold text-sm mb-1`}>
            {toast.title}
          </div>
        )}
        <div className="text-[#B4B4B4] text-sm">
          {toast.message}
        </div>
      </div>
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-[#707070] hover:text-[#B4B4B4] transition-colors ml-2"
        aria-label="Close notification"
      >
        <FaTimes size={14} />
      </button>
    </div>
  );
};

export default Toast;

