'use client'

import { useEffect, useState, useCallback, useRef, useMemo, Fragment, useLayoutEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Check, ChevronLeft, ChevronRight, ListOrdered, Network, RefreshCw, Search, Share2, Trophy } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  DataTable,
  EmptyState,
  ICON_SIZE,
  NavItem,
  Page,
  PageHeader,
  SearchField,
  SegmentedControl,
  SelectField,
  StatGroup,
  TableToolbar,
  TopNav,
  topNavBrandClassName,
} from '@bracketworks/ui'
import { buildApiUrl } from '../../lib/api'
import { subscribeToDataChanges } from '../../lib/api/dataChanges'
import { formatIsoDateShortWithWeekday } from '../../lib/formatters'
import { MOBILE_VIEWPORT_QUERY } from '../../lib/responsive'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { getSidePotsStorageKey } from '../../lib/dashboard-settings'
import BracketTreeView, { matchesSearch } from '../../brackets/components/BracketTreeView'
import type { BracketRound } from '../../lib/types'
import TournamentDirectory from '../TournamentDirectory'
import styles from './LiveView.module.css'
import { SAMPLE_BOWLER_NAMES, SAMPLE_TOURNAMENT } from '../../demo/sample-tournament'

// Types

interface Squad {
  id: number
  date: string
  time: string
  has_brackets?: boolean
  bracket_group_count?: number
  bracket_count?: number
}

interface TournamentInfo {
  id: number
  name: string
  location?: string
  squads: Squad[]
}

const getPreferredPublicSquadId = (squads: Squad[]) => {
  return squads.find((s) => s.has_brackets)?.id ?? squads[0]?.id ?? null
}

interface AliveRow {
  name: string
  afterG1: number
  afterG2: number
  won: number
}

interface MatchData {
  playerA?: string
  playerB?: string
  scoreA?: number | null
  scoreB?: number | null
  winner?: 'A' | 'B' | null
  status?: string
  both_advance?: boolean
  split_pot?: boolean
}

interface RoundData {
  name: string
  matches: MatchData[]
}

interface BracketData {
  rounds?: RoundData[]
  title?: string
}

interface BracketGroup {
  key: string
  name: string
  brackets: BracketData[]
}

interface Winner {
  player_name?: string
  name?: string
  place?: number
  bracket_name?: string
  bracket_group?: string
}

interface PublicScoreRow {
  player_id: number
  player_name: string
  game1_scratch?: number | null
  game2_scratch?: number | null
  game3_scratch?: number | null
  game1_with_handicap?: number | null
  game2_with_handicap?: number | null
  game3_with_handicap?: number | null
}

interface PublicSidePotSummary {
  key: string
  name: string
  entry_count: number
  pool: number
  status: 'empty' | 'pending' | 'complete' | 'tied'
  winning_metric: number | null
  winners: Array<{
    player_id: number
    player_name: string
  }>
  winner_id: number | null
  winner_name: string | null
  winner_metric: number | null
}

interface SidePotDefinition {
  key: string
  enabled: boolean
}

interface StoredSidePotsSettings {
  pots?: SidePotDefinition[]
}

type SidePotEntriesByPlayer = Record<string, Record<string, boolean>>

interface PublicViewCache {
  tournament: TournamentInfo
  selectedSquadId: number | null
  resolvedTournamentId: number | null
  bracketGroups: BracketGroup[]
  winners: Winner[]
  lastRefreshIso: string
  activeTab?: 'alive' | 'brackets' | 'sidePots'
}

type Tab = 'alive' | 'brackets' | 'sidePots'

const DEMO_TOURNAMENT_ID = -101
const DEMO_TOURNAMENT: TournamentInfo = {
  id: DEMO_TOURNAMENT_ID,
  name: SAMPLE_TOURNAMENT.name,
  location: SAMPLE_TOURNAMENT.location,
  squads: [
    { id: 101, date: SAMPLE_TOURNAMENT.date, time: SAMPLE_TOURNAMENT.squads[0], has_brackets: true, bracket_group_count: 3, bracket_count: 9 },
    { id: 102, date: SAMPLE_TOURNAMENT.date, time: SAMPLE_TOURNAMENT.squads[1], has_brackets: false, bracket_group_count: 0, bracket_count: 0 },
  ],
}

function createDemoEightPlayerBracket(title: string, players: readonly string[], baseScore: number): BracketData {
  const player = (index: number) => players[index] ?? 'BYE'
  return {
    title,
    rounds: [
      { name: 'Round 1', matches: [
        { playerA: player(0), playerB: player(1), scoreA: baseScore + 18, scoreB: baseScore + 3, winner: 'A' },
        { playerA: player(2), playerB: player(3), scoreA: baseScore + 14, scoreB: baseScore + 6, winner: 'A' },
        { playerA: player(4), playerB: player(5), scoreA: baseScore + 21, scoreB: baseScore + 9, winner: 'A' },
        { playerA: player(6), playerB: player(7), scoreA: baseScore + 16, scoreB: baseScore + 5, winner: 'A' },
      ] },
      { name: 'Semifinal', matches: [
        { playerA: player(0), playerB: player(2), scoreA: baseScore + 24, scoreB: baseScore + 17, winner: 'A' },
        { playerA: player(4), playerB: player(6), scoreA: baseScore + 26, scoreB: baseScore + 20, winner: 'A' },
      ] },
      { name: 'Final', matches: [
        { playerA: player(0), playerB: player(4), scoreA: baseScore + 29, scoreB: baseScore + 23, winner: 'A' },
      ] },
    ],
  }
}

const DEMO_BRACKET_GROUPS: BracketGroup[] = [{
  key: 'handicap', name: 'Handicap', brackets: [
    { title: 'Handicap 1', rounds: [
      { name: 'Round 1', matches: [
        { playerA: 'Harry Bowler', playerB: 'Ron Pinsley', scoreA: 226, scoreB: 191, winner: 'A' },
        { playerA: 'Princess Layne', playerB: 'Han Bowl-o', scoreA: 219, scoreB: 204, winner: 'A' },
        { playerA: 'Pin Diesel', playerB: 'Forrest Gutter', scoreA: 214, scoreB: 188, winner: 'A' },
        { playerA: 'Bowl Malone', playerB: 'Jack Spare-row', scoreA: 207, scoreB: 199, winner: 'A' },
      ] },
      { name: 'Semifinal', matches: [
        { playerA: 'Harry Bowler', playerB: 'Princess Layne', scoreA: 224, scoreB: 211, winner: 'A' },
        { playerA: 'Pin Diesel', playerB: 'Bowl Malone', scoreA: 218, scoreB: 205, winner: 'A' },
      ] },
      { name: 'Final', matches: [{ playerA: 'Harry Bowler', playerB: 'Pin Diesel', scoreA: 231, scoreB: 220, winner: 'A' }] },
    ] },
    createDemoEightPlayerBracket('Handicap 2', ['Pin Diesel', 'Forrest Gutter', 'Bowl Malone', 'Jack Spare-row', 'Hermione Spareger', 'Darth Striker', 'Sparelock Holmes', 'Taylor Split'], 190),
    createDemoEightPlayerBracket('Handicap 3', ['Luke Pinwalker', 'Indiana Bowls', 'Obi-Wan Can-Bowl-Me', 'Marty McSpare', 'Doc Bowl', 'Rocky Ballboa', 'Bruno Pins', 'Ariana Gutter'], 193),
    createDemoEightPlayerBracket('Handicap 4', ['Tony Striker', 'Peter Parker-Pins', 'Diana Princepin', 'Wade Wilsonball', 'Bruce Bannerlane', 'Clark Pin', 'Billie Bowl-Ish', 'Katy Spare-y'], 196),
  ],
}, {
  key: 'scratch', name: 'Scratch', brackets: [{ title: 'Scratch 1', rounds: [
    { name: 'Round 1', matches: [{ playerA: 'Hermione Spareger', playerB: 'Darth Striker', scoreA: 203, scoreB: 198, winner: 'A' }, { playerA: 'Sparelock Holmes', playerB: 'Taylor Split', scoreA: 201, scoreB: 195, winner: 'A' }] },
    { name: 'Final', matches: [{ playerA: 'Hermione Spareger', playerB: 'Sparelock Holmes', scoreA: 224, scoreB: 210, winner: 'A' }] },
  ] }, { title: 'Scratch 2', rounds: [
    { name: 'Round 1', matches: [{ playerA: 'Doc Bowl', playerB: 'Rocky Ballboa', scoreA: 205, scoreB: 193, winner: 'A' }, { playerA: 'Bruno Pins', playerB: 'Ariana Gutter', scoreA: 202, scoreB: 197, winner: 'A' }] },
    { name: 'Final', matches: [{ playerA: 'Doc Bowl', playerB: 'Bruno Pins', scoreA: 220, scoreB: 213, winner: 'A' }] },
  ] }, { title: 'Scratch 3', rounds: [
    { name: 'Round 1', matches: [{ playerA: 'Billie Bowl-Ish', playerB: 'Katy Spare-y', scoreA: 211, scoreB: 202, winner: 'A' }, { playerA: 'Ed Sheerpin', playerB: 'Elton Pin', scoreA: 207, scoreB: 198, winner: 'A' }] },
    { name: 'Final', matches: [{ playerA: 'Billie Bowl-Ish', playerB: 'Ed Sheerpin', scoreA: 218, scoreB: 209, winner: 'A' }] },
  ] }],
}, {
  key: 'reverse_scratch', name: 'Reverse Scratch', brackets: [{ title: 'Reverse Scratch 1', rounds: [
    { name: 'Round 1', matches: [{ playerA: 'Ron Pinsley', playerB: 'Han Bowl-o', scoreA: 191, scoreB: 204, winner: 'A' }, { playerA: 'Forrest Gutter', playerB: 'Jack Spare-row', scoreA: 188, scoreB: 199, winner: 'A' }] },
    { name: 'Final', matches: [{ playerA: 'Forrest Gutter', playerB: 'Ron Pinsley', scoreA: 187, scoreB: 193, winner: 'A' }] },
  ] }, { title: 'Reverse Scratch 2', rounds: [
    { name: 'Round 1', matches: [{ playerA: 'Bruce Bannerlane', playerB: 'Clark Pin', scoreA: 194, scoreB: 207, winner: 'A' }, { playerA: 'Miley Strikrus', playerB: 'Selena Bowlmez', scoreA: 189, scoreB: 201, winner: 'A' }] },
    { name: 'Final', matches: [{ playerA: 'Miley Strikrus', playerB: 'Bruce Bannerlane', scoreA: 186, scoreB: 192, winner: 'A' }] },
  ] }],
}]
const DEMO_WINNERS: Winner[] = [
  { player_name: 'Harry Bowler', place: 1, bracket_name: 'Handicap 1', bracket_group: 'Handicap' },
  { player_name: 'Pin Diesel', place: 2, bracket_name: 'Handicap 1', bracket_group: 'Handicap' },
  { player_name: 'Pin Diesel', place: 1, bracket_name: 'Handicap 2', bracket_group: 'Handicap' },
  { player_name: 'Hermione Spareger', place: 2, bracket_name: 'Handicap 2', bracket_group: 'Handicap' },
  { player_name: 'Hermione Spareger', place: 1, bracket_name: 'Scratch 1', bracket_group: 'Scratch' },
  { player_name: 'Luke Pinwalker', place: 1, bracket_name: 'Handicap 3', bracket_group: 'Handicap' },
  { player_name: 'Doc Bowl', place: 2, bracket_name: 'Handicap 3', bracket_group: 'Handicap' },
  { player_name: 'Doc Bowl', place: 1, bracket_name: 'Scratch 2', bracket_group: 'Scratch' },
  { player_name: 'Tony Striker', place: 1, bracket_name: 'Handicap 4', bracket_group: 'Handicap' },
  { player_name: 'Bruce Bannerlane', place: 2, bracket_name: 'Handicap 4', bracket_group: 'Handicap' },
  { player_name: 'Billie Bowl-Ish', place: 1, bracket_name: 'Scratch 3', bracket_group: 'Scratch' },
  { player_name: 'Forrest Gutter', place: 1, bracket_name: 'Reverse Scratch 1', bracket_group: 'Reverse Scratch' },
  { player_name: 'Miley Strikrus', place: 1, bracket_name: 'Reverse Scratch 2', bracket_group: 'Reverse Scratch' },
]
const DEMO_SCORES: PublicScoreRow[] = SAMPLE_BOWLER_NAMES.map((playerName, index) => {
  const isComplete = index < 21
  const game1 = 168 + ((index * 11) % 58)
  const game2 = 171 + ((index * 17) % 57)
  const game3 = 166 + ((index * 23) % 63)
  const handicap = 10 + (index % 8)
  return {
    player_id: index + 1,
    player_name: playerName,
    game1_scratch: isComplete ? game1 : null,
    game2_scratch: isComplete ? game2 : null,
    game3_scratch: isComplete ? game3 : null,
    game1_with_handicap: isComplete ? game1 + handicap : null,
    game2_with_handicap: isComplete ? game2 + handicap : null,
    game3_with_handicap: isComplete ? game3 + handicap : null,
  }
})

// Helpers

function computeAlive(bracketGroups: BracketGroup[]): AliveRow[] {
  const data: Record<string, { afterG1: number; afterG2: number; won: number }> = {}

  const ensure = (name: string) => {
    if (!data[name]) data[name] = { afterG1: 0, afterG2: 0, won: 0 }
  }

  const advancers = (match: MatchData): string[] => {
    if (match.both_advance || match.split_pot) {
      return [match.playerA, match.playerB].filter((p): p is string => !!p && p !== 'BYE')
    }
    if (match.playerB === 'BYE' && match.playerA) return [match.playerA]
    if (match.playerA === 'BYE' && match.playerB) return [match.playerB]
    if (match.winner === 'A' && match.playerA) return [match.playerA]
    if (match.winner === 'B' && match.playerB) return [match.playerB]
    return []
  }

  for (const group of bracketGroups) {
    for (const bracket of group.brackets) {
      const rounds = bracket.rounds ?? []
      if (rounds.length === 0) continue

      // After Game 1: advanced from round 0
      const firstRound = rounds[0]
      if (firstRound) {
        for (const p of advancers_from(firstRound)) {
          ensure(p)
          const row = data[p]
          if (row) row.afterG1++
        }
      }

      // After Game 2: advanced from round 1 (if it exists)
      const secondRound = rounds[1]
      if (secondRound) {
        for (const p of advancers_from(secondRound)) {
          ensure(p)
          const row = data[p]
          if (row) row.afterG2++
        }
      }

      // Won: appeared in the last round (finalists place 1st/2nd)
      const lastRound = rounds.at(-1)
      if (rounds.length >= 2 && lastRound) {
        for (const m of lastRound.matches) {
          if (m.playerA && m.playerA !== 'BYE') {
            ensure(m.playerA)
            const row = data[m.playerA]
            if (row) row.won++
          }
          if (m.playerB && m.playerB !== 'BYE') {
            ensure(m.playerB)
            const row = data[m.playerB]
            if (row) row.won++
          }
        }
      }

      function advancers_from(round: RoundData): string[] {
        return round.matches.flatMap(advancers)
      }
    }
  }

  return Object.entries(data)
    .map(([name, stats]) => ({
      name,
      ...stats,
      // A later result cannot exist without advancement in the preceding
      // column. Keep the public summary internally consistent even when an
      // imported or shortened bracket omits an intermediate round.
      won: stats.afterG2 === 0 ? 0 : Math.min(stats.won, stats.afterG2),
    }))
    .sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won
      if (b.afterG2 !== a.afterG2) return b.afterG2 - a.afterG2
      if (b.afterG1 !== a.afterG1) return b.afterG1 - a.afterG1
      return a.name.localeCompare(b.name)
    })
}

function formatSquad(s: Squad) {
  const date = s.date ? formatIsoDateShortWithWeekday(s.date) : ''
  return `${date} ${s.time}`.trim()
}

// Sub-components

function StandingsView({ bracketGroups, isPhone }: { bracketGroups: BracketGroup[]; isPhone: boolean }) {
  const rows = useMemo(() => computeAlive(bracketGroups), [bracketGroups])
  const [searchQuery, setSearchQuery] = useState('')
  const hasBrackets = bracketGroups.some((group) => group.brackets.length > 0)
  const hasRounds = bracketGroups.some((group) => group.brackets.some((bracket) => (bracket.rounds?.length ?? 0) > 0))
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredRows = useMemo(
    () => (normalizedSearch ? rows.filter((row) => row.name.toLowerCase().includes(normalizedSearch)) : rows),
    [rows, normalizedSearch],
  )

  const emptyMessage = !hasBrackets
    ? 'No brackets yet. Standings appear after the first bracket draw.'
    : !hasRounds
      ? 'Brackets exist, but matchups are not available yet.'
      : 'No results have been recorded yet.'

  return (
    <Card padding="flush" aria-label="Standings">
      <CardHeader title="Standings" description="How many brackets each bowler is still alive in after each game." />
      {rows.length === 0 ? (
        <EmptyState icon={<ListOrdered size={ICON_SIZE['2xl']} aria-hidden="true" />} title="No standings yet" description={emptyMessage} />
      ) : (
        <>
          <TableToolbar
            search={<SearchField label="Find a bowler" placeholder="Find a bowler" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />}
          />
          {filteredRows.length === 0 ? (
            <EmptyState
              icon={<Search size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No matching bowlers"
              description="Try a different name."
              action={<Button variant="secondary" onClick={() => setSearchQuery('')}>Clear search</Button>}
            />
          ) : (
            <DataTable caption="Standings">
              <thead>
                <tr>
                  <th data-align="right">#</th>
                  <th>Bowler</th>
                  <th data-align="right">{isPhone ? 'G1' : 'After game 1'}</th>
                  <th data-align="right">{isPhone ? 'G2' : 'After game 2'}</th>
                  <th data-align="right">{isPhone ? 'Top 2' : '1st or 2nd'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.name}>
                    <td data-align="right" data-tone="secondary">{rows.indexOf(row) + 1}</td>
                    <td>{row.name}</td>
                    <td data-align="right" data-tone={row.afterG1 > 0 ? undefined : 'secondary'}>{row.afterG1}</td>
                    <td data-align="right" data-tone={row.afterG2 > 0 ? undefined : 'secondary'}>{row.afterG2}</td>
                    <td data-align="right" data-emphasis={row.won > 0 ? 'true' : undefined} data-tone={row.won > 0 ? undefined : 'secondary'}>{row.won}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </>
      )}
    </Card>
  )
}

function bracketHasName(bracket: BracketData, term: string): boolean {
  return (bracket.rounds ?? []).some((round) => round.matches.some((match) =>
    matchesSearch(match.playerA ?? null, term) || matchesSearch(match.playerB ?? null, term)))
}

function BracketsView({ bracketGroups, isPhone }: { bracketGroups: BracketGroup[]; isPhone: boolean }) {
  const [activeGroupKey, setActiveGroupKey] = useState(bracketGroups[0]?.key ?? '')
  const [activeBracket, setActiveBracket] = useState(0)
  const [search, setSearch] = useState('')
  const group = bracketGroups.find((item) => item.key === activeGroupKey) ?? bracketGroups[0]
  const term = search.trim()

  // Jump to the first program and bracket that contain the searched bowler.
  useEffect(() => {
    if (!term) return
    for (const candidate of bracketGroups) {
      const index = candidate.brackets.findIndex((bracket) => bracketHasName(bracket, term))
      if (index >= 0) {
        setActiveGroupKey(candidate.key)
        setActiveBracket(index)
        return
      }
    }
  }, [term, bracketGroups])

  if (!group || bracketGroups.every((item) => item.brackets.length === 0)) {
    return (
      <Card aria-label="Brackets">
        <EmptyState icon={<Network size={ICON_SIZE['2xl']} aria-hidden="true" />} title="No brackets yet" description="Brackets appear here once they are generated." />
      </Card>
    )
  }

  const total = group.brackets.length
  const safeIndex = Math.min(activeBracket, Math.max(0, total - 1))
  const bracket = group.brackets[safeIndex]
  const changeGroup = (key: string) => {
    setActiveGroupKey(key)
    setActiveBracket(0)
  }
  const programOptions = bracketGroups.map((item) => ({ value: item.key, label: item.name, count: item.brackets.length }))

  return (
    <Card aria-label="Brackets">
      <div className={styles.controls}>
        {programOptions.length > 1 ? (
          isPhone || programOptions.length > 5 ? (
            <SelectField label="Program" value={group.key} onChange={(e) => changeGroup(e.target.value)}>
              {programOptions.map((option) => <option key={option.value} value={option.value}>{`${option.label} (${option.count})`}</option>)}
            </SelectField>
          ) : (
            <SegmentedControl label="Program" options={programOptions} value={group.key} onChange={changeGroup} />
          )
        ) : null}
        <div className={styles.pickerRow}>
          <div className={styles.picker}>
            <Button
              size={isPhone ? undefined : 'sm'}
              variant="secondary"
              icon={<ChevronLeft size={ICON_SIZE.md} aria-hidden="true" />}
              aria-label="Previous bracket"
              onClick={() => setActiveBracket(Math.max(0, safeIndex - 1))}
              disabled={safeIndex === 0}
            />
            <SelectField label="Bracket" hideLabel value={safeIndex} onChange={(e) => setActiveBracket(Number(e.target.value))}>
              {group.brackets.map((_, index) => <option key={index} value={index}>{`${group.name} ${index + 1} of ${total}`}</option>)}
            </SelectField>
            <Button
              size={isPhone ? undefined : 'sm'}
              variant="secondary"
              icon={<ChevronRight size={ICON_SIZE.md} aria-hidden="true" />}
              aria-label="Next bracket"
              onClick={() => setActiveBracket(Math.min(total - 1, safeIndex + 1))}
              disabled={safeIndex >= total - 1}
            />
          </div>
          <SearchField label="Highlight a bowler" placeholder="Highlight a bowler" value={search} onChange={(e) => setSearch(e.target.value)} className={styles.search} />
        </div>
      </div>
      <CardDivider />
      {bracket && (bracket.rounds?.length ?? 0) > 0 ? (
        <BracketTreeView
          rounds={(bracket.rounds ?? []) as unknown as BracketRound[]}
          isMobile={isPhone}
          searchTerm={term}
          label={`${group.name} bracket ${safeIndex + 1} of ${total}`}
        />
      ) : (
        <p className={styles.status}>This bracket has no matchups yet.</p>
      )}
    </Card>
  )
}

function placeLabel(index: number): string {
  return index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'
}

function LeaderRows({ leaders, tie, metric }: { leaders: Array<{ name: string; score: number | string | null }>; tie?: boolean; metric?: number | string | null }) {
  return (
    <ol className={styles.leaders}>
      {leaders.map((leader, index) => (
        <li key={`${leader.name}-${index}`} className={styles.leaderRow}>
          <Badge tone="neutral">{tie ? 'Tie' : placeLabel(index)}</Badge>
          <span className={styles.leaderName}>{leader.name}</span>
          <span className={styles.leaderScore}>{leader.score ?? metric ?? '-'}</span>
        </li>
      ))}
    </ol>
  )
}

function SidePotsView({ scoreRows, sidePotSummaries, sidePotsLoaded, tournamentId }: {
  scoreRows: PublicScoreRow[]
  sidePotSummaries: PublicSidePotSummary[]
  sidePotsLoaded: boolean
  tournamentId: number | null
}) {
  const [settingsRefreshKey, setSettingsRefreshKey] = useState(0)
  const [enabledSidePotKeys, setEnabledSidePotKeys] = useState<Set<string>>(new Set())
  const [sidePotEntriesMap, setSidePotEntriesMap] = useState<SidePotEntriesByPlayer>({})
  const [hasSidePotSettings, setHasSidePotSettings] = useState(false)
  const [hasSidePotEntriesMap, setHasSidePotEntriesMap] = useState(false)
  const [activeSidePotMode, setActiveSidePotMode] = useState<'scratch' | 'handicap'>('scratch')

  useEffect(() => {
    const handleSettingsChanged = () => setSettingsRefreshKey(prev => prev + 1)
    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [])

  useEffect(() => {
    if (!tournamentId) {
      setEnabledSidePotKeys(new Set())
      setSidePotEntriesMap({})
      setHasSidePotSettings(false)
      setHasSidePotEntriesMap(false)
      return
    }
    const rawSettings = localStorage.getItem(getSidePotsStorageKey(tournamentId))
    const rawEntries = localStorage.getItem(`sidePotEntries_${tournamentId}`)
    setHasSidePotSettings(rawSettings !== null)
    setHasSidePotEntriesMap(rawEntries !== null)
    try {
      const parsed = rawSettings ? JSON.parse(rawSettings) as StoredSidePotsSettings : null
      setEnabledSidePotKeys(new Set((parsed?.pots ?? []).filter(pot => Boolean(pot.enabled)).map(pot => pot.key)))
    } catch {
      setEnabledSidePotKeys(new Set())
    }
    try {
      setSidePotEntriesMap(rawEntries ? JSON.parse(rawEntries) as SidePotEntriesByPlayer : {})
    } catch {
      setSidePotEntriesMap({})
    }
  }, [tournamentId, settingsRefreshKey])

  const getEligiblePlayerIds = useCallback((potKey: string): Set<number> | null => {
    // Only enforce opt-in filtering when this browser has both settings and entries data.
    if (!hasSidePotSettings || !hasSidePotEntriesMap || !enabledSidePotKeys.has(potKey)) return null
    const eligible = new Set<number>()
    for (const row of scoreRows) {
      if (sidePotEntriesMap[String(row.player_id)]?.[potKey]) eligible.add(row.player_id)
    }
    return eligible
  }, [enabledSidePotKeys, hasSidePotEntriesMap, hasSidePotSettings, scoreRows, sidePotEntriesMap])

  const emptyCard = (title: string, description: string) => (
    <Card aria-label="Side pots">
      <EmptyState icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />} title={title} description={description} />
    </Card>
  )

  if (sidePotsLoaded) {
    if (!tournamentId) return emptyCard('No tournament selected', 'Choose a tournament to see its side pots.')
    if (sidePotSummaries.length === 0) return emptyCard('No side pots', 'This tournament does not offer side pots.')
    return (
      <Card aria-label="Side pots">
        <CardHeader title="Side pots" />
        <div className={styles.pots}>
          {sidePotSummaries.map((summary) => (
            <section key={summary.key} className={styles.pot} aria-labelledby={`pot-${summary.key}`}>
              <h3 id={`pot-${summary.key}`} className={styles.potTitle}>{summary.name}</h3>
              {summary.status === 'empty' ? (
                <p className={styles.status}>No entries yet</p>
              ) : (summary.winners?.length ?? 0) > 0 && summary.status !== 'pending' ? (
                <LeaderRows
                  leaders={summary.winners.map((winner) => ({ name: winner.player_name, score: summary.winning_metric }))}
                  tie={summary.status === 'tied'}
                />
              ) : (
                <p className={styles.status}>Pending</p>
              )}
              <p className={styles.meta}>{summary.entry_count} {summary.entry_count === 1 ? 'entry' : 'entries'} · ${summary.pool.toFixed(2)} pool</p>
            </section>
          ))}
        </div>
      </Card>
    )
  }

  if (scoreRows.length === 0) return emptyCard('No scores yet', 'Check back during the tournament.')
  if (hasSidePotSettings && enabledSidePotKeys.size === 0) return emptyCard('No side pots', 'This tournament does not offer side pots.')

  const hasScratchData = scoreRows.some(row => row.game1_scratch != null || row.game2_scratch != null || row.game3_scratch != null)
  const hasHandicapData = scoreRows.some(row => row.game1_with_handicap != null || row.game2_with_handicap != null || row.game3_with_handicap != null)
  const show = {
    gameScratch: hasSidePotSettings ? enabledSidePotKeys.has('high_game_scratch') : hasScratchData,
    seriesScratch: hasSidePotSettings ? enabledSidePotKeys.has('high_series_scratch') : hasScratchData,
    gameHandicap: hasSidePotSettings ? enabledSidePotKeys.has('high_game_handicap') : hasHandicapData,
    seriesHandicap: hasSidePotSettings ? enabledSidePotKeys.has('high_series_handicap') : hasHandicapData,
  }
  const modes = [
    ...(show.gameScratch || show.seriesScratch ? [{ value: 'scratch' as const, label: 'Scratch' }] : []),
    ...(show.gameHandicap || show.seriesHandicap ? [{ value: 'handicap' as const, label: 'Handicap' }] : []),
  ]
  if (modes.length === 0) return emptyCard('No side pots yet', 'Side pot leaders appear once scores are entered.')
  const mode = modes.some(item => item.value === activeSidePotMode) ? activeSidePotMode : modes[0]!.value
  const games = [
    { label: 'Game 1', scratch: 'game1_scratch' as const, handicap: 'game1_with_handicap' as const },
    { label: 'Game 2', scratch: 'game2_scratch' as const, handicap: 'game2_with_handicap' as const },
    { label: 'Game 3', scratch: 'game3_scratch' as const, handicap: 'game3_with_handicap' as const },
  ]
  const showGames = mode === 'scratch' ? show.gameScratch : show.gameHandicap
  const showSeries = mode === 'scratch' ? show.seriesScratch : show.seriesHandicap
  const gameEligible = getEligiblePlayerIds(mode === 'scratch' ? 'high_game_scratch' : 'high_game_handicap')
  const seriesEligible = getEligiblePlayerIds(mode === 'scratch' ? 'high_series_scratch' : 'high_series_handicap')
  const sections = [
    ...(showGames ? games.map(game => ({ label: `High ${game.label.toLowerCase()}`, leaders: getTopN(scoreRows, mode === 'scratch' ? game.scratch : game.handicap, 3, gameEligible) })) : []),
    ...(showSeries ? [{ label: 'High series', leaders: getSeriesTopN(scoreRows, mode, 3, seriesEligible) }] : []),
  ]

  return (
    <Card aria-label="Side pots">
      <CardHeader
        title="Side pots"
        description="Top three in each side pot so far."
        actions={modes.length > 1 ? <SegmentedControl label="Side pot type" options={modes} value={mode} onChange={setActiveSidePotMode} /> : undefined}
      />
      <div className={styles.pots}>
        {sections.map(section => (
          <section key={section.label} className={styles.pot} aria-label={section.label}>
            <h3 className={styles.potTitle}>{section.label}</h3>
            {section.leaders.length === 0 ? <p className={styles.status}>Pending</p> : <LeaderRows leaders={section.leaders} />}
          </section>
        ))}
      </div>
    </Card>
  )
}

type Leader = { name: string; score: number }

function getLeader(rows: PublicScoreRow[], field: keyof PublicScoreRow, eligiblePlayerIds?: Set<number> | null): Leader | null {
  let best: Leader | null = null
  for (const row of rows) {
    if (eligiblePlayerIds && !eligiblePlayerIds.has(row.player_id)) continue
    const val = row[field]
    if (val == null) continue
    const score = val as number
    if (!best || score > best.score) best = { name: row.player_name, score }
  }
  return best
}

function getSeriesLeader(rows: PublicScoreRow[], mode: 'scratch' | 'handicap', eligiblePlayerIds?: Set<number> | null): Leader | null {
  let best: Leader | null = null
  for (const row of rows) {
    if (eligiblePlayerIds && !eligiblePlayerIds.has(row.player_id)) continue
    const games = mode === 'scratch'
      ? [row.game1_scratch, row.game2_scratch, row.game3_scratch]
      : [row.game1_with_handicap, row.game2_with_handicap, row.game3_with_handicap]
    const valid = games.filter((g): g is number => g != null)
    if (valid.length === 0) continue
    const total = valid.reduce((s, n) => s + n, 0)
    if (!best || total > best.score) best = { name: row.player_name, score: total }
  }
  return best
}

function getTopN(rows: PublicScoreRow[], field: keyof PublicScoreRow, n: number, eligiblePlayerIds?: Set<number> | null): Leader[] {
  const candidates: Leader[] = []
  for (const row of rows) {
    if (eligiblePlayerIds && !eligiblePlayerIds.has(row.player_id)) continue
    const val = row[field]
    if (val == null) continue
    candidates.push({ name: row.player_name, score: val as number })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, n)
}

function getSeriesTopN(rows: PublicScoreRow[], mode: 'scratch' | 'handicap', n: number, eligiblePlayerIds?: Set<number> | null): Leader[] {
  const candidates: Leader[] = []
  for (const row of rows) {
    if (eligiblePlayerIds && !eligiblePlayerIds.has(row.player_id)) continue
    const games = mode === 'scratch'
      ? [row.game1_scratch, row.game2_scratch, row.game3_scratch]
      : [row.game1_with_handicap, row.game2_with_handicap, row.game3_with_handicap]
    const valid = games.filter((g): g is number => g != null)
    if (valid.length !== 3) continue
    candidates.push({ name: row.player_name, score: valid.reduce((s, v) => s + v, 0) })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, n)
}

export default function TournamentViewPage() {
  const params = useParams()
  const tournamentRef = params?.tournamentId as string
  const isDemoTournament = (tournamentRef ?? '').trim().toLowerCase() === 'demo'
  const cacheKey = `bw-public-view:${(tournamentRef ?? '').trim().toLowerCase()}`

  const [tab, setTab] = useState<Tab>('alive')
  const [tournament, setTournament] = useState<TournamentInfo | null>(null)
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null)
  const [resolvedTournamentId, setResolvedTournamentId] = useState<number | null>(null)
  const [bracketGroups, setBracketGroups] = useState<BracketGroup[]>([])
  const [winners, setWinners] = useState<Winner[]>([])
  const [scoreRows, setScoreRows] = useState<PublicScoreRow[]>([])
  const [sidePotSummaries, setSidePotSummaries] = useState<PublicSidePotSummary[]>([])
  const [sidePotsLoaded, setSidePotsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hydratedFromCache, setHydratedFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshInFlightRef = useRef(false)

  useLayoutEffect(() => {
    const previousHtmlOverflowX = document.documentElement.style.overflowX
    const previousBodyOverflowX = document.body.style.overflowX
    const isEmbeddedLiveView = new URLSearchParams(window.location.search).get('modal') === '1'
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    if (isEmbeddedLiveView) {
      document.documentElement.classList.add('bw-live-view-embedded')
      document.body.classList.add('bw-live-view-embedded')
    }

    return () => {
      document.documentElement.style.overflowX = previousHtmlOverflowX
      document.body.style.overflowX = previousBodyOverflowX
      if (isEmbeddedLiveView) {
        document.documentElement.classList.remove('bw-live-view-embedded')
        document.body.classList.remove('bw-live-view-embedded')
      }
    }
  }, [])

  // Persist tab preference to localStorage across sessions
  const [copied, setCopied] = useState(false)
  const isPhone = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  useEffect(() => {
    try { localStorage.setItem('bw-view-tab', tab) } catch {}
  }, [tab])

  // Fetch helpers

  const looksNumeric = /^\d+$/.test((tournamentRef ?? '').trim())

  const fetchTournamentInfo = useCallback(async () => {
    if (isDemoTournament) {
      setResolvedTournamentId(DEMO_TOURNAMENT_ID)
      return DEMO_TOURNAMENT
    }
    const ref = decodeURIComponent((tournamentRef ?? '').trim())
    if (!ref) throw new Error('Tournament not found')

    const byIdPath = `/api/v1/public/tournament/${encodeURIComponent(ref)}`
    const byNamePath = `/api/v1/public/tournament/by-name/${encodeURIComponent(ref)}`
    const bySlugPath = `/api/v1/public/tournament/by-slug/${encodeURIComponent(ref)}`

    const pathsToTry = looksNumeric
      ? [byIdPath]
      : [bySlugPath, byNamePath]

    let res: Response | null = null
    for (const path of pathsToTry) {
      const attempt = await fetch(buildApiUrl(path))
      if (attempt.ok) {
        res = attempt
        break
      }
    }

    if (!res) throw new Error('Tournament not found or public view is not enabled')

    const info = await res.json() as TournamentInfo
    setResolvedTournamentId(info.id)
    return info
  }, [tournamentRef, looksNumeric, isDemoTournament])

  const fetchBrackets = useCallback(async (resolvedId: number, squadId: number | null) => {
    if (resolvedId === DEMO_TOURNAMENT_ID) return squadId === 102 ? [] : DEMO_BRACKET_GROUPS
    const qs = squadId ? `?squad_id=${squadId}` : ''
    const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${resolvedId}/brackets${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return (data.bracket_groups ?? []) as BracketGroup[]
  }, [])

  const fetchWinners = useCallback(async (resolvedId: number, squadId: number | null) => {
    if (resolvedId === DEMO_TOURNAMENT_ID) return squadId === 102 ? [] : DEMO_WINNERS
    const qs = squadId ? `?squad_id=${squadId}` : ''
    const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${resolvedId}/winners${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return (data.all_winners ?? []) as Winner[]
  }, [])

  const fetchScores = useCallback(async (resolvedId: number, squadId: number | null) => {
    if (resolvedId === DEMO_TOURNAMENT_ID) return squadId === 102 ? [] : DEMO_SCORES
    const qs = squadId ? `?squad_id=${squadId}` : ''
    const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${resolvedId}/scores${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data as PublicScoreRow[] : []
  }, [])

  const fetchSidePots = useCallback(async (resolvedId: number, squadId: number | null): Promise<PublicSidePotSummary[] | null> => {
    if (resolvedId === DEMO_TOURNAMENT_ID) return []
    const qs = squadId ? `?squad_id=${squadId}` : ''
    const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${resolvedId}/side-pots${qs}`))
    if (!res.ok) return null
    const data = await res.json() as { summaries?: PublicSidePotSummary[] }
    return Array.isArray(data?.summaries) ? data.summaries : []
  }, [])

  const handleShare = useCallback(() => {
    const url = window.location.href
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    } else {
      const el = document.createElement('textarea')
      el.value = url
      el.className = 'bw-visually-hidden-fixed'
      document.body.appendChild(el)
      el.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  // Session cache hydration/persistence ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  useEffect(() => {
    if (!tournamentRef) return
    setHydratedFromCache(false)

    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (!raw) {
        // No session cache ΓÇö restore just the tab preference from localStorage
        try {
          const savedTab = localStorage.getItem('bw-view-tab')
          if (savedTab === 'alive' || savedTab === 'brackets' || savedTab === 'sidePots') setTab(savedTab)
        } catch {}
        return
      }

      const cached = JSON.parse(raw) as PublicViewCache
      if (!cached?.tournament) return

      setTournament(cached.tournament)
      const cachedSquad = cached.tournament.squads.find((s) => s.id === cached.selectedSquadId)
      setSelectedSquadId(
        cachedSquad?.has_brackets === false
          ? getPreferredPublicSquadId(cached.tournament.squads)
          : cached.selectedSquadId ?? getPreferredPublicSquadId(cached.tournament.squads)
      )
      setResolvedTournamentId(cached.resolvedTournamentId ?? null)
      setBracketGroups(Array.isArray(cached.bracketGroups) ? cached.bracketGroups : [])
      setWinners(Array.isArray(cached.winners) ? cached.winners : [])
      setLastRefresh(cached.lastRefreshIso ? new Date(cached.lastRefreshIso) : new Date())
      const cachedTab = cached.activeTab
      if (cachedTab === 'alive' || cachedTab === 'brackets' || cachedTab === 'sidePots') {
        setTab(cachedTab)
      }
      setLoading(false)
      setHydratedFromCache(true)
    } catch {
      // Ignore malformed cache and fall back to normal network load.
    }
  }, [tournamentRef, cacheKey])

  useEffect(() => {
    if (!tournamentRef || !tournament) return

    const payload: PublicViewCache = {
      tournament,
      selectedSquadId,
      resolvedTournamentId,
      bracketGroups,
      winners,
      lastRefreshIso: lastRefresh.toISOString(),
      activeTab: tab,
    }

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload))
    } catch {
      // Ignore storage quota/write failures.
    }
  }, [
    tournamentRef,
    cacheKey,
    tournament,
    selectedSquadId,
    resolvedTournamentId,
    bracketGroups,
    winners,
    lastRefresh,
    tab,
  ])

  // Initial load

  useEffect(() => {
    if (!tournamentRef) return
    if (!hydratedFromCache) setLoading(true)
    setError(null)
    setResolvedTournamentId(null)
    fetchTournamentInfo()
      .then((info) => {
        setTournament(info)
        setSelectedSquadId(getPreferredPublicSquadId(info.squads))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [tournamentRef, fetchTournamentInfo, hydratedFromCache])

  useEffect(() => {
    if (!tournament?.squads.length) return
    if (selectedSquadId != null && tournament.squads.some((s) => s.id === selectedSquadId)) return
    setSelectedSquadId(getPreferredPublicSquadId(tournament.squads))
  }, [tournament, selectedSquadId])

  // Data refresh(bowlers + brackets + winners) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const refresh = useCallback(async () => {
    if (!resolvedTournamentId || refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    setIsRefreshing(true)
    try {
      const [bg, w, sr, sp] = await Promise.all([
        fetchBrackets(resolvedTournamentId, selectedSquadId),
        fetchWinners(resolvedTournamentId, selectedSquadId),
        fetchScores(resolvedTournamentId, selectedSquadId),
        fetchSidePots(resolvedTournamentId, selectedSquadId),
      ])
      const selectedSquad = tournament?.squads.find((s) => s.id === selectedSquadId)
      const preferredSquadId = tournament ? getPreferredPublicSquadId(tournament.squads) : null
      if (bg.length === 0 && selectedSquad?.has_brackets === false && preferredSquadId && preferredSquadId !== selectedSquadId) {
        setSelectedSquadId(preferredSquadId)
        return
      }
      setBracketGroups(bg)
      setWinners(w)
      setScoreRows(sr)
      setSidePotSummaries(sp ?? [])
      setLastRefresh(new Date())
      setSidePotsLoaded(sp !== null)
    } finally {
      setIsRefreshing(false)
      refreshInFlightRef.current = false
    }
  }, [resolvedTournamentId, selectedSquadId, tournament, fetchBrackets, fetchWinners, fetchScores, fetchSidePots])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-refresh every 30 s
  useEffect(() => {
    refreshTimer.current = setInterval(refresh, 30_000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [refresh])

  useEffect(() => subscribeToDataChanges(['tournaments', 'squads', 'settings', 'bowlers', 'scores', 'brackets', 'payouts'], () => {
    void refresh()
  }), [refresh])

  // Render

  if (error && !tournament) {
    let attemptedRef = (tournamentRef ?? '').trim()
    try {
      attemptedRef = decodeURIComponent(attemptedRef)
    } catch {
      // Keep raw fallback value when decode fails.
    }

    return (
      <TournamentDirectory
        subtitle="That public view link is unavailable. Try one of the active tournaments below."
        notFoundRef={attemptedRef}
      />
    )
  }

  const VIEWS: Array<{ value: Tab; label: string }> = [
    { value: 'alive', label: 'Standings' },
    { value: 'brackets', label: 'Brackets' },
    { value: 'sidePots', label: 'Side pots' },
  ]
  const bracketCount = bracketGroups.reduce((sum, group) => sum + group.brackets.length, 0)
  const bowlerCount = scoreRows.length || computeAlive(bracketGroups).length
  const highGame = scoreRows.reduce((best, row) => Math.max(best, row.game1_scratch ?? 0, row.game2_scratch ?? 0, row.game3_scratch ?? 0), 0)
  const selectedSquad = tournament?.squads.find((s) => s.id === selectedSquadId)
  const facts = [selectedSquad ? formatSquad(selectedSquad) : null, tournament?.location, bowlerCount ? `${bowlerCount} bowlers` : null].filter(Boolean).join(' · ')

  return (
    <div className={styles.shell}>
      <TopNav
        className={styles.topNav}
        navLabel="Live view sections"
        brand={(
          <span className={topNavBrandClassName()}>
            <Image src="/logo_no_text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />
            BracketWorks
          </span>
        )}
        actions={(
          <Button
            size="sm"
            variant="secondary"
            iconOnly={isPhone}
            icon={copied ? <Check size={ICON_SIZE.md} aria-hidden="true" /> : <Share2 size={ICON_SIZE.md} aria-hidden="true" />}
            aria-label={isPhone ? (copied ? 'Link copied' : 'Share live view') : undefined}
            onClick={handleShare}
            className={styles.share}
          >
            {isPhone ? null : copied ? 'Link copied' : 'Share'}
          </Button>
        )}
      >
        {isPhone ? null : VIEWS.map((view) => (
          <NavItem
            key={view.value}
            href={`#${view.value}`}
            active={tab === view.value}
            onClick={(event) => { event.preventDefault(); setTab(view.value) }}
          >
            {view.label}
          </NavItem>
        ))}
      </TopNav>

      <Page>
        {isPhone ? (
          <SegmentedControl label="Live view sections" options={VIEWS} value={tab} onChange={setTab} className={styles.phoneViews} />
        ) : null}

        <PageHeader
          title={tournament?.name ?? 'Live view'}
          description={facts || undefined}
          actions={(
            <div className={styles.headerActions}>
              {tournament && tournament.squads.length > 1 ? (
                <SelectField label="Squad" hideLabel value={selectedSquadId ?? ''} onChange={(e) => setSelectedSquadId(Number(e.target.value))}>
                  {tournament.squads.map((s) => <option key={s.id} value={s.id}>{formatSquad(s)}</option>)}
                </SelectField>
              ) : null}
              <span className={styles.meta} role="status">
                Updated {lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · auto-refresh on
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={<RefreshCw size={ICON_SIZE.md} aria-hidden="true" />}
                onClick={() => { void refresh() }}
                disabled={!resolvedTournamentId || isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          )}
        />

        {loading && !resolvedTournamentId ? (
          <Card><p className={styles.status} role="status">Loading tournament...</p></Card>
        ) : (
          <>
            <StatGroup
              label="Tournament totals"
              items={[
                { label: 'Bowlers', value: String(bowlerCount) },
                { label: 'Brackets', value: String(bracketCount) },
                { label: 'High game', value: highGame > 0 ? String(highGame) : '-', detail: highGame > 0 ? 'Scratch' : 'No scores yet' },
              ]}
            />
            {tab === 'alive' ? <StandingsView bracketGroups={bracketGroups} isPhone={isPhone} /> : null}
            {tab === 'brackets' ? <BracketsView bracketGroups={bracketGroups} isPhone={isPhone} /> : null}
            {tab === 'sidePots' ? (
              <SidePotsView
                scoreRows={scoreRows}
                sidePotSummaries={sidePotSummaries}
                sidePotsLoaded={sidePotsLoaded}
                tournamentId={resolvedTournamentId}
              />
            ) : null}
          </>
        )}

        <p className={styles.footer}>Powered by BracketWorks</p>
      </Page>
    </div>
  )
}
