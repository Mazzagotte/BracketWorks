'use client'

import React, { useState, useEffect } from 'react'
import styles from './BracketGenerationModal.module.css'

/**
 * Type definitions for modal phases and state
 */
type ModalPhase = 'loading' | 'success' | 'error'

interface BracketGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  onRegenerate: () => void
  bracketGenerationPromise: Promise<any> | null
}

/**
 * Bowling-themed progress messages that rotate during generation
 */
const PROGRESS_MESSAGES = [
  "Rolling your brackets…",
  "Knocking down some math…",
  "Wiping the lanes…",
  "Cleaning the gutters…",
  "Setting up a perfect game…",
  "Assigning bowlers…",
  "Setting up matches…",
  "Finalizing bracket sheet…"
]

/**
 * BracketGenerationModal Component
 * 
 * Displays a modal during bracket generation with:
 * - Loading state with bowling ball animation
 * - Rotating progress messages
 * - 15-second minimum duration enforcement
 * - Success and error states
 * - Auto-close option
 */
export default function BracketGenerationModal({
  isOpen,
  onClose,
  onRegenerate,
  bracketGenerationPromise
}: BracketGenerationModalProps) {
  // State management
  const [currentPhase, setCurrentPhase] = useState<ModalPhase>('loading')
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [shouldAutoClose, setShouldAutoClose] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  /**
   * Reset modal state when it opens
   */
  useEffect(() => {
    if (isOpen) {
      setCurrentPhase('loading')
      setCurrentMessageIndex(0)
      setErrorMessage('')
    }
  }, [isOpen])

  /**
   * Rotate progress messages every 3 seconds during loading phase
   */
  useEffect(() => {
    if (currentPhase === 'loading' && isOpen) {
      const messageRotationInterval = setInterval(() => {
        setCurrentMessageIndex((previousIndex) => 
          (previousIndex + 1) % PROGRESS_MESSAGES.length
        )
      }, 3000) // Change message every 3 seconds

      return () => clearInterval(messageRotationInterval)
    }
  }, [currentPhase, isOpen])

  /**
   * Handle bracket generation with 15-second minimum duration
   */
  useEffect(() => {
    if (isOpen && bracketGenerationPromise && currentPhase === 'loading') {
      const generationStartTime = Date.now()
      const MINIMUM_DURATION_MS = 15000 // 15 seconds

      // Create a promise that resolves after minimum duration
      const minimumDurationPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, MINIMUM_DURATION_MS)
      })

      // Wait for both the API call and minimum duration
      Promise.all([bracketGenerationPromise, minimumDurationPromise])
        .then(() => {
          // Both conditions met - show success
          setCurrentPhase('success')
          
          // Auto-close if enabled
          if (shouldAutoClose) {
            setTimeout(() => {
              handleCloseModal()
            }, 1000) // 1 second delay before auto-closing
          }
        })
        .catch((error) => {
          // Error occurred - show error immediately (bypass 15-second wait)
          console.error('Bracket generation error:', error)
          setErrorMessage(error.message || 'An unexpected error occurred')
          setCurrentPhase('error')
        })
    }
  }, [isOpen, bracketGenerationPromise, currentPhase])

  /**
   * Handle modal close
   */
  const handleCloseModal = () => {
    onClose()
  }

  /**
   * Handle regenerate/retry action
   */
  const handleRegenerateClick = () => {
    setCurrentPhase('loading')
    setCurrentMessageIndex(0)
    setErrorMessage('')
    onRegenerate()
  }

  /**
   * Don't render if modal is closed
   */
  if (!isOpen) {
    return null
  }

  /**
   * Render the modal based on current phase
   */
  return (
    <div className={styles.modalOverlay} onClick={handleCloseModal}>
      <div 
        className={styles.modalCard} 
        onClick={(event) => event.stopPropagation()}
      >
        {/* LOADING PHASE */}
        {currentPhase === 'loading' && (
          <div className={styles.loadingContent}>
            {/* Bowling Ball Animation */}
            <div className={styles.animationContainer}>
              <div className={styles.bowlingBall}>
                {/* Main ball body */}
                <div className={styles.ballBody} />
                
                {/* Finger holes on the ball */}
                <div className={styles.fingerHole} style={{ top: '15px', left: '15px' }} />
                <div className={styles.fingerHole} style={{ top: '25px', left: '35px' }} />
                <div className={styles.fingerHole} style={{ top: '35px', left: '25px' }} />
              </div>
            </div>

            {/* Main message */}
            <h2 className={styles.mainMessage}>Generating Brackets...</h2>

            {/* Rotating progress message */}
            <p className={styles.progressMessage} key={currentMessageIndex}>
              {PROGRESS_MESSAGES[currentMessageIndex]}
            </p>

            {/* Auto-close checkbox */}
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                id="autoCloseCheckbox"
                checked={shouldAutoClose}
                onChange={(event) => setShouldAutoClose(event.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="autoCloseCheckbox" className={styles.checkboxLabel}>
                Close automatically when generation completes
              </label>
            </div>
          </div>
        )}

        {/* SUCCESS PHASE */}
        {currentPhase === 'success' && (
          <div className={styles.successContent}>
            {/* Success Icon */}
            <div className={styles.successIcon}>✓</div>

            {/* Success message */}
            <h2 className={styles.successMessage}>
              Brackets Generated Successfully!
            </h2>

            {/* Action buttons */}
            <div className={styles.buttonContainer}>
              <button
                onClick={handleRegenerateClick}
                className={`${styles.button} ${styles.primaryButton}`}
              >
                Regenerate Brackets
              </button>
              <button
                onClick={handleCloseModal}
                className={`${styles.button} ${styles.secondaryButton}`}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ERROR PHASE */}
        {currentPhase === 'error' && (
          <div className={styles.errorContent}>
            {/* Error Icon */}
            <div className={styles.errorIcon}>⚠️</div>

            {/* Error message */}
            <h2 className={styles.errorMessage}>
              Whoops — the pins didn't fall this time.
            </h2>
            <p className={styles.errorSubtext}>
              Please try again.
            </p>

            {/* Detailed error (if available) */}
            {errorMessage && (
              <p className={styles.errorDetails}>
                {errorMessage}
              </p>
            )}

            {/* Action buttons */}
            <div className={styles.buttonContainer}>
              <button
                onClick={handleRegenerateClick}
                className={`${styles.button} ${styles.primaryButton}`}
              >
                Retry
              </button>
              <button
                onClick={handleCloseModal}
                className={`${styles.button} ${styles.secondaryButton}`}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
