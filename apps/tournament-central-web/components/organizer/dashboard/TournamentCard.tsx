import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, MapPin, Users, UsersRound, Coins, Eye } from 'lucide-react';

import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import TournamentStatusBadge from './TournamentStatusBadge';
import styles from './OrganizerDashboard.module.css';
import { organizerRoutes } from '../organizerRoutes';

function formatDateRange(startDate: string | null, endDate: string | null): string {
  const dateValue = startDate || endDate;
  if (!dateValue) {
    return 'Dates not set';
  }

  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
    return dateValue;
  }

  if (start && end) {
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}-${end.toLocaleDateString(undefined, { day: 'numeric', year: 'numeric' })}`;
    }

    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  const date = start || end;
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Dates not set';
}

function parseLocation(location: string | null): { venue: string; cityState: string } {
  if (!location) {
    return { venue: 'Location not set', cityState: '' };
  }

  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { venue: parts.slice(0, -2).join(', '), cityState: `${parts[parts.length - 2]}, ${parts[parts.length - 1]}` };
  }

  if (parts.length === 2) {
    return { venue: parts[0], cityState: parts[1] };
  }

  return { venue: parts[0], cityState: '' };
}

type TournamentCardProps = {
  tournament: OrganizerDashboardTournament;
};

export default function TournamentCard({ tournament }: TournamentCardProps) {
  const location = parseLocation(tournament.location);
  const formattedDate = formatDateRange(tournament.startDate, tournament.endDate);

  return (
    <article className={styles.featureCard}>
      <div className={styles.posterPanel} aria-hidden="true">
        {tournament.hasLogo ? (
          <Image
            className={styles.tournamentLogo}
            src={`/api/v1/tc/tournaments/${tournament.id}/logo`}
            alt=""
            fill
            sizes="210px"
            unoptimized
          />
        ) : (
          <div className={styles.posterMark}>USBC</div>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardHeaderRow}>
          <TournamentStatusBadge isPublic={tournament.isPublic} hasPublishedSetup={tournament.hasPublishedSetup} />
        </div>

        <h3>{tournament.name}</h3>

        <div className={styles.infoRow}>
          <CalendarDays className={styles.infoGlyph} />
          <span>{formattedDate}</span>
        </div>

        <div className={styles.infoRow}>
          <MapPin className={styles.infoGlyph} />
          <span>{location.cityState || location.venue}</span>
        </div>

        <div className={styles.statList}>
          <div className={styles.statItem}>
            <Users className={styles.statIcon} />
            <strong>{tournament.entryCount ?? 0}</strong>
            <small>Registrations</small>
          </div>
          <div className={styles.statItem}>
            <UsersRound className={styles.statIcon} />
            <strong>{tournament.squadCount ?? 0}</strong>
            <small>Squads</small>
          </div>
          <div className={styles.statItem}>
            <Coins className={styles.statIcon} />
            <strong>{`$${(tournament.amountPaidCents / 100).toLocaleString()}`}</strong>
            <small>Collected</small>
          </div>
        </div>

        <div className={styles.cardFooterRow}>
          <div className={styles.cardActions}>
            <Link href={organizerRoutes.overview(tournament.id)} className={styles.primaryButtonCompact}>View Overview</Link>
            {tournament.publicUrl ? (
              <Link href={tournament.publicUrl} className={styles.secondaryButtonCompact} target="_blank" rel="noreferrer">
                <Eye className={styles.actionIcon} aria-hidden="true" />
                <span>View Public</span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
