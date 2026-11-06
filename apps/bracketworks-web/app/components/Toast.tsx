'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Button, ICON_SIZE } from '@bracketworks/ui';
import styles from './Toast.module.css';

const TOAST_ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

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

  const Icon = TOAST_ICONS[toast.type];

  return (
    <div
      className={styles.toast}
      data-visible={isVisible && !isExiting ? 'true' : 'false'}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <Icon size={ICON_SIZE.md} aria-hidden="true" className={styles[toast.type]} />
      <div className={styles.text}>
        {toast.title ? <p className={styles.title}>{toast.title}</p> : null}
        <p className={styles.message}>{toast.message}</p>
        {toast.actions && toast.actions.length > 0 ? (
          <div className={styles.actions}>
            {toast.actions.map((action, index) => (
              <Button
                key={index}
                size="sm"
                variant={action.variant === 'primary' ? 'primary' : 'secondary'}
                onClick={() => {
                  action.onClick();
                  handleRemove();
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {toast.dismissible ? (
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          icon={<X size={ICON_SIZE.md} aria-hidden="true" />}
          aria-label="Dismiss notification"
          onClick={handleRemove}
        />
      ) : null}
    </div>
  );
};

// Toast container
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack}>
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

  const success = useCallback(
    (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'success', message, title, ...options }),
    [addToast]
  );

  const error = useCallback(
    (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'error', message, title, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'warning', message, title, ...options }),
    [addToast]
  );

  const info = useCallback(
    (message: string, title?: string, options?: Partial<Toast>) =>
      addToast({ type: 'info', message, title, ...options }),
    [addToast]
  );

  return useMemo(
    () => ({ success, error, warning, info }),
    [success, error, warning, info]
  );
};
