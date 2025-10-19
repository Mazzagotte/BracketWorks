// API Configuration and enhanced fetch utilities
import { logger } from './logger'
import { ApiError, handleApiError, shouldRetry } from './errors';

export const API = (path: string) =>
  (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000') + path;

// Request cache for GET requests
const requestCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enhanced API client with error handling, retry logic, and caching
export class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private getToken: () => string | null;

  constructor(baseURL?: string, getToken?: () => string | null) {
    this.baseURL = baseURL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.getToken = getToken || (() => typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  }

  private getCacheKey(endpoint: string, options: RequestInit): string {
    return `${endpoint}-${JSON.stringify(options.headers || {})}-${options.method || 'GET'}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      logger.debug('Cache hit', { key });
      return cached.data;
    }
    if (cached) {
      requestCache.delete(key);
      logger.debug('Cache miss - expired', { key });
    }
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
    requestCache.set(key, { data, timestamp: Date.now(), ttl });
    logger.debug('Cache set', { key, ttl });
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    retries: number = 3,
    useCache: boolean = false
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
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
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    // Add auth token if available
    const token = this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    try {
      logger.apiCall(config.method || 'GET', endpoint);
      const response = await fetch(url, config);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        let errorDetails: any = null
        
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
          errorDetails = errorData
        } catch {}
        
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
          localStorage.removeItem('token')
          localStorage.removeItem('user_id')
          window.location.href = '/login'
        }
      }
      
      if (retries > 0 && shouldRetry(error)) {
        logger.info(`Retrying API request (${retries} retries left)`, { endpoint })
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.request<T>(endpoint, options, retries - 1, useCache)
      }
      
      throw appError
    }
  }

  async get<T>(endpoint: string, useCache: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, 3, useCache);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Clear cache
  clearCache(): void {
    requestCache.clear();
    logger.info('API cache cleared');
  }

  // Clear specific cache entry
  clearCacheEntry(endpoint: string): void {
    const keysToDelete = Array.from(requestCache.keys()).filter(key => key.includes(endpoint));
    keysToDelete.forEach(key => requestCache.delete(key));
    logger.debug('Cache entries cleared', { endpoint, count: keysToDelete.length });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();