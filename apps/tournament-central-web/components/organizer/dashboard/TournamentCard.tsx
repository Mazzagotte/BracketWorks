import { Avatar, Button, ICON_SIZE, buttonClassName } from '@bracketworks/ui';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import TournamentStatusBadge from './TournamentStatusBadge';
import styles from './OrganizerDashboard.module.css';
import { organizerRoutes } from '../organizerRoutes';
import { formatTournamentDateRange } from '@/lib/tournamentDates';
import { formatMoney } from '../organizerFormatting';

/** Intrinsic size of a tournament logo, matching the 32px avatar (`--space-8`). */
const LOGO_SIZE = 32;

type TournamentCardProps = {
  tournament: OrganizerDashboardTournament;
  isDeleting: boolean;
  onDelete: (tournament: OrganizerDashboardTournament) => void;
};

/** One tournament as a divider row in the "Your tournaments" card. */
export default function TournamentCard({ tournament, isDeleting, onDelete }: TournamentCardProps) {
  const hasRegistrations = (tournament.entryCount ?? 0) > 0;
  return (
    <article className={styles.tournamentRow} aria-label={tournament.name}>
      <div className={styles.tournamentIdentity}>
        {tournament.hasLogo ? (
          <Image className={styles.logo} src={`/api/v1/tc/tournaments/${tournament.id}/logo`} alt="" width={LOGO_SIZE} height={LOGO_SIZE} unoptimized />
        ) : (
          <Avatar name={tournament.name} />
        )}
        <div className={styles.rowText}>
          <div className={styles.titleLine}>
            <h3 className={styles.rowTitle}>
              <Link href={organizerRoutes.overview(tournament.id)} className={styles.rowLink}>{tournament.name}</Link>
            </h3>
            <TournamentStatusBadge isPublic={tournament.isPublic} hasPublishedSetup={tournament.hasPublishedSetup} />
          </div>
          <p className={styles.rowMeta}>
            {formatTournamentDateRange(tournament.startDate, tournament.endDate)} · {tournament.location || 'Location not set'}
          </p>
        </div>
      </div>
      <dl className={styles.metrics}>
        <div><dt>Registrations</dt><dd>{tournament.entryCount ?? 0}</dd></div>
        <div><dt>Squads</dt><dd>{tournament.squadCount ?? 0}</dd></div>
        <div><dt>Collected</dt><dd>{formatMoney(tournament.amountPaidCents)}</dd></div>
      </dl>
      <div className={styles.rowActions}>
        {tournament.publicUrl ? (
          <Link
            href={tournament.publicUrl}
            className={buttonClassName({ variant: 'ghost', size: 'sm' })}
            target="_blank"
            rel="noreferrer"
            aria-label={`View public page for ${tournament.name} (opens in a new tab)`}
          >
            Public page
          </Link>
        ) : null}
        <Button
          variant="ghost-danger"
          size="sm"
          icon={<Trash2 size={ICON_SIZE.md} />}
          onClick={() => onDelete(tournament)}
          disabled={isDeleting || hasRegistrations}
          aria-label={`Delete ${tournament.name}`}
          title={hasRegistrations ? 'Tournaments with registrations cannot be deleted.' : 'Delete tournament'}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
        <Link
          href={organizerRoutes.overview(tournament.id)}
          className={buttonClassName({ variant: 'accent-outline', size: 'sm' })}
          aria-label={`Manage ${tournament.name}`}
        >
          Manage
          <ArrowUpRight size={ICON_SIZE.md} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
