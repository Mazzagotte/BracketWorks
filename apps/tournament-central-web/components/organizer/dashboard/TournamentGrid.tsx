'use client';

import { Button, Card, CardHeader, EmptyState, SearchField, SegmentedControl, SelectField, TableToolbar } from '@bracketworks/ui';
import { useMemo, useState } from 'react';

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

export default function TournamentGrid({ tournaments, deletingTournamentId, onDeleteTournament, onDuplicateTournament }: TournamentGridProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [when, setWhen] = useState<When>('all');
  const today = todayIso();
  const counts = useMemo(() => {
    const past = tournaments.filter((tournament) => isPast(tournament, today)).length;
    return { upcoming: tournaments.length - past, past, all: tournaments.length };
  }, [today, tournaments]);
  // Upcoming: soonest first, undated last. Past: most recent first. All: upcoming ones, then past ones.
  const visible = useMemo(() => tournaments.filter((tournament) => {
    const matchesSearch = `${tournament.name} ${tournament.location || ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const published = tournament.hasPublishedSetup;
    const matchesWhen = when === 'all' || (when === 'past') === isPast(tournament, today);
    return matchesSearch && matchesWhen && (status === 'all' || (status === 'published' ? published : !published));
  }).sort((a, b) => {
    const aPast = isPast(a, today);
    const bPast = isPast(b, today);
    if (aPast !== bPast) return aPast ? 1 : -1;
    const aDate = a.startDate ?? '9999-12-31';
    const bDate = b.startDate ?? '9999-12-31';
    return aPast ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
  }), [tournaments, search, status, today, when]);

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
        <SelectField label="Tournament publication status" hideLabel value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Unpublished</option>
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
          action={<Button variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setWhen('all'); }}>Clear filters</Button>}
        />
      )}
    </Card>
  );
}
