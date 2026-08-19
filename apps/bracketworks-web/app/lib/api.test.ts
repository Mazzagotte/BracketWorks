import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClient, getMemoryAccessToken, setMemoryAccessToken, clearAuthStorage } from './api'
import { getCsrfToken } from './api'
import { shouldUseAuthFetchCache, getAuthFetchCacheKey } from './api/cache'

describe('ApiClient auth refresh behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    setMemoryAccessToken(null)
    new ApiClient('').clearCache()
  })

  it('clears auth state and emits auth-expired on terminal refresh failure', async () => {
    setMemoryAccessToken('stale-token')
    localStorage.setItem('session_id', 'session-1')
    localStorage.setItem('user_id', '42')
    localStorage.setItem('is_admin', 'true')
    localStorage.setItem('first_name', 'Casey')

    const authExpiredListener = vi.fn()
    const authStateListener = vi.fn()
    const storageListener = vi.fn()

    window.addEventListener('auth-expired', authExpiredListener)
    window.addEventListener('auth-state-changed', authStateListener)
    window.addEventListener('storage', storageListener)

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/users/refresh')) {
        return new Response(JSON.stringify({ detail: 'expired' }), { status: 401 })
      }
      return new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 })
    }))

    const client = new ApiClient('')
    const response = await client.fetchWithAuth('/api/v1/secure', {}, true)

    expect(response.status).toBe(401)
    expect(authExpiredListener).toHaveBeenCalledTimes(1)
    expect(authStateListener).not.toHaveBeenCalled()
    expect(storageListener).not.toHaveBeenCalled()
    expect(getMemoryAccessToken()).toBeNull()
    expect(localStorage.getItem('session_id')).toBeNull()
    expect(localStorage.getItem('user_id')).toBeNull()
    expect(localStorage.getItem('is_admin')).toBeNull()
    expect(localStorage.getItem('first_name')).toBeNull()
  })

  it('refreshes token once and emits auth-state-changed on successful refresh', async () => {
    setMemoryAccessToken('old-token')

    const authStateListener = vi.fn()
    const storageListener = vi.fn()
    window.addEventListener('auth-state-changed', authStateListener)
    window.addEventListener('storage', storageListener)

    let securedAttempts = 0
    let refreshAttempts = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/users/refresh')) {
        refreshAttempts += 1
        return new Response(JSON.stringify({ access_token: 'new-token', session_id: 'session-2' }), { status: 200 })
      }

      if (url.endsWith('/api/v1/secure')) {
        securedAttempts += 1
        if (securedAttempts === 1) {
          return new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 })
    }))

    const client = new ApiClient('')
    const response = await client.fetchWithAuth('/api/v1/secure', {}, true)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(refreshAttempts).toBe(1)
    expect(getMemoryAccessToken()).toBe('new-token')
    expect(localStorage.getItem('session_id')).toBe('session-2')
    expect(authStateListener).toHaveBeenCalledTimes(1)
    expect(storageListener).not.toHaveBeenCalled()
  })

  it('treats non-auth refresh failures as transient without forcing logout', async () => {
    setMemoryAccessToken('old-token')
    localStorage.setItem('user_id', '42')

    const authExpiredListener = vi.fn()
    window.addEventListener('auth-expired', authExpiredListener)

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/users/refresh')) {
        return new Response(JSON.stringify({ detail: 'upstream failure' }), { status: 500 })
      }
      return new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401 })
    }))

    const client = new ApiClient('')
    const response = await client.fetchWithAuth('/api/v1/secure', {}, true)

    expect(response.status).toBe(401)
    expect(authExpiredListener).not.toHaveBeenCalled()
    expect(getMemoryAccessToken()).toBe('old-token')
    expect(localStorage.getItem('user_id')).toBe('42')
  })
})

// ─── clearAuthStorage ─────────────────────────────────────────────────────────

describe('clearAuthStorage', () => {
  it('removes all auth keys from localStorage and sessionStorage', () => {
    localStorage.setItem('token', 'should-go')
    localStorage.setItem('session_id', 's1')
    localStorage.setItem('user_id', '10')
    localStorage.setItem('userId', '10')
    localStorage.setItem('is_admin', 'true')
    localStorage.setItem('first_name', 'Alice')
    sessionStorage.setItem('token', 'session-token')

    clearAuthStorage()

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('session_id')).toBeNull()
    expect(localStorage.getItem('user_id')).toBeNull()
    expect(localStorage.getItem('userId')).toBeNull()
    expect(localStorage.getItem('is_admin')).toBeNull()
    expect(localStorage.getItem('first_name')).toBeNull()
    expect(sessionStorage.getItem('token')).toBeNull()
  })

  it('does not clear the in-memory token (callers must do that separately)', () => {
    setMemoryAccessToken('mem-token')
    localStorage.setItem('user_id', '5')

    clearAuthStorage()

    expect(getMemoryAccessToken()).toBe('mem-token')
  })
})

// ─── CSRF / idempotency / mutation headers ────────────────────────────────────

describe('ApiClient mutation request headers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setMemoryAccessToken(null)
    new ApiClient('').clearCache()
  })

  it('attaches x-csrf-token header to POST when cookie is present', async () => {
    Object.defineProperty(document, 'cookie', { value: 'csrf_token=csrf-value-123', configurable: true })

    const capturedHeaders: Record<string, string>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders.push((init.headers || {}) as Record<string, string>)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }))

    const client = new ApiClient('')
    await client.post('/api/v1/test', { foo: 'bar' })

    expect(capturedHeaders[0]?.['x-csrf-token']).toBe('csrf-value-123')
  })

  it('includes an Idempotency-Key on POST requests', async () => {
    const capturedHeaders: Record<string, string>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders.push((init.headers || {}) as Record<string, string>)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }))

    const client = new ApiClient('')
    await client.post('/api/v1/test', { foo: 'bar' })

    expect(capturedHeaders[0]?.['Idempotency-Key']).toBeTruthy()
  })

  it('does not add Idempotency-Key to GET requests', async () => {
    const capturedHeaders: Record<string, string>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeaders.push((init.headers || {}) as Record<string, string>)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }))

    const client = new ApiClient('')
    await client.get('/api/v1/test', false)

    expect(capturedHeaders[0]?.['Idempotency-Key']).toBeUndefined()
  })
})

// ─── Cache exclusions (live/sensitive endpoints) ──────────────────────────────

describe('shouldUseAuthFetchCache', () => {
  it('returns false for score endpoints', () => {
    expect(shouldUseAuthFetchCache('GET', '/api/v1/scores?tournament_id=1', {})).toBe(false)
  })

  it('returns false for bowler endpoints', () => {
    expect(shouldUseAuthFetchCache('GET', '/api/v1/bowlers?tournament_id=1', {})).toBe(false)
  })

  it('returns false for bracket status', () => {
    expect(shouldUseAuthFetchCache('GET', '/api/v1/brackets/status/42', {})).toBe(false)
  })

  it('returns false for live public endpoints', () => {
    expect(shouldUseAuthFetchCache('GET', '/api/v1/public/live/123', {})).toBe(false)
  })

  it('returns false for POST requests', () => {
    expect(shouldUseAuthFetchCache('POST', '/api/v1/tournaments/bootstrap', {})).toBe(false)
  })

  it('returns false when cache is explicitly disabled', () => {
    expect(shouldUseAuthFetchCache('GET', '/api/v1/tournaments', { cache: 'no-store' })).toBe(false)
  })

  it('returns true for bootstrap and other stable endpoints', () => {
    expect(shouldUseAuthFetchCache('GET', '/api/v1/tournaments/bootstrap?tournament_id=1', {})).toBe(true)
  })
})

// ─── Cache key uniqueness ─────────────────────────────────────────────────────

describe('getAuthFetchCacheKey', () => {
  it('produces different keys for different auth tokens (prevents cross-user cache bleed)', () => {
    const keyA = getAuthFetchCacheKey('/api/v1/data', 'GET', 'Bearer token-user-a')
    const keyB = getAuthFetchCacheKey('/api/v1/data', 'GET', 'Bearer token-user-b')
    expect(keyA).not.toBe(keyB)
  })

  it('produces the same key for the same URL + method + auth token', () => {
    const k1 = getAuthFetchCacheKey('/api/v1/data', 'GET', 'Bearer t1')
    const k2 = getAuthFetchCacheKey('/api/v1/data', 'GET', 'Bearer t1')
    expect(k1).toBe(k2)
  })
})
