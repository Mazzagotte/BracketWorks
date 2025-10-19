// Main bracket container component - simplified version using standardized hooks
'use client'
import React, { useEffect, useState } from 'react'
import { usePageHeader } from '../lib/header-context'
import { useTournaments, useSquads, usePlayers } from '../hooks/useTournaments'
import { useBrackets } from '../hooks/useBrackets'
import { BracketRenderer } from '../components/BracketRenderer'
import { BracketControls, BracketState } from '../components/BracketControls'
import { MatchEditor } from '../components/MatchEditor'
import { PageContainer, ContentWrapper } from '../components/UI'
import { useToast } from '../components/Toast'

export default function BracketsPage() {
  // State for selected entities
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
  const [selectedSquad, setSelectedSquad] = useState<any>(null)
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
      console.error('Error loading saved tournament:', error)
    }
  }

  // Handle tournament selection
  const handleTournamentSelect = (tournament: any) => {
    setSelectedTournament(tournament)
    if (tournament) {
      localStorage.setItem('selectedTournament', JSON.stringify(tournament))
      // Load saved brackets if they exist
      loadSavedBrackets(tournament.id, selectedSquad?.id)
    }
  }

  // Handle squad selection
  const handleSquadSelect = (squad: any) => {
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
  const controlsState = {
    size: bracketSize,
    preview,
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
            preview={preview}
            selectedBracketType={selectedBracketType}
            selectedBracket={selectedBracket}
            selectedRound={selectedRound}
            onMatchSelect={handleMatchSelect}
            isMobile={isMobile}
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
  )
}