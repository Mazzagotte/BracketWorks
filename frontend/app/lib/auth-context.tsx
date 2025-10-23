"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { logger } from './logger';



interface User {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (token: string, userId: string, userData?: Partial<User>) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize auth state synchronously to prevent race conditions
  useEffect(() => {
    // Set mounted immediately
    setMounted(true);
    
    // Initialize from localStorage synchronously (no delays)
    try {
      const storedToken = localStorage.getItem('token');
      const storedUserId = localStorage.getItem('user_id');
      const storedFirstName = localStorage.getItem('first_name');
      
      if (storedToken && storedUserId) {
        setToken(storedToken);
        setUser({ 
          id: storedUserId, 
          name: storedFirstName || undefined 
        });
      }
    } catch (error) {
      logger.error('❌ Error initializing auth:', error);
    }
    
    // Mark as initialized immediately after sync initialization
    setIsInitialized(true);
  }, []); // Run once on mount, no dependencies

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isInitialized) return;

    if (token && user) {
      localStorage.setItem('token', token);
      localStorage.setItem('user_id', user.id);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('userId'); // Handle inconsistent key usage
    }
  }, [token, user, isInitialized]);

  const login = (newToken: string, userId: string, userData?: Partial<User>) => {
    setToken(newToken);
    setUser({ id: userId, ...userData });
    
    // Immediately save to localStorage
    localStorage.setItem('token', newToken);
    localStorage.setItem('user_id', userId);
    if (userData?.name) {
      localStorage.setItem('first_name', userData.name);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    // Clear any other auth-related localStorage items
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('userId');
    // Clear any pending saves that might contain sensitive data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pending_save_')) {
        localStorage.removeItem(key);
      }
    });
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const clearAuth = () => {
    logout();
  };

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!(token && user),
    isInitialized: mounted && isInitialized,
    login,
    logout,
    updateUser,
    clearAuth,
  };

  // Always provide the context, but show loading UI when not initialized
  return (
    <AuthContext.Provider value={value}>
      {(!mounted || !isInitialized) ? (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Loading...</div>
            <div>Initializing BracketWorks...</div>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

// Custom hooks for easier usage
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // More descriptive error message for debugging
    logger.error('🚨 useAuth called outside of AuthProvider context');
    throw new Error('Authentication context is not available. Please refresh the page.');
  }
  return context;
}

export function useToken(): string | null {
  const { token } = useAuth();
  return token;
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

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

// Utility function for making authenticated API calls
export function useAuthenticatedFetch() {
  const { token, logout } = useAuth();

  return async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Auto-logout on 401 responses
    if (response.status === 401) {
      logout();
      throw new Error('Authentication expired');
    }

    return response;
  };
}