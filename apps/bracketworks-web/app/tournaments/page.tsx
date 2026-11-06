'use client'

import { useMemo, useState } from 'react'
import { MoreHorizontal, Plus, Trash2, Trophy } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ICON_SIZE,
  Menu,
  MenuItem,
  Page,
  PageHeader,
  Pagination,
  SearchField,
  SegmentedControl,
  SelectField,
  TableToolbar,
} from '@bracketworks/ui'
import { useRouter } from 'next/navigation'

import { EditTournamentModal } from '../dashboard/components/EditTournamentModal'
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

  const statusTone = (value: Exclude<TournamentStatus, 'all'>) => (value === 'active' ? 'success' : value === 'upcoming' ? 'info' : 'neutral') as 'success' | 'info' | 'neutral'
  const firstShown = pageItems.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const lastShown = Math.min(currentPage * rowsPerPage, filteredTournaments.length)

  return (
    <Page>
      <PageHeader
        title="My tournaments"
        description="Manage and load your bowling tournaments."
        actions={(
          <Button variant="primary" icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setCreateOpen(true)}>
            Create tournament
          </Button>
        )}
      />

      <Card padding="flush" aria-label="Tournaments">
        <TableToolbar
          search={(
            <SearchField
              label="Search tournaments"
              value={query}
              onChange={event => { setQuery(event.target.value); setPage(1) }}
              placeholder="Search tournaments"
            />
          )}
        >
          <SegmentedControl
            label="Tournament status"
            value={status}
            onChange={selectStatus}
            options={(['all', 'active', 'upcoming', 'past'] as TournamentStatus[]).map(tab => ({ value: tab, label: statusLabels[tab], count: statusCounts[tab] }))}
          />
          <SelectField label="Sort tournaments" hideLabel value={sort} onChange={event => { setSort(event.target.value as TournamentSort); setPage(1) }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name</option>
          </SelectField>
        </TableToolbar>

        <div className={styles.listArea} aria-live="polite">
          {loading && tournaments.length === 0 ? <p className={styles.helper} role="status">Loading tournaments...</p> : null}
          {!loading && pageItems.length === 0 ? (
            <EmptyState
              icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title={query.trim() || status !== 'all' ? 'No tournaments match' : 'No tournaments yet'}
              description={query.trim() || status !== 'all' ? 'Try a different search or status.' : 'Create your first tournament to get started.'}
            />
          ) : null}
          {pageItems.length > 0 ? (
            <ul className={styles.rows}>
              {pageItems.map(tournament => {
                const tournamentStatus = getTournamentStatus(tournament)
                const squadCount = tournament.squad_times ? Object.values(tournament.squad_times).reduce((total, squads) => total + squads.length, 0) : 0
                return (
                  <li key={tournament.id} className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowTitle}>
                        {tournament.name}
                        <Badge tone={statusTone(tournamentStatus)}>{statusLabels[tournamentStatus]}</Badge>
                      </span>
                      <span className={styles.rowMeta}>
                        {[
                          tournament.start_date ? formatIsoDateLong(tournament.start_date) : 'Date pending',
                          tournament.location || null,
                          typeof tournament.entry_count === 'number' ? `${tournament.entry_count} entries` : 'No entries',
                          `${squadCount} squad${squadCount === 1 ? '' : 's'}`,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <Button size="sm" variant="accent-outline" onClick={() => loadTournament(tournament)} aria-label={`Load ${tournament.name}`}>
                        Load
                      </Button>
                      <Menu triggerLabel={`More actions for ${tournament.name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                        <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => setDeleteTarget(tournament)} aria-label={`Delete ${tournament.name}`}>
                          Delete tournament
                        </MenuItem>
                      </Menu>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        <Pagination
          page={currentPage}
          pageCount={totalPages}
          onPageChange={setPage}
          summary={`Showing ${firstShown}-${lastShown} of ${filteredTournaments.length}`}
          pageSizeControl={(
            <SelectField label="Rows per page" hideLabel value={rowsPerPage} onChange={event => { setRowsPerPage(Number(event.target.value)); setPage(1) }}>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </SelectField>
          )}
        />
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name ?? 'tournament'}?`}
        description="This permanently removes the tournament and its entries, scores, and brackets. This cannot be undone."
        confirmLabel="Delete tournament"
        tone="danger"
        busy={loading && Boolean(deleteTarget)}
        onConfirm={() => { void removeTournament() }}
        onCancel={() => setDeleteTarget(null)}
      />
      <EditTournamentModal open={createOpen} tournament={null} isCreateMode onClose={() => setCreateOpen(false)} onSave={createNewTournament} />
    </Page>
  )
}
