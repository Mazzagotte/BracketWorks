import { useState, useEffect, useCallback } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Custom hook for client-side data caching
 * Reduces API calls for frequently accessed data
 */
export function useCache<T>(ttl: number = 300000) { // 5 minutes default
  const [cache, setCache] = useState<Map<string, CacheEntry<T>>>(new Map())

  const get = useCallback((key: string): T | null => {
    const entry = cache.get(key)
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data
    }
    if (entry) {
      // Remove expired entry
      setCache(prev => {
        const newCache = new Map(prev)
        newCache.delete(key)
        return newCache
      })
    }
    return null
  }, [cache])

  const set = useCallback((key: string, data: T, customTtl?: number) => {
    setCache(prev => {
      const newCache = new Map(prev)
      newCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: customTtl || ttl
      })
      return newCache
    })
  }, [ttl])

  const invalidate = useCallback((keyPattern?: string) => {
    if (keyPattern) {
      setCache(prev => {
        const newCache = new Map()
        for (const [key, value] of prev) {
          if (!key.includes(keyPattern)) {
            newCache.set(key, value)
          }
        }
        return newCache
      })
    } else {
      setCache(new Map())
    }
  }, [])

  const clear = useCallback(() => {
    setCache(new Map())
  }, [])

  return { get, set, invalidate, clear }
}

/**
 * Hook for caching API responses
 */
export function useApiCache() {
  const cache = useCache(300000) // 5 minutes

  const cachedFetch = useCallback(async <T>(
    key: string, 
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> => {
    // Try cache first
    const cached = cache.get(key)
    if (cached) {
      return cached as T
    }

    // Fetch and cache
    const data = await fetchFn()
    cache.set(key, data, ttl)
    return data
  }, [cache])

  return { cachedFetch, ...cache }
}