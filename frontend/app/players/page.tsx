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
import { logger } from '../lib/logger'
import { Squad, SortConfig, SortableColumn, Player } from './types'
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
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });

  // Sorting function
  const handleSort = useCallback((column: SortableColumn) => {
    setSortConfig(prevSort => {
      if (prevSort.column === column) {
        // Same column: cycle through asc -> desc -> null
        if (prevSort.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prevSort.direction === 'desc') {
          return { column: null, direction: null };
        } else {
          return { column, direction: 'asc' };
        }
      } else {
        // New column: start with ascending
        return { column, direction: 'asc' };
      }
    });
  }, []);

  // Helper function to get tournament ID from various sources
  const getTournamentId = useCallback(() => {
    // Use localStorage.getItem directly like the scores page does
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    
    console.log('� Tournament ID search debug:', {
      lastTournamentId: lastTournamentId,
      found: !!lastTournamentId
    });
    
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
    console.log('loadEntryFee called - token:', !!token);
    
    if (!token) {
      console.log('No token available, skipping bracket settings load');
      return;
    }
    
    const tournamentId = getTournamentId();
    
    console.log('Found tournament ID:', tournamentId, 'from localStorage keys');
    
    if (!tournamentId) {
      console.log('No tournament ID available from any source, skipping bracket settings load');
      return;
    }
    
    try {
      console.log(`Fetching bracket settings for tournament ${tournamentId}...`);
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`);
      console.log('Bracket settings response:', settings);
      
      if (settings && typeof settings.cost_per_bracket === 'number') {
        console.log(`Setting entry fee to: $${settings.cost_per_bracket}`);
        setEntryFee(settings.cost_per_bracket);
        logger.info(`Loaded entry fee from tournament settings: $${settings.cost_per_bracket}`);
      } else {
        console.log('No cost_per_bracket found in settings, keeping default');
      }
    } catch (error) {
      console.error('Error loading bracket settings:', error);
      logger.warn('Failed to load bracket settings, using default entry fee:', error);
    } finally {
      setInitialLoadComplete(true);
    }
  }, [token]);

  // Load entry fee when tournament or auth changes
  useEffect(() => {
    loadEntryFee();
  }, [loadEntryFee]);
  
  const selectedSquad = squads.find(squad => squad.id === selectedSquadId) || null

  // Debug squad selection
  useEffect(() => {
    console.log('🎳 Players page squad debug:', {
      selectedSquadId,
      squads: squads.length,
      selectedSquad,
      squadsData: squads
    });
  }, [selectedSquadId, squads, selectedSquad]);

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

  // Sort players based on current sort configuration
  const sortedPlayers = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return players;
    }

    return [...players].sort((a, b) => {
      let aValue: any = a[sortConfig.column!];
      let bValue: any = b[sortConfig.column!];

      // Handle special cases
      if (sortConfig.column === 'name') {
        aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
        bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
      } else if (sortConfig.column === 'totalCost') {
        // totalCost is a computed value, not directly stored on the player object
        aValue = (a as any).brackets * entryFee;
        bValue = (b as any).brackets * entryFee;
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

  usePageHeader({
    title: 'Entries',
    subtitle: selectedTournament 
      ? `Managing: ${selectedTournament.name}${selectedTournament.location ? ` • ${selectedTournament.location}` : ''}${selectedTournament.start_date ? ` • ${new Date(selectedTournament.start_date).toLocaleDateString()}` : ''}`
      : 'Manage tournament participants and their information'
  })

  // Fetch squad data (similar to scores page)
  useEffect(() => {
    const fetchSquadData = async () => {
      try {
        console.log('Fetching squad data for players page...');
        
        // Get user ID and tournament ID
        const userId = localStorage.getItem('user_id') || user?.id?.toString();
        const lastTournamentId = getTournamentId();
        
        console.log('🔍 Squad fetch debug:', { 
          userId, 
          lastTournamentId,
          userFromAuth: user?.id,
          userIdFromStorage: localStorage.getItem('user_id'),
          tournamentFromTournamentHelper: getTournamentId(),
          allLocalStorageKeys: Object.keys(localStorage)
        });
        
        if (!userId || !lastTournamentId) {
          console.log('Missing required parameters for squad fetch:', { userId, lastTournamentId });
          return;
        }
        
        // Fetch currently selected squad
        const selectedUrl = API(`/api/v1/squads/selected/?user_id=${userId}`);
        console.log('🌐 Fetching selected squad from:', selectedUrl);
        
        const selectedResponse = await fetch(selectedUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📞 Selected squad response status:', selectedResponse.status);
        
        if (selectedResponse.ok) {
          const selectedData = await selectedResponse.json();
          console.log('✅ Selected squad response data:', selectedData);
          if (selectedData?.squad_id) {
            setSelectedSquadId(selectedData.squad_id);
            console.log('🎯 Set selectedSquadId to:', selectedData.squad_id);
          }
        } else {
          const errorText = await selectedResponse.text();
          console.log('❌ Selected squad error:', selectedResponse.status, errorText);
        }

        // Fetch all squads for tournament
        const squadsUrl = API(`/api/v1/squads/?tournament_id=${lastTournamentId}`);
        console.log('🌐 Fetching all squads from:', squadsUrl);
        
        const squadsResponse = await fetch(squadsUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📞 All squads response status:', squadsResponse.status);
        
        if (squadsResponse.ok) {
          const squadsData = await squadsResponse.json();
          console.log('✅ All squads response data:', squadsData);
          setSquads(squadsData);
          console.log('🎯 Set squads array to:', squadsData);
        } else {
          const errorText = await squadsResponse.text();
          console.log('❌ All squads error:', squadsResponse.status, errorText);
        }
      } catch (error) {
        console.error('Error fetching squad data:', error);
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
        <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#374151' }}>
          Authentication Required
        </div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
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
            color: '#6b7280'
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
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              No Tournament Loaded
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1.5rem'
            }}>
              Please load a tournament from the dashboard to manage players.
            </div>
            <a 
              href="/dashboard"
              style={{
                display: 'inline-block',
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = '#3b82f6'}
            >
              Go to Dashboard
            </a>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <PlayersTable
              players={sortedPlayers}
              onUpdatePlayer={handleUpdatePlayer}
              onDeletePlayer={deletePlayer}
              savingStatus={savingStatus}
              entryFee={entryFee}
              sortConfig={sortConfig}
              onSort={handleSort}
              selectedSquad={selectedSquad}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
