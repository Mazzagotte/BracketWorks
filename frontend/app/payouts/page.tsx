'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer, ContentWrapper, Card } from '../components/UI'
import Header from '../components/Header'
import { useAuth } from '../lib/auth-context'
import { useToast } from '../components/Toast'
import { useTournaments, useSquads, Squad as HookSquad } from '../hooks/useTournaments'
import { Tournament } from '../lib/types'
import { usePayouts, Winner } from './hooks/usePayouts'
import { PayoutSummaryStats } from './components/PayoutSummaryStats'
import { EmptyPayoutState } from './components/EmptyPayoutState'
import { Tabs } from './components/Tabs'
import { logger } from '../lib/logger'
import { storage } from '../lib/storage'

type ViewMode = 'payouts' | 'entries'

export default function PayoutsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { addToast } = useToast()
  const { tournaments, fetchTournaments } = useTournaments()
  const { squads, fetchSquads } = useSquads()
  
  // State for selected entities
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<HookSquad | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('payouts')
  const [searchQuery, setSearchQuery] = useState('')

  // Use the custom hook for data fetching
  const {
    payoutData,
    entryData,
    loading,
    error,
    loadPayoutData,
    loadEntryData
  } = usePayouts(selectedTournament?.id ?? null, selectedSquad?.id ?? null)

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

  // Auto-select tournament from localStorage
  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedTournamentId = storage.getItem('lastTournamentId')
      if (storedTournamentId) {
        const storedTournament = tournaments.find(t => t.id === parseInt(storedTournamentId))
        if (storedTournament) {
          setSelectedTournament(storedTournament)
          fetchSquads(storedTournament.id)
        }
      } else {
        setSelectedTournament(tournaments[0])
        fetchSquads(tournaments[0].id)
      }
    }
  }, [tournaments, selectedTournament, fetchSquads])

  // Load data when tournament/squad changes
  useEffect(() => {
    if (selectedTournament) {
      loadPayoutData()
      loadEntryData()
    }
  }, [selectedTournament, selectedSquad, loadPayoutData, loadEntryData])

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  if (!user) return null

  // Filter payouts by search
  const filteredPayouts = payoutData?.winners_by_bracket.filter(winner =>
    winner.player_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []

  // Filter entries by search
  const filteredEntries = entryData?.entries.filter(entry =>
    entry.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value))
  }

  return (
    <PageContainer>
      <Header title="Payouts & Entries" />
      <ContentWrapper>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#1e293b'
          }}>
            Payouts & Entries
          </h1>
          <p style={{ color: '#64748b' }}>
            Manage tournament payouts and track player entries
          </p>
        </div>

        {/* Tournament/Squad Selection */}
        <div style={{ marginBottom: '24px' }}>
        <Card padding="16px">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#1e293b'
              }}>
                Tournament
              </label>
              <select
                value={selectedTournament?.id ?? ''}
                onChange={(e) => {
                  const tournament = tournaments.find(t => t.id === parseInt(e.target.value))
                  if (tournament) {
                    setSelectedTournament(tournament)
                    setSelectedSquad(null)
                    storage.setItem('lastTournamentId', tournament.id.toString())
                    fetchSquads(tournament.id)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px'
                }}
              >
                <option value="">Select Tournament</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#1e293b'
              }}>
                Squad (Optional)
              </label>
              <select
                value={selectedSquad?.id ?? ''}
                onChange={(e) => {
                  const squad = squads.find(s => s.id === parseInt(e.target.value))
                  setSelectedSquad(squad ?? null)
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px'
                }}
                disabled={!selectedTournament}
              >
                <option value="">All Squads</option>
                {squads.map(s => (
                  <option key={s.id} value={s.id}>Squad {s.id} - {s.date} {s.time}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
        </div>

        {/* Summary Stats */}
        <PayoutSummaryStats payoutData={payoutData} loading={loading} />

        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'payouts', label: 'Payouts', count: payoutData?.winners_by_bracket.length },
            { id: 'entries', label: 'All Entries', count: entryData?.entries.length }
          ]}
          activeTab={viewMode}
          onTabChange={(id) => setViewMode(id as ViewMode)}
        />

        {/* Search */}
        <div style={{ marginBottom: '24px' }}>
        <Card padding="16px">
          <input
            type="text"
            placeholder="Search by player name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px'
            }}
          />
        </Card>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '48px',
            color: '#64748b' 
          }}>
            Loading...
          </div>
        ) : error ? (
          <EmptyPayoutState
            title="Error Loading Data"
            message={error}
            icon="⚠️"
          />
        ) : viewMode === 'payouts' ? (
          filteredPayouts.length === 0 ? (
            <EmptyPayoutState
              title="No Payouts Found"
              message={searchQuery ? 'Try adjusting your search' : 'No winners have been calculated yet'}
              icon="💰"
            />
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {filteredPayouts.map((winner, index) => (
                <Card
                  key={`${winner.player_id}-${winner.bracket_type}-${winner.bracket_name}`}
                  padding="16px"
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: index < 3 ? '#fbbf24' : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}>
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ 
                            fontWeight: '600',
                            fontSize: '18px',
                            marginBottom: '4px'
                          }}>
                            {winner.player_name}
                          </div>
                          <div style={{ 
                            fontSize: '14px',
                            color: '#64748b'
                          }}>
                            {winner.bracket_type === 'scratch' ? '🎯 Scratch' : '⚖️ Handicap'} • {winner.bracket_name}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '12px',
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Position</div>
                          <div style={{ fontWeight: '500' }}>{winner.position}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Score</div>
                          <div style={{ fontWeight: '500' }}>{winner.score}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Payout %</div>
                          <div style={{ fontWeight: '500' }}>{winner.payout_percentage}%</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ 
                      textAlign: 'right',
                      paddingLeft: '16px',
                      borderLeft: '2px solid #10b981'
                    }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        Payout
                      </div>
                      <div style={{ 
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#10b981'
                      }}>
                        {formatCurrency(winner.payout_amount)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        of {formatCurrency(winner.prize_pool_total)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          filteredEntries.length === 0 ? (
            <EmptyPayoutState
              title="No Entries Found"
              message={searchQuery ? 'Try adjusting your search' : 'No player entries found'}
              icon="📋"
            />
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {filteredEntries.map((entry) => (
                <Card
                  key={entry.id}
                  padding="16px"
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <div>
                      <div style={{ 
                        fontWeight: '600',
                        fontSize: '18px',
                        marginBottom: '4px'
                      }}>
                        {entry.name}
                      </div>
                      <div style={{ 
                        fontSize: '14px',
                        color: '#64748b'
                      }}>
                        {entry.scratch_brackets_entered > 0 && `🎯 ${entry.scratch_brackets_entered} Scratch`}
                        {entry.scratch_brackets_entered > 0 && entry.handicap_brackets_entered > 0 && ' • '}
                        {entry.handicap_brackets_entered > 0 && `⚖️ ${entry.handicap_brackets_entered} Handicap`}
                      </div>
                    </div>
                    {entry.total_amount_won > 0 && (
                      <div style={{ 
                        textAlign: 'right',
                        paddingLeft: '16px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                          Total Winnings
                        </div>
                        <div style={{ 
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#10b981'
                        }}>
                          {formatCurrency(entry.total_amount_won)}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </ContentWrapper>
    </PageContainer>
  )
}


