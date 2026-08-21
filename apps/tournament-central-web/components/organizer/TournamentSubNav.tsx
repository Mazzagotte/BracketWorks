'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText, Grid2X2, Users, UsersRound, Wallet, Wrench } from 'lucide-react';

import { useTournamentContext } from './TournamentContext';
import { isOrganizerRouteActive, organizerRoutes } from './organizerRoutes';
import styles from './TournamentSubNav.module.css';

type SubNavItem = {
  label: string;
  icon: typeof Grid2X2;
  href: string | null;
};

export default function TournamentSubNav() {
  const pathname = usePathname();
  const { tournamentId } = useTournamentContext();

  const items: SubNavItem[] = [
    { label: 'Overview', icon: Grid2X2, href: organizerRoutes.overview(tournamentId) },
    { label: 'Registrations', icon: Users, href: organizerRoutes.registrations(tournamentId) },
    { label: 'Squads', icon: CalendarDays, href: organizerRoutes.squads(tournamentId) },
    { label: 'Participants', icon: UsersRound, href: organizerRoutes.participants(tournamentId) },
    { label: 'Payments', icon: Wallet, href: organizerRoutes.payments(tournamentId) },
    { label: 'Documents', icon: FileText, href: organizerRoutes.documents(tournamentId) },
    { label: 'Setup', icon: Wrench, href: organizerRoutes.setup(tournamentId) },
  ];

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabBar} aria-label="Tournament sections">
        {items.map((item) => {
          const Icon = item.icon;
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.tab} ${isOrganizerRouteActive(pathname, item.href) ? styles.tabActive : ''}`}
            >
              <Icon aria-hidden="true" />
              {item.label}
            </Link>
          ) : (
            <span key={item.label} className={`${styles.tab} ${styles.tabDisabled}`} aria-disabled="true" title="This section is not available yet">
              <Icon aria-hidden="true" />
              {item.label}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
