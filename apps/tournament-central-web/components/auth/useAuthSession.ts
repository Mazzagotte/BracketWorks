'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AUTH_SESSION_EVENT, hasRefreshSession, restoreAuthSession } from './authSession';

let restoration: Promise<boolean> | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener(AUTH_SESSION_EVENT, onChange);
  window.addEventListener('storage', onChange);
  window.addEventListener('pageshow', onChange);
  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    window.removeEventListener('pageshow', onChange);
  };
}

function getSnapshot(): string {
  return sessionStorage.getItem('access_token') && localStorage.getItem('user_id')
    ? localStorage.getItem('first_name') || 'Organizer'
    : '';
}

export function useAuthSession() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const needsRestore = snapshot === '' && !restored && hasRefreshSession();
  useEffect(() => {
    if (!needsRestore) return;
    let cancelled = false;
    // The organizer guard and navigation can mount together; rotate the refresh token only once.
    restoration ??= restoreAuthSession().finally(() => { restoration = null; });
    void restoration.then(() => {
      if (!cancelled) setRestored(true);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to restore your account session.');
    });
    return () => { cancelled = true; };
  }, [needsRestore, attempt]);
  return {
    displayName: needsRestore ? null : snapshot,
    error,
    retry: () => { setError(''); setAttempt((value) => value + 1); },
  };
}
