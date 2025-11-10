import React from 'react'

// Pure bracket display component

export interface MatchData { 
  seedA: number
  seedB: number 
  playerA?: string
  playerB?: string
  scoreA?: number
  scoreB?: number
  winner?: 'A' | 'B'
  matchStatus?: 'pending' | 'in_progress' | 'completed'
  tie_resolution_method?: 'normal' | 'highest_game' | 'random' | null
  tie_notes?: string | null
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
        color: '#6b7280'
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
          color: '#6b7280'
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
            color: '#374151'
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
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#111827',
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
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '0.75rem',
        backgroundColor: isCompleted ? '#f0f9ff' : '#ffffff',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(changeEvent) => {
        if (onClick) {
          changeEvent.currentTarget.style.borderColor = '#3b82f6'
          changeEvent.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.1)'
        }
      }}
      onMouseOut={(changeEvent) => {
        if (onClick) {
          changeEvent.currentTarget.style.borderColor = '#e5e7eb'
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
            color: '#059669',
            fontWeight: '600'
          }}>
            Winner: {MatchData.winner}
          </span>
        )}
        {MatchData.tie_resolution_method && MatchData.tie_resolution_method !== 'normal' && (
          <span 
            style={{
              fontSize: '0.7rem',
              color: '#8b5cf6',
              fontWeight: '600',
              marginLeft: '0.5rem'
            }}
            title={MatchData.tie_notes || ''}
          >
            ⚖️
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
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '1rem',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(changeEvent) => { 
        changeEvent.currentTarget.style.borderColor = '#3b82f6'
        changeEvent.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.1)'
      }}
      onMouseOut={(changeEvent) => { 
        changeEvent.currentTarget.style.borderColor = '#e5e7eb'
        changeEvent.currentTarget.style.boxShadow = 'none'
      }}
    >
      <h4 style={{
        fontSize: '1.125rem',
        fontWeight: '600',
        marginBottom: '0.5rem',
        color: '#111827'
      }}>
        {bracket.title || `Bracket ${index + 1}`}
      </h4>
      
      <div style={{
        fontSize: '0.875rem',
        color: '#6b7280',
        marginBottom: '0.75rem'
      }}>
        Progress: {completedMatches}/{totalMatches} matches completed
      </div>
      
      <div style={{
        width: '100%',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        height: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0}%`,
          height: '100%',
          backgroundColor: '#3b82f6',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}

