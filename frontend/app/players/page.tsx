'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect, useCallback } from 'react'

import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { usePlayers } from './hooks/usePlayers'
import PlayersTable from './components/PlayersTable'
import PlayerForm from './components/PlayerForm'
import { useClientStorage } from '../lib/storage'
import { logger } from '../lib/logger'
import { Squad } from './types'
import { BracketSettings } from '../lib/types'
import { apiClient } from '../lib/api'


// Force dynamic rendering for this page


export default function PlayersPage() {
  const { isAuthenticated, isInitialized, token, user } = useAuth()
  const { getItem } = useClientStorage()
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null)
  const [squads, setSquads] = useState<Squad[]>([])
  const [entryFee, setEntryFee] = useState<number>(25) // Default $25, will be loaded from tournament settings

  // Load entry fee from tournament bracket settings
  const loadEntryFee = useCallback(async () => {
    if (!token) return;
    
    const tournamentId = getItem('tournament_id');
    if (!tournamentId) return;
    
    try {
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`);
      if (settings && typeof settings.cost_per_bracket === 'number') {
        setEntryFee(settings.cost_per_bracket);
        logger.info(`Loaded entry fee from tournament settings: $${settings.cost_per_bracket}`);
      }
    } catch (error) {
      logger.warn('Failed to load bracket settings, using default entry fee:', error);
    }
  }, [token, getItem]);

  // Load entry fee when tournament or auth changes
  useEffect(() => {
    loadEntryFee();
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
    isDemoMode,
    savingStatus,
    addPlayer,
    updatePlayer,
    deletePlayer
  } = usePlayers({
    selectedSquad,
    squads,
    authToken: token,
    getItem,
    entryFee
  })

  usePageHeader({
    title: 'Players',
    subtitle: 'Manage tournament participants and their information'
  })

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
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ 
              padding: '1.5rem 1.5rem 0 1.5rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{ 
                fontSize: '1.125rem', 
                fontWeight: '600',
                margin: '0 0 1rem 0',
                color: '#111827'
              }}>
                Current Players
              </h3>
            </div>
            
            <PlayersTable
              players={players}
              onUpdatePlayer={updatePlayer}
              onDeletePlayer={deletePlayer}
              savingStatus={savingStatus}
              isDemoMode={isDemoMode}
              entryFee={entryFee}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
