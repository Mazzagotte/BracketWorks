"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type HeaderProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

interface HeaderContextType extends HeaderProps {
  setHeaderProps: (props: HeaderProps) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [headerProps, setHeaderPropsState] = useState<HeaderProps>({});

  const setHeaderProps = useCallback((props: HeaderProps) => {
    setHeaderPropsState((prev) => {
      const isSame =
        prev.title === props.title &&
        prev.subtitle === props.subtitle &&
        prev.actions === props.actions;

      if (isSame) return prev;
      return props;
    });
  }, []);

  return (
    <HeaderContext.Provider value={{
      ...headerProps,
      setHeaderProps
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


