"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface HeaderContextType {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  centerContent?: boolean;
  showBreadcrumbs?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  setHeaderProps: (props: {
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
    centerContent?: boolean;
    showBreadcrumbs?: boolean;
    breadcrumbs?: Array<{ label: string; href?: string }>;
  }) => void;
  clearHeaderProps: () => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [headerProps, setHeaderPropsState] = useState<Omit<HeaderContextType, 'setHeaderProps' | 'clearHeaderProps'>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setHeaderProps = useCallback((props: Omit<HeaderContextType, 'setHeaderProps' | 'clearHeaderProps'>) => {
    setHeaderPropsState((prev) => {
      const sameBreadcrumbs = JSON.stringify(prev.breadcrumbs || []) === JSON.stringify(props.breadcrumbs || []);
      const isSame =
        prev.title === props.title &&
        prev.subtitle === props.subtitle &&
        prev.actions === props.actions &&
        prev.centerContent === props.centerContent &&
        prev.showBreadcrumbs === props.showBreadcrumbs &&
        sameBreadcrumbs;

      if (isSame) return prev;
      return props;
    });
  }, []);

  const clearHeaderProps = useCallback(() => {
    setHeaderPropsState((prev) => {
      const isEmpty = Object.keys(prev).length === 0;
      return isEmpty ? prev : {};
    });
  }, []);

  return (
    <HeaderContext.Provider value={{
      ...headerProps,
      setHeaderProps,
      clearHeaderProps
    }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}

// Hook for pages to set their header properties
export function usePageHeader(props: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  centerContent?: boolean;
  showBreadcrumbs?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  const { setHeaderProps } = useHeader();

  useEffect(() => {
    setHeaderProps(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.title, props.subtitle, props.actions]);
}
