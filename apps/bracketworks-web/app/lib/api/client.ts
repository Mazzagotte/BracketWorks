import { logger } from '../logger'
import { ApiError, handleApiError, isAuthError, shouldRetry } from '../errors'
import { getMemoryAccessToken, setMemoryAccessToken, clearAuthStorage } from './token'
import { getCsrfToken, CSRF_HEADER_NAME } from './csrf'
import {
  getCachedRequest,
  setCachedRequest,
  DEFAULT_CACHE_TTL,
  clearApiRequestCache,
  clearApiRequestCacheEntry,
  authFetchCache,
  authFetchInFlight,
  AUTH_FETCH_CACHE_TTL_MS,
  buildResponseFromCacheEntry,
  shouldUseAuthFetchCache,
  getAuthFetchCacheKey,
  clearAuthFetchCache,
  type AuthFetchCacheEntry,
} from './cache'

function getBackendBaseUrl(): string {
  if (typeof window !== 'undefined') return ''
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'
  return configured
}

export function buildApiUrl(endpointPath: string): string {
  const url = getBackendBaseUrl() + endpointPath
  if (process.env.NODE_ENV === 'development') logger.debug(`API Call: ${url}`)
  return url
}

/** Backward-compatible alias */
export const API = buildApiUrl

export class ApiClient {
  private backendBaseUrl: string
  private defaultRequestHeaders: Record<string, string>
  private getAuthToken: () => string | null
  // Held across concurrent 401s so only one refresh fires at a time
  private refreshPromise: Promise<string | null> | null = null
  private lastRefreshOutcome: 'none' | 'transient-failure' | 'terminal-expired' = 'none'

  private generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  constructor(backendBaseUrl?: string, getAuthToken?: () => string | null) {
    this.backendBaseUrl = backendBaseUrl ?? getBackendBaseUrl()
    this.defaultRequestHeaders = { 'Content-Type': 'application/json' }
    this.getAuthToken = getAuthToken ?? getMemoryAccessToken
  }

  private getCacheKey(endpoint: string, options: RequestInit): string {
    return `${endpoint}-${JSON.stringify(options.headers || {})}-${options.method || 'GET'}`
  }

  /**
   * Refreshes the access token using the HTTP-only session cookie.
   * Only one refresh runs at a time; concurrent callers share the same promise.
   * A 401/403 from the refresh endpoint is treated as terminal session expiry.
   * Any other failure is treated as transient and must not log the user out.
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = (async () => {
      try {
        this.lastRefreshOutcome = 'none'
        const csrfToken = getCsrfToken()
        const refreshHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (csrfToken) refreshHeaders[CSRF_HEADER_NAME] = csrfToken

        const response = await fetch(`${this.backendBaseUrl}/api/v1/users/refresh`, {
          method: 'POST',
          headers: refreshHeaders,
          credentials: 'include',
          body: JSON.stringify({}),
        })

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // Confirmed server-side session expiry — clear auth and signal the app
            this.lastRefreshOutcome = 'terminal-expired'
            setMemoryAccessToken(null)
            clearAuthStorage()
            window.dispatchEvent(new Event('auth-expired'))
          } else {
            // Transient backend error — must not force logout
            this.lastRefreshOutcome = 'transient-failure'
          }
          return null
        }

        const data = await response.json()
        if (!data?.access_token) { this.lastRefreshOutcome = 'transient-failure'; return null }

        setMemoryAccessToken(data.access_token)
        if (data.session_id) localStorage.setItem('session_id', data.session_id)
        window.dispatchEvent(new Event('auth-state-changed'))
        this.lastRefreshOutcome = 'none'
        return data.access_token as string
      } catch (error) {
        logger.warn('Access token refresh failed', { error: String(error) })
        this.lastRefreshOutcome = 'transient-failure'
        return null
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 3,
    useCache = false,
    allowAuthRefresh = true,
  ): Promise<T> {
    const url = `${this.backendBaseUrl}${endpoint}`
    const startTime = Date.now()

    const cacheKey = this.getCacheKey(endpoint, options)
    if (useCache && (!options.method || options.method === 'GET')) {
      const cached = getCachedRequest<T>(cacheKey)
      if (cached) return cached
    }

    const config: RequestInit = { ...options, headers: { ...this.defaultRequestHeaders, ...options.headers } }
    const method = (config.method || 'GET').toUpperCase()
    const requestHeaders = config.headers as Record<string, string>

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (!requestHeaders['Idempotency-Key']) requestHeaders['Idempotency-Key'] = this.generateIdempotencyKey()
      if (!requestHeaders[CSRF_HEADER_NAME]) {
        const csrfToken = getCsrfToken()
        if (csrfToken) requestHeaders[CSRF_HEADER_NAME] = csrfToken
      }
    }

    const token = this.getAuthToken()
    if (token) config.headers = { ...config.headers, Authorization: `Bearer ${token}` }

    try {
      logger.apiCall(config.method || 'GET', endpoint)
      let response = await fetch(url, config)

      if (response.status === 401 && allowAuthRefresh) {
        const refreshedToken = await this.refreshAccessToken()
        if (refreshedToken) {
          response = await fetch(url, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${refreshedToken}` } })
        }
      }

      const duration = Date.now() - startTime

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        let errorDetails: unknown = null
        try {
          const errData = await response.json()
          errorMessage = errData.detail || errData.message || errorMessage
          errorDetails = errData
        } catch { /* non-JSON error body */ }

        const logCtx = { endpoint, status: response.status, error: errorMessage, duration }
        if (response.status === 401 || response.status === 403 || response.status === 428) {
          logger.warn('API request unauthorized', logCtx)
        } else {
          logger.error('API request failed', logCtx)
        }

        throw new ApiError(errorMessage, response.status, undefined, errorDetails)
      }

      const data = await response.json()
      logger.apiCall(config.method || 'GET', endpoint, response.status, duration)

      if (useCache && (!options.method || options.method === 'GET')) setCachedRequest(cacheKey, data)

      return data
    } catch (error) {
      const duration = Date.now() - startTime
      const appError = handleApiError(error)
      const logCtx = { endpoint, error: appError.message, statusCode: appError.statusCode, duration }

      if (isAuthError(appError)) { logger.warn('API request auth error', logCtx) } else { logger.error('API request error', logCtx) }

      if (!appError.statusCode && (error instanceof TypeError || appError.message.toLowerCase().includes('fetch'))) {
        throw new ApiError(
          this.backendBaseUrl
            ? `Unable to reach the API at ${this.backendBaseUrl}. Check that the backend is running.`
            : 'Unable to reach the API proxy. Check that Next.js is running and that the backend is available.',
          undefined,
          'NETWORK_ERROR',
        )
      }

      if (retries > 0 && shouldRetry(error)) {
        const delayMs = 300 * Math.pow(2, 3 - retries) // 300ms, 600ms, 1200ms
        logger.info(`Retrying API request (${retries} retries left, delay ${delayMs}ms)`, { endpoint })
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return this.request<T>(endpoint, options, retries - 1, useCache, false)
      }

      throw appError
    }
  }

  async get<T>(endpoint: string, useCache = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, 3, useCache)
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined })
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined })
  }

  async bulkPatch<T>(endpoint: string, items: unknown[]): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(items) })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  async fetchWithAuth(input: string, options: RequestInit = {}, allowAuthRefresh = true): Promise<Response> {
    const isAbsolute = /^https?:\/\//i.test(input)
    const url = isAbsolute ? input : `${this.backendBaseUrl}${input}`

    const baseHeaders: Record<string, string> = {
      ...this.defaultRequestHeaders,
      ...((options.headers as Record<string, string>) || {}),
    }

    const token = this.getAuthToken()
    if (token && !baseHeaders.Authorization) baseHeaders.Authorization = `Bearer ${token}`

    const config: RequestInit = { ...options, headers: baseHeaders }
    const method = (config.method || 'GET').toUpperCase()

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (!baseHeaders['Idempotency-Key']) baseHeaders['Idempotency-Key'] = this.generateIdempotencyKey()
      if (!baseHeaders[CSRF_HEADER_NAME]) {
        const csrfToken = getCsrfToken()
        if (csrfToken) baseHeaders[CSRF_HEADER_NAME] = csrfToken
      }
    }

    const useCacheLayers = shouldUseAuthFetchCache(method, url, config)
    const cacheKey = getAuthFetchCacheKey(url, method, baseHeaders.Authorization || '')

    if (useCacheLayers) {
      const cached = authFetchCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cached.ttl) return buildResponseFromCacheEntry(cached)
      if (cached) authFetchCache.delete(cacheKey)

      const inflight = authFetchInFlight.get(cacheKey)
      if (inflight) return (await inflight).clone()
    }

    const fetchPromise = (async () => {
      let response = await fetch(url, config)

      if (response.status === 401 && allowAuthRefresh) {
        const refreshedToken = await this.refreshAccessToken()
        if (refreshedToken) {
          response = await fetch(url, { ...config, headers: { ...baseHeaders, Authorization: `Bearer ${refreshedToken}` } })
        }
      }

      if (useCacheLayers && response.ok) {
        const clone = response.clone()
        const body = await clone.text()
        const entry: AuthFetchCacheEntry = {
          body,
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.entries()),
          timestamp: Date.now(),
          ttl: AUTH_FETCH_CACHE_TTL_MS,
        }
        authFetchCache.set(cacheKey, entry)
      }

      return response
    })()

    if (useCacheLayers) {
      authFetchInFlight.set(cacheKey, fetchPromise)
      try { return await fetchPromise } finally { authFetchInFlight.delete(cacheKey) }
    }

    return fetchPromise
  }

  /** Restore session by attempting a token refresh via the HTTP-only cookie */
  async restoreSession(): Promise<string | null> {
    return this.refreshAccessToken()
  }

  clearCache(): void {
    clearApiRequestCache()
    clearAuthFetchCache()
    logger.info('API cache cleared')
  }

  clearCacheEntry(endpoint: string): void {
    clearApiRequestCacheEntry(endpoint)
  }
}

export const apiClient = new ApiClient()

/** Convenience wrapper preserving the pre-refactor call signature */
export const apiFetch = (input: string, options: RequestInit = {}): Promise<Response> =>
  apiClient.fetchWithAuth(input, options)
