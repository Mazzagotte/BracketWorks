import { logger } from '../logger'

// ─── High-level GET response cache ────────────────────────────────────────────
// Used by ApiClient.get() for cacheable endpoints.

const apiRequestCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function getCachedRequest<T>(key: string): T | null {
  const entry = apiRequestCache.get(key)
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    logger.debug('Cache hit', { key })
    return entry.data as T
  }
  if (entry) {
    apiRequestCache.delete(key)
    logger.debug('Cache miss - expired', { key })
  }
  return null
}

export function setCachedRequest<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
  apiRequestCache.set(key, { data, timestamp: Date.now(), ttl })
  logger.debug('Cache set', { key, ttl })
}

export function clearApiRequestCache(): void {
  apiRequestCache.clear()
}

export function clearApiRequestCacheEntry(endpoint: string): void {
  const keys = Array.from(apiRequestCache.keys()).filter(k => k.includes(endpoint))
  keys.forEach(k => apiRequestCache.delete(k))
  logger.debug('Cache entries cleared', { endpoint, count: keys.length })
}

// ─── fetchWithAuth response cache ─────────────────────────────────────────────
// Deduplicates and short-caches auth-bearing GET responses.

export interface AuthFetchCacheEntry {
  body: string
  status: number
  statusText: string
  headers: [string, string][]
  timestamp: number
  ttl: number
}

export const authFetchCache = new Map<string, AuthFetchCacheEntry>()
export const authFetchInFlight = new Map<string, Promise<Response>>()
export const AUTH_FETCH_CACHE_TTL_MS = 60 * 1000 // 60 seconds

export function buildResponseFromCacheEntry(entry: AuthFetchCacheEntry): Response {
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: new Headers(entry.headers),
  })
}

/**
 * Returns true for GET requests that can safely be short-cached.
 * Live/frequently-changing endpoints are excluded to avoid stale reads.
 */
export function shouldUseAuthFetchCache(method: string, url: string, options: RequestInit): boolean {
  if (method !== 'GET') return false
  if (options.cache === 'no-store') return false

  const lower = url.toLowerCase()
  // These endpoints change frequently; never serve from cache
  if (
    lower.includes('/api/v1/scores') ||
    lower.includes('/api/v1/bowlers') ||
    lower.includes('/api/v1/squads/') ||
    lower.includes('/api/v1/brackets/status') ||
    lower.includes('/api/v1/brackets/generate-multiple') ||
    lower.includes('/api/v1/public/live')
  ) {
    return false
  }

  return true
}

export function getAuthFetchCacheKey(url: string, method: string, authHeader: string): string {
  // Include auth header so one user's cache cannot be reused by another user
  return `${method}:${url}:${authHeader}`
}

export function clearAuthFetchCache(): void {
  authFetchCache.clear()
  authFetchInFlight.clear()
}
