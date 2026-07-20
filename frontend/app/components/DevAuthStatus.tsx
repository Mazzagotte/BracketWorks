'use client';

import { useAuth } from '../lib/auth-context';

export function DevAuthStatus() {
  const { isUserAuthenticated, currentUser, isAuthInitialized } = useAuth();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        fontSize: 11,
        borderRadius: 4,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {isAuthInitialized
        ? isUserAuthenticated
          ? `Auth: ${currentUser?.name ?? currentUser?.id ?? 'user'}`
          : 'Auth: none'
        : 'Auth: …'}
    </div>
  );
}
