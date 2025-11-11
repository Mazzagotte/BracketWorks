'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { colors, semantic } from '../styles/colors'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { usePlayers } from './hooks/usePlayers'
import { useTournaments } from '../hooks/useTournaments'
import PlayersTable from './components/PlayersTable'
import PlayerForm from './components/PlayerForm'
import { logger } from '../lib/logger'
import { Squad, Player } from './types'
import { BracketSettings } from '../lib/types'
import { apiClient } from '../lib/api'
import { API } from '../lib/api'


// Force dynamic rendering for this page


export default function PlayersPage() {
  const { isAuthenticated, isInitialized, token, user } = useAuth()
  const { tournaments, fetchTournaments } = useTournaments()
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
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
      ? `Managing: ${selectedTournament.name}${selectedTournament.location ? ` • ${selectedTournament.location}` : ''}${selectedTournament.start_date ? ` • ${new Date(selectedTournament.start_date).toLocaleDateString()}` : ''}`
      : 'Manage tournament participants and their information'
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

  // Fetch squad data (similar to scores page)
  useEffect(() => {
    const fetchSquadData = async () => {
      try {
        // Get user ID and tournament ID
        const userId = localStorage.getItem('user_id') || user?.id?.toString();
        const lastTournamentId = getTournamentId();
        
        if (!userId || !lastTournamentId) {
          return;
        }
        
        // Fetch currently selected squad
        const selectedUrl = API(`/api/v1/squads/selected/?user_id=${userId}`);
        
        const selectedResponse = await fetch(selectedUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (selectedResponse.ok) {
          const selectedData = await selectedResponse.json();
          if (selectedData?.squad_id) {
            setSelectedSquadId(selectedData.squad_id);
          }
        }

        // Fetch all squads for tournament
        const squadsUrl = API(`/api/v1/squads/?tournament_id=${lastTournamentId}`);
        
        const squadsResponse = await fetch(squadsUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (squadsResponse.ok) {
          const squadsData = await squadsResponse.json();
          setSquads(squadsData);
        }
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
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>🎳</div>
          <div>Loading player management...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: semantic.text.primary }}>
          Authentication Required
        </div>
        <div style={{ fontSize: '0.875rem', color: semantic.text.secondary }}>
          Please log in to access the players page.
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem 1rem' 
      }}>
        <PlayerForm 
          onAddPlayer={addPlayer}
          isLoading={isLoading}
          squads={squads}
          entryFee={entryFee}
        />

        {isLoading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem',
            fontSize: '0.875rem',
            color: semantic.text.secondary
          }}>
            Loading players...
          </div>
        ) : !getTournamentId() ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '3rem 2rem',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: semantic.text.primary,
              marginBottom: '0.5rem'
            }}>
              No Tournament Loaded
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: semantic.text.secondary,
              marginBottom: '1.5rem'
            }}>
              Please load a tournament from the dashboard to manage players.
            </div>
            <a 
              href="/dashboard"
              style={{
                display: 'inline-block',
                backgroundColor: colors.blue.primary,
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = colors.blue.dark}
              onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = colors.blue.primary}
            >
              Go to Dashboard
            </a>
          </div>
        ) : (
          <>
            {/* Tournament Entry Summary */}
            {getTournamentId() && players.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: semantic.text.secondary,
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Tournament Summary
                </h3>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Total Players */}
                  <div style={{
                    textAlign: 'center',
                    padding: '0.75rem',
                    backgroundColor: colors.gray[50],
                    borderRadius: '0.5rem',
                    border: `1px solid ${colors.gray[200]}`
                  }}>
                    <div style={{ 
                      fontSize: '1.875rem', 
                      fontWeight: '700', 
                      color: colors.gray[900],
                      lineHeight: '1'
                    }}>
                      {entryTotals.totalPlayers}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: semantic.text.secondary, 
                      marginTop: '0.25rem',
                      fontWeight: '500'
                    }}>
                      Players
                    </div>
                  </div>

                  {/* Handicap Entries */}
                  <div style={{
                    textAlign: 'center',
                    padding: '0.75rem',
                    backgroundColor: colors.blue.light,
                    borderRadius: '0.5rem',
                    border: `1px solid ${colors.blue.lighter}`
                  }}>
                    <div style={{ 
                      fontSize: '1.875rem', 
                      fontWeight: '700', 
                      color: colors.blue.deeper,
                      lineHeight: '1'
                    }}>
                      {entryTotals.handicapEntries}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: colors.blue.deeper, 
                      marginTop: '0.25rem',
                      fontWeight: '500'
                    }}>
                      Handicap
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: colors.blue.deeper, 
                      marginTop: '0.125rem',
                      opacity: 0.8
                    }}>
                      {entryTotals.expectedHandicapBrackets} brkt
                      {entryTotals.handicapRefunds > 0 && ` • ${entryTotals.handicapRefunds} ref`}
                    </div>
                  </div>

                  {/* Scratch Entries */}
                  <div style={{
                    textAlign: 'center',
                    padding: '0.75rem',
                    backgroundColor: colors.yellow.light,
                    borderRadius: '0.5rem',
                    border: `1px solid ${colors.brand.goldLighter}`
                  }}>
                    <div style={{ 
                      fontSize: '1.875rem', 
                      fontWeight: '700', 
                      color: colors.yellow.dark,
                      lineHeight: '1'
                    }}>
                      {entryTotals.scratchEntries}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: colors.yellow.dark, 
                      marginTop: '0.25rem',
                      fontWeight: '500'
                    }}>
                      Scratch
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: colors.yellow.dark, 
                      marginTop: '0.125rem',
                      opacity: 0.8
                    }}>
                      {entryTotals.expectedScratchBrackets} brkt
                      {entryTotals.scratchRefunds > 0 && ` • ${entryTotals.scratchRefunds} ref`}
                    </div>
                  </div>

                  {/* Total Revenue */}
                  <div style={{
                    textAlign: 'center',
                    padding: '0.75rem',
                    backgroundColor: colors.green.light,
                    borderRadius: '0.5rem',
                    border: `1px solid ${colors.green.lighter}`
                  }}>
                    <div style={{ 
                      fontSize: '1.875rem', 
                      fontWeight: '700', 
                      color: colors.green.deeper,
                      lineHeight: '1'
                    }}>
                      ${entryTotals.totalRevenue.toLocaleString()}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: colors.green.deeper, 
                      marginTop: '0.25rem',
                      fontWeight: '500'
                    }}>
                      Revenue
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: colors.green.deeper, 
                      marginTop: '0.125rem',
                      opacity: 0.8
                    }}>
                      {entryTotals.totalEntries} × ${entryFee}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Players Table */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
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
