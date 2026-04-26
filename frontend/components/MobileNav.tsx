"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../app/lib/auth-context';
import { logger } from '../app/lib/logger';
import { navLinks } from './nav-links';
import styles from './MobileNav.module.css';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  firstName?: string;
  currentPage?: string;
}

export function MobileNav({ isOpen, onClose, firstName, currentPage }: MobileNavProps) {
  const { logout } = useAuth();
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleLogout = () => {
    logger.userAction('User logged out via mobile nav');
    logout();
    window.location.href = '/login';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const diff = touchStartY - e.touches[0].clientY;
    if (diff > 50) {
      onClose();
      setTouchStartY(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

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
          {navLinks.map(item => {
            const isActive = currentPage === item.href.slice(1);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
            onClick={onClose}
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
