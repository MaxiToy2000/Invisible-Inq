import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: toast.type || 'info',
      message: toast.message || '',
      title: toast.title,
      duration: toast.duration || 3000,
      autoClose: toast.autoClose !== false,
      ...toast
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message, title = 'Success', options = {}) => {
    return addToast({ type: 'success', message, title, ...options });
  }, [addToast]);

  const showError = useCallback((message, title = 'Error', options = {}) => {
    return addToast({ type: 'error', message, title, ...options });
  }, [addToast]);

  const showWarning = useCallback((message, title = 'Warning', options = {}) => {
    return addToast({ type: 'warning', message, title, ...options });
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

