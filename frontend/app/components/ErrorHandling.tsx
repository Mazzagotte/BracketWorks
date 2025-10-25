import React, { useState } from 'react';

import { useToastHelpers } from './Toast';
import { logger } from '../lib/logger';
import { isError, getErrorMessage } from '../lib/error-utils';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

// Enhanced Error Boundary
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.error('Error Boundary caught an error', { error: error.message, errorInfo });
    }
  }

  retry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.retry} />;
      }

      return <DefaultErrorFallback error={this.state.error!} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({
  error,
  retry,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="mb-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Something went wrong
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="text-left bg-gray-50 p-3 rounded mb-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Error Details
            </summary>
            <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap">
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={retry}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced error display component
interface ErrorMessageProps {
  error: string;
  type?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  showRetry?: boolean;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  type = 'error',
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  showRetry = true,
  className = '',
}) => {
  const typeStyles = {
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: '✕',
      iconColor: 'text-red-500',
      textColor: 'text-red-800',
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: '⚠',
      iconColor: 'text-yellow-500',
      textColor: 'text-yellow-800',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'ℹ',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-800',
    },
  };

  const styles = typeStyles[type];

  return (
    <div className={`flex items-center p-4 border rounded-lg ${styles.bg} ${className}`} role="alert">
      <div className={`${styles.iconColor} mr-3`}>
        {styles.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${styles.textColor}`}>{error}</p>
      </div>
      <div className="flex gap-2 ml-3">
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="bg-white text-gray-700 border border-gray-300 px-3 py-1 text-xs rounded hover:bg-gray-50"
          >
            {retryLabel}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${styles.iconColor} hover:opacity-75 ml-2`}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

// Hook for handling async operations with error states
interface UseAsyncOperationOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  showToast?: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  options: UseAsyncOperationOptions<T> = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const { success, error: showErrorToast } = useToastHelpers();
  const {
    onSuccess,
    onError,
    showToast = true,
    retryDelay = 1000,
    maxRetries = 3,
  } = options;

  const execute = async (isRetry = false) => {
    try {
      setLoading(true);
      setError(null);
      
      if (isRetry && retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
      }

      const result = await operation();
      setData(result);
      onSuccess?.(result);
      
      if (showToast && !isRetry) {
        success('Operation completed successfully');
      }
      
      // Reset retry count on success
      setRetryCount(0);
      
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err) || 'An unexpected error occurred';
      setError(errorMessage);
      onError?.(isError(err) ? err : new Error(errorMessage));
      
      if (showToast) {
        showErrorToast(errorMessage, 'Operation Failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      execute(true);
    }
  };

  const canRetry = retryCount < maxRetries;

  return {
    execute,
    retry,
    loading,
    error,
    data,
    canRetry,
    retryCount,
  };
}

// Network status hook
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { warning, success } = useToastHelpers();

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      success('Connection restored', 'Back Online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      warning('Please check your internet connection', 'Connection Lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [success, warning]);

  return isOnline;
}
