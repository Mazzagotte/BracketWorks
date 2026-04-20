'use client'

import React, { useState, useEffect } from 'react'
import { logger } from '../lib/logger'
import { disableScroll, enableScroll } from '../utils/modalUtils'
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
  tournamentName?: string
  squadName?: string
  playerCount?: number
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
 * Error message mappings for user-friendly display
 */
const ERROR_MESSAGES: { [key: string]: { friendly: string, suggestion: string } } = {
  'No players found': {
    friendly: 'No Players Found',
    suggestion: 'Please add players to this tournament or squad before generating brackets.'
  },
  'No scores found': {
    friendly: 'No Qualifying Scores',
    suggestion: 'Please add qualifying scores for players before generating brackets.'
  },
  'Bracket size not configured': {
    friendly: 'Bracket Size Not Set',
    suggestion: 'Please configure bracket settings in the tournament dashboard first.'
  },
  'Tournament not found': {
    friendly: 'Tournament Not Found',
    suggestion: 'The selected tournament may have been deleted. Please refresh and try again.'
  },
  'Tournament ID must be a positive integer': {
    friendly: 'Invalid Tournament Selection',
    suggestion: 'Please select a valid tournament from the dashboard.'
  },
  'default': {
    friendly: 'Generation Failed',
    suggestion: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
  }
}

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
  bracketGenerationPromise,
  tournamentName,
  squadName,
  playerCount
}: BracketGenerationModalProps) {
  // State management
  const [currentPhase, setCurrentPhase] = useState<ModalPhase>('loading')
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [shouldAutoClose, setShouldAutoClose] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [bracketResult, setBracketResult] = useState<any>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  /**
   * Reset modal state when it opens
   */
  useEffect(() => {
    if (isOpen) {
      setCurrentPhase('loading')
      setCurrentMessageIndex(0)
      setErrorMessage('')
      setProgress(0)
      setElapsedTime(0)
      setBracketResult(null)
      setShowTechnicalDetails(false)
      setShowConfetti(false)
      disableScroll()
    }

    return () => {
      enableScroll()
    }
  }, [isOpen])

  /**
   * Handle Escape key to close modal
   */
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

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
   * Update progress and elapsed time during loading phase
   * Progress bar fills over 15 seconds, time counts up
   */
  useEffect(() => {
    if (currentPhase === 'loading' && isOpen) {
      const TOTAL_DURATION_MS = 15000 // 15 seconds
      const UPDATE_INTERVAL_MS = 100 // Update every 100ms for smooth animation
      const startTime = Date.now()

      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progressPercentage = Math.min((elapsed / TOTAL_DURATION_MS) * 100, 100)
        const elapsedSeconds = Math.floor(elapsed / 1000)

        setProgress(progressPercentage)
        setElapsedTime(elapsedSeconds)

        // Stop interval when we hit 15 seconds
        if (elapsed >= TOTAL_DURATION_MS) {
          clearInterval(progressInterval)
        }
      }, UPDATE_INTERVAL_MS)

      return () => clearInterval(progressInterval)
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
        .then((results) => {
          // Store the bracket generation result (first promise result)
          const result = results[0]
          setBracketResult(result)
          
          // Both conditions met - show success
          setCurrentPhase('success')
          
          // Trigger confetti celebration
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 3000) // Hide after 3 seconds
          
          // Auto-close if enabled
          if (shouldAutoClose) {
            setTimeout(() => {
              handleCloseModal()
            }, 1000) // 1 second delay before auto-closing
          }
        })
        .catch((error) => {
          // Error occurred - show error immediately (bypass 15-second wait)
          logger.error('Bracket generation error', { error });
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
    setProgress(0)
    setElapsedTime(0)
    onRegenerate()
  }

  /**
   * Format remaining time for display
   */
  const getTimeRemainingText = (): string => {
    const TOTAL_SECONDS = 15
    const remainingSeconds = Math.max(0, TOTAL_SECONDS - elapsedTime)
    
    if (remainingSeconds === 0) {
      return 'Finishing up...'
    } else if (remainingSeconds <= 3) {
      return 'Almost done...'
    } else {
      return `${remainingSeconds} seconds remaining`
    }
  }

  /**
   * Extract success statistics from bracket result
   */
  const getSuccessStats = () => {
    if (!bracketResult) {
      return {
        scratchCount: 0,
        handicapCount: 0,
        totalPlayers: 0,
        skippedPlayers: 0,
        scratchRefunds: 0,
        handicapRefunds: 0
      }
    }

    const scratchBrackets = bracketResult.scratch_brackets || []
    const handicapBrackets = bracketResult.handicap_brackets || []
    const summary = bracketResult.summary || {}
    
    // Count total players from first round of all brackets
    let totalPlayers = 0
    scratchBrackets.forEach((bracket: any) => {
      if (bracket.rounds && bracket.rounds[0] && bracket.rounds[0].matches) {
        totalPlayers += bracket.rounds[0].matches.length * 2
      }
    })
    handicapBrackets.forEach((bracket: any) => {
      if (bracket.rounds && bracket.rounds[0] && bracket.rounds[0].matches) {
        totalPlayers += bracket.rounds[0].matches.length * 2
      }
    })

    // Get refund counts from summary (more accurate than validation_warnings)
    const scratchRefunds = summary.scratch_refund_entries || 0
    const handicapRefunds = summary.handicap_refund_entries || 0
    const totalRefunds = scratchRefunds + handicapRefunds

    return {
      scratchCount: scratchBrackets.length,
      handicapCount: handicapBrackets.length,
      totalPlayers,
      skippedPlayers: totalRefunds,
      scratchRefunds,
      handicapRefunds
    }
  }

  /**
   * Parse error message and return user-friendly version
   */
  const parseErrorMessage = (error: string): { friendly: string, suggestion: string, technical: string } => {
    // Find matching error pattern
    for (const [pattern, messages] of Object.entries(ERROR_MESSAGES)) {
      if (pattern !== 'default' && error.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          friendly: messages.friendly,
          suggestion: messages.suggestion,
          technical: error
        }
      }
    }
    
    // Return default if no match found
    return {
      friendly: ERROR_MESSAGES['default'].friendly,
      suggestion: ERROR_MESSAGES['default'].suggestion,
      technical: error
    }
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
    <div 
      className={styles.modalOverlay} 
      onClick={(e) => {
        // Only close if clicking directly on the backdrop overlay, not the modal card
        if (e.target === e.currentTarget) {
          handleCloseModal()
        }
      }}
    >
      <div 
        className={styles.modalCard} 
        onClick={(event) => event.stopPropagation()}
      >
        {/* CONFETTI CELEBRATION */}
        {showConfetti && (
          <div className={styles.confettiContainer}>
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className={styles.confetti}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  backgroundColor: ['#fbbf24', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'][i % 6]
                }}
              />
            ))}
          </div>
        )}

        {/* LOADING PHASE */}
        {currentPhase === 'loading' && (
          <div className={styles.loadingContent}>
            {/* Tournament Context Info */}
            {(tournamentName || squadName || playerCount !== undefined) && (
              <div className={styles.contextInfo}>
                {tournamentName && (
                  <p className={styles.contextText}>
                    <span className={styles.contextLabel}>Tournament:</span> {tournamentName}
                  </p>
                )}
                {squadName && (
                  <p className={styles.contextText}>
                    <span className={styles.contextLabel}>Squad:</span> {squadName}
                  </p>
                )}
                {playerCount !== undefined && (
                  <p className={styles.contextText}>
                    <span className={styles.contextLabel}>Players:</span> {playerCount}
                  </p>
                )}
              </div>
            )}

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

            {/* Progress Bar */}
            <div className={styles.progressBarContainer}>
              <div className={styles.progressBarBackground}>
                <div 
                  className={styles.progressBarFill} 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className={styles.progressText}>{Math.round(progress)}%</div>
            </div>

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
            {/* Success message */}
            <h2 className={styles.successMessage}>
              Brackets Generated Successfully!
            </h2>

            {/* Success Statistics */}
            <div className={styles.statsContainer}>
              {(() => {
                const stats = getSuccessStats()
                return (
                  <>
                    {stats.handicapCount > 0 && (
                      <div className={styles.statItem} style={{ animationDelay: '0.1s' }}>
                        <span className={styles.statText}>
                          {stats.handicapCount} Handicap Bracket{stats.handicapCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {stats.scratchCount > 0 && (
                      <div className={styles.statItem} style={{ animationDelay: '0.2s' }}>
                        <span className={styles.statText}>
                          {stats.scratchCount} Scratch Bracket{stats.scratchCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    <div className={styles.statItem} style={{ animationDelay: '0.3s' }}>
                      <span className={styles.statText}>
                        {stats.skippedPlayers} Refund{stats.skippedPlayers !== 1 ? 's' : ''} ({stats.handicapRefunds} Handicap & {stats.scratchRefunds} Scratch)
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>

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
            <div className={styles.errorIcon}></div>

            {(() => {
              const parsedError = parseErrorMessage(errorMessage)
              return (
                <>
                  {/* User-friendly error message */}
                  <h2 className={styles.errorMessage}>
                    {parsedError.friendly}
                  </h2>
                  
                  {/* Suggestion */}
                  <p className={styles.errorSuggestion}>
                    {parsedError.suggestion}
                  </p>

                  {/* Technical Details (expandable) */}
                  <div className={styles.technicalDetailsContainer}>
                    <button
                      onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                      className={styles.technicalDetailsToggle}
                    >
                      {showTechnicalDetails ? '▼' : '►'} Technical Details
                    </button>
                    {showTechnicalDetails && (
                      <div className={styles.technicalDetails}>
                        <code>{parsedError.technical}</code>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

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
