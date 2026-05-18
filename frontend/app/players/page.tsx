'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { usePlayers } from './hooks/usePlayers'
import { useTournaments } from '../hooks/useTournaments'
import PlayersTable from './components/PlayersTable'
import PlayerForm from './components/PlayerForm'
import NoTournamentState from '../components/NoTournamentState'
import { logger } from '../lib/logger'
import { Squad, Player, PlayerFormPrefillDraft } from './types'
import { BracketProgramDefinition, BracketSettings, SidePotsSettings, Tournament } from '../lib/types'
import { apiClient, API, apiFetch } from '../lib/api'
import { calculatePlayerTotalCost, calculateSidePotCost, defaultBracketPrograms, filterEntriesForDivision, getEnabledBracketPrograms, normalizeBracketPrograms, normalizeDivision, normalizePlayerBracketEntries, summarizeEntries } from '../lib/bracketPrograms'
import styles from './entries.module.css'
import CloseControl from '../../components/CloseControl'
import { useToastHelpers } from '../components/Toast'
import ImportLoadingModal from '../components/ImportLoadingModal'
import { getSelectedSquadId, getSelectedTournamentId, setSelectedSquad } from '../lib/selection-session'

type TournamentBootstrapResponse = {
  tournament: Tournament | null;
  squads: Squad[];
  selected_squad: { squad_id: number } | null;
  bracket_settings: Partial<BracketSettings> | null;
}

function bracketProgramsEqual(left: BracketProgramDefinition[], right: BracketProgramDefinition[]): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    const l = left[i]
    const r = right[i]
    if (
      l.key !== r.key
      || l.name !== r.name
      || (l.division || '') !== (r.division || '')
      || l.scoring_mode !== r.scoring_mode
      || (l.entry_fee ?? null) !== (r.entry_fee ?? null)
      || Boolean(l.enabled) !== Boolean(r.enabled)
      || Boolean(l.allow_byes) !== Boolean(r.allow_byes)
      || (l.display_order ?? null) !== (r.display_order ?? null)
    ) {
      return false
    }
  }
  return true
}


export default function PlayersPage() {
  const { isAuthenticated, isInitialized, token, user } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const id = getSelectedSquadId()
    return id ? Number(id) : null
  })
  const [squads, setSquads] = useState<Squad[]>([])
  const [entryFee, setEntryFee] = useState<number>(25) // Default $25, will be loaded from tournament settings
  const [bracketSize, setBracketSize] = useState<number>(8) // Default 8, will be loaded from tournament settings
  const [bracketPrograms, setBracketPrograms] = useState<BracketProgramDefinition[]>(defaultBracketPrograms)
  // initialLoadComplete removed — squad fetch now runs in parallel with bracket-settings
  const [sidePots, setSidePots] = useState<SidePotsSettings | null>(null)
  const [historySearchUsbc, setHistorySearchUsbc] = useState('')
  const [historySearchFirstName, setHistorySearchFirstName] = useState('')
  const [historySearchLastName, setHistorySearchLastName] = useState('')
  const [debouncedHistorySearchUsbc, setDebouncedHistorySearchUsbc] = useState('')
  const [debouncedHistorySearchFirstName, setDebouncedHistorySearchFirstName] = useState('')
  const [debouncedHistorySearchLastName, setDebouncedHistorySearchLastName] = useState('')
  const [historyResults, setHistoryResults] = useState<Array<{ id: number; first_name: string; last_name: string; usbc_number?: string | null }>>([])
  const [isHistorySearching, setIsHistorySearching] = useState(false)
  const [prefillDraft, setPrefillDraft] = useState<PlayerFormPrefillDraft | null>(null)
  const [prefillVersion, setPrefillVersion] = useState(0)
  const [searchUsbc, setSearchUsbc] = useState('')
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')
  const [isMobileView, setIsMobileView] = useState(false)
  const [historySearchCollapsed, setHistorySearchCollapsed] = useState(false)
  const [tableSearchCollapsed, setTableSearchCollapsed] = useState(false)
  const [debouncedSearchUsbc, setDebouncedSearchUsbc] = useState('')
  const [debouncedSearchFirstName, setDebouncedSearchFirstName] = useState('')
  const [debouncedSearchLastName, setDebouncedSearchLastName] = useState('')
  // Per-player side pot entries: { [playerId]: { [potKey]: boolean } } — localStorage only
  const [sidePotEntriesMap, setSidePotEntriesMap] = useState<Record<number, Record<string, boolean>>>({})
  const enabledBracketPrograms = useMemo(() => getEnabledBracketPrograms(bracketPrograms), [bracketPrograms])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedHistorySearchUsbc(historySearchUsbc)
      setDebouncedHistorySearchFirstName(historySearchFirstName)
      setDebouncedHistorySearchLastName(historySearchLastName)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [historySearchUsbc, historySearchFirstName, historySearchLastName])

  useEffect(() => {
    const runHistorySearch = async () => {
      if (!token) {
        setHistoryResults([])
        return
      }

      const hasSearch = Boolean(
        debouncedHistorySearchUsbc.trim()
        || debouncedHistorySearchFirstName.trim()
        || debouncedHistorySearchLastName.trim()
      )
      if (!hasSearch) {
        setHistoryResults([])
        return
      }

      setIsHistorySearching(true)
      try {
        const params = new URLSearchParams()
        if (debouncedHistorySearchUsbc.trim()) params.set('usbc_number', debouncedHistorySearchUsbc.trim())
        if (debouncedHistorySearchFirstName.trim()) params.set('first_name', debouncedHistorySearchFirstName.trim())
        if (debouncedHistorySearchLastName.trim()) params.set('last_name', debouncedHistorySearchLastName.trim())
        params.set('limit', '25')

        const data = await apiClient.get<Array<{ id: number; first_name: string; last_name: string; usbc_number?: string | null }>>(
          `/api/v1/bowlers/profiles?${params.toString()}`
        )
        setHistoryResults(Array.isArray(data) ? data : [])
      } catch (error) {
        logger.error('Failed to search bowler history', { error })
        setHistoryResults([])
      } finally {
        setIsHistorySearching(false)
      }
    }

    void runHistorySearch()
  }, [token, debouncedHistorySearchUsbc, debouncedHistorySearchFirstName, debouncedHistorySearchLastName])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchUsbc(searchUsbc)
      setDebouncedSearchFirstName(searchFirstName)
      setDebouncedSearchLastName(searchLastName)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchUsbc, searchFirstName, searchLastName])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const syncMobileState = () => {
      const mobile = mediaQuery.matches
      setIsMobileView(mobile)
      setHistorySearchCollapsed(mobile)
      setTableSearchCollapsed(mobile)
    }

    syncMobileState()
    mediaQuery.addEventListener('change', syncMobileState)
    return () => mediaQuery.removeEventListener('change', syncMobileState)
  }, [])
  


  // Helper function to get tournament ID from various sources
  const getTournamentId = useCallback(() => {
    return getSelectedTournamentId()
  }, []);

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select tournament from localStorage
  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedTournamentId = getSelectedTournamentId()
      if (storedTournamentId) {
        const storedTournament = tournaments.find(t => t.id === parseInt(storedTournamentId))
        if (storedTournament) {
          setSelectedTournament(storedTournament)
        }
      }
    }
  }, [tournaments, selectedTournament])

  // Load side pots settings from localStorage for the given tournament
  const loadSidePots = useCallback((tournamentId: string | null) => {
    if (!tournamentId) { setSidePots(null); setSidePotEntriesMap({}); return }
    try {
      const raw = localStorage.getItem(`sidePots_${tournamentId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as SidePotsSettings
        setSidePots(parsed)
      } else {
        setSidePots(null)
      }
    } catch {
      setSidePots(null)
    }
    try {
      const rawEntries = localStorage.getItem(`sidePotEntries_${tournamentId}`)
      if (rawEntries) {
        setSidePotEntriesMap(JSON.parse(rawEntries) as Record<number, Record<string, boolean>>)
      } else {
        setSidePotEntriesMap({})
      }
    } catch {
      setSidePotEntriesMap({})
    }
  }, [])

  // Load entry fee from tournament bracket settings
  const lastEntryFeeFetchRef = useRef(0)
  const loadEntryFee = useCallback(async () => {
    if (!token) {
      return;
    }
    
    const tournamentId = getTournamentId();
    
    if (!tournamentId) {
      return;
    }

    loadSidePots(tournamentId);
    
    try {
      lastEntryFeeFetchRef.current = Date.now()
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`);
      const nextEntryFee = typeof settings?.default_entry_fee === 'number' ? settings.default_entry_fee : null
      const nextPrograms = normalizeBracketPrograms(settings?.bracket_programs, nextEntryFee ?? entryFee)
      
      if (nextEntryFee != null) {
        setEntryFee(prev => {
          if (prev === nextEntryFee) return prev
          logger.info(`Loaded entry fee from tournament settings: $${nextEntryFee}`)
          return nextEntryFee
        })
      }
      setBracketPrograms(prev => (bracketProgramsEqual(prev, nextPrograms) ? prev : nextPrograms))
      if (settings && typeof settings.bracket_size === 'number') {
        setBracketSize(settings.bracket_size);
      }
    } catch (error) {
      logger.warn('Failed to load bracket settings, using default entry fee:', error);
      const fallbackPrograms = normalizeBracketPrograms(undefined, entryFee)
      setBracketPrograms(prev => (bracketProgramsEqual(prev, fallbackPrograms) ? prev : fallbackPrograms))
    } finally {
      // nothing — squad fetch no longer gated on this
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadSidePots]);

  // Load entry fee when tournament or auth changes
  useEffect(() => {
    loadEntryFee();
  }, [loadEntryFee]);

  // Reload entry fee when page becomes visible (handles navigation back from Dashboard)
  useEffect(() => {
    const REFETCH_COOLDOWN_MS = 30_000
    const handleVisibilityChange = () => {
      if (!document.hidden && Date.now() - lastEntryFeeFetchRef.current > REFETCH_COOLDOWN_MS) {
        loadEntryFee();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadEntryFee]);

  // Reload when window regains focus (e.g. alt-tab back from another app)
  useEffect(() => {
    const REFETCH_COOLDOWN_MS = 30_000
    const handleFocus = () => {
      if (Date.now() - lastEntryFeeFetchRef.current > REFETCH_COOLDOWN_MS) {
        loadEntryFee();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadEntryFee]);

  // Use loaded squad if available, otherwise a minimal placeholder so usePlayers
  // can begin fetching immediately without waiting for the squads API response.
  const selectedSquad = useMemo(
    () => squads.find(squad => squad.id === selectedSquadId)
      ?? (selectedSquadId != null ? { id: selectedSquadId, date: '', time: '' } as Squad : null),
    [squads, selectedSquadId],
  )

  useEffect(() => {
    if (selectedSquadId !== null) {
      setSelectedSquad(selectedSquadId)
    }
  }, [selectedSquadId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Debug authentication state
  useEffect(() => {
    logger.debug('Players page auth state', {
      isAuthenticated,
      isInitialized,
      hasToken: !!token,
      hasUser: !!user,
      tokenFromStorage: !!localStorage.getItem('token'),
      userIdFromStorage: !!localStorage.getItem('user_id')
    });
  }, [isAuthenticated, isInitialized, token, user]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const handleDeletePlayer = useCallback((id: number) => {
    setDeleteConfirmId(id)
  }, [])

  const {
    players: rawPlayers,
    isLoading,
    savingStatus,
    addPlayer,
    importPlayers,
    updatePlayer,
    cancelPendingPatches,
    deletePlayer,
    loadPlayers,
    bulkSetPlayers,
  } = usePlayers({
    selectedSquad,
    squads,
    authToken: token,
    entryFee,
    bracketPrograms: enabledBracketPrograms,
    getItem: (key: string) => localStorage.getItem(key),
    searchUsbc: debouncedSearchUsbc,
    searchFirstName: debouncedSearchFirstName,
    searchLastName: debouncedSearchLastName,
  })

  const handleUseHistoryResult = useCallback((profile: { first_name: string; last_name: string; usbc_number?: string | null }) => {
    setPrefillDraft({
      firstName: profile.first_name,
      lastName: profile.last_name,
      usbc: profile.usbc_number || '',
    })
    setHistorySearchUsbc('')
    setHistorySearchFirstName('')
    setHistorySearchLastName('')
    setHistoryResults([])
    setPrefillVersion(prev => prev + 1)
  }, [])

  useEffect(() => {
    const handleSettingsChanged = () => {
      cancelPendingPatches()
      void loadEntryFee()
      void loadPlayers()
    }

    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [cancelPendingPatches, loadEntryFee, loadPlayers])

  // Merge side pot entries (localStorage) into players (API)
  const players = useMemo(
    () => rawPlayers.map(p => {
      const sidePotEntries = sidePotEntriesMap[p.id] ?? {}
      const sidePotCost = calculateSidePotCost(sidePotEntries, sidePots)
      return {
        ...p,
        sidePotEntries,
        totalCost: p.totalCost + sidePotCost,
      }
    }),
    [rawPlayers, sidePotEntriesMap, sidePots]
  )

  // Adapter function to match PlayersTable expected signature
  const handleUpdatePlayer = useCallback((playerId: number, field: string, value: string | number | boolean) => {
    let updates: Partial<Player>

    if (field.startsWith('bracketEntry:')) {
      const programKey = field.split(':', 2)[1]
      const existingPlayer = players.find(player => player.id === playerId)
      const nextBracketEntries = {
        ...(existingPlayer?.bracketEntries || {}),
        [programKey]: Number(value || 0),
      }
      updates = {
        bracketEntries: nextBracketEntries,
        handicap: programKey === 'handicap' ? Number(value || 0) : existingPlayer?.handicap,
        scratch: programKey === 'scratch' ? Number(value || 0) : existingPlayer?.scratch,
      }
    } else if (field.startsWith('sidePot:')) {
      const potKey = field.split(':', 2)[1]
      const existingPlayer = players.find(player => player.id === playerId)
      const nextSidePotEntries = {
        ...(existingPlayer?.sidePotEntries || {}),
        [potKey]: Boolean(value),
      }
      // Persist to localStorage
      const tournamentId = getTournamentId()
      if (tournamentId) {
        setSidePotEntriesMap(prev => {
          const next = { ...prev, [playerId]: nextSidePotEntries }
          localStorage.setItem(`sidePotEntries_${tournamentId}`, JSON.stringify(next))
          return next
        })
      }
      // No API call — side pot entries are localStorage only
      return
    } else {
      updates = { [field]: value };
    }

    updatePlayer(playerId, updates);
  }, [players, updatePlayer, getTournamentId]);

  // Stable ref so handleRandomize never needs players in its dep array
  const playersRef = useRef<typeof players>([])
  useEffect(() => { playersRef.current = players }, [players])

  // DEV ONLY: build all random data in memory, then do ONE setPlayers + ONE bulk API call
  const handleRandomize = useCallback(async () => {
    const current = playersRef.current
    const enabledSidePots = (sidePots?.pots ?? []).filter(pot => pot.enabled)

    type UpdateRow = {
      id: number
      average: number
      handicap_entries: number
      scratch_entries: number
      program_entry_counts: Record<string, number>
    }

    const updates: UpdateRow[] = current.map(player => {
      const rawProgramEntryCounts = Object.fromEntries(
        enabledBracketPrograms.map(program => [
          program.key,
          Math.floor(Math.random() * 16),
        ]),
      )
      const programEntryCounts = filterEntriesForDivision(
        normalizePlayerBracketEntries(rawProgramEntryCounts),
        enabledBracketPrograms,
        normalizeDivision(player.division),
      )
      return {
        id: player.id,
        average: Math.floor(Math.random() * 91) + 140,
        handicap_entries: programEntryCounts.handicap ?? 0,
        scratch_entries: programEntryCounts.scratch ?? 0,
        program_entry_counts: programEntryCounts,
      }
    })

    // Build a lookup for O(1) access in the state updater
    const updateMap = new Map(updates.map(u => [u.id, u]))

    // Randomize side pot checkboxes for enabled pots only
    const randomizedSidePotEntries = new Map<number, Record<string, boolean>>()
    current.forEach(player => {
      const nextEntries = { ...(player.sidePotEntries || {}) }
      enabledSidePots.forEach(pot => {
        nextEntries[pot.key] = Math.random() < 0.45
      })
      randomizedSidePotEntries.set(player.id, nextEntries)
    })

    // Single state update — no cascade
    // Keep base bracket cost separate from full due (base + side pots).
    const baseCostMap = new Map(
      updates.map(u => [
        u.id,
        calculatePlayerTotalCost(u.program_entry_counts, enabledBracketPrograms, entryFee),
      ])
    )
    const totalDueMap = new Map(
      updates.map(u => [
        u.id,
        (baseCostMap.get(u.id) ?? 0)
          + calculateSidePotCost(randomizedSidePotEntries.get(u.id), sidePots),
      ])
    )

    // Persist randomized side pot entries to localStorage (same behavior as manual toggles)
    const tournamentId = getTournamentId()
    setSidePotEntriesMap(prev => {
      const next = { ...prev }
      randomizedSidePotEntries.forEach((entries, playerId) => {
        next[playerId] = entries
      })
      if (tournamentId) {
        localStorage.setItem(`sidePotEntries_${tournamentId}`, JSON.stringify(next))
      }
      return next
    })

    bulkSetPlayers(prev => prev.map(player => {
      const u = updateMap.get(player.id)
      if (!u) return player
      const bracketEntries = u.program_entry_counts
      const totalCost = baseCostMap.get(player.id) ?? 0
      const totalDue = totalDueMap.get(player.id) ?? totalCost
      return {
        ...player,
        average: u.average,
        handicap: u.handicap_entries,
        scratch: u.scratch_entries,
        bracketEntries,
        sidePotEntries: randomizedSidePotEntries.get(player.id) ?? player.sidePotEntries,
        totalCost,
        amountPaid: totalDue,
      }
    }))

    // Include amount_paid in the bulk write so it persists
    const updatesWithPaid = updates.map(u => ({
      ...u,
      amount_paid: totalDueMap.get(u.id) ?? 0,
    }))

    cancelPendingPatches()
    try {
      await apiClient.bulkPatch('/api/v1/bowlers/bulk-update', updatesWithPaid)
    } catch (err) {
      logger.error('Bulk randomize failed', { error: err })
    }
  }, [enabledBracketPrograms, entryFee, sidePots, getTournamentId, bulkSetPlayers, cancelPendingPatches])

  const isDev = process.env.NODE_ENV === 'development' || !!user?.isAdmin
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [deleteAllPlayersConfirmOpen, setDeleteAllPlayersConfirmOpen] = useState(false)

  // Import from Excel — file input ref lives here so the button can be in the header
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importFileName, setImportFileName] = useState<string | undefined>(undefined)
  const toast = useToastHelpers()

  const parseNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const getValue = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key]
    }
    return undefined
  }

  const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[_\s\-#]+/g, '')

  const buildImportIdentity = (firstName: string, lastName: string, usbc: string) => {
    const normalizedUsbc = String(usbc || '').trim().toLowerCase()
    if (normalizedUsbc) {
      return `usbc:${normalizedUsbc}`
    }
    return `name:${`${firstName} ${lastName}`.trim().toLowerCase()}`
  }

  type ImportablePlayer = Omit<Player, 'id'> & {
    sourceRow: number
    normalizedName: string
    importKey: string
  }

  type SkippedImportRow = {
    row: number
    reason: string
    name?: string
  }

  const importedNameSuffixes = new Set([
    'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v',
    'md', 'm.d.', 'phd', 'ph.d.', 'dds', 'dmd', 'esq', 'esquire'
  ])

  const parseImportedFullName = (fullName: string) => {
    const trimmed = fullName.trim()
    if (!trimmed) return { firstName: '', lastName: '' }

    const stripTrailingMiddleInitial = (firstNameValue: string) => {
      const parts = firstNameValue.split(/\s+/).filter(Boolean)
      if (parts.length <= 1) return firstNameValue.trim()

      const trailingToken = parts[parts.length - 1]
      if (/^[a-z]\.??$/i.test(trailingToken)) {
        return parts.slice(0, -1).join(' ').trim()
      }

      return firstNameValue.trim()
    }

    if (trimmed.includes(',')) {
      const segments = trimmed
        .split(',')
        .map(segment => segment.trim())
        .filter(Boolean)

      if (segments.length >= 2) {
        const trailingSegment = segments[segments.length - 1].toLowerCase()
        const hasTrailingSuffix = segments.length >= 3 && importedNameSuffixes.has(trailingSegment)
        const rawFirstName = (hasTrailingSuffix ? segments.slice(1, -1) : segments.slice(1)).join(' ').trim()
        return {
          firstName: stripTrailingMiddleInitial(rawFirstName),
          lastName: [segments[0], ...(hasTrailingSuffix ? [segments[segments.length - 1]] : [])].join(' ').trim(),
        }
      }
    }

    const parts = trimmed.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return { firstName: '', lastName: '' }
    if (parts.length === 1) return { firstName: parts[0], lastName: '' }

    const lastToken = parts[parts.length - 1].toLowerCase()
    if (parts.length >= 3 && importedNameSuffixes.has(lastToken)) {
      return {
        firstName: parts.slice(0, -2).join(' ').trim(),
        lastName: parts.slice(-2).join(' ').trim(),
      }
    }

    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ').trim(),
    }
  }

  const parseExcelPlayers = async (file: File): Promise<{ players: ImportablePlayer[]; skippedRows: SkippedImportRow[] }> => {
    const { Workbook } = await import('exceljs')
    const buffer = await file.arrayBuffer()
    const workbook = new Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return { players: [], skippedRows: [{ row: 1, reason: 'No worksheet found' }] }
    const sheetRows: unknown[][] = []
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      sheetRows.push((row.values as unknown[]).slice(1).map(v => v === null || v === undefined ? '' : v))
    })

    const detectHeaderRowIndex = (rows: unknown[][]): number => {
      for (let index = 0; index < rows.length; index += 1) {
        const normalizedCells = rows[index]
          .map(cell => normalizeHeader(String(cell || '')))
          .filter(Boolean)
        if (normalizedCells.length === 0) continue

        const hasName = normalizedCells.includes('name') || normalizedCells.includes('bowlername')
        const hasSplitName = normalizedCells.includes('firstname') || normalizedCells.includes('lastname')
        const hasAvg = normalizedCells.includes('avg') || normalizedCells.includes('average')

        if ((hasName || hasSplitName) && hasAvg) {
          return index
        }
      }
      return -1
    }

    const headerRowIndex = detectHeaderRowIndex(sheetRows)
    if (headerRowIndex < 0) {
      return {
        players: [],
        skippedRows: [{ row: 1, reason: 'Could not detect header row (expected Name/First/Last and Avg columns)' }],
      }
    }

    const headerCells = (sheetRows[headerRowIndex] || []).map(cell => normalizeHeader(String(cell || '')))
    const players: ImportablePlayer[] = []
    const skippedRows: SkippedImportRow[] = []

    for (let rowIndex = headerRowIndex + 1; rowIndex < sheetRows.length; rowIndex += 1) {
      const sourceRow = rowIndex + 1
      const sourceCells = sheetRows[rowIndex] || []

      // Skip fully blank rows quickly.
      if (sourceCells.every(cell => String(cell ?? '').trim() === '')) {
        continue
      }

      const nr: Record<string, unknown> = {}
      for (let colIndex = 0; colIndex < headerCells.length; colIndex += 1) {
        const key = headerCells[colIndex]
        if (!key) continue
        nr[key] = sourceCells[colIndex]
      }
      const fullName = String(getValue(nr, ['name', 'bowlername']) || '').trim()
      let firstName = String(getValue(nr, ['firstname', 'first', 'givenname', 'fname']) || '').trim()
      let lastName  = String(getValue(nr, ['lastname', 'last', 'surname', 'familyname', 'lname']) || '').trim()
      if ((!firstName || !lastName) && fullName) {
        const parsedName = parseImportedFullName(fullName)
        firstName = firstName || parsedName.firstName
        lastName  = lastName  || parsedName.lastName
      }
      if (!firstName || !lastName) {
        skippedRows.push({
          row: sourceRow,
          reason: 'Missing first or last name',
          name: fullName || `${firstName} ${lastName}`.trim() || undefined,
        })
        continue
      }
      const handicap = Math.max(0, Math.floor(parseNumber(getValue(nr, ['handicap', 'handicapentries', 'handicapbrackets']), 0)))
      const scratch  = Math.max(0, Math.floor(parseNumber(getValue(nr, ['scratch',  'scratchentries',  'scratchbrackets']),  0)))
      const bracketEntries = normalizePlayerBracketEntries(undefined, handicap, scratch)
      const normalizedName = `${firstName} ${lastName}`.trim().toLowerCase()
      const usbc = String(getValue(nr, ['usbc', 'usbcnumber', 'nationalid']) || '').trim()
      const importKey = buildImportIdentity(firstName, lastName, usbc)
      players.push({
        firstName, lastName,
        usbc,
        average:    Math.max(0, Math.floor(parseNumber(getValue(nr, ['average', 'avg']), 150))),
        handicap, scratch,
        bracketEntries,
        lane:       String(getValue(nr, ['lane']) || 'A1').trim() || 'A1',
        amountPaid: Math.max(0, parseNumber(getValue(nr, ['amountpaid', 'paid', 'payment']), 0)),
        totalCost: calculatePlayerTotalCost(bracketEntries, bracketPrograms, entryFee),
        sourceRow,
        normalizedName,
        importKey,
      })
    }

    return { players, skippedRows }
  }

  const executeDeleteAllPlayers = useCallback(async () => {
    setIsDeletingAll(true)
    try {
      await Promise.allSettled(players.map(p => deletePlayer(p.id)))
      toast.success('All players deleted.', 'DEV')
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'DEV')
    } finally {
      setIsDeletingAll(false)
    }
  }, [players, deletePlayer, toast])

  const handleDeleteAllPlayers = useCallback(() => {
    setDeleteAllPlayersConfirmOpen(true)
  }, [])

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setIsImporting(true)
    try {
      const { players: imported, skippedRows } = await parseExcelPlayers(file)
      const logSkippedRows = () => {
        if (skippedRows.length === 0) return
        const onlyFileDuplicates = skippedRows.every(row => row.reason.startsWith('Duplicate within file'))
        const logContext = {
          skippedRowsCount: skippedRows.length,
          skippedRowsPreview: skippedRows.slice(0, 10),
        }
        if (onlyFileDuplicates) {
          logger.info('Import skipped duplicate rows from file', logContext)
        } else {
          logger.warn('Import skipped rows', logContext)
        }
      }

      if (imported.length === 0) {
        toast.warning('No valid player rows found. Please include first and last name columns.', 'Import Warning')
        logSkippedRows()
        return
      }

      // Deduplicate within the uploaded file first.
      const seenImportedNames = new Map<string, number>()
      const uniqueImported: ImportablePlayer[] = []
      for (const player of imported) {
        const firstSeenAt = seenImportedNames.get(player.importKey)
        if (firstSeenAt != null) {
          skippedRows.push({
            row: player.sourceRow,
            reason: `Duplicate within file (first seen at row ${firstSeenAt})`,
            name: `${player.firstName} ${player.lastName}${player.usbc ? ` [${player.usbc}]` : ''}`.trim(),
          })
          continue
        }
        seenImportedNames.set(player.importKey, player.sourceRow)
        uniqueImported.push(player)
      }

      // Deduplicate against existing players.
      const existingNames = new Set(
        players.map(p => buildImportIdentity(p.firstName, p.lastName, p.usbc || ''))
      )
      const toImport: Omit<Player, 'id'>[] = []
      for (const player of uniqueImported) {
        if (existingNames.has(player.importKey)) {
          skippedRows.push({
            row: player.sourceRow,
            reason: 'Already exists in entries table',
            name: `${player.firstName} ${player.lastName}${player.usbc ? ` [${player.usbc}]` : ''}`.trim(),
          })
          continue
        }
        const { sourceRow: _sourceRow, normalizedName: _normalizedName, importKey: _importKey, ...payload } = player
        toImport.push(payload)
      }

      if (toImport.length === 0) {
        toast.warning(
          `No new players were imported. ${skippedRows.length} row${skippedRows.length !== 1 ? 's were' : ' was'} skipped.`,
          'No New Players'
        )
        logSkippedRows()
        return
      }

      const result = await importPlayers(toImport)
      toast.success(
        `Added ${result.successCount} player${result.successCount !== 1 ? 's' : ''} successfully.` +
        (result.failedCount > 0 ? ` ${result.failedCount} failed.` : '') +
        (skippedRows.length > 0 ? ` ${skippedRows.length} row${skippedRows.length !== 1 ? 's' : ''} skipped.` : ''),
        'Import Complete'
      )

      if (skippedRows.length > 0) {
        const preview = skippedRows
          .slice(0, 5)
          .map(row => `Row ${row.row}: ${row.reason}${row.name ? ` (${row.name})` : ''}`)
          .join(' | ')
        toast.warning(`Skipped rows: ${preview}${skippedRows.length > 5 ? ' | ...' : ''}`, 'Import Details')
        logSkippedRows()
      }
    } catch (err) {
      toast.error(`Failed to import Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`, 'Import Failed')
    } finally {
      setIsImporting(false)
      setImportFileName(undefined)
      e.target.value = ''
    }
  }

  const handleExportToExcel = useCallback(async () => {
    if (players.length === 0) {
      toast.warning('No players to export.', 'Export')
      return
    }

    try {
      const { Workbook } = await import('exceljs')
      const enabledSidePots = (sidePots?.pots ?? []).filter(pot => pot.enabled)
      const rows = players.map(player => {
        const row: Record<string, string | number> = {
          'USBC': player.usbc || '',
          'First Name': player.firstName || '',
          'Last Name': player.lastName || '',
          'Division': normalizeDivision(player.division),
          'Lane': player.lane?.toString() || '',
          'Average': Number(player.average || 0),
        }

        enabledBracketPrograms.forEach(program => {
          row[program.name] = Number(player.bracketEntries?.[program.key] || 0)
        })

        enabledSidePots.forEach(pot => {
          row[pot.name] = player.sidePotEntries?.[pot.key] ? 'Yes' : 'No'
        })

        const totalEntries = Object.values(player.bracketEntries || {}).reduce((sum, count) => sum + Number(count || 0), 0)
        const needsEntryFee = totalEntries > 0 && player.totalCost <= 0
        const isPaid = !needsEntryFee && player.amountPaid >= player.totalCost

        row['Total Cost'] = Number(player.totalCost || 0)
        row['Status'] = needsEntryFee ? 'SET FEE' : (isPaid ? 'PAID' : 'DUE')
        row['Amount Paid'] = Number(player.amountPaid || 0)
        return row
      })

      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Entries')
      if (rows.length > 0) {
        worksheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key }))
        worksheet.addRows(rows)
      }

      const safeTournament = (selectedTournament?.name || 'entries')
        .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'entries'
      const safeSquad = selectedSquad
        ? `${selectedSquad.date || ''}_${selectedSquad.time || ''}`.replace(/[^a-zA-Z0-9\-_ ]+/g, '').trim().replace(/\s+/g, '_')
        : 'all_squads'
      const dateStamp = new Date().toISOString().slice(0, 10)
      const fileName = `${safeTournament}_${safeSquad}_entries_${dateStamp}.xlsx`

      const xlsxBuffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${players.length} player${players.length !== 1 ? 's' : ''}.`, 'Export Complete')
    } catch (err) {
      toast.error(`Failed to export Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`, 'Export Failed')
    }
  }, [players, enabledBracketPrograms, sidePots, selectedTournament, selectedSquad, toast])

  const headerActions = useMemo(() => {
    const normalButtons = [
      <button
        key="export"
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={handleExportToExcel}
        disabled={players.length === 0}
      >
        Export to Excel
      </button>,
      <button
        key="import"
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={() => importFileRef.current?.click()}
        disabled={isImporting}
      >
        {isImporting ? 'Importing...' : 'Import from Excel'}
      </button>,
    ]
    return (
      <>
        {normalButtons}
        {isDev && players.length > 0 && (
          <div className={styles.devGroup}>
            <button key="randomize" className={styles.devButton} onClick={handleRandomize}>Randomize Data</button>
            <button key="deleteAll" className={styles.devButton} onClick={handleDeleteAllPlayers} disabled={isDeletingAll}>{isDeletingAll ? 'Deleting...' : 'Delete All'}</button>
          </div>
        )}
      </>
    )
  }, [isDev, players.length, handleRandomize, isImporting, handleDeleteAllPlayers, isDeletingAll, handleExportToExcel])

  usePageHeader({
    title: 'Entries',
    subtitle: undefined,
    actions: headerActions
  })

  // Calculate entry totals
  const entryTotals = useMemo(() => {
    if (!players || players.length === 0) {
      return {
        totalPlayers: 0,
        totalEntries: 0,
        totalRevenue: 0,
        programSummaries: [],
      }
    }

    return summarizeEntries(players, enabledBracketPrograms, bracketSize, entryFee)
  }, [players, enabledBracketPrograms, entryFee, bracketSize])

  // Side pot enrollment counts per enabled pot
  const sidePotSummaries = useMemo(() => {
    if (!sidePots) return []
    return sidePots.pots
      .filter(pot => pot.enabled)
      .map(pot => ({
        key: pot.key,
        name: pot.name,
        count: players.filter(p => p.sidePotEntries?.[pot.key]).length,
        fee: sidePots.entry_fee,
      }))
  }, [sidePots, players])

  const paymentSummary = useMemo(() => {
    const paidCount = players.filter(player => player.amountPaid >= player.totalCost && player.totalCost > 0).length
    const dueCount = players.filter(player => player.totalCost > player.amountPaid).length
    const outstandingAmount = players.reduce((sum, player) => sum + Math.max(0, player.totalCost - player.amountPaid), 0)

    return {
      paidCount,
      dueCount,
      outstandingAmount,
    }
  }, [players])

  // Fetch squad data (similar to scores page) - OPTIMIZED WITH PARALLEL REQUESTS
  useEffect(() => {
    const fetchSquadData = async () => {
      const bootstrapStarted = performance.now();
      try {
        const lastTournamentId = getTournamentId();

        if (!lastTournamentId) {
          return;
        }

        const bootstrap = await apiClient.get<TournamentBootstrapResponse>(
          `/api/v1/tournaments/bootstrap?tournament_id=${lastTournamentId}`,
          false,
        );
        const selectedData = bootstrap?.selected_squad ?? null;
        const squadsData = bootstrap?.squads ?? [];

        if (bootstrap?.tournament) {
          setSelectedTournament(bootstrap.tournament);
        }

        if (bootstrap?.bracket_settings) {
          const settings = bootstrap.bracket_settings;
          const nextEntryFee = typeof settings.default_entry_fee === 'number' ? settings.default_entry_fee : null;
          const normalizedPrograms = normalizeBracketPrograms(settings.bracket_programs, nextEntryFee ?? entryFee);

          if (nextEntryFee != null) {
            setEntryFee(prev => (prev === nextEntryFee ? prev : nextEntryFee));
          }
          setBracketPrograms(prev => (bracketProgramsEqual(prev, normalizedPrograms) ? prev : normalizedPrograms));
          if (typeof settings.bracket_size === 'number') {
            setBracketSize(settings.bracket_size);
          }
        }

        loadSidePots(lastTournamentId);

        const storedSelectedSquadId = getSelectedSquadId();
        const restoredSelectedSquadId = selectedData?.squad_id
          ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null);
        
        // Set selected squad ID
        if (restoredSelectedSquadId && squadsData.some((squad: Squad) => squad.id === restoredSelectedSquadId)) {
          setSelectedSquadId(restoredSelectedSquadId);
        } else {
          setSelectedSquadId(null);
        }
        
        // Set all squads
        setSquads(squadsData);

        logger.info('Players bootstrap load completed', {
          tournamentId: Number(lastTournamentId),
          durationMs: Math.round((performance.now() - bootstrapStarted) * 100) / 100,
          squadsCount: squadsData.length,
          hasSelectedSquad: Boolean(selectedData?.squad_id),
          hasBracketSettings: Boolean(bootstrap?.bracket_settings),
        });
      } catch (error) {
        logger.error('Error fetching squad data:', error);
      }
    };

    if (isInitialized && token) {
      fetchSquadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, token, getTournamentId, loadSidePots, entryFee]);

  // Wait for auth initialization
  if (!isInitialized) {
    return (
      <div className={styles.loadingScreen}>
        <div>Loading player management...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.authRequired}>
        <div className={styles.authRequiredTitle}>Authentication Required</div>
        <div className={styles.authRequiredText}>Please log in to access the players page.</div>
      </div>
    )
  }

  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
    return (
      <NoTournamentState
        description="Load a tournament from the dashboard to manage player entries. Once loaded, you'll be able to add players, set entry fees, and track registrations."
        cards={[
          { title: 'Add Players', text: 'Register bowlers with their name, average, and entry type for scratch or handicap brackets' },
          { title: 'Track Entries', text: 'Monitor scratch and handicap entries, expected brackets, and revenue per squad' },
          { title: 'Manage Fees', text: 'Set entry fees that automatically calculate total costs for each player' },
        ]}
      />
    )
  }

  if (typeof window !== 'undefined' && !getSelectedSquadId()) {
    return (
      <NoTournamentState
        title="No Squad Selected"
        description="Select a squad from the dashboard to manage player entries for that session."
        cards={[
          { title: 'Select a Squad', text: 'Choose a squad from the dashboard to view and manage its player entries' },
        ]}
      />
    )
  }

  return (
    <ErrorBoundary>
      <div className={styles.pageContainer}>
        <ImportLoadingModal isOpen={isImporting} fileName={importFileName} />
        {/* Hidden file input for Excel import — triggered by header button */}
        <input
          ref={importFileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImportFileSelected}
          className="sr-only"
        />

        <div className={styles.formCard}>
          {isMobileView ? (
            <button
              type="button"
              className={styles.formTitleToggle}
              aria-expanded={!historySearchCollapsed}
              onClick={() => setHistorySearchCollapsed(previous => !previous)}
            >
              <span>Bowler History Search</span>
              <span className={styles.formTitleExpandIcon}>{historySearchCollapsed ? '+' : '−'}</span>
            </button>
          ) : (
            <h3 className={styles.formTitle}>Bowler History Search</h3>
          )}
          {(!isMobileView || !historySearchCollapsed) && (
          <div className={styles.historyPanelBody}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="USBC #"
                value={historySearchUsbc}
                onChange={(event) => setHistorySearchUsbc(event.target.value)}
              />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="First Name"
                value={historySearchFirstName}
                onChange={(event) => setHistorySearchFirstName(event.target.value)}
              />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Last Name"
                value={historySearchLastName}
                onChange={(event) => setHistorySearchLastName(event.target.value)}
              />
              <button
                type="button"
                className={styles.clearFilters}
                onClick={() => {
                  setHistorySearchUsbc('')
                  setHistorySearchFirstName('')
                  setHistorySearchLastName('')
                  setHistoryResults([])
                }}
              >
                Clear
              </button>
            </div>

            {isHistorySearching ? (
              <p className={styles.historyMeta}>Searching bowler history...</p>
            ) : historyResults.length === 0 ? (
              <p className={styles.historyMeta}>Type USBC, first name, or last name to find prior bowlers.</p>
            ) : (
              <div className={styles.historyResultsList}>
                {historyResults.map(profile => (
                  <button
                    key={profile.id}
                    type="button"
                    className={styles.historyResultButton}
                    onClick={() => handleUseHistoryResult(profile)}
                  >
                    <span className={styles.historyResultName}>{profile.first_name} {profile.last_name}</span>
                    <span className={styles.historyResultUsbc}>{profile.usbc_number ? `USBC ${profile.usbc_number}` : 'No USBC on file'}</span>
                    <span className={styles.historyResultAction}>Use in Add Form</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        <PlayerForm
          onAddPlayer={addPlayer}
          isLoading={isLoading}
          squads={squads}
          entryFee={entryFee}
          bracketPrograms={enabledBracketPrograms}
          prefillDraft={prefillDraft}
          prefillVersion={prefillVersion}
        />

        {isLoading ? (
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonText}>Loading players...</div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={styles.skeletonGrid}>
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <div key={j} className={styles.skeletonItem} />
                ))}
              </div>
            ))}
          </div>
        ) : !getTournamentId() ? (
          <div className={styles.noTournament}>
            <div className={styles.noTournamentTitle}>No Tournament Loaded</div>
            <div className={styles.noTournamentText}>
              Please load a tournament from the dashboard to manage players.
            </div>
            <a href="/dashboard" className={styles.dashboardLink}>
              Go to Dashboard
            </a>
          </div>
        ) : (
          <>
            <div className={styles.entriesSectionWidth}>
              {getTournamentId() && players.length > 0 && (
                <div className={styles.summaryCard}>
                  <h3 className={styles.summaryTitle}>Tournament Summary</h3>
                  <div className={styles.mobileSummaryChips}>
                    <div className={styles.mobileSummaryChip}>Paid: {paymentSummary.paidCount}</div>
                    <div className={styles.mobileSummaryChip}>Due: {paymentSummary.dueCount}</div>
                    <div className={styles.mobileSummaryChip}>Outstanding: ${paymentSummary.outstandingAmount.toLocaleString()}</div>
                  </div>
                  <div className={styles.summaryGrid}>
                    <div className={styles.statBox}>
                      <div className={styles.statValue}>{entryTotals.totalPlayers}</div>
                      <div className={styles.statLabel}>Players</div>
                    </div>

                      {entryTotals.programSummaries.map(program => (
                        <div key={program.key} className={styles.statBox}>
                          <div className={styles.statValue}>~{program.totalEntries}</div>
                          <div className={styles.statLabel}>{program.name}</div>
                          <div className={styles.statDetail}>{program.expectedBrackets} bracket{program.expectedBrackets !== 1 ? 's' : ''}</div>
                          {program.refunds > 0 && (
                            <div className={styles.statRefund}>~{program.refunds} refund{program.refunds !== 1 ? 's' : ''}</div>
                          )}
                        </div>
                      ))}

                      {sidePotSummaries.map(pot => (
                        <div key={pot.key} className={styles.statBox}>
                          <div className={styles.statValue}>{pot.count}</div>
                          <div className={styles.statLabel}>{pot.name}</div>
                          {pot.fee > 0 && (
                            <div className={styles.statDetail}>${(pot.count * pot.fee).toLocaleString()}</div>
                          )}
                        </div>
                      ))}

                    <div className={`${styles.statBox} ${styles.statBoxRevenue}`}>
                      <div className={styles.statValue}>${entryTotals.totalRevenue.toLocaleString()}</div>
                      <div className={styles.statLabel}>Revenue</div>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.formCard}>
                {isMobileView ? (
                  <button
                    type="button"
                    className={styles.formTitleToggle}
                    aria-expanded={!tableSearchCollapsed}
                    onClick={() => setTableSearchCollapsed(previous => !previous)}
                  >
                    <span>Entries Table Search</span>
                    <span className={styles.formTitleExpandIcon}>{tableSearchCollapsed ? '+' : '−'}</span>
                  </button>
                ) : (
                  <h3 className={styles.formTitle}>Entries Table Search</h3>
                )}
                {(!isMobileView || !tableSearchCollapsed) && (
                <div className={styles.tableSearchPanelBody}>
                  <div className={`${styles.searchContainer} ${styles.searchContainerSticky}`}>
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Search USBC #"
                      value={searchUsbc}
                      onChange={(event) => setSearchUsbc(event.target.value)}
                    />
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Search First Name"
                      value={searchFirstName}
                      onChange={(event) => setSearchFirstName(event.target.value)}
                    />
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Search Last Name"
                      value={searchLastName}
                      onChange={(event) => setSearchLastName(event.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.clearFilters}
                      onClick={() => {
                        setSearchUsbc('')
                        setSearchFirstName('')
                        setSearchLastName('')
                      }}
                    >
                      Clear Search
                    </button>
                  </div>
                </div>
                )}
              </div>

              <div className={styles.tableCard}>
                <PlayersTable
                  players={players}
                  onUpdatePlayer={handleUpdatePlayer}
                  onDeletePlayer={handleDeletePlayer}
                  savingStatus={savingStatus}
                  entryFee={entryFee}
                  bracketPrograms={enabledBracketPrograms}
                  selectedSquad={selectedSquad}
                  sidePots={sidePots}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <ActionConfirmDialog
        open={deleteAllPlayersConfirmOpen}
        title="Delete All Players?"
        message={`Delete all ${players.length} players? This cannot be undone.`}
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        onCancel={() => setDeleteAllPlayersConfirmOpen(false)}
        onConfirm={() => {
          setDeleteAllPlayersConfirmOpen(false)
          void executeDeleteAllPlayers()
        }}
      />

      {deleteConfirmId !== null && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <CloseControl onClick={() => setDeleteConfirmId(null)} position="absolute" size="sm" label="Close delete player dialog" />
            <h2 className={styles.confirmTitle}>Delete Player</h2>
            <p className={styles.confirmMessage}>Are you sure you want to delete this player? This cannot be undone.</p>
            <div className={styles.confirmButtons}>
              <button
                className={styles.confirmCancel}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDelete}
                onClick={() => {
                  deletePlayer(deleteConfirmId!)
                  setDeleteConfirmId(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  )
}





