'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { Tournament, Squad } from '../lib/types'
import { usePayouts } from './hooks/usePayouts'
import { usePayoutSetup, ScoreRow } from './hooks/usePayoutSetup'
import { usePayoutExport } from './hooks/usePayoutExport'
import { useSidePotAccounting } from './hooks/useSidePotAccounting'
import NoTournamentState from '../components/NoTournamentState'
import { storage } from '../lib/storage'
import { getMemoryAccessToken } from '../lib/api'
import Link from 'next/link'
import styles from './payouts.module.css'
import cardStyles from '../styles/cards.module.css'
import buttonStyles from '../styles/buttons.module.css'
import shellStyles from '../styles/page-shell.module.css'
import ExplainPayoutsModal from './ExplainPayoutsModal'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../lib/formatters'
import { logger } from '../lib/logger'
import { getSelectedTournamentId } from '../lib/selection-session'
import { getPayoutUnlockKey } from '../lib/storageKeys'
import { MOBILE_VIEWPORT_QUERY } from '../lib/responsive'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { aggregateWinnersByPlayer, buildPaymentSummary, filterWinnersByName } from './utils/payoutViewModel'
import PayoutsQuickActions from './components/PayoutsQuickActions'
import PayoutsSummaryCard from './components/PayoutsSummaryCard'
import PayoutsSearchPanel from './components/PayoutsSearchPanel'
import PayoutsResultsCard from './components/PayoutsResultsCard'
import TournamentFinalReview from './components/TournamentFinalReview'

export default function PayoutsPage() {
  const { addToast } = useToast()
  const { isUserAuthenticated, isAuthInitialized, authToken } = useAuth()
  const effectiveAuthToken = authToken || getMemoryAccessToken()
  const { fetchTournaments } = useTournaments()
  const { fetchSquads } = useSquads()

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')
  const [paidKeys, setPaidKeys] = useState<Set<string>>(new Set())
  const [, setScoreRows] = useState<ScoreRow[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [isUnlocked, setIsUnlocked] = useState(false)
  const isMobileView = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const [isPayoutsGuideOpen, setIsPayoutsGuideOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const refreshSelection = () => {
      setSelectionRefreshKey(previous => previous + 1)
    }

    window.addEventListener('tournament-changed', refreshSelection)
    window.addEventListener('squad-changed', refreshSelection)

    return () => {
      window.removeEventListener('tournament-changed', refreshSelection)
      window.removeEventListener('squad-changed', refreshSelection)
    }
  }, [])

  // Payout access becomes persistent per tournament/squad after Calculate Payouts is confirmed.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = getPayoutUnlockKey(selectedTournament?.id ?? null, selectedSquad?.id ?? null)
    if (!key) {
      setIsUnlocked(false)
      return
    }

    const unlockedFromScoresFlow = sessionStorage.getItem('payouts_unlocked') === '1'
    if (unlockedFromScoresFlow) {
      sessionStorage.removeItem('payouts_unlocked')
      storage.setItem(key, '1')
      setIsUnlocked(true)
      return
    }

    setIsUnlocked(storage.getItem(key) === '1')
  }, [selectedSquad, selectedTournament])

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const { payoutData, loading, error, loadPayoutData } =
    usePayouts(selectedTournament?.id ?? null, selectedSquad?.id ?? null)

  usePayoutSetup({
    isAuthInitialized,
    isUserAuthenticated,
    authToken: effectiveAuthToken,
    isUnlocked,
    selectionRefreshKey,
    selectedTournament,
    selectedSquad,
    fetchSquads,
    setSelectedTournament,
    setSelectedSquad,
    setScoreRows,
  })

  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

  useEffect(() => {
    if (!selectedTournament || !isUnlocked) return
    loadPayoutData()
    try {
      const stored = storage.getItem(`payouts_paid_${selectedTournament.id}`)
      setPaidKeys(new Set(stored ? JSON.parse(stored) : []))
    } catch {
      logger.error('Failed to parse paid keys from storage')
      setPaidKeys(new Set())
    }
  }, [isUnlocked, loadPayoutData, selectedSquad, selectedTournament])

  const togglePaid = useCallback((key: string) => {
    if (!selectedTournament) return
    setPaidKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      storage.setItem(`payouts_paid_${selectedTournament.id}`, JSON.stringify([...next]))
      return next
    })
  }, [selectedTournament])
  const aggregatedWinners = useMemo(
    () => aggregateWinnersByPlayer(payoutData?.winners_by_bracket ?? []),
    [payoutData],
  )

  const { totalUniqueWinners, paidCount, remainingAmount } = useMemo(
    () => buildPaymentSummary(aggregatedWinners, paidKeys),
    [aggregatedWinners, paidKeys],
  )

  const filteredWinners = useMemo(
    () => filterWinnersByName(aggregatedWinners, searchFirstName, searchLastName),
    [aggregatedWinners, searchFirstName, searchLastName],
  )

  const sidePotAccounting = useSidePotAccounting(payoutData)

  const {
    isExportingExcel,
    isExportingPdf,
    exportToExcel,
    exportToPdf,
    sidePotByPlayer,
  } = usePayoutExport({
    addToast,
    winners: filteredWinners,
    paidKeys,
    payoutData,
    sidePotSummaries: sidePotAccounting.summaries,
    selectedTournament,
    selectedSquad,
  })


  const programSummaries = useMemo(
    () => (payoutData?.program_summaries ?? []).filter(program => program.total_brackets > 0),
    [payoutData]
  )

  const displayedTotalPrizePool = (payoutData?.total_prize_pool ?? 0) + sidePotAccounting.totalPool

  const hasActiveSession = Boolean(effectiveAuthToken)

  if (!isAuthInitialized) {
    return (
      <div className={styles.loadingRow}>
        <div className={styles.loadingSpinner} />
        <span role="status">Loading payouts...</span>
      </div>
    )
  }

  if (!isUserAuthenticated && !hasActiveSession) {
    return (
      <div className={`${cardStyles.card} ${cardStyles.emptyStateCard} ${styles.emptyState}`}>
        <div className={styles.emptyTitle}>Please log in</div>
        <div className={styles.emptyMessage}>Sign in to view payout information.</div>
      </div>
    )
  }

  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
    return (
      <NoTournamentState
        title="Payout Desk Waiting"
        description="Load a tournament to review prize pools, verify winners, and track payout completion."
        cards={[
          { title: 'Review Prize Pools', text: 'See scratch and handicap totals calculated from paid bracket entries.' },
          { title: 'Confirm Winners', text: 'Validate placements and earnings before payments are distributed.' },
          { title: 'Track Completion', text: 'Mark payouts as paid so end-of-day settlement stays clean and auditable.' },
        ]}
      />
    )
  }

  if (!isUnlocked) {
    return (
      <NoTournamentState
        title="Payouts Not Yet Calculated"
        description="Go to Scores and run Calculate Payouts after score review. This locks in final results before distribution."
        actionHref="/scores"
        actionLabel="Open Scores"
        cards={[
          { title: 'Finalize Scoring', text: 'Ensure every bowler score is entered and verified before payout calculation.' },
          { title: 'Run Calculation', text: 'Calculate Payouts checks for gaps and confirms readiness before processing.' },
          { title: 'Distribute & Close', text: 'Return here to review winners, publish totals, and mark payouts complete.' },
        ]}
      />
    )
  }

  return (
    <ErrorBoundary>
      <div className={`${shellStyles.page} ${styles.pageContainer}`}>
        <div className={`${cardStyles.card} ${cardStyles.quickActionsCard} ${styles.quickActionsCard}`}>
          <h2 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle}`}>
            Quick Actions
          </h2>
          <div className={cardStyles.quickActionsBody}>
            <PayoutsQuickActions
              hasRows={filteredWinners.length > 0}
              isLoading={loading}
              isExportingExcel={isExportingExcel}
              isExportingPdf={isExportingPdf}
              isMobileView={isMobileView}
              onOpenGuide={() => setIsPayoutsGuideOpen(true)}
              onExportToExcel={() => {
                void exportToExcel()
              }}
              onExportToPdf={exportToPdf}
            />
          </div>
        </div>

        {payoutData && (
          <PayoutsSummaryCard
            payoutData={payoutData}
            programSummaries={programSummaries}
            sidePotSummaries={sidePotAccounting.summaries}
            displayedTotalPrizePool={displayedTotalPrizePool}
            paidCount={paidCount}
            totalUniqueWinners={totalUniqueWinners}
            remainingAmount={remainingAmount}
          />
        )}

        {selectedTournament && (
          <TournamentFinalReview tournamentId={selectedTournament.id} tournamentName={selectedTournament.name} squadId={selectedSquad?.id ?? null} />
        )}

        {error && <div className={`${cardStyles.statePanel} ${cardStyles.dangerPanel} ${styles.errorBanner}`}>{error}</div>}

        {payoutData && aggregatedWinners.length > 0 && (
          <PayoutsSearchPanel
            searchFirstName={searchFirstName}
            searchLastName={searchLastName}
            onSearchFirstNameChange={setSearchFirstName}
            onSearchLastNameChange={setSearchLastName}
            onClear={() => {
              setSearchFirstName('')
              setSearchLastName('')
            }}
          />
        )}

        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.loadingSpinner} />
            <span>Calculating payouts...</span>
          </div>
        )}

        {!loading && !selectedTournament && (
          <NoTournamentState
            description="Load a tournament from the dashboard to review prize pools, winners, payment status, and payout exports."
            cards={[
              { title: 'Prize Pools', text: 'Review bracket and side-pot prize pools once tournament results are ready.' },
              { title: 'Winner Review', text: 'See winners by bracket program with payout amounts grouped for quick review.' },
              { title: 'Payment Tracking', text: 'Mark winners as paid and export payout records for tournament staff.' },
            ]}
          />
        )}

        {!loading && selectedTournament && aggregatedWinners.length === 0 && (
          <div className={`${cardStyles.card} ${cardStyles.emptyStateCard} ${styles.emptyState}`}>
            <h2 className={styles.emptyTitle}>
              No Payouts Calculated Yet
            </h2>
            <p className={styles.emptyMessage}>
              Complete brackets first, then return here to review and mark payouts.
            </p>
            <div className={cardStyles.emptyActions}>
              <Link href="/brackets" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}>
                Go to Brackets
              </Link>
              <Link href="/dashboard" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}>
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {!loading && aggregatedWinners.length > 0 && (
          <PayoutsResultsCard
            displayedTotalPrizePool={displayedTotalPrizePool}
            winners={filteredWinners}
            paidKeys={paidKeys}
            expandedKeys={expandedKeys}
            sidePotByPlayer={sidePotByPlayer}
            onToggleExpanded={toggleExpanded}
            onTogglePaid={togglePaid}
          />
        )}
      </div>

      <ExplainPayoutsModal
        isOpen={isPayoutsGuideOpen}
        onClose={() => setIsPayoutsGuideOpen(false)}
      />
    </ErrorBoundary>
  )
}

