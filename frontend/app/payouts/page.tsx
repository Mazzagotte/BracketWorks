'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { Tournament, Squad } from '../lib/types'
import { usePayouts } from './hooks/usePayouts'
import { storage } from '../lib/storage'
import styles from './payouts.module.css'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value))

function placeBadgeClass(place: number) {
  if (place === 1) return `${styles.placeBadge} ${styles.place1}`
  if (place === 2) return `${styles.placeBadge} ${styles.place2}`
  if (place === 3) return `${styles.placeBadge} ${styles.place3}`
  return `${styles.placeBadge} ${styles.placeOther}`
}

export default function PayoutsPage() {
  const { isAuthenticated, isInitialized } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const { squads, fetchSquads } = useSquads()

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [paidKeys, setPaidKeys] = useState<Set<string>>(new Set())
  const [showNonWinners, setShowNonWinners] = useState(false)

  const { payoutData, entryData, loading, error, loadPayoutData, loadEntryData } =
    usePayouts(selectedTournament?.id ?? null, selectedSquad?.id ?? null)

  useEffect(() => {
    fetchTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedId = storage.getItem('lastTournamentId')
      const found = storedId ? tournaments.find(t => t.id === parseInt(storedId)) : null
      if (found) {
        setSelectedTournament(found)
        fetchSquads(found.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments, selectedTournament])

  useEffect(() => {
    if (squads.length > 0 && !selectedSquad) {
      const storedId = storage.getItem('selected_squad_id')
      const found = storedId ? squads.find(s => s.id === parseInt(storedId)) : null
      setSelectedSquad(found ?? squads[0])
    }
  }, [squads, selectedSquad])

  useEffect(() => {
    if (selectedTournament) {
      loadPayoutData()
      loadEntryData()
      // Load paid status from localStorage for this tournament
      const stored = storage.getItem(`payouts_paid_${selectedTournament.id}`)
      setPaidKeys(new Set(stored ? JSON.parse(stored) : []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournament, selectedSquad])

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

  const handleRefresh = useCallback(() => {
    if (!selectedTournament) return
    loadPayoutData()
    loadEntryData()
  }, [selectedTournament, loadPayoutData, loadEntryData])

  const headerActions = useMemo(() => (
    <div className={styles.actions}>
      <button onClick={handleRefresh} className={styles.refreshBtn} disabled={loading || !selectedTournament}>
        {loading ? <span className={styles.spinner} /> : '↻'} Refresh
      </button>
    </div>
  ), [handleRefresh, loading, selectedTournament])

  usePageHeader({
    title: 'Payout Distribution',
    subtitle: selectedTournament
      ? `${selectedTournament.name}${selectedSquad ? ` · Squad ${selectedSquad.id}` : ''}`
      : 'Load a tournament from the dashboard',
    actions: headerActions,
  })

  const hasStoredAuth = typeof window !== 'undefined' && storage.getItem('token') && storage.getItem('user_id')

  if (!isInitialized) {
    return (
      <div className={styles.loadingRow}>
        <div className={styles.loadingSpinner} />
        <span>Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated && !hasStoredAuth) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyTitle}>Please log in</div>
        <div className={styles.emptyMessage}>Sign in to view payout information.</div>
      </div>
    )
  }

  // Aggregate winners by player — sum totals across multiple brackets
  const flatWinners = payoutData?.winners_by_bracket ?? []
  const aggregatedWinners = Object.values(
    flatWinners.reduce<Record<string, { player_id: number; player_name: string; total_won: number; brackets: string[] }>>((acc, w) => {
      const key = String(w.player_id ?? w.player_name)
      if (!acc[key]) acc[key] = { player_id: w.player_id, player_name: w.player_name, total_won: 0, brackets: [] }
      acc[key].total_won += w.payout_amount
      acc[key].brackets.push(`${w.bracket_name} (${w.position})`)
      return acc
    }, {})
  ).sort((a, b) => b.total_won - a.total_won)

  // Append non-winners at the bottom
  const winnerIds = new Set(aggregatedWinners.map(w => String(w.player_id ?? w.player_name)))
  const nonWinners = (entryData?.entries ?? [])
    .filter(e => !winnerIds.has(String(e.id)))
    .map(e => ({ player_id: e.id, player_name: e.name, total_won: 0, brackets: [] as string[] }))

  const filteredWinners = aggregatedWinners.filter(w =>
    !searchQuery || w.player_name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredNonWinners = nonWinners.filter(w =>
    !searchQuery || w.player_name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const visibleRows = searchQuery
    ? [...filteredWinners, ...filteredNonWinners]
    : showNonWinners
      ? [...filteredWinners, ...filteredNonWinners]
      : filteredWinners

  return (
    <ErrorBoundary>
      <div>
        {/* Stats row */}
        {payoutData && (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>Total Prize Pool</div>
              <div className={`${styles.statCardValue} ${styles.green}`}>{formatCurrency(payoutData.total_prize_pool)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>Scratch Pool</div>
              <div className={styles.statCardValue}>{formatCurrency(payoutData.total_scratch_pool)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>Handicap Pool</div>
              <div className={styles.statCardValue}>{formatCurrency(payoutData.total_handicap_pool)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>Paid Out</div>
              <div className={styles.statCardValue}>{paidKeys.size} / {aggregatedWinners.length}</div>
            </div>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Search */}
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search by player name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            style={{ paddingLeft: '16px' }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className={styles.loadingRow}>
            <div className={styles.loadingSpinner} />
            <span>Calculating payouts...</span>
          </div>
        ) : !selectedTournament ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No Tournament Loaded</div>
            <div className={styles.emptyMessage}>Load a tournament from the dashboard to view payout information.</div>
          </div>
        ) : filteredWinners.length === 0 && !searchQuery ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No Payouts Yet</div>
            <div className={styles.emptyMessage}>Winners will appear here once bracket matches are completed.</div>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No results</div>
            <div className={styles.emptyMessage}>No players match your search.</div>
          </div>
        ) : (
          <>
            <div className={styles.bracketGroup}>
              {visibleRows.map((row, index) => {
                const key = String(row.player_id ?? row.player_name)
                const isPaid = paidKeys.has(key)
                const isWinner = row.total_won > 0
                return (
                  <div
                    key={key}
                    className={`${styles.winnerRow} ${index === 0 && isWinner ? styles.firstPlace : ''} ${isPaid ? styles.isPaid : ''}`}
                  >
                    <div className={isWinner ? placeBadgeClass(index + 1) : `${styles.placeBadge} ${styles.placeOther}`}>
                      {isWinner ? index + 1 : '—'}
                    </div>
                    <div className={styles.winnerInfo}>
                      <div className={styles.winnerName}>{row.player_name}</div>
                      {row.brackets.length > 0 && (
                        <div className={styles.winnerMeta}>{row.brackets.join(' · ')}</div>
                      )}
                    </div>
                    <div className={styles.payoutCol}>
                      {isWinner && (
                        <div className={styles.payoutAmount}>{formatCurrency(row.total_won)}</div>
                      )}
                    </div>
                    {isWinner && (
                      isPaid ? (
                        <button className={styles.paidBadge} onClick={() => togglePaid(key)}>
                          ✓ Paid
                        </button>
                      ) : (
                        <button className={styles.markPaidBtn} onClick={() => togglePaid(key)}>
                          Mark Paid
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
            {!searchQuery && filteredNonWinners.length > 0 && (
              <button className={styles.showEntriesBtn} onClick={() => setShowNonWinners(v => !v)}>
                {showNonWinners
                  ? 'Hide non-winners'
                  : `Show all entries (${filteredNonWinners.length} more)`}
              </button>
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}
