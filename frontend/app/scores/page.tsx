'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tournament, Squad, Player, ScoreData, PendingScoreSave } from '../lib/types'
import { SortConfig, SortableScoreColumn } from './types'
import { SortableHeader } from './components/SortableHeader'

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
import { useToast } from '../components/Toast'
import { usePagination, Pagination } from '../components/Performance'
import { useAutoSave } from '../components/DataManagement'
import NoTournamentState from '../components/NoTournamentState'
import { logger } from '../lib/logger';
import { handleTableArrowNavigation } from '../lib/tableKeyboard'
import { getSelectedSquadId, getSelectedTournamentId, setSelectedSquad as persistSelectedSquad } from '../lib/selection-session'
import { storage } from '../lib/storage'


type TournamentBootstrapResponse = {
  tournament: Tournament | null;
  squads: Squad[];
  selected_squad: { squad_id: number } | null;
};



export default function ScoresPage() {
  // Authentication check - must be at the top
  const { isAuthenticated, isInitialized, token: authToken, currentUser } = useAuth();

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuth = typeof window !== 'undefined' && 
    localStorage.getItem('token') && 
    localStorage.getItem('user_id');

  const router = useRouter()
  const [showCalcPayoutsConfirm, setShowCalcPayoutsConfirm] = useState(false)
  const [missingScoreNames, setMissingScoreNames] = useState<string[]>([])
  const [clearGameConfirm, setClearGameConfirm] = useState<2 | 3 | null>(null)

  const [players, setPlayers] = useState<Player[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSaves, setPendingSaves] = useState<PendingScoreSave[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isScoresLocked, setIsScoresLocked] = useState(false)
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')
  const [mobileSelectedGame, setMobileSelectedGame] = useState<1 | 2 | 3 | 'all'>('all')
  const [mobileExpandedPlayers, setMobileExpandedPlayers] = useState<Record<number, boolean>>({})
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileFilterMode, setMobileFilterMode] = useState<'all' | 'missing' | 'review'>('all')
  const [rowSaveState, setRowSaveState] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'failed'>>({})
  const [lastEdit, setLastEdit] = useState<{ playerId: number; field: string; previous: number | undefined } | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const debouncedSavesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: null,
    direction: null
  })

  // Enhanced UX hooks
  const { addToast } = useToast()

  const getScopedPayoutUnlockKey = useCallback((tournamentId: number | null, squadId: number | null) => {
    if (!tournamentId) return null
    return `payouts_unlocked_${tournamentId}_${squadId ?? 'all'}`
  }, [])

  const getScopedScoresLockKey = useCallback((tournamentId: number | null, squadId: number | null) => {
    if (!tournamentId) return null
    return `scores_locked_${tournamentId}_${squadId ?? 'all'}`
  }, [])

  const unlockPayoutsAndGo = useCallback(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null

    if (tournamentId) {
      const unlockKey = getScopedPayoutUnlockKey(tournamentId, squadId)
      const lockKey = getScopedScoresLockKey(tournamentId, squadId)
      if (unlockKey) storage.setItem(unlockKey, '1')
      if (lockKey) storage.setItem(lockKey, '1')
      setIsScoresLocked(true)
    }

    sessionStorage.setItem('payouts_unlocked', '1')
    router.push('/payouts')
  }, [getScopedPayoutUnlockKey, getScopedScoresLockKey, router, selectedSquad, tournament])

  const unlockScoresTable = useCallback(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null
    if (!tournamentId) return

    const lockKey = getScopedScoresLockKey(tournamentId, squadId)
    const payoutKey = getScopedPayoutUnlockKey(tournamentId, squadId)

    if (lockKey) storage.removeItem(lockKey)
    if (payoutKey) storage.removeItem(payoutKey)
    sessionStorage.removeItem('payouts_unlocked')
    setIsScoresLocked(false)

    addToast({
      message: 'Scores unlocked. Payout access revoked until Calculate Payouts is clicked again.',
      type: 'success',
      duration: 4000,
    })
  }, [addToast, getScopedPayoutUnlockKey, getScopedScoresLockKey, selectedSquad, tournament])
  
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
      let aValue: any;
      let bValue: any;

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
          aValue = (a.scores?.game1_scratch || 0) + a.handicap;
          bValue = (b.scores?.game1_scratch || 0) + b.handicap;
          break;
        case 'game2_scratch':
          aValue = a.scores?.game2_scratch || 0;
          bValue = b.scores?.game2_scratch || 0;
          break;
        case 'game2_total':
          aValue = (a.scores?.game2_scratch || 0) + a.handicap;
          bValue = (b.scores?.game2_scratch || 0) + b.handicap;
          break;
        case 'game3_scratch':
          aValue = a.scores?.game3_scratch || 0;
          bValue = b.scores?.game3_scratch || 0;
          break;
        case 'game3_total':
          aValue = (a.scores?.game3_scratch || 0) + a.handicap;
          bValue = (b.scores?.game3_scratch || 0) + b.handicap;
          break;
        case 'totalScratch':
          aValue = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0);
          bValue = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0);
          break;
        case 'totalWithHandicap':
          const aScratch = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0);
          const bScratch = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0);
          aValue = aScratch + (a.handicap * 3);
          bValue = bScratch + (b.handicap * 3);
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

  const mobilePlayers = useMemo(() => {
    if (mobileFilterMode === 'missing') {
      return filteredPlayers.filter(hasMissingScore)
    }
    if (mobileFilterMode === 'review') {
      return filteredPlayers.filter(needsReviewScore)
    }
    return filteredPlayers
  }, [filteredPlayers, hasMissingScore, mobileFilterMode, needsReviewScore])

  const visiblePlayers = isMobile ? mobilePlayers : filteredPlayers
  
  // Pagination for large player lists (use sorted players)
  const paginationHook = usePagination({
    items: visiblePlayers,
    itemsPerPage: 50,
    resetOnItemsChange: false
  })

  useEffect(() => {
    paginationHook.goToPage(1)
  }, [searchFirstName, searchLastName, mobileFilterMode, isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable reference for auto-save — only changes when scores actually change
  const autoSaveData = useMemo(
    () => ({ scores: players.map(player => player.scores).filter(Boolean) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const processPendingSaves = useCallback(async () => {
    const saves = [...pendingSaves]
    setPendingSaves([])
    
    for (const saveData of saves) {
      try {
        const response = await apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${saveData.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(saveData.data)
        })
        
        if (!response.ok) {
          // Re-queue failed saves
          setPendingSaves(prev => [...prev, saveData])
        }
      } catch (error) {
        // Re-queue failed saves
        setPendingSaves(prev => [...prev, saveData])
      }
    }
    
    if (pendingSaves.length === 0) {
      addToast({
        message: 'All offline scores have been synchronized!',
        type: 'success',
        duration: 3000
      })
    }
  }, [pendingSaves, addToast])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Process pending saves when back online
      if (pendingSaves.length > 0) {
        processPendingSaves()
      }
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      addToast({
        message: 'You are offline. Scores will be saved when connection is restored.',
        type: 'warning',
        duration: 5000
      })
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Check initial status
    setIsOnline(navigator.onLine)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [pendingSaves, addToast, processPendingSaves])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Stable ref so handleRandomizeScores never needs players in its dep array
  const playersRef = useRef(players)
  useEffect(() => { playersRef.current = players }, [players])

  // Stable ref for selectedSquad so save closures never go stale
  const selectedSquadRef = useRef(selectedSquad)
  useEffect(() => { selectedSquadRef.current = selectedSquad }, [selectedSquad])

  // DEV ONLY: build all random scores in memory, then do ONE setPlayers + ONE bulk API call
  const handleRandomizeScores = useCallback(async () => {
    const token = localStorage.getItem('token')
    const tournamentId = getSelectedTournamentId()
    const currentPlayers = playersRef.current

    // Build random scores for every player
    const scoreMap: Record<number, { g1: number; g2: number; g3: number }> = {}
    currentPlayers.forEach(player => {
      scoreMap[player.id] = {
        g1: Math.floor(Math.random() * 121) + 130,
        g2: Math.floor(Math.random() * 121) + 130,
        g3: Math.floor(Math.random() * 121) + 130,
      }
    })

    // Single state update — no cascade
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

    // Persist to backend — fire-and-forget each save without touching React state
    const squad = selectedSquadRef.current
    if (token && tournamentId && squad) {
      await Promise.allSettled(
        currentPlayers.map(player => {
          const s = scoreMap[player.id]
          if (!s) return Promise.resolve()
          return apiFetch(API('/api/v1/scores/'), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_id: player.id,
              tournament_id: parseInt(tournamentId),
              squad_id: squad.id,
              game1_scratch: s.g1,
              game2_scratch: s.g2,
              game3_scratch: s.g3,
            }),
          })
        })
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[_\s\-#]+/g, '')

  const parseScoreNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined
    const raw = String(value).trim()
    if (raw === '') return undefined
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return undefined
    const rounded = Math.round(parsed)
    if (rounded < 0 || rounded > 300) return undefined
    return rounded
  }

  const parsePlayerId = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined
    const raw = String(value).trim()
    if (raw === '') return undefined
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined
    return parsed
  }

  const handleExportScoresToExcel = useCallback(async () => {
    if (players.length === 0) {
      addToast({ message: 'No scores to export.', type: 'warning', duration: 3000 })
      return
    }

    setIsExporting(true)
    try {
      const { Workbook } = await import('exceljs')
      const rows = sortedPlayers.map(player => ({
        'Player ID': player.id,
        'First Name': player.firstName || '',
        'Last Name': player.lastName || '',
        'Lane': player.lane || '',
        'Average': Number(player.average || 0),
        'Handicap': Number(player.handicap || 0),
        'Game 1 Scratch': player.scores?.game1_scratch ?? '',
        'Game 2 Scratch': player.scores?.game2_scratch ?? '',
        'Game 3 Scratch': player.scores?.game3_scratch ?? '',
        'Total Scratch': calculateTotalScratch(player),
        'Total With Handicap': calculateDisplayTotal(player),
      }))

      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Scores')
      if (rows.length > 0) {
        worksheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key }))
        worksheet.addRows(rows)
      }

      const safeTournament = (tournament?.name || 'scores')
        .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'scores'
      const safeSquad = selectedSquad
        ? `${selectedSquad.date || ''}_${selectedSquad.time || ''}`.replace(/[^a-zA-Z0-9\-_ ]+/g, '').trim().replace(/\s+/g, '_')
        : 'all_squads'
      const dateStamp = new Date().toISOString().slice(0, 10)
      const fileName = `${safeTournament}_${safeSquad}_scores_${dateStamp}.xlsx`

      const xlsxBuffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      addToast({ message: `Exported ${rows.length} score row${rows.length !== 1 ? 's' : ''}.`, type: 'success', duration: 3000 })
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
      const token = localStorage.getItem('token')
      const tournamentId = getSelectedTournamentId()
      const squad = selectedSquadRef.current
      if (!token || !tournamentId || !squad) {
        addToast({ message: 'Select a tournament and squad before importing scores.', type: 'error', duration: 4000 })
        return
      }

      const { Workbook } = await import('exceljs')
      const buffer = await file.arrayBuffer()
      const workbook = new Workbook()
      await workbook.xlsx.load(buffer)
      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        addToast({ message: 'Excel file has no sheets.', type: 'error', duration: 4000 })
        return
      }
      const headers: string[] = []
      const rawRows: Record<string, unknown>[] = []
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cells = (row.values as unknown[]).slice(1)
        if (rowNumber === 1) {
          cells.forEach(cell => headers.push(String(cell ?? '')))
        } else {
          const obj: Record<string, unknown> = {}
          headers.forEach((header, i) => { obj[header] = cells[i] ?? '' })
          rawRows.push(obj)
        }
      })
      if (rawRows.length === 0) {
        addToast({ message: 'No score rows found in file.', type: 'warning', duration: 3000 })
        return
      }

      type ImportRow = {
        playerId?: number
        firstName: string
        lastName: string
        game1_scratch?: number
        game2_scratch?: number
        game3_scratch?: number
      }

      const parsedRows: ImportRow[] = rawRows.map(rawRow => {
        const normalized: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(rawRow)) {
          normalized[normalizeHeader(key)] = value
        }

        const fullName = String(normalized.name || normalized.bowlername || '').trim()
        let firstName = String(normalized.firstname || normalized.first || '').trim()
        let lastName = String(normalized.lastname || normalized.last || '').trim()
        if ((!firstName || !lastName) && fullName) {
          const parts = fullName.split(/\s+/).filter(Boolean)
          firstName = firstName || parts[0] || ''
          lastName = lastName || parts.slice(1).join(' ')
        }

        return {
          playerId: parsePlayerId(normalized.playerid || normalized.id || normalized.bowlerid),
          firstName,
          lastName,
          game1_scratch: parseScoreNumber(normalized.game1scratch),
          game2_scratch: parseScoreNumber(normalized.game2scratch),
          game3_scratch: parseScoreNumber(normalized.game3scratch),
        }
      })

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
  }, [addToast, isScoresLocked])

  // Header configuration
  const clearGameScores = useCallback(async (gameNumber: 2 | 3) => {
    if (!tournament?.id) {
      addToast({ type: 'error', message: 'No tournament selected.', duration: 3000 })
      return
    }

    const token = authToken || localStorage.getItem('token')
    if (!token) {
      addToast({ type: 'error', message: 'Your session expired. Please log in again.', duration: 4000 })
      return
    }

    const params = new URLSearchParams({ tournament_id: String(tournament?.id) })
    if (selectedSquad) params.set('squad_id', String(selectedSquad.id))
    const res = await apiFetch(API(`/api/v1/scores/dev/clear-game/${gameNumber}?${params}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    let body: { message?: string; detail?: string } = {}
    try {
      body = await res.json()
    } catch {
      // Best-effort parse only.
    }

    if (res.status === 401) {
      addToast({ type: 'error', message: 'Unauthorized. Please sign in again.', duration: 4000 })
      return
    }

    addToast({ type: res.ok ? 'success' : 'error', message: body.message ?? body.detail, duration: 3000 })
    if (res.ok) {
      setPlayers(prev => prev.map(p => ({
        ...p,
        scores: p.scores
          ? {
              ...p.scores,
              [`game${gameNumber}_scratch`]: undefined,
              [`game${gameNumber}_with_handicap`]: undefined,
            }
          : p.scores,
      })))
    }
  }, [tournament, selectedSquad, addToast, authToken])

  const devClearGame = useCallback((gameNumber: 2 | 3) => {
    setClearGameConfirm(gameNumber)
  }, [])

  const headerActions = useMemo(() => (
    <div className={styles.headerActions}>
      <button
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={handleExportScoresToExcel}
        disabled={isExporting || players.length === 0}
      >
        {isExporting ? 'Exporting...' : 'Export to Excel'}
      </button>

      <button
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={() => importFileRef.current?.click()}
        disabled={isImporting || players.length === 0 || isScoresLocked}
      >
        {isImporting ? 'Importing...' : 'Import from Excel'}
      </button>

      {players.length > 0 && !isScoresLocked && (
        <button
          className="ds-btn ds-btn-success ds-btn-sm"
          onClick={() => {
            const missing = players
              .filter(p => {
                const s = p.scores
                return !s || s.game1_scratch == null || s.game2_scratch == null || s.game3_scratch == null
              })
              .map(p => `${p.firstName} ${p.lastName}`.trim())
            setMissingScoreNames(missing)
            setShowCalcPayoutsConfirm(true)
          }}
        >
          Calculate Payouts
        </button>
      )}

      {players.length > 0 && isScoresLocked && (
        <button
          className="ds-btn ds-btn-destructive ds-btn-sm"
          onClick={unlockScoresTable}
        >
          Unlock Scores
        </button>
      )}
      
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
        >
          Sync Offline Scores ({pendingSaves.length})
        </EnhancedButton>
      )}

      {(process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin) && players.length > 0 && (
        <div className={styles.devGroup}>
          <button className={styles.devButton} onClick={handleRandomizeScores} disabled={isScoresLocked}>Randomize Scores</button>
          <button className={styles.devButton} onClick={() => devClearGame(2)} disabled={isScoresLocked}>Clear Game 2</button>
          <button className={styles.devButton} onClick={() => devClearGame(3)} disabled={isScoresLocked}>Clear Game 3</button>
        </div>
      )}
    </div>
  ), [players, handleRandomizeScores, devClearGame, pendingSaves.length, addToast, processPendingSaves, handleExportScoresToExcel, isExporting, isImporting, isScoresLocked, unlockScoresTable, currentUser])
  usePageHeader({
    title: 'Scores',
    subtitle: undefined,
    actions: headerActions
  })

  // fetchPlayersWithScores must be defined before the useEffect that calls it
  // (and before any early-return guards) so the closure captures it properly.
  const fetchPlayersWithScores = useCallback(async (tournamentId: string, squadId: number | null, token: string) => {
    try {
      const bowlersUrl = squadId 
        ? `/api/v1/bowlers?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/bowlers?tournament_id=${tournamentId}`
      
      // Fire bowlers and scores in parallel — scores don't depend on bowlers
      const scoresUrl = `/api/v1/scores/?tournament_id=${tournamentId}`
      const [bowlersResponse, scoresResponse] = await Promise.all([
        apiFetch(API(bowlersUrl), { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch(API(scoresUrl), { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (!bowlersResponse.ok) {
        logger.error(`Bowlers API returned ${bowlersResponse.status} for url: ${bowlersUrl}`)
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch tournament, squad, and players data - OPTIMIZED WITH PARALLEL REQUESTS
  useEffect(() => {
    // Batch read all localStorage data at once for better performance
    const { lastTournamentId, token } = (() => {
      if (typeof window === 'undefined') return { lastTournamentId: null, token: null };
      return {
        lastTournamentId: getSelectedTournamentId(),
        token: localStorage.getItem('token'),
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
            squadToUse = squadsData[0]
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null
    const lockKey = getScopedScoresLockKey(tournamentId, squadId)

    if (!lockKey) {
      setIsScoresLocked(false)
      return
    }

    setIsScoresLocked(storage.getItem(lockKey) === '1')
  }, [getScopedScoresLockKey, selectedSquad, tournament])

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

  const markRowSaved = (playerId: number) => {
    setRowSaveState(prev => ({ ...prev, [playerId]: 'saved' }))
    window.setTimeout(() => {
      setRowSaveState(prev => (prev[playerId] === 'saved' ? { ...prev, [playerId]: 'idle' } : prev))
    }, 1400)
  }

  const focusNextMobileInput = useCallback((playerId: number, field: string) => {
    const fields = ['game1_scratch', 'game2_scratch', 'game3_scratch']
    const currentFieldIndex = fields.indexOf(field)
    const currentPlayerIndex = paginationHook.paginatedItems.findIndex(player => player.id === playerId)

    let nextField: string | null = null
    let nextPlayerId: number | null = null

    if (currentFieldIndex < fields.length - 1) {
      nextField = fields[currentFieldIndex + 1]
      nextPlayerId = playerId
    } else if (currentPlayerIndex >= 0 && currentPlayerIndex < paginationHook.paginatedItems.length - 1) {
      nextField = fields[0]
      nextPlayerId = paginationHook.paginatedItems[currentPlayerIndex + 1].id
    }

    if (!nextField || !nextPlayerId) return
    const target = document.querySelector(`input[data-mobile-player="${nextPlayerId}"][data-mobile-field="${nextField}"]`) as HTMLInputElement | null
    if (target) {
      target.focus()
      target.select()
    }
  }, [paginationHook.paginatedItems])

  const updateScore = async (
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
    
    // Validate score range
    if (value !== undefined && (value < 0 || value > 300)) {
      addToast({
        message: `Invalid score: ${value}. Scores must be between 0 and 300.`,
        type: 'error',
        duration: 4000
      })
      return
    }

    if (trackHistory) {
      const previousValue = playersRef.current.find(player => player.id === playerId)?.scores?.[field as keyof ScoreData] as number | undefined
      setLastEdit({ playerId, field, previous: previousValue })
    }

    setRowSaveState(prev => ({ ...prev, [playerId]: 'saving' }))
    
    // Update local state first for immediate UI feedback
    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        const updatedPlayer = {
          ...player,
          scores: {
            ...player.scores,
            [field]: value
          }
        }
        
        // Auto-calculate totals when scratch scores are entered
        // Use the player's handicap from the backend (already calculated with correct settings)
        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = player.handicap || 0  // Use stored handicap value
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

    // Clear existing timeout for this field
    const existingTimeout = debouncedSavesRef.current.get(saveKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    // Debounced save to backend (500ms delay)
    const timeoutId = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token')
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

        // Calculate the updated scores for API call
        const updatedScores = { ...player.scores, [field]: value }
        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = player.handicap || 0  // Use stored handicap value
          const totalScore = scratchScore + handicap
          updatedScores[`game${gameNum}_with_handicap` as keyof typeof updatedScores] = totalScore
        }

        const scoreData = {
          player_id: playerId,
          tournament_id: parseInt(tournamentId),
          squad_id: selectedSquadRef.current.id,
          game1_scratch: updatedScores.game1_scratch,
          game2_scratch: updatedScores.game2_scratch,
          game3_scratch: updatedScores.game3_scratch
          // Note: game totals are calculated by backend (scratch + handicap)
        }

        // Handle offline saves
        if (!isOnline) {
          setPendingSaves(prev => [...prev, { token, data: scoreData }])
          // Store in localStorage as backup
          localStorage.setItem(`pending_save_${Date.now()}`, JSON.stringify({ token, data: scoreData }))
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
          // Show success toast for perfect games
          if (value === 300) {
            addToast({
              message: `Perfect game! 300 scored by ${player.firstName} ${player.lastName}`,
              type: 'success',
              duration: 5000
            })
          } else if (value && value >= 250) {
            // Show toast for high scores
            addToast({
              message: `� Excellent score: ${value} by ${player.firstName} ${player.lastName}`,
              type: 'success',
              duration: 3000
            })
          }
        } else {
          throw new Error(`Save failed: ${response.status}`)
        }

      } catch (error) {
        logger.error('Failed to save score:', error)
        
        // Show error toast
        const currentPlayer = playersRef.current.find(playerItem => playerItem.id === playerId);
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
  }

  const retryPlayerSave = useCallback(async (player: Player) => {
    const token = localStorage.getItem('token')
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

      if (!response.ok) throw new Error(`Retry failed: ${response.status}`)
      markRowSaved(player.id)
    } catch (error) {
      setRowSaveState(prev => ({ ...prev, [player.id]: 'failed' }))
      logger.error('Retry score save failed', { error, playerId: player.id })
    }
  }, [])

  const undoLastEdit = useCallback(() => {
    if (!lastEdit) return
    void updateScore(lastEdit.playerId, lastEdit.field, lastEdit.previous, { trackHistory: false, moveNextOnMobile: false })
    setLastEdit(null)
  }, [lastEdit, updateScore])

  const calculateTotalScratch = (player: Player) => {
    const scores = player.scores || {}
    return (scores.game1_scratch || 0) + (scores.game2_scratch || 0) + (scores.game3_scratch || 0)
  }

  const calculateTotalWithHandicap = (player: Player) => {
    const scores = player.scores || {}
    const scratch = (scores.game1_scratch || 0) + (scores.game2_scratch || 0) + (scores.game3_scratch || 0)
    const gamesPlayed = [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch].filter(s => s !== undefined && s !== null).length
    return scratch + (player.handicap * gamesPlayed)
  }

  const getGameTotal = (scratchScore: number | undefined, handicap: number) => {
    if (scratchScore === undefined || scratchScore === null) return '—'
    return scratchScore + handicap
  }

  const calculateDisplayTotal = (player: Player) => {
    const scores = player.scores || {}
    const games = [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch]
    const played = games.filter(s => s !== undefined && s !== null)
    if (played.length === 0) return '—'
    const scratch = played.reduce((sum, s) => sum + (s || 0), 0)
    return scratch + (player.handicap * played.length)
  }

  const rowStateCounts = useMemo(() => {
    const values = Object.values(rowSaveState)
    return {
      saving: values.filter(state => state === 'saving').length,
      failed: values.filter(state => state === 'failed').length,
    }
  }, [rowSaveState])

  const saveAllVisibleScores = useCallback(async () => {
    const token = localStorage.getItem('token')
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
  }, [addToast, paginationHook.paginatedItems])

  const markScoresComplete = useCallback(() => {
    const missing = players
      .filter(player => hasMissingScore(player))
      .map(player => `${player.firstName} ${player.lastName}`.trim())
    setMissingScoreNames(missing)
    setShowCalcPayoutsConfirm(true)
  }, [hasMissingScore, players])

  const getRowStateLabel = useCallback((playerId: number) => {
    const state = rowSaveState[playerId] || 'idle'
    if (state === 'saving') return 'Saving'
    if (state === 'saved') return 'Saved'
    if (state === 'failed') return 'Failed'
    return 'Ready'
  }, [rowSaveState])

  // Auth guards (after all hooks)
  if (!isInitialized) {
    return (
      <div className={styles.loadingState}>
        <div>Loading score management...</div>
      </div>
    )
  }

  if (!isAuthenticated && !hasStoredAuth) {
    return (
      <div className={styles.authRequired}>
        <div>Please log in to access score management</div>
      </div>
    )
  }

  if (!isAuthenticated && hasStoredAuth) {
    return (
      <div className={styles.authRequired}>
        <div>Loading score management...</div>
      </div>
    )
  }

  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
    return (
      <NoTournamentState
        description="Load a tournament from the dashboard to enter and manage scores. Once loaded, you'll be able to record game scores for each player across all rounds."
        cards={[
          { title: 'Enter Scores', text: 'Record game scores for each player per round directly in the score sheet' },
          { title: 'Auto-Save', text: 'Scores are saved automatically as you type — no need to manually submit' },
          { title: 'Sort & Filter', text: 'Sort players by name, average, or score to quickly find and update entries' },
        ]}
      />
    )
  }

  if (!isLoading && typeof window !== 'undefined' && !getSelectedSquadId() && !selectedSquad) {
    return (
      <NoTournamentState
        title="No Squad Selected"
        description="Select a squad from the dashboard to enter and manage scores for that session."
        cards={[
          { title: 'Select a Squad', text: 'Choose a squad from the dashboard to view and enter scores for its players' },
        ]}
      />
    )
  }

  // Keyboard navigation helper
  const handleKeyDown = (e: React.KeyboardEvent, playerId: number, field: string) => {
    if (isScoresLocked) {
      e.preventDefault()
      return
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      // Move to next input field
      const currentPlayerIndex = players.findIndex(playerItem => playerItem.id === playerId)
      const fields = ['game1_scratch', 'game2_scratch', 'game3_scratch']
      const currentFieldIndex = fields.indexOf(field)
      
      if (e.key === 'Enter') {
        e.preventDefault()
        let nextField: string | null = null
        let nextPlayerId: number | null = null
        
        if (currentFieldIndex < fields.length - 1) {
          // Move to next field for same player
          nextField = fields[currentFieldIndex + 1]
          nextPlayerId = playerId
        } else if (currentPlayerIndex < players.length - 1) {
          // Move to first field of next player
          nextField = fields[0]
          nextPlayerId = players[currentPlayerIndex + 1].id
        }
        
        if (nextField && nextPlayerId) {
          const nextInput = document.querySelector(`input[data-player="${nextPlayerId}"][data-field="${nextField}"]`) as HTMLInputElement
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }
      }
    }
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
          <div className="bw-scores-calc-modal">
            <CloseControl onClick={() => setShowCalcPayoutsConfirm(false)} position="absolute" size="sm" label="Close payout confirmation dialog" />
            {missingScoreNames.length > 0 ? (
              <>
                <div className="bw-scores-calc-head">
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
                    className="ds-btn ds-btn-secondary ds-btn-sm"
                    onClick={() => setShowCalcPayoutsConfirm(false)}
                  >
                    Go Back &amp; Enter Scores
                  </button>
                  <button
                    className="ds-btn ds-btn-sm bw-scores-calc-btn-warning"
                    onClick={() => { setShowCalcPayoutsConfirm(false); unlockPayoutsAndGo() }}
                  >
                    Proceed Anyway
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bw-scores-calc-head">
                  <h2 className="bw-scores-calc-title">All Scores Complete</h2>
                </div>
                <p className="bw-scores-calc-text">
                  All {players.length} bowler{players.length !== 1 ? 's' : ''} have scores for all 3 games. Confirm these scores are final before calculating payouts — winners will be determined from these results.
                </p>
                <div className="bw-scores-calc-actions">
                  <button
                    className="ds-btn ds-btn-secondary ds-btn-sm"
                    onClick={() => setShowCalcPayoutsConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="ds-btn ds-btn-success ds-btn-sm"
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
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportScoresFileSelected}
        className="sr-only"
      />
      {isMobile ? (
        <MobileLayout
          title="Scores"
          subtitle="Enter and manage bowling scores"
          showBackButton={true}
          onBack={() => window.history.back()}
          headerActions={
            <div className="flex gap-2">
              <button
                onClick={handleExportScoresToExcel}
                disabled={isExporting || players.length === 0}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={isImporting || players.length === 0}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          }
        >
          {/* Mobile content will go here */}
          <div className="space-y-4">
            {/* No Tournament State */}
            {!tournament && !isLoading && (
              <div className={styles.noTournamentMobile}>
                <h2 className={styles.noTournamentTitleMobile}>No Tournament Loaded</h2>
                <p className={styles.noTournamentTextMobile}>
                  Load a tournament from the dashboard to start entering scores
                </p>
                <Link href="/dashboard" className={styles.dashboardBtnMobile}>
                  Go to Dashboard
                </Link>
              </div>
            )}
            
            {/* Tournament and Squad selector for mobile */}
            {tournament && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {tournament.name}
                </h3>
                {selectedSquad && (
                  <p className="text-sm text-gray-600">
                    Squad: {selectedSquad.date} — {selectedSquad.time}
                  </p>
                )}
              </div>
            )}
            
            {/* Loading state for mobile */}
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            )}
            
            {/* Players list for mobile - simplified card view */}
            {!isLoading && players.length > 0 && (
              <div className="space-y-3">
                {paginationHook.paginatedItems.map((player: Player) => (
                  <div key={player.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {player.firstName} {player.lastName}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Lane {player.lane} • Avg: {player.average} • HDCP: {player.handicap}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-blue-600">
                          Total: {calculateTotalWithHandicap(player)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Scratch: {calculateTotalScratch(player)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Score input grid for mobile */}
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((gameNum) => (
                        <div key={gameNum} className="text-center">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Game {gameNum}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="300"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={player.scores?.[`game${gameNum}_scratch` as keyof typeof player.scores] || ''}
                            onChange={(changeEvent) => updateScore(player.id, `game${gameNum}_scratch`, parseInt(changeEvent.target.value) || 0)}
                            disabled={isScoresLocked}
                            placeholder={`G${gameNum}`}
                            inputMode="numeric"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            +{player.handicap} = {(player.scores?.[`game${gameNum}_scratch` as keyof typeof player.scores] || 0) + player.handicap}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Mobile pagination */}
            {!isLoading && players.length > 50 && (
              <div className="flex justify-center mt-6">
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
      <div className={styles.desktopContainer}>

          {/* No Tournament State - Desktop */}
          {!tournament && !isLoading && (
            <div className={styles.noTournamentDesktop}>
              <h2 className={styles.noTournamentTitleDesktop}>No Tournament Loaded</h2>
              <p className={styles.noTournamentTextDesktop}>
                You need to load a tournament from the dashboard before you can enter scores. Once loaded, you&apos;ll be able to enter and manage scores for all players.
              </p>
              <Link href="/dashboard" className={styles.dashboardBtnDesktop}>
                Go to Dashboard
              </Link>

              <div className={styles.quickInfo}>
                <h3 className={styles.quickInfoTitle}>What you can do with Scores:</h3>
                <ul className={styles.quickInfoList}>
                  <li>Enter scratch scores for each game</li>
                  <li>Automatic handicap calculation</li>
                  <li>Real-time totals and rankings</li>
                  <li>Auto-save as you type</li>
                  <li>Export scores to CSV</li>
                </ul>
              </div>
            </div>
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
          {isLoading && (
            <div className={styles.statusMessage}>
              Loading players and scores...
            </div>
          )}

          {/* No Players State */}
          {!isLoading && players.length === 0 && tournament && (
            <div className={styles.emptyScoresState}>
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
                <Link href="/players" className={`${styles.emptyScoresPrimaryAction} ds-btn ds-btn-primary ds-btn-md`}>
                  Go To Entries
                </Link>
                <Link href="/dashboard" className={`${styles.emptyScoresSecondaryAction} ds-btn ds-btn-secondary ds-btn-md`}>
                  Back To Dashboard
                </Link>
              </div>

              <div className={styles.emptyScoresFeaturesGrid}>
                <div className={styles.emptyScoresFeatureCard}>
                  <h3>Load Entries</h3>
                  <p>Add bowlers in Entries for the selected tournament and squad before entering any scores.</p>
                </div>
                <div className={styles.emptyScoresFeatureCard}>
                  <h3>Enter Game Scores</h3>
                  <p>Capture game-by-game scratch scores and let handicap totals calculate automatically.</p>
                </div>
                <div className={styles.emptyScoresFeatureCard}>
                  <h3>Track Results</h3>
                  <p>Sort and review totals quickly to prepare clean bracket seeding and payouts.</p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Scroll Hint */}
          {!isLoading && players.length > 0 && (
            <div className="mobile-scroll-hint">
              Scroll horizontally to see all score columns
            </div>
          )}

          {!isLoading && players.length > 0 && (
            <div className={styles.scoresSearchCard}>
              <h3 className={styles.scoresSearchTitle}>Scores Table Search</h3>
              <div className={styles.scoresSearchRow}>
                <input
                  type="text"
                  className={styles.scoresSearchInput}
                  placeholder="Search First Name"
                  value={searchFirstName}
                  onChange={(event) => setSearchFirstName(event.target.value)}
                />
                <input
                  type="text"
                  className={styles.scoresSearchInput}
                  placeholder="Search Last Name"
                  value={searchLastName}
                  onChange={(event) => setSearchLastName(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.scoresSearchClear}
                  onClick={() => {
                    setSearchFirstName('')
                    setSearchLastName('')
                  }}
                >
                  Clear Search
                </button>
              </div>
            </div>
          )}

          {/* Scores Table */}
          {!isLoading && filteredPlayers.length > 0 && (
            <div className="entries-container">

                <table className="entries-table" aria-label="Player Scores" onKeyDownCapture={handleTableArrowNavigation}>

            <thead>
              {selectedSquad && (
                <tr>
                  <td colSpan={12} className="squad-banner">
                    Showing scores for: {selectedSquad.date} — {selectedSquad.time}
                  </td>
                </tr>
              )}
              <tr className="entries-header-row">
                <SortableHeader column="firstName" sortConfig={sortConfig} onSort={handleSort} align="center" width="9%">
                  First Name
                </SortableHeader>
                <SortableHeader column="lastName" sortConfig={sortConfig} onSort={handleSort} align="center" width="9%">
                  Last Name
                </SortableHeader>
                <SortableHeader column="lane" sortConfig={sortConfig} onSort={handleSort} width="5%">
                  Lane
                </SortableHeader>
                <SortableHeader column="average" sortConfig={sortConfig} onSort={handleSort} width="5%">
                  Avg
                </SortableHeader>
                <SortableHeader column="game1_scratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 1<br/>Scratch
                </SortableHeader>
                <SortableHeader column="game1_total" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 1<br/>Total
                </SortableHeader>
                <SortableHeader column="game2_scratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 2<br/>Scratch
                </SortableHeader>
                <SortableHeader column="game2_total" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 2<br/>Total
                </SortableHeader>
                <SortableHeader column="game3_scratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 3<br/>Scratch
                </SortableHeader>
                <SortableHeader column="game3_total" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 3<br/>Total
                </SortableHeader>
                <SortableHeader column="totalScratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Total<br/>Scratch
                </SortableHeader>
                <SortableHeader column="totalWithHandicap" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Total
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {paginationHook.paginatedItems.map((player: Player, index: number) => (
                <tr key={player.id} className={`scores-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                  <td className="scores-cell name">{player.firstName}</td>
                  <td className="scores-cell name">{player.lastName}</td>
                  <td className={`scores-cell lane ${!player.lane ? 'lane-empty' : ''}`}>{player.lane || '—'}</td>
                  <td className="scores-cell average">{player.average}</td>
                  
                  {/* Game 1 Scratch */}
                  <td className="scores-cell scratch-input">
                    <div className="pos-relative inline-block">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
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
                  </td>
                  
                  {/* Game 1 Total */}
                  <td className="scores-cell total">
                    {getGameTotal(player.scores?.game1_scratch, player.handicap)}
                  </td>
                  
                  {/* Game 2 Scratch */}
                  <td className="scores-cell scratch-input">
                    <div className="pos-relative inline-block">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
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
                  </td>
                  
                  {/* Game 2 Total */}
                  <td className="scores-cell total">
                    {getGameTotal(player.scores?.game2_scratch, player.handicap)}
                  </td>
                  
                  {/* Game 3 Scratch */}
                  <td className="scores-cell scratch-input">
                    <div className="pos-relative inline-block">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
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
                  </td>
                  
                  {/* Game 3 Total */}
                  <td className="scores-cell total">
                    {getGameTotal(player.scores?.game3_scratch, player.handicap)}
                  </td>
                  
                  {/* Total Scratch */}
                  <td className="scores-cell total-scratch">
                    {calculateTotalScratch(player) || '—'}
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
        )}

        {!isLoading && players.length > 0 && filteredPlayers.length === 0 && (
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
    </>
    </ErrorBoundary>
  )
}







