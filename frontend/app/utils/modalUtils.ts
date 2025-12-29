/**
 * Modal State Management Utilities
 * Ensures modals don't leave document state in an inconsistent state
 */

let scrollBlockCount = 0
/**
 * Safely enable scrolling on document
 * - Resets document.body.overflow to 'auto'
 * - Safe to call multiple times
 */
export function enableScroll(): void {
  if (typeof document === 'undefined') return
  try {
    scrollBlockCount = Math.max(0, scrollBlockCount - 1)
    if (scrollBlockCount === 0) {
      document.body.style.overflow = 'auto'
    }
  } catch (error) {
    console.error('Failed to enable scroll:', error)
  }
}

/**
 * Safely disable scrolling on document
 * - Sets document.body.overflow to 'hidden'
 * - Safe to call multiple times
 */
export function disableScroll(): void {
  if (typeof document === 'undefined') return
  try {
    scrollBlockCount += 1
    document.body.style.overflow = 'hidden'
  } catch (error) {
    console.error('Failed to disable scroll:', error)
  }
}

/**
 * Cleanup all modal-related document state
 * - Re-enables scrolling
 * - Should be called when modals are forcibly closed or on page unload
 */
export function cleanupModalState(): void {
  scrollBlockCount = 0
  enableScroll()
}

/**
 * Force reset all scroll locks immediately.
 * Use this on page mount if a prior page left the body locked.
 */
export function resetScrollLocks(): void {
  scrollBlockCount = 0
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'auto'
    document.body.style.touchAction = 'pan-y pan-x'
    ;(document.body.style as any).webkitOverflowScrolling = 'touch'
  }
}

/**
 * Remove any stray modal overlays that might have been left mounted by other pages/components.
 * Targets common overlay class names used in this app.
 */
export function clearStrayOverlays(): void {
  if (typeof document === 'undefined') return
  
  const overlaySelectors = ['.modal-overlay', '.modalOverlay', '.overlay', '.modalBackdrop']
  overlaySelectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      // Check if the element is actually a modal overlay (has fixed positioning and high z-index)
      const styles = window.getComputedStyle(el)
      const isOverlay = styles.position === 'fixed' && parseInt(styles.zIndex) > 100
      
      if (isOverlay) {
        // Remove it completely from the DOM
        el.remove()
      }
    })
  })
}
