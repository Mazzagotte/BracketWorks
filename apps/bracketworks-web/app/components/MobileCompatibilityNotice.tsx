'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Modal } from '@bracketworks/ui'

import styles from './MobileCompatibilityNotice.module.css'
import { MOBILE_VIEWPORT_QUERY } from '../lib/responsive'
import { useMediaQuery } from '../hooks/useMediaQuery'

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
  const isMobileViewport = useMediaQuery(MOBILE_NOTICE_MEDIA_QUERY)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!eligible || typeof window === 'undefined') {
      setIsOpen(false)
      return undefined
    }

    const dismissed = window.sessionStorage.getItem(MOBILE_NOTICE_STORAGE_KEY) === 'true'
    setIsOpen(isMobileViewport && !dismissed)
    return undefined
  }, [eligible, isMobileViewport])

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

/** Tells phone users the organizer tools are built for larger screens. Live View is fine on phones. */
export default function MobileCompatibilityNotice({ open, onContinue }: MobileCompatibilityNoticeProps) {
  return (
    <Modal
      open={open}
      onClose={onContinue}
      size="sm"
      title="Desktop or tablet recommended"
      description="BracketWorks tournament tools are built for desktop and tablet screens. Some tables, forms, and brackets may be hard to use on a phone."
      footer={<Button variant="primary" fullWidth onClick={onContinue}>Continue anyway</Button>}
    >
      <p className={styles.note}>Live View works fully on phones.</p>
    </Modal>
  )
}
