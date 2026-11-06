'use client'

import React, { useState, useEffect } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import { Button, ICON_SIZE, Modal, Notice } from '@bracketworks/ui'
import { logger } from '../lib/logger'
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
    friendly: 'No players found',
    suggestion: 'Please add players to this tournament or squad before generating brackets.'
  },
  'No scores found': {
    friendly: 'No qualifying scores',
    suggestion: 'Please add qualifying scores for players before generating brackets.'
  },
  'Bracket size not configured': {
    friendly: 'Bracket size not set',
    suggestion: 'Please configure bracket settings in the tournament dashboard first.'
  },
  'Tournament not found': {
    friendly: 'Tournament not found',
    suggestion: 'The selected tournament may have been deleted. Please refresh and try again.'
  },
  'Tournament ID must be a positive integer': {
    friendly: 'Invalid tournament selection',
    suggestion: 'Please select a valid tournament from the dashboard.'
  },
  'default': {
    friendly: 'Generation failed',
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
    }
  }, [isOpen])

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

  const stats = currentPhase === 'success' ? getSuccessStats() : null
  const parsedError = currentPhase === 'error' ? parseErrorMessage(errorMessage) : null
  const context = [tournamentName, squadName, typeof playerCount === 'number' ? `${playerCount} entries` : null].filter(Boolean).join(' · ')

  const title = currentPhase === 'loading' ? 'Generating brackets' : currentPhase === 'success' ? 'Brackets generated' : parsedError?.friendly ?? 'Generation failed'
  const description = currentPhase === 'loading'
    ? `Creating brackets and assigning entries${context ? ` for ${context}` : ''}.`
    : currentPhase === 'success'
      ? 'Your brackets are ready to review.'
      : parsedError?.suggestion

  return (
    <Modal
      open={isOpen}
      onClose={handleCloseModal}
      dismissible={!isGenerating}
      role={currentPhase === 'error' ? 'alertdialog' : 'dialog'}
      closeLabel="Close bracket generation"
      title={title}
      description={description}
      footer={currentPhase === 'loading' ? undefined : currentPhase === 'success' ? (
        <>
          <Button variant="secondary" icon={<RefreshCw size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleRegenerateClick}>Regenerate</Button>
          <Button variant="primary" icon={<Eye size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleCloseModal}>Review brackets</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
          <Button variant="primary" icon={<RefreshCw size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleRegenerateClick}>Retry</Button>
        </>
      )}
    >
      {currentPhase === 'loading' ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.text}>Keep this window open until your brackets are ready.</p>
        </div>
      ) : null}

      {stats ? (
        <div className={styles.body}>
          <dl className={styles.rows}>
            {stats.programSummaries.map(program => (
              <div key={program.name}>
                <dt>{program.name} bracket{program.brackets_count !== 1 ? 's' : ''}</dt>
                <dd>{program.brackets_count}</dd>
              </div>
            ))}
          </dl>
          {stats.skippedPlayers > 0 ? (
            <Notice tone="warning">
              {stats.skippedPlayers} entr{stats.skippedPlayers !== 1 ? 'ies' : 'y'} could not be placed in a full bracket and need a refund ({stats.programSummaries.filter(program => program.refund_entries > 0).map(program => `${program.refund_entries} ${program.name}`).join(', ')}).
            </Notice>
          ) : null}
          <p className={styles.meta}>Regenerating creates a new arrangement and may change the current matchups.</p>
        </div>
      ) : null}

      {parsedError ? (
        <div className={styles.body}>
          <Button size="sm" variant="ghost" onClick={() => setShowTechnicalDetails(!showTechnicalDetails)} aria-expanded={showTechnicalDetails}>
            {showTechnicalDetails ? 'Hide details' : 'Show details'}
          </Button>
          {showTechnicalDetails ? <code className={styles.code}>{parsedError.technical}</code> : null}
        </div>
      ) : null}
    </Modal>
  )
}
