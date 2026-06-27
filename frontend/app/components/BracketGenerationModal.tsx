'use client'

import React, { useState, useEffect } from 'react'
import { logger } from '../lib/logger'
import { disableScroll, enableScroll } from '../utils/modalUtils'
import buttonStyles from '../styles/buttons.module.css'
import styles from './BracketGenerationModal.module.css'

/**
 * Type definitions for modal phases and state
 */
type ModalPhase = 'loading' | 'success' | 'error'

interface BracketGroupSummary {
  name?: string
  key?: string
  brackets_count?: number
  refund_entries?: number
  entries_count?: number
}

interface BracketGenerationSummary {
  group_summaries?: BracketGroupSummary[]
  scratch_refund_entries?: number
  handicap_refund_entries?: number
}

interface BracketGenerationResult {
  summary?: BracketGenerationSummary
  scratch_brackets?: unknown[]
  handicap_brackets?: unknown[]
}

interface BracketGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  onRegenerate: () => void
  bracketGenerationPromise: Promise<BracketGenerationResult> | null
  tournamentName?: string
  squadName?: string
  playerCount?: number
}

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
 * - Navigation lock during active generation
 * - Success and error states
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
  const [errorMessage, setErrorMessage] = useState('')
  const [bracketResult, setBracketResult] = useState<BracketGenerationResult | null>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const isGenerating = currentPhase === 'loading'

  /**
   * Reset modal state when it opens
   */
  useEffect(() => {
    if (isOpen) {
      setCurrentPhase('loading')
      setErrorMessage('')
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
        if (isGenerating) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, isGenerating])

  /**
   * Block navigation while generation is in progress.
   */
  useEffect(() => {
    if (!isOpen || !isGenerating) {
      return
    }

    const unloadMessage = 'Bracket generation is still in progress. Please wait until it completes.'

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = unloadMessage
      return unloadMessage
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
    }

    const handlePopState = () => {
      window.history.pushState({ bracketGenerationLock: true }, '', window.location.href)
    }

    const handleKeyNavigation = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      const isEditable = !!target?.isContentEditable || tagName === 'input' || tagName === 'textarea'
      const key = event.key.toLowerCase()
      const isRefresh = key === 'f5' || ((event.ctrlKey || event.metaKey) && key === 'r')
      const isHistoryNav = (event.altKey && key === 'arrowleft') || (!isEditable && key === 'backspace')

      if (isRefresh || isHistoryNav) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.history.pushState({ bracketGenerationLock: true }, '', window.location.href)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyNavigation, true)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyNavigation, true)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [isOpen, isGenerating])

  /**
   * Handle bracket generation lifecycle
   */
  useEffect(() => {
    if (isOpen && bracketGenerationPromise && currentPhase === 'loading') {
      let cancelled = false

      Promise.resolve(bracketGenerationPromise)
        .then((result) => {
          if (cancelled) {
            return
          }

          setBracketResult(result)
          
          setCurrentPhase('success')
          setShowConfetti(true)
          setTimeout(() => {
            if (!cancelled) {
              setShowConfetti(false)
            }
          }, 3000)
        })
        .catch((error) => {
          if (cancelled) {
            return
          }

          logger.error('Bracket generation error', { error });
          setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
          setCurrentPhase('error')
        })

      return () => {
        cancelled = true
      }
    }
  }, [isOpen, bracketGenerationPromise, currentPhase])

  /**
   * Handle modal close
   */
  const handleCloseModal = () => {
    if (isGenerating) {
      return
    }
    onClose()
  }

  /**
   * Handle regenerate/retry action
   */
  const handleRegenerateClick = () => {
    setCurrentPhase('loading')
    setErrorMessage('')
    onRegenerate()
  }

  /**
   * Extract success statistics from bracket result
   */
  const getSuccessStats = () => {
    if (!bracketResult) {
      return {
        programSummaries: [] as Array<{ name: string; brackets_count: number; refund_entries: number; entries_count: number }>,
        skippedPlayers: 0,
        refundBreakdownText: '0'
      }
    }

    const summary = bracketResult.summary || {}
    const groupSummaries = Array.isArray(summary.group_summaries) ? summary.group_summaries : []

    const programSummaries = groupSummaries.map((group: BracketGroupSummary) => ({
      name: String(group?.name || group?.key || 'Bracket Program'),
      brackets_count: Number(group?.brackets_count || 0),
      refund_entries: Number(group?.refund_entries || 0),
      entries_count: Number(group?.entries_count || 0),
    }))

    const totalRefunds = programSummaries.reduce(
      (sum, group) => sum + group.refund_entries,
      0,
    )

    const refundParts = programSummaries
      .filter(group => group.refund_entries > 0)
      .map(group => `${group.refund_entries} ${group.name}`)
    const refundBreakdownText = refundParts.length > 0 ? refundParts.join(' & ') : '0'

    // Backwards-compatible fallback for older API responses.
    if (programSummaries.length === 0) {
      const scratchCount = Number((bracketResult.scratch_brackets || []).length)
      const handicapCount = Number((bracketResult.handicap_brackets || []).length)
      const scratchRefunds = Number(summary.scratch_refund_entries || 0)
      const handicapRefunds = Number(summary.handicap_refund_entries || 0)

      return {
        programSummaries: [
          { name: 'Handicap', brackets_count: handicapCount, refund_entries: handicapRefunds, entries_count: 0 },
          { name: 'Scratch', brackets_count: scratchCount, refund_entries: scratchRefunds, entries_count: 0 },
        ],
        skippedPlayers: scratchRefunds + handicapRefunds,
        refundBreakdownText: `${handicapRefunds} Handicap & ${scratchRefunds} Scratch`,
      }
    }

    return {
      programSummaries,
      skippedPlayers: totalRefunds,
      refundBreakdownText,
    }
  }

  /**
   * Parse error message and return user-friendly version
   */
  const parseErrorMessage = (error: string): { friendly: string, suggestion: string, technical: string } => {
    const defaultMessage = ERROR_MESSAGES.default ?? {
      friendly: 'Something went wrong while generating brackets.',
      suggestion: 'Please try again. If this continues, contact support.',
    }

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
      friendly: defaultMessage.friendly,
      suggestion: defaultMessage.suggestion,
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
        if (!isGenerating && e.target === e.currentTarget) {
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
              />
            ))}
          </div>
        )}

        {/* LOADING PHASE */}
        {currentPhase === 'loading' && (
          <div className={styles.loadingContent}>
            {/* Tournament Context Info */}
            {(tournamentName || squadName) && (
              <div className={styles.contextInfo}>
                {tournamentName && (
                  <p className={styles.contextTournament}>{tournamentName}</p>
                )}
                {squadName && (
                  <p className={styles.contextSquad}>{squadName}</p>
                )}
              </div>
            )}

            <div className={styles.statusIndicator} aria-hidden="true">
              <span className={styles.statusIndicatorBar} />
            </div>

            {/* Main message */}
            <h2 className={styles.mainMessage}>Generating Brackets...</h2>

            <p className={styles.generationNote}>
              Please wait while brackets are generated. Navigation will unlock automatically when setup is complete.
            </p>

            <p className={styles.generationWarning}>
              Please keep this window open until generation finishes.
            </p>

          </div>
        )}

        {/* SUCCESS PHASE */}
        {currentPhase === 'success' && (
          <div className={styles.successContent}>
            {/* Success message */}
            <div className={styles.successHeader}>
              <h2 className={styles.successMessage}>Brackets Generated</h2>
              <p className={styles.successSubtitle}>Your tournament brackets are ready for review.</p>
            </div>

            {/* Success Statistics */}
            <div className={styles.statsContainer}>
              {(() => {
                const stats = getSuccessStats()
                return (
                  <>
                    {stats.programSummaries.map((program, index) => (
                      <div key={program.name} className={styles.statItem}>
                        <span className={styles.statCount}>{program.brackets_count}</span>
                        <span className={styles.statLabel}>{program.name} Bracket{program.brackets_count !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                    {stats.skippedPlayers > 0 && (
                      <div className={styles.statItemRefund}>
                        <div className={styles.refundTitle}>Refunds due to incomplete brackets</div>
                        <div className={styles.refundDetail}>{stats.skippedPlayers} total - {stats.refundBreakdownText}</div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Action buttons */}
            <div className={styles.buttonContainer}>
              <button
                onClick={handleRegenerateClick}
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium} ${styles.button} ${styles.primaryButton}`}
              >
                Regenerate Brackets
              </button>
              <button
                onClick={handleCloseModal}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium} ${styles.button} ${styles.secondaryButton}`}
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
                      {showTechnicalDetails ? 'Hide Details' : 'View Details'}
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
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium} ${styles.button} ${styles.primaryButton}`}
              >
                Retry
              </button>
              <button
                onClick={handleCloseModal}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium} ${styles.button} ${styles.secondaryButton}`}
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
