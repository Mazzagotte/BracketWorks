import { Avatar, ICON_SIZE, Menu, MenuItem, MenuNote, buttonClassName, menuItemClassName } from '@bracketworks/ui';
import { ArrowUpRight, Copy, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import TournamentStatusBadge from './TournamentStatusBadge';
import styles from './OrganizerDashboard.module.css';
import { organizerRoutes } from '../organizerRoutes';
import { formatTournamentDateRange } from '@/lib/tournamentDates';
import { formatMoney } from '../organizerFormatting';
import { fetchTournamentLogoBlobUrl } from '../setupPersistence';

/** The logo endpoint needs the organizer's token, which a plain image request can't send, so load it as a blob. */
function useTournamentLogo(tournamentId: number, hasLogo: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasLogo) return undefined;
    const token = sessionStorage.getItem('access_token');
    if (!token) return undefined;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchTournamentLogoBlobUrl(token, tournamentId)
      .then((next) => {
        objectUrl = next;
        if (!cancelled) setUrl(next);
        else if (next) URL.revokeObjectURL(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasLogo, tournamentId]);
  return url;
}

/** Intrinsic size of a tournament logo, matching the 32px avatar (`--space-8`). */
const LOGO_SIZE = 32;

type TournamentCardProps = {
  tournament: OrganizerDashboardTournament;
  isDeleting: boolean;
  onDelete: (tournament: OrganizerDashboardTournament) => void;
  onDuplicate?: (tournament: OrganizerDashboardTournament) => void;
};

/** One tournament as a divider row: Manage is the one visible action; the rest live in the "More" menu. */
export default function TournamentCard({ tournament, isDeleting, onDelete, onDuplicate }: TournamentCardProps) {
  const hasRegistrations = (tournament.entryCount ?? 0) > 0;
  const logoUrl = useTournamentLogo(tournament.id, tournament.hasLogo);
  return (
    <article className={styles.tournamentRow} aria-label={tournament.name}>
      <div className={styles.tournamentIdentity}>
        {logoUrl ? (
          <Image className={styles.logo} src={logoUrl} alt="" width={LOGO_SIZE} height={LOGO_SIZE} unoptimized />
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
        <Link
          href={organizerRoutes.overview(tournament.id)}
          className={buttonClassName({ variant: 'accent-outline', size: 'sm' })}
          aria-label={`Manage ${tournament.name}`}
        >
          Manage
          <ArrowUpRight size={ICON_SIZE.md} aria-hidden="true" />
        </Link>
        <Menu triggerLabel={`More actions for ${tournament.name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
          {tournament.publicUrl ? (
            <Link
              href={tournament.publicUrl}
              role="menuitem"
              className={menuItemClassName()}
              target="_blank"
              rel="noreferrer"
              aria-label={`View public page for ${tournament.name} (opens in a new tab)`}
            >
              <ExternalLink size={ICON_SIZE.md} aria-hidden="true" />
              View public page
            </Link>
          ) : null}
          {onDuplicate ? (
            <MenuItem icon={<Copy size={ICON_SIZE.md} />} onSelect={() => onDuplicate(tournament)} aria-label={`Duplicate ${tournament.name}`}>
              Duplicate
            </MenuItem>
          ) : null}
          <MenuItem
            tone="danger"
            icon={<Trash2 size={ICON_SIZE.md} />}
            onSelect={() => onDelete(tournament)}
            disabled={isDeleting || hasRegistrations}
            aria-label={`Delete ${tournament.name}`}
          >
            {isDeleting ? 'Deleting...' : 'Delete tournament'}
          </MenuItem>
          {hasRegistrations ? <MenuNote>Tournaments with registrations can&apos;t be deleted.</MenuNote> : null}
        </Menu>
      </div>
    </article>
  );
}
