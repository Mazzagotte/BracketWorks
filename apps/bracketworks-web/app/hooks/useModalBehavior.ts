'use client'

import { RefObject, useEffect, useRef } from 'react'

import { setBodyInteractionState } from '../utils/modalUtils'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type UseModalBehaviorOptions = {
  /** Whether the modal is currently open. */
  open: boolean
  /** Called when the user presses Escape or clicks the backdrop. */
  onClose: () => void
  /** Ref to the dialog element (for focus trap). */
  dialogRef: RefObject<HTMLElement | null>
  /** Set false to disable Escape-to-close (e.g. destructive confirmations). Default true. */
  closeOnEscape?: boolean
  /** Called on backdrop (overlay) click. Defaults to onClose; pass undefined via closeOnBackdrop=false to disable. */
  closeOnBackdrop?: boolean
  /** Optional element to focus on open (defaults to the dialog itself). */
  initialFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Shared modal behavior: locks body scroll while open, closes on Escape,
 * traps Tab focus within the dialog, and restores focus on close.
 *
 * Wire the returned `onOverlayClick` onto the overlay element to get
 * backdrop-click dismissal (only fires when the click target IS the overlay,
 * so no stopPropagation needed on the dialog).
 */
export function useModalBehavior({
  open,
  onClose,
  dialogRef,
  closeOnEscape = true,
  closeOnBackdrop = true,
  initialFocusRef,
}: UseModalBehaviorOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    setBodyInteractionState({ scrollLocked: true, touchLocked: false })
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusFrame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? dialogRef.current
      target?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeOnEscape) {
          event.preventDefault()
          onClose()
        }
        return
      }

      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
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
      previousFocusRef.current = null
    }
  }, [open, onClose, dialogRef, closeOnEscape, initialFocusRef])

  const onOverlayClick = closeOnBackdrop
    ? (event: React.MouseEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) onClose()
      }
    : undefined

  return { onOverlayClick }
}
