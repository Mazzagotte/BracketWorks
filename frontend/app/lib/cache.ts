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

/**
 * Hook for stale-while-revalidate pattern
 * Returns cached data immediately and revalidates in background
 */
export function useStaleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    ttl?: number
    revalidateOnMount?: boolean
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
  } = {}
) {
  const { ttl = 300000, revalidateOnMount = true, onSuccess, onError } = options
  const cache = useCache<T>(ttl)
  const [data, setData] = useState<T | null>(() => cache.get(key))
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const revalidate = useCallback(async () => {
    // If we have cached data, this is a background revalidation
    const hasCachedData = cache.get(key) !== null
    
    if (hasCachedData) {
      setIsValidating(true)
    } else {
      setIsLoading(true)
    }

    try {
      const freshData = await fetchFn()
      cache.set(key, freshData)
      setData(freshData)
      setError(null)
      onSuccess?.(freshData)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Fetch failed')
      setError(error)
      onError?.(error)
    } finally {
      setIsLoading(false)
      setIsValidating(false)
    }
  }, [key, fetchFn, cache, onSuccess, onError])

  useEffect(() => {
    if (revalidateOnMount) {
      revalidate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revalidateOnMount])

  return { 
    data, 
    isLoading, 
    isValidating, 
    error, 
    revalidate,
    mutate: (newData: T) => {
      cache.set(key, newData)
      setData(newData)
    }
  }
}
