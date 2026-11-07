'use client';

import { Avatar, ICON_SIZE, Menu, MenuItem, MenuStatus, TopNav, menuItemClassName, navItemClassName, topNavBrandClassName } from '@bracketworks/ui';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { signOut } from '../auth/authSession';
import { useAuthSession } from '../auth/useAuthSession';
import styles from './OrganizerTopNav.module.css';

export default function OrganizerTopNav() {
  const pathname = usePathname();
  const { displayName: sessionName } = useAuthSession();
  const [displayName, setDisplayName] = useState('Organizer');
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState('');

  const tournamentId = useMemo(() => {
    const match = pathname.match(/^\/organizer\/tournaments\/(\d+)(?:\/.*)?$/);
    return match ? Number(match[1]) : null;
  }, [pathname]);

  const navLinks = useMemo(() => {
    const links = [{ href: '/organizer', label: 'Dashboard' }];
    if (!tournamentId) return links;
    const base = `/organizer/tournaments/${tournamentId}`;
    return [
      ...links,
      { href: base, label: 'Overview' },
      { href: `${base}/registrations`, label: 'Registrations' },
      { href: `${base}/check-in`, label: 'Check-in' },
      { href: `${base}/setup`, label: 'Setup' },
      { href: `${base}/documents`, label: 'Documents' },
      { href: `${base}/team`, label: 'Team' },
    ];
  }, [tournamentId]);

  useEffect(() => {
    const readContext = () => {
      setDisplayName(localStorage.getItem('first_name') || localStorage.getItem('last_username') || 'Organizer');
      setActiveTournament(localStorage.getItem('tc_active_tournament_name'));
      setActiveSquad(localStorage.getItem('tc_active_squad_name'));
    };
    readContext();
    window.addEventListener('storage', readContext);
    return () => window.removeEventListener('storage', readContext);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.replace('/login');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  const tournamentLabel = tournamentId ? activeTournament || `Tournament #${tournamentId}` : null;

  return (
    <TopNav
      className={styles.topNav}
      navLabel="Organizer"
      brand={
        <Link href="/organizer" className={topNavBrandClassName()}>
          <Image src="/TC_logo_No_Text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />
          Tournament Central
        </Link>
      }
      contextTitle={tournamentLabel}
      contextMeta={tournamentLabel ? activeSquad : null}
      actions={
        <Menu
          triggerLabel="Open account menu"
          header={sessionName || displayName}
          trigger={
            <>
              <Avatar name={sessionName || displayName} />
              <ChevronDown size={ICON_SIZE.sm} aria-hidden="true" />
            </>
          }
        >
          <Link href="/organizer/account" role="menuitem" className={menuItemClassName()}>Account settings</Link>
          <Link href="/" role="menuitem" className={menuItemClassName()}>Browse tournaments</Link>
          <MenuItem tone="danger" onSelect={() => void handleLogout()}>Log out</MenuItem>
          {logoutError ? <MenuStatus>{logoutError}</MenuStatus> : null}
        </Menu>
      }
    >
      {navLinks.map((link) => {
        const active = pathname === link.href;
        return (
          <Link key={link.href} href={link.href} className={navItemClassName(active)} aria-current={active ? 'page' : undefined}>
            {link.label}
          </Link>
        );
      })}
    </TopNav>
  );
}
