'use client';

import { Button, Card, CardHeader, EmptyState, SearchField, SegmentedControl, SelectField, TableToolbar } from '@bracketworks/ui';
import { useEffect, useMemo, useState } from 'react';

import TournamentCard from './TournamentCard';
import { isPast, todayIso } from './tournamentTiming';
import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';

type TournamentGridProps = {
  tournaments: OrganizerDashboardTournament[];
  deletingTournamentId: number | null;
  onDeleteTournament: (tournament: OrganizerDashboardTournament) => void;
  onDuplicateTournament?: (tournament: OrganizerDashboardTournament) => void;
};

type When = 'upcoming' | 'past' | 'all';
type Status = 'all' | 'published' | 'draft';
type Sort = 'date' | 'name' | 'registrations';
type SavedFilters = { when: When; status: Status; sort: Sort };

/** The organizer's last tab, status, and sort, kept in this browser only. */
const FILTERS_STORAGE_KEY = 'tc.organizerDashboard.filters';
const DEFAULT_FILTERS: SavedFilters = { when: 'all', status: 'all', sort: 'date' };

function readSavedFilters(): SavedFilters {
  try {
    const saved = JSON.parse(window.localStorage.getItem(FILTERS_STORAGE_KEY) || '{}') as Partial<SavedFilters>;
    return {
      when: saved.when === 'upcoming' || saved.when === 'past' ? saved.when : DEFAULT_FILTERS.when,
      status: saved.status === 'published' || saved.status === 'draft' ? saved.status : DEFAULT_FILTERS.status,
      sort: saved.sort === 'name' || saved.sort === 'registrations' ? saved.sort : DEFAULT_FILTERS.sort,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(filters: SavedFilters) {
  try {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Storage can be full or blocked; the filters still work for this visit.
  }
}

function byDate(today: string) {
  // Upcoming soonest first (undated last), then past ones most recent first.
  return (a: OrganizerDashboardTournament, b: OrganizerDashboardTournament) => {
    const aPast = isPast(a, today);
    const bPast = isPast(b, today);
    if (aPast !== bPast) return aPast ? 1 : -1;
    const aDate = a.startDate ?? '9999-12-31';
    const bDate = b.startDate ?? '9999-12-31';
    return aPast ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
  };
}

export default function TournamentGrid({ tournaments, deletingTournamentId, onDeleteTournament, onDuplicateTournament }: TournamentGridProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>(DEFAULT_FILTERS.status);
  const [when, setWhen] = useState<When>(DEFAULT_FILTERS.when);
  const [sort, setSort] = useState<Sort>(DEFAULT_FILTERS.sort);
  const [restored, setRestored] = useState(false);
  const today = todayIso();

  // Read saved choices after mount so the server and first client render match.
  useEffect(() => {
    const saved = readSavedFilters();
    setWhen(saved.when);
    setStatus(saved.status);
    setSort(saved.sort);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) saveFilters({ when, status, sort });
  }, [restored, when, status, sort]);

  const counts = useMemo(() => {
    const past = tournaments.filter((tournament) => isPast(tournament, today)).length;
    return { upcoming: tournaments.length - past, past, all: tournaments.length };
  }, [today, tournaments]);
  const visible = useMemo(() => tournaments.filter((tournament) => {
    const matchesSearch = `${tournament.name} ${tournament.location || ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const published = tournament.hasPublishedSetup;
    const matchesWhen = when === 'all' || (when === 'past') === isPast(tournament, today);
    return matchesSearch && matchesWhen && (status === 'all' || (status === 'published' ? published : !published));
  }).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (sort === 'registrations') return ((b.entryCount ?? 0) - (a.entryCount ?? 0)) || byDate(today)(a, b);
    return byDate(today)(a, b);
  }), [tournaments, search, sort, status, today, when]);

  return (
    <Card padding="flush" aria-label="Your tournaments">
      <CardHeader
        title={`Your tournaments (${tournaments.length})`}
        description="Manage entries, payments, and setup in one place."
      />
      <TableToolbar
        search={
          <SearchField
            label="Search your tournaments"
            placeholder="Search by tournament or location"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
      >
        <SegmentedControl
          label="Tournament dates"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { value: 'past', label: 'Past', count: counts.past },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <SelectField label="Tournament publication status" hideLabel value={status} onChange={(event) => setStatus(event.target.value as Status)}>
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Unpublished</option>
        </SelectField>
        <SelectField label="Sort tournaments" hideLabel value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          <option value="date">Sort by date</option>
          <option value="name">Sort by name</option>
          <option value="registrations">Most registrations</option>
        </SelectField>
      </TableToolbar>
      <p className={styles.resultsCount} role="status">{`${visible.length} of ${tournaments.length} tournaments`}</p>
      {visible.length > 0 ? (
        <div className={styles.tournamentList}>
          {visible.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              isDeleting={deletingTournamentId === tournament.id}
              onDelete={onDeleteTournament}
              onDuplicate={onDuplicateTournament}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching tournaments"
          description="Try another name, location, or status."
          action={<Button variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setWhen('all'); setSort('date'); }}>Clear filters</Button>}
        />
      )}
    </Card>
  );
}
