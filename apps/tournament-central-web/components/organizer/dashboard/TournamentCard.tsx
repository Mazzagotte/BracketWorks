import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Trash2, Trophy } from 'lucide-react';

import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import TournamentStatusBadge from './TournamentStatusBadge';
import styles from './OrganizerDashboard.module.css';
import { organizerRoutes } from '../organizerRoutes';
import { formatTournamentDateRange } from '@/lib/tournamentDates';
import { formatMoney } from '../organizerFormatting';

type TournamentCardProps = {
  tournament: OrganizerDashboardTournament;
  isDeleting: boolean;
  onDelete: (tournament: OrganizerDashboardTournament) => void;
};

export default function TournamentCard({ tournament, isDeleting, onDelete }: TournamentCardProps) {
  return (
    <article className={styles.operationRow} aria-label={tournament.name}>
      <div className={styles.tournamentIdentity}>
        <span className={styles.compactLogo} aria-hidden="true">
          {tournament.hasLogo
            ? <Image src={`/api/v1/tc/tournaments/${tournament.id}/logo`} alt="" width={44} height={44} unoptimized />
            : <Trophy size={22} />}
        </span>
        <div className={styles.tournamentCopy}>
          <div className={styles.tournamentTitleLine}>
            <h3><Link href={organizerRoutes.overview(tournament.id)}>{tournament.name}</Link></h3>
            <TournamentStatusBadge isPublic={tournament.isPublic} hasPublishedSetup={tournament.hasPublishedSetup} />
          </div>
          <p>{formatTournamentDateRange(tournament.startDate, tournament.endDate)}</p>
          <p>{tournament.location || 'Location not set'}</p>
        </div>
      </div>
      <dl className={styles.rowMetrics}>
        <div><dt>Registrations</dt><dd>{tournament.entryCount ?? 0}</dd></div>
        <div><dt>Squads</dt><dd>{tournament.squadCount ?? 0}</dd></div>
        <div><dt>Collected</dt><dd>{formatMoney(tournament.amountPaidCents)}</dd></div>
      </dl>
      <div className={styles.rowActions}>
        <Link href={organizerRoutes.overview(tournament.id)} className={styles.manageButton}
          aria-label={`Manage ${tournament.name}`}>Manage <ArrowUpRight size={15} aria-hidden="true" /></Link>
        {tournament.publicUrl && <Link href={tournament.publicUrl} className={styles.rowUtilityLink}
          target="_blank" rel="noreferrer" aria-label={`View public page for ${tournament.name} (opens in a new tab)`}>Public page</Link>}
        <button type="button" className={styles.rowDeleteButton}
          onClick={() => onDelete(tournament)} disabled={isDeleting || (tournament.entryCount ?? 0) > 0}
          aria-label={`Delete ${tournament.name}`}
          title={(tournament.entryCount ?? 0) > 0 ? 'Tournaments with registrations cannot be deleted.' : 'Delete tournament'}>
          <Trash2 size={15} aria-hidden="true" />{isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </article>
  );
}
