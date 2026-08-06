import { useCallback, useState } from 'react'
import { BracketPreview } from '../../hooks/useBrackets'
import { Squad, Tournament } from '../../lib/types'
import { logger } from '../../lib/logger'

type AddToast = (args: { type: 'success' | 'error'; message: string; duration: number }) => void

type UseBracketGenerationFlowArgs = {
  selectedTournament: Tournament | null
  selectedSquad: Squad | null
  generateTournamentBrackets: (
    tournamentId: number,
    squadId?: number,
    bracketSize?: number,
    saveToDb?: boolean,
    forceRegenerate?: boolean,
  ) => Promise<BracketPreview>
  addToast: AddToast
  reloadAfterGeneration: () => void
}

type UseBracketGenerationFlowResult = {
  isModalOpen: boolean
  bracketGenerationPromise: Promise<BracketPreview> | null
  handleGenerateBrackets: () => void
  handleModalClose: () => void
  handleRegenerate: () => void
  resetGenerationModalState: () => void
}

export function useBracketGenerationFlow({
  selectedTournament,
  selectedSquad,
  generateTournamentBrackets,
  addToast,
  reloadAfterGeneration,
}: UseBracketGenerationFlowArgs): UseBracketGenerationFlowResult {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bracketGenerationPromise, setBracketGenerationPromise] = useState<Promise<BracketPreview> | null>(null)

  const startBracketGeneration = useCallback(() => {
    if (!selectedTournament || !selectedSquad) return

    const generationPromise = generateTournamentBrackets(
      selectedTournament.id,
      selectedSquad.id,
      8,
      true,
      true,
    )
      .then(result => {
        addToast({
          type: 'success',
          message: 'Brackets generated successfully!',
          duration: 5000,
        })
        return result
      })
      .catch(error => {
        logger.error('Bracket generation failed', { error })
        throw error
      })

    setBracketGenerationPromise(generationPromise)
    setIsModalOpen(true)
  }, [addToast, generateTournamentBrackets, selectedSquad, selectedTournament])

  const handleGenerateBrackets = useCallback(() => {
    if (!selectedTournament) {
      addToast({
        type: 'error',
        message: 'Please select a tournament first',
        duration: 5000,
      })
      return
    }

    if (!selectedSquad) {
      addToast({
        type: 'error',
        message: 'Please select a squad first',
        duration: 5000,
      })
      return
    }

    startBracketGeneration()
  }, [addToast, selectedSquad, selectedTournament, startBracketGeneration])

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setBracketGenerationPromise(null)
    reloadAfterGeneration()
  }, [reloadAfterGeneration])

  const handleRegenerate = useCallback(() => {
    startBracketGeneration()
  }, [startBracketGeneration])

  const resetGenerationModalState = useCallback(() => {
    setIsModalOpen(false)
    setBracketGenerationPromise(null)
  }, [])

  return {
    isModalOpen,
    bracketGenerationPromise,
    handleGenerateBrackets,
    handleModalClose,
    handleRegenerate,
    resetGenerationModalState,
  }
}
