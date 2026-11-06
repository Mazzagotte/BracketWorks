'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { BracketTree } from '@bracketworks/ui'
import type { BracketChampionData, BracketMatchData, BracketRoundData } from '@bracketworks/ui'

import type { BracketRound, Match } from '../../lib/types'

interface BracketTreeViewProps {
  rounds: BracketRound[]
  isMobile?: boolean
  searchTerm?: string
  /** Accessible name, for example "Handicap bracket 3 of 6". */
  label?: string
}

/** Round names counted back from the final: Final, Semifinals, Quarterfinals, then Round N. */
function roundTitle(index: number, total: number): string {
  const fromEnd = total - 1 - index
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinals'
  if (fromEnd === 2) return 'Quarterfinals'
  return `Round ${index + 1}`
}

function matchLabel(title: string, matchIndex: number): string {
  if (title === 'Final') return 'Final'
  if (title === 'Semifinals') return `Semifinal ${matchIndex + 1}`
  return `Match ${matchIndex + 1}`
}

function scoreOf(match: Match, side: 'A' | 'B'): number | null {
  const canonical = side === 'A' ? match.scoreA : match.scoreB
  const legacy = side === 'A' ? match.match_score_a : match.match_score_b
  const value = canonical !== undefined ? canonical : legacy
  return typeof value === 'number' ? value : null
}

function cleanName(name?: string | null): string | null {
  if (!name || name === 'TBD') return null
  if (name === 'BYE') return 'Bye'
  return name
}

export function matchesSearch(name: string | null, searchTerm: string): boolean {
  if (!name) return false
  const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return false
  const normalized = name.toLowerCase()
  return terms.every(term => normalized.includes(term))
}

/** BracketWorks bracket data on the shared BracketTree, with click-to-highlight and search. */
function BracketTreeViewComponent({ rounds, isMobile = false, searchTerm = '', label = 'Bracket' }: BracketTreeViewProps) {
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null)

  useEffect(() => {
    if (searchTerm) setHighlightedPlayer(null)
  }, [searchTerm])

  const { treeRounds, champion } = useMemo(() => {
    const isHighlighted = (name: string | null) =>
      searchTerm ? matchesSearch(name, searchTerm) : Boolean(name && name === highlightedPlayer)

    const treeRounds: BracketRoundData[] = rounds.map((round, roundIndex) => {
      const title = roundTitle(roundIndex, rounds.length)
      return {
        title,
        matches: round.matches.map((match, matchIndex): BracketMatchData => {
          const nameA = cleanName(match.playerA)
          const nameB = cleanName(match.playerB)
          const highlightA = isHighlighted(nameA)
          const highlightB = isHighlighted(nameB)
          return {
            id: `${roundIndex}-${matchIndex}`,
            label: matchLabel(title, matchIndex),
            note: match.split_pot ? 'Split pot' : match.both_advance ? 'Tie, both advance' : undefined,
            dimmed: Boolean(searchTerm) && !highlightA && !highlightB,
            players: [
              { name: nameA, score: scoreOf(match, 'A'), winner: match.winner === 'A', highlighted: highlightA },
              { name: nameB, score: scoreOf(match, 'B'), winner: match.winner === 'B', highlighted: highlightB },
            ],
          }
        }),
      }
    })

    const finalMatch = rounds.length > 0 ? rounds[rounds.length - 1]?.matches[0] : undefined
    let champion: BracketChampionData | null = null
    if (finalMatch && (finalMatch.winner === 'A' || finalMatch.winner === 'B')) {
      const winnerSide = finalMatch.winner
      const loserSide = winnerSide === 'A' ? 'B' : 'A'
      const winnerName = cleanName(winnerSide === 'A' ? finalMatch.playerA : finalMatch.playerB)
      const runnerUp = cleanName(loserSide === 'A' ? finalMatch.playerA : finalMatch.playerB)
      const winnerScore = scoreOf(finalMatch, winnerSide)
      const runnerUpScore = scoreOf(finalMatch, loserSide)
      if (winnerName) {
        champion = {
          name: winnerName,
          detail: winnerScore !== null && runnerUpScore !== null ? `Won the final ${winnerScore} to ${runnerUpScore}` : undefined,
          runnerUp: runnerUp ? `Runner-up: ${runnerUp}` : undefined,
        }
      }
    } else if (finalMatch?.split_pot) {
      const names = [cleanName(finalMatch.playerA), cleanName(finalMatch.playerB)].filter(Boolean)
      if (names.length === 2) champion = { name: names.join(' and '), detail: 'Tied the final and split the pot' }
    }

    return { treeRounds, champion }
  }, [rounds, searchTerm, highlightedPlayer])

  if (rounds.length === 0) return null

  return (
    <BracketTree
      label={label}
      rounds={treeRounds}
      champion={champion}
      layout={isMobile ? 'stacked' : 'tree'}
      onPlayerClick={searchTerm ? undefined : name => setHighlightedPlayer(current => (current === name ? null : name))}
    />
  )
}

export const BracketTreeView = React.memo(BracketTreeViewComponent)
export default BracketTreeView
