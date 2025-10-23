'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Tournament, Squad, Player, BracketData, ScoreData, WinnerData, BracketSettings, ToastMessage } from '../lib/types'

import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { API } from '../lib/api'
import { logger } from '../lib/logger'
import { usePageHeader } from '../lib/header-context'
import EnhancedButton from '../components/EnhancedButton'
import { typography, colors, spacing, stylePresets } from '../lib/design-system'
import { 
  PageContainer, 
  ContentWrapper, 
  Card, 
  Grid, 
  StatCard,
  Button
} from '../components/UI'

interface Winner {
  place: number
  position: string
  player_name: string
  player_id: number
  score: number
  bracket_type: string
  bracket_name: string
  payout_percentage: number
  payout_amount: number
  prize_pool_total: number
}

interface PayoutSummary {
  total_prize_pool: number
  total_scratch_pool: number
  total_handicap_pool: number
  scratch_brackets: BracketPayout[]
  handicap_brackets: BracketPayout[]
  winners_by_bracket: Winner[]
  validation: {
    is_valid: boolean
    errors: string[]
    warnings: string[]
    total_distributed: number
    total_collected: number
  }
  tournament_info: {
    id: number
    name: string
    squad_id: number | null
    entry_fees: {
      scratch: number
      handicap: number
    }
  }
}

interface BracketPayout {
  bracket_name: string
  bracket_type: string
  bracket_size: number
  prize_pool: number
  winners: Winner[]
  status: string
}

interface PlayerEntry {
  id: number
  name: string
  scratch_brackets_entered: number
  handicap_brackets_entered: number
  total_brackets_entered: number
  scratch_brackets_won: number
  handicap_brackets_won: number
  total_brackets_won: number
  total_amount_won: number
  scratch_amount_won: number
  handicap_amount_won: number
  placement_details: Array<{
    bracket_name: string
    bracket_type: string
    placement: number
    placement_text: string
    amount_won: number
  }>
}

interface EntryData {
  tournament_info: {
    id: number
    name: string
    squad_id: number | null
  }
  entries: PlayerEntry[]
  summary: {
    total_players: number
    total_scratch_entries: number
    total_handicap_entries: number
    total_amount_distributed: number
    average_per_player: number
  }
}

export default function PayoutsPage() {
  // Authentication check - must be at the top
  const { isAuthenticated } = useAuth();

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuth = typeof window !== 'undefined' && 
    localStorage.getItem('token') && 
    localStorage.getItem('user_id');

  // Authentication guard - redirect if not logged in
  if (!isAuthenticated && !hasStoredAuth) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🔒</div>
          <div>Please log in to access payout management</div>
        </div>
      </div>
    );
  }

  // Show loading if we have stored auth but context isn't ready yet
  if (!isAuthenticated && hasStoredAuth) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🎳</div>
          <div>Loading payout management...</div>
        </div>
      </div>
    );
  }

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [squads, setSquads] = useState<any[]>([])
  const [selectedSquad, setSelectedSquad] = useState<any | null>(null)
  const [payoutData, setPayoutData] = useState<PayoutSummary | null>(null)
  const [entryData, setEntryData] = useState<EntryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'payouts' | 'entries'>('payouts')
  const [paidOutPlayers, setPaidOutPlayers] = useState<Set<string>>(new Set())
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'amount' | 'name' | 'brackets' | 'status'>('amount')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  const getTimeSinceRefresh = useCallback(() => {
    const diff = Math.floor((new Date().getTime() - lastRefresh.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }, [lastRefresh])

  const renderPlayersTable = () => {
    if (!payoutData || !payoutData.winners_by_bracket.length) return null

    // Group winners by player and calculate totals
    const playerMap = new Map<string, {
      player_name: string
      player_id: number
      total_amount: number
      total_brackets: number
      best_place: number
      brackets: Array<{
        bracket_name: string
        bracket_type: string
        place: number
        position: string
        payout_amount: number
        score: number
      }>
    }>()
    
    payoutData.winners_by_bracket.forEach(winner => {
      const key = `${winner.player_name}_${winner.player_id}`
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          player_name: winner.player_name,
          player_id: winner.player_id,
          total_amount: 0,
          total_brackets: 0,
          best_place: winner.place,
          brackets: []
        })
      }
      
      const player = playerMap.get(key)!
      player.total_amount += winner.payout_amount
      player.total_brackets += 1
      player.best_place = Math.min(player.best_place, winner.place)
      player.brackets.push({
        bracket_name: winner.bracket_name,
        bracket_type: winner.bracket_type,
        place: winner.place,
        position: winner.position,
        payout_amount: winner.payout_amount,
        score: winner.score
      })
    })
    
    // Apply sorting
    let sortedPlayers = Array.from(playerMap.values())
    
    switch (sortBy) {
      case 'name':
        sortedPlayers.sort((a, b) => {
          const result = a.player_name.localeCompare(b.player_name)
          return sortDirection === 'asc' ? result : -result
        })
        break
      case 'brackets':
        sortedPlayers.sort((a, b) => {
          const result = a.total_brackets - b.total_brackets
          return sortDirection === 'asc' ? result : -result
        })
        break
      case 'status':
        sortedPlayers.sort((a, b) => {
          const aKey = `${a.player_name}_${a.player_id}`
          const bKey = `${b.player_name}_${b.player_id}`
          const aPaid = paidOutPlayers.has(aKey)
          const bPaid = paidOutPlayers.has(bKey)
          if (aPaid === bPaid) return 0
          return sortDirection === 'asc' ? (aPaid ? 1 : -1) : (aPaid ? -1 : 1)
        })
        break
      case 'amount':
      default:
        sortedPlayers.sort((a, b) => {
          const result = a.total_amount - b.total_amount
          return sortDirection === 'asc' ? result : -result
        })
        break
    }
    
    return sortedPlayers.map((player, index) => {
      const isTopEarner = index === 0
      const isSecondEarner = index === 1
      const isThirdEarner = index === 2
      
      const rankColor = isTopEarner ? '#059669' : isSecondEarner ? '#0369a1' : isThirdEarner ? '#d97706' : '#374151'
      const rowBg = index % 2 === 0 ? '#fafbfc' : 'white'
      
      // Count bracket types
      const scratchBrackets = player.brackets.filter(b => b.bracket_type.toLowerCase() === 'scratch').length
      const handicapBrackets = player.brackets.filter(b => b.bracket_type.toLowerCase() === 'handicap').length
      
      return (
        <>
          <div
            key={`${player.player_name}_${player.player_id}`}
            style={{
              display: 'table-row',
              backgroundColor: rowBg,
              transition: 'background-color 0.2s ease'
            }}
          >
            {/* Rank */}
            <div style={{
              display: 'table-cell',
              padding: '16px 12px',
              borderBottom: '1px solid #e2e8f0',
              verticalAlign: 'middle'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: rankColor,
                fontWeight: '600'
              }}>
                <span>#{index + 1}</span>
              </div>
            </div>

            {/* Player Name */}
            <div style={{
              display: 'table-cell',
              padding: '16px 12px',
              borderBottom: '1px solid #e2e8f0',
              verticalAlign: 'middle'
            }}>
              <div style={{
                fontWeight: '600',
                fontSize: '16px',
                color: '#111827'
              }}>
                {player.player_name}
              </div>
            </div>

            {/* Brackets Won */}
            <div style={{
              display: 'table-cell',
              padding: '16px 12px',
              borderBottom: '1px solid #e2e8f0',
              textAlign: 'center',
              verticalAlign: 'middle'
            }}>
              <div style={{
                fontWeight: '600',
                fontSize: '18px',
                color: '#374151'
              }}>
                {player.total_brackets}
              </div>
            </div>

            {/* Total Winnings */}
            <div 
              style={{
                display: 'table-cell',
                padding: '16px 12px',
                borderBottom: '1px solid #e2e8f0',
                textAlign: 'right',
                verticalAlign: 'middle',
                cursor: 'pointer'
              }}
              onClick={() => copyToClipboard(formatCurrency(player.total_amount))}
              title="Click to copy amount"
            >
              <div style={{
                fontWeight: '700',
                fontSize: '18px',
                color: rankColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px'
              }}>
                {formatCurrency(player.total_amount)}
              </div>
            </div>

            {/* Payment Status */}
            <div style={{
              display: 'table-cell',
              padding: '16px 12px',
              borderBottom: '1px solid #e2e8f0',
              textAlign: 'center',
              verticalAlign: 'middle'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: paidOutPlayers.has(`${player.player_name}_${player.player_id}`) 
                  ? '#dcfce7' 
                  : '#fef3c7',
                color: paidOutPlayers.has(`${player.player_name}_${player.player_id}`) 
                  ? '#16a34a' 
                  : '#d97706'
              }}>
                <span>
                  {paidOutPlayers.has(`${player.player_name}_${player.player_id}`) 
                    ? 'Paid' 
                    : 'Pending'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: 'table-cell',
              padding: '16px 12px',
              borderBottom: '1px solid #e2e8f0',
              textAlign: 'center',
              verticalAlign: 'middle'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <button
                  onClick={() => togglePaidStatus(`${player.player_name}_${player.player_id}`)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: paidOutPlayers.has(`${player.player_name}_${player.player_id}`) 
                      ? '#fee2e2' 
                      : '#dcfce7',
                    color: paidOutPlayers.has(`${player.player_name}_${player.player_id}`) 
                      ? '#dc2626' 
                      : '#16a34a'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {paidOutPlayers.has(`${player.player_name}_${player.player_id}`) 
                    ? 'Mark Unpaid' 
                    : 'Mark Paid'}
                </button>
                
                <button
                  onClick={() => togglePlayerExpansion(`${player.player_name}_${player.player_id}`)}
                  style={{
                    padding: '6px 8px',
                    fontSize: '14px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: '#f3f4f6',
                    color: '#374151'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                  }}
                >
                  {expandedPlayers.has(`${player.player_name}_${player.player_id}`) ? '▲' : '▼'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Expanded Details Row */}
          {expandedPlayers.has(`${player.player_name}_${player.player_id}`) && (
            <div style={{
              display: 'table-row',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{
                display: 'table-cell',
                padding: '16px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  Bracket Details for {player.player_name}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '12px'
                }}>
                  {player.brackets.map((bracket, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {bracket.bracket_name}
                      </div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>
                        <strong>Type:</strong> {bracket.bracket_type}
                      </div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>
                        <strong>Position:</strong> {bracket.position}
                      </div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>
                        <strong>Score:</strong> {bracket.score || 'N/A'}
                      </div>
                      <div style={{ 
                        color: '#059669', 
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                      onClick={() => copyToClipboard(formatCurrency(bracket.payout_amount))}
                      title="Click to copy payout">
                        <strong>Payout:</strong> {formatCurrency(bracket.payout_amount)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#0369a1'
                }}>
                  <strong>Summary:</strong> {player.total_brackets} brackets won, 
                  {scratchBrackets} scratch + {handicapBrackets} handicap
                </div>
              </div>
            </div>
          )}
        </>
      )
    })
  }

  // Header configuration
  const headerActions = useMemo(() => (
    <div style={{ 
      display: 'flex', 
      gap: '12px', 
      alignItems: 'center', 
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      minHeight: '40px' // Ensure consistent height
    }}>
      <div style={{ 
        fontSize: '12px', 
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        borderRadius: '6px',
        backgroundColor: 'rgba(107, 114, 128, 0.05)',
        border: '1px solid rgba(107, 114, 128, 0.1)'
      }}>
        <span>Updated {getTimeSinceRefresh()}</span>
        <button
          onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          style={{
            background: autoRefreshEnabled ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
            border: `1px solid ${autoRefreshEnabled ? '#059669' : 'rgba(107, 114, 128, 0.2)'}`,
            borderRadius: '4px',
            color: autoRefreshEnabled ? '#059669' : '#6b7280',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px 6px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '28px',
            height: '24px'
          }}
          title={autoRefreshEnabled ? 'Auto-refresh ON - Click to disable' : 'Auto-refresh OFF - Click to enable'}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = autoRefreshEnabled ? 'rgba(5, 150, 105, 0.15)' : 'rgba(107, 114, 128, 0.1)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = autoRefreshEnabled ? 'rgba(5, 150, 105, 0.1)' : 'transparent';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {autoRefreshEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
      
      <EnhancedButton
        onClick={() => {
          setActiveTab(activeTab === 'payouts' ? 'entries' : 'payouts')
        }}
        variant="secondary"
        size="sm"
      >
        Switch to {activeTab === 'payouts' ? 'Entries' : 'Payouts'}
      </EnhancedButton>
    </div>
  ), [activeTab, autoRefreshEnabled, getTimeSinceRefresh]) // tournament and loading removed as unnecessary

  usePageHeader({
    title: 'Payouts',
    subtitle: tournament && selectedSquad 
      ? `${tournament.name} • ${selectedSquad.name}`
      : tournament 
        ? tournament.name
        : 'Tournament prize distributions',
    actions: headerActions
  })

  // Load current tournament on mount
  useEffect(() => {
    loadCurrentTournament()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load payout data when tournament or squad is available/changes
  useEffect(() => {
    if (tournament) {
      loadPayoutData()
    }
  }, [tournament, selectedSquad]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshEnabled || !tournament) return

    const interval = setInterval(() => {
      loadPayoutData()
      setLastRefresh(new Date())
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefreshEnabled, tournament, selectedSquad]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPayoutData = async () => {
    if (!tournament) return

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Not authenticated')
        return
      }

      // Include squad_id parameter if available
      const squadParam = selectedSquad ? `?squad_id=${selectedSquad.id}` : ''
      const url = `/api/v1/payouts/calculate/${tournament.id}${squadParam}`
      logger.debug('Loading payouts from', { url });
      
      const response = await fetch(API(url), {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      logger.debug('Payout response status', { status: response.status });
      
      if (response.ok) {
        const data = await response.json()
        logger.debug('Payout data loaded', { bracketCount: data ? Object.keys(data).length : 0 })
        setPayoutData(data)
      } else if (response.status === 404) {
        // Handle case where no brackets exist for this tournament
        logger.warn('No brackets found for tournament')
        setError(null) // Clear error since this is expected
        setPayoutData(null)
      } else {
        const errorData = await response.json()
        logger.error('Payout error', { errorData })
        setError(errorData.detail || 'Failed to load payout data')
      }
    } catch (error) {
      setError('Network error while loading payout data')
      logger.error('Error loading payout data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentTournament = async () => {
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    const token = localStorage.getItem('token');
    
    if (lastTournamentId && token) {
      try {
        // Load tournament data
        const tournamentResponse = await fetch(API(`/api/v1/tournaments/${lastTournamentId}`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (tournamentResponse.ok) {
          const tournamentData = await tournamentResponse.json();
          setTournament(tournamentData);
        }

        // Load squads data
        const squadsResponse = await fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (squadsResponse.ok) {
          const squadsData = await squadsResponse.json();
          setSquads(squadsData);
          
          // Auto-select first squad if available
          if (squadsData.length > 0 && !selectedSquad) {
            setSelectedSquad(squadsData[0]);
          }
        }
      } catch (error) {
        logger.error('Error loading current tournament:', error);
      }
    }
  }

  const loadEntryData = async () => {
    if (!tournament) return

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Not authenticated')
        return
      }

      // Try the new dedicated entries endpoint first, fallback to constructing from winners data
      let response = await fetch(API(`/api/v1/payouts/entries/${tournament.id}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setEntryData(data)
        return
      }

      // Fallback: construct from brackets, winners, and bowler data for accurate entry counting
      const [bracketResponse, bowlerResponse] = await Promise.all([
        fetch(API(`/api/v1/brackets/?tournament_id=${tournament.id}`), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(API(`/api/v1/bowlers/?tournament_id=${tournament.id}`), {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (!bracketResponse.ok || !bowlerResponse.ok) {
        throw new Error('Failed to load entry data')
      }

      const bracketsData = await bracketResponse.json()
      const bowlersData = await bowlerResponse.json()

      // Also get winners data for win amounts
      const winnersResponse = await fetch(API(`/api/v1/payouts/winners/${tournament.id}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const winnersData = winnersResponse.ok ? await winnersResponse.json() : { all_winners: [] }

      // Process the data to create accurate entry summary
      const entryMap = new Map<number, PlayerEntry>()
      
      // Initialize entries from bowler data
      bowlersData.forEach((bowler: Player) => {
        entryMap.set(bowler.id, {
          id: bowler.id,
          name: bowler.name,
          scratch_brackets_entered: 0,
          handicap_brackets_entered: 0,
          total_brackets_entered: 0,
          scratch_brackets_won: 0,
          handicap_brackets_won: 0,
          total_brackets_won: 0,
          total_amount_won: 0,
          scratch_amount_won: 0,
          handicap_amount_won: 0,
          placement_details: []
        })
      })

      // Count actual bracket entries from bracket data
      if (bracketsData && Array.isArray(bracketsData)) {
        bracketsData.forEach((bracket: BracketData) => {
          if (bracket.players && Array.isArray(bracket.players)) {
            bracket.players.forEach((player: Player) => {
              const playerId = player.bowler_id || player.player_id || player.id
              const entry = entryMap.get(playerId)
              if (entry) {
                if (bracket.type?.toLowerCase() === 'scratch') {
                  entry.scratch_brackets_entered += 1
                } else {
                  entry.handicap_brackets_entered += 1
                }
              }
            })
          }
        })
      } else {
        // Fallback: estimate entries from winners data
        if (winnersData.all_winners) {
          const bracketPlayerMap = new Map<string, Set<number>>()
          winnersData.all_winners.forEach((winner: WinnerData) => {
            const bracketKey = `${winner.bracket_name}_${winner.bracket_type}`
            if (!bracketPlayerMap.has(bracketKey)) {
              bracketPlayerMap.set(bracketKey, new Set())
            }
            bracketPlayerMap.get(bracketKey)!.add(winner.player_id)
          })
          
          // Count each player's entries based on unique bracket participations
          bracketPlayerMap.forEach((playerIds, bracketKey) => {
            const bracketType = bracketKey.split('_').pop()?.toLowerCase()
            playerIds.forEach(playerId => {
              const entry = entryMap.get(playerId)
              if (entry) {
                if (bracketType === 'scratch') {
                  entry.scratch_brackets_entered += 1
                } else {
                  entry.handicap_brackets_entered += 1
                }
              }
            })
          })
        }
      }

      // Process winners data to populate winnings and win counts
      if (winnersData.all_winners) {
        winnersData.all_winners.forEach((winner: WinnerData) => {
          const entry = entryMap.get(winner.player_id)
          if (entry) {            
            // Count wins and amounts for any paid position
            if (winner.payout_amount > 0) {
              if (winner.bracket_type.toLowerCase() === 'scratch') {
                entry.scratch_brackets_won += 1
                entry.scratch_amount_won += winner.payout_amount
              } else {
                entry.handicap_brackets_won += 1
                entry.handicap_amount_won += winner.payout_amount
              }
              
              entry.placement_details.push({
                bracket_name: winner.bracket_name,
                bracket_type: winner.bracket_type,
                placement: winner.place,
                placement_text: String(winner.position),
                amount_won: winner.payout_amount
              })
            }
          }
        })
      }

      // Calculate totals
      const entries = Array.from(entryMap.values()).map(entry => ({
        ...entry,
        total_brackets_entered: entry.scratch_brackets_entered + entry.handicap_brackets_entered,
        total_brackets_won: entry.scratch_brackets_won + entry.handicap_brackets_won,
        total_amount_won: entry.scratch_amount_won + entry.handicap_amount_won
      }))

      const summary = {
        total_players: entries.length,
        total_scratch_entries: entries.reduce((sum, e) => sum + e.scratch_brackets_entered, 0),
        total_handicap_entries: entries.reduce((sum, e) => sum + e.handicap_brackets_entered, 0),
        total_amount_distributed: entries.reduce((sum, e) => sum + e.total_amount_won, 0),
        average_per_player: entries.length > 0 ? entries.reduce((sum, e) => sum + e.total_amount_won, 0) / entries.length : 0
      }

      setEntryData({
        tournament_info: {
          id: tournament.id,
          name: tournament.name,
          squad_id: null // TODO: Add squad selection
        },
        entries: entries
          .filter(entry => entry.total_brackets_entered > 0) // Only show players who actually entered brackets
          .sort((a, b) => b.total_amount_won - a.total_amount_won), // Sort by amount won
        summary
      })

    } catch (error) {
      setError('Failed to load entry data')
      logger.error('Error loading entry data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const togglePaidStatus = (playerKey: string) => {
    setPaidOutPlayers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(playerKey)) {
        newSet.delete(playerKey)
      } else {
        newSet.add(playerKey)
      }
      return newSet
    })
  }

  const togglePlayerExpansion = (playerKey: string) => {
    setExpandedPlayers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(playerKey)) {
        newSet.delete(playerKey)
      } else {
        newSet.add(playerKey)
      }
      return newSet
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add a toast notification here
    } catch (err) {
      logger.error('Failed to copy: ', err)
    }
  }

  const handleSort = (column: 'amount' | 'name' | 'brackets' | 'status') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '20px'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          marginBottom: '24px',
          color: colors.text.primary
        }}>
          Tournament Payouts & Winners
        </h1>

        {/* Tab Navigation */}
        {tournament && (
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('payouts')}
                style={{
                  padding: '12px 24px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'payouts' ? colors.primary : colors.gray[100],
                  color: activeTab === 'payouts' ? colors.text.white : colors.text.primary,
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Payouts & Winners
              </button>
              <button
                onClick={() => {
                  setActiveTab('entries')
                  if (!entryData) loadEntryData()
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'entries' ? colors.primary : colors.gray[100],
                  color: activeTab === 'entries' ? colors.text.white : colors.text.primary,
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Entry Analysis
              </button>
            </div>
          </div>
        )}

        {/* No Tournament Selected */}
        {!tournament && !loading && (
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: colors.shadow.sm
          }}>
            <div style={{ color: colors.text.secondary, fontSize: '16px' }}>
              Please select a tournament from the dashboard to view payouts
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            backgroundColor: colors.backgrounds.error,
            border: `1px solid ${colors.backgrounds.errorBorder}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ color: colors.error, fontWeight: '600' }}>
              Error: {error}
            </div>
          </div>
        )}

        {/* No Brackets Available */}
        {tournament && !loading && !error && !payoutData && (
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: colors.shadow.sm
          }}>
            <h3 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '12px', 
              color: colors.text.primary
            }}>
              No Brackets Generated Yet
            </h3>
            <p style={{ 
              color: colors.text.secondary, 
              marginBottom: '24px',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              Tournament brackets need to be generated before payouts can be calculated.<br/>
              Visit the Brackets page to generate brackets for this tournament.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <a 
                href="/brackets"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: colors.primary,
                  color: colors.text.white,
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >
                Generate Brackets
              </a>
              <a 
                href="/players"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: colors.gray[100],
                  color: colors.text.primary,
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  border: `1px solid ${colors.border}`,
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.gray[200]}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.gray[100]}
              >
                Manage Players
              </a>
            </div>
            <div style={{
              marginTop: '24px',
              padding: '16px',
              backgroundColor: colors.backgrounds.info,
              borderRadius: '8px',
              border: `1px solid ${colors.info}`
            }}>
              <h4 style={{ 
                margin: '0 0 8px 0', 
                color: colors.info,
                fontSize: '14px',
                fontWeight: '600'
              }}>
                How to Generate Payouts:
              </h4>
              <ol style={{ 
                textAlign: 'left', 
                color: colors.info,
                fontSize: '14px',
                margin: 0,
                paddingLeft: '20px'
              }}>
                <li style={{ marginBottom: '4px' }}>Add players and their scores</li>
                <li style={{ marginBottom: '4px' }}>Generate tournament brackets</li>
                <li style={{ marginBottom: '4px' }}>Complete bracket matches</li>
                <li>Return here to view payouts</li>
              </ol>
            </div>
          </div>
        )}

        {/* Payout Results */}
        {activeTab === 'payouts' && !loading && !error && payoutData && (
          <>
            {/* Summary Cards */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div 
                style={{
                  backgroundColor: colors.backgrounds.info,
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${colors.info}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onClick={() => copyToClipboard(formatCurrency(payoutData.total_prize_pool))}
                title="Click to copy amount"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', color: colors.info, fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Total Prize Pool
                </h3>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: colors.info }}>
                  {formatCurrency(payoutData.total_prize_pool)}
                </p>
                <div style={{ 
                  fontSize: '12px', 
                  color: colors.info, 
                  opacity: 0.8,
                  marginTop: '4px'
                }}>
                  {payoutData.scratch_brackets.length + payoutData.handicap_brackets.length} brackets
                </div>
              </div>

              <div 
                style={{
                  backgroundColor: colors.backgrounds.success,
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${colors.success}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => copyToClipboard(formatCurrency(payoutData.total_scratch_pool))}
                title="Click to copy amount"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', color: colors.success, fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Scratch Pool
                </h3>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: colors.success }}>
                  {formatCurrency(payoutData.total_scratch_pool)}
                </p>
                <div style={{ 
                  fontSize: '12px', 
                  color: colors.success, 
                  opacity: 0.8,
                  marginTop: '4px'
                }}>
                  {payoutData.scratch_brackets.length} brackets
                </div>
              </div>

              <div 
                style={{
                  backgroundColor: colors.backgrounds.warning,
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${colors.warning}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => copyToClipboard(formatCurrency(payoutData.total_handicap_pool))}
                title="Click to copy amount"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', color: colors.warning, fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Handicap Pool
                </h3>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: colors.warning }}>
                  {formatCurrency(payoutData.total_handicap_pool)}
                </p>
                <div style={{ 
                  fontSize: '12px', 
                  color: colors.warning, 
                  opacity: 0.8,
                  marginTop: '4px'
                }}>
                  {payoutData.handicap_brackets.length} brackets
                </div>
              </div>

              <div style={{
                backgroundColor: colors.gray[50],
                borderRadius: '8px',
                padding: '16px',
                border: `1px solid ${colors.accent}`
              }}>
                <h3 style={{ margin: '0 0 8px 0', color: colors.accent, fontSize: '14px', fontWeight: '600' }}>
                  Total Winners
                </h3>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: colors.accent }}>
                  {payoutData.winners_by_bracket.length}
                </p>
              </div>
            </div>

            {/* Validation Status */}
            {!payoutData.validation.is_valid && (
              <div style={{
                backgroundColor: colors.backgrounds.error,
                border: `1px solid ${colors.backgrounds.errorBorder}`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', color: colors.error, fontSize: '16px', fontWeight: '600' }}>
                  Validation Issues
                </h3>
                {payoutData.validation.errors.map((error, index) => (
                  <p key={index} style={{ margin: '4px 0', color: colors.error }}>• {error}</p>
                ))}
              </div>
            )}

            {/* Payment Status Summary */}
            {payoutData.winners_by_bracket.length > 0 && (
              <div style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: colors.text.primary, fontSize: '16px', fontWeight: '600' }}>
                  💳 Payment Status Overview
                </h3>
                {(() => {
                  // Calculate payment statistics
                  const playerMap = new Map<string, { total_amount: number }>()
                  payoutData.winners_by_bracket.forEach(winner => {
                    const key = `${winner.player_name}_${winner.player_id}`
                    if (!playerMap.has(key)) {
                      playerMap.set(key, { total_amount: 0 })
                    }
                    playerMap.get(key)!.total_amount += winner.payout_amount
                  })
                  
                  const totalPlayers = playerMap.size
                  const paidPlayers = Array.from(playerMap.keys()).filter(key => paidOutPlayers.has(key)).length
                  const pendingPlayers = totalPlayers - paidPlayers
                  
                  const totalAmount = Array.from(playerMap.values()).reduce((sum, player) => sum + player.total_amount, 0)
                  const paidAmount = Array.from(playerMap.entries())
                    .filter(([key]) => paidOutPlayers.has(key))
                    .reduce((sum, [, player]) => sum + player.total_amount, 0)
                  const pendingAmount = totalAmount - paidAmount
                  
                  return (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px'
                    }}>
                      <div style={{
                        padding: '12px',
                        backgroundColor: colors.backgrounds.success,
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.success }}>
                          {paidPlayers}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.success }}>Paid Players</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: colors.success }}>
                          {formatCurrency(paidAmount)}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '12px',
                        backgroundColor: colors.backgrounds.warning,
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.warning }}>
                          {pendingPlayers}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.warning }}>Pending Players</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: colors.warning }}>
                          {formatCurrency(pendingAmount)}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '12px',
                        backgroundColor: colors.backgrounds.info,
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.info }}>
                          {totalPlayers > 0 ? Math.round((paidPlayers / totalPlayers) * 100) : 0}%
                        </div>
                        <div style={{ fontSize: '12px', color: colors.info }}>Completion Rate</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: colors.info }}>
                          {paidPlayers}/{totalPlayers} players
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Winners & Payouts Table */}
            <div style={{
              backgroundColor: colors.surface,
              borderRadius: '8px',
              padding: '24px',
              boxShadow: colors.shadow.sm
            }}>
              <div style={{ 
                marginBottom: '24px'
              }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: colors.text.primary }}>
                  Winners & Payouts
                </h2>
                
                {/* View Mode Toggle - Hidden */}
                <div style={{
                  display: 'none',
                  backgroundColor: colors.gray[100],
                  borderRadius: '8px',
                  padding: '4px',
                  gap: '2px'
                }}>
                  <button
                    onClick={() => {/* disabled */}}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: colors.primary,
                      color: colors.text.white,
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                    }}
                  >
                    � Cards
                  </button>
                  <button
                    onClick={() => {/* disabled */}}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#374151',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                    }}
                  >
                    Compact Table
                  </button>
                </div>
              </div>

              {/* All Winners Display */}
              {payoutData.winners_by_bracket.length > 0 ? (
                <>
                  {/* Table-Style Cards Layout - Grouped by Player */}
                  <div style={{ overflowX: 'auto' }}>
                      <div style={{
                        display: 'table',
                        width: '100%',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden'
                      }}>
                        {/* Table Header */}
                        <div style={{
                          display: 'table-header-group',
                          backgroundColor: '#f8fafc'
                        }}>
                          <div style={{
                            display: 'table-row'
                          }}>
                            <div style={{
                              display: 'table-cell',
                              padding: '16px 12px',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e2e8f0',
                              fontSize: '14px'
                            }}>
                              Rank
                            </div>
                            <div 
                              style={{
                                display: 'table-cell',
                                padding: '16px 12px',
                                fontWeight: '600',
                                color: '#374151',
                                borderBottom: '2px solid #e2e8f0',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease'
                              }}
                              onClick={() => handleSort('name')}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              Player Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </div>
                            <div 
                              style={{
                                display: 'table-cell',
                                padding: '16px 12px',
                                fontWeight: '600',
                                color: '#374151',
                                borderBottom: '2px solid #e2e8f0',
                                fontSize: '14px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease'
                              }}
                              onClick={() => handleSort('brackets')}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              Brackets Won {sortBy === 'brackets' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </div>
                            <div 
                              style={{
                                display: 'table-cell',
                                padding: '16px 12px',
                                fontWeight: '600',
                                color: '#374151',
                                borderBottom: '2px solid #e2e8f0',
                                fontSize: '14px',
                                textAlign: 'right',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease'
                              }}
                              onClick={() => handleSort('amount')}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              Total Winnings {sortBy === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </div>
                            <div 
                              style={{
                                display: 'table-cell',
                                padding: '16px 12px',
                                fontWeight: '600',
                                color: '#374151',
                                borderBottom: '2px solid #e2e8f0',
                                fontSize: '14px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease'
                              }}
                              onClick={() => handleSort('status')}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              Payment Status {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </div>
                            <div style={{
                              display: 'table-cell',
                              padding: '16px 12px',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e2e8f0',
                              fontSize: '14px',
                              textAlign: 'center'
                            }}>
                              Actions
                            </div>
                          </div>
                        </div>

                        {/* Table Body */}
                        <div style={{ display: 'table-row-group' }}>
                          {renderPlayersTable()}
                        </div>
                      </div>
                    </div>
                
                {/* Total Summary Row */}
                <div style={{
                  marginTop: '16px',
                  padding: '16px 20px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #cbd5e1'
                }}>
                  <span style={{ fontWeight: '600', color: '#374151', fontSize: '16px' }}>
                    Total Payouts ({payoutData.winners_by_bracket.length} winners):
                  </span>
                  <span style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    color: '#059669' 
                  }}>
                    {formatCurrency(payoutData.winners_by_bracket.reduce((sum, winner) => sum + winner.payout_amount, 0))}
                  </span>
                </div>
              </>
            ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#6b7280'
                }}>
                  <p>No payout data available. Complete bracket matches to generate payouts.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Entry Analysis Results */}
        {activeTab === 'entries' && entryData && (
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '16px' }}>
              Entry Analysis - {entryData.tournament_info.name}
            </h2>

            {/* Summary Stats */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>
                  {entryData.summary.total_players}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Players</div>
              </div>

              <div style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>
                  {entryData.summary.total_scratch_entries + entryData.summary.total_handicap_entries}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Entries</div>
              </div>

              <div style={{
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d97706' }}>
                  {formatCurrency(entryData.summary.total_amount_distributed)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Distributed</div>
              </div>

              <div style={{
                backgroundColor: '#fce7f3',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#be185d' }}>
                  {formatCurrency(entryData.summary.average_per_player)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Avg per Player</div>
              </div>
            </div>

            {/* Entries Table */}
            <div style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(240, 165, 0, 0.12)',
              overflow: 'hidden'
            }}>
              <div style={{
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  backgroundColor: '#ffffff'
                }} aria-label="Player Entries">
                  <thead>
                    <tr style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      <th style={{ 
                        cursor: 'pointer',
                        padding: '18px 12px',
                        textAlign: 'left',
                        verticalAlign: 'middle',
                        fontWeight: '700',
                        color: '#374151',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e5e7eb',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'transparent'
                      }}>Player Name</th>
                      <th style={{ 
                        cursor: 'pointer',
                        padding: '18px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontWeight: '700',
                        color: '#374151',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e5e7eb',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'transparent'
                      }}>Scratch<br/>Entered</th>
                      <th style={{ 
                        cursor: 'pointer',
                        padding: '18px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontWeight: '700',
                        color: '#374151',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e5e7eb',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'transparent'
                      }}>Handicap<br/>Entered</th>
                      <th style={{ 
                        cursor: 'pointer',
                        padding: '18px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontWeight: '700',
                        color: '#374151',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e5e7eb',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'transparent'
                      }}>Total<br/>Entered</th>
                      <th style={{ 
                        cursor: 'pointer',
                        padding: '18px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontWeight: '700',
                        color: '#374151',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e5e7eb',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'transparent'
                      }}>Brackets<br/>Won</th>
                      <th style={{ 
                        cursor: 'pointer',
                        padding: '18px 12px',
                        textAlign: 'right',
                        verticalAlign: 'middle',
                        fontWeight: '700',
                        color: '#374151',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e5e7eb',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'transparent'
                      }}>Total Amount<br/>Won</th>
                      <th style={{ 
                        cursor: 'pointer',
                        padding: '18px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontWeight: '700',
                        color: '#374151',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e5e7eb',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: 'transparent'
                      }}>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryData.entries.map((entry, index) => {
                      const winRate = entry.total_brackets_entered > 0 
                        ? (entry.total_brackets_won / entry.total_brackets_entered * 100).toFixed(1)
                        : '0.0'
                      
                      return (
                        <tr key={entry.id} style={{
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                          borderRadius: '8px',
                          margin: '2px 0'
                        }} 
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f0f9ff';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}>
                          <td style={{ 
                            padding: '16px 12px',
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            fontWeight: '500',
                            color: '#111827',
                            fontSize: '14px'
                          }}>
                            {entry.name}
                          </td>
                          <td style={{ 
                            padding: '16px 12px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            fontWeight: '500',
                            color: '#111827',
                            fontSize: '14px'
                          }}>
                            {entry.scratch_brackets_entered}
                          </td>
                          <td style={{ 
                            padding: '16px 12px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            fontWeight: '500',
                            color: '#111827',
                            fontSize: '14px'
                          }}>
                            {entry.handicap_brackets_entered}
                          </td>
                          <td style={{ 
                            padding: '16px 12px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            fontWeight: '500',
                            color: '#111827',
                            fontSize: '14px'
                          }}>
                            {entry.total_brackets_entered}
                          </td>
                          <td style={{ 
                            padding: '16px 12px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            fontWeight: '600',
                            color: entry.total_brackets_won > 0 ? '#059669' : '#6b7280',
                            fontSize: '14px'
                          }}>
                            {entry.total_brackets_won}
                          </td>
                          <td style={{ 
                            padding: '16px 12px',
                            textAlign: 'right',
                            verticalAlign: 'middle',
                            fontWeight: '600',
                            color: entry.total_amount_won > 0 ? '#059669' : '#6b7280',
                            fontSize: '14px'
                          }}>
                            {formatCurrency(entry.total_amount_won)}
                          </td>
                          <td style={{ 
                            padding: '16px 12px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            fontWeight: '500',
                            color: parseFloat(winRate) > 50 ? '#059669' : 
                                   parseFloat(winRate) > 25 ? '#f59e0b' : 
                                   '#6b7280',
                            fontSize: '14px'
                          }}>
                            {winRate}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {entryData.entries.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#64748b'
              }}>
                <div>No entry data available for this tournament</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}

function BracketPayoutTable({ bracket, formatCurrency }: { bracket: BracketPayout, formatCurrency: (amount: number) => string }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{ 
        fontSize: '1.1rem', 
        fontWeight: '600', 
        marginBottom: '12px',
        color: '#374151'
      }}>
        {bracket.bracket_name} - Prize Pool: {formatCurrency(bracket.prize_pool)}
      </h4>
      
      <div style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(240, 165, 0, 0.12)',
        overflow: 'hidden'
      }}>
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            backgroundColor: '#ffffff'
          }} aria-label="Bracket Payouts">
            <thead>
              <tr style={{
                backgroundColor: '#f8fafc',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <th style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'transparent'
                }}>Place</th>
                <th style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'transparent'
                }}>Player</th>
                <th style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'right',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'transparent'
                }}>Score</th>
                <th style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'right',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'transparent'
                }}>%</th>
                <th style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'right',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'transparent'
                }}>Payout</th>
              </tr>
            </thead>
            <tbody>
              {bracket.winners.map((winner, index) => (
                <tr key={index} style={{
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                  borderRadius: '8px',
                  margin: '2px 0'
                }} 
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: winner.place === 1 ? '700' : '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>
                    {winner.position}
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>
                    {winner.player_name}
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>
                    {winner.score || '-'}
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>
                    {winner.payout_percentage}%
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                    fontWeight: '600',
                    color: '#059669',
                    fontSize: '14px'
                  }}>
                    {formatCurrency(winner.payout_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}