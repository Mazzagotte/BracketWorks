'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect, useCallback } from 'react'
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
import { BracketSettings, Tournament } from '../lib/types'
import { apiClient, API } from '../lib/api'
import styles from './entries.module.css'


export default function PlayersPage() {
  const { isAuthenticated, isInitialized, token, user } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null)
  const [squads, setSquads] = useState<Squad[]>([])
  const [entryFee, setEntryFee] = useState<number>(25) // Default $25, will be loaded from tournament settings
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false)
  


  // Helper function to get tournament ID from various sources
  const getTournamentId = useCallback(() => {
    // Use localStorage.getItem directly like the scores page does
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    return lastTournamentId;
  }, []);

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments()
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
      
      if (settings && typeof settings.cost_per_bracket === 'number') {
        setEntryFee(settings.cost_per_bracket);
        logger.info(`Loaded entry fee from tournament settings: $${settings.cost_per_bracket}`);
      }
    } catch (error) {
      logger.warn('Failed to load bracket settings, using default entry fee:', error);
    } finally {
      setInitialLoadComplete(true);
    }
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

  const {
    players,
    isLoading,
    savingStatus,
    addPlayer,
    updatePlayer,
    deletePlayer
  } = usePlayers({
    selectedSquad,
    squads,
    authToken: token,
    entryFee,
    getItem: (key: string) => localStorage.getItem(key)
  })

  // Adapter function to match PlayersTable expected signature
  const handleUpdatePlayer = useCallback((playerId: number, field: string, value: string | number) => {
    const updates: Partial<Player> = { [field]: value };
    updatePlayer(playerId, updates);
  }, [updatePlayer]);

  usePageHeader({
    title: 'Entries',
    subtitle: selectedTournament
      ? `${selectedTournament.name}${selectedSquad ? ` · ${[selectedSquad.date, selectedSquad.time].filter(Boolean).join(' ')}` : ''}`
      : 'Select a tournament from the dashboard'
  })

  // Calculate entry totals
  const entryTotals = useMemo(() => {
    if (!players || players.length === 0) {
      return {
        totalPlayers: 0,
        scratchEntries: 0,
        handicapEntries: 0,
        totalEntries: 0,
        expectedScratchBrackets: 0,
        expectedHandicapBrackets: 0,
        scratchRefunds: 0,
        handicapRefunds: 0,
        totalRevenue: 0
      }
    }

    const bracketSize = 8 // Default bracket size
    let scratchCount = 0
    let handicapCount = 0
    let paidEntries = 0

    players.forEach(player => {
      const scratchEntries = player.scratch || 0
      const handicapEntries = player.handicap || 0
      const totalPlayerEntries = scratchEntries + handicapEntries
      
      scratchCount += scratchEntries
      handicapCount += handicapEntries
      
      // Only count revenue if player has paid (amountPaid >= totalCost)
      const isPaid = player.amountPaid && player.totalCost && player.amountPaid >= player.totalCost
      if (isPaid) {
        paidEntries += totalPlayerEntries
      }
    })

    const totalEntries = scratchCount + handicapCount
    const expectedScratchBrackets = Math.floor(scratchCount / bracketSize)
    const expectedHandicapBrackets = Math.floor(handicapCount / bracketSize)
    const scratchRefunds = scratchCount % bracketSize
    const handicapRefunds = handicapCount % bracketSize

    return {
      totalPlayers: players.length,
      scratchEntries: scratchCount,
      handicapEntries: handicapCount,
      totalEntries,
      expectedScratchBrackets,
      expectedHandicapBrackets,
      scratchRefunds,
      handicapRefunds,
      totalRevenue: paidEntries * entryFee
    }
  }, [players, entryFee])

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
        
        // Set selected squad ID
        if (selectedData?.squad_id) {
          setSelectedSquadId(selectedData.squad_id);
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
        <PlayerForm
          onAddPlayer={addPlayer}
          isLoading={isLoading}
          squads={squads}
          entryFee={entryFee}
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
                  <div className={`${styles.statBox} ${styles.statBoxPlayers}`}>
                    <div className={`${styles.statValue} ${styles.statValuePlayers}`}>
                      {entryTotals.totalPlayers}
                    </div>
                    <div className={`${styles.statLabel} ${styles.statLabelPlayers}`}>Players</div>
                  </div>

                  <div className={`${styles.statBox} ${styles.statBoxHandicap}`}>
                    <div className={`${styles.statValue} ${styles.statValueHandicap}`}>
                      {entryTotals.handicapEntries}
                    </div>
                    <div className={`${styles.statLabel} ${styles.statLabelHandicap}`}>Handicap</div>
                    <div className={`${styles.statDetail} ${styles.statDetailHandicap}`}>
                      {entryTotals.expectedHandicapBrackets} Full Brackets
                      {entryTotals.handicapRefunds > 0 && ` • ${entryTotals.handicapRefunds} Refunds`}
                    </div>
                  </div>

                  <div className={`${styles.statBox} ${styles.statBoxScratch}`}>
                    <div className={`${styles.statValue} ${styles.statValueScratch}`}>
                      {entryTotals.scratchEntries}
                    </div>
                    <div className={`${styles.statLabel} ${styles.statLabelScratch}`}>Scratch</div>
                    <div className={`${styles.statDetail} ${styles.statDetailScratch}`}>
                      {entryTotals.expectedScratchBrackets} Full Brackets
                      {entryTotals.scratchRefunds > 0 && ` • ${entryTotals.scratchRefunds} Refunds`}
                    </div>
                  </div>

                  <div className={`${styles.statBox} ${styles.statBoxRevenue}`}>
                    <div className={`${styles.statValue} ${styles.statValueRevenue}`}>
                      ${entryTotals.totalRevenue.toLocaleString()}
                    </div>
                    <div className={`${styles.statLabel} ${styles.statLabelRevenue}`}>Revenue</div>
                    <div className={`${styles.statDetail} ${styles.statDetailRevenue}`}>
                      {entryTotals.totalEntries} × ${entryFee}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.tableCard}>
              <PlayersTable
                players={players}
                onUpdatePlayer={handleUpdatePlayer}
                onDeletePlayer={deletePlayer}
                savingStatus={savingStatus}
                entryFee={entryFee}
                selectedSquad={selectedSquad}
              />
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}
