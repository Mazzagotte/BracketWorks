'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { SidePotsSettings, Tournament, Squad } from '../lib/types'
import { usePayouts } from './hooks/usePayouts'
import NoTournamentState from '../components/NoTournamentState'
import { storage } from '../lib/storage'
import { API, apiClient, apiFetch } from '../lib/api'
import { logger } from '../lib/logger'
import { useToast } from '../components/Toast'
import { getSelectedSquadId, getSelectedTournamentId } from '../lib/selection-session'
import { getPayoutUnlockKey } from '../lib/storageKeys'
import Link from 'next/link'
import styles from './payouts.module.css'
import ExplainPayoutsModal from './ExplainPayoutsModal'
import { formatCurrency } from '../lib/formatters'

function placeBadgeClass(place: number) {
  if (place === 1) return `${styles.placeBadge} ${styles.place1}`
  if (place === 2) return `${styles.placeBadge} ${styles.place2}`
  if (place === 3) return `${styles.placeBadge} ${styles.place3}`
  return `${styles.placeBadge} ${styles.placeOther}`
}

interface ScoreRow {
  player_id: number
  game1_scratch?: number | null
  game2_scratch?: number | null
  game3_scratch?: number | null
  game1_with_handicap?: number | null
  game2_with_handicap?: number | null
  game3_with_handicap?: number | null
}

type TournamentBootstrapResponse = {
  tournament: Tournament | null;
  squads: Squad[];
  selected_squad: { squad_id: number } | null;
}

export default function PayoutsPage() {
  const { addToast } = useToast()
  const { isUserAuthenticated, isAuthInitialized } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const { squads, fetchSquads } = useSquads()

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [paidKeys, setPaidKeys] = useState<Set<string>>(new Set())
  const [sidePotPaidKeys, setSidePotPaidKeys] = useState<Set<string>>(new Set())
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const [isPayoutsGuideOpen, setIsPayoutsGuideOpen] = useState(false)

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

  useEffect(() => {
    fetchTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated) return

    const hydrateFromBootstrap = async () => {
      const storedId = getSelectedTournamentId()
      if (!storedId) return
      const bootstrapStarted = performance.now()

      try {
        const bootstrap = await apiClient.get<TournamentBootstrapResponse>(
          `/api/v1/tournaments/bootstrap?tournament_id=${storedId}`,
          false,
        )

        if (!bootstrap?.tournament) return

        setSelectedTournament(bootstrap.tournament)
        fetchSquads(bootstrap.tournament.id)

        const storedSquadId = getSelectedSquadId()
        const restoredSelectedSquadId = bootstrap.selected_squad?.squad_id
          ?? (storedSquadId ? Number(storedSquadId) : null)

        if (restoredSelectedSquadId) {
          const restored = (bootstrap.squads || []).find(s => s.id === restoredSelectedSquadId) || null
          setSelectedSquad(restored)
        } else if ((bootstrap.squads || []).length > 0) {
          setSelectedSquad(bootstrap.squads[0])
        }

        logger.info('Payouts bootstrap load completed', {
          tournamentId: Number(storedId),
          durationMs: Math.round((performance.now() - bootstrapStarted) * 100) / 100,
          squadsCount: (bootstrap.squads || []).length,
          hasSelectedSquad: Boolean(bootstrap.selected_squad?.squad_id),
        })
      } catch {
        // Fallback to existing tournament/squad initialization flow.
      }
    }

    void hydrateFromBootstrap()
  }, [fetchSquads, isUserAuthenticated, isAuthInitialized])

  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedId = getSelectedTournamentId()
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
      const storedId = getSelectedSquadId()
      const found = storedId ? squads.find(s => s.id === parseInt(storedId)) : null
      setSelectedSquad(found ?? squads[0])
    }
  }, [squads, selectedSquad])

  useEffect(() => {
    if (!selectedTournament || !isUnlocked) return
    loadPayoutData()
    loadEntryData()
      // Load paid status from localStorage for this tournament
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournament, selectedSquad, isUnlocked])

  useEffect(() => {
    const loadScores = async () => {
      if (!selectedTournament || !isUnlocked) {
        setScoreRows([])
        return
      }

      const token = storage.getItem('token')
      if (!token) {
        setScoreRows([])
        return
      }

      const params = new URLSearchParams({ tournament_id: String(selectedTournament.id) })
      if (selectedSquad?.id) params.set('squad_id', String(selectedSquad.id))

      try {
        const response = await apiFetch(API(`/api/v1/scores/?${params.toString()}`), {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          setScoreRows([])
          return
        }
        const data = await response.json()
        setScoreRows(Array.isArray(data) ? data : [])
      } catch {
        setScoreRows([])
      }
    }

    loadScores()
  }, [selectedTournament, selectedSquad, isUnlocked])

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
    const map: Record<string, { name: string; pool: number }[]> = {}
    for (const pot of sidePotAccounting.summaries) {
      if (pot.winnerId != null) {
        const k = String(pot.winnerId)
        if (!map[k]) map[k] = []
        map[k].push({ name: pot.name, pool: pot.pool })
      }
    }
    return map
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
      // Compute same derived data as the PDF export
      const sidePotByPlayer: Record<string, { name: string; pool: number }[]> = {}
      for (const pot of sidePotAccounting.summaries) {
        if (pot.winnerId != null) {
          const k = String(pot.winnerId)
          if (!sidePotByPlayer[k]) sidePotByPlayer[k] = []
          sidePotByPlayer[k].push({ name: pot.name, pool: pot.pool })
        }
      }

      const rows = filteredWinners.map((winner, index) => {
        const key = String(winner.player_id ?? winner.player_name)
        const sidePotWins = sidePotByPlayer[String(winner.player_id)] ?? []
        const sidePotTotal = sidePotWins.reduce((s, p) => s + p.pool, 0)
        return {
          rank: index + 1,
          playerName: winner.player_name,
          bracketTotal: Math.round(winner.total_won),
          sidePotTotal: Math.round(sidePotTotal),
          totalWon: Math.round(winner.total_won + sidePotTotal),
          isPaid: paidKeys.has(key),
        }
      })

      const hasSidePotCol = rows.some(r => r.sidePotTotal > 0)
      const totalBracketsAmt = rows.reduce((s, r) => s + r.bracketTotal, 0)
      const totalSidePotsAmt = rows.reduce((s, r) => s + r.sidePotTotal, 0)
      const totalAll = totalBracketsAmt + totalSidePotsAmt
      const paidCount = rows.filter(r => r.isPaid).length

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

      const { Workbook } = await import('exceljs')
      const workbook = new Workbook()
      const ws = workbook.addWorksheet('Payouts')

      // Brand colors (ARGB format)
      const C_ORANGE = 'FFF07820'
      const C_ORANGE_DK = 'FFB45309'
      const C_INK = 'FF1F2937'
      const C_MUTED = 'FF6B7280'
      const C_LINE = 'FFE5E7EB'
      const C_SOFT = 'FFF1F5F9'
      const C_WHITE = 'FFFFFFFF'
      const C_SUCCESS_BG = 'FFD1FAE5'
      const C_SUCCESS_FG = 'FF166534'
      const C_ALT = 'FFFAFAFA'

      const numCols = hasSidePotCol ? 6 : 4
      ws.getColumn(1).width = 6
      ws.getColumn(2).width = 30
      if (hasSidePotCol) {
        ws.getColumn(3).width = 14
        ws.getColumn(4).width = 14
        ws.getColumn(5).width = 14
        ws.getColumn(6).width = 10
      } else {
        ws.getColumn(3).width = 14
        ws.getColumn(4).width = 10
      }

      let r = 1
      const merge = (row: number, c1: number, c2: number) => {
        if (c2 > c1) ws.mergeCells(row, c1, row, c2)
      }

      // Title banner
      merge(r, 1, numCols)
      const titleCell = ws.getRow(r).getCell(1)
      titleCell.value = 'BracketWorks  —  Payout Distribution'
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C_WHITE } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_ORANGE } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(r).height = 28
      r++

      // Tournament name
      merge(r, 1, numCols)
      const nameCell = ws.getRow(r).getCell(1)
      nameCell.value = tournamentName
      nameCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: C_INK } }
      nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(r).height = 22
      r++

      // Squad label
      merge(r, 1, numCols)
      const squadCell = ws.getRow(r).getCell(1)
      squadCell.value = squadLabel
      squadCell.font = { name: 'Calibri', size: 10, color: { argb: C_MUTED } }
      squadCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
      squadCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(r).height = 18
      r++

      // Generated timestamp
      merge(r, 1, numCols)
      const genCell = ws.getRow(r).getCell(1)
      genCell.value = `Generated: ${generatedAt}`
      genCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: C_MUTED } }
      genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
      genCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(r).height = 16
      r++

      // Spacer
      ws.getRow(r).height = 6
      r++

      // Detail section
      const detailData: [string, string][] = [
        ['Programs', programs],
        ['Total Brackets', String(allBrackets.length)],
        ['Total Entries', String(totalEntries)],
        ['Prize Pool', `$${totalAll.toLocaleString()}`],
        ['Winners', String(rows.length)],
        ['Total Payout', `$${totalAll.toLocaleString()}`],
        ['Paid', `${paidCount} / ${rows.length}`],
      ]
      for (const [label, value] of detailData) {
        merge(r, 1, 2)
        merge(r, 3, numCols)
        const lc = ws.getRow(r).getCell(1)
        const vc = ws.getRow(r).getCell(3)
        lc.value = label
        lc.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C_MUTED } }
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
        lc.alignment = { horizontal: 'right', vertical: 'middle' }
        vc.value = value
        vc.font = { name: 'Calibri', size: 10, color: { argb: C_INK } }
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
        vc.alignment = { horizontal: 'left', vertical: 'middle' }
        ws.getRow(r).height = 18
        r++
      }

      // Spacer
      ws.getRow(r).height = 6
      r++

      // Table column headers (orange banner)
      const headers = hasSidePotCol
        ? ['#', 'Player Name', 'Brackets', 'Side Pots', 'Amount', 'Paid']
        : ['#', 'Player Name', 'Amount', 'Paid']
      const hRow = ws.getRow(r)
      headers.forEach((h, i) => {
        const cell = hRow.getCell(i + 1)
        cell.value = h
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C_WHITE } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_ORANGE } }
        cell.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle' }
        cell.border = { bottom: { style: 'thin', color: { argb: C_ORANGE_DK } } }
      })
      hRow.height = 20
      r++

      // Data rows
      const usdFmt = '$#,##0'
      rows.forEach((row, idx) => {
        const dRow = ws.getRow(r)
        const rowBg = row.isPaid ? C_SUCCESS_BG : idx % 2 === 1 ? C_ALT : C_WHITE
        const values: (string | number)[] = hasSidePotCol
          ? [row.rank, row.playerName, row.bracketTotal, row.sidePotTotal, row.totalWon, row.isPaid ? 'Paid' : '']
          : [row.rank, row.playerName, row.totalWon, row.isPaid ? 'Paid' : '']
        values.forEach((v, i) => {
          const cell = dRow.getCell(i + 1)
          cell.value = v
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
          cell.border = { bottom: { style: 'hair', color: { argb: C_LINE } } }
          const isCurrencyCol = hasSidePotCol ? (i >= 2 && i <= 4) : i === 2
          if (isCurrencyCol && typeof v === 'number') {
            cell.numFmt = usdFmt
            cell.font = { name: 'Calibri', size: 10, color: { argb: C_INK } }
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          } else if ((hasSidePotCol && i === 5) || (!hasSidePotCol && i === 3)) {
            cell.font = { name: 'Calibri', size: 10, bold: row.isPaid, color: { argb: row.isPaid ? C_SUCCESS_FG : C_MUTED } }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else {
            cell.font = { name: 'Calibri', size: 10, color: { argb: C_INK } }
            cell.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle' }
          }
        })
        dRow.height = 18
        r++
      })

      // Footer
      r++
      merge(r, 1, numCols)
      const footerCell = ws.getRow(r).getCell(1)
      footerCell.value = 'BracketWorks  ·  bracketworks.app'
      footerCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: C_MUTED } }
      footerCell.alignment = { horizontal: 'center' }

      const xlsxBuffer = await workbook.xlsx.writeBuffer()
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
  }, [addToast, buildExportFileName, filteredWinners, paidKeys, payoutData, selectedTournament, selectedSquad, sidePotAccounting])

  const handleExportToPdf = useCallback(() => {
    if (filteredWinners.length === 0) {
      addToast({ type: 'warning', message: 'No payout rows to export.', duration: 3000 })
      return
    }

    setIsExportingPdf(true)
    try {
      const esc = (value: string) =>
        String(value)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

      const fmt = (value: number) => {
        const rounded = Math.round(Number(value) || 0)
        return new Intl.NumberFormat('en-US', {
          style: 'currency', currency: 'USD',
          minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(rounded)
      }

      // Build side-pot winner lookup: playerId -> side pot winnings
      const sidePotByPlayer: Record<string, { name: string; pool: number }[]> = {}
      for (const pot of sidePotAccounting.summaries) {
        if (pot.winnerId != null) {
          const k = String(pot.winnerId)
          if (!sidePotByPlayer[k]) sidePotByPlayer[k] = []
          sidePotByPlayer[k].push({ name: pot.name, pool: pot.pool })
        }
      }

      // Enrich rows with totals, counts, side pots, and paid status
      const rows = filteredWinners.map((winner, index) => {
        const key = String(winner.player_id ?? winner.player_name)
        const sidePotWins = sidePotByPlayer[String(winner.player_id)] ?? []
        const sidePotTotal = sidePotWins.reduce((s, p) => s + p.pool, 0)
        const scratchWins = winner.winnings.filter(w => w.bracket_name?.toLowerCase().includes('scratch'))
        const handicapWins = winner.winnings.filter(w => w.bracket_name?.toLowerCase().includes('handicap'))
        const otherWins = winner.winnings.filter(w =>
          !w.bracket_name?.toLowerCase().includes('scratch') &&
          !w.bracket_name?.toLowerCase().includes('handicap')
        )
        return {
          rank: index + 1,
          playerName: winner.player_name,
          bracketTotal: winner.total_won,
          sidePotTotal,
          totalWon: winner.total_won + sidePotTotal,
          scratchCount: scratchWins.length,
          handicapCount: handicapWins.length,
          otherCount: otherWins.length,
          isPaid: paidKeys.has(key),
        }
      })

      const hasSidePotCol = rows.some(r => r.sidePotTotal > 0)
      const totalBrackets = rows.reduce((s, r) => s + r.bracketTotal, 0)
      const totalSidePots = rows.reduce((s, r) => s + r.sidePotTotal, 0)
      const totalAll = totalBrackets + totalSidePots
      const paidCount = rows.filter(r => r.isPaid).length

      const tournamentName = selectedTournament?.name || 'Unknown Tournament'
      const squadLabel = selectedSquad
        ? `${selectedSquad.date || ''} \u2014 ${selectedSquad.time || ''}`.trim()
        : 'All Squads'
      const generatedAt = new Date().toLocaleString()
      const paidStampDate = new Date().toLocaleDateString()
      const logoUrl = `${window.location.origin}/logo_no_text.svg`
      const useDoubleCol = rows.length > 20

      const buildTableRows = (slice: typeof rows) => {
        return slice.map(row => {
          return `<tr class="${row.isPaid ? 'isPaidRow' : ''}">
            <td class="rank">${row.rank}</td>
            <td class="player">${esc(row.playerName)}</td>
            ${hasSidePotCol ? `<td class="amount">${row.bracketTotal > 0 ? fmt(row.bracketTotal) : ''}</td>` : ''}
            ${hasSidePotCol ? `<td class="amount${row.sidePotTotal > 0 ? '' : ' empty-cell'}">${row.sidePotTotal > 0 ? fmt(row.sidePotTotal) : '&mdash;'}</td>` : ''}
            <td class="amount">${fmt(row.totalWon)}</td>
            <td class="signature-cell">${row.isPaid ? `<span class="paidStamp">PAID ${esc(paidStampDate)}</span>` : '<span class="signature-line"></span>'}</td>
          </tr>`
        }).join('')
      }

      const buildTable = (slice: typeof rows) => `
        <table>
          <thead><tr>
            <th class="rank">#</th>
            <th>Player Name</th>
            ${hasSidePotCol ? '<th class="amount">Brackets</th>' : ''}
            ${hasSidePotCol ? '<th class="amount">Side Pots</th>' : ''}
            <th class="amount">Amount</th>
            <th class="signature-cell">Signature</th>
          </tr></thead>
          <tbody>${buildTableRows(slice)}</tbody>
        </table>`

      let mainSection: string
      if (useDoubleCol) {
        const mid = Math.ceil(rows.length / 2)
        const leftRows = rows.slice(0, mid)
        const rightRows = rows.slice(mid)
        mainSection = `<div class="twoCol">
          <div class="col">${buildTable(leftRows)}</div>
          <div class="col">${buildTable(rightRows)}</div>
        </div>`
      } else {
        mainSection = buildTable(rows)
      }

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

      const detailRows =
        `<div class="detail-row detail-full"><span class="detail-label">Programs</span><span class="detail-value">${esc(programs)}</span></div>` +
        [
          ['Total Brackets', String(allBrackets.length)],
          ['Total Entries', String(totalEntries)],
          ['Prize Pool', esc(fmt(totalAll))],
        ].map(([label, value]) =>
          `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`
        ).join('')

      const statCards = [
        { label: 'Winners', value: String(rows.length) },
        { label: 'Total Payout', value: fmt(totalAll) },
        ...(hasSidePotCol ? [
          { label: 'Brackets', value: fmt(totalBrackets) },
          { label: 'Side Pots', value: fmt(totalSidePots) },
        ] : []),
        { label: 'Paid', value: `${paidCount} / ${rows.length}` },
      ].map(({ label, value }) => `<div class="stat-card">
          <div class="stat-label">${label}</div>
          <div class="stat-value">${value}</div>
        </div>`).join('')

      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Payout Distribution - ${esc(tournamentName)}</title>
  <link rel="stylesheet" href="/payouts-print.css" />
</head>
<body>
  <main class="page">
    <header class="brand-header">
      <section class="brand-left">
        <img src="${esc(logoUrl)}" alt="BracketWorks" class="logo" />
        <div>
          <h2 class="brand-name">BracketWorks</h2>
          <p class="brand-tagline">Bowling Brackets &amp; Side Pots</p>
        </div>
      </section>
      <section class="report-title">
        <h1>Payout Distribution</h1>
        <p>Official tournament payout sheet</p>
      </section>
    </header>
    <section class="event-band">
      <div class="event-band-inner">
        <h2 class="event-name">${esc(tournamentName)}</h2>
        <p class="event-meta">${esc(squadLabel)}</p>
      </div>
      <div class="generated">Generated<br />${esc(generatedAt)}</div>
    </section>
    <div class="details-band">${detailRows}</div>
    <section class="stats">${statCards}</section>
    ${mainSection}
    <div class="commissioner">
      <p class="commissioner-title">Commissioner Verification</p>
      <div class="commissioner-fields">
        <div>
          <div class="field-label">Commissioner / Tournament Director Signature</div>
          <div class="field-line"></div>
        </div>
        <div>
          <div class="field-label">Date</div>
          <div class="field-line"></div>
        </div>
      </div>
    </div>
    <footer class="footer">
      <span><strong>BracketWorks</strong> &bull; bracketworks.app</span>
      <span>Generated by BracketWorks. Payout amounts are based on tournament settings and are subject to commissioner verification. BracketWorks does not collect entry fees, hold funds, distribute winnings, or determine prize structures.</span>
    </footer>
  </main>
</body>
</html>`

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
  }, [addToast, buildExportFileName, filteredWinners, selectedTournament, selectedSquad, paidKeys, sidePotAccounting, payoutData])

  const headerActions = useMemo(() => (
    <>
      <button
        className="ds-btn ds-btn-info ds-btn-sm"
        onClick={() => setIsPayoutsGuideOpen(true)}
      >
        Payouts Guide
      </button>
      <button
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={handleExportToExcel}
        disabled={loading || isExportingExcel || filteredWinners.length === 0}
      >
        {isExportingExcel ? 'Exporting...' : isMobileView ? 'Excel' : 'Export to Excel'}
      </button>
      <button
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={handleExportToPdf}
        disabled={loading || isExportingPdf || filteredWinners.length === 0}
      >
        {isExportingPdf ? 'Exporting...' : isMobileView ? 'PDF' : 'Export to PDF'}
      </button>
    </>
  ), [filteredWinners.length, handleExportToExcel, handleExportToPdf, isExportingExcel, isExportingPdf, isMobileView, loading])

  usePageHeader({
    title: 'Payout Distribution',
    subtitle: undefined,
    actions: headerActions,
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
      <div className={styles.emptyState}>
        <div className={styles.emptyTitle}>Please log in</div>
        <div className={styles.emptyMessage}>Sign in to view payout information.</div>
      </div>
    )
  }

  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
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

  if (!isUnlocked) {
    return (
      <NoTournamentState
        title="Payouts Not Yet Calculated"
        description="To view payout distribution, go to the Scores page and press the &quot;Calculate Payouts&quot; button. This ensures all scores are reviewed and finalized before payouts are determined."
        cards={[
          { title: 'Enter Scores First', text: 'Make sure all bowler game scores are entered on the Scores page before calculating payouts' },
          { title: 'Review & Confirm', text: 'The Calculate Payouts button checks for missing scores and asks you to confirm all scores are final' },
          { title: 'Payout Distribution', text: 'Once confirmed, you will be brought here to view winners, prize pools, and mark payouts as complete' },
        ]}
      />
    )
  }

  return (
    <ErrorBoundary>
      <div className={styles.pageContainer}>
        {/* Summary card */}
        {payoutData && (
          <div className={`surface-card ${styles.summaryCard}`}>
            <h3 className={`surface-cardHeader ${styles.summaryTitle}`}>Payout Summary</h3>
            <div className={styles.summaryGrid}>
              <div className={`${styles.statBox} ${styles.statBoxTotal}`}>
                <div className={`${styles.statValue} ${styles.statValueGreen}`}>{formatCurrency(displayedTotalPrizePool)}</div>
                <div className={styles.statLabel}>Final Prize Pool</div>
                {sidePotAccounting.totalPool > 0 && (
                  <div className={styles.statDetail}>Includes {formatCurrency(sidePotAccounting.totalPool)} in side pots</div>
                )}
              </div>
              {programSummaries.map(program => (
                <div key={program.key} className={styles.statBox}>
                  <div className={styles.statValue}>{formatCurrency(program.total_prize_pool)}</div>
                  <div className={styles.statLabel}>{program.name} Pool</div>
                  <div className={styles.statDetail}>{program.total_brackets} bracket{program.total_brackets !== 1 ? 's' : ''}</div>
                </div>
              ))}
              {sidePotAccounting.summaries.map(pot => (
                <div key={pot.key} className={styles.statBox}>
                  <div className={styles.statValue}>{formatCurrency(pot.pool)}</div>
                  <div className={styles.statLabel}>{pot.name} Pool</div>
                  <div className={styles.statDetail}>{pot.entryCount} side pot entr{pot.entryCount === 1 ? 'y' : 'ies'}</div>
                </div>
              ))}
              <div className={styles.statBox}>
                <div className={styles.statValue}>{paidCount} / {totalUniqueWinners}</div>
                <div className={styles.statLabel}>Marked Paid</div>
                {totalUniqueWinners > 0 && (
                  <div className={styles.progressBarRow}>
                    <progress className={styles.progressMeter} value={paidCount} max={totalUniqueWinners} />
                  </div>
                )}
                {remainingAmount > 0 && (
                  <div className={styles.remainingLabel}>{formatCurrency(remainingAmount)} remaining to mark paid</div>
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
          <div className="bw-empty-wrap">
            <div className="bw-payout-empty-card">
              <h2 className="bw-payout-empty-title">
                No Payouts Calculated Yet
              </h2>
              <p className="bw-payout-empty-text">
                Complete brackets first, then return here to review and mark payouts.
              </p>
              <div className="bw-payout-empty-actions">
                <Link href="/brackets" className="ds-btn ds-btn-primary ds-btn-md">
                  Go to Brackets
                </Link>
                <Link href="/dashboard" className="ds-btn ds-btn-secondary ds-btn-md">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Single condensed winners card */}
        {!loading && aggregatedWinners.length > 0 && (
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span>Payout Results</span>
              <span className={styles.headerPool}>Total Payouts: {formatCurrency(displayedTotalPrizePool)}</span>
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
                      <button className={styles.paidBadge} onClick={() => togglePaid(key)}>Paid</button>
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

      <ExplainPayoutsModal
        isOpen={isPayoutsGuideOpen}
        onClose={() => setIsPayoutsGuideOpen(false)}
      />
    </ErrorBoundary>
  )
}





