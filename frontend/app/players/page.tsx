'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { usePlayers } from './hooks/usePlayers'
import { useBowlerHistorySearch } from './hooks/useBowlerHistorySearch'
import { usePlayerSidePots } from './hooks/usePlayerSidePots'
import { usePlayerTournamentSetup } from './hooks/usePlayerTournamentSetup'
import { buildImportIdentity, buildEntriesExcelBuffer, ImportablePlayer, parseExcelPlayers } from './utils/importPlayers'
import { useTournaments } from '../hooks/useTournaments'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import PlayersTable from './components/PlayersTable'
import PlayerForm from './components/PlayerForm'
import NoTournamentState from '../components/NoTournamentState'
import { logger } from '../lib/logger'
import { Squad, Player, PlayerFormPrefillDraft } from './types'
import { BracketProgramDefinition, Tournament } from '../lib/types'
import { apiClient, API, apiFetch } from '../lib/api'
import { calculatePlayerTotalCost, calculateSidePotCost, defaultBracketPrograms, filterEntriesForDivision, getEnabledBracketPrograms, normalizeBracketPrograms, normalizeDivision, normalizePlayerBracketEntries, summarizeEntries } from '../lib/bracketPrograms'
import styles from './entries.module.css'
import cardStyles from '../styles/cards.module.css'
import buttonStyles from '../styles/buttons.module.css'
import badgeStyles from '../styles/badges.module.css'
import formStyles from '../styles/forms.module.css'
import shellStyles from '../styles/page-shell.module.css'
import toolbarStyles from '../styles/toolbars.module.css'
import ExplainEntriesModal from './ExplainEntriesModal'
import { useToastHelpers } from '../components/Toast'
import ImportLoadingModal from '../components/ImportLoadingModal'
import { getSelectedSquadId, getSelectedTournamentId, setSelectedSquad } from '../lib/selection-session'
import { resetScrollLocks, setBodyInteractionState } from '../utils/modalUtils'

function bracketProgramsEqual(left: BracketProgramDefinition[], right: BracketProgramDefinition[]): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    const l = left[i]
    const r = right[i]
    if (!l || !r) return false
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
  const { isUserAuthenticated, isAuthInitialized, authToken, currentUser } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0)
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const id = getSelectedSquadId()
    return id ? Number(id) : null
  })
  const [squads, setSquads] = useState<Squad[]>([])
  const [entryFee, setEntryFee] = useState<number>(25) // Default $25, will be loaded from tournament settings
  const [bracketSize, setBracketSize] = useState<number>(8) // Default 8, will be loaded from tournament settings
  const [bracketPrograms, setBracketPrograms] = useState<BracketProgramDefinition[]>(defaultBracketPrograms)
  const [prefillDraft, setPrefillDraft] = useState<PlayerFormPrefillDraft | null>(null)
  const [prefillVersion, setPrefillVersion] = useState(0)
  const [searchUsbc, setSearchUsbc] = useState('')
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')
  const [isMobileView, setIsMobileView] = useState(false)
  const [historySearchCollapsed, setHistorySearchCollapsed] = useState(false)
  const [tableSearchCollapsed, setTableSearchCollapsed] = useState(false)
  const debouncedSearchUsbc = useDebouncedValue(searchUsbc, 300)
  const debouncedSearchFirstName = useDebouncedValue(searchFirstName, 300)
  const debouncedSearchLastName = useDebouncedValue(searchLastName, 300)
  const enabledBracketPrograms = useMemo(() => getEnabledBracketPrograms(bracketPrograms), [bracketPrograms])
  const {
    historySearchUsbc,
    setHistorySearchUsbc,
    historySearchFirstName,
    setHistorySearchFirstName,
    historySearchLastName,
    setHistorySearchLastName,
    historyResults,
    setHistoryResults,
    isHistorySearching,
    hasHistorySearchInput,
    triggerHistorySearch,
    clearHistorySearch,
  } = useBowlerHistorySearch(authToken)

  useEffect(() => {
    resetScrollLocks()
    setBodyInteractionState({ scrollLocked: false, touchLocked: false })

    return () => {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false })
    }
  }, [])

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
  


  // Helper function to get tournament ID from various sources
  const getTournamentId = useCallback(() => {
    return getSelectedTournamentId()
  }, []);

  const getStorageItem = useCallback((key: string) => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  }, [])

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

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
  }, [tournaments, selectedTournament, selectionRefreshKey])

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

  // Debug authentication state
  useEffect(() => {
    logger.debug('Players page auth state', {
      isAuthenticated: isUserAuthenticated,
      isInitialized: isAuthInitialized,
      hasToken: !!authToken,
      hasUser: !!currentUser,
      tokenFromStorage: !!(sessionStorage.getItem('token') || localStorage.getItem('token')),
      userIdFromStorage: !!localStorage.getItem('user_id')
    });
  }, [isUserAuthenticated, isAuthInitialized, authToken, currentUser]);

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
    authToken,
    entryFee,
    bracketPrograms: enabledBracketPrograms,
    getItem: getStorageItem,
    searchUsbc: debouncedSearchUsbc,
    searchFirstName: debouncedSearchFirstName,
    searchLastName: debouncedSearchLastName,
  })

  const {
    sidePots,
    players,
    loadSidePots,
    persistPlayerSidePotEntries,
    mergeAndPersistSidePotEntries,
  } = usePlayerSidePots(rawPlayers)

  const { loadEntryFee } = usePlayerTournamentSetup({
    isAuthInitialized,
    authToken,
    selectionRefreshKey,
    entryFee,
    getTournamentId,
    loadSidePots,
    bracketProgramsEqual,
    setSelectedTournament,
    setEntryFee,
    setBracketPrograms,
    setBracketSize,
    setSelectedSquadId,
    setSquads,
  })

  const handleUseHistoryResult = useCallback((profile: { first_name: string; last_name: string; usbc_number?: string | null }) => {
    setPrefillDraft({
      firstName: profile.first_name,
      lastName: profile.last_name,
      usbc: profile.usbc_number || '',
    })
    clearHistorySearch()
    setPrefillVersion(prev => prev + 1)
  }, [clearHistorySearch])

  useEffect(() => {
    const handleSettingsChanged = () => {
      cancelPendingPatches()
      void loadEntryFee()
      void loadPlayers()
    }

    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [cancelPendingPatches, loadEntryFee, loadPlayers])

  const hasActiveEntryFilters = Boolean(searchUsbc.trim() || searchFirstName.trim() || searchLastName.trim())

  const formatSquadDateLabel = useCallback((isoDate?: string) => {
    if (!isoDate) return 'Date pending'
    const parsedDate = new Date(isoDate)
    if (Number.isNaN(parsedDate.getTime())) return isoDate
    return parsedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }, [])

  const entriesTableSubtitle = useMemo(() => {
    if (!selectedSquad) return 'No squad selected'
    const dateLabel = formatSquadDateLabel(selectedSquad.date)
    const timeLabel = selectedSquad.time || 'Time pending'
    return `${dateLabel} · ${timeLabel} Squad`
  }, [formatSquadDateLabel, selectedSquad])

  // Adapter function to match PlayersTable expected signature
  const handleUpdatePlayer = useCallback((playerId: number, field: string, value: string | number | boolean) => {
    let updates: Partial<Player>

    if (field.startsWith('bracketEntry:')) {
      const programKey = field.split(':', 2)[1]
      if (!programKey) return
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
      if (!potKey) return
      const existingPlayer = players.find(player => player.id === playerId)
      const nextSidePotEntries = {
        ...(existingPlayer?.sidePotEntries || {}),
        [potKey]: Boolean(value),
      }
      // Persist to localStorage
      const tournamentId = getTournamentId()
      persistPlayerSidePotEntries(tournamentId, playerId, nextSidePotEntries)
      // No API call — side pot entries are localStorage only
      return
    } else {
      updates = { [field]: value };
    }

    updatePlayer(playerId, updates);
  }, [players, updatePlayer, getTournamentId, persistPlayerSidePotEntries]);

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

    const updates: UpdateRow[] = current.flatMap(player => {
      if (!Number.isFinite(player.id)) {
        return []
      }
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
      return [{
        id: player.id,
        average: Math.floor(Math.random() * 91) + 140,
        handicap_entries: programEntryCounts.handicap ?? 0,
        scratch_entries: programEntryCounts.scratch ?? 0,
        program_entry_counts: programEntryCounts,
      }]
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
    mergeAndPersistSidePotEntries(tournamentId, randomizedSidePotEntries)

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
      const result = await apiClient.bulkPatch<{ updated?: number }>('/api/v1/bowlers/bulk-update', updatesWithPaid)
      const updatedCount = typeof result?.updated === 'number' ? result.updated : updatesWithPaid.length
      if (updatedCount < updatesWithPaid.length) {
        throw new Error(`Only persisted ${updatedCount} of ${updatesWithPaid.length} randomized updates`)
      }
    } catch (err) {
      logger.error('Bulk randomize failed', { error: err })
    }
  }, [enabledBracketPrograms, entryFee, sidePots, getTournamentId, bulkSetPlayers, cancelPendingPatches, mergeAndPersistSidePotEntries])

  const isDev = process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [deleteAllPlayersConfirmOpen, setDeleteAllPlayersConfirmOpen] = useState(false)
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false)

  // Import from Excel — file input ref lives here so the button can be in the header
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importFileName, setImportFileName] = useState<string | undefined>(undefined)
  const toast = useToastHelpers()

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
      const { players: imported, skippedRows } = await parseExcelPlayers(file, enabledBracketPrograms, entryFee)
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
      if (result.successCount > 0) {
        void loadPlayers()
      }
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
      const { buffer, fileName } = await buildEntriesExcelBuffer(
        players,
        enabledBracketPrograms,
        sidePots,
        selectedTournament,
        selectedSquad,
      )
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
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

  usePageHeader({
    title: 'Entries',
    subtitle: undefined,
    actions: undefined
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

  const orderedProgramSummaries = useMemo(() => {
    const programOrder: Record<string, number> = {
      handicap: 0,
      scratch: 1,
      reverse_scratch: 2,
      womens_scratch: 3,
    }

    return [...entryTotals.programSummaries].sort((a, b) => {
      const aOrder = programOrder[a.key] ?? Number.MAX_SAFE_INTEGER
      const bOrder = programOrder[b.key] ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      return a.name.localeCompare(b.name)
    })
  }, [entryTotals.programSummaries])

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

  // Wait for auth initialization
  if (!isAuthInitialized) {
    return (
      <div className={styles.loadingScreen}>
        <div>Loading player management...</div>
      </div>
    );
  }

  if (!isUserAuthenticated) {
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
        title="Entries Board Standing By"
        description="Load a tournament to start rostering bowlers, assigning entry types, and tracking registration flow."
        cards={[
          { title: 'Build the Roster', text: 'Add bowlers with averages, divisions, and entry type so each squad has clean participant data.' },
          { title: 'Track Entry Mix', text: 'Monitor scratch vs handicap participation and projected bracket volume per squad.' },
          { title: 'Keep Fees Aligned', text: 'Use consistent entry settings so totals and expected revenue stay accurate.' },
        ]}
      />
    )
  }

  if (typeof window !== 'undefined' && !getSelectedSquadId()) {
    return (
      <NoTournamentState
        title="Entries Need a Squad"
        description="Choose a squad from the dashboard to open the player list for that session."
        cards={[
          { title: 'Pick a Session', text: 'Select the correct squad first, then add and manage entries for that lineup.' },
        ]}
      />
    )
  }

  const showInitialPlayersLoad = isLoading && players.length === 0
  return (
    <ErrorBoundary>
      <div className={`${shellStyles.page} ${styles.pageContainer}`}>
        <ImportLoadingModal isOpen={isImporting} fileName={importFileName} />
        {/* Hidden file input for Excel import — triggered by header button */}
        <input
          ref={importFileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImportFileSelected}
          className="sr-only"
        />

        <div className={`${shellStyles.section} ${styles.entriesSectionWidth}`}>
          <div className={`${cardStyles.card} ${cardStyles.accentCard} ${cardStyles.quickActionsCard} ${styles.formCard}`}>
            <h3 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle} ${styles.formTitle}`}>Quick Actions</h3>
            <div className={cardStyles.quickActionsBody}>
              <div className={cardStyles.quickActionsRow}>
                <div className={cardStyles.quickActionsGroupLeft}>
                <button
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
                  onClick={() => setIsExplainModalOpen(true)}
                >
                  Entries Guide
                </button>
                <button
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
                  onClick={handleExportToExcel}
                  disabled={players.length === 0}
                >
                  Export to Excel
                </button>
                <button
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
                  onClick={() => importFileRef.current?.click()}
                  disabled={isImporting}
                >
                  {isImporting ? 'Importing...' : 'Import from Excel'}
                </button>
                </div>
                {isDev && players.length > 0 && (
                  <div className={cardStyles.quickActionsGroupRight}>
                    <button className={`${cardStyles.quickActionControl} ${styles.devButton} ${styles.quickActionDevBtn}`} onClick={handleRandomize}>Randomize Data</button>
                    <button className={`${cardStyles.quickActionControl} ${styles.devButton} ${styles.quickActionDangerBtn}`} onClick={handleDeleteAllPlayers} disabled={isDeletingAll}>{isDeletingAll ? 'Deleting...' : 'Delete All'}</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.entryWorkflowLayout}>
              <div className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.formCard} ${styles.findBowlerCard}`}>
            {isMobileView ? (
              <button
                type="button"
                className={`${cardStyles.cardHeader} ${styles.formTitleToggle}`}
                aria-expanded={!historySearchCollapsed}
                onClick={() => setHistorySearchCollapsed(previous => !previous)}
              >
                <span>Find Existing Bowler</span>
                <span className={styles.formTitleExpandIcon}>{historySearchCollapsed ? '+' : '−'}</span>
              </button>
            ) : (
              <h3 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${styles.formTitle}`}>Find Existing Bowler</h3>
            )}
            {(!isMobileView || !historySearchCollapsed) && (
            <div className={styles.historyPanelBody}>
              <div className={`${toolbarStyles.toolbar} ${styles.searchContainer} ${styles.findBowlerSearchRow}`}>
                <input
                  type="text"
                  className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${styles.findBowlerInput}`}
                  placeholder="USBC #"
                  value={historySearchUsbc}
                  onChange={(event) => setHistorySearchUsbc(event.target.value)}
                />
                <input
                  type="text"
                  className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${styles.findBowlerInput}`}
                  placeholder="First Name"
                  value={historySearchFirstName}
                  onChange={(event) => setHistorySearchFirstName(event.target.value)}
                />
                <input
                  type="text"
                  className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${styles.findBowlerInput}`}
                  placeholder="Last Name"
                  value={historySearchLastName}
                  onChange={(event) => setHistorySearchLastName(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.searchActionBtn}
                  onClick={triggerHistorySearch}
                  disabled={!hasHistorySearchInput}
                >
                  Find Bowler
                </button>
                <button
                  type="button"
                  className={`${styles.clearSearchBtn} ${hasHistorySearchInput ? styles.clearSearchBtnActive : ''}`}
                  onClick={clearHistorySearch}
                  disabled={!hasHistorySearchInput}
                >
                  Clear
                </button>
              </div>

              {isHistorySearching ? (
                <p className={styles.historyMeta}>Searching bowler history...</p>
              ) : historyResults.length > 0 ? (
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
              ) : null}
            </div>
            )}
              </div>

              <PlayerForm
                onAddPlayer={addPlayer}
                isLoading={showInitialPlayersLoad}
                squads={squads}
                entryFee={entryFee}
                bracketPrograms={enabledBracketPrograms}
                prefillDraft={prefillDraft}
                prefillVersion={prefillVersion}
              />
          </div>

          {showInitialPlayersLoad ? (
            <div className={`${cardStyles.card} ${styles.skeletonCard}`}>
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
            <NoTournamentState
              description="Load a tournament from the dashboard to manage entries, add bowlers, assign squads, and track fees."
              cards={[
                { title: 'Add Bowlers', text: 'Register players with averages, lanes, squads, and bracket program entries.' },
                { title: 'Track Revenue', text: 'Review paid entries, outstanding fees, side pots, and projected bracket counts.' },
                { title: 'Import & Export', text: 'Bring in entries from Excel or export the current roster when staff need a copy.' },
              ]}
            />
          ) : (
            <>
              {getTournamentId() && players.length > 0 && (
                <div className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.summaryCard}`}>
                  <div className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${styles.summaryHeader}`}>
                    <div className={`${cardStyles.cardHeaderRow} ${styles.summaryTitleWrap}`}>
                      <h3 className={`${cardStyles.cardTitle} ${styles.summaryTitle}`}>Tournament Summary</h3>
                      <p className={styles.summarySubtitle}>Live totals for entries, revenue, and active pots.</p>
                    </div>
                    <div className={styles.summaryPaymentStrip}>
                      <span className={`${badgeStyles.badge} ${badgeStyles.success}`}>{paymentSummary.paidCount} Paid</span>
                      <span className={`${badgeStyles.badge} ${paymentSummary.dueCount > 0 ? badgeStyles.warning : badgeStyles.muted}`}>{paymentSummary.dueCount} Due</span>
                      <span className={`${badgeStyles.badge} ${paymentSummary.outstandingAmount > 0 ? badgeStyles.accent : badgeStyles.muted}`}>${paymentSummary.outstandingAmount.toLocaleString()} Outstanding</span>
                    </div>
                  </div>
                  <div className={styles.summaryGrid}>
                    <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                      <div className={`${cardStyles.statValue} ${styles.statValue}`}>{entryTotals.totalEntries}</div>
                      <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Total Entries</div>
                    </div>

                    <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                      <div className={`${cardStyles.statValue} ${styles.statValue}`}>${entryTotals.totalRevenue.toLocaleString()}</div>
                      <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Entry Revenue</div>
                      <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>{entryTotals.totalEntries} entries × ${Number(entryFee).toLocaleString()}</div>
                    </div>

                      {orderedProgramSummaries.map(program => (
                        <div key={program.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                          <div className={`${cardStyles.statValue} ${styles.statValue}`}>{program.totalEntries}</div>
                          <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{program.key === 'handicap' ? 'Handicap' : program.key === 'scratch' ? 'Scratch' : program.key === 'reverse_scratch' ? 'Reverse Scratch' : program.key === 'womens_scratch' ? 'Women\'s Scratch' : program.name}</div>
                          <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>Projected {program.expectedBrackets} brackets</div>
                          {program.refunds > 0 && (
                            <div className={styles.statRefund}>{program.refunds} overflow entries</div>
                          )}
                        </div>
                      ))}

                      {sidePotSummaries.map(pot => (
                        <div key={pot.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
                          <div className={`${cardStyles.statValue} ${styles.statValue}`}>{pot.count}</div>
                          <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{pot.name}</div>
                          {pot.fee > 0 && (
                            <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>Pot Total: ${(pot.count * pot.fee).toLocaleString()}</div>
                          )}
                        </div>
                      ))}

                  </div>
                </div>
              )}

              <div className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.formCard} ${styles.standaloneEntrySearchCard}`}>
                {isMobileView ? (
                  <button
                    type="button"
                    className={`${cardStyles.cardHeader} ${styles.formTitleToggle}`}
                    aria-expanded={!tableSearchCollapsed}
                    onClick={() => setTableSearchCollapsed(previous => !previous)}
                  >
                    <span>Find Entry</span>
                    <span className={styles.formTitleExpandIcon}>{tableSearchCollapsed ? '+' : '−'}</span>
                  </button>
                ) : (
                  <h3 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${styles.formTitle}`}>Find Entry</h3>
                )}
                {(!isMobileView || !tableSearchCollapsed) && (
                <div className={styles.tableSearchPanelBody}>
                  <p className={styles.findEntryHelperText}>Search by USBC number, first name, or last name.</p>
                  <div className={`${toolbarStyles.toolbar} ${styles.searchContainer} ${styles.searchContainerSticky}`}>
                    <input
                      type="text"
                      className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput}`}
                      placeholder="USBC #"
                      value={searchUsbc}
                      onChange={(event) => setSearchUsbc(event.target.value)}
                    />
                    <input
                      type="text"
                      className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput}`}
                      placeholder="First name"
                      value={searchFirstName}
                      onChange={(event) => setSearchFirstName(event.target.value)}
                    />
                    <input
                      type="text"
                      className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput}`}
                      placeholder="Last name"
                      value={searchLastName}
                      onChange={(event) => setSearchLastName(event.target.value)}
                    />
                    <button
                      type="button"
                      className={`${styles.clearSearchBtn} ${hasActiveEntryFilters ? styles.clearSearchBtnActive : ''}`}
                      onClick={() => {
                        setSearchUsbc('')
                        setSearchFirstName('')
                        setSearchLastName('')
                      }}
                      disabled={!hasActiveEntryFilters}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                )}
              </div>

              <div className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.tableCard}`}>
                <div className={`${cardStyles.cardHeader} ${styles.entriesTableHeader}`}>
                  <div className={styles.entriesTableHeaderCopy}>
                    <h3 className={`${cardStyles.cardTitle} ${styles.entriesTableTitle}`}>Entries</h3>
                    <p className={styles.entriesTableSubtitle}>{entriesTableSubtitle}</p>
                  </div>
                </div>
                <div className={`${cardStyles.cardHeader} ${styles.entriesSearchDock}`}>
                  {isMobileView ? (
                    <button
                      type="button"
                      className={`${cardStyles.cardHeader} ${styles.formTitleToggle} ${styles.entriesSearchToggle}`}
                      aria-expanded={!tableSearchCollapsed}
                      onClick={() => setTableSearchCollapsed(previous => !previous)}
                    >
                      <span>Find Entry</span>
                      <span className={styles.formTitleExpandIcon}>{tableSearchCollapsed ? '+' : '-'}</span>
                    </button>
                  ) : (
                    <div className={styles.entriesSearchLabelRow}>
                      <h3 className={styles.entriesSearchTitle}>Find Entry</h3>
                      <p className={styles.findEntryHelperText}>Search by USBC number, first name, or last name.</p>
                    </div>
                  )}
                  {(!isMobileView || !tableSearchCollapsed) && (
                    <div className={styles.tableSearchPanelBody}>
                      {isMobileView && (
                        <p className={styles.findEntryHelperText}>Search by USBC number, first name, or last name.</p>
                      )}
                      <div className={`${toolbarStyles.toolbar} ${styles.searchContainer} ${styles.searchContainerSticky}`}>
                        <input
                          type="text"
                          className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput}`}
                          placeholder="USBC #"
                          value={searchUsbc}
                          onChange={(event) => setSearchUsbc(event.target.value)}
                        />
                        <input
                          type="text"
                          className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput}`}
                          placeholder="First name"
                          value={searchFirstName}
                          onChange={(event) => setSearchFirstName(event.target.value)}
                        />
                        <input
                          type="text"
                          className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput}`}
                          placeholder="Last name"
                          value={searchLastName}
                          onChange={(event) => setSearchLastName(event.target.value)}
                        />
                        <button
                          type="button"
                          className={`${styles.clearSearchBtn} ${hasActiveEntryFilters ? styles.clearSearchBtnActive : ''}`}
                          onClick={() => {
                            setSearchUsbc('')
                            setSearchFirstName('')
                            setSearchLastName('')
                          }}
                          disabled={!hasActiveEntryFilters}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <PlayersTable
                  players={players}
                  onUpdatePlayer={handleUpdatePlayer}
                  onDeletePlayer={handleDeletePlayer}
                  savingStatus={savingStatus}
                  entryFee={entryFee}
                  bracketPrograms={enabledBracketPrograms}
                  selectedSquad={selectedSquad}
                  sidePots={sidePots}
                  hasActiveFilters={hasActiveEntryFilters}
                  onClearFilters={() => {
                    setSearchUsbc('')
                    setSearchFirstName('')
                    setSearchLastName('')
                  }}
                />
              </div>
            </>
          )}
        </div>
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

      <ActionConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete Player?"
        message="Delete this player? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId === null) return
          deletePlayer(deleteConfirmId)
          setDeleteConfirmId(null)
        }}
      />
      <ExplainEntriesModal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
      />
    </ErrorBoundary>
  )
}





