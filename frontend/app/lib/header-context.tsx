"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
    if (mounted) {
      setHeaderPropsState(props);
    }
  }, [mounted]);

  const clearHeaderProps = useCallback(() => {
    if (mounted) {
      setHeaderPropsState({});
    }
  }, [mounted]);

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
  const { setHeaderProps, clearHeaderProps } = useHeader();

  useEffect(() => {
    setHeaderProps(props);
    return () => clearHeaderProps();
  }, [
    props.title, 
    props.subtitle, 
    props.centerContent, 
    props.showBreadcrumbs, 
    JSON.stringify(props.breadcrumbs)
    // Intentionally excluding actions, setHeaderProps, clearHeaderProps to prevent infinite loops
  ]);
}