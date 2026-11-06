import { Search, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, EmptyState, ICON_SIZE, Modal, Pagination, SearchField } from '@bracketworks/ui';

import type { Tournament } from '../../lib/types';
import { formatIsoDateLong } from '../../lib/formatters';
import styles from './LoadTournamentModal.module.css';

type LoadTournamentModalProps = {
  open: boolean;
  isAdmin: boolean;
  allTournaments: Tournament[];
  paginatedItems: Tournament[];
  currentTournamentId: number | null;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  onClose: () => void;
  onLoadTournament: (tournament: Tournament) => void;
};

function tournamentMeta(tournament: Tournament): string {
  const squadCount = tournament.squad_times
    ? Object.values(tournament.squad_times).reduce((sum, values) => sum + values.length, 0)
    : 0;
  const dayCount = tournament.squad_times ? Object.keys(tournament.squad_times).length : 0;
  const dates = tournament.start_date
    ? `${formatIsoDateLong(tournament.start_date)}${tournament.end_date && tournament.end_date !== tournament.start_date ? ` to ${formatIsoDateLong(tournament.end_date)}` : ''}`
    : null;
  return [
    tournament.location,
    dates,
    squadCount > 0 ? `${squadCount} ${squadCount === 1 ? 'squad' : 'squads'}` : null,
    dayCount > 1 ? `${dayCount} days` : null,
    typeof tournament.entry_count === 'number' && tournament.entry_count > 0 ? `${tournament.entry_count} ${tournament.entry_count === 1 ? 'entry' : 'entries'}` : null,
    tournament.brackets_configured ? 'Brackets set up' : null,
  ].filter(Boolean).join(' · ');
}

/** Switch tournaments: search, then divider rows; the loaded tournament is shaded with a badge. */
export function LoadTournamentModal({
  open,
  isAdmin,
  allTournaments,
  paginatedItems,
  currentTournamentId,
  currentPage,
  totalPages,
  goToPage,
  onClose,
  onLoadTournament,
}: LoadTournamentModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const hasQuery = searchQuery.trim().length > 0;

  const matchingTournaments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const source = normalizedQuery ? allTournaments : paginatedItems;
    const filtered = source.filter(tournament =>
      [tournament.name, tournament.location, tournament.start_date]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(normalizedQuery)),
    );
    return [...filtered].sort((left, right) => {
      if (left.id === currentTournamentId) return -1;
      if (right.id === currentTournamentId) return 1;
      return (right.start_date || '').localeCompare(left.start_date || '');
    });
  }, [allTournaments, currentTournamentId, paginatedItems, searchQuery]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel="Close switch tournament"
      title={isAdmin ? 'All tournaments' : 'Your tournaments'}
      description={allTournaments.length > 0
        ? `${allTournaments.length} ${allTournaments.length === 1 ? 'tournament' : 'tournaments'}`
        : undefined}
    >
      {allTournaments.length === 0 ? (
        <EmptyState
          icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
          title="No tournaments yet"
          description="Create your first tournament to get started."
        />
      ) : (
        <div className={styles.body}>
          <SearchField label="Search tournaments" placeholder="Search tournaments" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} autoFocus />
          {hasQuery && matchingTournaments.length === 0 ? (
            <EmptyState
              icon={<Search size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No matching tournaments"
              description="Try a different name, place, or date."
            />
          ) : (
            <ul className={styles.list}>
              {matchingTournaments.map(tournament => {
                const isActive = currentTournamentId === tournament.id;
                return (
                  <li key={tournament.id}>
                    <button
                      type="button"
                      className={isActive ? `${styles.row} ${styles.rowActive}` : styles.row}
                      aria-current={isActive ? 'true' : undefined}
                      aria-label={`Load ${tournament.name}`}
                      onClick={() => onLoadTournament(tournament)}
                    >
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle}>{tournament.name}</span>
                        <span className={styles.meta}>{tournamentMeta(tournament)}</span>
                      </span>
                      {isActive ? <Badge tone="neutral">Current</Badge> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!hasQuery && totalPages > 1 ? (
            <Pagination page={currentPage} pageCount={totalPages} onPageChange={goToPage} summary={`Page ${currentPage} of ${totalPages}`} />
          ) : null}
        </div>
      )}
    </Modal>
  );
}
