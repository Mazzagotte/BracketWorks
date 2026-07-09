"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

import { logger } from './logger';
import { API, getCsrfToken } from './api';

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
  const clearAuthState = () => {
    setAuthToken(null);
    setCurrentUser(null);
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('session_id');
    localStorage.removeItem('user_id');
    localStorage.removeItem('userId');
    localStorage.removeItem('is_admin');
  };

  const getInitialAuthState = () => {
    if (typeof window === 'undefined') return { authToken: null, currentUser: null };
    
    try {
      const storedAuthToken = sessionStorage.getItem('token') || localStorage.getItem('token');
      const storedUserId = localStorage.getItem('user_id') || localStorage.getItem('userId');
      const storedFirstName = localStorage.getItem('first_name');
      const storedIsAdmin = localStorage.getItem('is_admin');
      
      if (storedAuthToken && storedUserId) {
        return {
          authToken: storedAuthToken,
          currentUser: { 
            id: storedUserId, 
            name: storedFirstName || undefined,
            isAdmin: storedIsAdmin === '1' || storedIsAdmin === 'true',
          }
        };
      }
    } catch (error) {
      logger.error('Error reading auth from localStorage:', error);
    }
    
    return { authToken: null, currentUser: null };
  };

  const initialAuthState = getInitialAuthState();
  const [authToken, setAuthToken] = useState<string | null>(initialAuthState.authToken);
  const [currentUser, setCurrentUser] = useState<User | null>(initialAuthState.currentUser);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [isComponentMounted, setIsComponentMounted] = useState(false);

  // Set mounted flag for hydration safety
  useEffect(() => {
    setIsComponentMounted(true);
    setIsAuthInitialized(true);
  }, []);

  // Listen for storage changes and auth events
  useEffect(() => {
    const handleStorageChange = () => {
      if (!isComponentMounted) return;
      
      const storedToken = localStorage.getItem('token');
      const sessionToken = sessionStorage.getItem('token');
      const effectiveToken = sessionToken || storedToken;
      const storedUserId = localStorage.getItem('user_id') || localStorage.getItem('userId');
      const storedFirstName = localStorage.getItem('first_name');
      const storedIsAdmin = localStorage.getItem('is_admin');
      
      if (effectiveToken && storedUserId && (!authToken || !currentUser)) {
        logger.info('Restoring auth state from localStorage on storage change', { userId: storedUserId });
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
      handleStorageChange();
    };

    const handleAuthExpired = () => {
      if (!isComponentMounted) return;
      logger.info('Handling auth-expired event');
      clearAuthState();
      window.dispatchEvent(new Event('auth-state-changed'));
    };

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-state-changed', handleAuthChange);
    window.addEventListener('auth-expired', handleAuthExpired);
    
    // Initial check
    handleStorageChange();
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthChange);
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [isComponentMounted, authToken, currentUser]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isComponentMounted) return; // Wait for hydration

    if (authToken && currentUser) {
      sessionStorage.setItem('token', authToken);
      localStorage.removeItem('token');
      localStorage.setItem('user_id', currentUser.id);
      localStorage.setItem('is_admin', currentUser.isAdmin ? 'true' : 'false');
    } else if (!authToken && !currentUser) {
      clearAuthState();
    }
  }, [authToken, currentUser, isComponentMounted]);

  const authenticateUser = (newAuthToken: string, userId: string, userData?: Partial<User>, authSession?: AuthSessionData) => {
    logger.info('Authenticating user', { userId });
    
    // Immediately update state
    setAuthToken(newAuthToken);
    setCurrentUser({ id: userId, ...userData });
    
    // Immediately save to localStorage
    sessionStorage.setItem('token', newAuthToken);
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
      
      // Force a storage event as well
      window.dispatchEvent(new Event('storage'));
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
    const existingToken = typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;

    // Clear critical auth state first so redirects are immediate and deterministic.
    setAuthToken(null);
    setCurrentUser(null);
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('session_id');
    localStorage.removeItem('user_id');
    localStorage.removeItem('userId');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('first_name');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-changed'));
      window.dispatchEvent(new Event('storage'));
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