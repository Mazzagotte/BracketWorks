import { Badge } from '@bracketworks/ui';

import type { FinalsPlacing } from './liveStandingsTypes';
import styles from './FinalsPlacings.module.css';

/** "1st", "2nd", "T3rd" for tied places. */
export function placeText(place: number, tied: boolean): string {
  const tens = place % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[place % 10] ?? 'th';
  return `${tied ? 'T' : ''}${place}${suffix}`;
}

/**
 * Finishing places decided so far in a finals, with a neutral "Cashes" badge for paid places.
 * Shared by the public live page and the director's Finals tab. Renders nothing until a place is decided.
 */
export function FinalsPlacings({ placings, className }: { placings: FinalsPlacing[] | undefined; className?: string }) {
  if (!placings || placings.length === 0) return null;
  return (
    <section className={className ? `${styles.section} ${className}` : styles.section} aria-label="Placings">
      <h3 className={styles.title}>Placings</h3>
      <ol className={styles.list}>
        {placings.map((placing) => (
          <li key={placing.key} className={styles.row}>
            <span className={styles.place}>{placeText(placing.place, placing.tied)}</span>
            <span className={styles.name}>{placing.name}</span>
            {placing.cashing ? <Badge>Cashes</Badge> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
