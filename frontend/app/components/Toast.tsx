import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  dismissible?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ 
  children, 
  maxToasts = 5 
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      ...toast,
    };

    setToasts(prev => {
      const newToasts = [newToast, ...prev];
      return newToasts.slice(0, maxToasts);
    });

    // Auto remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, [maxToasts, removeToast]);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAllToasts }}>
      {children}
    </ToastContext.Provider>
  );
};

// Toast component
const ToastComponent: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({
  toast,
  onRemove,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  const typeStyles = {
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: '✓',
      iconColor: 'text-green-600',
      titleColor: 'text-green-800',
      messageColor: 'text-green-700',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: '✕',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      messageColor: 'text-red-700',
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: '⚠',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-800',
      messageColor: 'text-yellow-700',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'ℹ',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      messageColor: 'text-blue-700',
    },
  };

  const styles = typeStyles[toast.type];

  return (
    <div
      className={`
        relative flex items-start p-4 mb-3 border rounded-lg shadow-lg transition-all duration-300 ease-in-out
        ${styles.bg} ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isExiting ? 'translate-x-full opacity-0' : ''}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className={`flex-shrink-0 ${styles.iconColor} text-xl mr-3`}>
        {styles.icon}
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className={`text-sm font-medium ${styles.titleColor} mb-1`}>
            {toast.title}
          </h4>
        )}
        <p className={`text-sm ${styles.messageColor}`}>
          {toast.message}
        </p>
        {toast.actions && toast.actions.length > 0 && (
          <div className="mt-3 flex gap-2">
            {toast.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  handleRemove();
                }}
                className={`
                  px-3 py-1 text-xs font-medium rounded
                  ${action.variant === 'primary' 
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {toast.dismissible && (
        <button
          onClick={handleRemove}
          className={`ml-2 ${styles.iconColor} hover:opacity-75`}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      )}
    </div>
  );
};

// Toast container
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-80 max-w-sm">
      {toasts.map(toast => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
};

// Convenience hooks for different toast types
export const useToastHelpers = () => {
  const { addToast } = useToast();

  return {
    success: (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'success', message, title, ...options }),
    
    error: (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'error', message, title, ...options }),
    
    warning: (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'warning', message, title, ...options }),
    
    info: (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'info', message, title, ...options }),
  };
};