'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { Avatar, Button, ICON_SIZE, Menu, MenuItem, MenuStatus, Notice, buttonClassName } from '@bracketworks/ui';

import { useAuthSession } from '@/components/auth/useAuthSession';
import { signOut } from '@/components/auth/authSession';
import styles from './PublicAccountNav.module.css';

/** Top-bar account controls on public pages: sign in and create account, or the organizer's menu. */
export default function PublicAccountNav() {
  const { displayName, error: sessionError, retry } = useAuthSession();
  const [error, setError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError('');
    try {
      await signOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (sessionError) {
    return (
      <Notice tone="danger" role="alert" action={<Button size="sm" variant="ghost" onClick={retry}>Try again</Button>}>
        {sessionError}
      </Notice>
    );
  }
  if (displayName === null) return <span className={styles.status} role="status">Loading account...</span>;
  if (!displayName) {
    return (
      <div className={styles.actions}>
        <Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} href="/login">Sign in</Link>
        <Link className={buttonClassName({ variant: 'primary', size: 'sm' })} href="/signup">Create account</Link>
      </div>
    );
  }
  return (
    <nav className={styles.actions} aria-label="Account">
      <Link className={buttonClassName({ variant: 'secondary', size: 'sm', className: styles.wideOnly })} href="/organizer">Organizer dashboard</Link>
      <Menu
        triggerLabel={`${displayName} account menu`}
        trigger={(
          <>
            <Avatar name={displayName} />
            <span className={styles.name}>{displayName}</span>
            <ChevronDown size={ICON_SIZE.sm} aria-hidden="true" />
          </>
        )}
      >
        <MenuItem href="/organizer" icon={<LayoutDashboard size={ICON_SIZE.md} />} className={styles.narrowOnly}>Organizer dashboard</MenuItem>
        <MenuItem href="/organizer/account" icon={<Settings size={ICON_SIZE.md} />}>Account settings</MenuItem>
        <MenuItem onSelect={() => { void handleSignOut(); }} disabled={isSigningOut} icon={<LogOut size={ICON_SIZE.md} />}>
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </MenuItem>
        {error ? <MenuStatus>{error}</MenuStatus> : null}
      </Menu>
    </nav>
  );
}
