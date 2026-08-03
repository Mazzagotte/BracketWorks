import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MobileCompatibilityNotice, {
  MOBILE_NOTICE_STORAGE_KEY,
  isMobileCompatibilityNoticeRoute,
  useMobileCompatibilityNotice,
} from './MobileCompatibilityNotice'

type MatchMediaController = {
  setMatches: (matches: boolean) => void
}

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQuery = {
    get matches() { return matches },
    media: '(max-width: 767px)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as MediaQueryList
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery))

  return {
    setMatches(nextMatches) {
      matches = nextMatches
      listeners.forEach((listener) => listener({ matches, media: mediaQuery.media } as MediaQueryListEvent))
    },
  }
}

function NoticeHarness({ pathname = '/dashboard' }: { pathname?: string }) {
  const notice = useMobileCompatibilityNotice(pathname)
  return <MobileCompatibilityNotice open={notice.isOpen} onContinue={notice.dismiss} />
}

describe('MobileCompatibilityNotice', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    document.body.className = ''
  })

  it('appears at 767px or less and responds to viewport changes', async () => {
    const media = installMatchMedia(true)
    render(<NoticeHarness />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    act(() => media.setMatches(false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not appear at 768px or greater', async () => {
    installMatchMedia(false)
    render(<NoticeHarness />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('excludes Live View and authentication routes', () => {
    expect(isMobileCompatibilityNoticeRoute('/view')).toBe(false)
    expect(isMobileCompatibilityNoticeRoute('/view/123')).toBe(false)
    expect(isMobileCompatibilityNoticeRoute('/login')).toBe(false)
    expect(isMobileCompatibilityNoticeRoute('/signup')).toBe(false)
    expect(isMobileCompatibilityNoticeRoute('/reset-password/request')).toBe(false)
    expect(isMobileCompatibilityNoticeRoute('/verify-email')).toBe(false)
    expect(isMobileCompatibilityNoticeRoute('/dashboard')).toBe(true)
    expect(isMobileCompatibilityNoticeRoute('/admin')).toBe(true)
  })

  it('dismisses with Continue Anyway and retains dismissal for the session', async () => {
    installMatchMedia(true)
    const { unmount } = render(<NoticeHarness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue Anyway' }))
    expect(window.sessionStorage.getItem(MOBILE_NOTICE_STORAGE_KEY)).toBe('true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    unmount()
    render(<NoticeHarness />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('traps focus, closes with Escape, restores focus, and locks scrolling', async () => {
    installMatchMedia(true)
    const opener = document.createElement('button')
    opener.textContent = 'Previous control'
    document.body.appendChild(opener)
    opener.focus()

    render(<NoticeHarness />)
    const continueButton = await screen.findByRole('button', { name: 'Continue Anyway' })
    await waitFor(() => expect(continueButton).toHaveFocus())
    expect(document.body).toHaveClass('bw-scroll-lock')

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(continueButton).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.body).not.toHaveClass('bw-scroll-lock')
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
