
'use client'
import { useEffect, useState, useMemo } from 'react'
import { API } from '../lib/api'
import { usePageHeader } from '../lib/header-context'
import EnhancedButton from '../components/EnhancedButton'
import { MobileTable } from '../../components/MobileTable'
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
import { LoadingButton } from '../components/LoadingComponents'
import { useToast } from '../components/Toast'
import { ErrorMessage } from '../components/ErrorHandling'
import { usePagination } from '../components/Performance'

type Match = { 
  seedA: number
  seedB: number 
  playerA?: string
  playerB?: string
  scoreA?: number
  scoreB?: number
  winner?: 'A' | 'B'
  status?: 'pending' | 'in_progress' | 'completed'
}

type BracketRound = { 
  name: string
  matches: Match[] 
}

type Preview = { 
  size: number
  rounds: BracketRound[]
  // For multiple bracket support
  multiple_brackets?: {
    scratch_brackets: any[]
    handicap_brackets: any[]
    summary: {
      total_scratch_entries: number
      total_handicap_entries: number
      scratch_brackets_count: number
      handicap_brackets_count: number
      scratch_placed_entries: number
      handicap_placed_entries: number
      scratch_refund_entries: number
      handicap_refund_entries: number
    }
  }
  tournament_info?: {
    name: string
    id: number
  }
}

type BracketType = 'single_elimination' | 'double_elimination' | 'round_robin' | 'step_ladder'

export default function BracketsPage() {
  const [size, setSize] = useState(8)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [showLoadingModal, setShowLoadingModal] = useState(false)
  const [bracketType, setBracketType] = useState<BracketType>('single_elimination')
  const [viewMode, setViewMode] = useState<'table'>('table')
  const [selectedMatch, setSelectedMatch] = useState<{bracket_id: string, round: number, match: number} | null>(null)
  const [selectedRound, setSelectedRound] = useState(0)
  const [selectedBracketType, setSelectedBracketType] = useState<'scratch' | 'handicap'>('scratch')
  const [selectedBracket, setSelectedBracket] = useState<{type: 'scratch' | 'handicap', index: number} | null>(null)
  
  // Player filter state
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [filteredBrackets, setFilteredBrackets] = useState<{scratch: number[], handicap: number[]} | null>(null)

  // Tournament integration state (auto-loaded from dashboard)
  const [tournament, setTournament] = useState<any | null>(null)
  const [squads, setSquads] = useState<any[]>([])
  const [selectedSquad, setSelectedSquad] = useState<any | null>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  
  // Hydration state to prevent localStorage access during SSR
  const [isHydrated, setIsHydrated] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [currentMessage, setCurrentMessage] = useState(0)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'fast' | 'normal' | 'slow'>('normal')
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [generationStats, setGenerationStats] = useState<{players: number, matches: number, rounds: number} | null>(null)

  // Header configuration
  const headerActions = useMemo(() => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      {(!preview || preview.multiple_brackets?.scratch_brackets?.length === 0) && players.length > 1 && (
        <EnhancedButton
          onClick={() => load(false)}
          variant="primary"
          size="md"
          disabled={loading || players.length === 0}
          loading={loading}
        >
          Generate Brackets
        </EnhancedButton>
      )}
      
      {preview && (
        <EnhancedButton
          onClick={() => load(true)}
          variant="secondary"
          size="md"
          disabled={loading}
          loading={loading}
        >
          Regenerate
        </EnhancedButton>
      )}
      
      <EnhancedButton
        onClick={() => setAutoRefresh(!autoRefresh)}
        variant={autoRefresh ? 'primary' : 'secondary'}
        size="sm"
        className={`transition-all duration-200 ${
          autoRefresh ? 'ring-2 ring-orange-200 shadow-lg' : ''
        }`}
      >
        Auto-Refresh: {autoRefresh ? 'ON' : 'OFF'}
      </EnhancedButton>
      
      <EnhancedButton
        onClick={() => tournament && loadPlayers(tournament.id, selectedSquad?.id || null)}
        variant="secondary"
        size="sm"
        disabled={loadingPlayers}
        loading={loadingPlayers}
      >
        Refresh Players
      </EnhancedButton>
      
      {preview && (
        <>
          <EnhancedButton
            onClick={() => { addToast({ message: 'Export functionality coming soon', type: 'info', duration: 3000 }) }}
            variant="secondary"
            size="sm"
          >
            Export
          </EnhancedButton>
          
          <EnhancedButton
            onClick={() => window.print()}
            variant="secondary"
            size="sm"
          >
            Print
          </EnhancedButton>
        </>
      )}
    </div>
  ), [preview, players.length, loading, autoRefresh, loadingPlayers, tournament, selectedSquad?.id])

  usePageHeader({
    title: 'Brackets',
    subtitle: tournament && selectedSquad 
      ? `${tournament.name} • ${selectedSquad.name} • ${players.length} players`
      : tournament 
        ? `${tournament.name} • ${players.length} players`
        : `${players.length} players`,
    actions: headerActions
  })

  // Dynamic loading messages with step-by-step breakdown
  const getLoadingMessages = () => {
    const stats = generationStats
    if (!stats) {
      return [
        "Analyzing tournament parameters...",
        "Loading player data...",
        "Calculating optimal seeding...",
        "Generating match structure...",
        "Finalizing brackets..."
      ]
    }
    
    return [
      `Setting up tournament for ${stats.players} players...`,
      `Creating ${stats.matches} total matches...`,
      `Organizing ${stats.rounds} rounds...`,
      `Applying seeding algorithms...`,
      `Finalizing bracket structure...`
    ]
  }

  const loadingMessages = getLoadingMessages()

  // Progress and message cycling effect
  useEffect(() => {
    if (showLoadingModal) {
      setGenerationProgress(0)
      setCurrentMessage(0)
      setGenerationStartTime(Date.now())
      
      // Calculate generation stats based on current settings
      const playerCount = players.length || size
      const rounds = Math.ceil(Math.log2(playerCount))
      const matches = playerCount - 1 // Single elimination
      setGenerationStats({
        players: playerCount,
        matches: matches,
        rounds: rounds
      })
      
      // Monitor connection status
      const startTime = Date.now()
      const connectionCheck = setTimeout(() => {
        const elapsed = Date.now() - startTime
        if (elapsed > 3000) {
          setConnectionStatus('slow')
        } else if (elapsed > 1500) {
          setConnectionStatus('normal')
        } else {
          setConnectionStatus('fast')
        }
      }, 1000)
      
      // Progress simulation - smooth progress over exactly 10 seconds
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          const elapsed = Date.now() - (generationStartTime || Date.now())
          const targetProgress = Math.min((elapsed / 10000) * 100, 100) // 10 seconds = 100%
          
          // Smooth progress towards target with slight randomization
          const diff = targetProgress - prev
          if (diff > 0) {
            return prev + Math.min(diff * 0.3 + Math.random() * 2, diff)
          }
          return prev
        })
      }, 100) // More frequent updates for smoother animation
      
      // Message cycling every 2 seconds
      const messageInterval = setInterval(() => {
        setCurrentMessage(prev => (prev + 1) % loadingMessages.length)
      }, 2000)
      
      return () => {
        clearTimeout(connectionCheck)
        clearInterval(progressInterval)
        clearInterval(messageInterval)
      }
    }
  }, [showLoadingModal, loadingMessages.length, generationStartTime, players.length, size])

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
  
  // Enhanced UX hooks
  const { addToast } = useToast()
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination({ 
    items: players,
    itemsPerPage: 50
  })

  // Helper function to determine if a match is "up next"
  const isUpNextMatch = (match: any, allMatches: any[]) => {
    // A match is "up next" if it's pending and has no ongoing matches before it
    if (match.status === 'completed' || match.scoreA || match.scoreB) return false
    
    // Find pending matches without any scores
    const pendingMatches = allMatches.filter(m => 
      m.status !== 'completed' && !m.scoreA && !m.scoreB
    )
    
    // Return true if this is one of the first few pending matches
    return pendingMatches.length > 0 && pendingMatches.indexOf(match) < 2
  }

  // Helper function to get round name
  const getRoundName = (roundIndex: number, totalRounds: number) => {
    if (roundIndex === 0) return 'Round 1'
    if (roundIndex === totalRounds - 1) return 'Finals'
    if (roundIndex === totalRounds - 2) return 'Semifinals'
    if (roundIndex === totalRounds - 3) return 'Quarterfinals'
    return `Round ${roundIndex + 1}`
  }

  // Helper function to get match status style
  const getMatchStatusStyle = (match: any) => ({
    backgroundColor: 
      match.status === 'completed' ? '#dcfce7' :
      (match.scoreA || match.scoreB) && match.status !== 'completed' ? '#fef3c7' :
      '#f9fafb',
    borderColor:
      match.status === 'completed' ? '#10b981' :
      (match.scoreA || match.scoreB) && match.status !== 'completed' ? '#f59e0b' :
      '#e5e7eb',
    borderWidth: '2px'
  })

  // Helper function to get current bracket data
  const getCurrentBracket = () => {
    if (preview && !preview.multiple_brackets) {
      return preview
    }
    if (preview?.multiple_brackets && selectedBracket) {
      const brackets = selectedBracket.type === 'scratch' 
        ? preview.multiple_brackets.scratch_brackets 
        : preview.multiple_brackets.handicap_brackets
      return brackets[selectedBracket.index]
    }
    return null
  }

  // Helper function to search for players across all brackets
  const searchForPlayer = (query: string) => {
    if (!query.trim() || !preview) {
      setFilteredBrackets(null)
      return
    }

    const searchTerm = query.toLowerCase().trim()
    const results: {scratch: number[], handicap: number[]} = {
      scratch: [],
      handicap: []
    }

    if (preview.multiple_brackets) {
      // Search scratch brackets
      preview.multiple_brackets.scratch_brackets.forEach((bracket: any, index: number) => {
        let found = false
        bracket.rounds?.forEach((round: any) => {
          round.matches?.forEach((match: any) => {
            const playerA = match.playerA || match.teamA || ''
            const playerB = match.playerB || match.teamB || ''
            if (playerA.toLowerCase().includes(searchTerm) || 
                playerB.toLowerCase().includes(searchTerm)) {
              found = true
            }
          })
        })
        if (found) results.scratch.push(index)
      })

      // Search handicap brackets
      preview.multiple_brackets.handicap_brackets.forEach((bracket: any, index: number) => {
        let found = false
        bracket.rounds?.forEach((round: any) => {
          round.matches?.forEach((match: any) => {
            const playerA = match.playerA || match.teamA || ''
            const playerB = match.playerB || match.teamB || ''
            if (playerA.toLowerCase().includes(searchTerm) || 
                playerB.toLowerCase().includes(searchTerm)) {
              found = true
            }
          })
        })
        if (found) results.handicap.push(index)
      })
    } else if (preview.rounds) {
      // Single bracket search
      let found = false
      preview.rounds.forEach((round: any) => {
        round.matches?.forEach((match: any) => {
          const playerA = match.playerA || match.teamA || ''
          const playerB = match.playerB || match.teamB || ''
          if (playerA.toLowerCase().includes(searchTerm) || 
              playerB.toLowerCase().includes(searchTerm)) {
            found = true
          }
        })
      })
      if (found) {
        // For single brackets, we'll highlight it differently
        results.scratch.push(0) // Use index 0 to represent the single bracket
      }
    }

    setFilteredBrackets(results.scratch.length > 0 || results.handicap.length > 0 ? results : null)
  }

  // Helper function to determine if player/team won the match
  const isWinner = (match: any, side: 'A' | 'B') => {
    if (match.status !== 'completed') return false
    const scoreA = match.scoreA || 0
    const scoreB = match.scoreB || 0
    return side === 'A' ? scoreA > scoreB : scoreB > scoreA
  }

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Auto-load tournament from dashboard
  const loadTournament = async () => {
    if (!isHydrated) return
    
    try {
      const token = localStorage.getItem('token')
      const lastTournamentId = localStorage.getItem('lastTournamentId')
      
      if (!token || !lastTournamentId) {
        return
      }

      const url = API(`/api/v1/tournaments/${lastTournamentId}`)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setTournament(data)
      
      // Auto-load squads for this tournament
      await loadSquads(data.id)
      
      // Try to load existing brackets after loading squads
      setTimeout(() => loadExistingBrackets(data.id), 1000) // Small delay to allow squad selection
    } catch (error) {
      console.error('Error loading tournament:', error)
      // Show more detailed error information
      if (error instanceof Error) {
        console.error('Error message:', error.message)
      }
    }
  }

  // Load existing brackets if they exist
  const loadExistingBrackets = async (tournamentId: number, squadId: number | null = null) => {
    if (!isHydrated) return
    
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // Use the current selected squad if not specified
      const currentSquadId = squadId || selectedSquad?.id || null
      const squadParam = currentSquadId ? `?squad_id=${currentSquadId}` : ''
      const url = API(`/api/v1/brackets/load/${tournamentId}${squadParam}`)
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setPreview({
          size: data.bracket_size,
          rounds: [], // Will be populated by the multiple brackets
          multiple_brackets: data, // Store full bracket data
          tournament_info: {
            name: data.tournament_name,
            id: data.tournament_id
          }
        })
        
        addToast({
          type: 'success',
          message: `Existing brackets loaded! ${data.summary?.total_scratch_entries || 0} scratch + ${data.summary?.total_handicap_entries || 0} handicap entries`,
          duration: 4000
        })
      }
      // If response is 404 (no brackets found), just continue silently - this is normal for new tournaments
    } catch (error) {
      // Silently handle errors for bracket loading - they may not exist yet
    }
  }

  // Load squads for selected tournament
  const loadSquads = async (tournamentId: number) => {
    if (!isHydrated) return // Wait for hydration
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setSquads([])
        return
      }

      const url = API(`/api/v1/squads/?tournament_id=${tournamentId}`)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setSquads(Array.isArray(data) ? data : [])
      
      // Auto-select first squad or previously selected squad
      if (isHydrated) {
        const selectedSquadId = localStorage.getItem(`selectedSquad_${tournamentId}`)
        if (selectedSquadId) {
          const squad = data.find((s: any) => s.id === parseInt(selectedSquadId))
          setSelectedSquad(squad)
        } else if (data.length > 0) {
          setSelectedSquad(data[0])
        }
      }
    } catch (error) {
      console.error('Error loading squads:', error)
      setSquads([])
    }
  }

  // Load players for selected squad
  const loadPlayers = async (tournamentId: number, squadId: number | null = null) => {
    if (!isHydrated) return // Wait for hydration
    
    setLoadingPlayers(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        addToast({
          type: 'warning',
          message: 'Please log in to load players',
          duration: 4000
        })
        setPlayers([])
        return
      }

      const squadParam = squadId ? `&squad_id=${squadId}` : ''
      const url = API(`/api/v1/bowlers/?tournament_id=${tournamentId}${squadParam}`)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.')
        } else if (response.status === 404) {
          throw new Error('Tournament or squad not found')
        } else {
          throw new Error(`Failed to load players: ${response.status}`)
        }
      }
      
      const data = await response.json()
      const playersList = Array.isArray(data) ? data : []
      setPlayers(playersList)
      
      addToast({
        type: 'success',
        message: `Loaded ${playersList.length} players${squadId ? ' for selected squad' : ''}`,
        duration: 3000
      })
      
      // Auto-adjust bracket size based on number of players
      const playerCount = playersList.length
      if (playerCount > 0) {
        // Round up to next power of 2 for single elimination
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(playerCount)))
        const optimalSize = Math.max(4, nextPowerOf2)
        setSize(optimalSize)
        
        if (optimalSize !== size) {
          addToast({
            type: 'info',
            message: `Bracket size adjusted to ${optimalSize} to accommodate ${playerCount} players`,
            duration: 4000
          })
        }
      }
    } catch (error: any) {
      console.error('Error loading players:', error)
      setPlayers([])
      addToast({
        type: 'error',
        message: error.message || 'Failed to load players',
        duration: 5000
      })
    } finally {
      setLoadingPlayers(false)
    }
  }

  // Generate bracket with retry mechanism
  const load = async (forceRegenerate = false) => {
    setLoading(true)
    setShowLoadingModal(true)
    setRetryAttempt(0)
    
    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const token = localStorage.getItem('token')
        
        if (tournament && players.length > 0 && token) {
          const action = forceRegenerate ? 'Regenerating brackets...' : (attempt > 0 ? `Retrying generation... (Attempt ${attempt + 1})` : 'Loading brackets...')
          addToast({
            type: 'info',
            message: action,
            duration: 3000
          })
          
          // Use new multiple bracket generation endpoint with force_regenerate parameter
          const squadParam = selectedSquad ? `&squad_id=${selectedSquad.id}` : ''
          const forceParam = forceRegenerate ? '&force_regenerate=true' : ''
          const url = API(`/api/v1/brackets/generate-multiple?tournament_id=${tournament.id}${squadParam}${forceParam}`)
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('Session expired. Please log in again.')
            } else if (response.status === 404) {
              throw new Error('Tournament not found')
            } else {
              const errorData = await response.json().catch(() => null)
              throw new Error(errorData?.detail || `Failed to generate brackets: ${response.status}`)
            }
          }
          
          const data = await response.json()
          setPreview({
            size: data.bracket_size,
            rounds: [], // Will be populated by the multiple brackets
            multiple_brackets: data, // Store full bracket data
            tournament_info: {
              name: data.tournament_name,
              id: data.tournament_id
            }
          })
          
          const isLoaded = data.loaded_from_database
          const isGenerated = data.generated_new
          
          let successMessage = 'Brackets ready!'
          if (isLoaded && !forceRegenerate) {
            successMessage = `Existing brackets loaded! ${data.summary?.total_scratch_entries || 0} scratch + ${data.summary?.total_handicap_entries || 0} handicap entries`
          } else if (isGenerated || forceRegenerate) {
            successMessage = `Brackets ${forceRegenerate ? 'regenerated' : 'generated'} successfully! ${data.summary?.total_scratch_entries || 0} scratch + ${data.summary?.total_handicap_entries || 0} handicap entries`
          }
          
          addToast({
            type: 'success',
            message: successMessage,
            duration: 5000
          })
        } else {
          addToast({
            type: 'info',
            message: attempt > 0 ? `Retrying preview generation... (Attempt ${attempt + 1})` : 'Generating preview brackets...',
            duration: 2000
          })
        
        // Fallback to simple preview for testing
        const url = API(`/api/v1/brackets/preview?bracket_size=${size}`)
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Failed to generate preview: ${response.status}`)
        }
        
        const data = await response.json()
        
        // Enhance with real player data if available
        if (players.length > 0) {
          const enhancedPreview = enhancePreviewWithPlayers(data, players)
          setPreview(enhancedPreview)
        } else {
          setPreview(data)
        }
        
        addToast({
          type: 'success',
          message: 'Preview brackets generated',
          duration: 3000
        })
      }
    } catch (error: any) {
      console.error('Error generating brackets (attempt', attempt + 1, '):', error)
      
      // Retry logic - attempt up to 3 times
      if (attempt < 2 && !error.message.includes('Session expired') && !error.message.includes('not found')) {
        setRetryAttempt(attempt + 1)
        addToast({
          type: 'warning', 
          message: `Generation failed, retrying... (${attempt + 2}/3)`,
          duration: 3000
        })
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
        return attemptGeneration(attempt + 1)
      } else {
        // All retries exhausted or non-retryable error
        setPreview(null)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        addToast({
          type: 'error',
          message: `Failed to generate brackets after ${attempt + 1} attempts: ${errorMessage}`,
          duration: 8000
        })
        throw error
      }
    }
  }

  try {
    await attemptGeneration(0)
  } catch (e) {
    // This catch handles any remaining errors after all retries
    console.error('Final error after all attempts:', e)
  } finally {
      setLoading(false)
      
      // Ensure minimum 10 seconds duration
      const elapsed = Date.now() - (generationStartTime || Date.now())
      const remainingTime = Math.max(0, 10000 - elapsed)
      
      if (remainingTime > 0) {
        // Still need to wait - let progress continue and close after minimum time
        setTimeout(() => {
          setGenerationProgress(100)
          setTimeout(() => {
            setShowLoadingModal(false)
            setGenerationProgress(0)
            setGenerationStartTime(null)
          }, 500)
        }, remainingTime)
      } else {
        // 10 seconds already passed - close immediately
        setGenerationProgress(100)
        setTimeout(() => {
          setShowLoadingModal(false)
          setGenerationProgress(0)
          setGenerationStartTime(null)
        }, 500)
      }
    }
  }

  // Enhance bracket preview with real player data
  const enhancePreviewWithPlayers = (preview: Preview, playerList: any[]): Preview => {
    if (!preview || !playerList.length) return preview

    // Sort players by average/ranking for seeding
    const sortedPlayers = [...playerList].sort((a, b) => (b.average || 0) - (a.average || 0))
    
    const enhanced = { ...preview }
    
    // Assign real players to first round matches
    if (enhanced.rounds.length > 0) {
      enhanced.rounds[0].matches = enhanced.rounds[0].matches.map((match, index) => {
        const player1Index = match.seedA - 1
        const player2Index = match.seedB - 1
        
        return {
          ...match,
          playerA: player1Index < sortedPlayers.length && sortedPlayers[player1Index]
            ? `${sortedPlayers[player1Index].firstName || ''} ${sortedPlayers[player1Index].lastName || ''}`.trim()
            : undefined,
          playerB: player2Index < sortedPlayers.length && sortedPlayers[player2Index]
            ? `${sortedPlayers[player2Index].firstName || ''} ${sortedPlayers[player2Index].lastName || ''}`.trim()
            : undefined,
          status: 'pending' as const
        }
      })
    }
    
    return enhanced
  }

  // Load tournament on mount after hydration
  useEffect(() => {
    if (isHydrated) {
      loadTournament()
    }
  }, [isHydrated])

  // Load players when squad changes
  useEffect(() => {
    if (tournament && isHydrated) {
      loadPlayers(tournament.id, selectedSquad?.id || null)
      
      // Load existing brackets for the new squad
      loadExistingBrackets(tournament.id, selectedSquad?.id || null)
      
      if (selectedSquad) {
        localStorage.setItem(`selectedSquad_${tournament.id}`, selectedSquad.id.toString())
      }
    }
  }, [tournament, selectedSquad, isHydrated])

  // Auto-refresh bracket data every 30 seconds
  useEffect(() => {
    if (!autoRefresh || !tournament || !preview?.multiple_brackets) return
    
    const interval = setInterval(async () => {
      try {
        // Silently refresh bracket data without loading states
        const token = localStorage.getItem('token')
        if (!token) return
        
        // Use load endpoint to get existing brackets from database, not generate new ones
        const squadParam = selectedSquad ? `?squad_id=${selectedSquad.id}` : ''
        const url = API(`/api/v1/brackets/load/${tournament.id}${squadParam}`)
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setPreview({
            size: data.bracket_size,
            rounds: [], // Will be populated by the multiple brackets
            multiple_brackets: data, // Store full bracket data
            tournament_info: {
              name: data.tournament_name,
              id: data.tournament_id
            }
          })
          setLastRefresh(new Date())
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error)
      }
    }, 30000) // 30 seconds
    
    return () => clearInterval(interval)
  }, [autoRefresh, tournament, selectedSquad, preview?.multiple_brackets])

  // Show loading during hydration to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <main className="page-main">
        <div className="page-header">
          <div className="container">
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏆</div>
              <p>Loading brackets...</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  try {
    // Mobile-specific handling
    if (isMobile) {
      return (
        <MobileLayout
          title="Brackets"
          subtitle="Tournament bracket management"
          showBackButton={true}
          onBack={() => window.history.back()}
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <span className="text-lg mr-2">📱</span>
                <h3 className="font-semibold text-amber-800">Mobile Notice</h3>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                For the best bracket viewing and management experience, we recommend using a desktop or tablet with a larger screen.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="px-3 py-2 bg-blue-500 text-white text-sm rounded-md"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => {
                    addToast({ 
                      message: 'Try rotating your device to landscape mode for a better view', 
                      type: 'info', 
                      duration: 4000 
                    })
                  }}
                  className="px-3 py-2 bg-gray-500 text-white text-sm rounded-md"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
            
            {/* Basic tournament info for mobile */}
            {tournament && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Tournament: {tournament.name}</h3>
                {selectedSquad && (
                  <p className="text-sm text-gray-600 mb-2">
                    Squad: {selectedSquad.date} — {selectedSquad.time}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  Players: {players.length} • Bracket Size: {size}
                </p>
              </div>
            )}
            
            {/* Quick actions for mobile */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (players.length > 0) {
                      load(true) // Force regenerate
                    } else {
                      addToast({ message: 'Please load players first', type: 'warning' })
                    }
                  }}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-md disabled:opacity-50"
                >
                  {loading ? '⏳ Generating...' : '🏆 Generate Brackets'}
                </button>
                <button
                  onClick={() => {
                    if (tournament) {
                      loadPlayers(tournament.id, selectedSquad?.id)
                    } else {
                      addToast({ message: 'Please select a tournament first', type: 'warning' })
                    }
                  }}
                  disabled={loadingPlayers}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
                >
                  {loadingPlayers ? '⏳ Loading...' : '👥 Load Players'}
                </button>
              </div>
            </div>
          </div>
        </MobileLayout>
      )
    }

    // Desktop layout continues as before
    return (
      <>
        <main className="page-main">
        
        <div className="page-content">
          <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* No Players Warning */}
            {tournament && players.length === 0 && !loadingPlayers && (
              <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px'
                }}>
                  <p style={{ margin: 0, color: '#92400e' }}>
                    ⚠️ No players found for this tournament/squad. 
                    <a href="/players" style={{ color: '#92400e', textDecoration: 'underline', marginLeft: '4px' }}>
                      Add players first
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!tournament && (
              <div className="card">
                <div className="text-center text-secondary" style={{ padding: '3rem' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏆</div>
                  <h3 style={{ marginBottom: '0.5rem', color: '#374151' }}>
                    No Tournament Loaded
                  </h3>
                  <p>
                    Please load a tournament from the Dashboard first to generate brackets.
                  </p>
                  {isHydrated && (
                    <div style={{ marginTop: '16px' }}>
                      {!localStorage.getItem('token') ? (
                        <p style={{ color: '#dc2626', marginBottom: '12px' }}>
                          🔒 Please log in to access tournaments and generate brackets.
                        </p>
                      ) : (
                        <a href="/dashboard" className="btn btn-primary">
                          📊 Go to Dashboard
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* No bracket generated state */}
            {tournament && !preview && (
              <div className="card">
                <div className="text-center text-secondary" style={{ padding: '3rem' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏆</div>
                  <h3 style={{ marginBottom: '0.5rem', color: '#374151' }}>
                    Ready to Generate Brackets
                  </h3>
                  <p>
                    Configure your bracket settings above and click "Generate Bracket" to create tournament brackets.
                  </p>
                  {players.length > 0 && (
                    <p style={{ marginTop: '0.5rem', color: '#059669', fontWeight: '600' }}>
                      ✅ {players.length} players loaded and ready
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Multiple Brackets Display */}
            {preview && preview.multiple_brackets && (
              <div style={{ marginBottom: '24px' }}>
                {/* Summary Card */}
                <div className="card" style={{ marginBottom: '20px' }}>
                  <h3 style={{ marginBottom: '16px' }}>
                    🏆 {preview.tournament_info?.name || 'Tournament'} Brackets
                  </h3>
                  <div className="bracket-summary-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ 
                      padding: '16px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      border: '1px solid #0ea5e9'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#0369a1' }}>Scratch Brackets</h4>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0369a1' }}>
                        {preview.multiple_brackets.summary.scratch_brackets_count}
                      </p>
                      <small style={{ color: '#0369a1' }}>
                        {preview.multiple_brackets.summary.scratch_placed_entries} of {preview.multiple_brackets.summary.total_scratch_entries} entries placed
                      </small>
                      {preview.multiple_brackets.summary.scratch_refund_entries > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>
                          {preview.multiple_brackets.summary.scratch_refund_entries} entries need refund
                        </div>
                      )}
                    </div>
                    
                    <div style={{ 
                      padding: '16px',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #10b981'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#059669' }}>Handicap Brackets</h4>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                        {preview.multiple_brackets.summary.handicap_brackets_count}
                      </p>
                      <small style={{ color: '#059669' }}>
                        {preview.multiple_brackets.summary.handicap_placed_entries} of {preview.multiple_brackets.summary.total_handicap_entries} entries placed
                      </small>
                      {preview.multiple_brackets.summary.handicap_refund_entries > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>
                          {preview.multiple_brackets.summary.handicap_refund_entries} entries need refund
                        </div>
                      )}
                    </div>
                    
                    {(() => {
                      // Calculate overall tournament progress
                      const allBrackets = [
                        ...(preview.multiple_brackets.scratch_brackets || []),
                        ...(preview.multiple_brackets.handicap_brackets || [])
                      ]
                      
                      const totalMatches = allBrackets.reduce((sum, bracket) => 
                        sum + (bracket.rounds.reduce((roundSum: number, round: any) => roundSum + (round?.matches?.length || 0), 0)), 0)
                      const completedMatches = allBrackets.reduce((sum, bracket) => 
                        sum + (bracket.rounds.reduce((roundSum: number, round: any) => roundSum + (round?.matches?.filter((m: any) => m.status === 'completed')?.length || 0), 0)), 0)
                      const inPlayMatches = allBrackets.reduce((sum, bracket) => 
                        sum + (bracket.rounds.reduce((roundSum: number, round: any) => roundSum + (round?.matches?.filter((m: any) => (m.scoreA || m.scoreB) && m.status !== 'completed')?.length || 0), 0)), 0)
                      
                      const overallProgress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0
                      
                      return (
                        <div style={{ 
                          padding: '16px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #8b5cf6'
                        }}>
                          <h4 style={{ margin: '0 0 8px 0', color: '#7c3aed' }}>Tournament Progress</h4>
                          <p style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold', color: '#7c3aed' }}>
                            {Math.round(overallProgress)}%
                          </p>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '6px'
                          }}>
                            <div style={{
                              width: `${overallProgress}%`,
                              height: '100%',
                              backgroundColor: '#8b5cf6',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{completedMatches}/{totalMatches} matches done</span>
                            {inPlayMatches > 0 && <span style={{ color: '#d97706' }}>🎳 {inPlayMatches} active</span>}
                          </div>
                        </div>
                      )
                    })()}
                    
                    {/* Tournament Analytics */}
                    {(() => {
                      const allBrackets = [
                        ...(preview.multiple_brackets.scratch_brackets || []),
                        ...(preview.multiple_brackets.handicap_brackets || [])
                      ]
                      
                      // Calculate analytics
                      const completedMatches = allBrackets.reduce((matches, bracket) => {
                        return matches.concat(
                          bracket.rounds.reduce((matches: any[], round: any) => 
                            matches.concat(round?.matches?.filter((m: any) => m.status === 'completed' && m.scoreA && m.scoreB) || []), [])
                        )
                      }, [] as any[])
                      
                      if (completedMatches.length === 0) return null
                      
                      const scores = completedMatches.reduce((acc: number[], match: any) => {
                        if (match.scoreA) acc.push(parseInt(match.scoreA))
                        if (match.scoreB) acc.push(parseInt(match.scoreB))
                        return acc
                      }, [] as number[])
                      
                      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
                      const highScore = scores.length > 0 ? Math.max(...scores) : 0
                      const closeMatches = completedMatches.filter((m: any) => 
                        Math.abs(parseInt(m.scoreA) - parseInt(m.scoreB)) <= 10
                      ).length
                      
                      return (
                        <div style={{ 
                          padding: '16px',
                          backgroundColor: '#fef7ff',
                          borderRadius: '8px',
                          border: '1px solid #d946ef'
                        }}>
                          <h4 style={{ margin: '0 0 12px 0', color: '#a21caf' }}>Match Analytics</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a21caf' }}>
                                {avgScore}
                              </div>
                              <div style={{ fontSize: '11px', color: '#92400e' }}>Average Score</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a21caf' }}>
                                {highScore}
                              </div>
                              <div style={{ fontSize: '11px', color: '#92400e' }}>High Score</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a21caf' }}>
                                {closeMatches}
                              </div>
                              <div style={{ fontSize: '11px', color: '#92400e' }}>Close Matches (≤10 pins)</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a21caf' }}>
                                {completedMatches.length}
                              </div>
                              <div style={{ fontSize: '11px', color: '#92400e' }}>Games Completed</div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Bracket Type and Round Navigation */}
                <div className="card" style={{ marginBottom: '20px' }}>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    {/* Bracket Type Selector */}
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '8px', 
                        fontWeight: '600', 
                        color: '#374151' 
                      }}>
                        Bracket Type:
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setSelectedBracketType('scratch')}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: selectedBracketType === 'scratch' ? '#0369a1' : '#f9fafb',
                            color: selectedBracketType === 'scratch' ? 'white' : '#374151',
                            border: `2px solid ${selectedBracketType === 'scratch' ? '#0369a1' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          🎯 Scratch ({preview.multiple_brackets.scratch_brackets.length})
                        </button>
                        <button
                          onClick={() => setSelectedBracketType('handicap')}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: selectedBracketType === 'handicap' ? '#059669' : '#f9fafb',
                            color: selectedBracketType === 'handicap' ? 'white' : '#374151',
                            border: `2px solid ${selectedBracketType === 'handicap' ? '#059669' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          🎳 Handicap ({preview.multiple_brackets.handicap_brackets.length})
                        </button>
                      </div>
                    </div>

                    {/* Round Navigation */}
                    {(() => {
                      const currentBrackets = selectedBracketType === 'scratch' 
                        ? preview.multiple_brackets.scratch_brackets 
                        : preview.multiple_brackets.handicap_brackets
                      
                      if (currentBrackets.length === 0) return null
                      
                      const firstBracket = currentBrackets[0]
                      const totalRounds = firstBracket?.rounds?.length || 0
                      
                      if (totalRounds <= 1) return null
                      
                      return (
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontWeight: '600', 
                            color: '#374151' 
                          }}>
                            Tournament Round:
                          </label>
                          <div style={{ 
                            display: 'flex', 
                            gap: '4px', 
                            flexWrap: 'wrap' 
                          }}>
                            {Array.from({ length: totalRounds }, (_, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedRound(index)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: selectedRound === index ? '#7c3aed' : '#f9fafb',
                                  color: selectedRound === index ? 'white' : '#374151',
                                  border: `2px solid ${selectedRound === index ? '#7c3aed' : '#e5e7eb'}`,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {getRoundName(index, totalRounds)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Player Search */}
                <div className="card" style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#374151' 
                  }}>
                    🔍 Find Player in Brackets:
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search for player name..."
                      value={playerSearchQuery}
                      onChange={(e) => {
                        setPlayerSearchQuery(e.target.value)
                        searchForPlayer(e.target.value)
                      }}
                      style={{
                        flex: '1',
                        minWidth: '200px',
                        padding: '10px 12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb'
                      }}
                    />
                    {playerSearchQuery && (
                      <button
                        onClick={() => {
                          setPlayerSearchQuery('')
                          setFilteredBrackets(null)
                        }}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#dc2626'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ef4444'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {filteredBrackets && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#059669', 
                        fontWeight: '600',
                        marginBottom: '8px'
                      }}>
                        Found player in:
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {filteredBrackets.scratch.length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            padding: '6px 12px',
                            backgroundColor: '#dcfce7',
                            border: '1px solid #10b981',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600'
                          }}>
                            🎯 Scratch: {filteredBrackets.scratch.length} bracket{filteredBrackets.scratch.length !== 1 ? 's' : ''}
                          </div>
                        )}
                        {filteredBrackets.handicap.length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            padding: '6px 12px',
                            backgroundColor: '#dcfce7',
                            border: '1px solid #10b981',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600'
                          }}>
                            🎳 Handicap: {filteredBrackets.handicap.length} bracket{filteredBrackets.handicap.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Scratch Brackets */}
                {preview.multiple_brackets.scratch_brackets.length > 0 && selectedBracketType === 'scratch' && (
                  <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px', color: '#0369a1' }}>
                      🎯 Scratch Brackets ({preview.multiple_brackets.scratch_brackets.length})
                    </h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '16px'
                    }}>
                      {preview.multiple_brackets.scratch_brackets.map((bracket: any, index: number) => {
                        const isSelected = selectedBracket?.type === 'scratch' && selectedBracket?.index === index
                        const hasSearchedPlayer = filteredBrackets?.scratch.includes(index)
                        return (
                        <div 
                          key={`scratch-${index}`} 
                          onClick={() => setSelectedBracket({type: 'scratch', index})}
                          style={{
                            border: `2px solid ${
                              isSelected ? '#3b82f6' : 
                              hasSearchedPlayer ? '#10b981' : 
                              '#e5e7eb'
                            }`,
                            borderRadius: '8px',
                            padding: '16px',
                            backgroundColor: 
                              isSelected ? '#f0f9ff' : 
                              hasSearchedPlayer ? '#f0fdf4' : 
                              '#f8fafc',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            boxShadow: hasSearchedPlayer ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#3b82f6'
                              e.currentTarget.style.backgroundColor = '#f8fafc'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#e5e7eb'
                              e.currentTarget.style.backgroundColor = '#f8fafc'
                            }
                          }}
                        >
                          <div style={{ marginBottom: '12px' }}>
                            <h4 style={{ 
                              margin: '0 0 8px 0', 
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {bracket.title}
                              {hasSearchedPlayer && (
                                <span style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}>
                                  🔍 Player Found
                                </span>
                              )}
                            </h4>
                            {(() => {
                              const currentRound = bracket.rounds[selectedRound] || bracket.rounds[0]
                              const totalMatches = currentRound?.matches.length || 0
                              const completedMatches = currentRound?.matches.filter((m: any) => m.status === 'completed').length || 0
                              const inPlayMatches = currentRound?.matches.filter((m: any) => (m.scoreA || m.scoreB) && m.status !== 'completed').length || 0
                              const progress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0
                              
                              return (
                                <div>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    fontSize: '11px', 
                                    color: '#6b7280',
                                    marginBottom: '4px' 
                                  }}>
                                    <span>{completedMatches}/{totalMatches} complete</span>
                                    <span>{Math.round(progress)}%</span>
                                  </div>
                                  <div style={{
                                    width: '100%',
                                    height: '6px',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '3px',
                                    overflow: 'hidden',
                                    marginBottom: '4px'
                                  }}>
                                    <div style={{
                                      width: `${progress}%`,
                                      height: '100%',
                                      backgroundColor: '#10b981',
                                      transition: 'width 0.3s ease'
                                    }} />
                                  </div>
                                  {inPlayMatches > 0 && (
                                    <div style={{ fontSize: '10px', color: '#d97706', fontWeight: '500' }}>
                                      🎳 {inPlayMatches} match{inPlayMatches !== 1 ? 'es' : ''} in play
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                          <div style={{ fontSize: '14px' }}>
                            {bracket.rounds[selectedRound]?.matches.map((match: any, matchIdx: number) => {
                              const isCompleted = match.status === 'completed'
                              
                              return (
                                <div key={matchIdx} style={{
                                  padding: '12px',
                                  marginBottom: '8px',
                                  backgroundColor: '#ffffff',
                                  borderRadius: '8px',
                                  border: `2px solid ${isCompleted ? '#10b981' : '#e5e7eb'}`,
                                  boxShadow: isCompleted ? '0 2px 4px rgba(16, 185, 129, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)'
                                }}>
                                  <div style={{ 
                                    fontSize: '12px', 
                                    color: '#6b7280', 
                                    marginBottom: '8px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <span>Match {matchIdx + 1}</span>
                                    <div style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: '600',
                                      backgroundColor: isCompleted ? '#dcfce7' : match.scoreA || match.scoreB ? '#fef3c7' : '#f3f4f6',
                                      color: isCompleted ? '#059669' : match.scoreA || match.scoreB ? '#d97706' : '#6b7280'
                                    }}>
                                      {isCompleted ? '✓ FINAL' : match.scoreA || match.scoreB ? '🎳 IN PLAY' : '⏳ PENDING'}
                                    </div>
                                  </div>
                                  
                                  {/* Player A */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    marginBottom: '4px',
                                    backgroundColor: match.winner === 'A' ? '#dcfce7' : '#f9fafb',
                                    border: `1px solid ${match.winner === 'A' ? '#10b981' : '#e5e7eb'}`,
                                    borderRadius: '4px'
                                  }}>
                                    <span style={{ fontWeight: match.winner === 'A' ? '600' : '400' }}>
                                      {match.playerA}
                                    </span>
                                    <span style={{ 
                                      fontWeight: '600',
                                      color: match.winner === 'A' ? '#059669' : '#6b7280'
                                    }}>
                                      {match.scoreA || '-'}
                                    </span>
                                  </div>
                                  
                                  {/* Player B */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    backgroundColor: match.winner === 'B' ? '#dcfce7' : '#f9fafb',
                                    border: `1px solid ${match.winner === 'B' ? '#10b981' : '#e5e7eb'}`,
                                    borderRadius: '4px'
                                  }}>
                                    <span style={{ fontWeight: match.winner === 'B' ? '600' : '400' }}>
                                      {match.playerB}
                                    </span>
                                    <span style={{ 
                                      fontWeight: '600',
                                      color: match.winner === 'B' ? '#059669' : '#6b7280'
                                    }}>
                                      {match.scoreB || '-'}
                                    </span>
                                  </div>
                                  
                                  {/* Winner Status */}
                                  {isCompleted && match.winner && (
                                    <div style={{
                                      marginTop: '8px',
                                      padding: '4px 8px',
                                      backgroundColor: '#dcfce7',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: '#059669',
                                      textAlign: 'center'
                                    }}>
                                      Winner: {match.winner === 'A' ? match.playerA : match.playerB}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Handicap Brackets */}
                {preview.multiple_brackets.handicap_brackets.length > 0 && selectedBracketType === 'handicap' && (
                  <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px', color: '#059669' }}>
                      🎳 Handicap Brackets ({preview.multiple_brackets.handicap_brackets.length})
                    </h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '16px'
                    }}>
                      {preview.multiple_brackets.handicap_brackets.map((bracket: any, index: number) => {
                        const isSelected = selectedBracket?.type === 'handicap' && selectedBracket?.index === index
                        const hasSearchedPlayer = filteredBrackets?.handicap.includes(index)
                        return (
                        <div 
                          key={`handicap-${index}`} 
                          onClick={() => setSelectedBracket({type: 'handicap', index})}
                          style={{
                            border: `2px solid ${
                              isSelected ? '#3b82f6' : 
                              hasSearchedPlayer ? '#10b981' : 
                              '#e5e7eb'
                            }`,
                            borderRadius: '8px',
                            padding: '16px',
                            backgroundColor: 
                              isSelected ? '#f0f9ff' : 
                              hasSearchedPlayer ? '#f0fdf4' : 
                              '#f8fafc',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            boxShadow: hasSearchedPlayer ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#3b82f6'
                              e.currentTarget.style.backgroundColor = '#f8fafc'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#e5e7eb'
                              e.currentTarget.style.backgroundColor = '#f8fafc'
                            }
                          }}
                        >
                          <div style={{ marginBottom: '12px' }}>
                            <h4 style={{ 
                              margin: '0 0 8px 0', 
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {bracket.title}
                              {hasSearchedPlayer && (
                                <span style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}>
                                  🔍 Player Found
                                </span>
                              )}
                            </h4>
                            {(() => {
                              const currentRound = bracket.rounds[selectedRound] || bracket.rounds[0]
                              const totalMatches = currentRound?.matches.length || 0
                              const completedMatches = currentRound?.matches.filter((m: any) => m.status === 'completed').length || 0
                              const inPlayMatches = currentRound?.matches.filter((m: any) => (m.scoreA || m.scoreB) && m.status !== 'completed').length || 0
                              const progress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0
                              
                              return (
                                <div>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    fontSize: '11px', 
                                    color: '#6b7280',
                                    marginBottom: '4px' 
                                  }}>
                                    <span>{completedMatches}/{totalMatches} complete</span>
                                    <span>{Math.round(progress)}%</span>
                                  </div>
                                  <div style={{
                                    width: '100%',
                                    height: '6px',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '3px',
                                    overflow: 'hidden',
                                    marginBottom: '4px'
                                  }}>
                                    <div style={{
                                      width: `${progress}%`,
                                      height: '100%',
                                      backgroundColor: '#059669',
                                      transition: 'width 0.3s ease'
                                    }} />
                                  </div>
                                  {inPlayMatches > 0 && (
                                    <div style={{ fontSize: '10px', color: '#d97706', fontWeight: '500' }}>
                                      🎳 {inPlayMatches} match{inPlayMatches !== 1 ? 'es' : ''} in play
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                          <div style={{ fontSize: '14px' }}>
                            {bracket.rounds[selectedRound]?.matches.map((match: any, matchIdx: number) => {
                              const isCompleted = match.status === 'completed'
                              
                              return (
                                <div key={matchIdx} style={{
                                  padding: '12px',
                                  marginBottom: '8px',
                                  backgroundColor: '#ffffff',
                                  borderRadius: '8px',
                                  border: `2px solid ${isCompleted ? '#10b981' : '#e5e7eb'}`,
                                  boxShadow: isCompleted ? '0 2px 4px rgba(16, 185, 129, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)'
                                }}>
                                  <div style={{ 
                                    fontSize: '12px', 
                                    color: '#6b7280', 
                                    marginBottom: '8px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <span>Match {matchIdx + 1}</span>
                                    <div style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: '600',
                                      backgroundColor: isCompleted ? '#dcfce7' : match.scoreA || match.scoreB ? '#fef3c7' : '#f3f4f6',
                                      color: isCompleted ? '#059669' : match.scoreA || match.scoreB ? '#d97706' : '#6b7280'
                                    }}>
                                      {isCompleted ? '✓ FINAL' : match.scoreA || match.scoreB ? '🎳 IN PLAY' : '⏳ PENDING'}
                                    </div>
                                  </div>
                                  
                                  {/* Player A */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    marginBottom: '4px',
                                    backgroundColor: match.winner === 'A' ? '#dcfce7' : '#f9fafb',
                                    border: `1px solid ${match.winner === 'A' ? '#10b981' : '#e5e7eb'}`,
                                    borderRadius: '4px'
                                  }}>
                                    <span style={{ fontWeight: match.winner === 'A' ? '600' : '400' }}>
                                      {match.playerA}
                                    </span>
                                    <span style={{ 
                                      fontWeight: '600',
                                      color: match.winner === 'A' ? '#059669' : '#6b7280'
                                    }}>
                                      {match.scoreA || '-'}
                                    </span>
                                  </div>
                                  
                                  {/* Player B */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    backgroundColor: match.winner === 'B' ? '#dcfce7' : '#f9fafb',
                                    border: `1px solid ${match.winner === 'B' ? '#10b981' : '#e5e7eb'}`,
                                    borderRadius: '4px'
                                  }}>
                                    <span style={{ fontWeight: match.winner === 'B' ? '600' : '400' }}>
                                      {match.playerB}
                                    </span>
                                    <span style={{ 
                                      fontWeight: '600',
                                      color: match.winner === 'B' ? '#059669' : '#6b7280'
                                    }}>
                                      {match.scoreB || '-'}
                                    </span>
                                  </div>
                                  
                                  {/* Winner Status */}
                                  {isCompleted && match.winner && (
                                    <div style={{
                                      marginTop: '8px',
                                      padding: '4px 8px',
                                      backgroundColor: '#dcfce7',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: '#059669',
                                      textAlign: 'center'
                                    }}>
                                      Winner: {match.winner === 'A' ? match.playerA : match.playerB}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Table View - Mobile Optimized */}
            {preview && !preview.multiple_brackets && viewMode === 'table' && (
              <div className="card">
                {/* Mobile Scroll Hint */}
                <div className="mobile-only" style={{
                  backgroundColor: '#e0f2fe',
                  border: '1px solid #0ea5e9',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  color: '#0c4a6e',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  📱 <span>Swipe horizontally to view all match details</span>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>
                    {tournament?.name || 'Tournament'} — {bracketType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Bracket
                  </h3>
                  <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                    {preview.size} bracket size • {players.length} registered players
                    {selectedSquad && ` • Squad: ${selectedSquad.date} ${selectedSquad.time}`}
                  </p>
                </div>
                
                {preview.rounds.map((round, roundIndex) => (
                  <div key={roundIndex} style={{ marginBottom: '24px' }}>
                    <h4 style={{ 
                      marginBottom: '12px',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      paddingBottom: '8px',
                      fontSize: 'clamp(1rem, 3vw, 1.2rem)'
                    }}>
                      {round.name}
                    </h4>
                    
                    {/* Mobile-optimized table container */}
                    <div style={{
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <Table variant="striped" hoverable={true}>
                        <TableHeader>
                          <TableRow>
                            <TableCell header style={{ minWidth: '60px' }}>Match</TableCell>
                            <TableCell header style={{ minWidth: '120px' }}>Player A</TableCell>
                            <TableCell header align="center" style={{ minWidth: '70px' }}>Score A</TableCell>
                            <TableCell header style={{ minWidth: '120px' }}>Player B</TableCell>
                            <TableCell header align="center" style={{ minWidth: '70px' }}>Score B</TableCell>
                            <TableCell header style={{ minWidth: '100px' }}>Status</TableCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {round.matches.map((match, matchIndex) => (
                            <TableRow 
                              key={matchIndex}
                              onClick={() => setSelectedMatch({bracket_id: 'main', round: roundIndex, match: matchIndex})}
                            >
                              <TableCell>
                                <span style={{ fontWeight: '600', color: colors.text.secondary }}>
                                  #{matchIndex + 1}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span style={{ 
                                  fontWeight: match.winner === 'A' ? '700' : '500',
                                  color: match.winner === 'A' ? colors.success : colors.text.primary
                                }}>
                                  {match.winner === 'A' && '👑 '}
                                  {match.playerA || (match.playerA === null ? 'BYE' : `Seed ${match.seedA}`)}
                                </span>
                              </TableCell>
                              <TableCell align="center">
                                <span style={{ 
                                  fontWeight: '700',
                                  color: match.winner === 'A' ? colors.success : colors.text.secondary
                                }}>
                                  {match.scoreA ?? '-'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span style={{ 
                                  fontWeight: match.winner === 'B' ? '700' : '500',
                                  color: match.winner === 'B' ? colors.success : colors.text.primary
                                }}>
                                  {match.winner === 'B' && '👑 '}
                                  {match.playerB || (match.playerB === null ? 'BYE' : `Seed ${match.seedB}`)}
                                </span>
                              </TableCell>
                              <TableCell align="center">
                                <span style={{ 
                                  fontWeight: '700',
                                  color: match.winner === 'B' ? colors.success : colors.text.secondary
                                }}>
                                  {match.scoreB ?? '-'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '16px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  display: 'inline-block',
                                  minWidth: '80px',
                                  textAlign: 'center',
                                  backgroundColor: match.status === 'completed' ? colors.backgrounds.success :
                                                 match.status === 'in_progress' ? colors.backgrounds.warning :
                                                 colors.gray[100],
                                  color: match.status === 'completed' ? colors.success :
                                         match.status === 'in_progress' ? colors.warning :
                                         colors.text.secondary
                                }}>
                                  {match.status === 'completed' ? '✅ Done' : 
                                   match.status === 'in_progress' ? '🎳 Playing' : '⏳ Waiting'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Match Details Panel - Mobile Optimized */}
            {selectedMatch && preview && (
              <>
                {/* Modal Overlay */}
                <div 
                  className="modal-overlay"
                  onClick={() => setSelectedMatch(null)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 999,
                  }}
                />
                
                {/* Match Details Modal */}
                <div className="card" style={{ 
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 'min(90vw, 400px)',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ margin: 0 }}>Match Details</h3>
                  <button 
                    onClick={() => setSelectedMatch(null)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      fontSize: '20px', 
                      cursor: 'pointer',
                      color: '#6b7280'
                    }}
                  >
                    ×
                  </button>
                </div>
                
                {(() => {
                  const match = preview.rounds[selectedMatch.round]?.matches[selectedMatch.match]
                  if (!match) return null
                  
                  return (
                    <div>
                      <p style={{ marginBottom: '16px', color: '#6b7280' }}>
                        {preview.rounds[selectedMatch.round].name} - Match {selectedMatch.match + 1}
                      </p>
                      
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong>{match.playerA || (match.playerA === null ? 'BYE' : `Seed ${match.seedA}`)}</strong>
                          <span>{match.scoreA ?? 'TBD'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{match.playerB || (match.playerB === null ? 'BYE' : `Seed ${match.seedB}`)}</strong>
                          <span>{match.scoreB ?? 'TBD'}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" style={{ flex: 1 }}>
                          Enter Results
                        </button>
                        <button className="btn btn-secondary">
                          View Details
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
              </>
            )}

          </div>
        </div>

        {/* Loading Modal */}
        {showLoadingModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              maxWidth: '90vw',
              width: '400px',
              textAlign: 'center'
            }}>
              {/* Bowling Ball Animation */}
              <div style={{ 
                width: '100%', 
                height: '120px', 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                {/* Bowling ball like the login screen */}
                <div
                  style={{
                    position: 'absolute',
                    width: '50px',
                    height: '50px',
                    background: `
                      radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 40%),
                      radial-gradient(ellipse at 70% 70%, rgba(0,0,0,0.3) 0%, transparent 40%),
                      linear-gradient(135deg, #f0a500 0%, #ff9800 50%, #ff6f00 100%)
                    `,
                    borderRadius: '50%',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: 'ballSpinInPlace 2s linear infinite',
                    boxShadow: `
                      0 6px 12px rgba(240, 165, 0, 0.4),
                      inset 2px 2px 6px rgba(255, 255, 255, 0.3),
                      inset -2px -2px 6px rgba(0, 0, 0, 0.2)
                    `
                  }}
                >
                  {/* Finger holes - 3 holes like real bowling balls */}
                  <div style={{
                    position: 'absolute',
                    width: '6px',
                    height: '6px',
                    background: `
                      radial-gradient(circle, #1a1a1a 0%, #333 100%)
                    `,
                    borderRadius: '50%',
                    top: '12px',
                    left: '16px',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.8)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    width: '6px',
                    height: '6px',
                    background: `
                      radial-gradient(circle, #1a1a1a 0%, #333 100%)
                    `,
                    borderRadius: '50%',
                    top: '12px',
                    left: '28px',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.8)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    width: '6px',
                    height: '6px',
                    background: `
                      radial-gradient(circle, #1a1a1a 0%, #333 100%)
                    `,
                    borderRadius: '50%',
                    top: '24px',
                    left: '22px',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.8)'
                  }} />
                  
                  {/* Ball highlight for 3D effect */}
                  <div style={{
                    position: 'absolute',
                    width: '16px',
                    height: '12px',
                    background: `
                      radial-gradient(ellipse at center, 
                        rgba(255, 255, 255, 0.6) 0%, 
                        transparent 70%)
                    `,
                    borderRadius: '50%',
                    top: '8px',
                    left: '12px',
                    transform: 'rotate(-20deg)',
                    animation: 'ballHighlight 2s ease-in-out infinite'
                  }} />
                </div>
              </div>

              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>Generating Tournament Brackets</h2>
              
              {/* Tournament details */}
              {preview?.tournament_info && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  <strong>{preview.tournament_info.name}</strong>
                  {selectedSquad && <span style={{color: '#6b7280'}}> • Squad {selectedSquad.name}</span>}
                </div>
              )}
              
              {/* Live stats */}
              {generationStats && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  backgroundColor: '#fef7ed',
                  border: '1px solid #fed7aa', 
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.75rem'
                }}>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontWeight: 'bold', color: '#ea580c'}}>{generationStats.players}</div>
                    <div style={{color: '#9a3412'}}>Players</div>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontWeight: 'bold', color: '#ea580c'}}>{generationStats.matches}</div>
                    <div style={{color: '#9a3412'}}>Matches</div>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontWeight: 'bold', color: '#ea580c'}}>{generationStats.rounds}</div>
                    <div style={{color: '#9a3412'}}>Rounds</div>
                  </div>
                </div>
              )}
              
              {/* Dynamic message */}
              <p style={{
                color: '#6b7280',
                marginBottom: '1rem',
                minHeight: '24px',
                transition: 'opacity 0.3s ease'
              }}>{loadingMessages[currentMessage]}</p>
              
              {/* Progress bar */}
              <div style={{
                width: '100%',
                height: '6px',
                backgroundColor: '#e5e7eb',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '1rem'
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#f0a500',
                  borderRadius: '3px',
                  transition: 'width 0.8s ease-out',
                  width: `${generationProgress}%`,
                  background: 'linear-gradient(90deg, #f0a500 0%, #ff9800 50%, #ff6f00 100%)'
                }} />
              </div>
              
              {/* Estimated time */}
              <p style={{
                color: '#9ca3af',
                fontSize: '0.875rem',
                marginBottom: '0.5rem'
              }}>This usually takes 10-15 seconds</p>
              
              {/* Connection status and retry info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                color: '#6b7280',
                marginBottom: '1rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: connectionStatus === 'fast' ? '#10b981' : 
                                   connectionStatus === 'normal' ? '#f59e0b' : '#ef4444'
                  }} />
                  Connection: {connectionStatus}
                </div>
                {retryAttempt > 0 && (
                  <div>Attempt {retryAttempt + 1}/3</div>
                )}
              </div>
              
              {/* Cancel button */}
              <button
                onClick={() => {
                  setShowLoadingModal(false)
                  setLoading(false)
                  setGenerationProgress(0)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '1rem'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                  e.currentTarget.style.borderColor = '#9ca3af'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
              >
                Cancel Generation
              </button>
              
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'center'
              }}>
                {[0, 0.3, 0.6].map((delay, i) => (
                  <div
                    key={i}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      animation: `pulse 2.5s ease-in-out ${delay}s infinite`
                    }}
                  />
                ))}
              </div>
            </div>

            <style jsx>{`
              @keyframes pulse {
                0%, 80%, 100% {
                  transform: scale(0.8);
                  opacity: 0.5;
                }
                40% {
                  transform: scale(1);
                  opacity: 1;
                }
              }
              
              @keyframes ballSpinInPlace {
                0% {
                  transform: translate(-50%, -50%) rotate(0deg);
                }
                100% {
                  transform: translate(-50%, -50%) rotate(360deg);
                }
              }
              
              @keyframes ballHighlight {
                0%, 100% { 
                  opacity: 0.6; 
                  transform: rotate(-20deg) scale(1); 
                }
                50% { 
                  opacity: 0.8; 
                  transform: rotate(-15deg) scale(1.1); 
                }
              }
            `}</style>
          </div>
        )}
      </main>
      </>
    )
  } catch (error) {
    console.error("Error rendering BracketsPage:", error);
    return (
      <div className="container text-center" style={{ padding: '3rem' }}>
        <h1 className="text-error">Error Loading Brackets Page</h1>
        <p className="text-secondary">There was an error rendering this page. Check the console for details.</p>
        <pre className="text-xs text-error">{String(error)}</pre>
      </div>
    )
  }
}
