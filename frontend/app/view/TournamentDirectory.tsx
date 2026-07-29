'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowRight, Calendar, MapPin, Radio, Trophy, Users } from 'lucide-react'
import { buildApiUrl } from '../lib/api'
import styles from './tournament-directory.module.css'
import viewStyles from './[tournamentId]/view.module.css'

const DIRECTORY_POLL_INTERVAL_MS = 15000
const HEARTBEAT_PULSE_MS = 3200
const RECENT_UPDATE_WINDOW_MS = 120000

interface PublicTournamentSummary {
  id: number
  name: string
  slug: string
  location?: string | null
  start_date?: string | null
  end_date?: string | null
  squad_count?: number
  public_url?: string
  last_activity_at?: string | null
  live_fingerprint?: string
}

interface PublicTournamentDirectoryResponse {
  tournaments?: PublicTournamentSummary[]
}

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return new Date(year, month, day)
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatDateRange(startDate?: string | null, endDate?: string | null) {
  if (!startDate && !endDate) return null
  if (!startDate && endDate) return endDate
  if (startDate && !endDate) return startDate
  if (startDate === endDate) return startDate
  return `${startDate} - ${endDate}`
}

function isCurrentTournament(tournament: PublicTournamentSummary, today = startOfToday()) {
  const start = parseDateOnly(tournament.start_date)
  const end = parseDateOnly(tournament.end_date)
  const isUpcoming = start ? start > today : false
  const isActive = end ? end >= today : true
  return !isUpcoming && isActive
}

export default function TournamentDirectory({
  title = 'Live Tournament Directory',
  subtitle = 'Select a tournament to open the live public view.',
  notFoundRef,
}: {
  title?: string
  subtitle?: string
  notFoundRef?: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tournaments, setTournaments] = useState<PublicTournamentSummary[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [heartbeatActive, setHeartbeatActive] = useState(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [recentUpdates, setRecentUpdates] = useState<Record<number, number>>({})
  const previousFingerprintRef = useRef<Record<number, string>>({})
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadDirectory = useCallback(async (isBackgroundPoll: boolean) => {
    if (isBackgroundPoll) {
      setIsPolling(true)
    } else {
      setLoading(true)
    }

    setError(null)
    try {
      const response = await fetch(buildApiUrl('/api/v1/public/tournaments'), {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Failed to load public tournaments.')
      const data = await response.json() as PublicTournamentDirectoryResponse
      const nextTournaments = Array.isArray(data.tournaments) ? data.tournaments : []

      const nextFingerprintMap: Record<number, string> = {}
      for (const tournament of nextTournaments) {
        nextFingerprintMap[tournament.id] = tournament.live_fingerprint ?? `${tournament.id}:${tournament.squad_count ?? 0}`
      }

      if (isBackgroundPoll) {
        const nowMs = Date.now()
        const today = startOfToday()
        const changedIds: number[] = []
        for (const tournament of nextTournaments) {
          const previous = previousFingerprintRef.current[tournament.id]
          const current = nextFingerprintMap[tournament.id]
          if (previous && previous !== current && isCurrentTournament(tournament, today)) {
            changedIds.push(tournament.id)
          }
        }

        if (changedIds.length > 0) {
          setHeartbeatActive(true)
          if (heartbeatTimerRef.current) {
            clearTimeout(heartbeatTimerRef.current)
          }
          heartbeatTimerRef.current = setTimeout(() => {
            setHeartbeatActive(false)
            heartbeatTimerRef.current = null
          }, HEARTBEAT_PULSE_MS)

          setRecentUpdates((prev) => {
            const next = { ...prev }
            for (const id of changedIds) {
              next[id] = nowMs
            }
            for (const [id, changedAt] of Object.entries(next)) {
              if (nowMs - changedAt > RECENT_UPDATE_WINDOW_MS) {
                delete next[Number(id)]
              }
            }
            return next
          })
        } else {
          setRecentUpdates((prev) => {
            const now = Date.now()
            const next = { ...prev }
            for (const [id, changedAt] of Object.entries(next)) {
              if (now - changedAt > RECENT_UPDATE_WINDOW_MS) {
                delete next[Number(id)]
              }
            }
            return next
          })
        }
      }

      previousFingerprintRef.current = nextFingerprintMap
      setTournaments(nextTournaments)
      setLastCheckedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load public tournaments.')
    } finally {
      if (isBackgroundPoll) {
        setIsPolling(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadDirectory(false)

    const intervalId = window.setInterval(() => {
      void loadDirectory(true)
    }, DIRECTORY_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
      if (heartbeatTimerRef.current) {
        clearTimeout(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }
  }, [loadDirectory])

  const attemptedLabel = useMemo(() => {
    const value = (notFoundRef ?? '').trim()
    return value.length > 0 ? value : null
  }, [notFoundRef])

  const grouped = useMemo(() => {
    const today = startOfToday()

    const upcoming: PublicTournamentSummary[] = []
    const current: PublicTournamentSummary[] = []

    for (const tournament of tournaments) {
      const start = parseDateOnly(tournament.start_date)
      const end = parseDateOnly(tournament.end_date)
      const isUpcoming = start ? start > today : false
      const isCurrent = end ? end >= today : true

      if (isUpcoming) {
        upcoming.push(tournament)
      } else if (isCurrent) {
        current.push(tournament)
      } else {
        // Keep completed tournaments visible under current for now.
        current.push(tournament)
      }
    }

    const toTime = (value?: string | null) => parseDateOnly(value)?.getTime() ?? Number.MAX_SAFE_INTEGER
    upcoming.sort((a, b) => toTime(a.start_date) - toTime(b.start_date))
    current.sort((a, b) => toTime(a.start_date) - toTime(b.start_date))

    return { current, upcoming }
  }, [tournaments])

  const totalTournamentCount = grouped.current.length + grouped.upcoming.length

  const heartbeatLabel = heartbeatActive
    ? 'Live update detected'
    : isPolling
      ? 'Checking for updates...'
      : 'Heartbeat monitor active'

  const renderTournamentList = (items: PublicTournamentSummary[]) => (
    <ul className={styles.grid}>
      {items.map((tournament) => {
        const href = tournament.public_url || `/view/${tournament.slug || tournament.id}`
        const dateRange = formatDateRange(tournament.start_date, tournament.end_date)
        const recentlyUpdated = typeof recentUpdates[tournament.id] === 'number'

        return (
          <li key={tournament.id} className={styles.card}>
            <Link href={href} className={styles.cardLink}>
              <div className={styles.cardTop}>
                <span className={styles.cardIcon} aria-hidden="true"><Trophy /></span>
                <div className={styles.cardTitle}>{tournament.name}</div>
                {recentlyUpdated ? <div className={styles.updatedPill}><Radio aria-hidden="true" />Live update</div> : null}
              </div>
              <div className={styles.metaRow}>
                <span><MapPin aria-hidden="true" />{tournament.location || 'Location TBD'}</span>
                {typeof tournament.squad_count === 'number' ? <span><Users aria-hidden="true" />{tournament.squad_count} squads</span> : null}
              </div>
              {dateRange ? <div className={styles.metaDate}><Calendar aria-hidden="true" />{dateRange}</div> : null}
              <div className={styles.openHint}>Open Live View <ArrowRight aria-hidden="true" /></div>
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className={viewStyles.page}>
      <header className={viewStyles.header}>
        <div className={`${viewStyles.headerInner} ${styles.fullBleedHeaderInner}`}>
          <div className={`${viewStyles.headerTop} ${styles.fullBleedHeaderTop}`}>
            <div className={viewStyles.brandCol}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static branding mark is intentionally rendered as plain img in the public header */}
              <img
                src="/logo 2.svg"
                alt="BracketWorks"
                className={viewStyles.brandLogo}
              />
              <div className={viewStyles.brandText}>
                <p className={viewStyles.brandEyebrow}>BracketWorks · Public Tournament Directory</p>
                <p className={viewStyles.brandSubline}>Browse live public tournaments</p>
              </div>
            </div>

            <div className={`${viewStyles.tournamentCol} ${styles.fullBleedTournamentCol}`}>
              <h1 className={viewStyles.tournamentName}>{title}</h1>
              <p className={viewStyles.tournamentLocation}>{subtitle}</p>
              <div className={styles.heartbeatRow} aria-live="polite">
                <span className={`${styles.heartbeatDot} ${heartbeatActive ? styles.heartbeatDotActive : ''}`} />
                <span className={styles.heartbeatText}>{heartbeatLabel}</span>
                {lastCheckedAt ? (
                  <span className={styles.heartbeatTime}>
                    Last check {lastCheckedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.wrap}>
        <div className={styles.heroShell}>
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}><Activity aria-hidden="true" />Public Tournament Directory</p>
            <h2 className={styles.heroTitle}>Open current brackets, scores, and side pots without signing in.</h2>
            <p className={styles.heroBody}>Use this directory to jump into any active public tournament page. Share a direct link with bowlers so they can follow results live from the concourse or their phone.</p>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{totalTournamentCount}</span>
              <span className={styles.statLabel}>Public tournaments</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{grouped.current.length}</span>
              <span className={styles.statLabel}>Current</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{grouped.upcoming.length}</span>
              <span className={styles.statLabel}>Upcoming</span>
            </div>
          </div>
        </div>

        {attemptedLabel ? (
          <p className={styles.notFoundBanner}>
            We could not find a public tournament for &quot;{attemptedLabel}&quot;.
          </p>
        ) : null}

        {loading ? (
          <p className={styles.stateText}>Loading tournaments...</p>
        ) : error ? (
          <p className={styles.stateError}>{error}</p>
        ) : tournaments.length === 0 ? (
          <p className={styles.stateText}>No public tournaments are available right now.</p>
        ) : (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Current Tournaments</h2>
                <span className={styles.sectionCount}>{grouped.current.length}</span>
              </div>
              {grouped.current.length > 0 ? renderTournamentList(grouped.current) : (
                <p className={styles.emptySection}>No current tournaments.</p>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Upcoming Tournaments</h2>
                <span className={styles.sectionCount}>{grouped.upcoming.length}</span>
              </div>
              {grouped.upcoming.length > 0 ? renderTournamentList(grouped.upcoming) : (
                <p className={styles.emptySection}>No upcoming tournaments.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
