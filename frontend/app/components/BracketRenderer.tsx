import React from 'react'
import { colors, semantic, gradients } from '../styles/colors'

// Pure bracket display component

export interface MatchData { 
  seedA: number
  seedB: number 
  playerA?: string
  playerB?: string
  scoreA?: number
  scoreB?: number
  winner?: 'A' | 'B'
  matchStatus?: 'pending' | 'in_progress' | 'completed' | 'both_advance'
  both_advance?: boolean
  split_pot?: boolean
  eliminated_player?: 'A' | 'B' | null
  elimination_notes?: string | null
}

export interface TournamentRound { 
  roundName: string
  roundMatches: MatchData[] 
}



interface BracketConfiguration {
  rounds?: TournamentRound[];
  title?: string;
}

interface BracketPreviewData {
  rounds?: TournamentRound[];
  multiple_brackets?: {
    scratch_brackets?: BracketConfiguration[];
    handicap_brackets?: BracketConfiguration[];
  };
  scratch_brackets?: BracketConfiguration[];
  handicap_brackets?: BracketConfiguration[];
}

interface BracketRendererProps {
  tournamentPreviewData: BracketPreviewData | null
  selectedBracketType: 'scratch' | 'handicap'
  selectedBracketConfiguration: {type: 'scratch' | 'handicap', index: number} | null
  selectedRoundNumber: number
  onMatchClick?: (bracketId: string, round: number, MatchData: number) => void
  isMobileDisplay?: boolean
}

export function BracketRenderer({ 
  tournamentPreviewData, 
  selectedBracketType, 
  selectedBracketConfiguration,
  selectedRoundNumber,
  onMatchClick,
  isMobileDisplay = false
}: BracketRendererProps) {
  if (!tournamentPreviewData) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem',
        color: semantic.text.secondary
      }}>
        <p>No bracket data available</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Generate a bracket to see the tournamentPreviewData
        </p>
      </div>
    )
  }

  // Handle single bracket tournamentPreviewData
  if (tournamentPreviewData.rounds) {
    return <SingleBracketView rounds={tournamentPreviewData.rounds} onMatchClick={onMatchClick} />
  }

  // Handle multiple brackets
  if (tournamentPreviewData.multiple_brackets) {
    const brackets = selectedBracketType === 'scratch' 
      ? tournamentPreviewData.multiple_brackets.scratch_brackets
      : tournamentPreviewData.multiple_brackets.handicap_brackets

    if (!brackets || brackets.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          color: semantic.text.secondary
        }}>
          <p>No {selectedBracketType} brackets available</p>
        </div>
      )
    }

    return (
      <MultipleBracketsView 
        brackets={brackets}
        selectedBracketConfiguration={selectedBracketConfiguration}
        selectedRoundNumber={selectedRoundNumber}
        onMatchClick={onMatchClick}
        isMobileDisplay={isMobileDisplay}
      />
    )
  }

  return null
}

// Single bracket display
function SingleBracketView({ 
  rounds, 
  onMatchClick 
}: { 
  rounds: TournamentRound[]
  onMatchClick?: (bracketId: string, round: number, MatchData: number) => void
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      overflowX: 'auto',
      padding: '1rem',
      minHeight: '400px'
    }}>
      {rounds.map((round, roundIndex) => (
        <div key={roundIndex} style={{ minWidth: '200px' }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '1rem',
            textAlign: 'center',
            color: semantic.text.primary
          }}>
            {round.roundName}
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {round.roundMatches.map((MatchData, matchIndex) => (
              <MatchCard 
                key={matchIndex}
                MatchData={MatchData}
                onClick={() => onMatchClick?.('single', roundIndex, matchIndex)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Multiple brackets display
function MultipleBracketsView({ 
  brackets, 
  selectedBracketConfiguration,
  selectedRoundNumber,
  onMatchClick,
  isMobileDisplay
}: {
  brackets: BracketConfiguration[]
  selectedBracketConfiguration: {type: 'scratch' | 'handicap', index: number} | null
  selectedRoundNumber: number
  onMatchClick?: (bracketId: string, round: number, MatchData: number) => void
  isMobileDisplay: boolean
}) {
  if (selectedBracketConfiguration) {
    const bracket = brackets[selectedBracketConfiguration.index]
    if (!bracket || !bracket.rounds) return null

    return (
      <div>
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: colors.gray[50],
          borderRadius: '8px',
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: colors.gray[900],
            margin: 0
          }}>
            {bracket.title || `Bracket ${selectedBracketConfiguration.index + 1}`}
          </h3>
        </div>
        
        <SingleBracketView 
          rounds={bracket.rounds}
          onMatchClick={(_, round, MatchData) => 
            onMatchClick?.(`${selectedBracketConfiguration.type}_${selectedBracketConfiguration.index}`, round, MatchData)
          }
        />
      </div>
    )
  }

  // Show bracket grid
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobileDisplay ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1rem',
      padding: '1rem'
    }}>
      {brackets.map((bracket, index) => (
        <BracketCard 
          key={index}
          bracket={bracket}
          index={index}
          onClick={() => {/* Handle bracket selection */}}
        />
      ))}
    </div>
  )
}

// Individual MatchData card
function MatchCard({ 
  MatchData, 
  onClick 
}: { 
  MatchData: MatchData
  onClick?: () => void
}) {
  const isCompleted = MatchData.winner || (MatchData.scoreA !== undefined && MatchData.scoreB !== undefined)
  
  return (
    <div 
      onClick={onClick}
      style={{
        border: `1px solid ${colors.gray[200]}`,
        borderRadius: '8px',
        padding: '0.75rem',
        backgroundColor: isCompleted ? colors.blue.pale : colors.white,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(changeEvent) => {
        if (onClick) {
          changeEvent.currentTarget.style.borderColor = colors.blue.primary
          changeEvent.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.1)'
        }
      }}
      onMouseOut={(changeEvent) => {
        if (onClick) {
          changeEvent.currentTarget.style.borderColor = colors.gray[200]
          changeEvent.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem'
      }}>
        {MatchData.winner && (
          <span style={{
            fontSize: '0.75rem',
            color: semantic.status.success,
            fontWeight: '600'
          }}>
            Winner: {MatchData.winner}
          </span>
        )}
        {MatchData.both_advance && (
          <span 
            style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              letterSpacing: '0.5px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: gradients.purpleTie,
              color: 'white',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
              boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)',
              marginLeft: '0.5rem',
              cursor: 'help'
            }}
            title={MatchData.elimination_notes || 'Both players advance - lower next round score will be eliminated'}
          >
            BOTH ADVANCE
          </span>
        )}
        {MatchData.split_pot && (
          <span 
            style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              letterSpacing: '0.5px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: gradients.brandSubtle,
              color: 'white',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
              boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
              marginLeft: '0.5rem',
              cursor: 'help'
            }}
            title="Finals tie - pot split evenly"
          >
            SPLIT POT
          </span>
        )}
      </div>
      
      <div style={{ fontSize: '0.875rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '0.25rem'
        }}>
          <span>{MatchData.playerA || 'TBD'}</span>
          <span style={{ fontWeight: '600' }}>{MatchData.scoreA || '-'}</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between'
        }}>
          <span>{MatchData.playerB || 'TBD'}</span>
          <span style={{ fontWeight: '600' }}>{MatchData.scoreB || '-'}</span>
        </div>
      </div>
    </div>
  )
}

// Bracket summary card
function BracketCard({ 
  bracket, 
  index, 
  onClick 
}: { 
  bracket: BracketConfiguration
  index: number
  onClick: () => void
}) {
  const totalMatches = bracket.rounds?.reduce((total: number, round: TournamentRound) => 
    total + (round.roundMatches?.length || 0), 0) || 0
  const completedMatches = bracket.rounds?.reduce((total: number, round: TournamentRound) => 
    total + (round.roundMatches?.filter((m: MatchData) => m.winner || (m.scoreA && m.scoreB))?.length || 0), 0) || 0

  return (
    <div 
      onClick={onClick}
      style={{
        border: `1px solid ${colors.gray[200]}`,
        borderRadius: '8px',
        padding: '1rem',
        backgroundColor: colors.white,
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(changeEvent) => { 
        changeEvent.currentTarget.style.borderColor = colors.blue.primary
        changeEvent.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.1)'
      }}
      onMouseOut={(changeEvent) => { 
        changeEvent.currentTarget.style.borderColor = colors.gray[200]
        changeEvent.currentTarget.style.boxShadow = 'none'
      }}
    >
      <h4 style={{
        fontSize: '1.125rem',
        fontWeight: '600',
        marginBottom: '0.5rem',
        color: colors.gray[900]
      }}>
        {bracket.title || `Bracket ${index + 1}`}
      </h4>
      
      <div style={{
        fontSize: '0.875rem',
        color: semantic.text.secondary,
        marginBottom: '0.75rem'
      }}>
        Progress: {completedMatches}/{totalMatches} matches completed
      </div>
      
      <div style={{
        width: '100%',
        backgroundColor: colors.gray[200],
        borderRadius: '4px',
        height: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0}%`,
          height: '100%',
          backgroundColor: colors.blue.primary,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}

