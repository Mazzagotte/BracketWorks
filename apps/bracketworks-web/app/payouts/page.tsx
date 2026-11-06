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
import { Trophy } from 'lucide-react'
import { Card, EmptyState, ICON_SIZE, Notice, Page, PageHeader, buttonClassName } from '@bracketworks/ui'
import styles from './components/Payouts.module.css'
import ExplainPayoutsModal from './ExplainPayoutsModal'
import { useToast } from '../components/Toast'
import { logger } from '../lib/logger'
import { getSelectedTournamentId } from '../lib/selection-session'
import { getPayoutUnlockKey } from '../lib/storageKeys'
import { formatSquadDate } from '../lib/squadDate'
import { aggregateWinnersByPlayer, buildPaymentSummary, filterWinnersByName } from './utils/payoutViewModel'
import PayoutsQuickActions from './components/PayoutsQuickActions'
import PayoutsSummaryCard from './components/PayoutsSummaryCard'
import PayoutsSearchPanel from './components/PayoutsSearchPanel'
import PayoutsResultsCard from './components/PayoutsResultsCard'
import TournamentFinalReview from './components/TournamentFinalReview'
import { parsePaidRecords, serializePaidRecords, togglePaidRecord, type PaidRecords } from './utils/paidRecords'

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
  const [paidRecords, setPaidRecords] = useState<PaidRecords | null>(null)
  const paidKeys = useMemo(() => new Set(paidRecords?.keys()), [paidRecords])
  const [, setScoreRows] = useState<ScoreRow[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [isUnlocked, setIsUnlocked] = useState(false)
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
  }, [isUnlocked, loadPayoutData, selectedSquad, selectedTournament])

  useEffect(() => {
    setPaidRecords(null)
    if (!selectedTournament) return
    try {
      const stored = storage.getItem(`payouts_paid_${selectedTournament.id}`)
      setPaidRecords(parsePaidRecords(stored))
    } catch (error) {
      logger.error('Failed to parse payout payment records from storage', { error })
      addToast({ type: 'error', message: 'Saved payment records could not be loaded. Paid status cannot be changed.', duration: 5000 })
    }
  }, [addToast, selectedTournament])

  const togglePaid = useCallback((key: string) => {
    if (!selectedTournament) return
    if (!paidRecords) {
      addToast({ type: 'error', message: 'Payment records are unavailable. Reload the page before marking payouts paid.', duration: 5000 })
      return
    }
    const next = togglePaidRecord(paidRecords, key, new Date())
    try {
      localStorage.setItem(`payouts_paid_${selectedTournament.id}`, serializePaidRecords(next))
      setPaidRecords(next)
    } catch (error) {
      logger.error('Failed to save payout payment records', { error })
      addToast({ type: 'error', message: 'Payment status could not be saved. Please try again.', duration: 5000 })
    }
  }, [addToast, paidRecords, selectedTournament])
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
    paidRecords,
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
  const clearSearch = () => {
    setSearchFirstName('')
    setSearchLastName('')
  }

  if (!isAuthInitialized) {
    return <Page><p className={styles.status} role="status">Loading payouts...</p></Page>
  }

  if (!isUserAuthenticated && !hasActiveSession) {
    return (
      <Page>
        <Card>
          <EmptyState title="Log in to see payouts" description="Sign in to view payout information." />
        </Card>
      </Page>
    )
  }

  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
    return (
      <NoTournamentState
        title="Payout desk waiting"
        description="Load a tournament to review prize pools, verify winners, and track payout completion."
      />
    )
  }

  if (!isUnlocked) {
    return (
      <NoTournamentState
        title="Payouts not calculated yet"
        description="Go to Scores and run Calculate payouts after score review. This locks in final results before distribution."
        actionHref="/scores"
        actionLabel="Open scores"
      />
    )
  }

  if (!loading && !selectedTournament) {
    return (
      <NoTournamentState
        description="Load a tournament from the dashboard to review prize pools, winners, payment status, and payout exports."
      />
    )
  }

  const squadLabel = selectedSquad ? `${formatSquadDate(selectedSquad.date)} · ${selectedSquad.time || 'Time pending'} squad` : null

  return (
    <ErrorBoundary>
      <Page>
        <PageHeader
          title="Payouts"
          description={[selectedTournament?.name, squadLabel].filter(Boolean).join(' · ') || undefined}
        />

        {payoutData ? (
          <PayoutsSummaryCard
            programSummaries={programSummaries}
            sidePotSummaries={sidePotAccounting.summaries}
            displayedTotalPrizePool={displayedTotalPrizePool}
            paidCount={paidCount}
            totalUniqueWinners={totalUniqueWinners}
            remainingAmount={remainingAmount}
          />
        ) : null}

        <PayoutsQuickActions
          hasRows={filteredWinners.length > 0}
          isLoading={loading}
          isExportingExcel={isExportingExcel}
          isExportingPdf={isExportingPdf}
          onOpenGuide={() => setIsPayoutsGuideOpen(true)}
          onExportToExcel={() => {
            void exportToExcel()
          }}
          onExportToPdf={exportToPdf}
        />

        {selectedTournament ? (
          <TournamentFinalReview tournamentId={selectedTournament.id} tournamentName={selectedTournament.name} squadId={selectedSquad?.id ?? null} />
        ) : null}

        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

        {payoutData && aggregatedWinners.length > 0 ? (
          <PayoutsSearchPanel
            searchFirstName={searchFirstName}
            searchLastName={searchLastName}
            onSearchFirstNameChange={setSearchFirstName}
            onSearchLastNameChange={setSearchLastName}
            onClear={clearSearch}
          />
        ) : null}

        {loading ? (
          <Card aria-label="Payout results">
            <p className={styles.status} role="status">Calculating payouts...</p>
          </Card>
        ) : aggregatedWinners.length === 0 ? (
          <Card aria-label="Payout results">
            <EmptyState
              icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No payouts calculated yet"
              description="Complete brackets first, then return here to review and mark payouts."
              action={(
                <>
                  <Link href="/brackets" className={buttonClassName({ variant: 'primary' })}>Go to brackets</Link>
                  <Link href="/dashboard" className={buttonClassName({ variant: 'secondary' })}>Back to dashboard</Link>
                </>
              )}
            />
          </Card>
        ) : (
          <PayoutsResultsCard
            displayedTotalPrizePool={displayedTotalPrizePool}
            winners={filteredWinners}
            paidKeys={paidKeys}
            expandedKeys={expandedKeys}
            sidePotByPlayer={sidePotByPlayer}
            onToggleExpanded={toggleExpanded}
            onTogglePaid={togglePaid}
            onClearSearch={clearSearch}
          />
        )}
      </Page>

      <ExplainPayoutsModal
        isOpen={isPayoutsGuideOpen}
        onClose={() => setIsPayoutsGuideOpen(false)}
      />
    </ErrorBoundary>
  )
}
