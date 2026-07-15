'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tournament, Squad, Player, ScoreData, TournamentBootstrapResponse } from '../lib/types'
import { SortConfig, SortableScoreColumn } from './types'
import { SortableHeader } from '../components/SortableHeader'

import Link from 'next/link'

import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { API, apiClient, apiFetch } from '../lib/api'
import { usePageHeader } from '../lib/header-context'
import EnhancedButton from '../components/EnhancedButton'
import CloseControl from '../../components/CloseControl'
import { MobileLayout } from '../../components/MobileLayout'
import { Spinner } from '../components/LoadingComponents'
import styles from './scores.module.css'
import cardStyles from '../styles/cards.module.css'
import buttonStyles from '../styles/buttons.module.css'
import formStyles from '../styles/forms.module.css'
import shellStyles from '../styles/page-shell.module.css'
import tableStyles from '../styles/tables.module.css'
import { useToast } from '../components/Toast'
import { usePagination, Pagination } from '../components/Performance'
import { useAutoSave } from '../components/DataManagement'
import NoTournamentState from '../components/NoTournamentState'
import { QuickActions, SearchPanel } from '../components/primitives'
import { logger } from '../lib/logger';
import { handleTableArrowNavigation } from '../lib/tableKeyboard'
import { getSelectedSquadId, getSelectedTournamentId, setSelectedSquad as persistSelectedSquad } from '../lib/selection-session'
import { storage } from '../lib/storage'
import { getPayoutUnlockKey, getScoresLockKey } from '../lib/storageKeys'
import ExplainScoresModal from './ExplainScoresModal'
import {
  buildScoresExcelBuffer,
  calculateDisplayTotal,
  calculateTotalScratch,
  calculateTotalWithHandicap,
  getGameTotal,
  normalizeHeader,
  parsePlayerId,
  parseScoreNumber,
  parseScoresExcelFile,
} from './utils/scoreUtils'
import { useOfflineScoreSync } from './hooks/useOfflineScoreSync'


export default function ScoresPage() {
  // Authentication check - must be at the top
  const { isUserAuthenticated, isAuthInitialized, authToken, currentUser } = useAuth();
  const storedAuthToken = typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
  const sessionToken = authToken || storedAuthToken;

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuth = typeof window !== 'undefined' &&
    sessionToken &&
    localStorage.getItem('user_id');

  const router = useRouter()
  const [showCalcPayoutsConfirm, setShowCalcPayoutsConfirm] = useState(false)
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0)
  const [showBracketMismatchWarning, setShowBracketMismatchWarning] = useState(false)
  const [isScoresGuideOpen, setIsScoresGuideOpen] = useState(false)
  const [missingScoreNames, setMissingScoreNames] = useState<string[]>([])
  const [clearGameConfirm, setClearGameConfirm] = useState<2 | 3 | null>(null)

  const [players, setPlayers] = useState<Player[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isScoresLocked, setIsScoresLocked] = useState(false)
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')
  const [mobileExpandedPlayers, setMobileExpandedPlayers] = useState<Record<number, boolean>>({})
  const [rowSaveState, setRowSaveState] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'failed'>>({})
  const [lastEdit, setLastEdit] = useState<{ playerId: number; field: string; previous: number | undefined } | null>(null)
  const [desktopTableDrivenWidth, setDesktopTableDrivenWidth] = useState<number | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const debouncedSavesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const desktopContainerRef = useRef<HTMLDivElement | null>(null)
  const desktopScoresTableRef = useRef<HTMLTableElement | null>(null)

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

  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: null,
    direction: null
  })

  // Enhanced UX hooks
  const { addToast } = useToast()
  const { isOnline, pendingSaves, setPendingSaves, processPendingSaves } = useOfflineScoreSync({ addToast })

  const unlockPayoutsAndGo = useCallback(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null

    if (tournamentId) {
      const unlockKey = getPayoutUnlockKey(tournamentId, squadId)
      const lockKey = getScoresLockKey(tournamentId, squadId)
      if (unlockKey) storage.setItem(unlockKey, '1')
      if (lockKey) storage.setItem(lockKey, '1')
      setIsScoresLocked(true)
    }

    sessionStorage.setItem('payouts_unlocked', '1')
    router.push('/payouts')
  }, [router, selectedSquad, tournament])

  const unlockScoresTable = useCallback(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null
    if (!tournamentId) return

    const lockKey = getScoresLockKey(tournamentId, squadId)
    const payoutKey = getPayoutUnlockKey(tournamentId, squadId)

    if (lockKey) storage.removeItem(lockKey)
    if (payoutKey) storage.removeItem(payoutKey)
    sessionStorage.removeItem('payouts_unlocked')
    setIsScoresLocked(false)

    addToast({
      message: 'Scores unlocked. Payout access revoked until Calculate Payouts is clicked again.',
      type: 'success',
      duration: 4000,
    })
  }, [addToast, selectedSquad, tournament])

  // Styles moved to globals.css; no inline style injection

  // Sorting functionality
  const handleSort = useCallback((column: string) => {
    setSortConfig(currentSort => {
      if (currentSort.column === column) {
        // Toggle direction: asc -> desc -> null (remove sort)
        const newDirection =
          currentSort.direction === 'asc' ? 'desc' :
          currentSort.direction === 'desc' ? null : 'asc';
        return {
          column: newDirection ? column : null,
          direction: newDirection
        };
      } else {
        // New column, start with ascending
        return {
          column,
          direction: 'asc'
        };
      }
    });
  }, []);

  // Sort players based on current sort configuration
  const sortedPlayers = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return players;
    }

    return [...players].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      // Handle different column types
      switch (sortConfig.column) {
        case 'firstName':
          aValue = a.firstName?.toLowerCase() || '';
          bValue = b.firstName?.toLowerCase() || '';
          break;
        case 'lastName':
          aValue = a.lastName?.toLowerCase() || '';
          bValue = b.lastName?.toLowerCase() || '';
          break;
        case 'lane':
          aValue = a.lane || 0;
          bValue = b.lane || 0;
          break;
        case 'average':
          aValue = a.average || 0;
          bValue = b.average || 0;
          break;
        case 'game1_scratch':
          aValue = a.scores?.game1_scratch || 0;
          bValue = b.scores?.game1_scratch || 0;
          break;
        case 'game1_total':
          aValue = (a.scores?.game1_scratch || 0) + (a.handicap ?? 0);
          bValue = (b.scores?.game1_scratch || 0) + (b.handicap ?? 0);
          break;
        case 'game2_scratch':
          aValue = a.scores?.game2_scratch || 0;
          bValue = b.scores?.game2_scratch || 0;
          break;
        case 'game2_total':
          aValue = (a.scores?.game2_scratch || 0) + (a.handicap ?? 0);
          bValue = (b.scores?.game2_scratch || 0) + (b.handicap ?? 0);
          break;
        case 'game3_scratch':
          aValue = a.scores?.game3_scratch || 0;
          bValue = b.scores?.game3_scratch || 0;
          break;
        case 'game3_total':
          aValue = (a.scores?.game3_scratch || 0) + (a.handicap ?? 0);
          bValue = (b.scores?.game3_scratch || 0) + (b.handicap ?? 0);
          break;
        case 'totalScratch':
          aValue = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0);
          bValue = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0);
          break;
        case 'totalWithHandicap':
          const aScratch = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0);
          const bScratch = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0);
          aValue = aScratch + ((a.handicap ?? 0) * 3);
          bValue = bScratch + ((b.handicap ?? 0) * 3);
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // Fallback comparison
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [players, sortConfig]);

  const filteredPlayers = useMemo(() => {
    const firstNameQuery = searchFirstName.trim().toLowerCase()
    const lastNameQuery = searchLastName.trim().toLowerCase()

    if (!firstNameQuery && !lastNameQuery) {
      return sortedPlayers
    }

    return sortedPlayers.filter(player => {
      const first = (player.firstName || '').toLowerCase()
      const last = (player.lastName || '').toLowerCase()
      const firstMatches = !firstNameQuery || first.includes(firstNameQuery)
      const lastMatches = !lastNameQuery || last.includes(lastNameQuery)
      return firstMatches && lastMatches
    })
  }, [sortedPlayers, searchFirstName, searchLastName])

  const hasMissingScore = useCallback((player: Player) => {
    const scores = player.scores || {}
    return scores.game1_scratch == null || scores.game2_scratch == null || scores.game3_scratch == null
  }, [])

  const needsReviewScore = useCallback((player: Player) => {
    const scores = player.scores || {}
    return [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch].some(score => (score || 0) >= 250)
  }, [])

  // Mobile shows all filtered players (no additional mode filtering)
  const mobilePlayers = filteredPlayers

  const visiblePlayers = isMobile ? mobilePlayers : filteredPlayers

  // Pagination for large player lists (use sorted players)
  const paginationHook = usePagination({
    items: visiblePlayers,
    itemsPerPage: 50,
    resetOnItemsChange: false
  })
  const { goToPage } = paginationHook

  useEffect(() => {
    goToPage(1)
  }, [goToPage, searchFirstName, searchLastName, isMobile])

  // Stable reference for auto-save; only changes when scores actually change.
  const autoSaveData = useMemo(
    () => ({ scores: players.map(player => player.scores).filter(Boolean) }),
    [players]
  )

  // Auto-save scores backup to localStorage
  useAutoSave({
    data: autoSaveData,
    saveFunction: async (data) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('scores-backup', JSON.stringify(data))
      }
    },
    delay: 2000
  })

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 900);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncTableDrivenWidth = () => {
      const container = desktopContainerRef.current
      const table = desktopScoresTableRef.current

      if (!container || !table || isMobile) {
        setDesktopTableDrivenWidth(null)
        return
      }

      const nextWidth = Math.max(0, Math.floor(Math.min(table.scrollWidth, container.clientWidth)))
      setDesktopTableDrivenWidth(previous => (previous === nextWidth ? previous : nextWidth))
    }

    syncTableDrivenWidth()

    const observer = new ResizeObserver(() => {
      syncTableDrivenWidth()
    })

    if (desktopContainerRef.current) observer.observe(desktopContainerRef.current)
    if (desktopScoresTableRef.current) observer.observe(desktopScoresTableRef.current)
    window.addEventListener('resize', syncTableDrivenWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncTableDrivenWidth)
    }
  }, [isMobile, filteredPlayers.length, paginationHook.currentPage, players.length, selectedSquad?.id])

  const desktopTableDrivenCardStyle = useMemo(() => {
    if (!desktopTableDrivenWidth || isMobile) return undefined
    return {
      width: `${desktopTableDrivenWidth}px`,
      maxWidth: '100%',
    }
  }, [desktopTableDrivenWidth, isMobile])

  // Stable ref so handleRandomizeScores never needs players in its dep array
  const playersRef = useRef(players)
  useEffect(() => { playersRef.current = players }, [players])

  // Stable ref for selectedSquad so save closures never go stale
  const selectedSquadRef = useRef(selectedSquad)
  useEffect(() => { selectedSquadRef.current = selectedSquad }, [selectedSquad])

  // DEV ONLY: build all random scores in memory, then do ONE setPlayers + ONE bulk API call
  const handleRandomizeScores = useCallback(async () => {
    const token = sessionToken
    const tournamentId = getSelectedTournamentId()
    const squadId = selectedSquadRef.current?.id ?? getSelectedSquadId()
    const currentPlayers = playersRef.current

    if (!token || !tournamentId) {
      addToast({ message: 'Missing auth or tournament context. Unable to randomize scores.', type: 'error', duration: 4000 })
      return
    }

    if (!squadId) {
      addToast({ message: 'Select a squad before randomizing scores.', type: 'warning', duration: 3500 })
      return
    }

    // Build random scores for every player
    const scoreMap: Record<number, { g1: number; g2: number; g3: number }> = {}
    currentPlayers.forEach(player => {
      scoreMap[player.id] = {
        g1: Math.floor(Math.random() * 121) + 130,
        g2: Math.floor(Math.random() * 121) + 130,
        g3: Math.floor(Math.random() * 121) + 130,
      }
    })

    // Single state update; no cascade.
    setPlayers(prev => prev.map(player => {
      const s = scoreMap[player.id]
      if (!s) return player
      return {
        ...player,
        scores: {
          game1_scratch: s.g1,
          game1_with_handicap: s.g1 + (player.handicap || 0),
          game2_scratch: s.g2,
          game2_with_handicap: s.g2 + (player.handicap || 0),
          game3_scratch: s.g3,
          game3_with_handicap: s.g3 + (player.handicap || 0),
        }
      }
    }))

    // Persist to backend; fire-and-forget each save without touching React state.
    const results = await Promise.allSettled(
      currentPlayers.map(player => {
        const s = scoreMap[player.id]
        if (!s) return Promise.resolve(new Response(null, { status: 204 }))
        return apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: player.id,
            tournament_id: parseInt(tournamentId, 10),
            squad_id: squadId,
            game1_scratch: s.g1,
            game2_scratch: s.g2,
            game3_scratch: s.g3,
          }),
        })
      })
    )

    const successful = results.filter(result => result.status === 'fulfilled' && result.value.ok).length
    const failed = currentPlayers.length - successful

    if (failed > 0 && successful === 0) {
      addToast({ message: 'Randomize failed to save to database.', type: 'error', duration: 4500 })
      return
    }

    addToast({
      message: failed > 0
        ? `Randomized ${successful} players. ${failed} failed to save.`
        : `Randomized and saved ${successful} players.`,
      type: failed > 0 ? 'warning' : 'success',
      duration: 3500,
    })
  }, [sessionToken, addToast])

  const handleExportScoresToExcel = useCallback(async () => {
    if (players.length === 0) {
      addToast({ message: 'No scores to export.', type: 'warning', duration: 3000 })
      return
    }

    setIsExporting(true)
    try {
      const { buffer, fileName, rowCount } = await buildScoresExcelBuffer(sortedPlayers, tournament, selectedSquad)
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      addToast({ message: `Exported ${rowCount} score row${rowCount !== 1 ? 's' : ''}.`, type: 'success', duration: 3000 })
    } catch (err) {
      addToast({ message: `Failed to export Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error', duration: 5000 })
    } finally {
      setIsExporting(false)
    }
  }, [players.length, sortedPlayers, tournament, selectedSquad, addToast])

  const handleImportScoresFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isScoresLocked) {
      addToast({ message: 'Scores are locked. Unlock scores to import changes.', type: 'warning', duration: 3000 })
      e.target.value = ''
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const token = sessionToken
      const tournamentId = getSelectedTournamentId()
      const squad = selectedSquadRef.current
      if (!token || !tournamentId || !squad) {
        addToast({ message: 'Select a tournament and squad before importing scores.', type: 'error', duration: 4000 })
        return
      }

      const parsedRows = await parseScoresExcelFile(file)
      if (parsedRows.length === 0) {
        addToast({ message: 'No score rows found in file.', type: 'warning', duration: 3000 })
        return
      }

      const byId = new Map(playersRef.current.map(player => [player.id, player]))
      const byName = new Map(
        playersRef.current.map(player => [
          `${(player.firstName || '').trim().toLowerCase()}|${(player.lastName || '').trim().toLowerCase()}`,
          player,
        ])
      )

      const matched: Array<{ player: Player; scores: { game1_scratch?: number; game2_scratch?: number; game3_scratch?: number } }> = []
      let skipped = 0

      parsedRows.forEach(row => {
        const hasAnyScore = row.game1_scratch !== undefined || row.game2_scratch !== undefined || row.game3_scratch !== undefined
        if (!hasAnyScore) return

        let target: Player | undefined
        if (row.playerId) target = byId.get(row.playerId)
        if (!target) {
          const key = `${row.firstName.trim().toLowerCase()}|${row.lastName.trim().toLowerCase()}`
          target = byName.get(key)
        }

        if (!target) {
          skipped += 1
          return
        }

        matched.push({
          player: target,
          scores: {
            game1_scratch: row.game1_scratch,
            game2_scratch: row.game2_scratch,
            game3_scratch: row.game3_scratch,
          }
        })
      })

      if (matched.length === 0) {
        addToast({ message: 'No matching players found for imported score rows.', type: 'warning', duration: 4000 })
        return
      }

      const scoreMap = new Map(matched.map(item => [item.player.id, item.scores]))
      setPlayers(prev => prev.map(player => {
        const imported = scoreMap.get(player.id)
        if (!imported) return player
        const g1 = imported.game1_scratch
        const g2 = imported.game2_scratch
        const g3 = imported.game3_scratch
        return {
          ...player,
          scores: {
            ...player.scores,
            game1_scratch: g1,
            game1_with_handicap: g1 !== undefined ? g1 + (player.handicap || 0) : undefined,
            game2_scratch: g2,
            game2_with_handicap: g2 !== undefined ? g2 + (player.handicap || 0) : undefined,
            game3_scratch: g3,
            game3_with_handicap: g3 !== undefined ? g3 + (player.handicap || 0) : undefined,
          }
        }
      }))

      const persistResults = await Promise.allSettled(
        matched.map(item => apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            player_id: item.player.id,
            tournament_id: parseInt(tournamentId, 10),
            squad_id: squad.id,
            game1_scratch: item.scores.game1_scratch,
            game2_scratch: item.scores.game2_scratch,
            game3_scratch: item.scores.game3_scratch,
          })
        }))
      )

      const persisted = persistResults.filter(result => result.status === 'fulfilled' && result.value.ok).length
      const failed = matched.length - persisted
      addToast({
        message: `Imported ${persisted} player score${persisted !== 1 ? 's' : ''}.` +
          (failed > 0 ? ` ${failed} failed to save.` : '') +
          (skipped > 0 ? ` ${skipped} row${skipped !== 1 ? 's' : ''} skipped (no player match).` : ''),
        type: failed > 0 ? 'warning' : 'success',
        duration: 5000
      })
    } catch (err) {
      addToast({ message: `Failed to import Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error', duration: 5000 })
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }, [addToast, isScoresLocked, sessionToken])

  // Header configuration
  const clearGameScores = useCallback(async (gameNumber: 2 | 3) => {
    if (!tournament?.id) {
      addToast({ type: 'error', message: 'No tournament selected.', duration: 3000 })
      return
    }

    const token = sessionToken
    if (!token) {
      addToast({ type: 'error', message: 'Your session expired. Please log in again.', duration: 4000 })
      return
    }

    const squadId = selectedSquad?.id ?? getSelectedSquadId()
    if (!squadId) {
      addToast({ type: 'error', message: 'No squad selected.', duration: 3000 })
      return
    }

    const playersWithScores = players.filter(player => player.scores)
    if (playersWithScores.length === 0) {
      addToast({ type: 'warning', message: `No Game ${gameNumber} scores found to clear.`, duration: 3000 })
      return
    }

    const clearResults = await Promise.allSettled(
      playersWithScores.map(player => apiFetch(API('/api/v1/scores/'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: player.id,
          tournament_id: tournament.id,
          squad_id: squadId,
          game1_scratch: player.scores?.game1_scratch ?? null,
          game2_scratch: gameNumber === 2 ? null : (player.scores?.game2_scratch ?? null),
          game3_scratch: gameNumber === 3 ? null : (player.scores?.game3_scratch ?? null),
        }),
      })),
    )

    const successful = clearResults.filter(
      result => result.status === 'fulfilled' && result.value.ok,
    ).length

    if (successful > 0) {
      setPlayers(prev => prev.map(player => ({
        ...player,
        scores: player.scores
          ? {
              ...player.scores,
              [`game${gameNumber}_scratch`]: undefined,
              [`game${gameNumber}_with_handicap`]: undefined,
            }
          : player.scores,
      })))
    }

    const failed = playersWithScores.length - successful
    if (failed > 0 && successful === 0) {
      addToast({ type: 'error', message: `Failed to clear Game ${gameNumber} scores.`, duration: 4000 })
      return
    }

    addToast({
      type: failed > 0 ? 'warning' : 'success',
      message: failed > 0
        ? `Cleared Game ${gameNumber} for ${successful} players. ${failed} failed.`
        : `Cleared Game ${gameNumber} scores for ${successful} players.`,
      duration: 3500,
    })
  }, [tournament, selectedSquad, addToast, sessionToken, players])

  const requestClearGame = useCallback((gameNumber: 2 | 3) => {
    setClearGameConfirm(gameNumber)
  }, [])

  // fetchPlayersWithScores must be defined before the useEffect that calls it
  // (and before any early-return guards) so the closure captures it properly.
  const fetchPlayersWithScores = useCallback(async (tournamentId: string, squadId: number | null, token: string) => {
    try {
      const bowlersUrl = squadId
        ? `/api/v1/bowlers?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/bowlers?tournament_id=${tournamentId}`

      // Fire bowlers and scores in parallel; scores don't depend on bowlers.
      const scoresUrl = squadId
        ? `/api/v1/scores/?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/scores/?tournament_id=${tournamentId}`
      const [bowlersResponse, scoresResponse] = await Promise.all([
        apiFetch(API(bowlersUrl), { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch(API(scoresUrl), { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (!bowlersResponse.ok) {
        let bowlersBody = ''
        try {
          bowlersBody = await bowlersResponse.text()
        } catch {
          bowlersBody = ''
        }
        logger.error('Bowlers API request failed', {
          url: API(bowlersUrl),
          status: bowlersResponse.status,
          body: bowlersBody.slice(0, 500),
        })
      }

      if (!scoresResponse.ok) {
        let scoresBody = ''
        try {
          scoresBody = await scoresResponse.text()
        } catch {
          scoresBody = ''
        }
        logger.error('Scores API request failed', {
          url: API(scoresUrl),
          status: scoresResponse.status,
          body: scoresBody.slice(0, 500),
        })
      }

      let data = bowlersResponse.ok ? await bowlersResponse.json() : []

      // Fallback: if squad-filtered fetch returns no results, load all tournament players.
      // Players added without a squad selection have squad_id = null and won't match the squad filter.
      if (squadId && data.length === 0) {
        const fallbackResponse = await apiFetch(API(`/api/v1/bowlers?tournament_id=${tournamentId}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (fallbackResponse.ok) {
          data = await fallbackResponse.json()
        }
      }

      const scoresData = scoresResponse.ok ? await scoresResponse.json() : []

      // Create a lookup map for scores by player_id
      const scoresMap = new Map()
      scoresData.forEach((score: ScoreData) => {
        scoresMap.set(score.player_id, {
          game1_scratch: score.game1_scratch,
          game1_with_handicap: score.game1_with_handicap,
          game2_scratch: score.game2_scratch,
          game2_with_handicap: score.game2_with_handicap,
          game3_scratch: score.game3_scratch,
          game3_with_handicap: score.game3_with_handicap
        })
      })

      // Transform API player data to match the local score-entry structure
      const transformedData = (data || []).map((playerRecord: Player & { full_name?: string; handicap_pins?: number }) => {
        const fullName = playerRecord.fullName || playerRecord.full_name || ''
        const nameParts = fullName.split(' ')
        const existingScores = scoresMap.get(playerRecord.id) || {
          game1_scratch: undefined,
          game1_with_handicap: undefined,
          game2_scratch: undefined,
          game2_with_handicap: undefined,
          game3_scratch: undefined,
          game3_with_handicap: undefined
        }

        return {
          id: playerRecord.id,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          handicap: playerRecord.handicapPins || playerRecord.handicap_pins || 0,
          average: playerRecord.average || 0,
          lane: playerRecord.lane || null,
          scores: existingScores
        }
      })

      // Sort players by lane (players with lanes first, sorted numerically, then players without lanes)
      const sortedData = transformedData.sort((a: Player, b: Player) => {
        // If both have lanes, sort numerically
        if (a.lane && b.lane) {
          return parseInt(a.lane.toString()) - parseInt(b.lane.toString())
        }
        // If only a has a lane, a comes first
        if (a.lane && !b.lane) {
          return -1
        }
        // If only b has a lane, b comes first
        if (!a.lane && b.lane) {
          return 1
        }
        // If neither has a lane, maintain original order (sort by name as fallback)
        return a.lastName.localeCompare(b.lastName)
      })

      setPlayers(sortedData)
    } catch (err) {
      logger.error('Error fetching players:', err)
      setPlayers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch tournament, squad, and players data - OPTIMIZED WITH PARALLEL REQUESTS
  useEffect(() => {
    // Batch read all localStorage data at once for better performance
    const { lastTournamentId, token } = (() => {
      if (typeof window === 'undefined') return { lastTournamentId: null, token: null };
      return {
        lastTournamentId: getSelectedTournamentId(),
        token: sessionToken,
      };
    })();

    if (lastTournamentId && token) {
      setIsLoading(true)
      const bootstrapStarted = performance.now()

      apiClient.get<TournamentBootstrapResponse>(`/api/v1/tournaments/bootstrap?tournament_id=${lastTournamentId}`, false)
        .then((bootstrap) => {
          const tournamentData = bootstrap?.tournament ?? null
          const squadsData = bootstrap?.squads ?? []
          const selectedSquadData = bootstrap?.selected_squad ?? null

          // Set tournament data
          if (tournamentData) setTournament(tournamentData)

          // Determine which squad to use
          let squadToUse: Squad | null = null
          if (selectedSquadData && selectedSquadData.squad_id) {
            squadToUse = squadsData.find((s: Squad) => s.id === selectedSquadData.squad_id) || null
          }
          // Fallback to localStorage selected_squad_id
          if (!squadToUse) {
            const storedSquadId = getSelectedSquadId()
            if (storedSquadId) {
              squadToUse = squadsData.find((s: Squad) => s.id === parseInt(storedSquadId)) || null
            }
          }
          // Final fallback: use the first available squad
          if (!squadToUse && squadsData.length > 0) {
            squadToUse = squadsData[0] ?? null
          }
          setSelectedSquad(squadToUse)
          // Persist resolved squad to localStorage so guards and other pages see it consistently
          if (squadToUse && !getSelectedSquadId()) {
            persistSelectedSquad(squadToUse.id)
          }

          logger.info('Scores bootstrap load completed', {
            tournamentId: Number(lastTournamentId),
            durationMs: Math.round((performance.now() - bootstrapStarted) * 100) / 100,
            squadsCount: squadsData.length,
            hasSelectedSquad: Boolean(selectedSquadData?.squad_id),
          })

          // Fetch players with scores for the selected squad (or all if no squad)
          fetchPlayersWithScores(lastTournamentId, squadToUse?.id || null, token)
        })
        .catch(err => {
          logger.error('Error fetching initial data:', err)
          setIsLoading(false)
        })
    } else {
      // No tournament loaded, stop loading immediately
      setIsLoading(false)
    }
  }, [fetchPlayersWithScores, sessionToken, selectionRefreshKey])

  useEffect(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null
    const lockKey = getScoresLockKey(tournamentId, squadId)

    if (!lockKey) {
      setIsScoresLocked(false)
      return
    }

    setIsScoresLocked(storage.getItem(lockKey) === '1')
  }, [selectedSquad, tournament])

  const validateScore = (score: number | undefined) => {
    if (score === undefined || score === null) return { isValid: true, message: '' }
    if (score < 0) return { isValid: false, message: 'Score cannot be negative' }
    if (score > 300) return { isValid: false, message: 'Score cannot exceed 300' }
    return { isValid: true, message: '' }
  }

  const getScoreInputClass = (score: number | undefined) => {
    const validation = validateScore(score)
    if (!validation.isValid) return 'score-input invalid'
    if (score === 300) return 'score-input perfect'
    return 'score-input'
  }

  useEffect(() => {
    const pendingMap = debouncedSavesRef.current
    return () => {
      pendingMap.forEach(timeoutId => clearTimeout(timeoutId))
      pendingMap.clear()
    }
  }, [])

  const markRowSaved = useCallback((playerId: number) => {
    setRowSaveState(prev => ({ ...prev, [playerId]: 'saved' }))
    window.setTimeout(() => {
      setRowSaveState(prev => (prev[playerId] === 'saved' ? { ...prev, [playerId]: 'idle' } : prev))
    }, 1400)
  }, [])

  const focusNextMobileInput = useCallback((playerId: number, field: string) => {
    const fields = ['game1_scratch', 'game2_scratch', 'game3_scratch']
    const currentFieldIndex = fields.indexOf(field)
    const currentPlayerIndex = paginationHook.paginatedItems.findIndex(player => player.id === playerId)

    let nextField: string | null = null
    let nextPlayerId: number | null = null

    if (currentFieldIndex < fields.length - 1) {
      nextField = fields[currentFieldIndex + 1] ?? null
      nextPlayerId = playerId
    } else if (currentPlayerIndex >= 0 && currentPlayerIndex < paginationHook.paginatedItems.length - 1) {
      nextField = fields[0] ?? null
      nextPlayerId = paginationHook.paginatedItems[currentPlayerIndex + 1]?.id ?? null
    }

    if (!nextField || !nextPlayerId) return
    const target = document.querySelector(`input[data-mobile-player="${nextPlayerId}"][data-mobile-field="${nextField}"]`) as HTMLInputElement | null
    if (target) {
      target.focus()
      target.select()
    }
  }, [paginationHook.paginatedItems])

  const updateScore = useCallback(async (
    playerId: number,
    field: string,
    value: number | undefined,
    options: { trackHistory?: boolean; moveNextOnMobile?: boolean } = {}
  ) => {
    const { trackHistory = true, moveNextOnMobile = false } = options

    if (isScoresLocked) {
      addToast({ message: 'Scores are locked. Unlock scores to edit.', type: 'warning', duration: 2500 })
      return
    }

    const saveKey = `${playerId}-${field}`

    if (value !== undefined && (value < 0 || value > 300)) {
      addToast({
        message: `Invalid score: ${value}. Scores must be between 0 and 300.`,
        type: 'error',
        duration: 4000
      })
      return
    }

    if (trackHistory) {
      const previousValue = (playersRef.current.find(player => player.id === playerId)?.scores as Record<string, number | undefined> | undefined)?.[field]
      setLastEdit({ playerId, field, previous: previousValue })
    }

    setRowSaveState(prev => ({ ...prev, [playerId]: 'saving' }))

    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        const updatedPlayer = {
          ...player,
          scores: {
            ...player.scores,
            [field]: value
          }
        }

        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = player.handicap || 0
          const totalScore = scratchScore + handicap
          updatedPlayer.scores![`game${gameNum}_total` as keyof typeof updatedPlayer.scores] = totalScore
        }

        return updatedPlayer
      }
      return player
    }))

    if (isMobile && moveNextOnMobile) {
      window.setTimeout(() => focusNextMobileInput(playerId, field), 0)
    }

    const existingTimeout = debouncedSavesRef.current.get(saveKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeoutId = setTimeout(async () => {
      try {
        const token = sessionToken
        const tournamentId = getSelectedTournamentId()

        if (!token || !tournamentId || !selectedSquadRef.current) {
          setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
          return
        }

        const player = playersRef.current.find(playerItem => playerItem.id === playerId)
        if (!player) {
          setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
          return
        }

        const updatedScores = { ...player.scores, [field]: value }
        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = player.handicap || 0
          const totalScore = scratchScore + handicap
          updatedScores[`game${gameNum}_with_handicap` as keyof typeof updatedScores] = totalScore
        }

        const scoreData = {
          player_id: playerId,
          tournament_id: parseInt(tournamentId),
          squad_id: selectedSquadRef.current.id,
          game1_scratch: updatedScores.game1_scratch ?? 0,
          game2_scratch: updatedScores.game2_scratch ?? 0,
          game3_scratch: updatedScores.game3_scratch ?? 0
        }

        if (!isOnline) {
          setPendingSaves(prev => [...prev, { authToken: token, data: scoreData }])
          localStorage.setItem(`pending_save_${Date.now()}`, JSON.stringify({ authToken: token, data: scoreData }))
          setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
          return
        }

        const response = await apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(scoreData)
        })

        if (response.ok) {
          markRowSaved(playerId)
          if (value === 300) {
            addToast({
              message: `Perfect game! 300 scored by ${player.firstName} ${player.lastName}`,
              type: 'success',
              duration: 5000
            })
          } else if (value && value >= 250) {
            addToast({
              message: `Excellent score: ${value} by ${player.firstName} ${player.lastName}`,
              type: 'success',
              duration: 3000
            })
          }
        } else {
          let errorBody = ''
          try {
            errorBody = await response.text()
          } catch {
            errorBody = ''
          }
          logger.error('Score save request failed', {
            url: API('/api/v1/scores/'),
            playerId,
            status: response.status,
            body: errorBody.slice(0, 500),
          })
          throw new Error(`Save failed: ${response.status}`)
        }

      } catch (error) {
        logger.error('Failed to save score:', error)

        const currentPlayer = playersRef.current.find(playerItem => playerItem.id === playerId)
        setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
        addToast({
          message: `Failed to save score for ${currentPlayer?.firstName || 'player'} ${currentPlayer?.lastName || ''}. Please try again.`,
          type: 'error',
          duration: 5000
        })
      }

      debouncedSavesRef.current.delete(saveKey)
    }, 500)

    debouncedSavesRef.current.set(saveKey, timeoutId)
  }, [
    addToast,
    focusNextMobileInput,
    isMobile,
    isOnline,
    isScoresLocked,
    markRowSaved,
    playersRef,
    selectedSquadRef,
    setLastEdit,
    setPendingSaves,
    setPlayers,
    setRowSaveState,
    sessionToken,
  ])

  const retryPlayerSave = useCallback(async (player: Player) => {
    const token = sessionToken
    const tournamentId = getSelectedTournamentId()
    if (!token || !tournamentId || !selectedSquadRef.current) return

    setRowSaveState(prev => ({ ...prev, [player.id]: 'saving' }))
    try {
      const response = await apiFetch(API('/api/v1/scores/'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          player_id: player.id,
          tournament_id: parseInt(tournamentId, 10),
          squad_id: selectedSquadRef.current.id,
          game1_scratch: player.scores?.game1_scratch,
          game2_scratch: player.scores?.game2_scratch,
          game3_scratch: player.scores?.game3_scratch,
        })
      })

      if (!response.ok) {
        let errorBody = ''
        try {
          errorBody = await response.text()
        } catch {
          errorBody = ''
        }
        logger.error('Retry score save request failed', {
          url: API('/api/v1/scores/'),
          playerId: player.id,
          status: response.status,
          body: errorBody.slice(0, 500),
        })
        throw new Error(`Retry failed: ${response.status}`)
      }
      markRowSaved(player.id)
    } catch (error) {
      setRowSaveState(prev => ({ ...prev, [player.id]: 'failed' }))
      logger.error('Retry score save failed', { error, playerId: player.id })
    }
  }, [markRowSaved, sessionToken])

  const undoLastEdit = useCallback(() => {
    if (!lastEdit) return
    void updateScore(lastEdit.playerId, lastEdit.field, lastEdit.previous, { trackHistory: false, moveNextOnMobile: false })
    setLastEdit(null)
  }, [lastEdit, updateScore])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, playerId: number, field: string) => {
    if (isScoresLocked) {
      e.preventDefault()
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()

      const currentPlayerIndex = paginationHook.paginatedItems.findIndex(playerItem => playerItem.id === playerId)
      const fields = ['game1_scratch', 'game2_scratch', 'game3_scratch']
      const currentFieldIndex = fields.indexOf(field)

      let nextField: string | null = null
      let nextPlayerId: number | null = null

      if (currentFieldIndex < fields.length - 1) {
        nextField = fields[currentFieldIndex + 1] ?? null
        nextPlayerId = playerId
      } else if (currentPlayerIndex >= 0 && currentPlayerIndex < paginationHook.paginatedItems.length - 1) {
        nextField = fields[0] ?? null
        nextPlayerId = paginationHook.paginatedItems[currentPlayerIndex + 1]?.id ?? null
      }

      if (!nextField || !nextPlayerId) return

      const nextInput = document.querySelector(
        `input[data-player="${nextPlayerId}"][data-field="${nextField}"]`
      ) as HTMLInputElement | null

      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }
    }
  }, [isScoresLocked, paginationHook.paginatedItems])

  const rowStateCounts = useMemo(() => {
    const values = Object.values(rowSaveState)
    return {
      saving: values.filter(state => state === 'saving').length,
      failed: values.filter(state => state === 'failed').length,
    }
  }, [rowSaveState])

  const saveAllVisibleScores = useCallback(async () => {
    const token = sessionToken
    const tournamentId = getSelectedTournamentId()
    const squad = selectedSquadRef.current

    if (!token || !tournamentId || !squad || paginationHook.paginatedItems.length === 0) return

    paginationHook.paginatedItems.forEach(player => {
      setRowSaveState(prev => ({ ...prev, [player.id]: 'saving' }))
    })

    const results = await Promise.allSettled(
      paginationHook.paginatedItems.map(async player => {
        const response = await apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            player_id: player.id,
            tournament_id: parseInt(tournamentId, 10),
            squad_id: squad.id,
            game1_scratch: player.scores?.game1_scratch,
            game2_scratch: player.scores?.game2_scratch,
            game3_scratch: player.scores?.game3_scratch,
          })
        })

        if (!response.ok) throw new Error(`Save failed for ${player.id}`)
        markRowSaved(player.id)
      })
    )

    let failed = 0
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed += 1
        const playerId = paginationHook.paginatedItems[index]?.id
        if (playerId) {
          setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
        }
      }
    })

    if (failed > 0) {
      addToast({ message: `Saved with ${failed} failure${failed === 1 ? '' : 's'}.`, type: 'warning', duration: 3500 })
      return
    }

    addToast({ message: 'All visible scores saved.', type: 'success', duration: 2500 })
  }, [addToast, markRowSaved, paginationHook.paginatedItems, sessionToken])

  const markScoresComplete = useCallback(async () => {
    const tournamentId = tournament?.id
    const squadId = selectedSquad?.id ?? null

    if (tournamentId) {
      try {
        const url = squadId
          ? API(`/api/v1/brackets/status/${tournamentId}?squad_id=${squadId}`)
          : API(`/api/v1/brackets/status/${tournamentId}`)
        const resp = await apiFetch(url, { headers: { Authorization: `Bearer ${sessionToken}` } })
        if (resp.ok) {
          const statusData = await resp.json()
          if (statusData.entries_mismatch) {
            setShowBracketMismatchWarning(true)
            return
          }
        }
      } catch {
        // non-blocking: fall through to normal flow
      }
    }

    const missing = players
      .filter(player => hasMissingScore(player))
      .map(player => `${player.firstName} ${player.lastName}`.trim())
    setMissingScoreNames(missing)
    setShowCalcPayoutsConfirm(true)
  }, [hasMissingScore, players, tournament, selectedSquad, sessionToken])

  const scoresQuickActions = useMemo(() => (
    <QuickActions
      left={(
        <>
          <button
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
            onClick={() => setIsScoresGuideOpen(true)}
          >
            Scores Guide
          </button>

          <button
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
            onClick={handleExportScoresToExcel}
            disabled={isExporting || players.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </button>

          <button
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting || players.length === 0 || isScoresLocked}
          >
            {isImporting ? 'Importing...' : 'Import from Excel'}
          </button>

          {players.length > 0 && !isScoresLocked && (
            <button
              className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
              onClick={() => { void markScoresComplete() }}
            >
              Calculate Payouts
            </button>
          )}

          {players.length > 0 && isScoresLocked && (
            <button
              className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
              onClick={unlockScoresTable}
            >
              Unlock Scores
            </button>
          )}
        </>
      )}
      right={(
        <>
          {pendingSaves.length > 0 && (
            <EnhancedButton
              onClick={async () => {
                await processPendingSaves()
                addToast({
                  message: 'Sync completed!',
                  type: 'success',
                  duration: 3000
                })
              }}
              variant="primary"
              size="sm"
              className={`${cardStyles.quickActionControl} ${buttonStyles.quickAction}`}
            >
              Sync Offline Scores ({pendingSaves.length})
            </EnhancedButton>
          )}

          {(process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin) && players.length > 0 && (
            <>
              <span className={styles.quickActionAdminLabel}>Admin tools</span>
              <button className={`${cardStyles.quickActionControl} ${styles.adminButton} ${styles.quickActionAdminBtn}`} onClick={handleRandomizeScores} disabled={isScoresLocked}>Randomize Scores</button>
              <button className={`${cardStyles.quickActionControl} ${styles.adminButton} ${styles.quickActionAdminBtn}`} onClick={() => requestClearGame(2)} disabled={isScoresLocked}>Clear Game 2</button>
              <button className={`${cardStyles.quickActionControl} ${styles.adminButton} ${styles.quickActionAdminBtn}`} onClick={() => requestClearGame(3)} disabled={isScoresLocked}>Clear Game 3</button>
            </>
          )}
        </>
      )}
    />
  ), [players, handleRandomizeScores, requestClearGame, pendingSaves.length, addToast, processPendingSaves, handleExportScoresToExcel, isExporting, isImporting, isScoresLocked, unlockScoresTable, currentUser, markScoresComplete])

  usePageHeader({
    title: 'Scores',
    subtitle: undefined,
    actions: undefined
  })

  const getRowStateLabel = useCallback((playerId: number) => {
    const state = rowSaveState[playerId] || 'idle'
    if (state === 'saving') return 'Saving'
    if (state === 'saved') return 'Saved'
    if (state === 'failed') return 'Failed'
    return 'Ready'
  }, [rowSaveState])

  const showInitialScoresLoad = isLoading && players.length === 0

  // Auth guards (after all hooks)
  if (!isAuthInitialized) {
    return (
      <div className={styles.loadingState}>
        <div>Loading score management...</div>
      </div>
    )
  }

  if (!isUserAuthenticated && !hasStoredAuth) {
    return (
      <div className={styles.authRequired}>
        <div>Please log in to access score management</div>
      </div>
    )
  }

  if (!isUserAuthenticated && hasStoredAuth) {
    return (
      <div className={styles.authRequired}>
        <div>Loading score management...</div>
      </div>
    )
  }

  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
    return (
      <NoTournamentState
        title="Scoring Console Waiting"
        description="Load a tournament to start entering game scores, validating round totals, and keeping standings current."
        cards={[
          { title: 'Capture Results Fast', text: 'Record each game directly in the score sheet for fast lane-side updates.' },
          { title: 'Stay Continuously Saved', text: 'Edits save as you type, so your progress stays protected between updates.' },
          { title: 'Find Bowlers Quickly', text: 'Sort and filter by name, average, or score to correct and confirm entries quickly.' },
        ]}
      />
    )
  }

  if (!showInitialScoresLoad && typeof window !== 'undefined' && !getSelectedSquadId() && !selectedSquad) {
    return (
      <NoTournamentState
        title="Scores Need a Squad"
        description="Select a squad from the dashboard to open scoring for that session."
        cards={[
          { title: 'Open the Right Session', text: 'Choose the squad first, then enter game-by-game scores for its bowlers.' },
        ]}
      />
    )
  }

  return (
    <ErrorBoundary>
      <>
      <ActionConfirmDialog
        open={clearGameConfirm !== null}
        title="Clear Game Scores?"
        message={clearGameConfirm !== null ? `Clear all Game ${clearGameConfirm} scores for this tournament/squad? This cannot be undone.` : ''}
        confirmLabel="Clear Scores"
        cancelLabel="Cancel"
        onCancel={() => setClearGameConfirm(null)}
        onConfirm={() => {
          if (clearGameConfirm !== null) {
            void clearGameScores(clearGameConfirm)
          }
          setClearGameConfirm(null)
        }}
      />
      {/* Calculate Payouts confirmation modal */}
      {showCalcPayoutsConfirm && (
        <div className="bw-scores-calc-overlay">
          <div className="bw-scores-calc-modal bw-scores-calc-modal-brand">
            {missingScoreNames.length > 0 ? (
              <>
                <div className="bw-scores-calc-head bw-scores-calc-head-brand">
                  <h2 className="bw-scores-calc-title bw-scores-calc-title-warning">Missing Scores</h2>
                </div>
                <p className="bw-scores-calc-text bw-scores-calc-text-tight">
                  The following {missingScoreNames.length === 1 ? 'bowler is' : `${missingScoreNames.length} bowlers are`} missing one or more game scores. All scores must be entered and finalized before calculating payouts to ensure accurate results.
                </p>
                <div className="bw-scores-calc-missing-list">
                  {missingScoreNames.map((name, i) => (
                    <div key={i} className={`bw-scores-calc-missing-item ${i < missingScoreNames.length - 1 ? 'bw-scores-calc-missing-item-border' : ''}`}>{name}</div>
                  ))}
                </div>
                <div className="bw-scores-calc-actions">
                  <button
                    className="bw-scores-calc-btn bw-scores-calc-btn-secondary"
                    onClick={() => setShowCalcPayoutsConfirm(false)}
                  >
                    Go Back &amp; Enter Scores
                  </button>
                  <button
                    className="bw-scores-calc-btn bw-scores-calc-btn-primary bw-scores-calc-btn-warning"
                    onClick={() => { setShowCalcPayoutsConfirm(false); unlockPayoutsAndGo() }}
                  >
                    Proceed Anyway
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bw-scores-calc-head bw-scores-calc-head-brand">
                  <h2 className="bw-scores-calc-title">All Scores Complete</h2>
                </div>
                <p className="bw-scores-calc-text">
                  All {players.length} bowler{players.length !== 1 ? 's' : ''} have scores for all 3 games. Confirm these scores are final before calculating payouts. Winners will be determined from these results.
                </p>
                <div className="bw-scores-calc-actions">
                  <button
                    className="bw-scores-calc-btn bw-scores-calc-btn-secondary"
                    onClick={() => setShowCalcPayoutsConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="bw-scores-calc-btn bw-scores-calc-btn-primary"
                    onClick={() => { setShowCalcPayoutsConfirm(false); unlockPayoutsAndGo() }}
                  >
                    Confirm &amp; Calculate Payouts
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Bracket mismatch warning modal */}
      {showBracketMismatchWarning && (
        <div className="bw-scores-calc-overlay">
          <div className="bw-scores-calc-modal bw-scores-calc-modal-brand">
            <div className="bw-scores-calc-head bw-scores-calc-head-brand">
              <h2 className="bw-scores-calc-title bw-scores-calc-title-warning">Brackets Out of Date</h2>
            </div>
            <p className="bw-scores-calc-text">
              Entries have changed since brackets were generated. Please go to the Brackets page and regenerate brackets before calculating payouts.
            </p>
            <div className="bw-scores-calc-actions">
              <button
                className="bw-scores-calc-btn bw-scores-calc-btn-secondary"
                onClick={() => setShowBracketMismatchWarning(false)}
              >
                Go Back
              </button>
              <button
                className="bw-scores-calc-btn bw-scores-calc-btn-primary"
                onClick={() => { setShowBracketMismatchWarning(false); router.push('/brackets') }}
              >
                Go to Brackets
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportScoresFileSelected}
        className="sr-only"
      />
      {isMobile ? (
        <MobileLayout padding="small" className={styles.mobileScoresLayoutShell}>
          <div className={styles.mobileScoresPage}>
            {/* Sticky toolbar */}
            <div className={styles.mobileScoresToolbarSticky}>
              {/* Context: tournament + squad */}
              {tournament && (
                <div className={styles.mobileScoresContextCard}>
                  <span className={styles.mobileScoresContextTitle}>{tournament.name}</span>
                  {selectedSquad && (
                    <span className={styles.mobileScoresContextMeta}>
                      Squad: {selectedSquad.date} - {selectedSquad.time}
                    </span>
                  )}
                </div>
              )}

              {/* Save status bar */}
              <div className={styles.mobileSaveBar}>
                {rowStateCounts.saving > 0 && <span>Saving {rowStateCounts.saving}...</span>}
                {rowStateCounts.saving === 0 && rowStateCounts.failed === 0 && <span>Auto-save on</span>}
                {rowStateCounts.failed > 0 && <span>{rowStateCounts.failed} failed</span>}
                {lastEdit && (
                  <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.mobileUndoBtn}`} onClick={undoLastEdit}>Undo</button>
                )}
              </div>
            </div>

            {tournament && (
              <div className={`${cardStyles.card} ${cardStyles.accentCard} ${cardStyles.quickActionsCard} ${styles.mobileQuickActionsCard}`}>
                <h2 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle}`}>Quick Actions</h2>
                <div className={cardStyles.quickActionsBody}>
                  {scoresQuickActions}
                </div>
              </div>
            )}

            {/* No tournament state */}
            {!tournament && !isLoading && (
              <NoTournamentState
                description="Load a tournament from the dashboard to enter game scores, review totals, and prepare payout calculations."
                cards={[
                  { title: 'Score Entry', text: 'Record each bowler\'s game scores with totals calculated as you work.' },
                  { title: 'Auto-Save', text: 'Changes save in the background so live scoring stays focused and fast.' },
                  { title: 'Payout Ready', text: 'Use completed scores to unlock payout review when the squad is finalized.' },
                ]}
              />
            )}

            {/* Loading */}
            {showInitialScoresLoad && (
              <div className={styles.mobileLoadingWrap}>
                <Spinner size="lg" />
              </div>
            )}

            {/* Player score cards */}
            {!showInitialScoresLoad && paginationHook.paginatedItems.length > 0 && (
              <div className={styles.mobileScoreList}>
                {paginationHook.paginatedItems.map((player: Player) => {
                  const isExpanded = !!mobileExpandedPlayers[player.id]
                  const saveState = rowSaveState[player.id] || 'idle'
                  const hasFailed = saveState === 'failed'
                  const saveLabel = saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : saveState === 'failed' ? 'Failed' : ''
                  const pilotClass = saveState === 'saving' ? styles.mobileSaveStateSaving : saveState === 'saved' ? styles.mobileSaveStateSaved : saveState === 'failed' ? styles.mobileSaveStateFailed : styles.mobileSaveStateIdle

                  return (
                    <div key={player.id} className={styles.mobileScoreCard}>
                      {/* Card header; tap to expand */}
                      <div
                        className={styles.mobileScoreCardHeader}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setMobileExpandedPlayers(prev => ({ ...prev, [player.id]: !prev[player.id] }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setMobileExpandedPlayers(prev => ({ ...prev, [player.id]: !prev[player.id] }))
                          }
                        }}
                      >
                        <div className={styles.mobileScoreIdentity}>
                          <div className={styles.mobileScoreName}>
                            {player.firstName} {player.lastName}
                          </div>
                          <div className={styles.mobileScoreMeta}>
                            {player.lane ? `Lane ${player.lane} | ` : ''}Avg: {player.average} | HDCP: {player.handicap}
                          </div>
                        </div>
                        <div className={styles.mobileScoreHeaderRight}>
                          {saveLabel && (
                            <span className={`${styles.mobileSaveStatePill} ${pilotClass}`}>{saveLabel}</span>
                          )}
                          <span className={styles.mobileScoreTotal}>
                            {calculateDisplayTotal(player)}
                          </span>
                          <span className={styles.mobileExpandGlyph}>{isExpanded ? '^' : 'v'}</span>
                        </div>
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className={styles.mobileScoreCardBody}>
                          {/* Context chips */}
                          <div className={styles.mobileContextChips}>
                            <span className={styles.mobileContextChip}>
                              Scratch: {calculateTotalScratch(player)}
                            </span>
                            <span className={styles.mobileContextChip}>
                              Total: {calculateTotalWithHandicap(player)}
                            </span>
                          </div>

                          {/* Score inputs */}
                          <div className={styles.mobileGameInputGrid}>
                            {[1, 2, 3].map(gameNum => {
                              const fieldKey = `game${gameNum}_scratch` as keyof typeof player.scores
                              const scratch = player.scores?.[fieldKey] as number | undefined
                              return (
                                <div key={gameNum} className={styles.mobileGameInputField}>
                                  <span>G{gameNum}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="300"
                                    inputMode="numeric"
                                    disabled={isScoresLocked}
                                    placeholder=""
                                    data-mobile-player={player.id}
                                    data-mobile-field={`game${gameNum}_scratch`}
                                    className={styles.mobileScoreInput}
                                    value={scratch ?? ''}
                                    onChange={e => updateScore(player.id, `game${gameNum}_scratch`, parseInt(e.target.value) || 0)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        focusNextMobileInput(player.id, `game${gameNum}_scratch`)
                                      }
                                    }}
                                  />
                                  <span className={styles.mobileGameTotal}>{getGameTotal(scratch, player.handicap)}</span>
                                </div>
                              )
                            })}
                          </div>

                          {/* Retry on failure */}
                          {hasFailed && (
                            <button
                              className={styles.mobileRetryBtn}
                              onClick={() => saveAllVisibleScores()}
                            >
                              Retry Save
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {!showInitialScoresLoad && paginationHook.totalPages > 1 && (
              <div className={styles.mobilePaginationWrap}>
                <Pagination
                  currentPage={paginationHook.currentPage}
                  totalPages={paginationHook.totalPages}
                  onPageChange={paginationHook.goToPage}
                />
              </div>
            )}

          </div>
        </MobileLayout>
      ) : (
        // Desktop Layout
      <div ref={desktopContainerRef} className={`${shellStyles.page} ${styles.desktopContainer}`}>

          {/* No Tournament State - Desktop */}
          {!tournament && !showInitialScoresLoad && (
            <NoTournamentState
              description="Load a tournament from the dashboard before entering scores. Once loaded, this page becomes the live scoring workspace for the selected squad."
              cards={[
                { title: 'Enter Games', text: 'Record scratch scores for each game and review handicap-adjusted totals.' },
                { title: 'Live Save Status', text: 'See when rows are saving, saved, or need attention during score entry.' },
                { title: 'Calculate Payouts', text: 'Finalize scores and move directly into payout review when the squad is complete.' },
              ]}
            />
          )}

          {/* Offline Indicator */}
          {!isOnline && (
            <div className="notification notification-warning">
              <div className="offline-indicator">
                <span></span>
                <span>You are offline. Scores are being saved locally and will sync when connection is restored.</span>
                {pendingSaves.length > 0 && (
                  <span className="pending-count">
                    {pendingSaves.length} pending
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {showInitialScoresLoad && (
            <div className={styles.statusMessage}>
              Loading players and scores...
            </div>
          )}

          {tournament && (
            <>
            <div style={desktopTableDrivenCardStyle} className={`${cardStyles.card} ${cardStyles.accentCard} ${cardStyles.quickActionsCard} ${styles.desktopWidthLockedCard}`}>
              <h2 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle}`}>Quick Actions</h2>
              <div className={cardStyles.quickActionsBody}>
                {scoresQuickActions}
              </div>
            </div>


          {/* No Players State */}
          {!showInitialScoresLoad && players.length === 0 && tournament && (
            <div className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.emptyScoresState}`}>
              <div className={styles.emptyScoresAccentGlow} aria-hidden="true" />

              <div className={styles.emptyScoresBadge}>Tournament Ready</div>

              <div className={styles.emptyScoresHeroRow}>
                <div className={styles.emptyScoresIconContainer}>
                  <div className={styles.emptyScoresIcon}>
                    <svg viewBox="0 0 100 100" className={styles.emptyScoresIconSvg} aria-hidden="true">
                      <rect x="18" y="18" width="64" height="64" rx="8" ry="8" fill="none" stroke="currentColor" strokeWidth="4" />
                      <line x1="30" y1="38" x2="70" y2="38" stroke="currentColor" strokeWidth="4" />
                      <line x1="30" y1="54" x2="70" y2="54" stroke="currentColor" strokeWidth="4" />
                      <line x1="30" y1="70" x2="55" y2="70" stroke="currentColor" strokeWidth="4" />
                    </svg>
                  </div>
                </div>

                <div>
                  <h2 className={styles.emptyScoresTitle}>No players loaded for this squad yet</h2>
                  <p className={styles.emptyScoresText}>
                    Scores will appear here once entries have been added for the selected tournament and squad. Start by loading players into Entries, then come back here to enter game scores.
                  </p>
                </div>
              </div>

              <div className={styles.emptyScoresActions}>
                <Link href="/players" className={`${styles.emptyScoresPrimaryAction} ${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}>
                  Go To Entries
                </Link>
                <Link href="/dashboard" className={`${styles.emptyScoresSecondaryAction} ${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}>
                  Back To Dashboard
                </Link>
              </div>

              <div className={styles.emptyScoresFeaturesGrid}>
                <div className={`${cardStyles.panel} ${styles.emptyScoresFeatureCard}`}>
                  <h3>Load Entries</h3>
                  <p>Add bowlers in Entries for the selected tournament and squad before entering any scores.</p>
                </div>
                <div className={`${cardStyles.panel} ${styles.emptyScoresFeatureCard}`}>
                  <h3>Enter Game Scores</h3>
                  <p>Capture game-by-game scratch scores and let handicap totals calculate automatically.</p>
                </div>
                <div className={`${cardStyles.panel} ${styles.emptyScoresFeatureCard}`}>
                  <h3>Track Results</h3>
                  <p>Sort and review totals quickly to prepare clean bracket seeding and payouts.</p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Scroll Hint */}
          {!showInitialScoresLoad && players.length > 0 && (
            <div className="mobile-scroll-hint">
              Scroll horizontally to see all score columns
            </div>
          )}

          {!showInitialScoresLoad && players.length > 0 && (
            <div style={desktopTableDrivenCardStyle} className={styles.desktopWidthLockedCard}>
              <SearchPanel
                className={styles.scoresSearchCard}
                title="Search Scores"
                useToolbar={false}
                left={(
                  <>
                    <input
                      type="text"
                      className={`${formStyles.search} ${formStyles.compactControl} ${styles.scoresSearchInput}`}
                      placeholder="First name"
                      value={searchFirstName}
                      onChange={(event) => setSearchFirstName(event.target.value)}
                    />
                    <input
                      type="text"
                      className={`${formStyles.search} ${formStyles.compactControl} ${styles.scoresSearchInput}`}
                      placeholder="Last name"
                      value={searchLastName}
                      onChange={(event) => setSearchLastName(event.target.value)}
                    />
                  </>
                )}
                right={(
                  <button
                    type="button"
                    className={styles.scoresSearchClear}
                    onClick={() => {
                      setSearchFirstName('')
                      setSearchLastName('')
                    }}
                  >
                    Clear
                  </button>
                )}
              />
            </div>
          )}

          {/* Scores Table */}
          {!showInitialScoresLoad && filteredPlayers.length > 0 && (
            <>
            {rowStateCounts.saving > 0 && (
              <div className={`table-save-status table-save-status--saving ${styles.tableSaveStatus}`}>Saving...</div>
            )}
            {rowStateCounts.saving === 0 && rowStateCounts.failed === 0 && Object.values(rowSaveState).some(s => s === 'saved') && (
              <div className={`table-save-status table-save-status--success ${styles.tableSaveStatus}`}>All scores saved</div>
            )}
            {rowStateCounts.failed > 0 && (
              <div className={`table-save-status table-save-status--error ${styles.tableSaveStatus}`}>Failed to save {rowStateCounts.failed} score{rowStateCounts.failed > 1 ? 's' : ''}</div>
            )}
            <div style={desktopTableDrivenCardStyle} className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.tableCard} ${styles.desktopWidthLockedCard}`}>
            <div className="entries-container">

              <table ref={desktopScoresTableRef} className={`${tableStyles.table} entries-table`} aria-label="Player Scores" onKeyDownCapture={handleTableArrowNavigation}>

            <thead>
              {selectedSquad && (
                <tr>
                  <td colSpan={8} className="squad-banner">
                    Scores · {selectedSquad.date} · {selectedSquad.time} Squad
                  </td>
                </tr>
              )}
              <tr className="entries-header-row">
                <SortableHeader column="firstName" sortConfig={sortConfig} onSort={handleSort}>
                  Bowler
                </SortableHeader>
                <SortableHeader column="lane" sortConfig={sortConfig} onSort={handleSort}>
                  Lane
                </SortableHeader>
                <SortableHeader column="average" sortConfig={sortConfig} onSort={handleSort}>
                  Avg
                </SortableHeader>
                <SortableHeader column="game1_scratch" sortConfig={sortConfig} onSort={handleSort}>
                  Game 1
                </SortableHeader>
                <SortableHeader column="game2_scratch" sortConfig={sortConfig} onSort={handleSort}>
                  Game 2
                </SortableHeader>
                <SortableHeader column="game3_scratch" sortConfig={sortConfig} onSort={handleSort}>
                  Game 3
                </SortableHeader>
                <SortableHeader column="totalScratch" sortConfig={sortConfig} onSort={handleSort}>
                  Scratch<br/>Total
                </SortableHeader>
                <SortableHeader column="totalWithHandicap" sortConfig={sortConfig} onSort={handleSort}>
                  Final<br/>Total
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {paginationHook.paginatedItems.map((player: Player, index: number) => (
                <tr key={player.id} className={`scores-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                  <td className="scores-cell name">{player.firstName} {player.lastName}</td>
                  <td className={`scores-cell lane ${!player.lane ? 'lane-empty' : ''}`}>{player.lane || ''}</td>
                  <td className="scores-cell average">{player.average}</td>

                  {/* Game 1 */}
                  <td className="scores-cell scores-cell--game">
                    <div className="game-cell-wrap">
                      <div className="pos-relative inline-block">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          placeholder=""
                          data-player={player.id}
                          data-field="game1_scratch"
                          value={player.scores?.game1_scratch ?? ''}
                          onChange={changeEvent => updateScore(player.id, 'game1_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                          onKeyDown={keyEvent => handleKeyDown(keyEvent, player.id, 'game1_scratch')}
                          disabled={isScoresLocked}
                          className={getScoreInputClass(player.scores?.game1_scratch)}
                          onFocus={(changeEvent) => changeEvent.target.select()}
                          title={!validateScore(player.scores?.game1_scratch).isValid ? validateScore(player.scores?.game1_scratch).message : ''}
                        />
                      </div>
                      <div className="game-hcap-total">{getGameTotal(player.scores?.game1_scratch, player.handicap)}</div>
                    </div>
                  </td>

                  {/* Game 2 */}
                  <td className="scores-cell scores-cell--game">
                    <div className="game-cell-wrap">
                      <div className="pos-relative inline-block">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          placeholder=""
                          data-player={player.id}
                          data-field="game2_scratch"
                          value={player.scores?.game2_scratch ?? ''}
                          onChange={changeEvent => updateScore(player.id, 'game2_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                          onKeyDown={keyEvent => handleKeyDown(keyEvent, player.id, 'game2_scratch')}
                          disabled={isScoresLocked}
                          className={getScoreInputClass(player.scores?.game2_scratch)}
                          onFocus={(changeEvent) => changeEvent.target.select()}
                          title={!validateScore(player.scores?.game2_scratch).isValid ? validateScore(player.scores?.game2_scratch).message : ''}
                        />
                      </div>
                      <div className="game-hcap-total">{getGameTotal(player.scores?.game2_scratch, player.handicap)}</div>
                    </div>
                  </td>

                  {/* Game 3 */}
                  <td className="scores-cell scores-cell--game">
                    <div className="game-cell-wrap">
                      <div className="pos-relative inline-block">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          placeholder=""
                          data-player={player.id}
                          data-field="game3_scratch"
                          value={player.scores?.game3_scratch ?? ''}
                          onChange={changeEvent => updateScore(player.id, 'game3_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                          onKeyDown={keyEvent => handleKeyDown(keyEvent, player.id, 'game3_scratch')}
                          disabled={isScoresLocked}
                          className={getScoreInputClass(player.scores?.game3_scratch)}
                          onFocus={(changeEvent) => changeEvent.target.select()}
                          title={!validateScore(player.scores?.game3_scratch).isValid ? validateScore(player.scores?.game3_scratch).message : ''}
                        />
                      </div>
                      <div className="game-hcap-total">{getGameTotal(player.scores?.game3_scratch, player.handicap)}</div>
                    </div>
                  </td>

                  {/* Total Scratch */}
                  <td className="scores-cell total-scratch">
                    {calculateTotalScratch(player) || ''}
                  </td>

                  {/* Total */}
                  <td className="scores-cell total-final">
                    {calculateDisplayTotal(player)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
            </>
        )}
          </>
          )}

        {!showInitialScoresLoad && players.length > 0 && filteredPlayers.length === 0 && (
          <div className={styles.statusMessage}>
            No players match the current first/last name search.
          </div>
        )}

        {/* Pagination Controls */}
        {paginationHook.totalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <div className={styles.paginationInfo}>
              <span>
                Showing {((paginationHook.currentPage - 1) * 50) + 1} to{' '}
                {Math.min(paginationHook.currentPage * 50, filteredPlayers.length)} of{' '}
                {filteredPlayers.length} players
              </span>
            </div>

            <Pagination
              currentPage={paginationHook.currentPage}
              totalPages={paginationHook.totalPages}
              onPageChange={paginationHook.goToPage}
              itemsPerPage={20}
              totalItems={filteredPlayers.length}
              showItemCount={false}
              showPageSize={false}
            />
          </div>
        )}
        </div>
      )}

      <ExplainScoresModal
        isOpen={isScoresGuideOpen}
        onClose={() => setIsScoresGuideOpen(false)}
      />
    </>
    </ErrorBoundary>
  )
}
