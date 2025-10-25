'use client';

import { useState, useCallback } from 'react';

import { useAuth } from '../lib/auth-context';
import { getErrorMessage, getErrorContext } from '../lib/error-utils';
import { useToast } from '../components/Toast';
import { logger } from '../lib/logger';
import { API } from '../lib/api';



export interface LoginFormState {
  username: string;
  password: string;
  error: string;
  success: string;
  loading: boolean;
  showButtonBall: boolean;
}

export interface LoginFormActions {
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  setLoading: (loading: boolean) => void;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  clearForm: () => void;
}

export interface UseLoginFormReturn extends LoginFormState, LoginFormActions {}

export const useLoginForm = (
  failedAttempts: number,
  setFailedAttempts: (attempts: number) => void,
  loginDelay: number,
  setLoginDelay: (delay: number | ((prev: number) => number)) => void
): UseLoginFormReturn => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showButtonBall, setShowButtonBall] = useState(false);

  const { login } = useAuth();
  const { addToast } = useToast();

  const clearForm = useCallback(() => {
    setUsername('');
    setPassword('');
    setError('');
    setSuccess('');
    setLoading(false);
    setShowButtonBall(false);
  }, []);

  const handleLogin = useCallback(async (e: React.FormEvent) => { 
    e.preventDefault();
    
    // Validate inputs
    if (!username.trim() || !password.trim()) {
      addToast({
        type: 'warning',
        message: 'Please enter both username and password',
        duration: 4000
      });
      return;
    }
    
    setError("");
    setSuccess("");
    setLoading(true);
    setShowButtonBall(true);
    
    // Clean JSON-based login request
    const loginData = {
      username: username.trim(),
      password: password.trim(),
      grant_type: "password"
    };
    
    try {
      const res = await fetch(API("/api/v1/users/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      
      logger.debug('Login response received', { userId: data.user_id });
      
      if (!res.ok) {
        // Increment failed attempts and implement progressive delay
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        let errorMessage = 'Login failed';
        let delaySeconds = 0;
        
        if (res.status === 401) {
          errorMessage = 'Invalid username or password';
          // Progressive delays: 2s, 5s, 10s, 15s, then 30s
          if (newFailedAttempts >= 2) {
            delaySeconds = Math.min(30, Math.pow(2, newFailedAttempts - 1) + (newFailedAttempts > 3 ? 10 : 0));
          }
        } else if (res.status === 429) {
          errorMessage = 'Too many login attempts. Please try again later.';
          delaySeconds = 60;
        } else if (data.detail) {
          errorMessage = data.detail;
        }
        
        // Set delay if needed
        if (delaySeconds > 0) {
          setLoginDelay(delaySeconds);
          errorMessage += ` Please wait ${delaySeconds} seconds before trying again.`;
          
          // Countdown timer
          const timer = setInterval(() => {
            setLoginDelay(prev => {
              if (prev <= 1) {
                clearInterval(timer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        
        // Enhanced error messaging based on attempt count
        if (newFailedAttempts >= 3) {
          addToast({
            type: 'error',
            message: `${errorMessage} (Attempt ${newFailedAttempts})`,
            duration: 8000
          });
        } else {
          addToast({
            type: 'error',
            message: errorMessage,
            duration: 6000
          });
        }
        
        setError(errorMessage);
        setShowButtonBall(false);
        return;
      }
      
      // Success - reset failed attempts
      setFailedAttempts(0);
      setLoginDelay(0);
      
      // Success
      const displayName = data.first_name || username;
      setSuccess(`Welcome back, ${displayName}!`);
      
      addToast({
        type: 'success',
        message: `Welcome back, ${displayName}!`,
        duration: 3000
      });
      
      // Store user data using auth context
      login(data.access_token, data.user_id, {
        name: data.first_name
      });
      
      if (data.first_name) {
        localStorage.setItem('first_name', data.first_name);
      }
      
      logger.userAction('User logged in', { userId: data.user_id, name: displayName });
      
      setShowButtonBall(false);
      
      // Smooth redirect with better UX
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      
    } catch (err: unknown) {
      const errorMsg = `Network error: ${getErrorMessage(err) || 'Please check your connection'}`;
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
        duration: 6000
      });
      setShowButtonBall(false);
      logger.error('Login failed', getErrorContext(err));
    } finally {
      setLoading(false);
    }
  }, [username, password, failedAttempts, setFailedAttempts, loginDelay, setLoginDelay, login, addToast]);

  return {
    username,
    password,
    error,
    success,
    loading,
    showButtonBall,
    setUsername,
    setPassword,
    setError,
    setSuccess,
    setLoading,
    handleLogin,
    clearForm
  };
};

