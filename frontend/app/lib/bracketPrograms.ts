import { BracketGroup, BracketProgramDefinition, BracketResponse, Player } from './types'

export const requiredBracketProgramKeys = ['handicap', 'scratch'] as const

export const divisionOptions = ['Men', 'Women', 'Senior', 'Junior'] as const
export type BowlerDivision = (typeof divisionOptions)[number]

export function normalizeDivision(division?: string | null): BowlerDivision {
  const value = String(division || 'Men').trim().toLowerCase()
  if (value === 'men' || value === 'mens' || value === "men's") return 'Men'
  if (value === 'womens' || value === "women's" || value === 'women') return 'Women'
  if (value === 'senior' || value === 'seniors' || value === "senior's") return 'Senior'
  if (value === 'junior' || value === 'juniors' || value === "junior's") return 'Junior'
  return 'Men'
}

export function isProgramAllowedForDivision(programDivision: string | undefined, playerDivision: string | undefined): boolean {
  const target = String(programDivision || 'Any').trim().toLowerCase()
  if (!target || target === 'any' || target === 'open') {
    return true
  }
  return normalizeDivision(target) === normalizeDivision(playerDivision)
}

export function filterEntriesForDivision(
  entries: Record<string, number> | undefined,
  programs: BracketProgramDefinition[],
  division: string | undefined,
): Record<string, number> {
  const normalized = normalizePlayerBracketEntries(entries)
  const filtered: Record<string, number> = {}

  Object.entries(normalized).forEach(([key, count]) => {
    const program = programs.find(programItem => programItem.key === key)
    if (!program || isProgramAllowedForDivision(program.division, division)) {
      filtered[key] = Math.max(0, Number(count || 0))
    }
  })

  return filtered
}

const legacyBracketProgramKeyMap: Record<string, string> = {
  womens: 'womens_scratch',
  seniors: 'seniors_scratch',
  juniors: 'juniors_scratch',
}

function canonicalizeBracketProgramKey(key: string): string {
  return legacyBracketProgramKeyMap[key] ?? key
}

export const defaultBracketPrograms: BracketProgramDefinition[] = [
  {
    key: 'handicap',
    name: 'Handicap',
    division: 'Any',
    scoring_mode: 'handicap',
    enabled: true,
    allow_byes: false,
    display_order: 1,
  },
  {
    key: 'scratch',
    name: 'Scratch',
    division: 'Any',
    scoring_mode: 'scratch',
    enabled: true,
    allow_byes: false,
    display_order: 2,
  },
  {
    key: 'reverse_scratch',
    name: 'Reverse Scratch',
    division: 'Any',
    scoring_mode: 'reverse_scratch',
    enabled: false,
    allow_byes: false,
    display_order: 3,
  },
  {
    key: 'reverse_handicap',
    name: 'Reverse Handicap',
    division: 'Any',
    scoring_mode: 'reverse_handicap',
    enabled: false,
    allow_byes: false,
    display_order: 4,
  },
  {
    key: 'womens_scratch',
    name: "Women's Scratch",
    division: 'Womens',
    scoring_mode: 'scratch',
    enabled: false,
    allow_byes: false,
    display_order: 5,
  },
  {
    key: 'womens_handicap',
    name: "Women's Handicap",
    division: 'Womens',
    scoring_mode: 'handicap',
    enabled: false,
    allow_byes: false,
    display_order: 6,
  },
  {
    key: 'seniors_scratch',
    name: 'Seniors Scratch',
    division: 'Senior',
    scoring_mode: 'scratch',
    enabled: false,
    allow_byes: false,
    display_order: 7,
  },
  {
    key: 'seniors_handicap',
    name: 'Seniors Handicap',
    division: 'Senior',
    scoring_mode: 'handicap',
    enabled: false,
    allow_byes: false,
    display_order: 8,
  },
  {
    key: 'juniors_scratch',
    name: 'Juniors Scratch',
    division: 'Junior',
    scoring_mode: 'scratch',
    enabled: false,
    allow_byes: false,
    display_order: 9,
  },
  {
    key: 'juniors_handicap',
    name: 'Juniors Handicap',
    division: 'Junior',
    scoring_mode: 'handicap',
    enabled: false,
    allow_byes: false,
    display_order: 10,
  },
]

function getDefaultBracketProgram(key: string): BracketProgramDefinition | undefined {
  return defaultBracketPrograms.find(program => program.key === key)
}

function shouldUseCanonicalProgramName(key: string, name: string | undefined): boolean {
  const normalizedName = (name || '').trim().toLowerCase()
  return (
    !normalizedName
    || (key === 'womens_scratch' && normalizedName === 'womens')
    || (key === 'seniors_scratch' && normalizedName === 'seniors')
    || (key === 'juniors_scratch' && normalizedName === 'juniors')
  )
}

export function normalizeBracketPrograms(
  programs: BracketProgramDefinition[] | undefined,
  fallbackEntryFee?: number,
): BracketProgramDefinition[] {
  const source = programs?.length ? [...programs] : []
  const configuredKeys = new Set(
    source
      .map(program => canonicalizeBracketProgramKey(String(program.key || '').trim().toLowerCase().replace(/\s+/g, '-')))
      .filter(Boolean),
  )

  defaultBracketPrograms.forEach(program => {
    if (!configuredKeys.has(program.key)) {
      source.push(program)
    }
  })

  const seen = new Set<string>()

  const normalized = source
    .map((program, index) => {
      const rawKey = String(program.key || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
      const key = canonicalizeBracketProgramKey(rawKey)
      if (!key || seen.has(key)) {
        return null
      }
      seen.add(key)
      const canonicalProgramDefaults = getDefaultBracketProgram(key)
      const aliasedProgramDefaults = rawKey !== key ? canonicalProgramDefaults : undefined
      return {
        ...aliasedProgramDefaults,
        ...program,
        key,
        name: (
          (shouldUseCanonicalProgramName(key, program.name) ? canonicalProgramDefaults?.name : undefined)
          || aliasedProgramDefaults?.name
          || program.name
          || key.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
        ).trim(),
        division: (canonicalProgramDefaults?.division || aliasedProgramDefaults?.division || program.division || 'Any').trim() || 'Any',
        scoring_mode: (canonicalProgramDefaults?.scoring_mode || aliasedProgramDefaults?.scoring_mode || program.scoring_mode || key).trim().toLowerCase(),
        entry_fee: (program.entry_fee != null && program.entry_fee > 0) ? program.entry_fee : fallbackEntryFee,
        enabled: requiredBracketProgramKeys.includes(key as (typeof requiredBracketProgramKeys)[number]) ? true : (program.enabled ?? false),
        allow_byes: Boolean(program.allow_byes ?? canonicalProgramDefaults?.allow_byes ?? aliasedProgramDefaults?.allow_byes ?? false),
        display_order: program.display_order ?? canonicalProgramDefaults?.display_order ?? aliasedProgramDefaults?.display_order ?? (index + 1),
      }
    })
    .filter(Boolean) as BracketProgramDefinition[];
  return normalized.sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
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
    const normalizedKey = canonicalizeBracketProgramKey(key.trim().toLowerCase().replace(/\s+/g, '-'))
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
    const progFee = programMap.get(key)?.entry_fee
    const fee = Number((progFee != null && progFee > 0) ? progFee : (fallbackEntryFee ?? 0))
    return total + (Math.max(0, count) * fee)
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
    const counts = players.map(player =>
      (player as unknown as { bracketEntries?: Record<string, number> }).bracketEntries?.[program.key]
      ?? player.programEntryCounts?.[program.key]
      ?? 0
    )
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