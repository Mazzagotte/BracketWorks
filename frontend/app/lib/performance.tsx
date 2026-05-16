import React, { memo, useMemo, useCallback } from 'react';

// Memoized table row component
export const OptimizedTableRow = memo(({ 
  children, 
  onClick, 
  className,
  ...props 
}: { 
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <tr 
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </tr>
  );
});

OptimizedTableRow.displayName = 'OptimizedTableRow';

// Memoized table cell component
export const OptimizedTableCell = memo(({ 
  children, 
  isEditing,
  onDoubleClick,
  className,
  ...props 
}: {
  children: React.ReactNode;
  isEditing?: boolean;
  onDoubleClick?: () => void;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <td
      onDoubleClick={onDoubleClick}
      className={className}
      {...props}
    >
      {children}
    </td>
  );
});

OptimizedTableCell.displayName = 'OptimizedTableCell';

// Virtual scrolling hook for large lists
export function useVirtualScrolling<T>(
  items: T[],
  containerHeight: number = 400,
  itemHeight: number = 50
) {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 5); // Buffer of 5 items
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + 5
    );
    
    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight
    };
  }, [items, scrollTop, containerHeight, itemHeight]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    handleScroll,
    scrollTop
  };
}

// Debounced value hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Optimized form input component
export const OptimizedInput = memo(({ 
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  placeholder,
  type = 'text',
  autoFocus = false,
  ...props 
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  [key: string]: any;
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
  }, [onChange]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(e);
  }, [onBlur]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
  }, [onKeyDown]);

  return (
    <input
      type={type}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      autoFocus={autoFocus}
      {...props}
    />
  );
});

OptimizedInput.displayName = 'OptimizedInput';

// Loading states component
export const LoadingStates = memo(({ 
  isLoading,
  error,
  children,
  loadingText = 'Loading...',
  errorText = 'Something went wrong'
}: {
  isLoading: boolean;
  error?: string | null;
  children: React.ReactNode;
  loadingText?: string;
  errorText?: string;
}) => {
  if (isLoading) {
    return (
      <div className="loading-state bw-perf-loading">
        <div className="spinner bw-perf-spinner" />
        {loadingText}
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state bw-perf-error">
        {errorText}: {error}
      </div>
    );
  }

  return <>{children}</>;
});

LoadingStates.displayName = 'LoadingStates';

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      options
    );

    observer.observe(element);
    return () => observer.unobserve(element);
  }, [ref, options]);

  return isIntersecting;
}
