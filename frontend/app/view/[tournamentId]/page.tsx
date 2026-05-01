'use client'

import { useEffect, useState, useCallback, useRef, CSSProperties, Fragment } from 'react'
import { useParams } from 'next/navigation'
import { buildApiUrl } from '../../lib/api'
import styles from './view.module.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Squad {
  id: number
  date: string
  time: string
}

interface TournamentInfo {
  id: number
  name: string
  location?: string
  squads: Squad[]
}

interface AliveRow {
  name: string
  total: number
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

interface PublicViewCache {
  tournament: TournamentInfo
  selectedSquadId: number | null
  resolvedTournamentId: number | null
  bracketGroups: BracketGroup[]
  winners: Winner[]
  lastRefreshIso: string
}

type Tab = 'alive' | 'brackets' | 'sidePots'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeAlive(bracketGroups: BracketGroup[]): AliveRow[] {
  const data: Record<string, { total: number; afterG1: number; afterG2: number; won: number }> = {}

  const ensure = (name: string) => {
    if (!data[name]) data[name] = { total: 0, afterG1: 0, afterG2: 0, won: 0 }
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

      // Count all participants from round 0
      for (const m of rounds[0].matches) {
        if (m.playerA && m.playerA !== 'BYE') { ensure(m.playerA); data[m.playerA].total++ }
        if (m.playerB && m.playerB !== 'BYE') { ensure(m.playerB); data[m.playerB].total++ }
      }

      // After Game 1: advanced from round 0
      for (const p of advancers_from(rounds[0])) { ensure(p); data[p].afterG1++ }

      // After Game 2: advanced from round 1 (if it exists)
      if (rounds.length > 1) {
        for (const p of advancers_from(rounds[1])) { ensure(p); data[p].afterG2++ }
      }

      // Won: advanced from the last round (only meaningful if ≥2 rounds)
      if (rounds.length >= 2) {
        for (const p of advancers_from(rounds[rounds.length - 1])) { ensure(p); data[p].won++ }
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
  const date = s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : ''
  return `${date} ${s.time}`.trim()
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LiveDot() {
  return <span className={styles.liveDot} aria-label="Live" />
}

function AliveView({ bracketGroups }: { bracketGroups: BracketGroup[] }) {
  const rows = computeAlive(bracketGroups)

  if (rows.length === 0) {
    return <p className={styles.emptyNote}>No bracket data yet. Check back after brackets are generated.</p>
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Bowler</th>
            <th className={styles.thCenter}>Brackets</th>
            <th className={styles.thCenter}>After Game 1</th>
            <th className={styles.thCenter}>After Game 2</th>
            <th className={styles.thCenter}>Won</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className={styles.tableRow}>
              <td className={styles.tdName}>{row.name}</td>
              <td className={styles.tdCenter}>{row.total}</td>
              <td className={styles.tdCenter}>
                <span className={row.afterG1 > 0 ? styles.aliveNum : styles.elimNum}>
                  {row.afterG1}
                </span>
              </td>
              <td className={styles.tdCenter}>
                <span className={row.afterG2 > 0 ? styles.aliveNum : styles.elimNum}>
                  {row.afterG2}
                </span>
              </td>
              <td className={styles.tdCenter}>
                <span className={row.won > 0 ? styles.wonNum : styles.elimNum}>
                  {row.won}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatchCard({
  match,
  label = 'Match',
  className = '',
  style,
}: {
  match: MatchData
  label?: string
  className?: string
  style?: CSSProperties
}) {
  const isComplete = match.winner || match.both_advance || match.split_pot
  const playerAWon = match.winner === 'A'
  const playerBWon = match.winner === 'B'
  const isBye = match.playerB === 'BYE' || match.playerA === 'BYE'
  const statusClass = match.status === 'in_progress'
    ? styles.matchInProgress
    : match.status === 'completed'
      ? styles.matchCompleted
      : match.status === 'next_up'
        ? styles.matchNextUp
        : styles.matchPending

  return (
    <div
      className={`${styles.matchCard} ${statusClass} ${isComplete ? styles.matchComplete : ''} ${isBye ? styles.matchBye : ''} ${className}`}
      style={style}
    >
      <div className={styles.matchLabelRow}>
        <span className={styles.matchLabel}>{label}</span>
      </div>

      <div className={`${styles.matchSlot} ${playerAWon ? styles.winner : ''} ${match.playerB === 'BYE' ? styles.autoWin : ''}`}>
        <span className={styles.matchName}>{match.playerA || '—'}</span>
        {match.scoreA != null && <span className={styles.matchScore}>{match.scoreA}</span>}
      </div>
      <div className={styles.vsRow}>vs</div>
      <div className={`${styles.matchSlot} ${playerBWon ? styles.winner : ''} ${match.playerA === 'BYE' ? styles.autoWin : ''}`}>
        <span className={styles.matchName}>{match.playerB === 'BYE' ? 'BYE' : (match.playerB || '—')}</span>
        {match.scoreB != null && match.playerB !== 'BYE' && <span className={styles.matchScore}>{match.scoreB}</span>}
      </div>
      {match.split_pot && <div className={styles.matchBadge}>Split</div>}
      {match.both_advance && <div className={styles.matchBadge}>Both ↑</div>}
    </div>
  )
}

function BracketView({ group }: { group: BracketGroup }) {
  const [activeBracket, setActiveBracket] = useState(0)
  const bracket = group.brackets[activeBracket]
  const totalBrackets = group.brackets.length
  const rounds = bracket?.rounds ?? []
  const treeRounds = rounds.slice(0, 3)
  const totalRows = (treeRounds[0]?.matches.length ?? 0) * 2
  const canRenderTree = treeRounds.length > 0 && totalRows > 0
  const treeColumns = treeRounds.length === 1 ? 1 : treeRounds.length === 2 ? 4 : 7

  const labelForRound = (roundIndex: number) => {
    if (roundIndex === 2) return 'Final'
    if (roundIndex === 1) return 'Semifinal'
    return 'Match'
  }

  return (
    <div className={styles.bracketView}>
      {totalBrackets > 1 && (
        <div className={styles.bracketNavigator}>
          <button
            type="button"
            className={styles.bracketNavBtn}
            disabled={activeBracket === 0}
            onClick={() => setActiveBracket((prev) => Math.max(0, prev - 1))}
            aria-label="Go to previous bracket"
          >
            <span>←</span>
            <span>Previous</span>
          </button>

          <div className={styles.bracketNavCenter}>
            <div className={styles.bracketNavTitleRow}>
              <span className={styles.bracketNavTitle}>Bracket {activeBracket + 1}</span>
              <span className={styles.bracketNavCount}>of {totalBrackets}</span>
            </div>
          </div>

          <button
            type="button"
            className={styles.bracketNavBtn}
            disabled={activeBracket === totalBrackets - 1}
            onClick={() => setActiveBracket((prev) => Math.min(totalBrackets - 1, prev + 1))}
            aria-label="Go to next bracket"
          >
            <span>Next</span>
            <span>→</span>
          </button>
        </div>
      )}

      {rounds.length === 0 ? (
        <p className={styles.emptyNote}>No rounds yet.</p>
      ) : (
        <>
          {canRenderTree ? (
            <>
              <div className={styles.bracketTreeWrap}>
                <div
                  className={styles.bracketTreeGrid}
                  style={{
                    gridTemplateRows: `repeat(${totalRows}, auto)`,
                    gridTemplateColumns: `repeat(${treeColumns}, auto)`,
                  }}
                >
                  {treeRounds[0]?.matches.map((match, mi) => (
                    <MatchCard
                      key={`r0-m${mi}`}
                      match={match}
                      label={labelForRound(0)}
                      style={{
                        gridColumn: '1',
                        gridRow: `${mi * 2 + 1} / span 2`,
                      }}
                    />
                  ))}

                  {treeRounds[1]?.matches.map((match, mi) => (
                    <MatchCard
                      key={`r1-m${mi}`}
                      match={match}
                      label={labelForRound(1)}
                      style={{
                        gridColumn: '4',
                        gridRow: `${mi * 4 + 2} / span 2`,
                      }}
                    />
                  ))}

                  {treeRounds[2]?.matches.map((match, mi) => (
                    <MatchCard
                      key={`r2-m${mi}`}
                      match={match}
                      label={labelForRound(2)}
                      className={styles.finalsCard}
                      style={{
                        gridColumn: '7',
                        gridRow: `${mi * 8 + 4} / span 2`,
                      }}
                    />
                  ))}

                  {treeRounds[1]?.matches.map((_, i) => (
                    <Fragment key={`c-r1-wrap-${i}`}>
                      <div
                        className={styles.connectorBracket}
                        style={{ gridColumn: '2', gridRow: `${i * 4 + 2} / ${i * 4 + 4}` }}
                      />
                      <div
                        className={styles.connectorArm}
                        style={{ gridColumn: '3', gridRow: `${i * 4 + 2} / ${i * 4 + 4}` }}
                      />
                    </Fragment>
                  ))}

                  {treeRounds[2]?.matches.map((_, i) => (
                    <Fragment key={`c-r2-wrap-${i}`}>
                      <div
                        className={styles.connectorBracket}
                        style={{ gridColumn: '5', gridRow: `${i * 8 + 3} / ${i * 8 + 7}` }}
                      />
                      <div
                        className={styles.connectorArm}
                        style={{ gridColumn: '6', gridRow: `${i * 8 + 4} / ${i * 8 + 6}` }}
                      />
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
                          <MatchCard key={mi} match={match} />
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
                      <MatchCard key={mi} match={match} />
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
    if (place === 1) return '🥇 1st'
    if (place === 2) return '🥈 2nd'
    if (place === 3) return '🥉 3rd'
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
                <span className={styles.winnerName}>{w.player_name || w.name || '—'}</span>
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
  const [loading, setLoading] = useState(true)
  const [hydratedFromCache, setHydratedFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const looksNumeric = /^\d+$/.test((tournamentRef ?? '').trim())

  const fetchTournamentInfo = useCallback(async () => {
    const ref = decodeURIComponent((tournamentRef ?? '').trim())
    if (!ref) throw new Error('Tournament not found')

    const byIdPath = `/api/v1/public/tournament/${encodeURIComponent(ref)}`
    const byNamePath = `/api/v1/public/tournament/by-name/${encodeURIComponent(ref)}`
    const bySlugPath = `/api/v1/public/tournament/by-slug/${encodeURIComponent(ref)}`

    const pathsToTry = looksNumeric
      ? [byIdPath, bySlugPath, byNamePath]
      : [bySlugPath, byNamePath, byIdPath]

    let res: Response | null = null
    for (const path of pathsToTry) {
      const attempt = await fetch(buildApiUrl(path))
      if (attempt.ok) {
        res = attempt
        break
      }
    }

    if (!res) throw new Error('Tournament not found')

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

  // ── Session cache hydration/persistence ───────────────────────────────────

  useEffect(() => {
    if (!tournamentRef) return
    setHydratedFromCache(false)

    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (!raw) return

      const cached = JSON.parse(raw) as PublicViewCache
      if (!cached?.tournament) return

      setTournament(cached.tournament)
      setSelectedSquadId(cached.selectedSquadId ?? null)
      setResolvedTournamentId(cached.resolvedTournamentId ?? null)
      setBracketGroups(Array.isArray(cached.bracketGroups) ? cached.bracketGroups : [])
      setWinners(Array.isArray(cached.winners) ? cached.winners : [])
      setLastRefresh(cached.lastRefreshIso ? new Date(cached.lastRefreshIso) : new Date())
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
        const firstSquad = info.squads[0]?.id ?? null
        setSelectedSquadId(firstSquad)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [tournamentRef, fetchTournamentInfo, hydratedFromCache])

  // ── Data refresh (bowlers + brackets + winners) ────────────────────────────

  const refresh = useCallback(async () => {
    if (!resolvedTournamentId) return
    const [bg, w] = await Promise.all([
      fetchBrackets(resolvedTournamentId, selectedSquadId),
      fetchWinners(resolvedTournamentId, selectedSquadId),
    ])
    setBracketGroups(bg)
    setWinners(w)
    setLastRefresh(new Date())
  }, [resolvedTournamentId, selectedSquadId, fetchBrackets, fetchWinners])

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
              {tournament && tournament.squads.length > 1 && (
                <div className={styles.squadSelector}>
                  <label className={styles.squadLabel}>Squad</label>
                  <select
                    className={styles.squadSelect}
                    value={selectedSquadId ?? ''}
                    onChange={(e) => setSelectedSquadId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">All squads</option>
                    {tournament.squads.map((s) => (
                      <option key={s.id} value={s.id}>{formatSquad(s)}</option>
                    ))}
                  </select>
                </div>
              )}
              <nav className={styles.tabs} aria-label="View sections">
                <div className={styles.tabsTrack}>
                  {(['alive', 'brackets', 'sidePots'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                      onClick={() => setTab(t)}
                    >
                      {t === 'alive' && 'Bracket Summary'}
                      {t === 'brackets' && 'Brackets'}
                      {t === 'sidePots' && 'Side Pots'}
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
              <p>Loading tournament…</p>
            </div>
          </div>
        ) : (

          <>
            {/* ── Alive tab ── */}
            {tab === 'alive' && (
              <div className={styles.section}>
                <AliveView bracketGroups={bracketGroups} />
              </div>
            )}

            {/* ── Brackets tab ── */}
            {tab === 'brackets' && (
              <div className={styles.section}>
                {bracketGroups.length === 0 ? (
                  <p className={styles.emptyNote}>No brackets generated yet.</p>
                ) : (
                  bracketGroups.map((group) => (
                    <div key={group.key} className={styles.groupSection}>
                      <h2 className={styles.groupTitle}>{group.name}</h2>
                      {group.brackets.length === 0 ? (
                        <p className={styles.emptyNote}>No brackets in this group.</p>
                      ) : (
                        <BracketView group={group} />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

                {/* ── Side Pots tab ── */}
                {tab === 'sidePots' && (
                  <div className={styles.section}>
                    <p className={styles.emptyNote}>Side Pots coming soon.</p>
                  </div>
                )}
          </>
        )}

      </main>

    </div>
  )
}
