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
import { useToast } from '../components/Toast'
import Link from 'next/link'
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
  const { addToast } = useToast()
  const { isAuthenticated, isInitialized } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const { squads, fetchSquads } = useSquads()

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [paidKeys, setPaidKeys] = useState<Set<string>>(new Set())
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

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

  // Aggregate winners across brackets to compute paid stats
  const aggregatedWinners = useMemo(() => {
    const allWinners = payoutData?.winners_by_bracket ?? []
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
  }, [payoutData])

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

  const buildExportRows = useCallback(() => {
    return filteredWinners.map((row, index) => ({
      Rank: index + 1,
      Player: row.player_name,
      'Total Won': Number(row.total_won),
      'Payout Details': row.winnings
        .map(w => `${w.bracket_name} - ${w.position} (${formatCurrency(w.payout_amount)})`)
        .join(' | '),
      Paid: paidKeys.has(String(row.player_id ?? row.player_name)) ? 'Yes' : 'No',
    }))
  }, [filteredWinners, paidKeys])

  const buildExportFileName = useCallback((suffix: 'xlsx' | 'pdf') => {
    const safeTournament = (selectedTournament?.name || 'payouts')
      .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'payouts'
    const safeSquad = selectedSquad
      ? `${selectedSquad.date || ''}_${selectedSquad.time || ''}`
        .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
      : 'all_squads'
    const dateStamp = new Date().toISOString().slice(0, 10)
    return `${safeTournament}_${safeSquad}_payouts_${dateStamp}.${suffix}`
  }, [selectedTournament, selectedSquad])

  const handleExportToExcel = useCallback(async () => {
    const rows = buildExportRows()
    if (rows.length === 0) {
      addToast({ type: 'warning', message: 'No payout rows to export.', duration: 3000 })
      return
    }

    setIsExportingExcel(true)
    try {
      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payouts')
      XLSX.writeFile(workbook, buildExportFileName('xlsx'))
      addToast({
        type: 'success',
        message: `Exported ${rows.length} payout row${rows.length !== 1 ? 's' : ''} to Excel.`,
        duration: 3000,
      })
    } catch (err) {
      addToast({
        type: 'error',
        message: `Failed to export Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`,
        duration: 5000,
      })
    } finally {
      setIsExportingExcel(false)
    }
  }, [addToast, buildExportFileName, buildExportRows])

  const handleExportToPdf = useCallback(() => {
    const rows = filteredWinners.map((winner, index) => ({
      rank: index + 1,
      playerName: winner.player_name,
      totalWon: winner.total_won,
    }))
    if (rows.length === 0) {
      addToast({ type: 'warning', message: 'No payout rows to export.', duration: 3000 })
      return
    }

    setIsExportingPdf(true)
    try {
      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;')

      const tableRows = rows.map(row => `
        <tr>
          <td>${row.rank}</td>
          <td>${escapeHtml(String(row.playerName))}</td>
          <td>${escapeHtml(formatCurrency(Number(row.totalWon)))}</td>
          <td><div class="rowSignatureLine"></div></td>
        </tr>`).join('')

      const tournamentName = selectedTournament?.name || 'Unknown Tournament'
      const squadLabel = selectedSquad
        ? `${selectedSquad.date || ''} ${selectedSquad.time || ''}`.trim()
        : 'All Squads'
      const generatedAt = new Date().toLocaleString()
      const logoUrl = `${window.location.origin}/logo.svg`

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        addToast({ type: 'error', message: 'Popup blocked. Allow popups to export PDF.', duration: 5000 })
        return
      }

      printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payout Export</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
      .reportHeader { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
      .reportBrand { display: flex; align-items: center; gap: 12px; }
      .logo { width: 120px; height: auto; object-fit: contain; }
      h1 { margin: 0; font-size: 22px; }
      .meta { margin: 0 0 16px; color: #555; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f2f2f2; font-weight: 700; }
      tr:nth-child(even) { background: #fafafa; }
      .signatureColumn { width: 220px; }
      .rowSignatureLine { width: 100%; min-height: 18px; border-bottom: 1px solid #1a1a1a; }
    </style>
  </head>
  <body>
    <div class="reportHeader">
      <div class="reportBrand">
        <img src="${escapeHtml(logoUrl)}" alt="BracketWorks Logo" class="logo" />
      </div>
      <h1>Payout Distribution Export</h1>
    </div>
    <div class="meta">Tournament: ${escapeHtml(tournamentName)} | Squad: ${escapeHtml(squadLabel)} | Generated: ${escapeHtml(generatedAt)}</div>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player Name</th>
          <th>Total Won</th>
          <th class="signatureColumn">Player Signature</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.print();
        }, 200);
      });
    </script>
  </body>
</html>`)
      printWindow.document.close()
      printWindow.focus()
      addToast({
        type: 'success',
        message: `Prepared ${rows.length} payout row${rows.length !== 1 ? 's' : ''} for PDF export.`,
        duration: 3000,
      })
    } catch (err) {
      addToast({
        type: 'error',
        message: `Failed to export PDF: ${err instanceof Error ? err.message : 'Unknown error'}`,
        duration: 5000,
      })
    } finally {
      setIsExportingPdf(false)
    }
  }, [addToast, filteredWinners, selectedTournament, selectedSquad])

  const headerActions = useMemo(() => (
    <>
      <button
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={handleExportToExcel}
        disabled={loading || isExportingExcel || filteredWinners.length === 0}
      >
        {isExportingExcel ? 'Exporting Excel...' : 'Export to Excel'}
      </button>
      <button
        className="ds-btn ds-btn-secondary ds-btn-sm"
        onClick={handleExportToPdf}
        disabled={loading || isExportingPdf || filteredWinners.length === 0}
      >
        {isExportingPdf ? 'Exporting PDF...' : 'Export to PDF'}
      </button>
    </>
  ), [filteredWinners.length, handleExportToExcel, handleExportToPdf, isExportingExcel, isExportingPdf, loading])

  usePageHeader({
    title: 'Payout Distribution',
    subtitle: undefined,
    actions: headerActions,
  })

  const programSummaries = useMemo(
    () => (payoutData?.program_summaries ?? []).filter(program => program.total_brackets > 0),
    [payoutData]
  )

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
        description="Load a tournament from the dashboard to view payout distribution. Once loaded, you&apos;ll be able to see prize pools, track winners, and mark payouts as complete."
        cards={[
          { title: 'Prize Pool', text: 'View total scratch and handicap prize pools calculated from paid bracket entries' },
          { title: 'Winner Tracking', text: 'See which players won, what position they finished, and how much they earned' },
          { title: 'Mark as Paid', text: 'Track which winners have been paid out to stay organized during payout distribution' },
        ]}
      />
    )
  }

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
              {programSummaries.map(program => (
                <div key={program.key} className={styles.statBox}>
                  <div className={styles.statValue}>{formatCurrency(program.total_prize_pool)}</div>
                  <div className={styles.statLabel}>{program.name} Pool</div>
                  <div className={styles.statDetail}>{program.total_brackets} bracket{program.total_brackets !== 1 ? 's' : ''}</div>
                </div>
              ))}
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
          <div className={styles.emptyPayoutState}>
            <div className={styles.emptyPayoutAccentGlow} aria-hidden="true" />

            <div className={styles.emptyPayoutBadge}>Tournament Ready</div>

            <div className={styles.emptyPayoutHeroRow}>
              <div className={styles.emptyPayoutIconContainer}>
                <div className={styles.emptyPayoutIcon}>
                  <svg viewBox="0 0 100 100" className={styles.emptyPayoutIconSvg} aria-hidden="true">
                    <path d="M36 24h28v10a14 14 0 0 1-8 12v8h8v8H36v-8h8v-8a14 14 0 0 1-8-12V24z" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path d="M30 28H18a10 10 0 0 0 10 10h8" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path d="M70 28h12a10 10 0 0 1-10 10h-8" fill="none" stroke="currentColor" strokeWidth="4" />
                  </svg>
                </div>
              </div>

              <div>
                <h2 className={styles.emptyPayoutTitle}>No payouts calculated yet</h2>
                <p className={styles.emptyPayoutText}>
                  This tournament and squad are loaded, but no finalized winners are available for payout distribution yet. Complete brackets first, then return here to review and mark payouts.
                </p>
              </div>
            </div>

            <div className={styles.emptyPayoutActions}>
              <Link href="/brackets" className={`${styles.emptyPayoutPrimaryAction} ds-btn ds-btn-primary ds-btn-md`}>
                Go To Brackets
              </Link>
              <Link href="/dashboard" className={`${styles.emptyPayoutSecondaryAction} ds-btn ds-btn-secondary ds-btn-md`}>
                Back To Dashboard
              </Link>
            </div>

            <div className={styles.emptyPayoutFeaturesGrid}>
              <div className={styles.emptyPayoutFeatureCard}>
                <h3>Finish Matches</h3>
                <p>Update winners in Brackets so payout calculations can determine prize distribution.</p>
              </div>
              <div className={styles.emptyPayoutFeatureCard}>
                <h3>Review Winners</h3>
                <p>Verify player placements, split pots, and payout amounts before issuing payments.</p>
              </div>
              <div className={styles.emptyPayoutFeatureCard}>
                <h3>Track Paid Status</h3>
                <p>Mark payouts complete as you pay winners to keep the payout process organized.</p>
              </div>
            </div>
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
                        <button
                          className={styles.toggleDetailsBtn}
                          onClick={() => toggleExpanded(key)}
                          aria-label={expandedKeys.has(key) ? 'Hide brackets' : 'Show brackets'}
                        >
                          {expandedKeys.has(key) ? '▲' : '▼'} {row.winnings.length} bracket{row.winnings.length !== 1 ? 's' : ''}
                        </button>
                      </div>
                      {expandedKeys.has(key) && (
                        <div className={styles.winnerMeta}>
                          {row.winnings.map(w => `${w.bracket_name} – ${w.position} (${formatCurrency(w.payout_amount)})`).join(' · ')}
                        </div>
                      )}
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
