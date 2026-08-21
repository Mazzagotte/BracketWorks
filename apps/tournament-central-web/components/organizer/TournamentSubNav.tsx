'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText, Grid2X2, Users, UsersRound, Wallet, Wrench } from 'lucide-react';

import { useTournamentContext } from './TournamentContext';
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
    { label: 'Overview', icon: Grid2X2, href: `/organizer/tournaments/${tournamentId}` },
    { label: 'Registrations', icon: Users, href: `/organizer/tournaments/${tournamentId}/registrations` },
    { label: 'Squads', icon: CalendarDays, href: `/organizer/tournaments/${tournamentId}/squads` },
    { label: 'Participants', icon: UsersRound, href: `/organizer/tournaments/${tournamentId}/participants` },
    { label: 'Payments', icon: Wallet, href: `/organizer/tournaments/${tournamentId}/payments` },
    { label: 'Documents', icon: FileText, href: `/organizer/tournaments/${tournamentId}/documents` },
    { label: 'Setup', icon: Wrench, href: `/organizer/tournaments/${tournamentId}/setup` },
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
              className={`${styles.tab} ${pathname === item.href ? styles.tabActive : ''}`}
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
