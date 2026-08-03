'use client';

import { useAuth } from '../lib/auth-context';
import styles from './DevAuthStatus.module.css';

export function DevAuthStatus() {
  const { isUserAuthenticated, currentUser, isAuthInitialized } = useAuth();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className={styles.status}>
      {isAuthInitialized
        ? isUserAuthenticated
          ? `Auth: ${currentUser?.name ?? currentUser?.id ?? 'user'}`
          : 'Auth: none'
        : 'Auth: ...'}
    </div>
  );
}
