import React from 'react'

// Pure bracket display component

export interface Match { 
  seedA: number
  seedB: number 
  playerA?: string
  playerB?: string
  scoreA?: number
  scoreB?: number
  winner?: 'A' | 'B'
  status?: 'pending' | 'in_progress' | 'completed'
}

export interface BracketRound { 
  name: string
  matches: Match[] 
}



interface BracketItem {
  rounds?: BracketRound[];
  title?: string;
}

interface BracketPreviewData {
  rounds?: BracketRound[];
  multiple_brackets?: {
    scratch_brackets?: BracketItem[];
    handicap_brackets?: BracketItem[];
  };
  scratch_brackets?: BracketItem[];
  handicap_brackets?: BracketItem[];
}

interface BracketRendererProps {
  preview: BracketPreviewData | null
  selectedBracketType: 'scratch' | 'handicap'
  selectedBracket: {type: 'scratch' | 'handicap', index: number} | null
  selectedRound: number
  onMatchSelect?: (bracketId: string, round: number, match: number) => void
  isMobile?: boolean
}

export function BracketRenderer({ 
  preview, 
  selectedBracketType, 
  selectedBracket,
  selectedRound,
  onMatchSelect,
  isMobile = false
}: BracketRendererProps) {
  if (!preview) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem',
        color: '#6b7280'
      }}>
        <p>No bracket data available</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Generate a bracket to see the preview
        </p>
      </div>
    )
  }

  // Handle single bracket preview
  if (preview.rounds) {
    return <SingleBracketView rounds={preview.rounds} onMatchSelect={onMatchSelect} />
  }

  // Handle multiple brackets
  if (preview.multiple_brackets) {
    const brackets = selectedBracketType === 'scratch' 
      ? preview.multiple_brackets.scratch_brackets
      : preview.multiple_brackets.handicap_brackets

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
        selectedBracket={selectedBracket}
        selectedRound={selectedRound}
        onMatchSelect={onMatchSelect}
        isMobile={isMobile}
      />
    )
  }

  return null
}

// Single bracket display
function SingleBracketView({ 
  rounds, 
  onMatchSelect 
}: { 
  rounds: BracketRound[]
  onMatchSelect?: (bracketId: string, round: number, match: number) => void
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
            {round.name}
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {round.matches.map((match, matchIndex) => (
              <MatchCard 
                key={matchIndex}
                match={match}
                onClick={() => onMatchSelect?.('single', roundIndex, matchIndex)}
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
  selectedBracket,
  selectedRound,
  onMatchSelect,
  isMobile
}: {
  brackets: BracketItem[]
  selectedBracket: {type: 'scratch' | 'handicap', index: number} | null
  selectedRound: number
  onMatchSelect?: (bracketId: string, round: number, match: number) => void
  isMobile: boolean
}) {
  if (selectedBracket) {
    const bracket = brackets[selectedBracket.index]
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
            {bracket.title || `Bracket ${selectedBracket.index + 1}`}
          </h3>
        </div>
        
        <SingleBracketView 
          rounds={bracket.rounds}
          onMatchSelect={(_, round, match) => 
            onMatchSelect?.(`${selectedBracket.type}_${selectedBracket.index}`, round, match)
          }
        />
      </div>
    )
  }

  // Show bracket grid
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
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

// Individual match card
function MatchCard({ 
  match, 
  onClick 
}: { 
  match: Match
  onClick?: () => void
}) {
  const isCompleted = match.winner || (match.scoreA !== undefined && match.scoreB !== undefined)
  
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
      onMouseOver={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = '#3b82f6'
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.1)'
        }
      }}
      onMouseOut={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = '#e5e7eb'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem'
      }}>
        <span style={{
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          Seed {match.seedA} vs Seed {match.seedB}
        </span>
        {match.winner && (
          <span style={{
            fontSize: '0.75rem',
            color: '#059669',
            fontWeight: '600'
          }}>
            Winner: {match.winner}
          </span>
        )}
      </div>
      
      <div style={{ fontSize: '0.875rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '0.25rem'
        }}>
          <span>{match.playerA || `Player ${match.seedA}`}</span>
          <span style={{ fontWeight: '600' }}>{match.scoreA || '-'}</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between'
        }}>
          <span>{match.playerB || `Player ${match.seedB}`}</span>
          <span style={{ fontWeight: '600' }}>{match.scoreB || '-'}</span>
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
  bracket: BracketItem
  index: number
  onClick: () => void
}) {
  const totalMatches = bracket.rounds?.reduce((total: number, round: BracketRound) => 
    total + (round.matches?.length || 0), 0) || 0
  const completedMatches = bracket.rounds?.reduce((total: number, round: BracketRound) => 
    total + (round.matches?.filter((m: Match) => m.winner || (m.scoreA && m.scoreB))?.length || 0), 0) || 0

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
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = '#3b82f6'
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.1)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = '#e5e7eb'
        e.currentTarget.style.boxShadow = 'none'
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