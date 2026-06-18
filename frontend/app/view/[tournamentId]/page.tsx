'use client'

import { useEffect, useState, useCallback, useRef, useMemo, Fragment, useLayoutEffect } from 'react'
import { useParams } from 'next/navigation'
import { buildApiUrl } from '../../lib/api'
import { formatIsoDateShortWithWeekday } from '../../lib/formatters'
import styles from './view.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    .map(([name, stats]) => ({ name, ...stats }))
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function LiveDot() {
  return <span className={styles.liveDot} aria-label="Live" />
}

function AliveView({
  bracketGroups,
  lastRefresh,
  isRefreshing,
  canRefresh,
  onRefreshNow,
}: {
  bracketGroups: BracketGroup[]
  lastRefresh: Date
  isRefreshing: boolean
  canRefresh: boolean
  onRefreshNow: () => void
}) {
  const rows = useMemo(() => computeAlive(bracketGroups), [bracketGroups])
  const [searchQuery, setSearchQuery] = useState('')

  const hasBrackets = bracketGroups.some((group) => group.brackets.length > 0)
  const hasRounds = bracketGroups.some((group) => group.brackets.some((bracket) => (bracket.rounds?.length ?? 0) > 0))

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return rows
    return rows.filter((row) => row.name.toLowerCase().includes(normalizedSearch))
  }, [rows, normalizedSearch])

  // Always sorted: 1st/2nd desc, then G2 desc, then G1 desc, then name asc
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won
      if (b.afterG2 !== a.afterG2) return b.afterG2 - a.afterG2
      if (b.afterG1 !== a.afterG1) return b.afterG1 - a.afterG1
      return a.name.localeCompare(b.name)
    })
  }, [filteredRows])

  if (rows.length === 0) {
    if (!hasBrackets) {
      return <p className={styles.emptyNote}>No brackets generated yet. Waiting for the first bracket draw.</p>
    }
    if (!hasRounds) {
      return <p className={styles.emptyNote}>Brackets exist, but round matchups are not available yet.</p>
    }
    return <p className={styles.emptyNote}>Bracket data is live, but no progression has been recorded yet.</p>
  }

  return (
    <>
      <div className={styles.aliveControls}>
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find bowler"
            aria-label="Find bowler"
          />
          <span className={styles.countBadge}>{sortedRows.length} shown</span>
        </div>

        <div className={styles.refreshRow}>
          <span className={styles.refreshMeta}>
            Last updated {lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={styles.liveStatus}>
            <LiveDot />
            Auto-refresh on
          </span>
          <div className={styles.refreshActions}>
            <button className={styles.refreshBtn} onClick={onRefreshNow} disabled={!canRefresh || isRefreshing} type="button">
              {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <p className={styles.emptyNote}>No bowlers match this search for the selected squad.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bowler</th>
                <th className={styles.thCenter}>
                  <span className={styles.thFull}>After Game 1</span>
                  <span className={styles.thShort}>G1</span>
                </th>
                <th className={styles.thCenter}>
                  <span className={styles.thFull}>After Game 2</span>
                  <span className={styles.thShort}>G2</span>
                </th>
                <th className={styles.thCenter}>1st/2nd</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.name} className={styles.tableRow}>
                  <td className={styles.tdName}>{row.name}</td>
                  <td className={styles.tdCenter}>
                    <span className={row.afterG1 > 0 ? styles.aliveNum : styles.elimNum}>{row.afterG1}</span>
                  </td>
                  <td className={styles.tdCenter}>
                    <span className={row.afterG2 > 0 ? styles.aliveNum : styles.elimNum}>{row.afterG2}</span>
                  </td>
                  <td className={styles.tdCenter}>
                    <span className={row.won > 0 ? styles.wonNum : styles.elimNum}>{row.won}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function MatchCard({
  match,
  label = 'Match',
  className = '',
  highlightName,
  onNameClick,
}: {
  match: MatchData
  label?: string
  className?: string
  highlightName?: string
  onNameClick?: (name: string) => void
}) {
  const isComplete = match.winner || match.both_advance || match.split_pot
  const playerAWon = match.winner === 'A'
  const playerBWon = match.winner === 'B'
  const isBye = match.playerB === 'BYE' || match.playerA === 'BYE'
  const isLive = match.status === 'in_progress'
  const statusClass = isLive
    ? styles.matchInProgress
    : match.status === 'completed'
      ? styles.matchCompleted
      : match.status === 'next_up'
        ? styles.matchNextUp
        : styles.matchPending

  const margin =
    isComplete && !match.both_advance && !match.split_pot &&
    match.scoreA != null && match.scoreB != null && match.playerB !== 'BYE' && match.playerA !== 'BYE'
      ? Math.abs(match.scoreA - match.scoreB)
      : null

  const hlA = highlightName ? match.playerA === highlightName : false
  const hlB = highlightName ? match.playerB === highlightName : false
  const dimA = highlightName && !hlA
  const dimB = highlightName && !hlB

  return (
    <div
      className={`${styles.matchCard} ${statusClass} ${isComplete ? styles.matchComplete : ''} ${isBye ? styles.matchBye : ''} ${isLive ? styles.matchLive : ''} ${className}`}
    >
      <div className={styles.matchLabelRow}>
        <span className={styles.matchLabel}>{label}</span>
        {margin !== null && <span className={styles.matchMargin}>+{margin}</span>}
      </div>

      <div data-highlighted={hlA ? 'true' : undefined} className={`${styles.matchSlot} ${playerAWon ? styles.winner : ''} ${match.playerB === 'BYE' ? styles.autoWin : ''} ${hlA ? styles.matchSlotHighlight : ''} ${dimA ? styles.matchSlotDim : ''}`}>
        <span
          className={`${styles.matchName} ${onNameClick && match.playerA && match.playerA !== 'BYE' ? styles.matchNameClickable : ''}`}
          onClick={() => match.playerA && match.playerA !== 'BYE' && onNameClick?.(match.playerA)}
        >{match.playerA || ''}</span>
        {match.scoreA != null && <span className={styles.matchScore}>{match.scoreA}</span>}
      </div>
      <div className={styles.vsRow}>vs</div>
      <div data-highlighted={hlB ? 'true' : undefined} className={`${styles.matchSlot} ${playerBWon ? styles.winner : ''} ${match.playerA === 'BYE' ? styles.autoWin : ''} ${hlB ? styles.matchSlotHighlight : ''} ${dimB ? styles.matchSlotDim : ''}`}>
        <span
          className={`${styles.matchName} ${onNameClick && match.playerB && match.playerB !== 'BYE' ? styles.matchNameClickable : ''}`}
          onClick={() => match.playerB && match.playerB !== 'BYE' && onNameClick?.(match.playerB)}
        >{match.playerB === 'BYE' ? 'BYE' : (match.playerB || '')}</span>
        {match.scoreB != null && match.playerB !== 'BYE' && <span className={styles.matchScore}>{match.scoreB}</span>}
      </div>
      {match.split_pot && <div className={styles.matchBadge}>Split</div>}
      {match.both_advance && <div className={styles.matchBadge}>Both Advance</div>}
    </div>
  )
}

function bracketWinner(bracket: BracketData): string | null {
  const rounds = bracket.rounds ?? []
  if (rounds.length < 2) return null
  const lastRound = rounds[rounds.length - 1]
  if (!lastRound) return null
  for (const m of lastRound.matches) {
    if (m.winner === 'A' && m.playerA && m.playerA !== 'BYE') return m.playerA
    if (m.winner === 'B' && m.playerB && m.playerB !== 'BYE') return m.playerB
  }
  return null
}

function BracketView({ group, highlightName, onNameClick }: {
  group: BracketGroup
  highlightName: string
  onNameClick: (name: string) => void
}) {
  const [activeBracket, setActiveBracket] = useState(0)
  const treeWrapRef = useRef<HTMLDivElement>(null)
  const treeGridRef = useRef<HTMLDivElement>(null)
  const bracket = group.brackets[activeBracket]
  const totalBrackets = group.brackets.length
  const rounds = bracket?.rounds ?? []
  const treeRounds = rounds.slice(0, 3)
  const totalRows = (treeRounds[0]?.matches.length ?? 0) * 2
  const canRenderTree = treeRounds.length > 0 && totalRows > 0
  const treeColumns = treeRounds.length === 1 ? 1 : treeRounds.length === 2 ? 4 : 7
  const winner = bracketWinner(bracket ?? { rounds: [] })

  useEffect(() => {
    const treeGridScaledClass = styles.bracketTreeGridScaled
    const treeWrapScaledClass = styles.bracketTreeWrapScaled

    const resetTreeScale = () => {
      if (treeGridRef.current) {
        if (treeGridScaledClass) treeGridRef.current.classList.remove(treeGridScaledClass)
        treeGridRef.current.style.removeProperty('--bw-view-tree-scale')
      }
      if (treeWrapRef.current) {
        if (treeWrapScaledClass) treeWrapRef.current.classList.remove(treeWrapScaledClass)
        treeWrapRef.current.style.removeProperty('--bw-view-tree-height')
      }
    }

    if (!canRenderTree) {
      resetTreeScale()
      return
    }

    const recalcTreeFit = () => {
      const wrap = treeWrapRef.current
      const grid = treeGridRef.current
      if (!wrap || !grid) return

      const isMobile = window.matchMedia('(max-width: 600px)').matches
      if (!isMobile) {
        resetTreeScale()
        return
      }

      const availableWidth = wrap.clientWidth
      const naturalWidth = grid.scrollWidth
      const naturalHeight = grid.scrollHeight
      if (!availableWidth || !naturalWidth || !naturalHeight) return

      const nextScale = Math.min(1, availableWidth / naturalWidth)
      if (nextScale < 1) {
        if (treeGridScaledClass) grid.classList.add(treeGridScaledClass)
        if (treeWrapScaledClass) wrap.classList.add(treeWrapScaledClass)
        grid.style.setProperty('--bw-view-tree-scale', String(nextScale))
        wrap.style.setProperty('--bw-view-tree-height', `${Math.ceil(naturalHeight * nextScale)}px`)
      } else {
        resetTreeScale()
      }
    }

    const raf = window.requestAnimationFrame(recalcTreeFit)
    window.addEventListener('resize', recalcTreeFit)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', recalcTreeFit)
      resetTreeScale()
    }
  }, [canRenderTree, activeBracket, treeColumns, totalRows])


  // Jump to the bracket containing the highlighted bowler
  useEffect(() => {
    if (!highlightName) return
    const nameL = highlightName.toLowerCase()
    for (let bi = 0; bi < group.brackets.length; bi++) {
      const b = group.brackets[bi]
      if (!b) continue
      for (const r of (b.rounds ?? [])) {
        for (const m of r.matches) {
          if (
            (m.playerA && m.playerA.toLowerCase() === nameL) ||
            (m.playerB && m.playerB.toLowerCase() === nameL)
          ) {
            setActiveBracket(bi)
            return
          }
        }
      }
    }
  }, [highlightName, group.brackets])

  // Scroll highlighted match into view after bracket navigation settles
  useLayoutEffect(() => {
    if (!highlightName) return
    const id = setTimeout(() => {
      const el = treeWrapRef.current?.querySelector('[data-highlighted="true"]') as HTMLElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(id)
  }, [highlightName, activeBracket])

  const labelForRound = (roundIndex: number) => {
    if (roundIndex === 2) return 'Final'
    if (roundIndex === 1) return 'Semifinal'
    return 'Match'
  }

  const hl = highlightName || undefined

  const pillIndices = useMemo(() => {
    const w = typeof window !== 'undefined'
      ? window.innerWidth >= 900 ? 11 : window.innerWidth >= 600 ? 9 : window.innerWidth >= 400 ? 7 : 5
      : 7
    if (totalBrackets <= w) {
      return Array.from({ length: totalBrackets }, (_, i) => i)
    }
    const half = Math.floor(w / 2)
    let start = activeBracket - half
    let end = activeBracket + half
    if (start < 0) { end -= start; start = 0 }
    if (end >= totalBrackets) { start -= (end - totalBrackets + 1); end = totalBrackets - 1 }
    start = Math.max(0, start)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [totalBrackets, activeBracket])

  const firstPillIndex = pillIndices[0] ?? 0
  const lastPillIndex = pillIndices[pillIndices.length - 1] ?? 0

  return (
    <div className={styles.bracketView}>
      {/* Pill carousel */}
      {totalBrackets > 1 && (
        <div className={styles.bracketPillsNav}>
          <button
            type="button"
            className={styles.bracketPillsArrow}
            disabled={activeBracket === 0}
            onClick={() => setActiveBracket((prev) => Math.max(0, prev - 1))}
            aria-label="Previous bracket"
          >Prev</button>
          <div className={styles.bracketPills}>
            {firstPillIndex > 0 && (
              <>
                <button type="button" className={styles.bracketPill} onClick={() => setActiveBracket(0)} aria-label="Bracket 1">1</button>
                {firstPillIndex > 1 && <span className={styles.bracketPillEllipsis}>...</span>}
              </>
            )}
            {pillIndices.map((i) => (
              <button
                key={i}
                type="button"
                className={`${styles.bracketPill} ${activeBracket === i ? styles.bracketPillActive : ''}`}
                onClick={() => setActiveBracket(i)}
                aria-label={`Bracket ${i + 1}`}
              >{i + 1}</button>
            ))}
            {lastPillIndex < totalBrackets - 1 && (
              <>
                {lastPillIndex < totalBrackets - 2 && <span className={styles.bracketPillEllipsis}>...</span>}
                <button type="button" className={styles.bracketPill} onClick={() => setActiveBracket(totalBrackets - 1)} aria-label={`Bracket ${totalBrackets}`}>{totalBrackets}</button>
              </>
            )}
          </div>
          <button
            type="button"
            className={styles.bracketPillsArrow}
            disabled={activeBracket === totalBrackets - 1}
            onClick={() => setActiveBracket((prev) => Math.min(totalBrackets - 1, prev + 1))}
            aria-label="Next bracket"
          >Next</button>
        </div>
      )}

      {/* Winner callout */}
      {winner && (
        <div className={styles.bracketWinnerBanner}>
          <span className={styles.bracketWinnerLabel}>Winner</span>
          <span className={styles.bracketWinnerName}>{winner}</span>
        </div>
      )}

      {rounds.length === 0 ? (
        <p className={styles.emptyNote}>No rounds yet.</p>
      ) : (
        <>
          {canRenderTree ? (
            <>
              <div
                className={styles.bracketTreeWrap}
                ref={treeWrapRef}
              >
                <div
                  className={`${styles.bracketTreeGrid} ${treeRounds.length === 1 ? styles.treeGrid1Col : treeRounds.length === 2 ? styles.treeGrid4Col : styles.treeGrid7Col}`}
                  ref={treeGridRef}
                >
                  {treeRounds[0]?.matches.map((match, mi) => (
                    <MatchCard
                      key={`r0-m${mi}`}
                      match={match}
                      label={labelForRound(0)}
                      highlightName={hl}
                      onNameClick={onNameClick}
                      className={[styles.r1m1, styles.r1m2, styles.r1m3, styles.r1m4][mi] ?? ''}
                    />
                  ))}

                  {treeRounds[1]?.matches.map((match, mi) => (
                    <MatchCard
                      key={`r1-m${mi}`}
                      match={match}
                      label={labelForRound(1)}
                      highlightName={hl}
                      onNameClick={onNameClick}
                      className={[styles.r2m1, styles.r2m2][mi] ?? ''}
                    />
                  ))}

                  {treeRounds[2]?.matches.map((match, mi) => (
                    <MatchCard
                      key={`r2-m${mi}`}
                      match={match}
                      label={labelForRound(2)}
                      className={`${styles.finalsCard} ${styles.r3m1}`}
                      highlightName={hl}
                      onNameClick={onNameClick}
                    />
                  ))}

                  {treeRounds[1]?.matches.map((_, i) => (
                    <Fragment key={`c-r1-wrap-${i}`}>
                      <div className={`${styles.connectorBracket} ${i === 0 ? styles.connR1R2Bracket1 : styles.connR1R2Bracket2}`} />
                      <div className={`${styles.connectorArm} ${i === 0 ? styles.connR1R2Arm1 : styles.connR1R2Arm2}`} />
                    </Fragment>
                  ))}

                  {treeRounds[2]?.matches.map((_, i) => (
                    <Fragment key={`c-r2-wrap-${i}`}>
                      <div className={`${styles.connectorBracket} ${styles.connR2R3Bracket}`} />
                      <div className={`${styles.connectorArm} ${styles.connR2R3Arm}`} />
                    </Fragment>
                  ))}
                </div>
              </div>

              {rounds.length > 3 && (
                <div className={styles.bracketRoundsExtra}>
                  {rounds.slice(3).map((round, ri) => (
                    <div key={`extra-${ri}`} className={styles.bracketRound}>
                      <div className={styles.roundLabel}>{round.name || `Round ${ri + 4}`}</div>
                      <div className={styles.roundMatches}>
                        {round.matches.map((match, mi) => (
                          <MatchCard key={mi} match={match} highlightName={hl} onNameClick={onNameClick} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={styles.bracketRounds}>
              {rounds.map((round, ri) => (
                <div key={ri} className={styles.bracketRound}>
                  <div className={styles.roundLabel}>{round.name || `Round ${ri + 1}`}</div>
                  <div className={styles.roundMatches}>
                    {round.matches.map((match, mi) => (
                      <MatchCard key={mi} match={match} highlightName={hl} onNameClick={onNameClick} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BracketsTabView({ bracketGroups }: { bracketGroups: BracketGroup[] }) {
  const [activeGroup, setActiveGroup] = useState(0)
  const [bracketSearch, setBracketSearch] = useState('')
  const [highlightName, setHighlightName] = useState('')

  const handleNameClick = useCallback((name: string) => {
    setHighlightName((prev) => (prev === name ? '' : name))
  }, [])

  // Auto-navigate to the group containing the highlighted bowler
  useEffect(() => {
    if (!highlightName) return
    const nameL = highlightName.toLowerCase()
    for (let gi = 0; gi < bracketGroups.length; gi++) {
      const grp = bracketGroups[gi]
      if (!grp) continue
      for (const b of grp.brackets) {
        for (const r of (b.rounds ?? [])) {
          for (const m of r.matches) {
            if (
              (m.playerA && m.playerA.toLowerCase() === nameL) ||
              (m.playerB && m.playerB.toLowerCase() === nameL)
            ) {
              setActiveGroup(gi)
              return
            }
          }
        }
      }
    }
  }, [highlightName, bracketGroups])

  if (bracketGroups.length === 0) {
    return (
      <div className={styles.section}>
        <p className={styles.emptyNote}>No brackets generated yet.</p>
      </div>
    )
  }

  const group = bracketGroups[activeGroup] ?? bracketGroups[0]
  if (!group) {
    return (
      <div className={styles.section}>
        <p className={styles.emptyNote}>No brackets generated yet.</p>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      {/* Group tabs */}
      {bracketGroups.length > 1 && (
        <div className={styles.bracketGroupTabs}>
          {bracketGroups.map((g, i) => (
            <button
              key={g.key}
              type="button"
              className={`${styles.bracketGroupTab} ${activeGroup === i ? styles.bracketGroupTabActive : ''}`}
              onClick={() => setActiveGroup(i)}
            >{g.name}</button>
          ))}
        </div>
      )}

      {/* Bowler search / jump */}
      <div className={styles.bracketSearchRow}>
        <input
          type="search"
          className={styles.bracketSearchInput}
          placeholder="Highlight a bowler..."
          value={bracketSearch}
          onChange={(e) => {
            const val = e.target.value
            setBracketSearch(val)
            if (!val.trim()) { setHighlightName(''); return }
            // Auto-highlight when query matches exactly one name in any bracket
            const allNames = new Set<string>()
            for (const b of group.brackets) {
              for (const r of (b.rounds ?? [])) {
                for (const m of r.matches) {
                  if (m.playerA && m.playerA !== 'BYE') allNames.add(m.playerA)
                  if (m.playerB && m.playerB !== 'BYE') allNames.add(m.playerB)
                }
              }
            }
            const q = val.trim().toLowerCase()
            const matches = [...allNames].filter((n) => n.toLowerCase().includes(q))
            setHighlightName(matches.length === 1 ? (matches[0] ?? val.trim()) : val.trim())
          }}
        />
        {highlightName && (
          <button
            type="button"
            className={styles.bracketSearchClear}
            onClick={() => { setBracketSearch(''); setHighlightName('') }}
            aria-label="Clear highlight"
          >✕</button>
        )}
      </div>

      {group.brackets.length === 0 ? (
        <p className={styles.emptyNote}>No brackets in this group.</p>
      ) : (
        <div className={styles.groupSection}>
          {bracketGroups.length === 1 && (
            <h2 className={styles.groupTitle}>{group.name}</h2>
          )}
          <BracketView group={group} highlightName={highlightName} onNameClick={handleNameClick} />
        </div>
      )}
    </div>
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
    if (valid.length === 0) continue
    candidates.push({ name: row.player_name, score: valid.reduce((s, v) => s + v, 0) })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, n)
}

function SidePotsLeaderboard({ scoreRows, tournamentId, lastRefresh, isRefreshing }: {
  scoreRows: PublicScoreRow[]
  tournamentId: number | null
  lastRefresh: Date | null
  isRefreshing: boolean
}) {
  const [settingsRefreshKey, setSettingsRefreshKey] = useState(0)
  const [enabledSidePotKeys, setEnabledSidePotKeys] = useState<Set<string>>(new Set())
  const [sidePotEntriesMap, setSidePotEntriesMap] = useState<SidePotEntriesByPlayer>({})
  const [hasSidePotSettings, setHasSidePotSettings] = useState(false)
  const [hasSidePotEntriesMap, setHasSidePotEntriesMap] = useState(false)

  useEffect(() => {
    const handleSettingsChanged = () => {
      setSettingsRefreshKey(prev => prev + 1)
    }
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

    const settingsKey = `sidePots_${tournamentId}`
    const entriesKey = `sidePotEntries_${tournamentId}`
    const rawSettings = localStorage.getItem(settingsKey)
    const rawEntries = localStorage.getItem(entriesKey)

    setHasSidePotSettings(rawSettings !== null)
    setHasSidePotEntriesMap(rawEntries !== null)

    try {
      if (!rawSettings) {
        setEnabledSidePotKeys(new Set())
      } else {
        const parsed = JSON.parse(rawSettings) as StoredSidePotsSettings
        const enabledKeys = new Set(
          (parsed.pots ?? [])
            .filter(pot => Boolean(pot.enabled))
            .map(pot => pot.key),
        )
        setEnabledSidePotKeys(enabledKeys)
      }
    } catch {
      setEnabledSidePotKeys(new Set())
    }

    try {
      if (!rawEntries) {
        setSidePotEntriesMap({})
      } else {
        setSidePotEntriesMap(JSON.parse(rawEntries) as SidePotEntriesByPlayer)
      }
    } catch {
      setSidePotEntriesMap({})
    }
  }, [tournamentId, settingsRefreshKey])

  const getEligiblePlayerIds = useCallback((potKey: string): Set<number> | null => {
    // Only enforce opt-in filtering when this browser has both settings and entries data.
    if (!hasSidePotSettings || !hasSidePotEntriesMap) return null
    if (!enabledSidePotKeys.has(potKey)) return null

    const eligible = new Set<number>()
    for (const row of scoreRows) {
      const byPlayer = sidePotEntriesMap[String(row.player_id)]
      if (byPlayer?.[potKey]) {
        eligible.add(row.player_id)
      }
    }
    return eligible
  }, [enabledSidePotKeys, hasSidePotEntriesMap, hasSidePotSettings, scoreRows, sidePotEntriesMap])

  const highGameScratchEligible = useMemo(() => getEligiblePlayerIds('high_game_scratch'), [getEligiblePlayerIds])
  const highGameHandicapEligible = useMemo(() => getEligiblePlayerIds('high_game_handicap'), [getEligiblePlayerIds])
  const highSeriesScratchEligible = useMemo(() => getEligiblePlayerIds('high_series_scratch'), [getEligiblePlayerIds])
  const highSeriesHandicapEligible = useMemo(() => getEligiblePlayerIds('high_series_handicap'), [getEligiblePlayerIds])

  if (scoreRows.length === 0) {
    return <p className={styles.emptyNote}>No scores yet. Check back during the tournament.</p>
  }

  if (hasSidePotSettings && enabledSidePotKeys.size === 0) {
    return <p className={styles.emptyNote}>No side pots are enabled for this tournament.</p>
  }

  const showHighGameScratch = !hasSidePotSettings || enabledSidePotKeys.has('high_game_scratch')
  const showHighSeriesScratch = !hasSidePotSettings || enabledSidePotKeys.has('high_series_scratch')
  const showHighGameHandicap = !hasSidePotSettings || enabledSidePotKeys.has('high_game_handicap')
  const showHighSeriesHandicap = !hasSidePotSettings || enabledSidePotKeys.has('high_series_handicap')

  const showScratchSection = showHighGameScratch || showHighSeriesScratch
  const showHandicapSection = showHighGameHandicap || showHighSeriesHandicap

  const placeLabel = (i: number) => i === 0 ? '1st' : i === 1 ? '2nd' : '3rd'

  const renderCard = (label: string, leaders: Leader[]) => (
    <div key={label} className={styles.sidePotCard}>
      <div className={styles.sidePotCardLabel}>{label}</div>
      {leaders.length === 0 ? (
        <div className={styles.sidePotPending}>Pending</div>
      ) : (
        <ol className={styles.sidePotPodium}>
          {leaders.map((l, i) => (
            <li key={i} className={`${styles.sidePotPodiumRow} ${i === 0 ? styles.sidePotPodiumFirst : ''}`}>
              <span className={styles.sidePotPodiumPlace}>{placeLabel(i)}</span>
              <span className={styles.sidePotPodiumName}>{l.name}</span>
              <span className={styles.sidePotPodiumScore}>{l.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )

  const gameCategories = [
    { label: 'Game 1', scratchField: 'game1_scratch' as const, handicapField: 'game1_with_handicap' as const },
    { label: 'Game 2', scratchField: 'game2_scratch' as const, handicapField: 'game2_with_handicap' as const },
    { label: 'Game 3', scratchField: 'game3_scratch' as const, handicapField: 'game3_with_handicap' as const },
  ]

  const lastRefreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className={styles.sidePotLeaderboard}>
      <div className={styles.sidePotRefreshRow}>
        <span className={`${styles.liveDot} ${isRefreshing ? styles.liveDotRefreshing : ''}`} />
        <span className={styles.sidePotRefreshMeta}>
          {isRefreshing ? 'Refreshing...' : lastRefreshLabel ? `Updated ${lastRefreshLabel}` : 'Live'}
        </span>
      </div>
      {showScratchSection && (
        <div className={styles.sidePotSection}>
          <div className={styles.sidePotSectionTitle}>Scratch</div>
          <div className={styles.sidePotGrid}>
            {showHighGameScratch && gameCategories.map(c =>
              renderCard(c.label, getTopN(scoreRows, c.scratchField, 3, highGameScratchEligible))
            )}
            {showHighSeriesScratch && renderCard('Series', getSeriesTopN(scoreRows, 'scratch', 3, highSeriesScratchEligible))}
          </div>
        </div>
      )}
      {showHandicapSection && (
        <div className={styles.sidePotSection}>
          <div className={styles.sidePotSectionTitle}>Handicap</div>
          <div className={styles.sidePotGrid}>
            {showHighGameHandicap && gameCategories.map(c =>
              renderCard(c.label, getTopN(scoreRows, c.handicapField, 3, highGameHandicapEligible))
            )}
            {showHighSeriesHandicap && renderCard('Series', getSeriesTopN(scoreRows, 'handicap', 3, highSeriesHandicapEligible))}
          </div>
        </div>
      )}
    </div>
  )
}

function WinnersView({ winners }: { winners: Winner[] }) {
  if (winners.length === 0) {
    return <p className={styles.emptyNote}>No winners recorded yet. Brackets in progress.</p>
  }

  // Group by bracket name
  const byBracket: Record<string, Winner[]> = {}
  for (const w of winners) {
    const key = w.bracket_name || 'Unknown'
    if (!byBracket[key]) byBracket[key] = []
    byBracket[key].push(w)
  }

  const placeLabel = (place?: number) => {
    if (!place) return ''
    if (place === 1) return '1st'
    if (place === 2) return '2nd'
    if (place === 3) return '3rd'
    return `${place}th`
  }

  return (
    <div className={styles.winnersGrid}>
      {Object.entries(byBracket).map(([bracketName, ws]) => (
        <div key={bracketName} className={styles.winnerCard}>
          <div className={styles.winnerCardTitle}>{bracketName}</div>
          {ws
            .sort((a, b) => (a.place ?? 9) - (b.place ?? 9))
            .map((w, i) => (
              <div key={i} className={styles.winnerRow}>
                <span className={styles.winnerPlace}>{placeLabel(w.place)}</span>
                <span className={styles.winnerName}>{w.player_name || w.name || ''}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentViewPage() {
  const params = useParams()
  const tournamentRef = params?.tournamentId as string
  const cacheKey = `bw-public-view:${(tournamentRef ?? '').trim().toLowerCase()}`

  const [tab, setTab] = useState<Tab>('alive')
  const [tournament, setTournament] = useState<TournamentInfo | null>(null)
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null)
  const [resolvedTournamentId, setResolvedTournamentId] = useState<number | null>(null)
  const [bracketGroups, setBracketGroups] = useState<BracketGroup[]>([])
  const [winners, setWinners] = useState<Winner[]>([])
  const [scoreRows, setScoreRows] = useState<PublicScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hydratedFromCache, setHydratedFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshInFlightRef = useRef(false)

  // Persist tab preference to localStorage across sessions
    const [copied, setCopied] = useState(false)
  useEffect(() => {
    try { localStorage.setItem('bw-view-tab', tab) } catch {}
  }, [tab])

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const looksNumeric = /^\d+$/.test((tournamentRef ?? '').trim())

  const fetchTournamentInfo = useCallback(async () => {
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
  }, [tournamentRef, looksNumeric])

  const fetchBrackets = useCallback(async (resolvedId: number, squadId: number | null) => {
    const qs = squadId ? `?squad_id=${squadId}` : ''
    const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${resolvedId}/brackets${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return (data.bracket_groups ?? []) as BracketGroup[]
  }, [])

  const fetchWinners = useCallback(async (resolvedId: number, squadId: number | null) => {
    const qs = squadId ? `?squad_id=${squadId}` : ''
    const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${resolvedId}/winners${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return (data.all_winners ?? []) as Winner[]
  }, [])

  const fetchScores = useCallback(async (resolvedId: number, squadId: number | null) => {
    const qs = squadId ? `?squad_id=${squadId}` : ''
    const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${resolvedId}/scores${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data as PublicScoreRow[] : []
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

  // ── Session cache hydration/persistence ───────────────────────────────────

  useEffect(() => {
    if (!tournamentRef) return
    setHydratedFromCache(false)

    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (!raw) {
        // No session cache — restore just the tab preference from localStorage
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

  // ── Initial load ───────────────────────────────────────────────────────────

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

  // ── Data refresh (bowlers + brackets + winners) ────────────────────────────

  const refresh = useCallback(async () => {
    if (!resolvedTournamentId || refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    setIsRefreshing(true)
    try {
      const [bg, w, sr] = await Promise.all([
        fetchBrackets(resolvedTournamentId, selectedSquadId),
        fetchWinners(resolvedTournamentId, selectedSquadId),
        fetchScores(resolvedTournamentId, selectedSquadId),
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
      setLastRefresh(new Date())
    } finally {
      setIsRefreshing(false)
      refreshInFlightRef.current = false
    }
  }, [resolvedTournamentId, selectedSquadId, tournament, fetchBrackets, fetchWinners, fetchScores])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-refresh every 30 s
  useEffect(() => {
    refreshTimer.current = setInterval(refresh, 30_000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [refresh])

  // ─── Render ────────────────────────────────────────────────────────────────

  if (error && !tournament) {
    return (
      <div className={styles.errorScreen}>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTop}>
            {/* Left: logo + brand */}
            <div className={styles.brandCol}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static branding mark is intentionally rendered as plain img in the public header */}
              <img
                src="/logo 2.svg"
                alt="BracketWorks"
                className={styles.brandLogo}
              />
              <div className={styles.brandText}>
                <p className={styles.brandEyebrow}>
                  BracketWorks <span className={styles.brandSep}>&middot;</span> Public Tournament View
                </p>
                <p className={styles.brandSubline}>
                  {tournament?.name ?? ''}{tournament?.location ? ` · ${tournament.location}` : ''}
                </p>
              </div>
            </div>

            {/* Centre: squad selector + tabs */}
            <div className={styles.controlsPanel}>
              <div className={styles.controlsTopRow}>
                {tournament && tournament.squads.length > 1 && (
                  <div className={styles.squadSelector}>
                    <label className={styles.squadLabel}>Squad</label>
                    <select
                      className={styles.squadSelect}
                      value={selectedSquadId ?? ''}
                      onChange={(e) => setSelectedSquadId(Number(e.target.value))}
                    >
                      {tournament.squads.map((s) => (
                        <option key={s.id} value={s.id}>{formatSquad(s)}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ''}`}
                  onClick={handleShare}
                  title="Copy link to share with bowlers"
                >
                  <span className={styles.shareBtnIcon} aria-hidden="true">↗</span>
                  <span>{copied ? 'Link Copied' : 'Share View'}</span>
                </button>
              </div>

              <nav className={styles.tabs} aria-label="View sections">
                <div className={styles.tabsTrack}>
                  {(['alive', 'brackets', 'sidePots'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                      onClick={() => setTab(t)}
                    >
                      {t === 'alive' && <><span className={styles.thFull}>Bracket Summary</span><span className={styles.thShort}>Summary</span></>}
                      {t === 'brackets' && 'Brackets'}
                      {t === 'sidePots' && <><span className={styles.thFull}>Side Pots</span><span className={styles.thShort}>Side Pots</span></>}
                    </button>
                  ))}
                </div>
              </nav>
            </div>

          </div>
        </div>
      </header>

      {/* Content */}
      <main className={styles.main}>
        {loading && !resolvedTournamentId ? (
          <div className={styles.section}>
            <div className={styles.loadingScreen}>
              <div className={styles.spinner} />
              <p>Loading tournament...</p>
            </div>
          </div>
        ) : (

          <>
            {/* ── Alive tab ── */}
            {tab === 'alive' && (
              <div className={styles.section}>
                <AliveView
                  bracketGroups={bracketGroups}
                  lastRefresh={lastRefresh}
                  isRefreshing={isRefreshing}
                  canRefresh={Boolean(resolvedTournamentId)}
                  onRefreshNow={() => { void refresh() }}
                />
              </div>
            )}

            {/* ── Brackets tab ── */}
            {tab === 'brackets' && (
              <BracketsTabView bracketGroups={bracketGroups} />
            )}

            {/* ── Side Pots tab ── */}
            {tab === 'sidePots' && (
              <div className={styles.section}>
                <SidePotsLeaderboard
                  scoreRows={scoreRows}
                  tournamentId={resolvedTournamentId}
                  lastRefresh={lastRefresh}
                  isRefreshing={isRefreshing}
                />
              </div>
            )}
          </>
        )}

      </main>

    </div>
  )
}
