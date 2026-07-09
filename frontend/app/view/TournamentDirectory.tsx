'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { buildApiUrl } from '../lib/api'
import styles from './tournament-directory.module.css'
import viewStyles from './[tournamentId]/view.module.css'

interface PublicTournamentSummary {
  id: number
  name: string
  slug: string
  location?: string | null
  start_date?: string | null
  end_date?: string | null
  squad_count?: number
  public_url?: string
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

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(buildApiUrl('/api/v1/public/tournaments'))
        if (!response.ok) throw new Error('Failed to load public tournaments.')
        const data = await response.json() as PublicTournamentDirectoryResponse
        if (!active) return
        setTournaments(Array.isArray(data.tournaments) ? data.tournaments : [])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load public tournaments.')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

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

  const renderTournamentList = (items: PublicTournamentSummary[]) => (
    <ul className={styles.grid}>
      {items.map((tournament) => {
        const href = tournament.public_url || `/view/${tournament.slug || tournament.id}`
        const dateRange = formatDateRange(tournament.start_date, tournament.end_date)

        return (
          <li key={tournament.id} className={styles.card}>
            <Link href={href} className={styles.cardLink}>
              <div className={styles.cardTitle}>{tournament.name}</div>
              <div className={styles.metaRow}>
                {tournament.location ? <span>{tournament.location}</span> : <span>Location TBD</span>}
                {typeof tournament.squad_count === 'number' ? <span>{tournament.squad_count} squads</span> : null}
              </div>
              {dateRange ? <div className={styles.metaDate}>{dateRange}</div> : null}
              <div className={styles.openHint}>Open live view</div>
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
                <p className={viewStyles.brandEyebrow}>BracketWorks · Public Tournament View</p>
                <p className={viewStyles.brandSubline}>Browse live public tournaments</p>
              </div>
            </div>

            <div className={`${viewStyles.tournamentCol} ${styles.fullBleedTournamentCol}`}>
              <h1 className={viewStyles.tournamentName}>{title}</h1>
              <p className={viewStyles.tournamentLocation}>{subtitle}</p>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.wrap}>
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
