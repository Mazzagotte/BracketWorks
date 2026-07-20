'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  startLoginDelay: (seconds: number) => void;
  clearLoginDelay: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleKeyUp: (e: React.KeyboardEvent) => void;
  resetSecurity: () => void;
}

export interface UseLoginSecurityReturn extends LoginSecurityState, LoginSecurityActions {}

type UseLoginSecurityOptions = {
  passwordAutoHideMs?: number;
  onPasswordAutoHide?: () => void;
};

export const useLoginSecurity = (
  options: UseLoginSecurityOptions = {}
): UseLoginSecurityReturn => {
  const { passwordAutoHideMs = 10000, onPasswordAutoHide } = options;
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loginDelay, setLoginDelay] = useState(0);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const loginDelayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle mounted state for SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Password visibility timeout
  useEffect(() => {
    if (showPassword && mounted) {
      const timer = setTimeout(() => {
        setShowPassword(false);
        onPasswordAutoHide?.();
      }, passwordAutoHideMs);
      
      return () => clearTimeout(timer);
    }
  }, [mounted, onPasswordAutoHide, passwordAutoHideMs, showPassword]);

  useEffect(() => {
    return () => {
      if (loginDelayTimerRef.current) {
        clearInterval(loginDelayTimerRef.current);
      }
    };
  }, []);

  const clearLoginDelay = useCallback(() => {
    if (loginDelayTimerRef.current) {
      clearInterval(loginDelayTimerRef.current);
      loginDelayTimerRef.current = null;
    }
    setLoginDelay(0);
  }, []);

  const startLoginDelay = useCallback((seconds: number) => {
    clearLoginDelay();
    setLoginDelay(seconds);
    loginDelayTimerRef.current = setInterval(() => {
      setLoginDelay(prev => {
        if (prev <= 1) {
          if (loginDelayTimerRef.current) {
            clearInterval(loginDelayTimerRef.current);
            loginDelayTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearLoginDelay]);

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
    clearLoginDelay();
    setCapsLockOn(false);
    setShowPassword(false);
  }, [clearLoginDelay]);

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
    startLoginDelay,
    clearLoginDelay,
    handleKeyDown,
    handleKeyUp,
    resetSecurity
  };
};
