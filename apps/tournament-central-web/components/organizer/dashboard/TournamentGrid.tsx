'use client';

import { Button, Card, CardHeader, EmptyState, SearchField, SelectField, TableToolbar } from '@bracketworks/ui';
import { useMemo, useState } from 'react';

import TournamentCard from './TournamentCard';
import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';

type TournamentGridProps = {
  tournaments: OrganizerDashboardTournament[];
  deletingTournamentId: number | null;
  onDeleteTournament: (tournament: OrganizerDashboardTournament) => void;
};

export default function TournamentGrid({ tournaments, deletingTournamentId, onDeleteTournament }: TournamentGridProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const visible = useMemo(() => tournaments.filter((tournament) => {
    const matchesSearch = `${tournament.name} ${tournament.location || ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const published = tournament.hasPublishedSetup;
    return matchesSearch && (status === 'all' || (status === 'published' ? published : !published));
  }), [tournaments, search, status]);

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
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching tournaments"
          description="Try another name, location, or status."
          action={<Button variant="secondary" onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</Button>}
        />
      )}
    </Card>
  );
}
