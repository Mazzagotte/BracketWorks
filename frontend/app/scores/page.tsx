'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Tournament, Squad, Player, BracketData, ScoreData, WinnerData, BracketSettings, ToastMessage, PendingScoreSave } from '../lib/types'
import { SortConfig, SortableScoreColumn } from './types'
import { SortableHeader } from './components/SortableHeader'

import Link from 'next/link'

import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { API } from '../lib/api'
import { usePageHeader } from '../lib/header-context'
import EnhancedButton from '../components/EnhancedButton'
import { MobileLayout } from '../../components/MobileLayout'
import { typography, colors, spacing, stylePresets } from '../lib/design-system'
import { Spinner, LoadingButton, LoadingState } from '../components/LoadingComponents'
import { useToast } from '../components/Toast'
import { ErrorMessage } from '../components/ErrorHandling'
import { usePagination, Pagination } from '../components/Performance'
import { AccessibleInput } from '../components/Accessibility'
import { useAutoSave } from '../components/DataManagement'
import { logger } from '../lib/logger';
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



export default function ScoresPage() {
  // Authentication check - must be at the top
  const { isAuthenticated, isInitialized } = useAuth();

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuth = typeof window !== 'undefined' && 
    localStorage.getItem('token') && 
    localStorage.getItem('user_id');

  // Wait for auth initialization before making decisions
  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div>Loading score management...</div>
        </div>
      </div>
    );
  }

  // Authentication guard - redirect if not logged in (only after initialization)
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
          <div>Please log in to access score management</div>
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
          <div>Loading score management...</div>
        </div>
      </div>
    );
  }

  const [players, setPlayers] = useState<Player[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState<{[key: string]: 'saving' | 'saved' | 'error'}>({})
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSaves, setPendingSaves] = useState<PendingScoreSave[]>([])
  const [isMobile, setIsMobile] = useState(false)
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: null,
    direction: null
  })

  // Enhanced UX hooks
  const { addToast } = useToast()
  
  // Hide number input spinners for cleaner look
  useEffect(() => {
    if (!document.querySelector('#scores-spinner-styles')) {
      const style = document.createElement('style');
      style.id = 'scores-spinner-styles';
      style.textContent = `
        @keyframes sortChange {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        /* Hide number input spinners for cleaner look */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Sorting functionality
  const handleSort = useCallback((column: SortableScoreColumn) => {
    setSortConfig(currentSort => {
      if (currentSort.column === column) {
        // Toggle direction: asc -> desc -> null (remove sort)
        const newDirection = 
          currentSort.direction === 'asc' ? 'desc' :
          currentSort.direction === 'desc' ? null : 'asc';
        return {
          column: newDirection ? column : null,
          direction: newDirection
        };
      } else {
        // New column, start with ascending
        return {
          column,
          direction: 'asc'
        };
      }
    });
  }, []);

  // Sort players based on current sort configuration
  const sortedPlayers = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return players;
    }

    return [...players].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle different column types
      switch (sortConfig.column) {
        case 'firstName':
          aValue = a.firstName?.toLowerCase() || '';
          bValue = b.firstName?.toLowerCase() || '';
          break;
        case 'lastName':
          aValue = a.lastName?.toLowerCase() || '';
          bValue = b.lastName?.toLowerCase() || '';
          break;
        case 'lane':
          aValue = a.lane || 0;
          bValue = b.lane || 0;
          break;
        case 'average':
          aValue = a.average || 0;
          bValue = b.average || 0;
          break;
        case 'game1_scratch':
          aValue = a.scores?.game1_scratch || 0;
          bValue = b.scores?.game1_scratch || 0;
          break;
        case 'game1_total':
          aValue = (a.scores?.game1_scratch || 0) + a.handicap;
          bValue = (b.scores?.game1_scratch || 0) + b.handicap;
          break;
        case 'game2_scratch':
          aValue = a.scores?.game2_scratch || 0;
          bValue = b.scores?.game2_scratch || 0;
          break;
        case 'game2_total':
          aValue = (a.scores?.game2_scratch || 0) + a.handicap;
          bValue = (b.scores?.game2_scratch || 0) + b.handicap;
          break;
        case 'game3_scratch':
          aValue = a.scores?.game3_scratch || 0;
          bValue = b.scores?.game3_scratch || 0;
          break;
        case 'game3_total':
          aValue = (a.scores?.game3_scratch || 0) + a.handicap;
          bValue = (b.scores?.game3_scratch || 0) + b.handicap;
          break;
        case 'totalScratch':
          aValue = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0);
          bValue = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0);
          break;
        case 'totalWithHandicap':
          const aScratch = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0);
          const bScratch = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0);
          aValue = aScratch + (a.handicap * 3);
          bValue = bScratch + (b.handicap * 3);
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // Fallback comparison
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [players, sortConfig]);
  
  // Pagination for large player lists (use sorted players)
  const paginationHook = usePagination({
    items: sortedPlayers,
    itemsPerPage: 20
  })

  // Auto-save for score data
  const { saving: autoSaving, saveNow } = useAutoSave({
    data: { scores: players.map(player => player.scores).filter(Boolean) },
    saveFunction: async (data) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('scores-backup', JSON.stringify(data))
      }
    },
    delay: 2000
  })

  const processPendingSaves = useCallback(async () => {
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
        message: 'All offline scores have been synchronized!',
        type: 'success',
        duration: 3000
      })
    }
  }, [pendingSaves, addToast])

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
        message: 'You are offline. Scores will be saved when connection is restored.',
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
      <button
        onClick={() => {
          addToast({ message: 'Refreshing scores data...', type: 'info', duration: 2000 })
          window.location.reload()
        }}
        style={{
          backgroundColor: '#f0a500',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#d4940b'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f0a500'
        }}
      >
        Refresh Data
      </button>
      
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
          Sync Offline Scores ({pendingSaves.length})
        </EnhancedButton>
      )}
    </div>
  ), [pendingSaves.length, addToast, processPendingSaves])

  usePageHeader({
    title: 'Scores',
    subtitle: tournament 
      ? `Managing: ${tournament.name}${tournament.location ? ` • ${tournament.location}` : ''}${tournament.start_date ? ` • ${new Date(tournament.start_date).toLocaleDateString()}` : ''}`
      : 'Manage player scores and tournament results',
    actions: headerActions
  })

  // Fetch tournament, squad, and players data - OPTIMIZED WITH PARALLEL REQUESTS
  useEffect(() => {
    // Batch read all localStorage data at once for better performance
    const { lastTournamentId, token, userId } = (() => {
      if (typeof window === 'undefined') return { lastTournamentId: null, token: null, userId: null };
      return {
        lastTournamentId: localStorage.getItem('lastTournamentId'),
        token: localStorage.getItem('token'),
        userId: localStorage.getItem('user_id')
      };
    })();
    
    if (lastTournamentId && token) {
      setIsLoading(true)
      
      // Parallelize all initial data fetches for faster loading
      const tournamentPromise = fetch(API(`/api/v1/tournaments/${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : null)

      const squadsPromise = fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : [])

      const selectedSquadPromise = userId 
        ? fetch(API(`/api/v1/squads/selected/?user_id=${userId}`), {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => res.ok ? res.json() : null)
        : Promise.resolve(null)

      // Wait for all requests to complete in parallel
      Promise.all([tournamentPromise, squadsPromise, selectedSquadPromise])
        .then(([tournamentData, squadsData, selectedSquadData]) => {
          // Set tournament data
          if (tournamentData) setTournament(tournamentData)

          // Determine which squad to use
          let squadToUse = null
          if (selectedSquadData && selectedSquadData.squad_id) {
            squadToUse = squadsData.find((s: Squad) => s.id === selectedSquadData.squad_id)
            setSelectedSquad(squadToUse || null)
          }

          // Fetch players with scores for the selected squad (or all if no squad)
          fetchPlayersWithScores(lastTournamentId, squadToUse?.id || null, token)
        })
        .catch(err => {
          logger.error('Error fetching initial data:', err)
          setIsLoading(false)
        })
    } else {
      // No tournament loaded, stop loading immediately
      setIsLoading(false)
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
      scoresData.forEach((score: ScoreData) => {
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
      const transformedData = (data || []).map((bowler: Player) => {
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
      logger.error('Error fetching players:', err)
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

  const getScoreInputStyle = (score: number | undefined, baseStyle: React.CSSProperties) => {
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
        // Use the player's handicap from the backend (already calculated with correct settings)
        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = player.handicap || 0  // Use stored handicap value
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

        const player = players.find(playerItem => playerItem.id === playerId)
        if (!player) {
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }))
          return
        }

        // Calculate the updated scores for API call
        const updatedScores = { ...player.scores, [field]: value }
        if (field.includes('scratch')) {
          const gameNum = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          const scratchScore = value || 0
          const handicap = player.handicap || 0  // Use stored handicap value
          const totalScore = scratchScore + handicap
          updatedScores[`game${gameNum}_total` as keyof typeof updatedScores] = totalScore
        }

        const scoreData = {
          bowler_id: playerId,
          tournament_id: parseInt(tournamentId),
          squad_id: selectedSquad.id,
          game1_scratch: updatedScores.game1_scratch,
          game2_scratch: updatedScores.game2_scratch,
          game3_scratch: updatedScores.game3_scratch
          // Note: game totals are calculated by backend (scratch + handicap)
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
              message: `Perfect game! 300 scored by ${player.firstName} ${player.lastName}`,
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
        logger.error('Failed to save score:', error)
        setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }))
        
        // Show error toast
        const currentPlayer = players.find(playerItem => playerItem.id === playerId);
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
      const currentPlayerIndex = players.findIndex(playerItem => playerItem.id === playerId)
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
    <ErrorBoundary>
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
                Refresh
              </button>
              <button
                onClick={() => {
                  addToast({ message: 'Export functionality coming soon', type: 'info', duration: 3000 })
                }}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-md"
              >
                Export
              </button>
            </div>
          }
        >
          {/* Mobile content will go here */}
          <div className="space-y-4">
            {/* No Tournament State */}
            {!tournament && !isLoading && (
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '16px',
                padding: '40px 24px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
                border: '2px solid #e2e8f0',
                margin: '20px 0'
              }}>
                <h2 style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '12px',
                  letterSpacing: '-0.02em'
                }}>
                  No Tournament Loaded
                </h2>
                <p style={{
                  fontSize: '15px',
                  color: '#64748b',
                  marginBottom: '24px',
                  lineHeight: '1.6'
                }}>
                  Load a tournament from the dashboard to start entering scores
                </p>
                <Link 
                  href="/dashboard"
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #f0a500 0%, #e09800 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontSize: '15px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(240, 165, 0, 0.3)'
                  }}
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
            
            {/* Tournament and Squad selector for mobile */}
            {tournament && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {tournament.name}
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
                            onChange={(changeEvent) => updateScore(player.id, `game${gameNum}_scratch`, parseInt(changeEvent.target.value) || 0)}
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
                          {savingStatus[player.id] === 'saving' && 'Saving...'}
                          {savingStatus[player.id] === 'saved' && 'Saved'}
                          {savingStatus[player.id] === 'error' && 'Error'}
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
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem 1rem'
      }}>
        
          {/* No Tournament State - Desktop */}
          {!tournament && !isLoading && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderRadius: '20px',
              padding: '60px 40px',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
              border: '2px solid #e2e8f0',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: '12px',
                letterSpacing: '-0.02em',
                marginTop: '24px'
              }}>
                No Tournament Loaded
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#64748b',
                marginBottom: '32px',
                maxWidth: '560px',
                margin: '0 auto 32px',
                lineHeight: '1.6'
              }}>
                You need to load a tournament from the dashboard before you can enter scores. Once loaded, you'll be able to enter and manage scores for all players.
              </p>
              <Link 
                href="/dashboard"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #f0a500 0%, #e09800 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 28px',
                  fontSize: '16px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(240, 165, 0, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(240, 165, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(240, 165, 0, 0.3)';
                }}
              >
                Go to Dashboard
              </Link>
              
              {/* Quick Info */}
              <div style={{
                marginTop: '48px',
                padding: '24px',
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                maxWidth: '600px',
                margin: '48px auto 0',
                textAlign: 'left'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>
                  What you can do with Scores:
                </h3>
                <ul style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
                  <li>Enter scratch scores for each game</li>
                  <li>Automatic handicap calculation</li>
                  <li>Real-time totals and rankings</li>
                  <li>Auto-save as you type</li>
                  <li>Export scores to CSV</li>
                </ul>
              </div>
            </div>
          )}
        
          {/* Offline Indicator */}
          {!isOnline && (
            <div className="notification notification-warning">
              <div className="offline-indicator">
                <span></span>
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
              Scroll horizontally to see all score columns
            </div>
          )}

          {/* Scores Table */}
          {!isLoading && players.length > 0 && (
            <div style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(240, 165, 0, 0.12)',
              overflow: 'hidden',
              marginBottom: '0'
            }}>
              <div style={{
                overflowX: 'auto',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  backgroundColor: '#ffffff'
                }} aria-label="Player Scores">

            <thead>
              {selectedSquad && (
                <tr>
                  <td colSpan={12} style={{ 
                    backgroundColor: 'rgba(79, 140, 255, 0.1)', 
                    color: '#4f8cff',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: '600',
                    padding: '10px'
                  }}>
                    Showing scores for: {selectedSquad.date} — {selectedSquad.time}
                  </td>
                </tr>
              )}
              <tr style={{
                backgroundColor: '#f8fafc',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <SortableHeader column="firstName" sortConfig={sortConfig} onSort={handleSort} align="left" width="9%">
                  First Name
                </SortableHeader>
                <SortableHeader column="lastName" sortConfig={sortConfig} onSort={handleSort} align="left" width="9%">
                  Last Name
                </SortableHeader>
                <SortableHeader column="lane" sortConfig={sortConfig} onSort={handleSort} width="5%">
                  Lane
                </SortableHeader>
                <SortableHeader column="average" sortConfig={sortConfig} onSort={handleSort} width="5%">
                  Avg
                </SortableHeader>
                <SortableHeader column="game1_scratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 1<br/>Scratch
                </SortableHeader>
                <SortableHeader column="game1_total" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 1<br/>Total
                </SortableHeader>
                <SortableHeader column="game2_scratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 2<br/>Scratch
                </SortableHeader>
                <SortableHeader column="game2_total" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 2<br/>Total
                </SortableHeader>
                <SortableHeader column="game3_scratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 3<br/>Scratch
                </SortableHeader>
                <SortableHeader column="game3_total" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Game 3<br/>Total
                </SortableHeader>
                <SortableHeader column="totalScratch" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Total<br/>Scratch
                </SortableHeader>
                <SortableHeader column="totalWithHandicap" sortConfig={sortConfig} onSort={handleSort} width="9%">
                  Total
                </SortableHeader>
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
                onMouseEnter={(changeEvent) => { 
                  changeEvent.currentTarget.style.backgroundColor = '#f0f9ff';
                  changeEvent.currentTarget.style.transform = 'translateY(-1px)';
                  changeEvent.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(changeEvent) => { 
                  changeEvent.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                  changeEvent.currentTarget.style.transform = 'translateY(0)';
                  changeEvent.currentTarget.style.boxShadow = 'none';
                }}>
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: '600',
                    color: '#111827',
                    fontSize: '13px'
                  }}>{player.firstName}</td>
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: '600',
                    color: '#111827',
                    fontSize: '13px'
                  }}>{player.lastName}</td>
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    color: player.lane ? '#111827' : '#9ca3af',
                    fontSize: '13px'
                  }}>{player.lane || '—'}</td>
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontWeight: '500',
                    color: '#6b7280',
                    fontSize: '13px'
                  }}>{player.average}</td>
                  
                  {/* Game 1 Scratch */}
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '13px'
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
                        onChange={changeEvent => updateScore(player.id, 'game1_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                        onKeyDown={keyEvent => handleKeyDown(keyEvent, player.id, 'game1_scratch')}
                        style={getScoreInputStyle(player.scores?.game1_scratch, { 
                          width: '55px', 
                          padding: '6px 20px 6px 8px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: '#ffffff',
                          color: '#111827',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        })}
                        onFocus={(changeEvent) => {
                          const validation = validateScore(player.scores?.game1_scratch)
                          if (validation.isValid) { 
                            changeEvent.target.style.borderColor = '#3b82f6'; 
                            changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          } 
                          changeEvent.target.select()
                        }}
                        onBlur={(changeEvent) => {
                          const validation = validateScore(player.scores?.game1_scratch)
                          if (validation.isValid) { 
                            changeEvent.target.style.borderColor = '#d1d5db'; 
                            changeEvent.target.style.boxShadow = 'none';
                          }
                        }}
                        title={!validateScore(player.scores?.game1_scratch).isValid ? validateScore(player.scores?.game1_scratch).message : ''}
                      />
                      
                      {/* Increment/Decrement Arrows - Inside Input */}
                      <div style={{ 
                        position: 'absolute', 
                        right: '4px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '1px' 
                      }}>
                        <button
                          onClick={() => {
                            const currentScore = player.scores?.game1_scratch || 0;
                            const newScore = Math.min(300, currentScore + 1);
                            updateScore(player.id, 'game1_scratch', newScore);
                          }}
                          style={{
                            width: '12px',
                            height: '8px',
                            border: 'none',
                            borderRadius: '1px',
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '6px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                            changeEvent.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent';
                            changeEvent.currentTarget.style.color = '#6b7280';
                          }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => {
                            const currentScore = player.scores?.game1_scratch || 0;
                            const newScore = Math.max(0, currentScore - 1);
                            updateScore(player.id, 'game1_scratch', newScore);
                          }}
                          style={{
                            width: '12px',
                            height: '8px',
                            border: 'none',
                            borderRadius: '1px',
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '6px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                            changeEvent.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent';
                            changeEvent.currentTarget.style.color = '#6b7280';
                          }}
                        >
                          ▼
                        </button>
                      </div>
                      
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
                          {savingStatus[`${player.id}-game1_scratch`] === 'saved' && ''}
                          {savingStatus[`${player.id}-game1_scratch`] === 'error' && ''}
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
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '600',
                    color: '#3b82f6',
                    fontSize: '13px'
                  }}>
                    {getGameTotal(player.scores?.game1_total, player.scores?.game1_scratch)}
                  </td>
                  
                  {/* Game 2 Scratch */}
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '13px'
                  }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
                        value={player.scores?.game2_scratch ?? ''}
                        onChange={changeEvent => updateScore(player.id, 'game2_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                        style={getScoreInputStyle(player.scores?.game2_scratch, { 
                          width: '55px', 
                          padding: '6px 20px 6px 8px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: '#ffffff',
                          color: '#111827',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        })}
                        onFocus={(changeEvent) => {
                          const validation = validateScore(player.scores?.game2_scratch)
                          if (validation.isValid) { 
                            changeEvent.target.style.borderColor = '#3b82f6'; 
                            changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          }
                        }}
                        onBlur={(changeEvent) => {
                          const validation = validateScore(player.scores?.game2_scratch)
                          if (validation.isValid) { 
                            changeEvent.target.style.borderColor = '#d1d5db'; 
                            changeEvent.target.style.boxShadow = 'none';
                          }
                        }}
                        title={!validateScore(player.scores?.game2_scratch).isValid ? validateScore(player.scores?.game2_scratch).message : ''}
                      />
                      
                      {/* Increment/Decrement Arrows - Inside Input */}
                      <div style={{ 
                        position: 'absolute', 
                        right: '4px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '1px' 
                      }}>
                        <button
                          onClick={() => {
                            const currentScore = player.scores?.game2_scratch || 0;
                            const newScore = Math.min(300, currentScore + 1);
                            updateScore(player.id, 'game2_scratch', newScore);
                          }}
                          style={{
                            width: '12px',
                            height: '8px',
                            border: 'none',
                            borderRadius: '1px',
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '6px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                            changeEvent.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent';
                            changeEvent.currentTarget.style.color = '#6b7280';
                          }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => {
                            const currentScore = player.scores?.game2_scratch || 0;
                            const newScore = Math.max(0, currentScore - 1);
                            updateScore(player.id, 'game2_scratch', newScore);
                          }}
                          style={{
                            width: '12px',
                            height: '8px',
                            border: 'none',
                            borderRadius: '1px',
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '6px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                            changeEvent.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent';
                            changeEvent.currentTarget.style.color = '#6b7280';
                          }}
                        >
                          ▼
                        </button>
                      </div>
                      
                      {/* Save Status Indicator */}
                      {savingStatus[`${player.id}-game2_scratch`] && (
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
                          ...(savingStatus[`${player.id}-game2_scratch`] === 'saving' && {
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            animation: 'pulse 1s infinite'
                          }),
                          ...(savingStatus[`${player.id}-game2_scratch`] === 'saved' && {
                            backgroundColor: '#10b981',
                            color: 'white'
                          }),
                          ...(savingStatus[`${player.id}-game2_scratch`] === 'error' && {
                            backgroundColor: '#ef4444',
                            color: 'white'
                          })
                        }}>
                          {savingStatus[`${player.id}-game2_scratch`] === 'saving' && '⋯'}
                          {savingStatus[`${player.id}-game2_scratch`] === 'saved' && ''}
                          {savingStatus[`${player.id}-game2_scratch`] === 'error' && ''}
                        </div>
                      )}
                    </div>
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
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '600',
                    color: '#3b82f6',
                    fontSize: '13px'
                  }}>
                    {getGameTotal(player.scores?.game2_total, player.scores?.game2_scratch)}
                  </td>
                  
                  {/* Game 3 Scratch */}
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '13px'
                  }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
                        value={player.scores?.game3_scratch ?? ''}
                        onChange={changeEvent => updateScore(player.id, 'game3_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                        style={getScoreInputStyle(player.scores?.game3_scratch, { 
                          width: '55px', 
                          padding: '6px 20px 6px 8px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: '#ffffff',
                          color: '#111827',
                          transition: 'all 0.2s ease',
                          outline: 'none'
                        })}
                        onFocus={(changeEvent) => {
                          const validation = validateScore(player.scores?.game3_scratch)
                          if (validation.isValid) { 
                            changeEvent.target.style.borderColor = '#3b82f6'; 
                            changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          }
                        }}
                        onBlur={(changeEvent) => {
                          const validation = validateScore(player.scores?.game3_scratch)
                          if (validation.isValid) { 
                            changeEvent.target.style.borderColor = '#d1d5db'; 
                            changeEvent.target.style.boxShadow = 'none';
                          }
                        }}
                        title={!validateScore(player.scores?.game3_scratch).isValid ? validateScore(player.scores?.game3_scratch).message : ''}
                      />
                      
                      {/* Increment/Decrement Arrows - Inside Input */}
                      <div style={{ 
                        position: 'absolute', 
                        right: '4px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '1px' 
                      }}>
                        <button
                          onClick={() => {
                            const currentScore = player.scores?.game3_scratch || 0;
                            const newScore = Math.min(300, currentScore + 1);
                            updateScore(player.id, 'game3_scratch', newScore);
                          }}
                          style={{
                            width: '12px',
                            height: '8px',
                            border: 'none',
                            borderRadius: '1px',
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '6px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                            changeEvent.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent';
                            changeEvent.currentTarget.style.color = '#6b7280';
                          }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => {
                            const currentScore = player.scores?.game3_scratch || 0;
                            const newScore = Math.max(0, currentScore - 1);
                            updateScore(player.id, 'game3_scratch', newScore);
                          }}
                          style={{
                            width: '12px',
                            height: '8px',
                            border: 'none',
                            borderRadius: '1px',
                            backgroundColor: 'transparent',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '6px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                            changeEvent.currentTarget.style.color = '#374151';
                          }}
                          onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent';
                            changeEvent.currentTarget.style.color = '#6b7280';
                          }}
                        >
                          ▼
                        </button>
                      </div>
                      
                      {/* Save Status Indicator */}
                      {savingStatus[`${player.id}-game3_scratch`] && (
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
                          ...(savingStatus[`${player.id}-game3_scratch`] === 'saving' && {
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            animation: 'pulse 1s infinite'
                          }),
                          ...(savingStatus[`${player.id}-game3_scratch`] === 'saved' && {
                            backgroundColor: '#10b981',
                            color: 'white'
                          }),
                          ...(savingStatus[`${player.id}-game3_scratch`] === 'error' && {
                            backgroundColor: '#ef4444',
                            color: 'white'
                          })
                        }}>
                          {savingStatus[`${player.id}-game3_scratch`] === 'saving' && '⋯'}
                          {savingStatus[`${player.id}-game3_scratch`] === 'saved' && ''}
                          {savingStatus[`${player.id}-game3_scratch`] === 'error' && ''}
                        </div>
                      )}
                    </div>
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
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '600',
                    color: '#3b82f6',
                    fontSize: '13px'
                  }}>
                    {getGameTotal(player.scores?.game3_total, player.scores?.game3_scratch)}
                  </td>
                  
                  {/* Total Scratch */}
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '700',
                    color: '#374151',
                    fontSize: '13px'
                  }}>
                    {calculateTotalScratch(player) || '—'}
                  </td>
                  
                  {/* Total */}
                  <td style={{ 
                    padding: '12px 10px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    position: 'relative',
                    fontWeight: '700',
                    color: '#1f2937',
                    fontSize: '13px',
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
            marginBottom: '0',
            paddingBottom: '0',
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
        </div>
      )}
    </>
    </ErrorBoundary>
  )
}


