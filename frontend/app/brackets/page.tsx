'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useBrackets } from '../hooks/useBrackets'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { useToast } from '../components/Toast'
import BracketGenerationModal from '../components/BracketGenerationModal'
import '../styles/bowling-animations.css'

export default function BracketsPage() {
  // State for modal and generation
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bracketGenerationPromise, setBracketGenerationPromise] = useState<Promise<any> | null>(null)
  
  // Hooks for data fetching
  const { generateTournamentBrackets } = useBrackets()
  const { tournaments, fetchTournaments } = useTournaments()
  const { squads, fetchSquads } = useSquads()
  const { addToast } = useToast()
  
  // State for selected entities
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
  const [selectedSquad, setSelectedSquad] = useState<any>(null)

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments()
  }, [])

  // Auto-select tournament from localStorage
  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedTournamentId = localStorage.getItem('lastTournamentId')
      console.log('Looking for tournament, storedId:', storedTournamentId, 'available tournaments:', tournaments.length)
      if (storedTournamentId) {
        const storedTournament = tournaments.find(t => t.id === parseInt(storedTournamentId))
        if (storedTournament) {
          console.log('Selected tournament:', storedTournament)
          setSelectedTournament(storedTournament)
          fetchSquads(storedTournament.id)
        }
      }
    }
  }, [tournaments, selectedTournament])

  // Auto-select squad from localStorage or use first squad
  useEffect(() => {
    if (squads.length > 0 && !selectedSquad) {
      const storedSquadId = localStorage.getItem('selected_squad_id')
      console.log('Looking for squad, storedId:', storedSquadId, 'available squads:', squads.length)
      let squadToSelect = null
      
      if (storedSquadId) {
        squadToSelect = squads.find(s => s.id === parseInt(storedSquadId))
      }
      
      // If no stored squad or stored squad not found, select first squad
      if (!squadToSelect) {
        squadToSelect = squads[0]
        console.log('No stored squad, selecting first squad:', squadToSelect)
      } else {
        console.log('Selected stored squad:', squadToSelect)
      }
      
      if (squadToSelect) {
        setSelectedSquad(squadToSelect)
      }
    }
  }, [squads, selectedSquad])

  // Handle generate brackets action
  const handleGenerateBrackets = useCallback(() => {
    console.log('Generate Brackets button clicked')
    console.log('Selected Tournament:', selectedTournament)
    console.log('Selected Squad:', selectedSquad)
    
    // Validation: Check for tournament selection
    if (!selectedTournament) {
      addToast({
        type: 'error',
        message: 'Please select a tournament first',
        duration: 5000
      })
      return
    }

    // Validation: Check for squad selection
    if (!selectedSquad) {
      addToast({
        type: 'error',
        message: 'Please select a squad first',
        duration: 5000
      })
      return
    }

    console.log('Validation passed, starting generation...')
    // Start bracket generation
    startBracketGeneration()
  }, [selectedTournament, selectedSquad, addToast])

  // Start the bracket generation process
  const startBracketGeneration = useCallback(() => {
    console.log('startBracketGeneration called')
    
    // Create the promise for bracket generation
    const generationPromise = generateTournamentBrackets(
      selectedTournament.id,
      selectedSquad.id,
      8, // Default bracket size
      true // Save to database
    )
      .then((result) => {
        console.log('Bracket generation successful:', result)
        // Success - toast will be shown by modal
        addToast({
          type: 'success',
          message: 'Brackets generated successfully!',
          duration: 5000
        })
        return result
      })
      .catch((error) => {
        // Error - will be handled by modal
        console.error('Bracket generation failed:', error)
        throw error
      })

    console.log('Setting promise and opening modal')
    // Set the promise and open modal
    setBracketGenerationPromise(generationPromise)
    setIsModalOpen(true)
  }, [selectedTournament, selectedSquad, generateTournamentBrackets, addToast])

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false)
    setBracketGenerationPromise(null)
  }

  // Handle regenerate action from modal
  const handleRegenerate = useCallback(() => {
    // Restart the generation process
    startBracketGeneration()
  }, [startBracketGeneration])

  // Memoize the Generate Brackets button to prevent infinite re-renders
  const generateBracketsButton = useMemo(() => (
    <button
      onClick={handleGenerateBrackets}
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
      Generate Brackets
    </button>
  ), [handleGenerateBrackets])

  // Set page header with actions
  usePageHeader({
    title: 'Bracket Management',
    subtitle: 'Create and manage tournament brackets',
    actions: generateBracketsButton
  })

  // Authentication check
  const { isAuthenticated, isInitialized } = useAuth()

  // Check if we have tokens in localStorage
  const hasStoredAuth = typeof window !== 'undefined' && 
    localStorage.getItem('token') && 
    localStorage.getItem('user_id')

  // Wait for auth initialization
  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '200px',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  // Authentication guard
  if (!isAuthenticated && !hasStoredAuth) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div>Please log in to access bracket management</div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {/* Bracket Generation Modal */}
      <BracketGenerationModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onRegenerate={handleRegenerate}
        bracketGenerationPromise={bracketGenerationPromise}
        tournamentName={selectedTournament?.name}
        squadName={selectedSquad ? `${selectedSquad.date} - ${selectedSquad.time}` : undefined}
        playerCount={undefined}
      />

      <div style={{ 
        padding: '2rem',
        fontFamily: 'Inter, sans-serif'
      }}>
        <h1>Brackets Page</h1>
        <p>Bracket content will be built here.</p>
        
        {selectedTournament && (
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Selected Tournament:</strong> {selectedTournament.name}</p>
          </div>
        )}
        
        {selectedSquad && (
          <div style={{ marginTop: '0.5rem' }}>
            <p><strong>Selected Squad:</strong> {selectedSquad.date} - {selectedSquad.time}</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}