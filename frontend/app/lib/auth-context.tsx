"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

import { logger } from './logger';
import { API } from './api';



interface User {
  id: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
}

interface AuthSessionData {
  refreshToken?: string;
  sessionId?: string;
}

interface AuthContextType {
  // New descriptive names
  authToken: string | null;
  currentUser: User | null;
  isUserAuthenticated: boolean;
  isAuthInitialized: boolean;
  authenticateUser: (authToken: string, userId: string, userData?: Partial<User>, authSession?: AuthSessionData) => void;
  logoutUser: () => void;
  updateUserData: (userData: Partial<User>) => void;
  clearUserAuth: () => void;
  
  // Backward compatibility properties (deprecated but functional)
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (token: string, userId: string, userData?: Partial<User>, authSession?: AuthSessionData) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const getInitialAuthState = () => {
    if (typeof window === 'undefined') return { authToken: null, currentUser: null };
    
    try {
      const storedAuthToken = localStorage.getItem('token');
      const storedUserId = localStorage.getItem('user_id');
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

  // Refs let the storage event handler always see current values without
  // being listed as effect dependencies (avoids the re-render loop).
  const authTokenRef = useRef(authToken);
  const currentUserRef = useRef(currentUser);
  useEffect(() => { authTokenRef.current = authToken; }, [authToken]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

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
      const storedUserId = localStorage.getItem('user_id');
      const storedFirstName = localStorage.getItem('first_name');
      const storedIsAdmin = localStorage.getItem('is_admin');
      
      if (storedToken && storedUserId && (!authToken || !currentUser)) {
        logger.info('Restoring auth state from localStorage on storage change', { userId: storedUserId });
        setAuthToken(storedToken);
        setCurrentUser({ 
          id: storedUserId, 
          name: storedFirstName || undefined,
          isAdmin: storedIsAdmin === '1' || storedIsAdmin === 'true',
        });
      } else if (!storedToken && (authToken || currentUser)) {
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

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-state-changed', handleAuthChange);
    
    // Initial check
    handleStorageChange();
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthChange);
    };
  }, [isComponentMounted, authToken, currentUser]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isComponentMounted) return; // Wait for hydration

    if (authToken && currentUser) {
      localStorage.setItem('token', authToken);
      localStorage.setItem('user_id', currentUser.id);
      localStorage.setItem('is_admin', currentUser.isAdmin ? 'true' : 'false');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('session_id');
      localStorage.removeItem('user_id');
      localStorage.removeItem('userId'); // Handle inconsistent key usage
      localStorage.removeItem('is_admin');
    }
  }, [authToken, currentUser, isComponentMounted]);

  const authenticateUser = (newAuthToken: string, userId: string, userData?: Partial<User>, authSession?: AuthSessionData) => {
    logger.info('Authenticating user', { userId });
    
    // Immediately update state
    setAuthToken(newAuthToken);
    setCurrentUser({ id: userId, ...userData });
    
    // Immediately save to localStorage
    localStorage.setItem('token', newAuthToken);
    if (authSession?.refreshToken) {
      localStorage.setItem('refresh_token', authSession.refreshToken);
    }
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

  const logoutUser = () => {
    const existingToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const existingRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

    if (existingToken) {
      fetch(API('/api/v1/users/logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${existingToken}`,
        },
        body: JSON.stringify({ refresh_token: existingRefreshToken, all_sessions: false }),
      }).catch((error) => {
        logger.warn('Backend logout failed', { error: String(error) });
      });
    }

    setAuthToken(null);
    setCurrentUser(null);
    // Clear any other auth-related localStorage items
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('session_id');
    localStorage.removeItem('user_id');
    localStorage.removeItem('userId');
    localStorage.removeItem('is_admin');
    // Clear any pending saves that might contain sensitive data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pending_save_')) {
        localStorage.removeItem(key);
      }
    });
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
    // New descriptive properties
    authToken,
    currentUser,
    isUserAuthenticated: !!(authToken && currentUser),
    isAuthInitialized: isAuthInitialized, // Use the explicit state
    authenticateUser,
    logoutUser,
    updateUserData,
    clearUserAuth,
    
    // Backward compatibility properties
    token: authToken,
    user: currentUser,
    isAuthenticated: !!(authToken && currentUser),
    isInitialized: isComponentMounted,
    login: authenticateUser,
    logout: logoutUser,
    updateUser: updateUserData,
    clearAuth: clearUserAuth,
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

export function useAuthToken(): string | null {
  const { authToken } = useAuth();
  return authToken;
}

// Hook to check if auth is still initializing
export function useAuthInitialized(): boolean {
  const [mounted, setMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if localStorage is accessible (client-side)
    try {
      localStorage.getItem('test');
      setIsInitialized(true);
    } catch {
      // Still server-side or localStorage not available
      setTimeout(() => setIsInitialized(true), 100);
    }
  }, []);

  return mounted && isInitialized;
}

export function useCurrentUser(): User | null {
  const { currentUser } = useAuth();
  return currentUser;
}

export function useIsAuthenticated(): boolean {
  const { isUserAuthenticated } = useAuth();
  return isUserAuthenticated;
}

// Utility function for making authenticated API calls
export function useAuthenticatedFetch() {
  const { authToken, logoutUser } = useAuth();

  return async (url: string, options: RequestInit = {}) => {
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
      if (refreshToken) {
        try {
          const refreshResponse = await fetch(API('/api/v1/users/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData?.access_token) {
              localStorage.setItem('token', refreshData.access_token);
              if (refreshData.refresh_token) {
                localStorage.setItem('refresh_token', refreshData.refresh_token);
              }
              if (refreshData.session_id) {
                localStorage.setItem('session_id', refreshData.session_id);
              }

              response = await fetch(url, {
                ...options,
                headers: {
                  ...headers,
                  Authorization: `Bearer ${refreshData.access_token}`,
                },
              });
            }
          }
        } catch (error) {
          logger.warn('Authenticated fetch refresh failed', { error: String(error) });
        }
      }
    }

    // Auto-logout on terminal 401 responses
    if (response.status === 401) {
      logoutUser();
      throw new Error('Authentication expired');
    }

    return response;
  };
}

// Backward compatibility exports for existing code
export const useToken = useAuthToken;
export const useUser = useCurrentUser;