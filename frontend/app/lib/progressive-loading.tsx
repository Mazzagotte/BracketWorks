'use client';

import { Suspense, lazy, ComponentType } from 'react';
import { Skeleton } from '../components/LoadingComponents';

/**
 * Progressive loading utilities for deferring non-critical content
 */

interface ProgressiveLoadOptions {
  fallback?: React.ReactNode;
  delay?: number;
}

/**
 * Defer loading of a component until it's needed
 * Useful for below-the-fold content or secondary features
 */
export function deferredComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: ProgressiveLoadOptions = {}
) {
  const { fallback = <Skeleton width="100%" height="200px" />, delay = 0 } = options;
  
  const LazyComponent = lazy(() => {
    if (delay > 0) {
      return new Promise<{ default: ComponentType<P> }>(resolve => {
        setTimeout(() => {
          importFn().then(module => resolve(module));
        }, delay);
      });
    }
    return importFn();
  });

  return function DeferredComponent(props: P) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props as any} />
      </Suspense>
    );
  };
}

/**
 * Load data in priority order
 * Returns immediately with critical data, then progressively loads more
 */
export async function progressiveDataFetch<T extends Record<string, any>>(
  fetchers: {
    critical: () => Promise<Partial<T>>;
    secondary?: () => Promise<Partial<T>>;
    analytics?: () => Promise<Partial<T>>;
  },
  onUpdate: (data: Partial<T>) => void
): Promise<T> {
  // Load critical data first
  const criticalData = await fetchers.critical();
  onUpdate(criticalData);

  // Load secondary data in background
  if (fetchers.secondary) {
    fetchers.secondary().then(secondaryData => {
      onUpdate({ ...criticalData, ...secondaryData });
    }).catch(error => {
      console.warn('Secondary data load failed:', error);
    });
  }

  // Load analytics last (lowest priority)
  if (fetchers.analytics) {
    fetchers.analytics().then(analyticsData => {
      onUpdate({ ...criticalData, ...analyticsData });
    }).catch(error => {
      console.warn('Analytics data load failed:', error);
    });
  }

  return criticalData as T;
}

/**
 * Intersection Observer hook for lazy loading content when it enters viewport
 */
export function useInViewport(ref: React.RefObject<Element>, options: IntersectionObserverInit = {}) {
  const [isInView, setIsInView] = React.useState(false);
  const [hasBeenInView, setHasBeenInView] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting;
        setIsInView(inView);
        if (inView && !hasBeenInView) {
          setHasBeenInView(true);
        }
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, hasBeenInView, options]);

  return { isInView, hasBeenInView };
}

/**
 * Component wrapper for progressive loading based on viewport visibility
 */
interface LazyLoadProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  once?: boolean;
}

export function LazyLoad({ children, fallback = null, once = true }: LazyLoadProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { isInView, hasBeenInView } = useInViewport(ref);

  const shouldRender = once ? hasBeenInView : isInView;

  return (
    <div ref={ref}>
      {shouldRender ? children : fallback}
    </div>
  );
}

/**
 * Preload data on hover to make interactions feel instant
 */
export function useHoverPreload<T>(
  dataKey: string,
  fetchFn: () => Promise<T>
) {
  const [data, setData] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const cacheRef = React.useRef<Map<string, T>>(new Map());

  const preload = React.useCallback(async () => {
    // Check cache first
    const cached = cacheRef.current.get(dataKey);
    if (cached) {
      setData(cached);
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    try {
      const result = await fetchFn();
      cacheRef.current.set(dataKey, result);
      setData(result);
    } catch (error) {
      console.error('Preload failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dataKey, fetchFn, isLoading]);

  return { data, isLoading, preload };
}

// Re-export React for useInViewport
import * as React from 'react';
