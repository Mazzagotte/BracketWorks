'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { Tournament, Squad } from '../lib/types'
import { usePayouts } from './hooks/usePayouts'
import NoTournamentState from '../components/NoTournamentState'
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

  const headerActions = useMemo(() => undefined, [])

  usePageHeader({
    title: 'Payout Distribution',
    subtitle: undefined,
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

  if (typeof window !== 'undefined' && !localStorage.getItem('lastTournamentId')) {
    return (
      <NoTournamentState
        description="Load a tournament from the dashboard to view payout distribution. Once loaded, you'll be able to see prize pools, track winners, and mark payouts as complete."
        cards={[
          { title: 'Prize Pool', text: 'View total scratch and handicap prize pools calculated from paid bracket entries' },
          { title: 'Winner Tracking', text: 'See which players won, what position they finished, and how much they earned' },
          { title: 'Mark as Paid', text: 'Track which winners have been paid out to stay organized during payout distribution' },
        ]}
      />
    )
  }

  // Aggregate winners across brackets to compute paid stats
  const handicapBrackets = payoutData?.handicap_brackets ?? []
  const scratchBrackets = payoutData?.scratch_brackets ?? []

  // Condense all winners into one row per player, summing totals
  const aggregatedWinners = useMemo(() => {
    const allWinners = [...handicapBrackets, ...scratchBrackets].flatMap(b => b.winners)
    const byPlayer: Record<string, {
      player_id: number
      player_name: string
      total_won: number
      winnings: { bracket_name: string; position: string; payout_amount: number; payout_percentage: number; split_pot?: boolean }[]
    }> = {}
    for (const w of allWinners) {
      const key = String(w.player_id ?? w.player_name)
      if (!byPlayer[key]) byPlayer[key] = { player_id: w.player_id, player_name: w.player_name, total_won: 0, winnings: [] }
      byPlayer[key].total_won += w.payout_amount
      byPlayer[key].winnings.push({ bracket_name: w.bracket_name, position: w.position, payout_amount: w.payout_amount, payout_percentage: w.payout_percentage, split_pot: w.split_pot })
    }
    return Object.values(byPlayer).sort((a, b) => b.total_won - a.total_won)
  }, [handicapBrackets, scratchBrackets])

  const { totalUniqueWinners, paidCount, remainingAmount } = useMemo(() => {
    const totalUniqueWinners = aggregatedWinners.length
    const paidCount = aggregatedWinners.filter(w => paidKeys.has(String(w.player_id ?? w.player_name))).length
    const remainingAmount = aggregatedWinners
      .filter(w => !paidKeys.has(String(w.player_id ?? w.player_name)))
      .reduce((sum, w) => sum + w.total_won, 0)
    return { totalUniqueWinners, paidCount, remainingAmount }
  }, [aggregatedWinners, paidKeys])

  const filteredWinners = useMemo(() =>
    aggregatedWinners.filter(w =>
      !searchQuery || w.player_name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [aggregatedWinners, searchQuery]
  )

  const matchesSearch = (name: string) =>
    !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase())

  return (
    <ErrorBoundary>
      <div className={styles.pageContainer}>
        {/* Summary card */}
        {payoutData && (
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>Payout Summary</h3>
            <div className={styles.summaryGrid}>
              <div className={styles.statBox}>
                <div className={`${styles.statValue} ${styles.statValueGreen}`}>{formatCurrency(payoutData.total_prize_pool)}</div>
                <div className={styles.statLabel}>Total Prize Pool</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statValue}>{formatCurrency(payoutData.total_handicap_pool)}</div>
                <div className={styles.statLabel}>Handicap Pool</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statValue}>{formatCurrency(payoutData.total_scratch_pool)}</div>
                <div className={styles.statLabel}>Scratch Pool</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statValue}>{paidCount} / {totalUniqueWinners}</div>
                <div className={styles.statLabel}>Paid Out</div>
                {totalUniqueWinners > 0 && (
                  <div className={styles.progressBarRow}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressBarFill}
                        style={{ width: `${(paidCount / totalUniqueWinners) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {remainingAmount > 0 && (
                  <div className={styles.remainingLabel}>{formatCurrency(remainingAmount)} remaining</div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Search */}
        {payoutData && aggregatedWinners.length > 0 && (
          <div className={styles.searchStandalone}>
            <input
              type="text"
              placeholder="Search by player name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        )}

        {/* Loading / empty states */}
        {loading && (
          <div className={styles.loadingRow}>
            <div className={styles.loadingSpinner} />
            <span>Calculating payouts...</span>
          </div>
        )}
        {!loading && !selectedTournament && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No Tournament Loaded</div>
            <div className={styles.emptyMessage}>Load a tournament from the dashboard to view payout information.</div>
          </div>
        )}
        {!loading && selectedTournament && aggregatedWinners.length === 0 && !loading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No Payouts Yet</div>
            <div className={styles.emptyMessage}>Winners will appear here once bracket matches are completed.</div>
          </div>
        )}

        {/* Single condensed winners card */}
        {!loading && aggregatedWinners.length > 0 && (
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span>Winners</span>
              <span className={styles.headerPool}>{formatCurrency(payoutData!.total_prize_pool)} total</span>
            </div>
            <div className={styles.bracketGroup}>
              {(filteredWinners.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyTitle}>No results</div>
                  <div className={styles.emptyMessage}>No players match your search.</div>
                </div>
              ) : filteredWinners.map((row, index) => {
                const key = String(row.player_id ?? row.player_name)
                const isPaid = paidKeys.has(key)
                return (
                  <div
                    key={key}
                    className={`${styles.winnerRow} ${index === 0 ? styles.firstPlace : ''} ${isPaid ? styles.isPaid : ''}`}
                  >
                    <div className={placeBadgeClass(index + 1)}>{index + 1}</div>
                    <div className={styles.winnerInfo}>
                      <div className={styles.winnerName}>
                        {row.player_name}
                        {row.winnings.some(w => w.split_pot) && <span className={styles.splitBadge}>Split</span>}
                      </div>
                      <div className={styles.winnerMeta}>
                        {row.winnings.map(w => `${w.bracket_name} – ${w.position} (${formatCurrency(w.payout_amount)})`).join(' · ')}
                      </div>
                    </div>
                    <div className={styles.payoutCol}>
                      <div className={styles.payoutAmount}>{formatCurrency(row.total_won)}</div>
                      {row.winnings.length > 1 && (
                        <div className={styles.payoutPct}>{row.winnings.length} brackets</div>
                      )}
                    </div>
                    {isPaid ? (
                      <button className={styles.paidBadge} onClick={() => togglePaid(key)}>✓ Paid</button>
                    ) : (
                      <button className={styles.markPaidBtn} onClick={() => togglePaid(key)}>Mark Paid</button>
                    )}
                  </div>
                )
              }))}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
