import React from 'react'
import styles from './BracketRenderer.module.css'

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

const BracketRendererComponent = ({ 
  tournamentPreviewData, 
  selectedBracketType, 
  selectedBracketConfiguration,
  selectedRoundNumber,
  onMatchClick,
  isMobileDisplay = false
}: BracketRendererProps) => {
  if (!tournamentPreviewData) {
    return (
      <div className={styles.emptyState}>
        <p>No bracket data available</p>
        <p className={styles.emptyStateSub}>
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
        <div className={styles.emptyState}>
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
    <div className={styles.roundsRow}>
      {rounds.map((round, roundIndex) => (
        <div key={roundIndex} className={styles.roundCol}>
          <h3 className={styles.roundTitle}>{round.roundName}</h3>
          <div className={styles.roundMatches}>
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
        <div className={styles.bracketHeader}>
          <h3 className={styles.bracketHeaderTitle}>
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
    <div className={isMobileDisplay ? styles.bracketsGridMobile : styles.bracketsGrid}>
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
      className={`${styles.matchCard} ${onClick ? styles.matchCardClickable : ''} ${isCompleted ? styles.matchCardCompleted : ''}`}
    >
      <div className={styles.matchStatusRow}>
        {MatchData.winner && (
          <span className={styles.matchWinner}>Winner: {MatchData.winner}</span>
        )}
        {MatchData.both_advance && (
          <span
            className={styles.badgeBothAdvance}
            title={MatchData.elimination_notes || 'Both players advance - lower next round score will be eliminated'}
          >
            BOTH ADVANCE
          </span>
        )}
        {MatchData.split_pot && (
          <span className={styles.badgeSplitPot} title="Finals tie - pot split evenly">
            SPLIT POT
          </span>
        )}
      </div>

      <div className={styles.matchBody}>
        <div className={styles.matchPlayerRow}>
          <span>{MatchData.playerA || 'TBD'}</span>
          <span className={styles.matchScore}>{MatchData.scoreA || '-'}</span>
        </div>
        <div className={styles.matchPlayerRowLast}>
          <span>{MatchData.playerB || 'TBD'}</span>
          <span className={styles.matchScore}>{MatchData.scoreB || '-'}</span>
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

  const progressPct = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0

  return (
    <div onClick={onClick} className={styles.bracketCard}>
      <h4 className={styles.bracketCardTitle}>
        {bracket.title || `Bracket ${index + 1}`}
      </h4>
      <div className={styles.bracketCardProgress}>
        Progress: {completedMatches}/{totalMatches} matches completed
      </div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ '--progress': `${progressPct}%` } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

// Export memoized component for better performance
export const BracketRenderer = React.memo(BracketRendererComponent)

