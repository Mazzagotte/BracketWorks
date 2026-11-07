import { Trophy } from 'lucide-react';
import { DataTable, ICON_SIZE } from '@bracketworks/ui';

import { lowerFirst } from './LiveShell';
import type { LiveFinals } from './liveStandingsTypes';
import styles from './LiveFinals.module.css';

/* Finals pieces shared by the live standings page's Finals tab and the live finals page. */

export { finalsRounds } from './liveFinals';

export function ChampionLine({ champion }: { champion: NonNullable<LiveFinals['champion']> }) {
  return (
    <p className={styles.championLine}>
      <Trophy size={ICON_SIZE.md} aria-hidden="true" className={styles.trophy} />
      <span>
        Champion: <strong className={styles.strong}>{champion.name}</strong>
        {champion.detail ? `, ${lowerFirst(champion.detail)}` : ''}
      </span>
    </p>
  );
}

/** Round robin points table: rank, W-L-T, pins, and points (the totals column in bold). */
export function RoundRobinTable({ finals, caption }: { finals: LiveFinals; caption: string }) {
  return (
    <DataTable caption={caption} className={styles.table}>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Bowler</th>
          <th scope="col" data-align="right">W-L-T</th>
          <th scope="col" data-align="right">Pins</th>
          <th scope="col" data-align="right">Points</th>
        </tr>
      </thead>
      <tbody>
        {finals.table.map((row) => (
          <tr key={row.key ?? `${row.seed}-${row.name}`}>
            <td className={styles.rank}>{row.rank}</td>
            <td>{row.name}</td>
            <td data-align="right">{`${row.wins}-${row.losses}-${row.ties}`}</td>
            <td data-align="right" data-tone={row.pins === 0 ? 'secondary' : undefined}>{row.pins}</td>
            <td data-align="right" data-emphasis="true">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
