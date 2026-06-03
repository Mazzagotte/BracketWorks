"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../app/lib/auth-context';
import { logger } from '../app/lib/logger';
import { shouldRequireTimeSlotBeforeLeavingDashboard, showSelectTimeSlotReminder } from '../app/lib/selection-session';
import { navLinks } from './nav-links';
import styles from './MobileNav.module.css';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  firstName?: string;
  currentPage?: string;
}

export function MobileNav({ isOpen, onClose, firstName, currentPage }: MobileNavProps) {
  const router = useRouter();
  const { logoutUser, currentUser } = useAuth();
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const visibleLinks = useMemo(
    () => (currentUser?.isAdmin
      ? [...navLinks, { href: '/admin', label: 'Admin' }]
      : navLinks),
    [currentUser?.isAdmin]
  );

  const handleLogout = () => {
    logger.userAction('User logged out via mobile nav');
    logoutUser();
    window.location.assign('/login');
  };

  const handleProtectedNavigation = (event: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
    const currentPath = `/${currentPage || ''}`.replace('//', '/');
    if (shouldRequireTimeSlotBeforeLeavingDashboard(currentPath, targetPath)) {
      event.preventDefault();
      showSelectTimeSlotReminder();
      return;
    }

    onClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const firstTouch = e.touches[0];
    if (!firstTouch) return;
    setTouchStartY(firstTouch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const firstTouch = e.touches[0];
    if (!firstTouch) return;
    const diff = touchStartY - firstTouch.clientY;
    if (diff > 50) {
      onClose();
      setTouchStartY(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const routesToPrefetch = new Set<string>([
      ...visibleLinks.map(link => link.href),
      '/settings',
      '/dashboard',
    ]);

    routesToPrefetch.forEach(route => {
      router.prefetch(route);
    });
  }, [isOpen, router, visibleLinks]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        role="button"
        tabIndex={0}
        aria-label="Close navigation menu"
      />

      <nav
        className={styles.panel}
        role="navigation"
        aria-label="Mobile navigation menu"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className={styles.swipeIndicator} />

        <div className={styles.header}>
          <div className={styles.greeting}>Welcome back!</div>
          {firstName && <div className={styles.userName}>{firstName}</div>}
        </div>

        <div className={styles.items}>
          {visibleLinks.map(item => {
            const isActive = currentPage === item.href.slice(1);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={event => handleProtectedNavigation(event, item.href)}
                className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className={styles.logoutWrap}>
          <Link
            href="/settings"
            onClick={event => handleProtectedNavigation(event, '/settings')}
            className={`${styles.settingsBtn} ${currentPage === 'settings' ? styles.settingsBtnActive : ''}`}
            aria-current={currentPage === 'settings' ? 'page' : undefined}
          >
            Settings
          </Link>
          <button onClick={handleLogout} className={styles.logoutBtn} aria-label="Logout">
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}
