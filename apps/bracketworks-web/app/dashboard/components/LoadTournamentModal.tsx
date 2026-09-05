import { Clock3, Search, Trophy } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import type { Tournament } from '../../lib/types';
import EnhancedButton from '../../components/EnhancedButton';
import CloseControl from '../../../components/CloseControl';
import { formatIsoDateLong } from '../../lib/formatters';
import { useModalBehavior } from '../../hooks/useModalBehavior';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const { onOverlayClick } = useModalBehavior({ open, onClose, dialogRef });

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

  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onOverlayClick}>
      <div
        ref={dialogRef}
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-label={isAdmin ? 'All tournaments' : 'Your tournaments'}
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isAdmin ? 'All Tournaments' : 'Your Tournaments'}</h2>
          <p className={styles.modalSubtitle}>
            {allTournaments.length > 0
              ? `${allTournaments.length} available ${allTournaments.length === 1 ? 'tournament' : 'tournaments'}`
              : 'No tournaments available'}
          </p>
          <CloseControl
            position="absolute"
            size="sm"
            className={styles.closeButton}
            label="Close load tournament modal"
            onClick={onClose}
          />
        </div>
        <div className={styles.switcherSearch}>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search tournaments"
            aria-label="Search tournaments"
            autoFocus
          />
        </div>
        <div className={styles.modalScrollBody}>
          {allTournaments.length === 0 ? (
            <div className={styles.emptyTournaments}>
              <div>No tournaments found.</div>
              <div className={styles.emptyTournamentsHint}>Create your first tournament to get started!</div>
            </div>
          ) : (
            <>
              <ul className={styles.tournamentList}>
                {matchingTournaments.map(tournament => {
                  const squadCount = tournament.squad_times
                    ? Object.values(tournament.squad_times).reduce((sum, values) => sum + values.length, 0)
                    : 0;
                  const dayCount = tournament.squad_times ? Object.keys(tournament.squad_times).length : 0;
                  const isActiveTournament = currentTournamentId === tournament.id;

                  return (
                    <li
                      key={tournament.id}
                      className={`${styles.tournamentItem} ${isActiveTournament ? styles.tournamentItemActive : ''}`}
                      onClick={() => onLoadTournament(tournament)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onLoadTournament(tournament);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Load ${tournament.name}`}
                    >
                      <div className={styles.tournamentInfo}>
                        <span className={styles.tournamentIcon} aria-hidden="true"><Trophy /></span>
                        <span className={styles.tournamentName}>{tournament.name}</span>
                        {isActiveTournament && <span className={styles.tournamentActiveBadge}>Active</span>}
                        {tournament.location && <span className={styles.tournamentLocation}>{tournament.location}</span>}
                        {tournament.start_date && (
                          <span className={styles.tournamentDate}>
                            {formatIsoDateLong(tournament.start_date)}
                            {tournament.end_date && tournament.end_date !== tournament.start_date && ` – ${formatIsoDateLong(tournament.end_date)}`}
                          </span>
                        )}
                        {squadCount > 0 && <span className={styles.tournamentMetaPill}>{squadCount} {squadCount === 1 ? 'Squad' : 'Squads'}</span>}
                        {dayCount > 1 && <span className={styles.tournamentMetaPill}>{dayCount} Days</span>}
                        {typeof tournament.entry_count === 'number' && tournament.entry_count > 0 && (
                          <span className={styles.tournamentMetaPill}>{tournament.entry_count} {tournament.entry_count === 1 ? 'Entry' : 'Entries'}</span>
                        )}
                        {tournament.brackets_configured && <span className={styles.tournamentMetaPill}>Brackets Configured</span>}
                      </div>
                      <div className={styles.tournamentActions}>
                        {isActiveTournament ? <span className={styles.currentTournament}>Current</span> : <Clock3 aria-hidden="true" />}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {searchQuery.trim() && matchingTournaments.length === 0 && (
                <div className={styles.emptyTournaments}>No tournaments match your search.</div>
              )}

              {!searchQuery.trim() && totalPages > 1 && (
                <div className={styles.paginationBar}>
                  <EnhancedButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} variant="primary" size="sm">Previous</EnhancedButton>
                  <span className={styles.paginationText}>Page {currentPage} of {totalPages}</span>
                  <EnhancedButton onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} variant="primary" size="sm">Next</EnhancedButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
