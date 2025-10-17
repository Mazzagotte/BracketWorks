"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
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

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    if (!mounted) return; // Wait for client-side hydration
    
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
      console.error('❌ Error initializing auth:', error);
    }
    setIsInitialized(true);
  }, [mounted]);

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
    login,
    logout,
    updateUser,
    clearAuth,
  };

  // Don't render children until component is mounted to prevent hydration issues
  if (!mounted) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hooks for easier usage
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // More descriptive error message for debugging
    console.error('🚨 useAuth called outside of AuthProvider context');
    throw new Error('Authentication context is not available. Please refresh the page.');
  }
  return context;
}

export function useToken(): string | null {
  const { token } = useAuth();
  return token;
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