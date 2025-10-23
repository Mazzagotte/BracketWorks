'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect } from 'react'

import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { usePlayers } from './hooks/usePlayers'
import PlayersTable from './components/PlayersTable'
import PlayerForm from './components/PlayerForm'
import { useClientStorage } from '../lib/storage'
import { logger } from '../lib/logger'
import { Squad } from './types'


// Force dynamic rendering for this page


export default function PlayersPage() {
  const { isAuthenticated, token, user } = useAuth()
  const { getItem } = useClientStorage()
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null)
  const [squads, setSquads] = useState<Squad[]>([])
  
  const selectedSquad = squads.find(s => s.id === selectedSquadId) || null

  // Debug authentication state
  useEffect(() => {
    logger.debug('Players page auth state', {
      isAuthenticated,
      hasToken: !!token,
      hasUser: !!user,
      tokenFromStorage: !!localStorage.getItem('token'),
      userIdFromStorage: !!localStorage.getItem('user_id')
    });
  }, [isAuthenticated, token, user]);

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
    getItem
  })

  // Set up page header
  const playerHeaderActions = useMemo(() => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
        Total Players: {players.length}
      </span>
      {isDemoMode && (
        <span style={{ 
          fontSize: '0.75rem', 
          backgroundColor: '#fef3c7', 
          color: '#92400e',
          padding: '0.25rem 0.5rem',
          borderRadius: '0.25rem'
        }}>
          Demo Mode
        </span>
      )}
    </div>
  ), [players.length, isDemoMode])

  usePageHeader({
    title: 'Players',
    subtitle: 'Manage tournament participants and their information',
    actions: playerHeaderActions
  })

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
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}