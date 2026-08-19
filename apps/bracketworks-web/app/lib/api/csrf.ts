/**
 * CSRF cookie/header helpers.
 * The cookie name and header name are read from env vars so they can be
 * changed without touching call sites.
 */

export const CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || 'csrf_token'
export const CSRF_HEADER_NAME = 'x-csrf-token'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie ? document.cookie.split('; ') : []
  const prefix = `${encodeURIComponent(name)}=`
  for (const cookie of cookies) {
    if (cookie.startsWith(prefix)) {
      const raw = cookie.slice(prefix.length)
      try { return decodeURIComponent(raw) } catch { return raw }
    }
  }
  return null
}

export function getCsrfToken(): string | null {
  return getCookieValue(CSRF_COOKIE_NAME)
}
