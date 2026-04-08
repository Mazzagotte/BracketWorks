import { useState } from 'react'
import { Card, Button } from '../../components/UI'
import { colors, spacing } from '../../lib/design-system'
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
  if (rank === 1) return { emoji: '🥇', color: colors.success, label: '1st' }
  if (rank === 2) return { emoji: '🥈', color: '#0369a1', label: '2nd' }
  if (rank === 3) return { emoji: '🥉', color: colors.warning, label: '3rd' }
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
    <div style={{
      marginBottom: spacing.md,
      borderLeft: isPaidOut ? `4px solid ${colors.success}` : undefined,
      backgroundColor: isPaidOut ? colors.backgrounds.success : 'white',
    }}>
    <Card>
      {/* Header Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: spacing.md 
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            {rankBadge && (
              <span style={{ fontSize: '24px' }} title={`${rankBadge.label} Place`}>
                {rankBadge.emoji}
              </span>
            )}
            <h3 style={{ 
              fontSize: '20px',
              fontWeight: 600,
              margin: 0,
              color: colors.text.primary 
            }}>
              {player.player_name}
            </h3>
            {isPaidOut && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: colors.success,
                color: 'white',
                fontSize: '12px',
                fontWeight: 600
              }}>
                PAID
              </span>
            )}
          </div>
          
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            color: rankBadge ? rankBadge.color : colors.primary,
            marginBottom: spacing.xs
          }}>
            {formatCurrency(player.total_amount)}
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: spacing.md, 
            fontSize: '14px',
            color: colors.text.secondary 
          }}>
            <span>
              🎯 {player.total_brackets} bracket{player.total_brackets !== 1 ? 's' : ''}
            </span>
            {player.scratchCount > 0 && (
              <span>⚡ {player.scratchCount} scratch</span>
            )}
            {player.handicapCount > 0 && (
              <span>⚖️ {player.handicapCount} handicap</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: spacing.sm, 
        marginBottom: isExpanded ? spacing.md : 0 
      }}>
        <EnhancedButton
          variant={isPaidOut ? 'secondary' : 'primary'}
          size="sm"
          onClick={onTogglePaid}
        >
          {isPaidOut ? '✓ Paid' : 'Mark as Paid'}
        </EnhancedButton>
        
        <EnhancedButton
          variant="secondary"
          size="sm"
          onClick={onToggleExpand}
        >
          {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
        </EnhancedButton>
        
        <EnhancedButton
          variant="secondary"
          size="sm"
          onClick={onCopyDetails}
        >
          📋 Copy
        </EnhancedButton>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{ 
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTop: `1px solid ${colors.border}` 
        }}>
          <h4 style={{ 
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: spacing.sm,
            color: colors.text.primary 
          }}>
            Bracket Details
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {player.brackets.map((bracket, idx) => (
              <div
                key={idx}
                style={{
                  padding: spacing.sm,
                  backgroundColor: colors.surface,
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    color: colors.text.primary,
                    marginBottom: '2px' 
                  }}>
                    {bracket.bracket_name}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    color: colors.text.secondary 
                  }}>
                    {bracket.bracket_type} • {bracket.position} • Score: {bracket.score}
                  </div>
                </div>
                
                <div style={{ 
                  fontWeight: 700, 
                  color: colors.primary,
                  fontSize: '16px' 
                }}>
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
