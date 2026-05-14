import { Card } from '../../components/UI'
import EnhancedButton from '../../components/EnhancedButton'

export interface PlayerWinnings {
  player_name: string
  player_id: number
  total_amount: number
  total_brackets: number
  best_place: number
  scratchCount: number
  handicapCount: number
  brackets: Array<{
    bracket_name: string
    bracket_type: string
    place: number
    position: string
    payout_amount: number
    score: number
  }>
}

interface PlayerPayoutCardProps {
  player: PlayerWinnings
  rank: number
  isPaidOut: boolean
  isExpanded: boolean
  onTogglePaid: () => void
  onToggleExpand: () => void
  onCopyDetails: () => void
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}

const getRankBadge = (rank: number) => {
  if (rank === 1) return { badge: '1st', label: '1st' }
  if (rank === 2) return { badge: '2nd', label: '2nd' }
  if (rank === 3) return { badge: '3rd', label: '3rd' }
  return null
}

export function PlayerPayoutCard({
  player,
  rank,
  isPaidOut,
  isExpanded,
  onTogglePaid,
  onToggleExpand,
  onCopyDetails
}: PlayerPayoutCardProps) {
  const rankBadge = getRankBadge(rank)

  return (
    <div className={`bw-player-card-wrap ${isPaidOut ? 'bw-player-card-wrap-paid' : ''}`}>
    <Card>
      {/* Header Section */}
      <div className="bw-player-card-header">
        <div className="bw-player-card-left">
          <div className="bw-player-card-name-row">
            {rankBadge && (
              <span className="bw-player-card-rank-icon" title={`${rankBadge.label} Place`}>
                {rankBadge.badge}
              </span>
            )}
            <h3 className="bw-player-card-name">
              {player.player_name}
            </h3>
            {isPaidOut && (
              <span className="bw-player-card-paid-badge">
                PAID
              </span>
            )}
          </div>
          
          <div className="bw-player-card-amount" data-rank={rank <= 3 ? rank : undefined}>
            {formatCurrency(player.total_amount)}
          </div>
          
          <div className="bw-player-card-stats">
            <span>
              Brackets: {player.total_brackets} bracket{player.total_brackets !== 1 ? 's' : ''}
            </span>
            {player.scratchCount > 0 && (
              <span>Scratch: {player.scratchCount}</span>
            )}
            {player.handicapCount > 0 && (
              <span>Handicap: {player.handicapCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={`bw-player-card-actions ${isExpanded ? 'bw-player-card-actions-open' : ''}`}>
        <EnhancedButton
          variant={isPaidOut ? 'secondary' : 'primary'}
          size="sm"
          onClick={onTogglePaid}
        >
          {isPaidOut ? 'Paid' : 'Mark as Paid'}
        </EnhancedButton>
        
        <EnhancedButton
          variant="secondary"
          size="sm"
          onClick={onToggleExpand}
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </EnhancedButton>
        
        <EnhancedButton
          variant="secondary"
          size="sm"
          onClick={onCopyDetails}
        >
          Copy
        </EnhancedButton>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="bw-player-card-details">
          <h4 className="bw-player-card-details-title">
            Bracket Details
          </h4>
          
          <div className="bw-player-card-brackets">
            {player.brackets.map((bracket, idx) => (
              <div key={idx} className="bw-player-card-bracket-row">
                <div className="bw-player-card-bracket-left">
                  <div className="bw-player-card-bracket-name">
                    {bracket.bracket_name}
                  </div>
                  <div className="bw-player-card-bracket-info">
                    {bracket.bracket_type} • {bracket.position} • Score: {bracket.score}
                  </div>
                </div>
                
                <div className="bw-player-card-bracket-amount">
                  {formatCurrency(bracket.payout_amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
    </div>
  )
}
