'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

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
    <section aria-label="Your tournaments" className={styles.operationsPanel}>
      <div className={styles.operationsHeading}>
        <div><h2>Your tournaments <span>{tournaments.length}</span></h2><p>Manage entries, payments, and setup in one place.</p></div>
      </div>
      <div className={styles.operationsToolbar}>
        <label className={styles.tournamentSearch}>
          <Search size={18} aria-hidden="true" />
          <span className={styles.srOnly}>Search your tournaments</span>
          <input type="search" placeholder="Search by tournament or location" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className={styles.tournamentFilter}>
          <span className={styles.srOnly}>Tournament publication status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Unpublished</option>
          </select>
        </label>
      </div>
      <p className={styles.resultsCount} role="status">{`${visible.length} of ${tournaments.length} tournaments`}</p>
      <div className={styles.operationList}>
        {visible.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            isDeleting={deletingTournamentId === tournament.id}
            onDelete={onDeleteTournament}
          />
        ))}
        {visible.length === 0 && <div className={styles.noMatches}>
          <h3>No matching tournaments</h3><p>Try another name, location, or status.</p>
          <button type="button" className={styles.secondaryButtonCompact} onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</button>
        </div>}
      </div>
    </section>
  );
}
