/**
 * In-memory access token storage.
 * The token must never be written to persistent storage (localStorage/sessionStorage)
 * so it cannot be exfiltrated by XSS across page loads.
 */
let memoryAccessToken: string | null = null

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken
}

export function setMemoryAccessToken(token: string | null): void {
  memoryAccessToken = token
}

/**
 * Remove all auth-related keys from browser storage.
 * Called on logout, terminal refresh failure, and session init.
 * Does NOT clear the in-memory token — callers must do that separately so the
 * order of operations is explicit.
 */
export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('token')
  localStorage.removeItem('token')
  localStorage.removeItem('session_id')
  localStorage.removeItem('user_id')
  localStorage.removeItem('userId')
  localStorage.removeItem('is_admin')
  localStorage.removeItem('first_name')
}
