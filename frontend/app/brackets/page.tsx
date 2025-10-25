'use client'

import React, { useEffect, useState } from 'react'
import { Tournament, Squad, Player, BracketData, ScoreData, WinnerData, BracketSettings, ToastMessage } from '../lib/types'

import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useTournaments, useSquads, usePlayers } from '../hooks/useTournaments'
import { useBrackets } from '../hooks/useBrackets'
import { BracketRenderer } from '../components/LazyComponents'
import { BracketControls, BracketState } from '../components/BracketControls'
import { MatchEditor } from '../components/MatchEditor'
import { PageContainer, ContentWrapper } from '../components/UI'
import { useToast } from '../components/Toast'
import { logger } from '../lib/logger';

// Main bracket container component - simplified version using standardized hooks

export default function BracketsPage() {
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
          <div style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>🎳</div>
          <div>Loading bracket management...</div>
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
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🔒</div>
          <div>Please log in to access bracket management</div>
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
          <div>Loading bracket management...</div>
        </div>
      </div>
    );
  }

  // State for selected entities
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [bracketSize, setBracketSize] = useState(8)
  const [selectedBracketType, setSelectedBracketType] = useState<'scratch' | 'handicap'>('scratch')
  const [selectedBracket, setSelectedBracket] = useState<{type: 'scratch' | 'handicap', index: number} | null>(null)
  const [selectedRound, setSelectedRound] = useState(0)
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Match editing state
  const [selectedMatch, setSelectedMatch] = useState<{
    bracket_id: string
    round: number
    match: number
  } | null>(null)

  // Use our standardized hooks
  const { tournaments } = useTournaments()
  const { squads, fetchSquads } = useSquads(selectedTournament?.id)
  const { players, fetchPlayers } = usePlayers(selectedTournament?.id, selectedSquad?.id)
  const { 
    preview, 
    loading, 
    generatePreview, 
    generateTournamentBrackets, 
    updateMatchScore,
    loadSavedBrackets 
  } = useBrackets()

  const { addToast } = useToast()

  // Set page header
  usePageHeader({
    title: 'Tournament Brackets',
    subtitle: 'Generate and manage tournament brackets',
  })

  // Hydration and mobile detection
  useEffect(() => {
    setIsHydrated(true)
    loadSavedTournament()
    
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load saved tournament from localStorage
  const loadSavedTournament = () => {
    if (typeof window === 'undefined') return
    
    try {
      const savedTournament = localStorage.getItem('selectedTournament')
      if (savedTournament) {
        const tournament = JSON.parse(savedTournament)
        setSelectedTournament(tournament)
      }
    } catch (error) {
      logger.error('Error loading saved tournament:', error)
    }
  }

  // Handle tournament selection
  const handleTournamentSelect = (tournament: Tournament) => {
    setSelectedTournament(tournament)
    if (tournament) {
      localStorage.setItem('selectedTournament', JSON.stringify(tournament))
      // Load saved brackets if they exist
      loadSavedBrackets(tournament.id, selectedSquad?.id)
    }
  }

  // Handle squad selection
  const handleSquadSelect = (squad: Squad) => {
    setSelectedSquad(squad)
    if (selectedTournament?.id && squad?.id) {
      localStorage.setItem(`selectedSquad_${selectedTournament.id}`, squad.id.toString())
    }
  }

  // Handle match selection for score editing
  const handleMatchSelect = (bracketId: string, round: number, match: number) => {
    setSelectedMatch({ bracket_id: bracketId, round, match })
  }

  // Handle match update completion
  const handleMatchUpdate = async () => {
    // The match was updated, close the editor
    setSelectedMatch(null)
    // The useBrackets hook automatically updates the preview
  }

  // Generate tournament brackets
  const handleGenerateTournament = async () => {
    if (!selectedTournament?.id) {
      addToast({
        type: 'error',
        message: 'No tournament selected',
        duration: 4000
      })
      return
    }

    try {
      await generateTournamentBrackets(
        selectedTournament.id,
        selectedSquad?.id,
        bracketSize,
        true
      )
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  // Handle preview generation
  const handleGeneratePreview = async () => {
    try {
      await generatePreview(bracketSize)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  // Handle match score update
  const handleScoreUpdate = async (
    bracketId: string,
    roundIndex: number,
    matchIndex: number,
    scoreA: number,
    scoreB: number
  ) => {
    if (!selectedTournament?.id) return

    try {
      await updateMatchScore(selectedTournament.id, {
        bracket_id: bracketId,
        round_index: roundIndex,
        match_index: matchIndex,
        score_a: scoreA,
        score_b: scoreB
      }, selectedSquad?.id)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  // Refresh all data
  const refreshData = () => {
    if (selectedTournament?.id) {
      fetchSquads(selectedTournament.id)
      fetchPlayers(selectedTournament.id, selectedSquad?.id)
    }
  }

  // Create simplified state object for controls
  const controlsState: BracketState = {
    size: bracketSize,
    preview: preview ? {
      ...preview,
      id: selectedTournament?.id || 0,
      name: selectedTournament?.name || '',
      players: players || []
    } : null,
    loading,
    tournament: selectedTournament,
    squads,
    selectedSquad,
    players,
    loadingPlayers: false, // Handled by individual hooks now
    selectedBracket,
    selectedRound,
    selectedBracketType,
    playerSearchQuery,
    isHydrated
  }

  return (
    <ErrorBoundary>
      <PageContainer>
      <ContentWrapper>
        {/* Main Controls */}
        <BracketControls
          state={controlsState}
          onSizeChange={setBracketSize}
          onTournamentSelect={handleTournamentSelect}
          onSquadSelect={handleSquadSelect}
          onBracketTypeChange={setSelectedBracketType}
          onPlayerSearch={setPlayerSearchQuery}
          onGeneratePreview={handleGeneratePreview}
          onGenerateTournament={handleGenerateTournament}
          onRefreshData={refreshData}
        />

        {/* Bracket Display */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          minHeight: '400px'
        }}>
          <BracketRenderer
            tournamentPreviewData={preview as any}
            selectedBracketType={selectedBracketType}
            selectedBracketConfiguration={selectedBracket}
            selectedRoundNumber={selectedRound}
            onMatchClick={handleMatchSelect}
            isMobileDisplay={isMobile}
          />
        </div>

        {/* Match Editor Modal */}
        <MatchEditor
          selectedMatch={selectedMatch}
          tournamentId={selectedTournament?.id}
          squadId={selectedSquad?.id}
          onMatchUpdate={handleMatchUpdate}
          onClose={() => setSelectedMatch(null)}
        />
      </ContentWrapper>
    </PageContainer>
    </ErrorBoundary>
  )
}
