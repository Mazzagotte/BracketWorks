import { Badge, Modal } from '@bracketworks/ui';

import type { Squad, Tournament } from '../../lib/types';
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
  allowDismissWhenRequired?: boolean;
  /** When set, shown as a required-selection prompt and the dialog cannot be dismissed. */
  requireSelectionMessage?: string | null;
};

/** Pick the squad to work on: divider rows, the current squad shaded with a badge. */
export function ChangeSquadModal({
  open,
  tournament,
  squads,
  selectedSquadId,
  squadEntryCounts,
  onSelectSquad,
  onClose,
  allowDismissWhenRequired = false,
  requireSelectionMessage,
}: ChangeSquadModalProps) {
  const isDismissable = !requireSelectionMessage || allowDismissWhenRequired;
  const sortedSquads = [...squads].sort((left, right) => Number(right.id === selectedSquadId) - Number(left.id === selectedSquadId));

  return (
    <Modal
      open={open && Boolean(tournament)}
      onClose={onClose}
      size="sm"
      dismissible={isDismissable}
      closeLabel="Close change squad"
      title="Change squad"
      description={requireSelectionMessage || (tournament ? `Choose the date and time to work on for ${tournament.name}.` : undefined)}
    >
      <ul className={styles.list}>
        {sortedSquads.map(squad => {
          const dateLabel = squad.date ? formatIsoDateLong(squad.date) : '';
          const timeLabel = squad.time || '';
          const isSelected = squad.id === selectedSquadId;
          const entries = squadEntryCounts[squad.id] ?? 0;
          return (
            <li key={squad.id}>
              <button
                type="button"
                className={isSelected ? `${styles.row} ${styles.rowSelected}` : styles.row}
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => onSelectSquad(squad)}
              >
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>
                    {[dateLabel, timeLabel].filter(Boolean).join(' · ') || `Squad ${squad.id}`}
                  </span>
                  <span className={styles.meta}>{entries} {entries === 1 ? 'entry' : 'entries'}</span>
                </span>
                {isSelected ? <Badge tone="neutral">Current</Badge> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
