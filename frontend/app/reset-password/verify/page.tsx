"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

import Image from "next/image";

import "../../styles/login.css";
import "../../styles/login-validation.css";
import "../../styles/bowling-animations.css";

import { API } from "../../lib/api";
import { useToast } from "../../components/Toast";
import { logger } from '../../lib/logger';
import { getErrorMessage, getErrorContext, isError } from '../../lib/error-utils';






export default function VerifyResetPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Enhanced validation and accessibility states
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [isValidating, setIsValidating] = useState(false);
  const [fieldTouched, setFieldTouched] = useState<{[key: string]: boolean}>({});
  
  // Connection status states
  const [isOnline, setIsOnline] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'slow' | 'poor'>('good');
  const [retryQueue, setRetryQueue] = useState<Array<() => Promise<void>>>([]);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  
  // Refs for form fields
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  
  const { addToast } = useToast();

  useEffect(() => {
    // Set mounted immediately to prevent hydration issues
    setMounted(true);
  }, []);

  // Process retry queue when connection is restored
  const processRetryQueue = useCallback(async () => {
    if (retryQueue.length > 0 && isOnline) {
      const retries = [...retryQueue];
      setRetryQueue([]);
      
      for (const retryFn of retries) {
        try {
          await retryFn();
          break;
        } catch (error) {
          // Continue to next retry
        }
      }
    }
  }, [retryQueue, isOnline]);

  // Connection status monitoring
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      setShowConnectionStatus(!online || connectionQuality === 'poor');
      
      if (online) {
        processRetryQueue();
      }
    };

    const measureConnectionQuality = async () => {
      if (!navigator.onLine) {
        setConnectionQuality('poor');
        return;
      }

      const startTime = Date.now();
      try {
        await fetch(API('/api/health'), { 
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        const responseTime = Date.now() - startTime;
        
        if (responseTime < 500) {
          setConnectionQuality('good');
        } else if (responseTime < 2000) {
          setConnectionQuality('slow');
        } else {
          setConnectionQuality('poor');
        }
        
        setShowConnectionStatus(responseTime > 1000);
      } catch (error) {
        setConnectionQuality('poor');
        setShowConnectionStatus(true);
      }
    };

    updateOnlineStatus();
    measureConnectionQuality();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const qualityInterval = setInterval(measureConnectionQuality, 30000);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(qualityInterval);
    };
  }, [connectionQuality, processRetryQueue]);

  // Enhanced fetch with retry logic
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!navigator.onLine) {
          throw new Error('No internet connection');
        }

        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(connectionQuality === 'slow' ? 15000 : 10000)
        });
        
        return response;
      } catch (error: unknown) {
        const isLastAttempt = attempt === maxRetries;
        const isNetworkError = isError(error) && (error.name === 'TypeError' || error.message.includes('Failed to fetch'));
        const isTimeoutError = isError(error) && (error.name === 'AbortError' || error.message.includes('timeout'));
        
        if (isLastAttempt) {
          throw error;
        }
        
        if (isNetworkError || isTimeoutError) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  };

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'e') { 
        e.preventDefault();
        document.getElementById('reset-email')?.focus();
      }
      if (e.altKey && e.key.toLowerCase() === 'c') { 
        e.preventDefault();
        document.getElementById('reset-code')?.focus();
      }
      if (e.key === 'Escape' && (error || Object.keys(fieldErrors).some(key => fieldErrors[key]))) { 
        e.preventDefault();
        setError('');
        setFieldErrors({});
        document.getElementById('reset-email')?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [error, fieldErrors]);

  // Real-time field validation
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Invalid email format';
        return '';
      case 'code':
        if (!value.trim()) return 'Reset code is required';
        if (value.trim().length < 4) return 'Reset code is too short';
        if (value.trim().length > 10) return 'Reset code is too long';
        return '';
      default:
        return '';
    }
  };

  // Handle field changes with validation
  const handleFieldChange = (field: string, value: string) => {
    if (field === 'email') setEmail(value);
    if (field === 'code') setCode(value);
    
    setFieldTouched(prev => ({ ...prev, [field]: true }));
    
    if (fieldTouched[field] || value.length > 0) {
      const error = validateField(field, value);
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  // Handle field blur for validation
  const handleFieldBlur = (field: string, value: string) => {
    setFieldTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, value);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  // Check if form is valid
  const isFormValid = () => {
    const emailError = validateField('email', email);
    const codeError = validateField('code', code);
    return !emailError && !codeError && email.trim() && code.trim();
  };

  const handleVerify = async (e: React.FormEvent) => { 
    e.preventDefault();

    // Clear previous errors
    setError("");
    setSuccess("");
    
    // Check connection status before attempting verification
    if (!isOnline) {
      const errorMsg = 'No internet connection. Please check your network and try again.';
      setError(errorMsg);
      addToast({
        type: 'warning',
        message: errorMsg,
        duration: 6000
      });
      return;
    }

    // Validate all fields
    setIsValidating(true);
    const emailError = validateField('email', email);
    const codeError = validateField('code', code);
    
    setFieldErrors({
      email: emailError,
      code: codeError
    });
    
    setFieldTouched({
      email: true,
      code: true
    });
    
    if (emailError || codeError) {
      setIsValidating(false);
      addToast({
        type: 'warning',
        message: 'Please fix the errors above before continuing',
        duration: 4000
      });
      
      const firstErrorField = emailError ? 'reset-email' : 'reset-code';
      setTimeout(() => {
        document.getElementById(firstErrorField)?.focus();
      }, 100);
      return;
    }
    
    setLoading(true);
    setIsValidating(false);
    
    try {
      const res = await fetchWithRetry(API("/api/v1/users/verify-reset-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      
      if (!res.ok) {
        let errorMessage = 'Verification failed';
        
        if (res.status === 400) {
          errorMessage = 'Invalid reset code';
          setFieldErrors(prev => ({ ...prev, code: 'Invalid code' }));
        } else if (res.status === 404) {
          errorMessage = 'Email not found or code expired';
          setFieldErrors(prev => ({ ...prev, email: 'Email not found' }));
        } else if (res.status === 429) {
          errorMessage = 'Too many attempts. Please try again later.';
        } else if (data.detail) {
          if (data.detail.toLowerCase().includes('code')) {
            errorMessage = 'Invalid or expired reset code';
            setFieldErrors(prev => ({ ...prev, code: 'Invalid or expired code' }));
          } else if (data.detail.toLowerCase().includes('email')) {
            errorMessage = 'Email not found';
            setFieldErrors(prev => ({ ...prev, email: 'Email not found' }));
          } else {
            errorMessage = data.detail;
          }
        }
        
        setError(errorMessage);
        addToast({
          type: 'error',
          message: errorMessage,
          duration: 6000
        });
        
        setTimeout(() => {
          document.getElementById('reset-email')?.focus();
        }, 100);
        
        return;
      }
      
      // Success
      const successMessage = "Code verified successfully! Redirecting to password reset...";
      setSuccess(successMessage);
      addToast({
        type: 'success',
        message: successMessage,
        duration: 3000
      });
      
      // Redirect to reset page after successful verification
      setTimeout(() => {
        window.location.href = `/reset-password/reset?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
      }, 2000);
      
    } catch (err: unknown) {
      const isNetworkError = isError(err) && (err.name === 'TypeError' || err.message.includes('Failed to fetch'));
      const isTimeoutError = isError(err) && (err.name === 'AbortError' || err.message.includes('timeout'));
      const isConnectionError = isError(err) && err.message.includes('No internet connection');
      
      let errorMsg: string;
      let shouldRetry = false;
      
      if (isConnectionError) {
        errorMsg = 'No internet connection detected. Please check your network.';
        shouldRetry = true;
      } else if (isNetworkError) {
        errorMsg = `Connection failed${connectionQuality === 'poor' ? ' (poor connection detected)' : ''}. Please try again.`;
        shouldRetry = true;
      } else if (isTimeoutError) {
        errorMsg = `Request timed out${connectionQuality === 'slow' ? ' (slow connection detected)' : ''}. Please try again.`;
        shouldRetry = true;
      } else {
        errorMsg = `Network error: ${getErrorMessage(err) || 'Please check your connection'}`;
      }
      
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
        duration: shouldRetry ? 8000 : 6000
      });
      
      if (shouldRetry && !isOnline) {
        const retryVerify = async () => {
          try {
            await handleVerify(new Event('submit') as unknown as React.FormEvent);
          } catch (retryError) {
            logger.debug('Retry failed:', retryError);
          }
        };
        setRetryQueue(prev => [...prev, retryVerify]);
        
        addToast({
          type: 'info',
          message: 'Verification will be retried automatically when connection is restored.',
          duration: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Connection Status Bar */}
      {!isOnline && (
        <div className="connection-status offline">
          <span className="connection-icon">??</span>
          <span>No internet connection - requests will be retried automatically</span>
        </div>
      )}
      
      {isOnline && showConnectionStatus && connectionQuality !== 'good' && (
        <div className={`connection-status ${connectionQuality}`}>
          <span className="connection-icon">
            {connectionQuality === 'slow' ? '??' : '??'}
          </span>
          <span>
            {connectionQuality === 'slow' && 'Slow connection detected'}
            {connectionQuality === 'poor' && 'Poor connection detected'}
          </span>
        </div>
      )}

      <div className="enhanced-card">
        <div className="header-section">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <Image 
              src="/logo.png" 
              alt="BracketWorks Logo" 
              width={72}
              height={72}
              style={{
                borderRadius: '16px',
                marginBottom: '16px'
              }}
            />
          </div>
          <h1 className="login-title" style={{
            fontSize: '28px',
            fontWeight: 700,
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 25%, #4a5568 50%, #F47C20 75%, #D9651A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px',
            lineHeight: '1.2',
            textAlign: 'center'
          }}>BracketWorks</h1>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 600,
            margin: '16px 0 8px 0',
            color: '#1a1f2e',
            textAlign: 'center'
          }}>Verify Reset Code</h2>
          <div className="login-subtitle">Enter your email address and the reset code we sent you.</div>
        </div>

        <form onSubmit={handleVerify} className="login-form">
          <div className="input-container">
            <label htmlFor="reset-email" className="input-label">
              Email Address
            </label>
            <input
              ref={emailRef}
              id="reset-email"
              type="email"
              value={email}
              onChange={(changeEvent) => handleFieldChange('email', changeEvent.target.value)}
              onBlur={(changeEvent) => handleFieldBlur('email', changeEvent.target.value)}
              className={`login-input ${fieldErrors.email ? 'error' : ''} ${
                fieldTouched.email && !fieldErrors.email && email.trim() ? 'success' : ''
              }`}
              placeholder="Enter your email address"
              autoComplete="email"
              required
              disabled={loading}
              aria-describedby={fieldErrors.email ? 'email-error' : 'email-help'}
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email && (
              <div id="email-error" className="field-error" role="alert">
                {fieldErrors.email}
              </div>
            )}
            {!fieldErrors.email && fieldTouched.email && email.trim() && (
              <div id="email-help" className="field-success">
                ? Valid email format
              </div>
            )}
          </div>

          <div className="input-container">
            <label htmlFor="reset-code" className="input-label">
              Reset Code
            </label>
            <input
              ref={codeRef}
              id="reset-code"
              type="text"
              value={code}
              onChange={(changeEvent) => handleFieldChange('code', changeEvent.target.value)}
              onBlur={(changeEvent) => handleFieldBlur('code', changeEvent.target.value)}
              className={`login-input ${fieldErrors.code ? 'error' : ''} ${
                fieldTouched.code && !fieldErrors.code && code.trim() ? 'success' : ''
              }`}
              placeholder="Enter your reset code"
              required
              disabled={loading}
              aria-describedby={fieldErrors.code ? 'code-error' : 'code-help'}
              aria-invalid={!!fieldErrors.code}
            />
            {fieldErrors.code && (
              <div id="code-error" className="field-error" role="alert">
                {fieldErrors.code}
              </div>
            )}
            {!fieldErrors.code && fieldTouched.code && code.trim() && (
              <div id="code-help" className="field-success">
                ? Valid reset code format
              </div>
            )}
          </div>

          {error && (
            <div className="error-container" role="alert">
              <span className="error-icon">??</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="success-message" role="alert">
              ? {success}
            </div>
          )}

          <button
            type="submit"
            className={`login-button ${loading ? 'loading' : ''}`}
            disabled={loading || !!fieldErrors.email || !!fieldErrors.code || !email.trim() || !code.trim() || isValidating}
          >
            {loading ? 'Verifying code...' : 'Verify Code'}
          </button>
        </form>

        <div className="links-container">
          <a href="/login" className="signup-link">
            Back to Login
          </a>
          <a href="/reset-password/request" className="forgot-link">
            Request New Code
          </a>
        </div>

        {/* Keyboard shortcuts help */}
        <div className="keyboard-shortcuts" aria-label="Keyboard shortcuts">
          <details className="shortcuts-details">
            <summary className="shortcuts-summary">Keyboard Shortcuts</summary>
            <div className="shortcuts-content">
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd> Submit form
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>Esc</kbd> Clear errors
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

