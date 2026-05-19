import { logger } from './logger'
import { ApiError, handleApiError, shouldRetry } from './errors';

// API Configuration and enhanced fetch utilities

/**
 * Returns the backend base URL, upgrading http:// → https:// when the
 * page itself is served over HTTPS to prevent mixed-content blocking.
 */
function getBackendBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    configured.startsWith('http://')
  ) {
    return configured.replace('http://', 'https://');
  }
  return configured;
}

export const buildApiUrl = (endpointPath: string) => {
  const completeApiUrl = getBackendBaseUrl() + endpointPath;
  
  // Log API calls in development for debugging
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`API Call: ${completeApiUrl}`);
  }
  
  return completeApiUrl;
};

// Backward compatibility - keeping API function
export const API = buildApiUrl;

// Request cache for GET requests
const apiRequestCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const authFetchCache = new Map<string, { body: string; status: number; statusText: string; headers: [string, string][]; timestamp: number; ttl: number }>();
const authFetchInFlight = new Map<string, Promise<Response>>();
const AUTH_FETCH_CACHE_TTL_MS = 60 * 1000; // 60 seconds

// Enhanced API client with error handling, retry logic, and caching
export class ApiClient {
  private backendBaseUrl: string;
  private defaultRequestHeaders: Record<string, string>;
  private getAuthToken: () => string | null;
  private refreshPromise: Promise<string | null> | null = null;

  private generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  constructor(backendBaseUrl?: string, getAuthToken?: () => string | null) {
    this.backendBaseUrl = backendBaseUrl || getBackendBaseUrl();
    this.defaultRequestHeaders = {
      'Content-Type': 'application/json',
    };
    this.getAuthToken = getAuthToken || (() => typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  }

  private getCacheKey(endpoint: string, options: RequestInit): string {
    return `${endpoint}-${JSON.stringify(options.headers || {})}-${options.method || 'GET'}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = apiRequestCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      logger.debug('Cache hit', { key });
      return cached.data;
    }
    if (cached) {
      apiRequestCache.delete(key);
      logger.debug('Cache miss - expired', { key });
    }
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
    apiRequestCache.set(key, { data, timestamp: Date.now(), ttl });
    logger.debug('Cache set', { key, ttl });
  }

  private getAuthFetchCacheKey(url: string, method: string, headers: Record<string, string>): string {
    const authHeader = headers.Authorization || '';
    return `${method}:${url}:${authHeader}`;
  }

  private shouldUseAuthFetchCache(method: string, url: string, options: RequestInit): boolean {
    if (method !== 'GET') {
      return false;
    }
    if (options.cache === 'no-store') {
      return false;
    }

    const lowerUrl = url.toLowerCase();
    if (
      lowerUrl.includes('/api/v1/scores') ||
      lowerUrl.includes('/api/v1/brackets/generate-multiple') ||
      lowerUrl.includes('/api/v1/public/live')
    ) {
      return false;
    }

    return true;
  }

  private buildResponseFromCached(entry: { body: string; status: number; statusText: string; headers: [string, string][] }): Response {
    return new Response(entry.body, {
      status: entry.status,
      statusText: entry.statusText,
      headers: new Headers(entry.headers),
    });
  }

  private clearAuthStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('session_id');
    localStorage.removeItem('user_id');
    localStorage.removeItem('userId');
    localStorage.removeItem('is_admin');
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return null;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.backendBaseUrl}/api/v1/users/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
          this.clearAuthStorage();
          return null;
        }

        const data = await response.json();
        if (!data?.access_token) {
          this.clearAuthStorage();
          return null;
        }

        localStorage.setItem('token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        if (data.session_id) {
          localStorage.setItem('session_id', data.session_id);
        }
        window.dispatchEvent(new Event('auth-state-changed'));
        window.dispatchEvent(new Event('storage'));
        return data.access_token as string;
      } catch (error) {
        logger.warn('Access token refresh failed', { error: String(error) });
        this.clearAuthStorage();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    retries: number = 3,
    useCache: boolean = false,
    allowAuthRefresh: boolean = true
  ): Promise<T> {
    const url = `${this.backendBaseUrl}${endpoint}`;
    const startTime = Date.now();
    
    // Check cache for GET requests
    const cacheKey = this.getCacheKey(endpoint, options);
    if (useCache && (!options.method || options.method === 'GET')) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultRequestHeaders,
        ...options.headers,
      },
    };

    const method = (config.method || 'GET').toUpperCase();
    const requestHeaders = config.headers as Record<string, string>;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !requestHeaders['Idempotency-Key']) {
      requestHeaders['Idempotency-Key'] = this.generateIdempotencyKey();
    }

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    try {
      logger.apiCall(config.method || 'GET', endpoint);
      let response = await fetch(url, config);

      if (response.status === 401 && allowAuthRefresh) {
        const refreshedAccessToken = await this.refreshAccessToken();
        if (refreshedAccessToken) {
          const retryHeaders = {
            ...(config.headers || {}),
            Authorization: `Bearer ${refreshedAccessToken}`,
          };
          response = await fetch(url, {
            ...config,
            headers: retryHeaders,
          });
        }
      }

      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        let errorDetails: unknown = null
        
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
          errorDetails = errorData
        } catch (parseError) {
          logger.debug('Failed to parse error response as JSON', { endpoint, status: response.status })
        }
        
        logger.error('API request failed', { 
          endpoint, 
          status: response.status, 
          error: errorMessage,
          duration
        })
        
        throw new ApiError(errorMessage, response.status, undefined, errorDetails)
      }

      const data = await response.json();
      logger.apiCall(config.method || 'GET', endpoint, response.status, duration);
      
      // Cache successful GET requests
      if (useCache && (!options.method || options.method === 'GET')) {
        this.setCache(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      const duration = Date.now() - startTime
      const appError = handleApiError(error)
      
      logger.error('API request error', { 
        endpoint, 
        error: appError.message, 
        statusCode: appError.statusCode,
        duration 
      })
      
      // Handle auth errors automatically
      if (appError.statusCode === 401) {
        if (typeof window !== 'undefined') {
          this.clearAuthStorage()
          window.dispatchEvent(new Event('auth-expired'))
        }
      }

      // Surface a clearer message for browser-level fetch/CORS failures.
      if (!appError.statusCode && (error instanceof TypeError || appError.message.toLowerCase().includes('fetch'))) {
        throw new ApiError(
          `Unable to reach the backend at ${this.backendBaseUrl}. Check that the API is running and that CORS allows the frontend origin.`,
          undefined,
          'NETWORK_ERROR'
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

  async get<T>(endpoint: string, useCache: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, 3, useCache);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async bulkPatch<T>(endpoint: string, items: unknown[]): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(items),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async fetchWithAuth(input: string, options: RequestInit = {}, allowAuthRefresh: boolean = true): Promise<Response> {
    const isAbsoluteUrl = /^https?:\/\//i.test(input)
    const url = isAbsoluteUrl ? input : `${this.backendBaseUrl}${input}`

    const baseHeaders = {
      ...this.defaultRequestHeaders,
      ...((options.headers as Record<string, string>) || {}),
    }

    const token = this.getAuthToken()
    if (token && !baseHeaders.Authorization) {
      baseHeaders.Authorization = `Bearer ${token}`
    }

    const config: RequestInit = {
      ...options,
      headers: baseHeaders,
    }

    const method = (config.method || 'GET').toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !baseHeaders['Idempotency-Key']) {
      baseHeaders['Idempotency-Key'] = this.generateIdempotencyKey()
    }
    const useAuthFetchCache = this.shouldUseAuthFetchCache(method, url, config)
    const cacheKey = this.getAuthFetchCacheKey(url, method, baseHeaders)

    if (useAuthFetchCache) {
      const cached = authFetchCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return this.buildResponseFromCached(cached)
      }
      if (cached) {
        authFetchCache.delete(cacheKey)
      }

      const existingRequest = authFetchInFlight.get(cacheKey)
      if (existingRequest) {
        const sharedResponse = await existingRequest
        return sharedResponse.clone()
      }
    }

    const fetchPromise = (async () => {
      let response = await fetch(url, config)

      if (response.status === 401 && allowAuthRefresh) {
        const refreshedAccessToken = await this.refreshAccessToken()
        if (refreshedAccessToken) {
          response = await fetch(url, {
            ...config,
            headers: {
              ...baseHeaders,
              Authorization: `Bearer ${refreshedAccessToken}`,
            },
          })
        }
      }

      if (response.status === 401 && typeof window !== 'undefined') {
        this.clearAuthStorage()
        window.dispatchEvent(new Event('auth-expired'))
      }

      if (useAuthFetchCache && response.ok) {
        const clone = response.clone()
        const body = await clone.text()
        authFetchCache.set(cacheKey, {
          body,
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.entries()),
          timestamp: Date.now(),
          ttl: AUTH_FETCH_CACHE_TTL_MS,
        })
      }

      return response
    })()

    if (useAuthFetchCache) {
      authFetchInFlight.set(cacheKey, fetchPromise)
      try {
        return await fetchPromise
      } finally {
        authFetchInFlight.delete(cacheKey)
      }
    }

    return fetchPromise
  }

  // Clear cache
  clearCache(): void {
    apiRequestCache.clear();
    authFetchCache.clear();
    authFetchInFlight.clear();
    logger.info('API cache cleared');
  }

  // Clear specific cache entry
  clearCacheEntry(endpoint: string): void {
    const keysToDelete = Array.from(apiRequestCache.keys()).filter(key => key.includes(endpoint));
    keysToDelete.forEach(key => apiRequestCache.delete(key));
    logger.debug('Cache entries cleared', { endpoint, count: keysToDelete.length });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();
export const apiFetch = (input: string, options: RequestInit = {}) => apiClient.fetchWithAuth(input, options)
