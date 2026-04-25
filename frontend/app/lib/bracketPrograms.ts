import { BracketGroup, BracketProgramDefinition, BracketResponse, Player } from './types'

export const requiredBracketProgramKeys = ['handicap', 'scratch'] as const

export const defaultBracketPrograms: BracketProgramDefinition[] = [
  {
    key: 'handicap',
    name: 'Handicap',
    division: 'Any',
    scoring_mode: 'handicap',
    enabled: true,
    display_order: 1,
  },
  {
    key: 'scratch',
    name: 'Scratch',
    division: 'Any',
    scoring_mode: 'scratch',
    enabled: true,
    display_order: 2,
  },
  {
    key: 'reverse',
    name: 'Reverse',
    division: 'Any',
    scoring_mode: 'reverse',
    enabled: false,
    display_order: 3,
  },
  {
    key: 'womens',
    name: 'Womens',
    division: 'Womens',
    scoring_mode: 'scratch',
    enabled: false,
    display_order: 4,
  },
  {
    key: 'seniors',
    name: 'Seniors',
    division: 'Senior',
    scoring_mode: 'scratch',
    enabled: false,
    display_order: 5,
  },
  {
    key: 'juniors',
    name: 'Juniors',
    division: 'Junior',
    scoring_mode: 'scratch',
    enabled: false,
    display_order: 6,
  },
]

export function normalizeBracketPrograms(
  programs: BracketProgramDefinition[] | undefined,
  fallbackEntryFee?: number,
): BracketProgramDefinition[] {
  const source = programs?.length ? [...programs] : []
  const configuredKeys = new Set(
    source
      .map(program => String(program.key || '').trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean),
  )

  defaultBracketPrograms.forEach(program => {
    if (!configuredKeys.has(program.key)) {
      source.push(program)
    }
  })

  const seen = new Set<string>()

  return source
    .map((program, index) => {
      const key = String(program.key || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
      if (!key || seen.has(key)) {
        return null
      }
      seen.add(key)
      return {
        ...program,
        key,
        name: (program.name || key.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())).trim(),
        division: (program.division || 'Any').trim() || 'Any',
        scoring_mode: (program.scoring_mode || key).trim().toLowerCase(),
        entry_fee: program.entry_fee ?? fallbackEntryFee,
        enabled: requiredBracketProgramKeys.includes(key as (typeof requiredBracketProgramKeys)[number]) ? true : (program.enabled ?? false),
        display_order: program.display_order ?? (index + 1),
      }
    })
    .filter((program): program is BracketProgramDefinition => !!program)
    .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
}

export function getEnabledBracketPrograms(programs: BracketProgramDefinition[] | undefined): BracketProgramDefinition[] {
  return normalizeBracketPrograms(programs).filter(program =>
    (program.enabled ?? false) || requiredBracketProgramKeys.includes(program.key as (typeof requiredBracketProgramKeys)[number])
  )
}

export function normalizePlayerBracketEntries(
  bracketEntries: Record<string, number> | undefined,
  handicap?: number,
  scratch?: number,
): Record<string, number> {
  const normalized: Record<string, number> = {}

  Object.entries(bracketEntries || {}).forEach(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '-')
    if (!normalizedKey) return
    normalized[normalizedKey] = Math.max(0, Number(value || 0))
  })

  if (normalized.handicap === undefined && handicap) {
    normalized.handicap = Math.max(0, handicap)
  }
  if (normalized.scratch === undefined && scratch) {
    normalized.scratch = Math.max(0, scratch)
  }

  return normalized
}

export function calculatePlayerTotalCost(
  bracketEntries: Record<string, number> | undefined,
  programs: BracketProgramDefinition[],
  fallbackEntryFee: number,
): number {
  const programMap = new Map(programs.map(program => [program.key, program]))
  const normalizedEntries = normalizePlayerBracketEntries(bracketEntries)

  return Object.entries(normalizedEntries).reduce((total, [key, count]) => {
    const entryFee = Number(programMap.get(key)?.entry_fee ?? fallbackEntryFee ?? 0)
    return total + (Math.max(0, count) * entryFee)
  }, 0)
}

export function getBracketGroups(response: BracketResponse | null | undefined): BracketGroup[] {
  if (!response) return []
  if (response.bracket_groups?.length) {
    return response.bracket_groups
  }

  const groups: BracketGroup[] = []
  if (response.scratch_brackets?.length) {
    groups.push({ key: 'scratch', name: 'Scratch', scoring_mode: 'scratch', brackets: response.scratch_brackets })
  }
  if (response.handicap_brackets?.length) {
    groups.push({ key: 'handicap', name: 'Handicap', scoring_mode: 'handicap', brackets: response.handicap_brackets })
  }
  if (response.multiple_brackets?.scratch_brackets?.length) {
    groups.push({ key: 'scratch', name: 'Scratch', scoring_mode: 'scratch', brackets: response.multiple_brackets.scratch_brackets })
  }
  if (response.multiple_brackets?.handicap_brackets?.length) {
    groups.push({ key: 'handicap', name: 'Handicap', scoring_mode: 'handicap', brackets: response.multiple_brackets.handicap_brackets })
  }
  return groups
}

export function summarizeEntries(players: Player[], programs: BracketProgramDefinition[], bracketSize: number, fallbackEntryFee: number) {
  const programSummaries = programs.map(program => {
    const counts = players.map(player => player.programEntryCounts?.[program.key] || 0)
    const totalEntries = counts.reduce((sum, count) => sum + count, 0)
    const fillResult = simulateBracketFill(counts, bracketSize)

    return {
      ...program,
      totalEntries,
      expectedBrackets: fillResult.brackets,
      refunds: fillResult.refunds,
      revenue: totalEntries * Number(program.entry_fee ?? fallbackEntryFee ?? 0),
    }
  })

  const totalEntries = programSummaries.reduce((sum, program) => sum + program.totalEntries, 0)
  const totalRevenue = players.reduce((sum, player) => {
    const isPaid = player.amountPaid >= player.totalCost
    return sum + (isPaid ? player.totalCost : 0)
  }, 0)

  return {
    totalPlayers: players.length,
    totalEntries,
    totalRevenue,
    programSummaries,
  }
}

function simulateBracketFill(playerCounts: number[], bracketSize: number) {
  const total = playerCounts.reduce((sum, count) => sum + count, 0)
  if (total < bracketSize) {
    return { brackets: 0, refunds: total }
  }

  let bracketCount = Math.floor(total / bracketSize)
  while (bracketCount > 0) {
    const fillable = playerCounts.reduce((sum, count) => sum + Math.min(count, bracketCount), 0)
    const nextBracketCount = Math.floor(fillable / bracketSize)
    if (nextBracketCount >= bracketCount) {
      break
    }
    bracketCount = nextBracketCount
  }

  return {
    brackets: bracketCount,
    refunds: total - (bracketCount * bracketSize),
  }
}