'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, Layers3, MapPin, Plus, Search, Trash2, Trophy, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { EditTournamentModal } from '../dashboard/components/EditTournamentModal'
import EnhancedButton from '../components/EnhancedButton'
import { useTournaments } from '../hooks/useTournaments'
import { apiClient } from '../lib/api'
import { formatIsoDateLong } from '../lib/formatters'
import { clearSelectedTournament, getSelectedTournamentId, setSelectedTournament } from '../lib/selection-session'
import type { Tournament, TournamentForm } from '../lib/types'
import styles from './tournaments.module.css'

type TournamentStatus = 'all' | 'active' | 'upcoming' | 'past'
type TournamentSort = 'newest' | 'oldest' | 'name'

const statusLabels: Record<TournamentStatus, string> = {
  all: 'All',
  active: 'Active',
  upcoming: 'Upcoming',
  past: 'Past',
}

function getTournamentStatus(tournament: Tournament): Exclude<TournamentStatus, 'all'> {
  const today = new Date().toISOString().slice(0, 10)
  if (tournament.start_date && tournament.start_date > today) return 'upcoming'
  if (tournament.end_date && tournament.end_date < today) return 'past'
  return 'active'
}

export default function TournamentsPage() {
  const router = useRouter()
  const { tournaments, loading, createTournament, deleteTournament } = useTournaments()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TournamentStatus>('all')
  const [sort, setSort] = useState<TournamentSort>('newest')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)

  const statusCounts = useMemo(() => ({
    all: tournaments.length,
    active: tournaments.filter(tournament => getTournamentStatus(tournament) === 'active').length,
    upcoming: tournaments.filter(tournament => getTournamentStatus(tournament) === 'upcoming').length,
    past: tournaments.filter(tournament => getTournamentStatus(tournament) === 'past').length,
  }), [tournaments])

  const filteredTournaments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tournaments
      .filter(tournament => status === 'all' || getTournamentStatus(tournament) === status)
      .filter(tournament => !normalizedQuery || [tournament.name, tournament.location, tournament.start_date]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(normalizedQuery)))
      .sort((left, right) => {
        if (sort === 'name') return left.name.localeCompare(right.name)
        const comparison = (right.start_date || '').localeCompare(left.start_date || '')
        return sort === 'newest' ? comparison : -comparison
      })
  }, [query, sort, status, tournaments])

  const totalPages = Math.max(1, Math.ceil(filteredTournaments.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filteredTournaments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const selectStatus = (nextStatus: TournamentStatus) => {
    setStatus(nextStatus)
    setPage(1)
  }

  const loadTournament = (tournament: Tournament) => {
    setSelectedTournament(tournament.id, tournament.name)
    router.push('/dashboard')
  }

  const createNewTournament = async (form: TournamentForm) => {
    const created = await createTournament(form)
    await apiClient.post(`/api/v1/squads/sync/${created.id}`, { squad_times: form.squad_times })
    setCreateOpen(false)
    loadTournament(created)
  }

  const removeTournament = async () => {
    if (!deleteTarget) return
    await deleteTournament(deleteTarget.id)
    if (Number(getSelectedTournamentId()) === deleteTarget.id) clearSelectedTournament({ clearSquad: true })
    setDeleteTarget(null)
  }

  return (
    <main className={styles.page}>
      <section className={styles.workspace} aria-labelledby="tournaments-title">
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.titleIcon} aria-hidden="true"><Trophy /></span>
            <div>
              <h1 id="tournaments-title">My Tournaments</h1>
              <p>Manage and load your bowling tournaments</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.sortControl}>
              <ArrowUpDown aria-hidden="true" />
              <span className={styles.srOnly}>Sort tournaments</span>
              <select value={sort} onChange={event => { setSort(event.target.value as TournamentSort); setPage(1) }}>
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="name">Sort: Name</option>
              </select>
            </label>
            <EnhancedButton className={styles.createButton} variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <span className={styles.createButtonLabel}><Plus aria-hidden="true" />Create Tournament</span>
            </EnhancedButton>
          </div>
        </header>

        <div className={styles.controls}>
          <div className={styles.statusTabs} role="tablist" aria-label="Tournament status">
            {(['all', 'active', 'upcoming', 'past'] as TournamentStatus[]).map(tab => (
              <button key={tab} type="button" role="tab" aria-selected={status === tab} className={status === tab ? styles.statusTabActive : styles.statusTab} onClick={() => selectStatus(tab)}>
                {statusLabels[tab]} <span>{statusCounts[tab]}</span>
              </button>
            ))}
          </div>
          <label className={styles.searchControl}>
            <Search aria-hidden="true" />
            <span className={styles.srOnly}>Search tournaments</span>
            <input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search tournaments..." />
          </label>
        </div>

        <div className={styles.list} aria-live="polite">
          {loading && tournaments.length === 0 ? <div className={styles.emptyState}>Loading tournaments...</div> : null}
          {!loading && pageItems.length === 0 ? <div className={styles.emptyState}>No tournaments found.</div> : null}
          {pageItems.map(tournament => {
            const tournamentStatus = getTournamentStatus(tournament)
            const squadCount = tournament.squad_times ? Object.values(tournament.squad_times).reduce((total, squads) => total + squads.length, 0) : 0
            const statusClass = tournamentStatus === 'active'
              ? styles.statusActive
              : tournamentStatus === 'upcoming'
                ? styles.statusUpcoming
                : styles.statusPast
            return (
              <article key={tournament.id} className={styles.tournamentRow} role="button" tabIndex={0} onClick={() => loadTournament(tournament)} onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); loadTournament(tournament) }
              }} aria-label={`Load ${tournament.name}`}>
                <span className={styles.tournamentIcon} aria-hidden="true"><Trophy /></span>
                <div className={styles.tournamentInfo}>
                  <div className={styles.nameLine}><h2>{tournament.name}</h2><span className={`${styles.statusBadge} ${statusClass}`}>{tournamentStatus}</span></div>
                  <div className={styles.metadata}>
                    <span><CalendarDays aria-hidden="true" />{tournament.start_date ? formatIsoDateLong(tournament.start_date) : 'Date pending'}</span>
                    {tournament.location ? <span><MapPin aria-hidden="true" />{tournament.location}</span> : null}
                    <span><UsersRound aria-hidden="true" />{typeof tournament.entry_count === 'number' ? `${tournament.entry_count} entries` : 'No entries'}</span>
                    <span><Layers3 aria-hidden="true" />{squadCount} squads</span>
                  </div>
                </div>
                <div className={styles.rowActions} onClick={event => event.stopPropagation()}>
                  <button type="button" className={styles.loadButton} onClick={() => loadTournament(tournament)}>Load</button>
                  <button type="button" className={styles.deleteButton} onClick={() => setDeleteTarget(tournament)} aria-label={`Delete ${tournament.name}`}><Trash2 aria-hidden="true" /></button>
                </div>
              </article>
            )
          })}
        </div>

        <footer className={styles.footer}>
          <span>Showing {pageItems.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredTournaments.length)} of {filteredTournaments.length} tournaments</span>
          <div className={styles.pagination}>
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page"><ChevronLeft aria-hidden="true" /></button>
            <span>{currentPage} of {totalPages}</span>
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page"><ChevronRight aria-hidden="true" /></button>
          </div>
          <label className={styles.rowsControl}>Rows per page:<select value={rowsPerPage} onChange={event => { setRowsPerPage(Number(event.target.value)); setPage(1) }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
        </footer>

        {deleteTarget ? <section className={styles.deleteConfirm} aria-label="Confirm tournament deletion"><strong>Delete {deleteTarget.name}?</strong><span>This cannot be undone.</span><div><button type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" onClick={() => void removeTournament()} disabled={loading}>Delete Tournament</button></div></section> : null}
      </section>
      <EditTournamentModal open={createOpen} tournament={null} isCreateMode onClose={() => setCreateOpen(false)} onSave={createNewTournament} />
    </main>
  )
}