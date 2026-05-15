'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { API } from '../lib/api';
import { isError } from '../lib/error-utils';

export type ConnectionQuality = 'fast' | 'good' | 'slow' | 'poor';

export type NetworkRequestError = {
  message: string;
  shouldRetry: boolean;
};

function getConnectionQuality(): ConnectionQuality {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number };
    }).connection;

    if (connection) {
      if (connection.effectiveType === '4g' && (connection.downlink ?? 0) > 5) return 'fast';
      if (connection.effectiveType === '3g' || (connection.downlink ?? 0) < 1) return 'slow';
      if (connection.effectiveType === '2g' || (connection.downlink ?? 0) < 0.5) return 'poor';
    }
  }

  return 'good';
}

export function describeNetworkRequestError(
  error: unknown,
  connectionQuality: ConnectionQuality
): NetworkRequestError {
  const isNetworkError = isError(error) && (error.name === 'TypeError' || error.message.includes('Failed to fetch'));
  const isTimeoutError = isError(error) && (error.name === 'AbortError' || error.message.includes('timeout'));
  const isConnectionError = isError(error) && error.message.includes('No internet connection');

  if (isConnectionError) {
    return {
      message: 'No internet connection detected. Please check your network.',
      shouldRetry: true,
    };
  }

  if (isNetworkError) {
    return {
      message: `Connection failed${connectionQuality === 'poor' ? ' (poor connection detected)' : ''}. Please try again.`,
      shouldRetry: true,
    };
  }

  if (isTimeoutError) {
    return {
      message: `Request timed out${connectionQuality === 'slow' || connectionQuality === 'poor' ? ' (slow connection detected)' : ''}. Please try again.`,
      shouldRetry: true,
    };
  }

  return {
    message: '',
    shouldRetry: false,
  };
}

export function useNetworkRequest() {
  const retryQueueRef = useRef<Array<() => Promise<void>>>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('good');
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [pendingRetryCount, setPendingRetryCount] = useState(0);

  const enqueueRetry = useCallback((retryCallback: () => Promise<void>) => {
    retryQueueRef.current.push(retryCallback);
    setPendingRetryCount(retryQueueRef.current.length);
  }, []);

  const processRetryQueue = useCallback(async () => {
    if (!navigator.onLine || retryQueueRef.current.length === 0) {
      return;
    }

    const pendingRetries = [...retryQueueRef.current];
    retryQueueRef.current = [];
    setPendingRetryCount(0);

    for (const retryCallback of pendingRetries) {
      try {
        await retryCallback();
      } catch {
        // Leave retry failures to the page-level error handling.
      }
    }
  }, []);

  const dismissConnectionStatus = useCallback(() => {
    setShowConnectionStatus(false);
  }, []);

  const measureConnectionQuality = useCallback(async () => {
    if (!navigator.onLine) {
      setConnectionQuality('poor');
      setShowConnectionStatus(true);
      return;
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(API('/api/health'), {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (responseTime < 500) {
        setConnectionQuality('good');
      } else if (responseTime < 2000) {
        setConnectionQuality('slow');
      } else {
        setConnectionQuality('poor');
      }

      setShowConnectionStatus(responseTime > 1000);
    } catch {
      setConnectionQuality('poor');
      setShowConnectionStatus(true);
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return;
    }

    setIsOnline(navigator.onLine);
    setConnectionQuality(getConnectionQuality());

    const handleOnline = () => {
      setIsOnline(true);
      setConnectionQuality(getConnectionQuality());
      processRetryQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionQuality('poor');
      setShowConnectionStatus(true);
    };

    measureConnectionQuality();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const qualityInterval = setInterval(() => {
      measureConnectionQuality();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(qualityInterval);
    };
  }, [measureConnectionQuality, processRetryQueue]);

  const fetchWithRetry = useCallback(
    async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        try {
          if (!navigator.onLine) {
            throw new Error('No internet connection');
          }

          const controller = new AbortController();
          const timeoutMs = connectionQuality === 'slow' || connectionQuality === 'poor' ? 15000 : 10000;
          timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          return response;
        } catch (error) {
          lastError = error;

          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          const isLastAttempt = attempt === maxRetries;
          const isRetryableError = isError(error) && (
            error.name === 'TypeError' ||
            error.name === 'AbortError' ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('timeout') ||
            error.message.includes('No internet connection')
          );

          if (isLastAttempt || !isRetryableError) {
            throw error;
          }

          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError || new Error('Request failed after retries');
    },
    [connectionQuality]
  );

  return {
    connectionQuality,
    dismissConnectionStatus,
    enqueueRetry,
    fetchWithRetry,
    isOnline,
    pendingRetryCount,
    showConnectionStatus,
  };
}