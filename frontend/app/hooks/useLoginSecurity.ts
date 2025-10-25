'use client';

import { useState, useEffect, useCallback } from 'react';





export interface LoginSecurityState {
  failedAttempts: number;
  loginDelay: number;
  capsLockOn: boolean;
  showPassword: boolean;
  mounted: boolean;
}

export interface LoginSecurityActions {
  setFailedAttempts: (attempts: number) => void;
  setLoginDelay: (delay: number | ((prev: number) => number)) => void;
  setCapsLockOn: (on: boolean) => void;
  setShowPassword: (show: boolean) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleKeyUp: (e: React.KeyboardEvent) => void;
  resetSecurity: () => void;
}

export interface UseLoginSecurityReturn extends LoginSecurityState, LoginSecurityActions {}

export const useLoginSecurity = (): UseLoginSecurityReturn => {
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loginDelay, setLoginDelay] = useState(0);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle mounted state for SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Password visibility timeout
  useEffect(() => {
    if (showPassword && mounted) {
      const timer = setTimeout(() => {
        setShowPassword(false);
      }, 10000); // Hide password after 10 seconds for security
      
      return () => clearTimeout(timer);
    }
  }, [showPassword, mounted]);

  // Caps lock detection
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockOn(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.getModifierState && !e.getModifierState('CapsLock')) {
      setCapsLockOn(false);
    }
  }, []);

  const resetSecurity = useCallback(() => {
    setFailedAttempts(0);
    setLoginDelay(0);
    setCapsLockOn(false);
    setShowPassword(false);
  }, []);

  return {
    failedAttempts,
    loginDelay,
    capsLockOn,
    showPassword,
    mounted,
    setFailedAttempts,
    setLoginDelay,
    setCapsLockOn,
    setShowPassword,
    handleKeyDown,
    handleKeyUp,
    resetSecurity
  };
};
