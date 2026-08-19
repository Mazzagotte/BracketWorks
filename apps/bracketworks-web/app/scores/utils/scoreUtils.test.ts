import { describe, expect, it } from 'vitest'
import { validateScore, getScoreInputClass, hasMissingScore, needsReviewScore, getPlayerScoreStatus } from './scoreUtils'
import type { Player } from '../../lib/types'

const makePlayer = (scores?: Partial<Player['scores']>): Player =>
  ({
    id: 1,
    firstName: 'Test',
    lastName: 'Player',
    handicap: 10,
    average: 180,
    lane: 1,
    scores: scores ?? undefined,
  } as unknown as Player)

// ─── validateScore ─────────────────────────────────────────────────────────

describe('validateScore', () => {
  it('accepts undefined (empty cell)', () => {
    expect(validateScore(undefined)).toEqual({ isValid: true, message: '' })
  })

  it('accepts 0', () => {
    expect(validateScore(0)).toEqual({ isValid: true, message: '' })
  })

  it('accepts 300 (perfect game)', () => {
    expect(validateScore(300)).toEqual({ isValid: true, message: '' })
  })

  it('rejects negative score', () => {
    const result = validateScore(-1)
    expect(result.isValid).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it('rejects score above 300', () => {
    const result = validateScore(301)
    expect(result.isValid).toBe(false)
    expect(result.message).toBeTruthy()
  })
})

// ─── getScoreInputClass ────────────────────────────────────────────────────

describe('getScoreInputClass', () => {
  it('returns base class for normal score', () => {
    expect(getScoreInputClass(150)).toBe('score-input')
  })

  it('returns perfect class for 300', () => {
    expect(getScoreInputClass(300)).toBe('score-input perfect')
  })

  it('returns invalid class for out-of-range', () => {
    expect(getScoreInputClass(350)).toBe('score-input invalid')
  })
})

// ─── hasMissingScore ───────────────────────────────────────────────────────

describe('hasMissingScore', () => {
  it('returns true when all games missing', () => {
    expect(hasMissingScore(makePlayer())).toBe(true)
  })

  it('returns true when any game is null', () => {
    expect(hasMissingScore(makePlayer({ game1_scratch: 200, game2_scratch: 200, game3_scratch: undefined }))).toBe(true)
  })

  it('returns false when all three games are present', () => {
    expect(hasMissingScore(makePlayer({ game1_scratch: 200, game2_scratch: 180, game3_scratch: 220 }))).toBe(false)
  })

  it('returns false for scores of 0 (0 is a valid entered score)', () => {
    expect(hasMissingScore(makePlayer({ game1_scratch: 0, game2_scratch: 0, game3_scratch: 0 }))).toBe(false)
  })
})

// ─── needsReviewScore ─────────────────────────────────────────────────────

describe('needsReviewScore', () => {
  it('returns false for normal scores', () => {
    expect(needsReviewScore(makePlayer({ game1_scratch: 200, game2_scratch: 200, game3_scratch: 200 }))).toBe(false)
  })

  it('returns true when any score is 250+', () => {
    expect(needsReviewScore(makePlayer({ game1_scratch: 250, game2_scratch: 180, game3_scratch: 160 }))).toBe(true)
  })

  it('returns true for a perfect game', () => {
    expect(needsReviewScore(makePlayer({ game1_scratch: 300, game2_scratch: 180, game3_scratch: 160 }))).toBe(true)
  })
})

// ─── getPlayerScoreStatus ─────────────────────────────────────────────────

describe('getPlayerScoreStatus', () => {
  it('returns Not Started when no scores entered', () => {
    const status = getPlayerScoreStatus(makePlayer())
    expect(status.label).toBe('Not Started')
    expect(status.tone).toBe('pending')
  })

  it('returns In Progress when some scores entered', () => {
    const status = getPlayerScoreStatus(makePlayer({ game1_scratch: 200 }))
    expect(status.label).toBe('In Progress')
    expect(status.tone).toBe('progress')
  })

  it('returns Complete when all three games scored', () => {
    const status = getPlayerScoreStatus(makePlayer({ game1_scratch: 200, game2_scratch: 180, game3_scratch: 220 }))
    expect(status.label).toBe('Complete')
    expect(status.tone).toBe('complete')
  })
})
