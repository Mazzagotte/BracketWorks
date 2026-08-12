"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

import { logger } from './logger';
import { API, apiClient, getCsrfToken, getMemoryAccessToken, setMemoryAccessToken } from './api';

interface User {
  id: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
}

interface AuthSessionData {
  sessionId?: string;
}

interface LogoutOptions {
  fastRedirect?: boolean;
}

interface AuthContextType {
  authToken: string | null;
  currentUser: User | null;
  isUserAuthenticated: boolean;
  isAuthInitialized: boolean;
  authenticateUser: (authToken: string, userId: string, userData?: Partial<User>, authSession?: AuthSessionData) => void;
  logoutUser: (options?: LogoutOptions) => void;
  updateUserData: (userData: Partial<User>) => void;
  clearUserAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const clearAuthStorageKeys = useCallback(() => {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('session_id');
    localStorage.removeItem('user_id');
    localStorage.removeItem('userId');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('first_name');
  }, []);

  const clearAuthState = useCallback(() => {
    setMemoryAccessToken(null);
    setAuthToken(null);
    setCurrentUser(null);
    clearAuthStorageKeys();
  }, [clearAuthStorageKeys]);

  const getInitialAuthState = () => {
    return { authToken: getMemoryAccessToken(), currentUser: null };
  };

  const initialAuthState = getInitialAuthState();
  const [authToken, setAuthToken] = useState<string | null>(initialAuthState.authToken);
  const [currentUser, setCurrentUser] = useState<User | null>(initialAuthState.currentUser);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [isComponentMounted, setIsComponentMounted] = useState(false);

  // Restore the HTTP-only cookie session without persisting the access token.
  useEffect(() => {
    setIsComponentMounted(true);
    clearAuthStorageKeys();

    let cancelled = false;
    const restore = async () => {
      try {
        const restoredToken = await apiClient.restoreSession();
        if (!restoredToken || cancelled) return;
        const response = await apiClient.fetchWithAuth('/api/v1/users/me', { cache: 'no-store' }, false);
        if (!response.ok) return;
        const user = await response.json() as {
          id: number; email: string; first_name: string; last_name: string; is_admin: boolean;
        };
        if (cancelled) return;
        setAuthToken(restoredToken);
        setCurrentUser({
          id: String(user.id),
          email: user.email,
          name: [user.first_name, user.last_name].filter(Boolean).join(' '),
          isAdmin: user.is_admin,
        });
      } catch (error) {
        logger.info('No existing cookie session to restore', { error: String(error) });
      } finally {
        if (!cancelled) setIsAuthInitialized(true);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [clearAuthStorageKeys]);

  // Listen for storage changes and auth events
  useEffect(() => {
    const syncAuthFromMemoryAndIdentityHints = () => {
      if (!isComponentMounted) return;
      
      const effectiveToken = getMemoryAccessToken();
      const storedUserId = localStorage.getItem('user_id') || localStorage.getItem('userId');
      const storedFirstName = localStorage.getItem('first_name');
      const storedIsAdmin = localStorage.getItem('is_admin');
      
      if (effectiveToken && storedUserId && (!authToken || !currentUser)) {
        logger.info('Restoring auth state from memory token and identity hints', { userId: storedUserId });
        setAuthToken(effectiveToken);
        setCurrentUser({ 
          id: storedUserId, 
          name: storedFirstName || undefined,
          isAdmin: storedIsAdmin === '1' || storedIsAdmin === 'true',
        });
      } else if (!effectiveToken && (authToken || currentUser)) {
        logger.info('Clearing auth state due to localStorage change');
        setAuthToken(null);
        setCurrentUser(null);
      }
    };

    const handleAuthChange = () => {
      if (!isComponentMounted) return;
      logger.info('Handling auth-state-changed event');
      syncAuthFromMemoryAndIdentityHints();
    };

    const handleAuthExpired = () => {
      if (!isComponentMounted) return;
      logger.info('Handling auth-expired event');
      clearAuthState();
    };

    window.addEventListener('auth-state-changed', handleAuthChange);
    window.addEventListener('auth-expired', handleAuthExpired);
    
    // Initial check
    syncAuthFromMemoryAndIdentityHints();
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthChange);
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [isComponentMounted, authToken, currentUser, clearAuthState]);

  // Keep identity hints only; the access token remains in process memory.
  useEffect(() => {
    if (!isComponentMounted) return; // Wait for hydration

    if (authToken && currentUser) {
      setMemoryAccessToken(authToken);
      localStorage.removeItem('token');
      localStorage.setItem('user_id', currentUser.id);
      localStorage.setItem('is_admin', currentUser.isAdmin ? 'true' : 'false');
    } else if (!authToken && !currentUser) {
      clearAuthState();
    }
  }, [authToken, currentUser, isComponentMounted, clearAuthState]);

  const authenticateUser = (newAuthToken: string, userId: string, userData?: Partial<User>, authSession?: AuthSessionData) => {
    logger.info('Authenticating user', { userId });
    
    // Immediately update state
    setMemoryAccessToken(newAuthToken);
    setAuthToken(newAuthToken);
    setCurrentUser({ id: userId, ...userData });
    
    // Immediately save to localStorage
    localStorage.removeItem('token');
    if (authSession?.sessionId) {
      localStorage.setItem('session_id', authSession.sessionId);
    }
    localStorage.setItem('user_id', userId);
    if (userData?.name) {
      localStorage.setItem('first_name', userData.name);
    }
    localStorage.setItem('is_admin', userData?.isAdmin ? 'true' : 'false');
    
    // Force initialization state update
    setIsAuthInitialized(true);
    
    // Dispatch event to trigger re-renders
    if (typeof window !== 'undefined') {
      logger.info('Dispatching auth-state-changed event');
      window.dispatchEvent(new Event('auth-state-changed'));
    }
  };

  const clearPendingSaves = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pending_save_')) {
        localStorage.removeItem(key);
      }
    });
  };

  const logoutUser = (options?: LogoutOptions) => {
    const fastRedirect = Boolean(options?.fastRedirect);
    const existingToken = getMemoryAccessToken();

    // Clear critical auth state first so redirects are immediate and deterministic.
    setAuthToken(null);
    setMemoryAccessToken(null);
    setCurrentUser(null);
    clearAuthStorageKeys();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-changed'));
    }

    if (existingToken) {
      const csrfToken = getCsrfToken();
      const logoutHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${existingToken}`,
      };
      if (csrfToken) {
        logoutHeaders['x-csrf-token'] = csrfToken;
      }

      fetch(API('/api/v1/users/logout'), {
        method: 'POST',
        credentials: 'include',
        keepalive: fastRedirect,
        headers: logoutHeaders,
        body: JSON.stringify({ all_sessions: false }),
      }).catch((error) => {
        logger.warn('Backend logout failed', { error: String(error) });
      });
    }

    if (fastRedirect) {
      window.setTimeout(() => {
        try {
          clearPendingSaves();
        } catch (error) {
          logger.warn('Deferred pending save cleanup failed', { error: String(error) });
        }
      }, 0);
      return;
    }

    clearPendingSaves();
  };

  const updateUserData = (userData: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...userData });
    }
  };

  const clearUserAuth = () => {
    logoutUser();
  };

  const authContextValue: AuthContextType = {
    authToken,
    currentUser,
    isUserAuthenticated: !!(authToken && currentUser),
    isAuthInitialized,
    authenticateUser,
    logoutUser,
    updateUserData,
    clearUserAuth,
  };

  // Debug logging for auth state changes
  useEffect(() => {
    if (isComponentMounted) {
      logger.info('Auth Context State Update:', {
        authToken: !!authToken,
        currentUser: !!currentUser,
        isAuthenticated: !!(authToken && currentUser),
        isInitialized: isAuthInitialized,
        mounted: isComponentMounted
      });
    }
  }, [authToken, currentUser, isAuthInitialized, isComponentMounted]);

  // No loading screen - provide context immediately
  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hooks for easier usage
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // More descriptive error message for debugging
    logger.error('useAuth called outside of AuthProvider context');
    throw new Error('Authentication context is not available. Please refresh the page.');
  }
  return context;
}
