import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiClient, getMemoryAccessToken, setMemoryAccessToken } from './api'

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
