import React from 'react'

import { Button, Select, Input } from './UI'

// Bracket controls and actions component

import { Tournament, Squad, Player, BracketData } from '../lib/types';

interface MultipleBrackets {
  scratch_brackets?: BracketData[];
  handicap_brackets?: BracketData[];
}

interface BracketPreview extends BracketData {
  multiple_brackets?: MultipleBrackets;
}

export interface BracketState {
  size: number
  preview: BracketPreview | null
  loading: boolean
  tournament: Tournament | null
  squads: Squad[]
  selectedSquad: Squad | null
  players: Player[]
  loadingPlayers: boolean
  selectedBracket: {type: 'scratch' | 'handicap', index: number} | null
  selectedRound: number
  selectedBracketType: 'scratch' | 'handicap'
  playerSearchQuery: string
  isHydrated: boolean
}

interface BracketControlsProps {
  state: BracketState
  onSizeChange: (size: number) => void
  onTournamentSelect: (tournament: Tournament) => void
  onSquadSelect: (squad: Squad) => void
  onBracketTypeChange: (type: 'scratch' | 'handicap') => void
  onPlayerSearch: (query: string) => void
  onGeneratePreview: () => void
  onGenerateTournament: () => void
  onRefreshData: () => void
}

export function BracketControls({
  state,
  onSizeChange,
  onTournamentSelect,
  onSquadSelect,
  onBracketTypeChange,
  onPlayerSearch,
  onGeneratePreview,
  onGenerateTournament,
  onRefreshData
}: BracketControlsProps) {
  const bracketSizes = [4, 8, 16, 32, 64, 128]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      padding: '1rem',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      marginBottom: '1rem'
    }}>
      {/* Tournament Selection */}
      {state.tournament && (
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Selected Tournament
          </label>
          <div style={{
            padding: '0.5rem',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem'
          }}>
            {state.tournament.name}
          </div>
        </div>
      )}

      {/* Squad Selection */}
      {state.squads.length > 0 && (
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Squad
          </label>
          <Select
            value={state.selectedSquad?.id || ''}
            onChange={(changeEvent) => {
              const squad = state.squads.find(s => s.id === parseInt(changeEvent.target.value))
              onSquadSelect(squad)
            }}
            options={[
              { value: '', label: 'All Squads' },
              ...state.squads.map((squad) => ({
                value: squad.id,
                label: `${squad.name} - ${squad.time}`
              }))
            ]}
          />
        </div>
      )}

      {/* Bracket Size */}
      <div>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Bracket Size
        </label>
        <Select
          value={state.size}
          onChange={(changeEvent) => onSizeChange(parseInt(changeEvent.target.value))}
          options={bracketSizes.map(size => ({
            value: size,
            label: `${size} players`
          }))}
        />
      </div>

      {/* Bracket Type (for multiple brackets) */}
      {state.preview?.multiple_brackets && (
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Bracket Type
          </label>
          <div style={{
            display: 'flex',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => onBracketTypeChange('scratch')}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: state.selectedBracketType === 'scratch' ? '#3b82f6' : '#ffffff',
                color: state.selectedBracketType === 'scratch' ? '#ffffff' : '#374151',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Scratch ({state.preview.multiple_brackets.scratch_brackets?.length || 0})
            </button>
            <button
              onClick={() => onBracketTypeChange('handicap')}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: state.selectedBracketType === 'handicap' ? '#3b82f6' : '#ffffff',
                color: state.selectedBracketType === 'handicap' ? '#ffffff' : '#374151',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Handicap ({state.preview.multiple_brackets.handicap_brackets?.length || 0})
            </button>
          </div>
        </div>
      )}

      {/* Player Search */}
      {state.players.length > 0 && (
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Search Players
          </label>
          <Input
            type="text"
            placeholder="Search by name..."
            value={state.playerSearchQuery}
            onChange={(changeEvent) => onPlayerSearch(changeEvent.target.value)}
          />
        </div>
      )}

      {/* Players Info */}
      {state.players.length > 0 && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '0.875rem'
        }}>
          <div style={{ color: '#374151', fontWeight: '500' }}>
            {state.players.length} players loaded
          </div>
          {state.selectedSquad && (
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              From squad: {state.selectedSquad.name}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap'
      }}>
        <button
          disabled={state.loading}
          onClick={onGeneratePreview}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            backgroundColor: state.loading ? '#9ca3af' : '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: state.loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          {state.loading ? 'Loading...' : 'Generate Preview'}
        </button>

        {state.tournament && (
          <button
            disabled={state.loading || state.players.length === 0}
            onClick={onGenerateTournament}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              backgroundColor: state.loading || state.players.length === 0 ? '#9ca3af' : '#6b7280',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: state.loading || state.players.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {state.loading ? 'Loading...' : 'Generate Tournament'}
          </button>
        )}

        <Button
          onClick={onRefreshData}
          variant="secondary"
          disabled={state.loading || state.loadingPlayers}
        >
          Refresh
        </Button>
      </div>

      {/* Loading Players Indicator */}
      {state.loadingPlayers && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#fef3cd',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#92400e'
        }}>
          Loading players...
        </div>
      )}
    </div>
  )
}

