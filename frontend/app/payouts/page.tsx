'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { SidePotsSettings, Tournament, Squad } from '../lib/types'
import { usePayouts } from './hooks/usePayouts'
import { usePayoutSetup, ScoreRow } from './hooks/usePayoutSetup'
import NoTournamentState from '../components/NoTournamentState'
import { storage } from '../lib/storage'
import Link from 'next/link'
import styles from './payouts.module.css'
import cardStyles from '../styles/cards.module.css'
import buttonStyles from '../styles/buttons.module.css'
import badgeStyles from '../styles/badges.module.css'
import formStyles from '../styles/forms.module.css'
import shellStyles from '../styles/page-shell.module.css'
import ExplainPayoutsModal from './ExplainPayoutsModal'
import { useToast } from '../components/Toast'
import { QuickActions, SearchPanel } from '../components/primitives'
import primitiveStyles from '../components/primitives/primitives.module.css'
import { formatCurrency, formatShortMonthDayYear } from '../lib/formatters'
import { logger } from '../lib/logger'
import { getSelectedTournamentId } from '../lib/selection-session'
import { getPayoutUnlockKey } from '../lib/storageKeys'
import { buildPayoutExcelBuffer } from './utils/payoutExcelExport'
import { AggregatedWinner, buildPayoutExportRows, buildSidePotByPlayer } from './utils/payoutExportRows'
import { buildPayoutPdfHtml } from './utils/payoutPdfExport'

function placeBadgeClass(place: number) {
  if (place === 1) return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.placeFirst} ${styles.placementBadge}`
  if (place === 2) return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.placeSecond} ${styles.placementBadge}`
  if (place === 3) return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.placeThird} ${styles.placementBadge}`
  return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.muted} ${styles.placementBadge}`
}

export default function PayoutsPage() {
  const { addToast } = useToast()
  const { isUserAuthenticated, isAuthInitialized } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const { squads, fetchSquads } = useSquads()

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')
  const [paidKeys, setPaidKeys] = useState<Set<string>>(new Set())
  const [sidePotPaidKeys, setSidePotPaidKeys] = useState<Set<string>>(new Set())
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const [isPayoutsGuideOpen, setIsPayoutsGuideOpen] = useState(false)
  const [desktopTableCardWidth, setDesktopTableCardWidth] = useState<number | null>(null)
  const tableCardRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth <= 900)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
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

  const { payoutData, entryData, loading, error, loadPayoutData, loadEntryData } =
    usePayouts(selectedTournament?.id ?? null, selectedSquad?.id ?? null)

  usePayoutSetup({
    isAuthInitialized,
    isUserAuthenticated,
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
    loadEntryData()
    try {
      const stored = storage.getItem(`payouts_paid_${selectedTournament.id}`)
      setPaidKeys(new Set(stored ? JSON.parse(stored) : []))

      const storedSidePotPaid = storage.getItem(`payouts_sidepot_paid_${selectedTournament.id}`)
      setSidePotPaidKeys(new Set(storedSidePotPaid ? JSON.parse(storedSidePotPaid) : []))
    } catch {
      logger.error('Failed to parse paid keys from storage')
      setPaidKeys(new Set())
      setSidePotPaidKeys(new Set())
    }
  }, [isUnlocked, loadEntryData, loadPayoutData, selectedSquad, selectedTournament])

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

  const toggleSidePotPaid = useCallback((potKey: string) => {
    if (!selectedTournament) return
    setSidePotPaidKeys(prev => {
      const next = new Set(prev)
      if (next.has(potKey)) next.delete(potKey)
      else next.add(potKey)
      storage.setItem(`payouts_sidepot_paid_${selectedTournament.id}`, JSON.stringify([...next]))
      return next
    })
  }, [selectedTournament])

  const handleRefresh = useCallback(() => {
    if (!selectedTournament) return
    loadPayoutData()
    loadEntryData()
  }, [selectedTournament, loadPayoutData, loadEntryData])

  // Aggregate winners across brackets to compute paid stats
  const aggregatedWinners = useMemo<AggregatedWinner[]>(() => {
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

  const filteredWinners = useMemo(() => {
    const firstNameTerm = searchFirstName.trim().toLowerCase()
    const lastNameTerm = searchLastName.trim().toLowerCase()
    const hasSearch = Boolean(firstNameTerm || lastNameTerm)
    if (!hasSearch) return aggregatedWinners

    return aggregatedWinners.filter(w => {
      const normalized = w.player_name.toLowerCase()
      const firstMatches = !firstNameTerm || normalized.includes(firstNameTerm)
      const lastMatches = !lastNameTerm || normalized.includes(lastNameTerm)
      return firstMatches && lastMatches
    })
  }, [aggregatedWinners, searchFirstName, searchLastName])

  const sidePotAccounting = useMemo(() => {
    const toNum = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

    const getPotMetric = (potKey: string, score?: ScoreRow): number | null => {
      if (!score) return null

      const scratchGames = [toNum(score.game1_scratch), toNum(score.game2_scratch), toNum(score.game3_scratch)].filter((n): n is number => n !== null)
      const handicapGames = [
        toNum(score.game1_with_handicap),
        toNum(score.game2_with_handicap),
        toNum(score.game3_with_handicap),
      ].filter((n): n is number => n !== null)

      switch (potKey) {
        case 'high_game_scratch':
          return scratchGames.length > 0 ? Math.max(...scratchGames) : null
        case 'high_series_scratch':
          return scratchGames.length > 0 ? scratchGames.reduce((sum, n) => sum + n, 0) : null
        case 'high_game_handicap':
          return handicapGames.length > 0 ? Math.max(...handicapGames) : null
        case 'high_series_handicap':
          return handicapGames.length > 0 ? handicapGames.reduce((sum, n) => sum + n, 0) : null
        default:
          return null
      }
    }

    const empty = {
      totalPool: 0,
      summaries: [] as Array<{
        key: string
        name: string
        entryCount: number
        pool: number
        winnerId: string | null
        winnerName: string | null
        winnerMetric: number | null
      }>,
    }
    if (!selectedTournament) return empty

    try {
      const rawSettings = storage.getItem(`sidePots_${selectedTournament.id}`)
      const rawEntries = storage.getItem(`sidePotEntries_${selectedTournament.id}`)
      if (!rawSettings || !rawEntries) return empty

      const settings = JSON.parse(rawSettings) as SidePotsSettings
      const sidePotEntriesMap = JSON.parse(rawEntries) as Record<string, Record<string, boolean>>
      const enabledPots = (settings.pots ?? []).filter(pot => pot.enabled)
      if (enabledPots.length === 0 || settings.entry_fee <= 0) return empty

      const activePlayerIds = new Set((entryData?.entries ?? []).map(entry => Number(entry.id)))
      const playerNameById = new Map((entryData?.entries ?? []).map(entry => [String(entry.id), entry.name]))
      const scoreByPlayerId = new Map(scoreRows.map(score => [String(score.player_id), score]))

      const summaries = enabledPots.map(pot => {
        const entrantsWithMetric = Object.entries(sidePotEntriesMap)
          .filter(([playerIdRaw, entries]) => {
            const playerId = Number(playerIdRaw)
            const inActiveSet = activePlayerIds.size === 0 || activePlayerIds.has(playerId)
            return inActiveSet && Boolean(entries?.[pot.key])
          })
          .map(([playerIdRaw]) => {
            const id = String(playerIdRaw)
            const metric = getPotMetric(pot.key, scoreByPlayerId.get(id))
            return {
              id,
              name: playerNameById.get(id) ?? `Player #${playerIdRaw}`,
              metric,
            }
          })

        const winner = entrantsWithMetric
          .filter(item => item.metric !== null)
          .sort((a, b) => {
            if ((b.metric ?? 0) !== (a.metric ?? 0)) return (b.metric ?? 0) - (a.metric ?? 0)
            return a.name.localeCompare(b.name)
          })[0]

        const entryCount = Object.entries(sidePotEntriesMap).reduce((count, [playerIdRaw, entries]) => {
          const playerId = Number(playerIdRaw)
          const inActiveSet = activePlayerIds.size === 0 || activePlayerIds.has(playerId)
          return (inActiveSet && entries?.[pot.key]) ? count + 1 : count
        }, 0)
        return {
          key: pot.key,
          name: pot.name,
          entryCount,
          pool: entryCount * (settings.prize_amount ?? settings.entry_fee),
          winnerId: winner?.id ?? null,
          winnerName: winner?.name ?? null,
          winnerMetric: winner?.metric ?? null,
        }
      })

      const totalPool = summaries.reduce((sum, item) => sum + item.pool, 0)
      return { totalPool, summaries }
    } catch {
      return empty
    }
  }, [selectedTournament, entryData, scoreRows])

  const sidePotByPlayer = useMemo(() => {
    return buildSidePotByPlayer(sidePotAccounting.summaries)
  }, [sidePotAccounting.summaries])

  const buildExportFileName = useCallback((suffix: 'xlsx' | 'pdf') => {
    const safeTournament = (selectedTournament?.name || 'Tournament')
      .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'Tournament'
    const safeDate = selectedSquad?.date
      ? selectedSquad.date.replace(/[^a-zA-Z0-9\-]/g, '')
      : new Date().toISOString().slice(0, 10)
    return `Payout_Distribution_${safeTournament}_${safeDate}.${suffix}`
  }, [selectedTournament, selectedSquad])

  const handleExportToExcel = useCallback(async () => {
    if (filteredWinners.length === 0) {
      addToast({ type: 'warning', message: 'No payout rows to export.', duration: 3000 })
      return
    }

    setIsExportingExcel(true)
    try {
      const rows = buildPayoutExportRows(filteredWinners, sidePotByPlayer, paidKeys)

      const allBrackets = [
        ...(payoutData?.scratch_brackets ?? []),
        ...(payoutData?.handicap_brackets ?? []),
      ]
      const totalEntries = allBrackets.reduce((s, b) => s + b.bracket_size, 0)
      const programs = [
        ...(payoutData?.program_summaries ?? []).filter(p => p.total_brackets > 0).map(p => p.name),
        ...sidePotAccounting.summaries.filter(s => s.pool > 0).map(s => s.name),
      ].join(' / ') || 'N/A'

      const tournamentName = selectedTournament?.name || 'Unknown Tournament'
      const squadLabel = selectedSquad
        ? `${selectedSquad.date || ''} — ${selectedSquad.time || ''}`.trim()
        : 'All Squads'
      const generatedAt = new Date().toLocaleString()
      const xlsxBuffer = await buildPayoutExcelBuffer({
        rows,
        programs,
        totalBrackets: allBrackets.length,
        totalEntries,
        tournamentName,
        squadLabel,
        generatedAt,
      })
      const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildExportFileName('xlsx')
      a.click()
      URL.revokeObjectURL(url)
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
  }, [addToast, buildExportFileName, filteredWinners, paidKeys, payoutData, selectedTournament, selectedSquad, sidePotAccounting, sidePotByPlayer])

  const handleExportToPdf = useCallback(() => {
    if (filteredWinners.length === 0) {
      addToast({ type: 'warning', message: 'No payout rows to export.', duration: 3000 })
      return
    }

    setIsExportingPdf(true)
    try {
      const rows = buildPayoutExportRows(filteredWinners, sidePotByPlayer, paidKeys)

      const tournamentName = selectedTournament?.name || 'Unknown Tournament'
      const squadLabel = selectedSquad
        ? `${selectedSquad.date || ''} \u2014 ${selectedSquad.time || ''}`.trim()
        : 'All Squads'
      const generatedAt = new Date().toLocaleString()
      const paidStampDate = formatShortMonthDayYear(new Date())
      const logoUrl = `${window.location.origin}/logo_no_text.svg`

      const allBrackets = [
        ...(payoutData?.scratch_brackets ?? []),
        ...(payoutData?.handicap_brackets ?? []),
      ]
      const totalEntries = allBrackets.reduce((s, b) => s + b.bracket_size, 0)
      const programs = [
        ...(payoutData?.program_summaries ?? [])
          .filter(p => p.total_brackets > 0)
          .map(p => p.name),
        ...sidePotAccounting.summaries
          .filter(s => s.pool > 0)
          .map(s => s.name),
      ].join(' / ') || 'N/A'

      const html = buildPayoutPdfHtml({
        rows,
        tournamentName,
        squadLabel,
        generatedAt,
        paidStampDate,
        logoUrl,
        programs,
        totalBrackets: allBrackets.length,
        totalEntries,
      })

      const iframe = document.createElement('iframe')
      iframe.setAttribute('hidden', 'true')
      iframe.setAttribute('aria-hidden', 'true')
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) {
        document.body.removeChild(iframe)
        addToast({ type: 'error', message: 'Failed to prepare print document.', duration: 5000 })
        return
      }

      iframeDoc.open()
      iframeDoc.write(html)
      iframeDoc.close()

      let cleanedUp = false
      const cleanupIframe = () => {
        if (cleanedUp) return
        cleanedUp = true
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
      }

      const printIframe = () => {
        iframe.contentWindow?.focus()
        const originalTitle = document.title
        document.title = buildExportFileName('pdf').replace('.pdf', '')
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.title = originalTitle
          cleanupIframe()
        }, 1000)
      }

      const stylesheet = iframeDoc.querySelector('link[rel="stylesheet"]')
      if (stylesheet) {
        stylesheet.addEventListener('load', printIframe, { once: true })
        stylesheet.addEventListener('error', printIframe, { once: true })
      } else {
        printIframe()
      }

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
  }, [addToast, buildExportFileName, filteredWinners, selectedTournament, selectedSquad, paidKeys, sidePotAccounting, payoutData, sidePotByPlayer])

  const payoutsQuickActions = useMemo(() => (
    <QuickActions
      left={(
        <button
          className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
          onClick={() => setIsPayoutsGuideOpen(true)}
        >
          Payouts Guide
        </button>
      )}
      right={(
        <>
          <button
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
            onClick={handleExportToExcel}
            disabled={loading || isExportingExcel || filteredWinners.length === 0}
          >
            {isExportingExcel ? 'Exporting...' : isMobileView ? 'Excel' : 'Export to Excel'}
          </button>
          <button
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
            onClick={handleExportToPdf}
            disabled={loading || isExportingPdf || filteredWinners.length === 0}
          >
            {isExportingPdf ? 'Exporting...' : isMobileView ? 'PDF' : 'Export to PDF'}
          </button>
        </>
      )}
    />
  ), [filteredWinners.length, handleExportToExcel, handleExportToPdf, isExportingExcel, isExportingPdf, isMobileView, loading])

  useEffect(() => {
    if (isMobileView) {
      setDesktopTableCardWidth(null)
      return undefined
    }

    const tableCard = tableCardRef.current
    if (!tableCard) {
      setDesktopTableCardWidth(null)
      return undefined
    }

    const publishWidth = () => {
      const nextWidth = tableCard.getBoundingClientRect().width
      setDesktopTableCardWidth(Number.isFinite(nextWidth) && nextWidth > 0 ? Math.ceil(nextWidth) : null)
    }

    publishWidth()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(publishWidth)
      observer.observe(tableCard)
    }

    window.addEventListener('resize', publishWidth)

    return () => {
      window.removeEventListener('resize', publishWidth)
      if (observer) observer.disconnect()
    }
  }, [isMobileView, filteredWinners.length, loading])

  const desktopTableDrivenCardStyle = useMemo<CSSProperties | undefined>(() => {
    if (isMobileView || !desktopTableCardWidth) return undefined
    return {
      width: '100%',
      maxWidth: `${desktopTableCardWidth}px`,
      marginInline: 'auto',
    }
  }, [desktopTableCardWidth, isMobileView])

  usePageHeader({
    title: 'Payout Distribution',
    subtitle: undefined,
    actions: undefined,
  })

  const programSummaries = useMemo(
    () => (payoutData?.program_summaries ?? []).filter(program => program.total_brackets > 0),
    [payoutData]
  )

  const displayedTotalPrizePool = (payoutData?.total_prize_pool ?? 0) + sidePotAccounting.totalPool

  const hasStoredAuth = typeof window !== 'undefined' && storage.getItem('token') && storage.getItem('user_id')

  if (!isAuthInitialized) {
    return (
      <div className={styles.loadingRow}>
        <div className={styles.loadingSpinner} />
        <span>Loading...</span>
      </div>
    )
  }

  if (!isUserAuthenticated && !hasStoredAuth) {
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
        <div className={`${cardStyles.card} ${cardStyles.accentCard} ${cardStyles.quickActionsCard}`} style={desktopTableDrivenCardStyle}>
          <h2 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle}`}>Quick Actions</h2>
          <div className={cardStyles.quickActionsBody}>
            {payoutsQuickActions}
          </div>
        </div>

        {/* Summary card */}
        {payoutData && (
          <div className={`${cardStyles.card} ${cardStyles.accentCard} surface-card ${styles.summaryCard}`}>
            <h3 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.cardTitle} surface-cardHeader ${styles.summaryTitle}`}>Payout Summary</h3>
            <div className={styles.summaryGrid}>
              <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                <div className={`${cardStyles.statValue} ${styles.statValue}`}>{formatCurrency(displayedTotalPrizePool)}</div>
                <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Final Prize Pool</div>
                {sidePotAccounting.totalPool > 0 && (
                  <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>Includes {formatCurrency(sidePotAccounting.totalPool)} in side pots</div>
                )}
              </div>
              {programSummaries.map(program => (
                <div key={program.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                  <div className={`${cardStyles.statValue} ${styles.statValue}`}>{formatCurrency(program.total_prize_pool)}</div>
                  <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{program.name} Pool</div>
                  <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>{program.total_brackets} bracket{program.total_brackets !== 1 ? 's' : ''}</div>
                </div>
              ))}
              {sidePotAccounting.summaries.map(pot => (
                <div key={pot.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                  <div className={`${cardStyles.statValue} ${styles.statValue}`}>{formatCurrency(pot.pool)}</div>
                  <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{pot.name} Pool</div>
                  <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>{pot.entryCount} side pot entr{pot.entryCount === 1 ? 'y' : 'ies'}</div>
                </div>
              ))}
              <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                <div className={`${cardStyles.statValue} ${styles.statValue}`}>{paidCount} / {totalUniqueWinners}</div>
                <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Marked Paid</div>
                {totalUniqueWinners > 0 && (
                  <div className={styles.progressBarRow}>
                    <progress className={styles.progressMeter} value={paidCount} max={totalUniqueWinners} />
                  </div>
                )}
                {remainingAmount > 0 && (
                  <div className={`${cardStyles.statDetail} ${styles.remainingLabel}`}>{formatCurrency(remainingAmount)} remaining to mark paid</div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && <div className={`${cardStyles.statePanel} ${cardStyles.dangerPanel} ${styles.errorBanner}`}>{error}</div>}

        {/* Search */}
        {payoutData && aggregatedWinners.length > 0 && (
          <div style={desktopTableDrivenCardStyle}>
            {(() => {
              const hasSearch = searchFirstName.trim().length > 0 || searchLastName.trim().length > 0
              return (
            <SearchPanel
              className={styles.searchStandalone}
              title="Search Payouts"
              useToolbar={false}
              left={(
                <>
                  <input
                    type="text"
                    placeholder="First name"
                    value={searchFirstName}
                    onChange={e => setSearchFirstName(e.target.value)}
                    className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={searchLastName}
                    onChange={e => setSearchLastName(e.target.value)}
                    className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
                  />
                </>
              )}
              right={(
                <button
                  type="button"
                  className={primitiveStyles.searchPanelClearButton}
                  onClick={() => {
                    setSearchFirstName('')
                    setSearchLastName('')
                  }}
                  disabled={!hasSearch}
                >
                  Clear
                </button>
              )}
            />
              )
            })()}
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
          <NoTournamentState
            description="Load a tournament from the dashboard to review prize pools, winners, payment status, and payout exports."
            cards={[
              { title: 'Prize Pools', text: 'Review bracket and side-pot prize pools once tournament results are ready.' },
              { title: 'Winner Review', text: 'See winners by bracket program with payout amounts grouped for quick review.' },
              { title: 'Payment Tracking', text: 'Mark winners as paid and export payout records for tournament staff.' },
            ]}
          />
        )}
        {!loading && selectedTournament && aggregatedWinners.length === 0 && !loading && (
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

        {/* Single condensed winners card */}
        {!loading && aggregatedWinners.length > 0 && (
          <div ref={tableCardRef} className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.tableCard}`}>
            <div className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.cardHeaderRow} ${styles.tableCardHeader}`}>
              <span>Payout Results</span>
              <span className={styles.headerPool}>Total Payouts: {formatCurrency(displayedTotalPrizePool)}</span>
            </div>
            <div className={styles.bracketGroup}>
              {(filteredWinners.length === 0 ? (
                <div className={`${cardStyles.card} ${cardStyles.emptyStateCard} ${styles.emptyState}`}>
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
                        <span className={styles.bracketCount}>{row.winnings.length} bracket{row.winnings.length !== 1 ? 's' : ''} won</span>
                        <button
                          className={styles.toggleDetailsBtn}
                          onClick={() => toggleExpanded(key)}
                          aria-label={expandedKeys.has(key) ? 'Hide details' : 'Show details'}
                        >
                          {expandedKeys.has(key) ? 'Hide details' : 'Show details'}
                        </button>
                        {(sidePotByPlayer[String(row.player_id)] ?? []).map(sp => (
                          <span key={sp.name} className={styles.sidePotPill}>{sp.name}</span>
                        ))}
                      </div>
                      {expandedKeys.has(key) && (() => {
                        const grouped: Record<string, typeof row.winnings> = {}
                        for (const w of row.winnings) {
                          const type = w.bracket_name.replace(/ Bracket \d+$/, '').trim()
                          if (!grouped[type]) grouped[type] = []
                          grouped[type].push(w)
                        }
                        return (
                          <div className={styles.winnerMeta}>
                            {Object.entries(grouped).map(([type, wins]) => (
                              <div key={type} className={styles.winnerMetaGroup}>
                                <div className={styles.winnerMetaGroupLabel}>{type}</div>
                                {wins.map(w => {
                                  const bracketShort = w.bracket_name.replace(/^.* (Bracket \d+)$/, '$1')
                                  return (
                                    <div key={w.bracket_name} className={styles.winnerMetaRow}>
                                      {bracketShort} — {w.position} — {formatCurrency(w.payout_amount)}{w.split_pot ? ' (split)' : ''}
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <div className={styles.payoutCol}>
                      <div className={styles.payoutAmount}>{formatCurrency(row.total_won)}</div>
                      {row.winnings.length > 1 && (
                        <div className={styles.payoutPct}>{row.winnings.length} brackets</div>
                      )}
                    </div>
                    {isPaid ? (
                      <button className={`${badgeStyles.badge} ${badgeStyles.success} ${styles.paidBadge}`} onClick={() => togglePaid(key)}>Paid</button>
                    ) : (
                      <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary} ${styles.markPaidBtn}`} onClick={() => togglePaid(key)}>Mark Paid</button>
                    )}
                  </div>
                )
              }))}
            </div>
          </div>
        )}

      </div>

      <ExplainPayoutsModal
        isOpen={isPayoutsGuideOpen}
        onClose={() => setIsPayoutsGuideOpen(false)}
      />
    </ErrorBoundary>
  )
}





