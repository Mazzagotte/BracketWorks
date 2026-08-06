import { useState, useEffect, useCallback } from 'react';
import { logger } from './logger';
import { getMemoryAccessToken } from './api';

/**
 * Cached localStorage wrapper with debounced writes
 * Reduces synchronous blocking operations by caching reads and batching writes
 */
class CachedStorage {
  private cache: Map<string, string | null> = new Map()
  private writeQueue: Map<string, string | null> = new Map()
  private writeTimeoutId: NodeJS.Timeout | null = null
  private readonly WRITE_DELAY = 300 // ms

  private isAuthTokenKey(key: string): boolean {
    return key === 'token'
  }

  /**
   * Get item from cache or localStorage
   * Fast synchronous reads from memory cache
   */
  getItem(key: string): string | null {
    if (this.isAuthTokenKey(key)) return getMemoryAccessToken()
    // If there is a pending debounced write, return it immediately so listeners
    // (e.g., header reacting to custom events) see the latest value.
    if (this.writeQueue.has(key)) {
      const queuedValue = this.writeQueue.get(key) ?? null
      this.cache.set(key, queuedValue)
      return queuedValue
    }

    if (typeof window === 'undefined') return null
    
    try {
      if (this.isAuthTokenKey(key)) {
        const sessionValue = sessionStorage.getItem(key)
        const localValue = localStorage.getItem(key)
        const effectiveValue = sessionValue || localValue
        if (this.cache.get(key) !== effectiveValue) {
          this.cache.set(key, effectiveValue)
        }
        return effectiveValue
      }

      // Always reconcile with localStorage so direct writes (outside this wrapper)
      // are visible across page transitions.
      const liveValue = localStorage.getItem(key)
      const cachedValue = this.cache.has(key) ? this.cache.get(key)! : null
      if (cachedValue !== liveValue) {
        this.cache.set(key, liveValue)
      }
      return liveValue
    } catch (error) {
      logger.error('localStorage.getItem failed', { error })
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
      if (this.isAuthTokenKey(key)) {
        sessionStorage.removeItem(key)
      }
      localStorage.removeItem(key)
    } catch (error) {
      logger.error('localStorage.removeItem failed', { error })
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
        if (this.isAuthTokenKey(key)) {
          if (value === null) {
            sessionStorage.removeItem(key)
          } else {
            sessionStorage.setItem(key, value)
            // Keep token out of persistent storage.
            localStorage.removeItem(key)
          }
          continue
        }

        if (value === null) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, value)
        }
      } catch (error) {
        logger.error(`localStorage write failed for key "${key}"`, { error })
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
      if (key === 'token') {
        return sessionStorage.getItem(key) || localStorage.getItem(key);
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [isClient]);
  
  const setItem = useCallback((key: string, value: string) => {
    if (!isClient) return;
    try {
      if (key === 'token') {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, value);
    } catch {
      // Silent fail
    }
  }, [isClient]);
  
  const removeItem = useCallback((key: string) => {
    if (!isClient) return;
    try {
      if (key === 'token') {
        sessionStorage.removeItem(key);
      }
      localStorage.removeItem(key);
    } catch {
      // Silent fail
    }
  }, [isClient]);
  
  return { getItem, setItem, removeItem, isClient };
}
