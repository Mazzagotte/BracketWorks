'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, RefreshCw, Search, Trophy } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ICON_SIZE,
  Notice,
  Page,
  PageHeader,
  SearchField,
  SegmentedControl,
  StatGroup,
  TableToolbar,
  TopNav,
  topNavBrandClassName,
} from '@bracketworks/ui'
import { buildApiUrl } from '../lib/api'
import styles from './tournament-directory.module.css'

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

type DirectoryFilter = 'all' | 'current' | 'upcoming'

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
  subtitle = 'Select a tournament to open the live public view.',
  notFoundRef,
}: {
  subtitle?: string
  notFoundRef?: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tournaments, setTournaments] = useState<PublicTournamentSummary[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [, setHeartbeatActive] = useState(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [recentUpdates, setRecentUpdates] = useState<Record<number, number>>({})
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DirectoryFilter>('all')
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
      const response = await fetch(buildApiUrl('/api/v1/public/tournaments?source=bw'), {
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

  const filteredGrouped = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const matches = (tournament: PublicTournamentSummary) => !normalizedQuery ||
      tournament.name.toLowerCase().includes(normalizedQuery) ||
      (tournament.location ?? '').toLowerCase().includes(normalizedQuery)

    return {
      current: filter === 'upcoming' ? [] : grouped.current.filter(matches),
      upcoming: filter === 'current' ? [] : grouped.upcoming.filter(matches),
    }
  }, [filter, grouped, query])

  const renderTournamentList = (items: PublicTournamentSummary[]) => (
    <ul className={styles.list}>
      {items.map((tournament) => {
        const href = tournament.public_url || `/view/${tournament.slug || tournament.id}`
        const dateRange = formatDateRange(tournament.start_date, tournament.end_date)
        const recentlyUpdated = typeof recentUpdates[tournament.id] === 'number'
        const meta = [
          tournament.location || 'Location to be announced',
          typeof tournament.squad_count === 'number' ? `${tournament.squad_count} ${tournament.squad_count === 1 ? 'squad' : 'squads'}` : null,
          dateRange,
        ].filter(Boolean).join(' · ')

        return (
          <li key={tournament.id}>
            <Link href={href} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>
                  {tournament.name}
                  {recentlyUpdated ? <Badge tone="success">Just updated</Badge> : null}
                </span>
                <span className={styles.meta}>{meta}</span>
              </span>
              <span className={styles.open}>Open live view<ChevronRight size={ICON_SIZE.md} aria-hidden="true" /></span>
            </Link>
          </li>
        )
      })}
    </ul>
  )

  const filterOptions = [
    { value: 'all' as const, label: 'All', count: totalTournamentCount },
    { value: 'current' as const, label: 'Current', count: grouped.current.length },
    { value: 'upcoming' as const, label: 'Upcoming', count: grouped.upcoming.length },
  ]
  const sections = [
    { key: 'current', title: 'Current tournaments', items: filteredGrouped.current, hidden: filter === 'upcoming', empty: 'No current tournaments' },
    { key: 'upcoming', title: 'Upcoming tournaments', items: filteredGrouped.upcoming, hidden: filter === 'current', empty: 'No upcoming tournaments' },
  ].filter(section => !section.hidden)

  return (
    <div className={styles.shell}>
      <TopNav
        brand={(
          <Link href="/" className={topNavBrandClassName()}>
            <Image src="/logo_no_text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />
            BracketWorks
          </Link>
        )}
      />
      <Page>
        <PageHeader
          title="Find a tournament"
          description={subtitle}
          actions={lastCheckedAt ? (
            <div className={styles.refresh}>
              <span className={styles.meta} role="status">Updated {lastCheckedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              <Button size="sm" variant="ghost" icon={<RefreshCw size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => void loadDirectory(true)} disabled={isPolling}>
                {isPolling ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          ) : undefined}
        />

        {attemptedLabel ? (
          <Notice tone="warning">{`We could not find a public tournament for "${attemptedLabel}".`}</Notice>
        ) : null}

        <StatGroup
          label="Public tournaments"
          items={[
            { label: 'Public tournaments', value: String(totalTournamentCount) },
            { label: 'Current', value: String(grouped.current.length) },
            { label: 'Upcoming', value: String(grouped.upcoming.length) },
          ]}
        />

        <Card padding="flush" aria-label="Tournaments">
          <TableToolbar search={<SearchField label="Search tournaments" placeholder="Search by name or place" value={query} onChange={(event) => setQuery(event.target.value)} />}>
            <SegmentedControl label="Filter tournaments" options={filterOptions} value={filter} onChange={setFilter} />
          </TableToolbar>
          {loading ? (
            <p className={styles.status} role="status">Loading tournaments...</p>
          ) : error ? (
            <div className={styles.status}><Notice tone="danger" role="alert">{error}</Notice></div>
          ) : (
            sections.map(section => (
              <section key={section.key} className={styles.section} aria-labelledby={`directory-${section.key}`}>
                <h2 id={`directory-${section.key}`} className={styles.sectionTitle}>
                  {section.title} <span className={styles.meta}>{section.items.length}</span>
                </h2>
                {section.items.length > 0 ? renderTournamentList(section.items) : (
                  <EmptyState
                    icon={query ? <Search size={ICON_SIZE['2xl']} aria-hidden="true" /> : <Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
                    title={query ? 'No matching tournaments' : section.empty}
                    description={query ? 'Try a different name or place.' : 'Check back soon.'}
                  />
                )}
              </section>
            ))
          )}
        </Card>

        <p className={styles.footer}>Powered by BracketWorks</p>
      </Page>
    </div>
  )
}
