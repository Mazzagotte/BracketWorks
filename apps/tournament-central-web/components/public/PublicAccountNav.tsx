'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useAuthSession } from '@/components/auth/useAuthSession';
import { signOut } from '@/components/auth/authSession';
import styles from '@/app/page.module.css';

export default function PublicAccountNav() {
  const { displayName, error: sessionError, retry } = useAuthSession();
  const menuRef = useRef<HTMLDetailsElement>(null);
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

  if (sessionError) return <div role="alert">{sessionError} <button type="button" onClick={retry}>Try again</button></div>;
  if (displayName === null) return <span role="status">Loading account...</span>;
  if (!displayName) {
    return <div className={styles.accountActions}>
      <Link className={styles.secondaryButton} href="/login">Sign In</Link>
      <Link className={styles.primaryButton} href="/signup">Create Account</Link>
    </div>;
  }
  return <nav className={styles.accountActions} aria-label="Account">
    <Link className={styles.primaryButton} href="/organizer">Organizer Dashboard</Link>
    <details ref={menuRef} className={styles.accountMenu} onKeyDown={(event) => {
      if (event.key === 'Escape' && menuRef.current) {
        menuRef.current.open = false;
        menuRef.current.querySelector('summary')?.focus();
      }
    }}>
      <summary>{displayName}</summary>
      <div>
        <Link href="/organizer/account">Account Settings</Link>
        <button type="button" disabled={isSigningOut} onClick={() => void handleSignOut()}>{isSigningOut ? 'Signing out...' : 'Sign Out'}</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  </nav>;
}
