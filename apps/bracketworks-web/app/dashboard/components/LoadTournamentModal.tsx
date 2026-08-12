import { RefreshCw, Trash2, Trophy } from 'lucide-react';

import type { Tournament } from '../../lib/types';
import EnhancedButton from '../../components/EnhancedButton';
import CloseControl from '../../../components/CloseControl';
import buttonStyles from '../../styles/buttons.module.css';
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
  onDeleteTournament: (tournament: Tournament) => void;
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
  onDeleteTournament,
}: LoadTournamentModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
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
        <div className={styles.modalScrollBody}>
          {allTournaments.length === 0 ? (
            <div className={styles.emptyTournaments}>
              <div>No tournaments found.</div>
              <div className={styles.emptyTournamentsHint}>Create your first tournament to get started!</div>
            </div>
          ) : (
            <>
              <ul className={styles.tournamentList}>
                {paginatedItems.map(tournament => {
                  const squadCount = tournament.squad_times
                    ? Object.values(tournament.squad_times).reduce((sum, values) => sum + values.length, 0)
                    : 0;
                  const dayCount = tournament.squad_times ? Object.keys(tournament.squad_times).length : 0;
                  const isActiveTournament = currentTournamentId === tournament.id;

                  return (
                    <li
                      key={tournament.id}
                      className={`${styles.tournamentItem} ${isActiveTournament ? styles.tournamentItemActive : ''}`}
                    >
                      <div className={styles.tournamentInfo}>
                        <span className={styles.tournamentIcon} aria-hidden="true"><Trophy /></span>
                        <div className={styles.tournamentDetails}>
                          <div className={styles.tournamentNameRow}>
                            <span className={styles.tournamentName}>{tournament.name}</span>
                            {isActiveTournament && <span className={styles.tournamentActiveBadge}>Active</span>}
                          </div>
                          {tournament.location && <div className={styles.tournamentLocation}>{tournament.location}</div>}
                          {tournament.start_date && (
                            <div className={styles.tournamentDate}>
                              {formatIsoDateLong(tournament.start_date)}
                              {tournament.end_date && tournament.end_date !== tournament.start_date && ` – ${formatIsoDateLong(tournament.end_date)}`}
                            </div>
                          )}
                          {(squadCount > 0 || (typeof tournament.entry_count === 'number' && tournament.entry_count > 0) || tournament.brackets_configured) && (
                            <div className={styles.tournamentMeta}>
                              {squadCount > 0 && <span>{squadCount} {squadCount === 1 ? 'Squad' : 'Squads'}</span>}
                              {dayCount > 1 && <span>{dayCount} Days</span>}
                              {typeof tournament.entry_count === 'number' && tournament.entry_count > 0 && (
                                <span>{tournament.entry_count} {tournament.entry_count === 1 ? 'Entry' : 'Entries'}</span>
                              )}
                              {tournament.brackets_configured && <span>Brackets Configured</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={styles.tournamentActions}>
                        <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary} ${styles.loadBtn}`} onClick={() => onLoadTournament(tournament)}>
                          <RefreshCw aria-hidden="true" />
                          {isActiveTournament ? 'Reload' : 'Load'}
                        </button>
                        <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.danger} ${styles.deleteBtn}`} onClick={() => onDeleteTournament(tournament)}><Trash2 aria-hidden="true" />Delete</button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
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
