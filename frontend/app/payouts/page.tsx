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
  const { isAuthenticated, isInitialized } = useAuth()
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
  const [settingsRevision, setSettingsRevision] = useState(0)

  const getPayoutUnlockKey = useCallback((tournamentId: number | null, squadId: number | null) => {
    if (!tournamentId) return null
    return `payouts_unlocked_${tournamentId}_${squadId ?? 'all'}`
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
  }, [getPayoutUnlockKey, selectedSquad, selectedTournament])

  useEffect(() => {
    const handleSettingsChanged = () => {
      setSettingsRevision(prev => prev + 1)
    }
    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [])

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
    if (!isInitialized || !isAuthenticated) return

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
  }, [fetchSquads, isAuthenticated, isInitialized])

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
      const stored = storage.getItem(`payouts_paid_${selectedTournament.id}`)
      setPaidKeys(new Set(stored ? JSON.parse(stored) : []))

      const storedSidePotPaid = storage.getItem(`payouts_sidepot_paid_${selectedTournament.id}`)
      setSidePotPaidKeys(new Set(storedSidePotPaid ? JSON.parse(storedSidePotPaid) : []))
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
      const logoUrl = `${window.location.origin}/logo.svg`
      const printCssUrl = `${window.location.origin}/payouts-print.css`
      const useDoubleCol = rows.length > 20

      // Build a single table's rows for a slice
      const buildTableRows = (slice: typeof rows) => {
        return slice.map(row => {
          const entryTag = [
            row.scratchCount > 0 ? `S×${row.scratchCount}` : '',
            row.handicapCount > 0 ? `H×${row.handicapCount}` : '',
            row.otherCount > 0 ? `O×${row.otherCount}` : '',
          ].filter(Boolean).join(' ')
          return `<tr class="${row.isPaid ? 'isPaidRow' : ''}">
            <td class="rankCol">${row.rank}</td>
            <td>
              <div class="playerName">${esc(row.playerName)}</div>
              ${entryTag ? `<div class="entryTag">${entryTag}</div>` : ''}
            </td>
            ${hasSidePotCol ? `<td class="amtCol">${row.bracketTotal > 0 ? fmt(row.bracketTotal) : ''}</td>` : ''}
            ${hasSidePotCol ? `<td class="amtCol">${row.sidePotTotal > 0 ? fmt(row.sidePotTotal) : ''}</td>` : ''}
            <td class="amtCol bold">${fmt(row.totalWon)}</td>
            <td class="sigCol">${row.isPaid ? `<div class="paidStamp">PAID ${esc(paidStampDate)}</div>` : '<div class="sigLine"></div>'}</td>
          </tr>`
        }).join('')
      }

      const buildTable = (slice: typeof rows) => `
        <table>
          <thead><tr>
            <th class="rankCol">#</th>
            <th>Player Name</th>
            ${hasSidePotCol ? '<th class="amtCol">Brackets</th>' : ''}
            ${hasSidePotCol ? '<th class="amtCol">Side Pots</th>' : ''}
            <th class="amtCol">Amount</th>
            <th class="sigCol">Signature</th>
          </tr></thead>
          <tbody>${buildTableRows(slice)}</tbody>
        </table>`

      let mainSection: string
      if (useDoubleCol) {
        const mid = Math.ceil(rows.length / 2)
        const leftRows = rows.slice(0, mid)
        const rightRows = rows.slice(mid)
        mainSection = `
          <div class="twoCol">
            <div class="col">${buildTable(leftRows)}</div>
            <div class="col">${buildTable(rightRows)}</div>
          </div>`
      } else {
        mainSection = buildTable(rows)
      }

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payout Distribution — ${esc(tournamentName)}</title>
  <link rel="stylesheet" href="${esc(printCssUrl)}" />
</head>
<body>
  <div class="header">
    <img src="${esc(logoUrl)}" alt="BracketWorks" class="logo"/>
    <div class="headerRight">
      <h1>Payout Distribution</h1>
      <p class="meta">${esc(tournamentName)} &mdash; ${esc(squadLabel)}</p>
      <p class="meta">Generated: ${esc(generatedAt)}</p>
    </div>
  </div>
  <div class="summary">
    <span><strong>${rows.length}</strong> winner${rows.length !== 1 ? 's' : ''}</span>
    <span>Total: <strong>${esc(fmt(totalAll))}</strong></span>
    ${hasSidePotCol ? `<span>Brackets: <strong>${esc(fmt(totalBrackets))}</strong></span><span>Side Pots: <strong>${esc(fmt(totalSidePots))}</strong></span>` : ''}
    <span>Paid: <strong>${paidCount}/${rows.length}</strong></span>
  </div>
  ${mainSection}
</body>
</html>`

      const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.opacity = '0'
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
        iframe.contentWindow?.print()
        setTimeout(cleanupIframe, 1000)
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
  }, [addToast, filteredWinners, selectedTournament, selectedSquad, paidKeys, sidePotAccounting])

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
        className="ds-btn ds-btn-primary ds-btn-sm"
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

  const displayedTotalPrizePool = (payoutData?.total_prize_pool ?? 0) + sidePotAccounting.totalPool

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

  const matchesSearch = (name: string) =>
    !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase())

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
              <div className={styles.statBox}>
                <div className={`${styles.statValue} ${styles.statValueGreen}`}>{formatCurrency(displayedTotalPrizePool)}</div>
                <div className={styles.statLabel}>Total Prize Pool</div>
                {sidePotAccounting.totalPool > 0 && (
                  <div className={styles.statDetail}>incl. {formatCurrency(sidePotAccounting.totalPool)} side pots</div>
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
                  <div className={styles.statDetail}>{pot.entryCount} entr{pot.entryCount === 1 ? 'y' : 'ies'}</div>
                </div>
              ))}
              <div className={styles.statBox}>
                <div className={styles.statValue}>{paidCount} / {totalUniqueWinners}</div>
                <div className={styles.statLabel}>Paid Out</div>
                {totalUniqueWinners > 0 && (
                  <div className={styles.progressBarRow}>
                    <progress className={styles.progressMeter} value={paidCount} max={totalUniqueWinners} />
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
              <span>Winners</span>
              <span className={styles.headerPool}>{formatCurrency(displayedTotalPrizePool)} total</span>
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
                          {expandedKeys.has(key) ? 'Hide' : 'Show'} {row.winnings.length} bracket{row.winnings.length !== 1 ? 's' : ''}
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

        {!loading && sidePotAccounting.summaries.length > 0 && (
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span>Side Pot Winners</span>
              <span className={styles.headerPool}>{formatCurrency(sidePotAccounting.totalPool)} total</span>
            </div>
            <div className={styles.bracketGroup}>
              {sidePotAccounting.summaries.map(pot => {
                const hasWinner = Boolean(pot.winnerId)
                const isPaid = sidePotPaidKeys.has(pot.key)

                return (
                  <div key={pot.key} className={`${styles.winnerRow} ${isPaid ? styles.isPaid : ''}`}>
                    <div className={`${styles.placeBadge} ${styles.placeSP}`}>SP</div>
                    <div className={styles.winnerInfo}>
                      <div className={styles.winnerName}>
                        {pot.winnerName ?? 'Pending scores'}
                      </div>
                      <div className={styles.winnerMeta}>{pot.name}</div>
                    </div>
                    <div className={styles.payoutCol}>
                      <div className={styles.payoutAmount}>{formatCurrency(pot.pool)}</div>
                    </div>
                    {isPaid ? (
                      <button className={styles.paidBadge} onClick={() => toggleSidePotPaid(pot.key)}>Paid</button>
                    ) : (
                      <button
                        className={styles.markPaidBtn}
                        onClick={() => toggleSidePotPaid(pot.key)}
                        disabled={!hasWinner || pot.pool <= 0}
                        title={!hasWinner ? 'Scores are required to auto-select winner' : undefined}
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}





