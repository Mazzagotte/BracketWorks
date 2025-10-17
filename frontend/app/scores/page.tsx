
'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { API } from '../lib/api'
import { usePageHeader } from '../lib/header-context'
import EnhancedButton from '../components/EnhancedButton'
import { MobileLayout } from '../../components/MobileLayout'
import { 
  PageContainer, 
  ContentWrapper, 
  Card, 
  Grid, 
  StatCard,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell
} from '../components/UI'
import { typography, colors, spacing, stylePresets } from '../lib/design-system'
import { Spinner, LoadingButton, LoadingState } from '../components/LoadingComponents'
import { useToast } from '../components/Toast'
import { ErrorMessage } from '../components/ErrorHandling'
import { usePagination, Pagination } from '../components/Performance'
import { AccessibleInput } from '../components/Accessibility'
import { useAutoSave } from '../components/DataManagement'

type Player = {
  id: number
  firstName: string
  lastName: string
  handicap: number
  average: number
  lane?: number | null
  scores?: {
    game1_scratch?: number
    game1_total?: number
    game2_scratch?: number
    game2_total?: number
    game3_scratch?: number
    game3_total?: number
  }
}

export default function ScoresPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [selectedSquad, setSelectedSquad] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState<{[key: string]: 'saving' | 'saved' | 'error'}>({})
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSaves, setPendingSaves] = useState<any[]>([])
  const [isMobile, setIsMobile] = useState(false)

  // Enhanced UX hooks
  const { addToast } = useToast()
  
  // Pagination for large player lists
  const paginationHook = usePagination({
    items: players,
    itemsPerPage: 20
  })

  // Auto-save for score data
  const { saving: autoSaving, saveNow } = useAutoSave({
    data: { scores: players.map(p => p.scores).filter(Boolean) },
    saveFunction: async (data) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('scores-backup', JSON.stringify(data))
      }
    },
    delay: 2000
  })

  const processPendingSaves = async () => {
    const saves = [...pendingSaves]
    setPendingSaves([])
    
    for (const saveData of saves) {
      try {
        const response = await fetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${saveData.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(saveData.data)
        })
        
        if (!response.ok) {
          // Re-queue failed saves
          setPendingSaves(prev => [...prev, saveData])
        }
      } catch (error) {
        // Re-queue failed saves
        setPendingSaves(prev => [...prev, saveData])
      }
    }
    
    if (pendingSaves.length === 0) {
      addToast({
        message: '✅ All offline scores have been synchronized!',
        type: 'success',
        duration: 3000
      })
    }
  }

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Process pending saves when back online
      if (pendingSaves.length > 0) {
        processPendingSaves()
      }
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      addToast({
        message: '📡 You are offline. Scores will be saved when connection is restored.',
        type: 'warning',
        duration: 5000
      })
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Check initial status
    setIsOnline(navigator.onLine)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [pendingSaves, addToast, processPendingSaves])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Header configuration
  const headerActions = useMemo(() => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <EnhancedButton
        onClick={() => {
          addToast({ message: 'Refreshing scores data...', type: 'info', duration: 2000 })
          window.location.reload()
        }}
        variant="secondary"
        size="sm"
      >
        🔄 Refresh Data
      </EnhancedButton>
      
      {pendingSaves.length > 0 && (
        <EnhancedButton
          onClick={async () => {
            await processPendingSaves()
            addToast({ 
              message: 'Sync completed!', 
              type: 'success', 
              duration: 3000 
            })
          }}
          variant="primary"
          size="sm"
        >
          📡 Sync Offline Scores ({pendingSaves.length})
        </EnhancedButton>
      )}
    </div>
  ), [pendingSaves.length, addToast, processPendingSaves])

  usePageHeader({
    title: 'Scores',
    subtitle: tournament && selectedSquad 
      ? `${tournament.name} • ${selectedSquad.name} • ${players.length} players`
      : tournament 
        ? `${tournament.name} • ${players.length} players`
        : `${players.length} players`,
    actions: headerActions
  })

  // Fetch tournament, squad, and players data
  useEffect(() => {
    const lastTournamentId = localStorage.getItem('lastTournamentId')
    const token = localStorage.getItem('token')
    const userId = localStorage.getItem('user_id')
    
    if (lastTournamentId && token) {
      setIsLoading(true)
      
      // Fetch tournament info
      fetch(API(`/api/v1/tournaments/${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setTournament(data)
      })

      // Fetch selected squad from backend
      if (userId) {
        fetch(API(`/api/v1/squads/selected/?user_id=${userId}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.squad_id) {
            // Find squad details
            fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
              headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(squadsData => {
              const squad = squadsData.find((s: any) => s.id === data.squad_id)
              setSelectedSquad(squad || null)
              
              // Fetch players for this squad
              if (squad) {
                fetchPlayersWithScores(lastTournamentId, squad.id, token)
              }
            })
          } else {
            // No squad selected, fetch all players for tournament
            fetchPlayersWithScores(lastTournamentId, null, token)
          }
        })
      }
    }
  }, [])

  const fetchPlayersWithScores = async (tournamentId: string, squadId: number | null, token: string) => {
    try {
      const bowlersUrl = squadId 
        ? `/api/v1/bowlers/?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/bowlers/?tournament_id=${tournamentId}`
      
      const response = await fetch(API(bowlersUrl), {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const data = response.ok ? await response.json() : []
      
      // Fetch existing scores from database
      const scoresUrl = squadId 
        ? `/api/v1/scores/?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/scores/?tournament_id=${tournamentId}`
      
      const scoresResponse = await fetch(API(scoresUrl), {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const scoresData = scoresResponse.ok ? await scoresResponse.json() : []
      
      // Create a lookup map for scores by bowler_id
      const scoresMap = new Map()
      scoresData.forEach((score: any) => {
        scoresMap.set(score.bowler_id, {
          game1_scratch: score.game1_scratch,
          game1_total: score.game1_total,
          game2_scratch: score.game2_scratch,
          game2_total: score.game2_total,
          game3_scratch: score.game3_scratch,
          game3_total: score.game3_total
        })
      })
      
      // Transform bowlers data to match our player structure
      const transformedData = (data || []).map((bowler: any) => {
        const nameParts = bowler.name.split(' ')
        const existingScores = scoresMap.get(bowler.id) || {
          game1_scratch: undefined,
          game1_total: undefined,
          game2_scratch: undefined,
          game2_total: undefined,
          game3_scratch: undefined,
          game3_total: undefined
        }
        
        return {
          id: bowler.id,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          handicap: bowler.handicap || 0,
          average: bowler.average || 0,
          lane: bowler.lane || null,
          scores: existingScores
        }
      })
      
      // Sort players by lane (players with lanes first, sorted numerically, then players without lanes)
      const sortedData = transformedData.sort((a: Player, b: Player) => {
        // If both have lanes, sort numerically
        if (a.lane && b.lane) {
          return parseInt(a.lane.toString()) - parseInt(b.lane.toString())
        }
        // If only a has a lane, a comes first
        if (a.lane && !b.lane) {
          return -1
        }
        // If only b has a lane, b comes first
        if (!a.lane && b.lane) {
          return 1
        }
        // If neither has a lane, maintain original order (sort by name as fallback)
        return a.lastName.localeCompare(b.lastName)
      })
      
      setPlayers(sortedData)
    } catch (err) {
      console.error('Error fetching players:', err)
      setPlayers([])
    } finally {
      setIsLoading(false)
    }
  }

  const calculateHandicap = (average: number) => {
    // Handicap = 80% of (200 - average)
    if (!average || average >= 200) return 0
    return Math.round((200 - average) * 0.8)
  }

  const validateScore = (score: number | undefined) => {
    if (score === undefined || score === null) return { isValid: true, message: '' }
    if (score < 0) return { isValid: false, message: 'Score cannot be negative' }
    if (score > 300) return { isValid: false, message: 'Score cannot exceed 300' }
    return { isValid: true, message: '' }
  }

  const getScoreInputStyle = (score: number | undefined, baseStyle: any) => {
    const validation = validateScore(score)
    if (!validation.isValid) {
      return {
        ...baseStyle,
        borderColor: '#ef4444',
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
        backgroundColor: '#fef2f2'
      }
    }
    if (score === 300) {
      return {
        ...baseStyle,
        borderColor: '#10b981',
        backgroundColor: '#f0fdf4',
        fontWeight: '700'
      }
    }
    return baseStyle
  }

  // Debounced save function
  const debouncedSaves = new Map<string, NodeJS.Timeout>()
  
  const updateScore = async (playerId: number, field: string, value: number | undefined) => {
    const saveKey = `${playerId}-${field}`
    
    // Validate score range
    if (value !== undefined && (value < 0 || value > 300)) {
      addToast({
        message: `Invalid score: ${value}. Scores must be between 0 and 300.`,
        type: 'error',
        duration: 4000
      })
      return
    }
    
    // Update local state first for immediate UI feedback
    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        const updatedPlayer = {
          ...player,
          scores: {
            ...player.scores,
            [field]: value
          }
        }
        
        // Auto-calculate totals when scratch scores are entered
        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = calculateHandicap(player.average)
          const totalScore = scratchScore + handicap
          updatedPlayer.scores![`game${gameNum}_total` as keyof typeof updatedPlayer.scores] = totalScore
        }
        
        return updatedPlayer
      }
      return player
    }))

    // Clear existing timeout for this field
    const existingTimeout = debouncedSaves.get(saveKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    // Set saving status
    setSavingStatus(prev => ({ ...prev, [saveKey]: 'saving' }))
    
    // Debounced save to backend (500ms delay)
    const timeoutId = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token')
        const tournamentId = localStorage.getItem('lastTournamentId')
        
        if (!token || !tournamentId || !selectedSquad) {
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }))
          return
        }

        const player = players.find(p => p.id === playerId)
        if (!player) {
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }))
          return
        }

        // Calculate the updated scores for API call
        const updatedScores = { ...player.scores, [field]: value }
        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = calculateHandicap(player.average)
          const totalScore = scratchScore + handicap
          updatedScores[`game${gameNum}_total` as keyof typeof updatedScores] = totalScore
        }

        const scoreData = {
          bowler_id: playerId,
          tournament_id: parseInt(tournamentId),
          squad_id: selectedSquad.id,
          game1_scratch: updatedScores.game1_scratch,
          game1_total: updatedScores.game1_total,
          game2_scratch: updatedScores.game2_scratch,
          game2_total: updatedScores.game2_total,
          game3_scratch: updatedScores.game3_scratch,
          game3_total: updatedScores.game3_total
        }

        // Handle offline saves
        if (!isOnline) {
          setPendingSaves(prev => [...prev, { token, data: scoreData }])
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'saved' }))
          // Store in localStorage as backup
          localStorage.setItem(`pending_save_${Date.now()}`, JSON.stringify({ token, data: scoreData }))
          return
        }

        const response = await fetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(scoreData)
        })
        
        if (response.ok) {
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'saved' }))
          
          // Show success toast for perfect games
          if (value === 300) {
            addToast({
              message: `🎳 Perfect game! 300 scored by ${player.firstName} ${player.lastName}`,
              type: 'success',
              duration: 5000
            })
          } else if (value && value >= 250) {
            // Show toast for high scores
            addToast({
              message: `� Excellent score: ${value} by ${player.firstName} ${player.lastName}`,
              type: 'success',
              duration: 3000
            })
          }
        } else {
          throw new Error(`Save failed: ${response.status}`)
        }
        
        // Clear save status after 2 seconds
        setTimeout(() => {
          setSavingStatus(prev => {
            const updated = { ...prev }
            delete updated[saveKey]
            return updated
          })
        }, 2000)
        
      } catch (error) {
        console.error('Failed to save score:', error)
        setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }))
        
        // Show error toast
        const currentPlayer = players.find(p => p.id === playerId);
        addToast({
          message: `Failed to save score for ${currentPlayer?.firstName || 'player'} ${currentPlayer?.lastName || ''}. Please try again.`,
          type: 'error',
          duration: 5000
        })
        
        // Clear error status after 3 seconds
        setTimeout(() => {
          setSavingStatus(prev => {
            const updated = { ...prev }
            delete updated[saveKey]
            return updated
          })
        }, 3000)
      }
      
      debouncedSaves.delete(saveKey)
    }, 500)
    
    debouncedSaves.set(saveKey, timeoutId)
  }

  const calculateTotalScratch = (player: Player) => {
    const scores = player.scores || {}
    return (scores.game1_scratch || 0) + (scores.game2_scratch || 0) + (scores.game3_scratch || 0)
  }

  const calculateTotalWithHandicap = (player: Player) => {
    const scores = player.scores || {}
    return (scores.game1_total || 0) + (scores.game2_total || 0) + (scores.game3_total || 0)
  }

  const getGameTotal = (gameTotal: number | undefined, scratchScore: number | undefined) => {
    // Only show total if there's an actual scratch score entered
    if (scratchScore === undefined || scratchScore === null) {
      return '—'
    }
    return gameTotal || '—'
  }

  const calculateDisplayTotal = (player: Player) => {
    const scores = player.scores || {}
    // Only calculate total if at least one scratch score is entered
    const hasScratches = scores.game1_scratch !== undefined && scores.game1_scratch !== null ||
                         scores.game2_scratch !== undefined && scores.game2_scratch !== null ||
                         scores.game3_scratch !== undefined && scores.game3_scratch !== null
    
    if (!hasScratches) {
      return '—'
    }
    
    // Calculate total from individual game totals that have scratch scores
    let total = 0
    if (scores.game1_scratch !== undefined && scores.game1_scratch !== null) {
      total += scores.game1_total || 0
    }
    if (scores.game2_scratch !== undefined && scores.game2_scratch !== null) {
      total += scores.game2_total || 0
    }
    if (scores.game3_scratch !== undefined && scores.game3_scratch !== null) {
      total += scores.game3_total || 0
    }
    
    return total || '—'
  }

  // Keyboard navigation helper
  const handleKeyDown = (e: React.KeyboardEvent, playerId: number, field: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Move to next input field
      const currentPlayerIndex = players.findIndex(p => p.id === playerId)
      const fields = ['game1_scratch', 'game2_scratch', 'game3_scratch']
      const currentFieldIndex = fields.indexOf(field)
      
      if (e.key === 'Enter') {
        e.preventDefault()
        let nextField: string | null = null
        let nextPlayerId: number | null = null
        
        if (currentFieldIndex < fields.length - 1) {
          // Move to next field for same player
          nextField = fields[currentFieldIndex + 1]
          nextPlayerId = playerId
        } else if (currentPlayerIndex < players.length - 1) {
          // Move to first field of next player
          nextField = fields[0]
          nextPlayerId = players[currentPlayerIndex + 1].id
        }
        
        if (nextField && nextPlayerId) {
          const nextInput = document.querySelector(`input[data-player="${nextPlayerId}"][data-field="${nextField}"]`) as HTMLInputElement
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }
      }
    }
  }

  return (
    <>
      {isMobile ? (
        <MobileLayout
          title="Scores"
          subtitle="Enter and manage bowling scores"
          showBackButton={true}
          onBack={() => window.history.back()}
          headerActions={
            <div className="flex gap-2">
              <button
                onClick={() => {
                  addToast({ message: 'Refreshing scores data...', type: 'info', duration: 2000 })
                  window.location.reload()
                }}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md"
              >
                🔄
              </button>
              <button
                onClick={() => {
                  addToast({ message: 'Export functionality coming soon', type: 'info', duration: 3000 })
                }}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-md"
              >
                📊
              </button>
            </div>
          }
        >
          {/* Mobile content will go here */}
          <div className="space-y-4">
            {/* Tournament and Squad selector for mobile */}
            {tournament && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  📅 {tournament.name}
                </h3>
                {selectedSquad && (
                  <p className="text-sm text-gray-600">
                    Squad: {selectedSquad.date} — {selectedSquad.time}
                  </p>
                )}
              </div>
            )}
            
            {/* Loading state for mobile */}
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            )}
            
            {/* Players list for mobile - simplified card view */}
            {!isLoading && players.length > 0 && (
              <div className="space-y-3">
                {paginationHook.paginatedItems.map((player: Player) => (
                  <div key={player.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {player.firstName} {player.lastName}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Lane {player.lane} • Avg: {player.average} • HDCP: {player.handicap}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-blue-600">
                          Total: {calculateTotalWithHandicap(player)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Scratch: {calculateTotalScratch(player)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Score input grid for mobile */}
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((gameNum) => (
                        <div key={gameNum} className="text-center">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Game {gameNum}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="300"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={player.scores?.[`game${gameNum}_scratch` as keyof typeof player.scores] || ''}
                            onChange={(e) => updateScore(player.id, `game${gameNum}_scratch`, parseInt(e.target.value) || 0)}
                            placeholder={`G${gameNum}`}
                            inputMode="numeric"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            +{player.handicap} = {(player.scores?.[`game${gameNum}_scratch` as keyof typeof player.scores] || 0) + player.handicap}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Save status indicator */}
                    {savingStatus[player.id] && (
                      <div className="mt-2 text-center">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded ${
                          savingStatus[player.id] === 'saving' ? 'bg-yellow-100 text-yellow-800' :
                          savingStatus[player.id] === 'saved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {savingStatus[player.id] === 'saving' && '💾 Saving...'}
                          {savingStatus[player.id] === 'saved' && '✅ Saved'}
                          {savingStatus[player.id] === 'error' && '❌ Error'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Mobile pagination */}
            {!isLoading && players.length > 20 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  currentPage={paginationHook.currentPage}
                  totalPages={paginationHook.totalPages}
                  onPageChange={paginationHook.goToPage}
                />
              </div>
            )}
          </div>
        </MobileLayout>
      ) : (
        // Desktop Layout
    <main className="page-main">
      
      <div className="page-content">
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
          {/* Save Status Notification */}
          {saveMessage && (
            <div className={`notification notification-${saveMessage.type}`}>
              {saveMessage.message}
            </div>
          )}
          
          {/* Offline Indicator */}
          {!isOnline && (
            <div className="notification notification-warning">
              <div className="offline-indicator">
                <span>📡</span>
                <span>You are offline. Scores are being saved locally and will sync when connection is restored.</span>
                {pendingSaves.length > 0 && (
                  <span className="pending-count">
                    {pendingSaves.length} pending
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center text-secondary" style={{ padding: '3rem' }}>
              Loading players and scores...
            </div>
          )}

          {/* No Players State */}
          {!isLoading && players.length === 0 && (
            <div className="text-center text-secondary" style={{ padding: '3rem' }}>
              No players found. <Link href="/players">Add some players first</Link>
            </div>
          )}

          {/* Mobile Scroll Hint */}
          {!isLoading && players.length > 0 && (
            <div className="mobile-scroll-hint">
              👈 Scroll horizontally to see all score columns
            </div>
          )}

          {/* Scores Table */}
          {!isLoading && players.length > 0 && (
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
                }} aria-label="Player Scores">

            <thead>
              {selectedSquad && (
                <tr>
                  <td colSpan={10} style={{ 
                    backgroundColor: 'rgba(79, 140, 255, 0.1)', 
                    color: '#4f8cff',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    padding: '12px'
                  }}>
                    📅 Showing scores for: {selectedSquad.date} — {selectedSquad.time}
                  </td>
                </tr>
              )}
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
                }}>First Name</th>
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
                }}>Last Name</th>
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
                }}>Lane</th>
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
                }}>Avg</th>
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
                }}>Game 1 Scratch</th>
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
                }}>Game 1 Total</th>
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
                }}>Game 2 Scratch</th>
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
                }}>Game 2 Total</th>
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
                }}>Game 3 Scratch</th>
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
                }}>Game 3 Total</th>
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
                }}>Total Scratch</th>
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
                }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {paginationHook.paginatedItems.map((player: Player, index: number) => (
                <tr key={player.id} style={{
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
                    fontWeight: '600',
                    color: '#111827',
                    fontSize: '14px'
                  }}>{player.firstName}</td>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: '600',
                    color: '#111827',
                    fontSize: '14px'
                  }}>{player.lastName}</td>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    color: player.lane ? '#111827' : '#9ca3af',
                    fontSize: '14px'
                  }}>{player.lane || '—'}</td>
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    color: '#6b7280',
                    fontSize: '14px'
                  }}>{player.average}</td>
                  
                  {/* Game 1 Scratch */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
                        data-player={player.id}
                        data-field="game1_scratch"
                        value={player.scores?.game1_scratch ?? ''}
                        onChange={e => updateScore(player.id, 'game1_scratch', e.target.value ? Number(e.target.value) : undefined)}
                        onKeyDown={e => handleKeyDown(e, player.id, 'game1_scratch')}
                        style={getScoreInputStyle(player.scores?.game1_scratch, { 
                          width: '60px', 
                          padding: '8px 12px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: '500',
                          background: '#ffffff',
                          color: '#111827',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        })}
                        onFocus={(e) => {
                          const validation = validateScore(player.scores?.game1_scratch)
                          if (validation.isValid) {
                            e.target.style.borderColor = '#3b82f6'
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                          }
                          e.target.select()
                        }}
                        onBlur={(e) => {
                          const validation = validateScore(player.scores?.game1_scratch)
                          if (validation.isValid) {
                            e.target.style.borderColor = '#d1d5db'
                            e.target.style.boxShadow = 'none'
                          }
                        }}
                        title={!validateScore(player.scores?.game1_scratch).isValid ? validateScore(player.scores?.game1_scratch).message : ''}
                      />
                      
                      {/* Save Status Indicator */}
                      {savingStatus[`${player.id}-game1_scratch`] && (
                        <div style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          ...(savingStatus[`${player.id}-game1_scratch`] === 'saving' && {
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            animation: 'pulse 1s infinite'
                          }),
                          ...(savingStatus[`${player.id}-game1_scratch`] === 'saved' && {
                            backgroundColor: '#10b981',
                            color: 'white'
                          }),
                          ...(savingStatus[`${player.id}-game1_scratch`] === 'error' && {
                            backgroundColor: '#ef4444',
                            color: 'white'
                          })
                        }}>
                          {savingStatus[`${player.id}-game1_scratch`] === 'saving' && '⋯'}
                          {savingStatus[`${player.id}-game1_scratch`] === 'saved' && '✓'}
                          {savingStatus[`${player.id}-game1_scratch`] === 'error' && '✗'}
                        </div>
                      )}
                    </div>
                    {player.scores?.game1_scratch === 300 && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '-8px', 
                        right: '8px', 
                        background: '#10b981', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '20px', 
                        height: '20px', 
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        ✓
                      </div>
                    )}
                  </td>
                  
                  {/* Game 1 Total */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '600',
                    color: '#3b82f6',
                    fontSize: '14px'
                  }}>
                    {getGameTotal(player.scores?.game1_total, player.scores?.game1_scratch)}
                  </td>
                  
                  {/* Game 2 Scratch */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      placeholder="—"
                      value={player.scores?.game2_scratch ?? ''}
                      onChange={e => updateScore(player.id, 'game2_scratch', e.target.value ? Number(e.target.value) : undefined)}
                      style={getScoreInputStyle(player.scores?.game2_scratch, { 
                        width: '60px', 
                        padding: '8px 12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: '#ffffff',
                        color: '#111827',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      })}
                      onFocus={(e) => {
                        const validation = validateScore(player.scores?.game2_scratch)
                        if (validation.isValid) {
                          e.target.style.borderColor = '#3b82f6'
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                        }
                      }}
                      onBlur={(e) => {
                        const validation = validateScore(player.scores?.game2_scratch)
                        if (validation.isValid) {
                          e.target.style.borderColor = '#d1d5db'
                          e.target.style.boxShadow = 'none'
                        }
                      }}
                      title={!validateScore(player.scores?.game2_scratch).isValid ? validateScore(player.scores?.game2_scratch).message : ''}
                    />
                    {savingStatus[`${player.id}-game2_scratch`] && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        zIndex: 10,
                        transition: 'all 0.2s ease',
                        ...(savingStatus[`${player.id}-game2_scratch`] === 'saving' && {
                          background: '#f59e0b',
                          color: 'white',
                          animation: 'pulse 1s ease-in-out infinite'
                        }),
                        ...(savingStatus[`${player.id}-game2_scratch`] === 'saved' && {
                          background: '#10b981',
                          color: 'white'
                        }),
                        ...(savingStatus[`${player.id}-game2_scratch`] === 'error' && {
                          background: '#ef4444',
                          color: 'white'
                        })
                      }}>
                        {savingStatus[`${player.id}-game2_scratch`] === 'saving' && '⋯'}
                        {savingStatus[`${player.id}-game2_scratch`] === 'saved' && '✓'}
                        {savingStatus[`${player.id}-game2_scratch`] === 'error' && '✗'}
                      </div>
                    )}
                    {player.scores?.game2_scratch === 300 && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '-8px', 
                        right: '8px', 
                        background: '#10b981', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '20px', 
                        height: '20px', 
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        ✓
                      </div>
                    )}
                  </td>
                  
                  {/* Game 2 Total */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '600',
                    color: '#3b82f6',
                    fontSize: '14px'
                  }}>
                    {getGameTotal(player.scores?.game2_total, player.scores?.game2_scratch)}
                  </td>
                  
                  {/* Game 3 Scratch */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      placeholder="—"
                      value={player.scores?.game3_scratch ?? ''}
                      onChange={e => updateScore(player.id, 'game3_scratch', e.target.value ? Number(e.target.value) : undefined)}
                      style={getScoreInputStyle(player.scores?.game3_scratch, { 
                        width: '60px', 
                        padding: '8px 12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: '#ffffff',
                        color: '#111827',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      })}
                      onFocus={(e) => {
                        const validation = validateScore(player.scores?.game3_scratch)
                        if (validation.isValid) {
                          e.target.style.borderColor = '#3b82f6'
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                        }
                      }}
                      onBlur={(e) => {
                        const validation = validateScore(player.scores?.game3_scratch)
                        if (validation.isValid) {
                          e.target.style.borderColor = '#d1d5db'
                          e.target.style.boxShadow = 'none'
                        }
                      }}
                      title={!validateScore(player.scores?.game3_scratch).isValid ? validateScore(player.scores?.game3_scratch).message : ''}
                    />
                    {savingStatus[`${player.id}-game3_scratch`] && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        zIndex: 10,
                        transition: 'all 0.2s ease',
                        ...(savingStatus[`${player.id}-game3_scratch`] === 'saving' && {
                          background: '#f59e0b',
                          color: 'white',
                          animation: 'pulse 1s ease-in-out infinite'
                        }),
                        ...(savingStatus[`${player.id}-game3_scratch`] === 'saved' && {
                          background: '#10b981',
                          color: 'white'
                        }),
                        ...(savingStatus[`${player.id}-game3_scratch`] === 'error' && {
                          background: '#ef4444',
                          color: 'white'
                        })
                      }}>
                        {savingStatus[`${player.id}-game3_scratch`] === 'saving' && '⋯'}
                        {savingStatus[`${player.id}-game3_scratch`] === 'saved' && '✓'}
                        {savingStatus[`${player.id}-game3_scratch`] === 'error' && '✗'}
                      </div>
                    )}
                    {player.scores?.game3_scratch === 300 && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '-8px', 
                        right: '8px', 
                        background: '#10b981', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '20px', 
                        height: '20px', 
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        ✓
                      </div>
                    )}
                  </td>
                  
                  {/* Game 3 Total */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '600',
                    color: '#3b82f6',
                    fontSize: '14px'
                  }}>
                    {getGameTotal(player.scores?.game3_total, player.scores?.game3_scratch)}
                  </td>
                  
                  {/* Total Scratch */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '700',
                    color: '#374151',
                    fontSize: '15px'
                  }}>
                    {calculateTotalScratch(player) || '—'}
                  </td>
                  
                  {/* Total */}
                  <td style={{ 
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '700',
                    color: '#1f2937',
                    fontSize: '16px',
                    borderTopRightRadius: '12px',
                    borderBottomRightRadius: '12px'
                  }}>
                    {calculateDisplayTotal(player)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        )}

        {/* Pagination Controls */}
        {paginationHook.totalPages > 1 && (
          <div style={{ 
            marginTop: '2rem',
            marginBottom: '1rem',
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              <span>
                Showing {((paginationHook.currentPage - 1) * 20) + 1} to{' '}
                {Math.min(paginationHook.currentPage * 20, players.length)} of{' '}
                {players.length} players
              </span>
            </div>
            
            <Pagination
              currentPage={paginationHook.currentPage}
              totalPages={paginationHook.totalPages}
              onPageChange={paginationHook.goToPage}
              itemsPerPage={20}
              totalItems={players.length}
              showItemCount={false}
              showPageSize={false}
            />
          </div>
        )}
      
          {/* Instructions */}
          {!isLoading && players.length > 0 && (
            <div className="instructions">
              <strong>Instructions:</strong> Enter scratch scores for each game. Total scores (scratch + handicap) will be calculated automatically.
              The totals are highlighted in blue for easy identification.
            </div>
          )}
        </div>
      </div>
    </main>
      )}
    </>
  )
}
