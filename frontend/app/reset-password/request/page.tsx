"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import Image from "next/image";

import "../../styles/login.css";
import "../../styles/login-validation.css";

import { API } from "../../lib/api";
import { useToast } from "../../components/Toast";
import { logger } from '../lib/logger';






// Connection monitoring utilities
const getConnectionQuality = () => {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      if (conn.effectiveType === '4g' && conn.downlink > 5) return 'fast';
      if (conn.effectiveType === '3g' || conn.downlink < 1) return 'slow';
      if (conn.effectiveType === '2g' || conn.downlink < 0.5) return 'poor';
    }
  }
  return 'good';
};

const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error: unknown) {
      lastError = error;
      
      if (i === maxRetries) break;
      
      const delay = Math.min(1000 * Math.pow(2, i), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

export default function RequestResetPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'fast' | 'good' | 'slow' | 'poor'>('good');
  const [retryQueue, setRetryQueue] = useState<(() => Promise<void>)[]>([]);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: ""
  });
  const [fieldTouched, setFieldTouched] = useState({
    email: false
  });
  
  const emailRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  // Validation function
  const validateField = useCallback((fieldName: string, value: string): string => {
    switch (fieldName) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return '';
      default:
        return '';
    }
  }, []);
  
  const handleRequest = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous messages
    setError("");
    setSuccess("");
    
    // Check connection status before attempting request
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

    // Validate email field
    setIsValidating(true);
    const emailError = validateField('email', email);
    
    setFieldErrors({
      email: emailError
    });
    
    setFieldTouched({
      email: true
    });
    
    if (emailError) {
      setIsValidating(false);
      addToast({
        type: 'warning',
        message: 'Please enter a valid email address',
        duration: 4000
      });
      
      setTimeout(() => {
        emailRef.current?.focus();
      }, 100);
      return;
    }
    
    setLoading(true);
    setIsValidating(false);
    
    try {
      const res = await fetchWithRetry(API("/api/v1/users/request-password-reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      
      if (!res.ok) {
        let errorMessage = 'Failed to send reset code';
        
        if (res.status === 404) {
          errorMessage = 'Email address not found';
          setFieldErrors(prev => ({ ...prev, email: 'Email not found' }));
        } else if (res.status === 429) {
          errorMessage = 'Too many requests. Please try again later.';
        } else if (data.detail) {
          errorMessage = data.detail;
        }
        
        setError(errorMessage);
        addToast({
          type: 'error',
          message: errorMessage,
          duration: 6000
        });
        
        setTimeout(() => {
          emailRef.current?.focus();
        }, 100);
        
        return;
      }
      
      // Success
      const successMessage = "Reset code sent to your email. Check your inbox and proceed to verify the code.";
      setSuccess(successMessage);
      addToast({
        type: 'success',
        message: "?? Reset code sent! Check your email inbox.",
        duration: 5000
      });
      
    } catch (err: unknown) {
      const isNetworkError = err?.name === 'TypeError' || err?.message?.includes('Failed to fetch');
      const isTimeoutError = err?.name === 'AbortError' || err?.message?.includes('timeout');
      const isConnectionError = err?.message?.includes('No internet connection');
      
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
        errorMsg = `Network error: ${err?.message || 'Please check your connection'}`;
      }
      
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
        duration: shouldRetry ? 8000 : 6000
      });
      
      if (shouldRetry && !isOnline) {
        const retryRequest = async () => {
          try {
            await handleRequest(new Event('submit') as React.FormEvent));
          } catch (retryError) {
            logger.debug('Retry failed:', retryError);
          }
        };
        setRetryQueue(prev => [...prev, retryRequest]);
        
        addToast({
          type: 'info',
          message: 'Request will be retried automatically when connection is restored.',
          duration: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, email, validateField, addToast, connectionQuality]);

  useEffect(() => {
    // Auto-focus email field
    if (emailRef.current) {
      emailRef.current.focus();
    }

    // Connection monitoring
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionQuality(getConnectionQuality());
      
      // Process retry queue
      if (retryQueue.length > 0) {
        addToast({
          type: 'info',
          message: 'Connection restored. Processing pending requests...',
          duration: 3000
        });
        
        retryQueue.forEach(retryFn => retryFn());
        setRetryQueue([]);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowConnectionStatus(true);
      addToast({
        type: 'warning',
        message: 'Connection lost. Requests will be retried automatically.',
        duration: 5000
      });
    };

    const measureConnectionQuality = async () => {
      if (!navigator.onLine) {
        setConnectionQuality('poor');
        setShowConnectionStatus(true);
        return;
      }

      const startTime = Date.now();
      try {
        // Ping a small endpoint to measure response time
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

    // Initial checks
    setIsOnline(navigator.onLine);
    measureConnectionQuality();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Periodic connection quality checks
    const qualityInterval = setInterval(measureConnectionQuality, 30000);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            if (!loading && fieldErrors.email === '' && email.trim()) {
              handleRequest(new Event('submit') as React.FormEvent));
            }
            break;
          case 'Escape':
            e.preventDefault();
            setError('');
            setSuccess('');
            setFieldErrors({ email: '' });
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(qualityInterval);
    };
  }, [retryQueue, loading, fieldErrors.email, email, addToast, handleRequest]);

  // Real-time field validation
  const handleFieldChange = (fieldName: string, value: string) => {
    if (fieldName === 'email') {
      setEmail(value);
    }
    
    // Clear error when user starts typing
    if (fieldErrors[fieldName as keyof typeof fieldErrors] && value.trim()) {
      setFieldErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
    
    // Validate on blur or when field has been touched
    if (fieldTouched[fieldName as keyof typeof fieldTouched]) {
      const error = validateField(fieldName, value);
      setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  };

  const handleFieldBlur = (fieldName: string, value: string) => {
    setFieldTouched(prev => ({ ...prev, [fieldName]: true }));
    const error = validateField(fieldName, value);
    setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
  };

  return (
    <div className="login-page-container">
      {/* Connection Status Indicator */}
      {showConnectionStatus && (
        <div className={`connection-status ${isOnline ? connectionQuality : 'offline'}`} role="alert" aria-live="polite">
          <div className="connection-content">
            <span className="connection-icon">
              {!isOnline ? '??' : connectionQuality === 'slow' ? '??' : '??'}
            </span>
            <span className="connection-text">
              {!isOnline ? 'No internet connection' : 
               connectionQuality === 'slow' ? 'Slow connection detected' : 
               'Poor connection quality'}
            </span>
            {!isOnline && retryQueue.length > 0 && (
              <span className="retry-info">Will retry when connected</span>
            )}
          </div>
          <button 
            className="connection-close"
            onClick={() => setShowConnectionStatus(false)}
            aria-label="Dismiss connection status"
          >
            ×
          </button>
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
            background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 25%, #4a5568 50%, #f0a500 75%, #ff9800 100%)',
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
          }}>Reset Password</h2>
          <div className="login-subtitle">Enter your email address and we&apos;ll send you a reset code.</div>
        </div>

        <form onSubmit={handleRequest} className="login-form">
          <div className="input-container">
            <label htmlFor="reset-email" className="input-label">
              Email Address
            </label>
            <input
              ref={emailRef}
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={(e) => handleFieldBlur('email', e.target.value)}
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
            disabled={loading || !!fieldErrors.email || !email.trim() || isValidating}
          >
            {loading ? 'Sending reset code...' : 'Send Reset Code'}
          </button>
        </form>

        <div className="links-container">
          <a href="/login" className="signup-link">
            Back to Login
          </a>
          <a href="/reset-password/verify" className="forgot-link">
            Have a Code?
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