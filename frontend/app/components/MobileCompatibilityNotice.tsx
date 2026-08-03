'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import buttonStyles from '../styles/buttons.module.css'
import modalStyles from '../styles/modals.module.css'
import styles from './MobileCompatibilityNotice.module.css'
import { MOBILE_VIEWPORT_QUERY } from '../lib/responsive'
import { setBodyInteractionState } from '../utils/modalUtils'

export const MOBILE_NOTICE_STORAGE_KEY = 'bracketworks-mobile-notice-dismissed'
export const MOBILE_NOTICE_MEDIA_QUERY = MOBILE_VIEWPORT_QUERY

const ELIGIBLE_ROUTE_PREFIXES = [
  '/dashboard',
  '/players',
  '/brackets',
  '/scores',
  '/payouts',
  '/admin',
]

export function isMobileCompatibilityNoticeRoute(pathname: string): boolean {
  return ELIGIBLE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function useMobileCompatibilityNotice(pathname: string) {
  const eligible = isMobileCompatibilityNoticeRoute(pathname)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!eligible || typeof window === 'undefined') {
      setIsOpen(false)
      return undefined
    }

    const mediaQuery = window.matchMedia(MOBILE_NOTICE_MEDIA_QUERY)
    const syncNotice = () => {
      const dismissed = window.sessionStorage.getItem(MOBILE_NOTICE_STORAGE_KEY) === 'true'
      setIsOpen(mediaQuery.matches && !dismissed)
    }

    syncNotice()
    mediaQuery.addEventListener('change', syncNotice)
    return () => mediaQuery.removeEventListener('change', syncNotice)
  }, [eligible])

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(MOBILE_NOTICE_STORAGE_KEY, 'true')
    }
    setIsOpen(false)
  }, [])

  return { isOpen, dismiss }
}

interface MobileCompatibilityNoticeProps {
  open: boolean
  onContinue: () => void
}

export default function MobileCompatibilityNotice({ open, onContinue }: MobileCompatibilityNoticeProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const continueButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    setBodyInteractionState({ scrollLocked: true, touchLocked: false })
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFrame = window.requestAnimationFrame(() => continueButtonRef.current?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onContinue()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      setBodyInteractionState({ scrollLocked: false, touchLocked: false })
      previousFocusRef.current?.focus()
    }
  }, [onContinue, open])

  if (!open) return null

  return (
    <div className={modalStyles.overlay} data-testid="mobile-compatibility-notice-overlay">
      <div
        ref={dialogRef}
        className={`${modalStyles.modal} ${modalStyles.compactModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-compatibility-title"
        aria-describedby="mobile-compatibility-description"
        tabIndex={-1}
      >
        <div className={modalStyles.header}>
          <h2 id="mobile-compatibility-title">Desktop or Tablet Recommended</h2>
        </div>
        <div className={styles.content} id="mobile-compatibility-description">
          <p>BracketWorks tournament management tools are designed for desktop and tablet screens and are not currently optimized for mobile phones.</p>
          <p>Some tables, forms, brackets, and controls may be difficult to view or use on a smaller screen.</p>
          <p className={styles.liveViewNote}>Live View pages are fully supported on mobile devices.</p>
          <button
            ref={continueButtonRef}
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.fullWidth} ${styles.continueButton}`}
            onClick={onContinue}
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
