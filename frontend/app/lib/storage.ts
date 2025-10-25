import { useState, useEffect, useCallback } from 'react';

export function useClientStorage() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const getItem = useCallback((key: string) => {
    if (!isClient) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [isClient]);
  
  const setItem = useCallback((key: string, value: string) => {
    if (!isClient) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silent fail
    }
  }, [isClient]);
  
  const removeItem = useCallback((key: string) => {
    if (!isClient) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silent fail
    }
  }, [isClient]);
  
  return { getItem, setItem, removeItem, isClient };
}
