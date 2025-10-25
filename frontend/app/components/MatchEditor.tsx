import React, { useState } from 'react'

import { useBrackets } from '../hooks/useBrackets'
import { useToast } from './Toast'
import { Button } from './UI'

// Score update and match editing component using standardized hooks

interface MatchEditorProps {
  selectedMatch: {
    bracket_id: string
    round: number
    match: number
  } | null
  tournamentId?: number
  squadId?: number | null
  onMatchUpdate?: () => void
  onClose?: () => void
}

export function MatchEditor({ 
  selectedMatch, 
  tournamentId,
  squadId,
  onMatchUpdate,
  onClose 
}: MatchEditorProps) {
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const { updateMatchScore, loading } = useBrackets()
  const { addToast } = useToast()

  if (!selectedMatch) return null

  const handleUpdateScore = async () => {
    if (!tournamentId) {
      addToast({
        type: 'error',
        message: 'No tournament selected',
        duration: 4000
      })
      return
    }

    const scoreANum = parseInt(scoreA)
    const scoreBNum = parseInt(scoreB)

    if (isNaN(scoreANum) || isNaN(scoreBNum)) {
      addToast({
        type: 'error',
        message: 'Please enter valid scores',
        duration: 4000
      })
      return
    }

    if (scoreANum < 0 || scoreBNum < 0) {
      addToast({
        type: 'error',
        message: 'Scores cannot be negative',
        duration: 4000
      })
      return
    }

    try {
      await updateMatchScore(tournamentId, {
        bracket_id: selectedMatch.bracket_id,
        round_index: selectedMatch.round,
        match_index: selectedMatch.match,
        score_a: scoreANum,
        score_b: scoreBNum
      }, squadId || undefined)

      // Reset form
      setScoreA('')
      setScoreB('')
      
      // Notify parent component
      onMatchUpdate?.()
      onClose?.()

    } catch (error) {
      // Error handling is done in the hook
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          marginBottom: '1.5rem',
          color: '#111827'
        }}>
          Update Match Score
        </h3>

        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          <div><strong>Bracket:</strong> {selectedMatch.bracket_id}</div>
          <div><strong>Round:</strong> {selectedMatch.round + 1}</div>
          <div><strong>Match:</strong> {selectedMatch.match + 1}</div>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Player A Score
            </label>
            <input
              type="number"
              value={scoreA}
              onChange={(changeEvent) => setScoreA(changeEvent.target.value)}
              min="0"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="0"
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Player B Score
            </label>
            <input
              type="number"
              value={scoreB}
              onChange={(changeEvent) => setScoreB(changeEvent.target.value)}
              min="0"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="0"
            />
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          
          <Button
            variant="primary"
            onClick={handleUpdateScore}
            disabled={loading || !scoreA || !scoreB}
          >
            {loading ? 'Updating...' : 'Update Score'}
          </Button>
        </div>
      </div>
    </div>
  )
}

