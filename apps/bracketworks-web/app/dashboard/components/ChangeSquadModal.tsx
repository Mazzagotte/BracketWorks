import { Calendar } from 'lucide-react';

import type { Squad, Tournament } from '../../lib/types';
import CloseControl from '../../../components/CloseControl';
import { formatIsoDateLong } from '../../lib/formatters';
import styles from './ChangeSquadModal.module.css';

type ChangeSquadModalProps = {
  open: boolean;
  tournament: Tournament | null;
  squads: Squad[];
  selectedSquadId: number | null;
  squadEntryCounts: Record<number, number>;
  onSelectSquad: (squad: Squad) => void;
  onClose: () => void;
  /** When set, shown as a required-selection prompt and the close (dismiss) control is hidden. */
  requireSelectionMessage?: string | null;
};

export function ChangeSquadModal({
  open,
  tournament,
  squads,
  selectedSquadId,
  squadEntryCounts,
  onSelectSquad,
  onClose,
  requireSelectionMessage,
}: ChangeSquadModalProps) {
  if (!open || !tournament) {
    return null;
  }

  return (
    <div className={`${styles.modalOverlay} ${styles.modalOverlayTop}`}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Change Squad</h2>
          <p className={styles.modalSubtitle}>
            {requireSelectionMessage || `Select the date and time for ${tournament.name}`}
          </p>
          {!requireSelectionMessage && (
            <CloseControl position="absolute" size="sm" label="Close change squad modal" onClick={onClose} />
          )}
        </div>
        <div className={styles.squadChangeList}>
          {[...squads].sort((left, right) => {
            const leftSelected = left.id === selectedSquadId ? 1 : 0;
            const rightSelected = right.id === selectedSquadId ? 1 : 0;
            return rightSelected - leftSelected;
          }).map(squad => {
            const dateLabel = squad.date ? formatIsoDateLong(squad.date) : '';
            const timeLabel = squad.time || '';
            const isSelected = squad.id === selectedSquadId;
            const entries = squadEntryCounts[squad.id] ?? 0;

            return (
              <button
                key={squad.id}
                type="button"
                className={`${styles.squadChangeItem} ${isSelected ? styles.squadChangeItemSelected : ''} ${entries === 0 ? styles.squadChangeItemEmpty : ''}`}
                onClick={() => onSelectSquad(squad)}
              >
                <span className={styles.squadChangeIcon} aria-hidden="true"><Calendar /></span>
                <span className={styles.squadChangeItemMain}>
                  <span className={styles.squadChangeItemLabel}>
                    {dateLabel || timeLabel ? (
                      <>
                        {dateLabel && <span>{dateLabel}</span>}
                        {dateLabel && timeLabel && <b aria-hidden="true">•</b>}
                        {timeLabel && <span>{timeLabel}</span>}
                      </>
                    ) : `Squad ${squad.id}`}
                  </span>
                  <span className={styles.squadChangeItemMeta}>{entries} {entries === 1 ? 'entry' : 'entries'} <b aria-hidden="true">•</b> {isSelected ? 'Active squad' : '1 squad available'}</span>
                </span>
                <span className={styles.squadChangeItemStatus}>{isSelected ? 'Current' : 'Confirm'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
