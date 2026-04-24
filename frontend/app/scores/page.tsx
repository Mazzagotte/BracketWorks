'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Tournament, Squad, Player, ScoreData, PendingScoreSave } from '../lib/types'
import { SortConfig, SortableScoreColumn } from './types'
import { SortableHeader } from './components/SortableHeader'

import Link from 'next/link'

import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { API } from '../lib/api'
import { usePageHeader } from '../lib/header-context'
import EnhancedButton from '../components/EnhancedButton'
import { MobileLayout } from '../../components/MobileLayout'
import { Spinner } from '../components/LoadingComponents'
import styles from './scores.module.css'
import { useToast } from '../components/Toast'
import { usePagination, Pagination } from '../components/Performance'
import { useAutoSave } from '../components/DataManagement'
import NoTournamentState from '../components/NoTournamentState'
import { logger } from '../lib/logger';
import { Button } from '../components/UI'



export default function ScoresPage() {
  // Authentication check - must be at the top
  const { isAuthenticated, isInitialized } = useAuth();

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuth = typeof window !== 'undefined' && 
    localStorage.getItem('token') && 
    localStorage.getItem('user_id');

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
  
  // Styles moved to globals.css; no inline style injection

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

  // Auto-save scores backup to localStorage
  useAutoSave({
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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // DEV ONLY: randomize game scores for all loaded players
  const handleRandomizeScores = useCallback(async () => {
    for (const player of players) {
      const g1 = Math.floor(Math.random() * 121) + 130 // 130–250
      const g2 = Math.floor(Math.random() * 121) + 130
      const g3 = Math.floor(Math.random() * 121) + 130
      await updateScore(player.id, 'game1_scratch', g1)
      await updateScore(player.id, 'game2_scratch', g2)
      await updateScore(player.id, 'game3_scratch', g3)
    }
  }, [players]) // eslint-disable-line react-hooks/exhaustive-deps

  // Header configuration
  const headerActions = useMemo(() => (
    <div className={styles.headerActions}>
      {process.env.NODE_ENV === 'development' && players.length > 0 && (
        <button className={styles.devButton} onClick={handleRandomizeScores}>DEV: Randomize Scores</button>
      )}
      
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
  ), [players.length, handleRandomizeScores, pendingSaves.length, addToast, processPendingSaves])

  usePageHeader({
    title: 'Scores',
    subtitle: undefined,
    actions: headerActions
  })

  // fetchPlayersWithScores must be defined before the useEffect that calls it
  // (and before any early-return guards) so the closure captures it properly.
  const fetchPlayersWithScores = useCallback(async (tournamentId: string, squadId: number | null, token: string) => {
    try {
      const bowlersUrl = squadId 
        ? `/api/v1/bowlers/?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/bowlers/?tournament_id=${tournamentId}`
      
      const response = await fetch(API(bowlersUrl), {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        logger.error(`Bowlers API returned ${response.status} for url: ${bowlersUrl}`)
      }
      
      let data = response.ok ? await response.json() : []

      // Fallback: if squad-filtered fetch returns no results, load all tournament players.
      // Players added without a squad selection have squad_id = null and won't match the squad filter.
      if (squadId && data.length === 0) {
        const fallbackResponse = await fetch(API(`/api/v1/bowlers/?tournament_id=${tournamentId}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (fallbackResponse.ok) {
          data = await fallbackResponse.json()
        }
      }
      
      // Fetch existing scores from database (always without squad filter to catch all scores)
      const scoresUrl = `/api/v1/scores/?tournament_id=${tournamentId}`
      
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auth guards (after all hooks)
  if (!isInitialized) {
    return (
      <div className={styles.loadingState}>
        <div>Loading score management...</div>
      </div>
    )
  }

  if (!isAuthenticated && !hasStoredAuth) {
    return (
      <div className={styles.authRequired}>
        <div>Please log in to access score management</div>
      </div>
    )
  }

  if (!isAuthenticated && hasStoredAuth) {
    return (
      <div className={styles.authRequired}>
        <div>Loading score management...</div>
      </div>
    )
  }

  if (typeof window !== 'undefined' && !localStorage.getItem('lastTournamentId')) {
    return (
      <NoTournamentState
        description="Load a tournament from the dashboard to enter and manage scores. Once loaded, you'll be able to record game scores for each player across all rounds."
        cards={[
          { title: 'Enter Scores', text: 'Record game scores for each player per round directly in the score sheet' },
          { title: 'Auto-Save', text: 'Scores are saved automatically as you type — no need to manually submit' },
          { title: 'Sort & Filter', text: 'Sort players by name, average, or score to quickly find and update entries' },
        ]}
      />
    )
  }



  const validateScore = (score: number | undefined) => {
    if (score === undefined || score === null) return { isValid: true, message: '' }
    if (score < 0) return { isValid: false, message: 'Score cannot be negative' }
    if (score > 300) return { isValid: false, message: 'Score cannot exceed 300' }
    return { isValid: true, message: '' }
  }

  const getScoreInputClass = (score: number | undefined) => {
    const validation = validateScore(score)
    if (!validation.isValid) return 'score-input invalid'
    if (score === 300) return 'score-input perfect'
    return 'score-input'
  }

  const getSavingIndicator = (playerId: number, field: string) => {
    const key = `${playerId}-${field}`
    const status = savingStatus[key]
    if (!status) return null
    const cls = `saving-indicator ${status}`
    return (<div className={cls}>{status === 'saving' ? '⋯' : ''}</div>)
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
    const scratch = (scores.game1_scratch || 0) + (scores.game2_scratch || 0) + (scores.game3_scratch || 0)
    const gamesPlayed = [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch].filter(s => s !== undefined && s !== null).length
    return scratch + (player.handicap * gamesPlayed)
  }

  const getGameTotal = (scratchScore: number | undefined, handicap: number) => {
    if (scratchScore === undefined || scratchScore === null) return '—'
    return scratchScore + handicap
  }

  const calculateDisplayTotal = (player: Player) => {
    const scores = player.scores || {}
    const games = [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch]
    const played = games.filter(s => s !== undefined && s !== null)
    if (played.length === 0) return '—'
    const scratch = played.reduce((sum, s) => sum + (s || 0), 0)
    return scratch + (player.handicap * played.length)
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
              <div className={styles.noTournamentMobile}>
                <h2 className={styles.noTournamentTitleMobile}>No Tournament Loaded</h2>
                <p className={styles.noTournamentTextMobile}>
                  Load a tournament from the dashboard to start entering scores
                </p>
                <Link href="/dashboard" className={styles.dashboardBtnMobile}>
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
      <div className={styles.desktopContainer}>

          {/* No Tournament State - Desktop */}
          {!tournament && !isLoading && (
            <div className={styles.noTournamentDesktop}>
              <h2 className={styles.noTournamentTitleDesktop}>No Tournament Loaded</h2>
              <p className={styles.noTournamentTextDesktop}>
                You need to load a tournament from the dashboard before you can enter scores. Once loaded, you&apos;ll be able to enter and manage scores for all players.
              </p>
              <Link href="/dashboard" className={styles.dashboardBtnDesktop}>
                Go to Dashboard
              </Link>

              <div className={styles.quickInfo}>
                <h3 className={styles.quickInfoTitle}>What you can do with Scores:</h3>
                <ul className={styles.quickInfoList}>
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
            <div className={styles.statusMessage}>
              Loading players and scores...
            </div>
          )}

          {/* No Players State */}
          {!isLoading && players.length === 0 && tournament && (
            <div className={styles.statusMessage}>
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
            <div className="entries-container">
                <table className="entries-table" aria-label="Player Scores">

            <thead>
              {selectedSquad && (
                <tr>
                  <td colSpan={12} className="squad-banner">
                    Showing scores for: {selectedSquad.date} — {selectedSquad.time}
                  </td>
                </tr>
              )}
              <tr className="entries-header-row">
                <SortableHeader column="firstName" sortConfig={sortConfig} onSort={handleSort} align="center" width="9%">
                  First Name
                </SortableHeader>
                <SortableHeader column="lastName" sortConfig={sortConfig} onSort={handleSort} align="center" width="9%">
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
                <tr key={player.id} className={`scores-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                  <td className="scores-cell name">{player.firstName}</td>
                  <td className="scores-cell name">{player.lastName}</td>
                  <td className={`scores-cell lane ${!player.lane ? 'lane-empty' : ''}`}>{player.lane || '—'}</td>
                  <td className="scores-cell average">{player.average}</td>
                  
                  {/* Game 1 Scratch */}
                  <td className="scores-cell scratch-input">
                    <div className="pos-relative inline-block">
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
                        className={getScoreInputClass(player.scores?.game1_scratch)}
                        onFocus={(changeEvent) => changeEvent.target.select()}
                        title={!validateScore(player.scores?.game1_scratch).isValid ? validateScore(player.scores?.game1_scratch).message : ''}
                      />
                      {getSavingIndicator(player.id, 'game1_scratch')}
                    </div>
                  </td>
                  
                  {/* Game 1 Total */}
                  <td className="scores-cell total">
                    {getGameTotal(player.scores?.game1_scratch, player.handicap)}
                  </td>
                  
                  {/* Game 2 Scratch */}
                  <td className="scores-cell scratch-input">
                    <div className="pos-relative inline-block">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
                        value={player.scores?.game2_scratch ?? ''}
                        onChange={changeEvent => updateScore(player.id, 'game2_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                        className={getScoreInputClass(player.scores?.game2_scratch)}
                        onFocus={(changeEvent) => changeEvent.target.select()}
                        title={!validateScore(player.scores?.game2_scratch).isValid ? validateScore(player.scores?.game2_scratch).message : ''}
                      />
                      {getSavingIndicator(player.id, 'game2_scratch')}
                    </div>
                  </td>
                  
                  {/* Game 2 Total */}
                  <td className="scores-cell total">
                    {getGameTotal(player.scores?.game2_scratch, player.handicap)}
                  </td>
                  
                  {/* Game 3 Scratch */}
                  <td className="scores-cell scratch-input">
                    <div className="pos-relative inline-block">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        placeholder="—"
                        value={player.scores?.game3_scratch ?? ''}
                        onChange={changeEvent => updateScore(player.id, 'game3_scratch', changeEvent.target.value ? Number(changeEvent.target.value) : undefined)}
                        className={getScoreInputClass(player.scores?.game3_scratch)}
                        onFocus={(changeEvent) => changeEvent.target.select()}
                        title={!validateScore(player.scores?.game3_scratch).isValid ? validateScore(player.scores?.game3_scratch).message : ''}
                      />
                      {getSavingIndicator(player.id, 'game3_scratch')}
                    </div>
                  </td>
                  
                  {/* Game 3 Total */}
                  <td className="scores-cell total">
                    {getGameTotal(player.scores?.game3_scratch, player.handicap)}
                  </td>
                  
                  {/* Total Scratch */}
                  <td className="scores-cell total-scratch">
                    {calculateTotalScratch(player) || '—'}
                  </td>
                  
                  {/* Total */}
                  <td className="scores-cell total-final">
                    {calculateDisplayTotal(player)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {/* Pagination Controls */}
        {paginationHook.totalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <div className={styles.paginationInfo}>
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


