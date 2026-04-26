'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { usePlayers } from './hooks/usePlayers'
import { useTournaments } from '../hooks/useTournaments'
import PlayersTable from './components/PlayersTable'
import PlayerForm from './components/PlayerForm'
import NoTournamentState from '../components/NoTournamentState'
import { logger } from '../lib/logger'
import { Squad, Player } from './types'
import { BracketProgramDefinition, BracketSettings, Tournament } from '../lib/types'
import { apiClient, API } from '../lib/api'
import { calculatePlayerTotalCost, defaultBracketPrograms, getEnabledBracketPrograms, normalizeBracketPrograms, normalizePlayerBracketEntries, summarizeEntries } from '../lib/bracketPrograms'
import styles from './entries.module.css'
import { useToastHelpers } from '../components/Toast'
import ImportLoadingModal from '../components/ImportLoadingModal'


export default function PlayersPage() {
  const { isAuthenticated, isInitialized, token, user } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null)
  const [squads, setSquads] = useState<Squad[]>([])
  const [entryFee, setEntryFee] = useState<number>(25) // Default $25, will be loaded from tournament settings
  const [bracketSize, setBracketSize] = useState<number>(8) // Default 8, will be loaded from tournament settings
  const [bracketPrograms, setBracketPrograms] = useState<BracketProgramDefinition[]>(defaultBracketPrograms)
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false)
  const enabledBracketPrograms = useMemo(() => getEnabledBracketPrograms(bracketPrograms), [bracketPrograms])
  


  // Helper function to get tournament ID from various sources
  const getTournamentId = useCallback(() => {
    // Use localStorage.getItem directly like the scores page does
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    return lastTournamentId;
  }, []);

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select tournament from localStorage
  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedTournamentId = localStorage.getItem('lastTournamentId')
      if (storedTournamentId) {
        const storedTournament = tournaments.find(t => t.id === parseInt(storedTournamentId))
        if (storedTournament) {
          setSelectedTournament(storedTournament)
        }
      }
    }
  }, [tournaments, selectedTournament])

  // Load entry fee from tournament bracket settings
  const loadEntryFee = useCallback(async () => {
    if (!token) {
      return;
    }
    
    const tournamentId = getTournamentId();
    
    if (!tournamentId) {
      return;
    }
    
    try {
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`);
      
      if (settings && typeof settings.default_entry_fee === 'number') {
        setEntryFee(settings.default_entry_fee);
        logger.info(`Loaded entry fee from tournament settings: $${settings.default_entry_fee}`);
      }
      setBracketPrograms(normalizeBracketPrograms(settings?.bracket_programs, settings?.default_entry_fee ?? entryFee))
      if (settings && typeof settings.bracket_size === 'number') {
        setBracketSize(8);
      }
    } catch (error) {
      logger.warn('Failed to load bracket settings, using default entry fee:', error);
      setBracketPrograms(normalizeBracketPrograms(undefined, entryFee))
    } finally {
      setInitialLoadComplete(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Load entry fee when tournament or auth changes
  useEffect(() => {
    loadEntryFee();
  }, [loadEntryFee]);

  // Reload entry fee when page becomes visible (handles navigation back from Dashboard)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadEntryFee();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadEntryFee]);

  // Also reload when component becomes focused (user clicks on the page)
  useEffect(() => {
    const handleFocus = () => {
      loadEntryFee();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadEntryFee]);
  
  const selectedSquad = squads.find(squad => squad.id === selectedSquadId) || null

  useEffect(() => {
    if (selectedSquadId !== null) {
      localStorage.setItem('selected_squad_id', String(selectedSquadId));
    }
  }, [selectedSquadId]);

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
    players,
    isLoading,
    savingStatus,
    addPlayer,
    importPlayers,
    updatePlayer,
    cancelPendingPatches,
    deletePlayer,
    bulkSetPlayers,
  } = usePlayers({
    selectedSquad,
    squads,
    authToken: token,
    entryFee,
    bracketPrograms: enabledBracketPrograms,
    getItem: (key: string) => localStorage.getItem(key)
  })

  // Adapter function to match PlayersTable expected signature
  const handleUpdatePlayer = useCallback((playerId: number, field: string, value: string | number) => {
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
    } else {
      updates = { [field]: value };
    }

    updatePlayer(playerId, updates);
  }, [players, updatePlayer]);

  // Stable ref so handleRandomize never needs players in its dep array
  const playersRef = useRef<typeof players>([])
  useEffect(() => { playersRef.current = players }, [players])

  // DEV ONLY: build all random data in memory, then do ONE setPlayers + ONE bulk API call
  const handleRandomize = useCallback(async () => {
    const current = playersRef.current

    type UpdateRow = {
      id: number
      average: number
      handicap_entries: number
      scratch_entries: number
      program_entry_counts: Record<string, number>
    }

    const updates: UpdateRow[] = current.map(player => {
      const programEntryCounts = Object.fromEntries(
        enabledBracketPrograms.map(program => [
          program.key,
          Math.floor(Math.random() * 16),
        ]),
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

    // Single state update — no cascade
    // Compute costs first so we can set amountPaid = totalCost (all PAID)
    const costMap = new Map(
      updates.map(u => [
        u.id,
        calculatePlayerTotalCost(u.program_entry_counts, enabledBracketPrograms, entryFee),
      ])
    )

    bulkSetPlayers(prev => prev.map(player => {
      const u = updateMap.get(player.id)
      if (!u) return player
      const bracketEntries = u.program_entry_counts
      const totalCost = costMap.get(player.id) ?? 0
      return {
        ...player,
        average: u.average,
        handicap: u.handicap_entries,
        scratch: u.scratch_entries,
        bracketEntries,
        totalCost,
        amountPaid: totalCost,
      }
    }))

    // Include amount_paid in the bulk write so it persists
    const updatesWithPaid = updates.map(u => ({
      ...u,
      amount_paid: costMap.get(u.id) ?? 0,
    }))

    cancelPendingPatches()
    try {
      await apiClient.bulkPatch('/api/v1/bowlers/bulk-update', updatesWithPaid)
    } catch (err) {
      console.error('Bulk randomize failed', err)
    }
  }, [enabledBracketPrograms, entryFee, bulkSetPlayers, cancelPendingPatches])

  const isDev = process.env.NODE_ENV === 'development'
  const [isDeletingAll, setIsDeletingAll] = useState(false)

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

  const parseExcelPlayers = async (file: File) => {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.SheetNames[0]
    if (!firstSheet) return []
    const worksheet = workbook.Sheets[firstSheet]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
    return rawRows.map((rawRow) => {
      const nr: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(rawRow)) { nr[normalizeHeader(k)] = v }
      const fullName = String(getValue(nr, ['name', 'bowlername']) || '').trim()
      let firstName = String(getValue(nr, ['firstname', 'first', 'givenname', 'fname']) || '').trim()
      let lastName  = String(getValue(nr, ['lastname', 'last', 'surname', 'familyname', 'lname']) || '').trim()
      if ((!firstName || !lastName) && fullName) {
        const parts = fullName.split(/\s+/).filter(Boolean)
        firstName = firstName || parts[0] || ''
        lastName  = lastName  || parts.slice(1).join(' ')
      }
      if (!firstName || !lastName) return null
      const handicap = Math.max(0, Math.floor(parseNumber(getValue(nr, ['handicap', 'handicapentries', 'handicapbrackets']), 0)))
      const scratch  = Math.max(0, Math.floor(parseNumber(getValue(nr, ['scratch',  'scratchentries',  'scratchbrackets']),  0)))
      const bracketEntries = normalizePlayerBracketEntries(undefined, handicap, scratch)
      return {
        firstName, lastName,
        usbc:       String(getValue(nr, ['usbc', 'usbcnumber']) || '').trim(),
        average:    Math.max(0, Math.floor(parseNumber(getValue(nr, ['average', 'avg']), 150))),
        handicap, scratch,
        bracketEntries,
        lane:       String(getValue(nr, ['lane']) || 'A1').trim() || 'A1',
        amountPaid: Math.max(0, parseNumber(getValue(nr, ['amountpaid', 'paid', 'payment']), 0)),
        totalCost: calculatePlayerTotalCost(bracketEntries, bracketPrograms, entryFee),
      }
    }).filter((p): p is NonNullable<typeof p> => p !== null)
  }

  const handleDeleteAllPlayers = useCallback(async () => {
    if (!window.confirm(`Delete all ${players.length} players? This cannot be undone.`)) return
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

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setIsImporting(true)
    try {
      const imported = await parseExcelPlayers(file)
      if (imported.length === 0) {
        toast.warning('No valid player rows found. Please include first and last name columns.', 'Import Warning')
        return
      }

      // Deduplicate against existing players (case-insensitive full name match)
      const existingNames = new Set(
        players.map(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase())
      )
      const duplicates = imported.filter(p =>
        existingNames.has(`${p.firstName} ${p.lastName}`.trim().toLowerCase())
      )
      const toImport = imported.filter(p =>
        !existingNames.has(`${p.firstName} ${p.lastName}`.trim().toLowerCase())
      )

      if (duplicates.length > 0 && toImport.length === 0) {
        toast.warning(
          `All ${duplicates.length} player${duplicates.length !== 1 ? 's' : ''} already exist and were skipped.`,
          'No New Players'
        )
        return
      }

      const result = await importPlayers(toImport)
      toast.success(
        `Added ${result.successCount} player${result.successCount !== 1 ? 's' : ''} successfully.` +
        (result.failedCount > 0 ? ` ${result.failedCount} failed.` : '') +
        (duplicates.length > 0 ? ` ${duplicates.length} duplicate${duplicates.length !== 1 ? 's' : ''} skipped.` : ''),
        'Import Complete'
      )
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
      const XLSX = await import('xlsx')
      const rows = players.map(player => {
        const row: Record<string, string | number> = {
          'First Name': player.firstName || '',
          'Last Name': player.lastName || '',
          'USBC': player.usbc || '',
          'Lane': player.lane?.toString() || '',
          'Average': Number(player.average || 0),
          'Handicap': Number(player.handicap || 0),
          'Scratch': Number(player.scratch || 0),
        }

        enabledBracketPrograms.forEach(program => {
          row[`${program.name} Entries`] = Number(player.bracketEntries?.[program.key] || 0)
        })

        row['Total Cost'] = Number(player.totalCost || 0)
        row['Amount Paid'] = Number(player.amountPaid || 0)
        return row
      })

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries')

      const safeTournament = (selectedTournament?.name || 'entries')
        .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'entries'
      const safeSquad = selectedSquad
        ? `${selectedSquad.date || ''}_${selectedSquad.time || ''}`.replace(/[^a-zA-Z0-9\-_ ]+/g, '').trim().replace(/\s+/g, '_')
        : 'all_squads'
      const dateStamp = new Date().toISOString().slice(0, 10)
      const fileName = `${safeTournament}_${safeSquad}_entries_${dateStamp}.xlsx`

      XLSX.writeFile(workbook, fileName)
      toast.success(`Exported ${players.length} player${players.length !== 1 ? 's' : ''}.`, 'Export Complete')
    } catch (err) {
      toast.error(`Failed to export Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`, 'Export Failed')
    }
  }, [players, enabledBracketPrograms, selectedTournament, selectedSquad, toast])

  const headerActions = useMemo(() => {
    const buttons = []
    if (isDev && players.length > 0) {
      buttons.push(<button key="randomize" className={styles.devButton} onClick={handleRandomize}>DEV: Randomize Data</button>)
      buttons.push(<button key="deleteAll" className={styles.devButton} onClick={handleDeleteAllPlayers} disabled={isDeletingAll}>{isDeletingAll ? 'Deleting…' : 'DEV: Delete All'}</button>)
    }
    buttons.push(
      <button
        key="export"
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={handleExportToExcel}
        disabled={players.length === 0}
      >
        Export to Excel
      </button>
    )
    buttons.push(
      <button
        key="import"
        className="ds-btn ds-btn-primary ds-btn-sm"
        onClick={() => importFileRef.current?.click()}
        disabled={isImporting}
      >
        {isImporting ? 'Importing…' : 'Import from Excel'}
      </button>
    )
    return <>{buttons}</>
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

  // Fetch squad data (similar to scores page) - OPTIMIZED WITH PARALLEL REQUESTS
  useEffect(() => {
    const fetchSquadData = async () => {
      try {
        // Get user ID and tournament ID
        const userId = localStorage.getItem('user_id') || user?.id?.toString();
        const lastTournamentId = getTournamentId();
        
        if (!userId || !lastTournamentId) {
          return;
        }
        
        // Parallelize both squad requests for faster loading
        const selectedSquadPromise = fetch(API(`/api/v1/squads/selected/?user_id=${userId}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.ok ? res.json() : null);
        
        const squadsPromise = fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.ok ? res.json() : []);
        
        // Wait for both requests to complete
        const [selectedData, squadsData] = await Promise.all([selectedSquadPromise, squadsPromise]);
        const storedSelectedSquadId = localStorage.getItem('selected_squad_id');
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
      } catch (error) {
        logger.error('Error fetching squad data:', error);
      }
    };

    if (isInitialized && token && initialLoadComplete) {
      fetchSquadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, token, initialLoadComplete]);

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

  if (typeof window !== 'undefined' && !localStorage.getItem('lastTournamentId')) {
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
          style={{ display: 'none' }}
        />

        <PlayerForm
          onAddPlayer={addPlayer}
          isLoading={isLoading}
          squads={squads}
          entryFee={entryFee}
          bracketPrograms={enabledBracketPrograms}
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
            {getTournamentId() && players.length > 0 && (
              <div className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>Tournament Summary</h3>
                <div className={styles.summaryGrid}>
                  <div className={styles.statBox}>
                    <div className={styles.statValue}>{entryTotals.totalPlayers}</div>
                    <div className={styles.statLabel}>Players</div>
                  </div>

                    {entryTotals.programSummaries.map(program => (
                      <div key={program.key} className={styles.statBox}>
                        <div className={styles.statValue}>{program.totalEntries}</div>
                        <div className={styles.statLabel}>{program.name}</div>
                        <div className={styles.statDetail}>{program.expectedBrackets} bracket{program.expectedBrackets !== 1 ? 's' : ''}</div>
                        {program.refunds > 0 && (
                          <div className={styles.statRefund}>~{program.refunds} refund{program.refunds !== 1 ? 's' : ''}</div>
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

            <div className={styles.tableCard}>
              <PlayersTable
                players={players}
                onUpdatePlayer={handleUpdatePlayer}
                onDeletePlayer={handleDeletePlayer}
                savingStatus={savingStatus}
                entryFee={entryFee}
                bracketPrograms={enabledBracketPrograms}
                selectedSquad={selectedSquad}
              />
            </div>
          </>
        )}
      </div>

      {deleteConfirmId !== null && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
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
