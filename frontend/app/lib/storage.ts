import { useState, useEffect, useCallback } from 'react';

/**
 * Cached localStorage wrapper with debounced writes
 * Reduces synchronous blocking operations by caching reads and batching writes
 */
class CachedStorage {
  private cache: Map<string, string | null> = new Map()
  private writeQueue: Map<string, string | null> = new Map()
  private writeTimeoutId: NodeJS.Timeout | null = null
  private readonly WRITE_DELAY = 300 // ms

  /**
   * Get item from cache or localStorage
   * Fast synchronous reads from memory cache
   */
  getItem(key: string): string | null {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    // Fallback to localStorage
    if (typeof window === 'undefined') return null
    
    try {
      const value = localStorage.getItem(key)
      this.cache.set(key, value)
      return value
    } catch (error) {
      console.error('localStorage.getItem failed:', error)
      return null
    }
  }

  /**
   * Set item with debounced write to localStorage
   * Immediately updates cache, batches writes to localStorage
   */
  setItem(key: string, value: string): void {
    // Update cache immediately
    this.cache.set(key, value)

    // Queue write to localStorage
    this.writeQueue.set(key, value)

    // Debounce actual localStorage writes
    if (this.writeTimeoutId) {
      clearTimeout(this.writeTimeoutId)
    }

    this.writeTimeoutId = setTimeout(() => {
      this.flushWrites()
    }, this.WRITE_DELAY)
  }

  /**
   * Remove item from cache and localStorage
   */
  removeItem(key: string): void {
    this.cache.delete(key)
    this.writeQueue.delete(key)

    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('localStorage.removeItem failed:', error)
    }
  }

  /**
   * Flush all pending writes immediately
   * Useful before page unload
   */
  flush(): void {
    if (this.writeTimeoutId) {
      clearTimeout(this.writeTimeoutId)
      this.writeTimeoutId = null
    }
    this.flushWrites()
  }

  /**
   * Write queued items to localStorage
   */
  private flushWrites(): void {
    if (typeof window === 'undefined') return
    
    for (const [key, value] of this.writeQueue.entries()) {
      try {
        if (value === null) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, value)
        }
      } catch (error) {
        console.error(`localStorage write failed for key "${key}":`, error)
      }
    }
    this.writeQueue.clear()
  }
}

// Singleton instance
export const storage = new CachedStorage()

// Flush writes before page unload to prevent data loss
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    storage.flush()
  })
}

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
