'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../lib/api';
import { logger } from '../lib/logger';
import { isError, getErrorMessage } from '../lib/error-utils';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

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
  let lastError: unknown;
  
  for (let index = 0; index <= maxRetries; index++) {
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
      
      if (index === maxRetries) break;
      
      const delay = Math.min(1000 * Math.pow(2, index), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Request failed after retries');
};

export default function ResetPasswordModal({ isOpen, onClose, onSuccess }: ResetPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'fast' | 'good' | 'slow' | 'poor'>('good');
  const [retryQueue, setRetryQueue] = useState<(() => Promise<void>)[]>([]);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '' });
  const [fieldTouched, setFieldTouched] = useState({ email: false });
  
  const emailRef = useRef<HTMLInputElement>(null);

  // Validation function
  const validateField = useCallback((fieldName: string, value: string): string => {
    if (fieldName === 'email') {
      if (!value.trim()) return 'Email is required';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Please enter a valid email address';
    }
    return '';
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check connection status
    if (!isOnline) {
      setError('No internet connection. Please check your network and try again.');
      return;
    }

    // Validate email
    setIsValidating(true);
    const emailError = validateField('email', email);
    
    setFieldErrors({ email: emailError });
    setFieldTouched({ email: true });
    
    if (emailError) {
      setIsValidating(false);
      setTimeout(() => emailRef.current?.focus(), 100);
      return;
    }

    setLoading(true);
    setIsValidating(false);

    try {
      const res = await fetchWithRetry(API('/api/v1/users/request-password-reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          setFieldErrors({ email: 'Email not found' });
        } else if (res.status === 429) {
          errorMessage = 'Too many requests. Please try again later.';
        } else if (data.detail) {
          errorMessage = data.detail;
        }
        
        setError(errorMessage);
        setTimeout(() => emailRef.current?.focus(), 100);
        return;
      }

      // Success!
      logger.info('Password reset requested', { email });
      onSuccess?.();
      onClose();
      
      // Reset form
      setEmail('');
      setFieldErrors({ email: '' });
      setFieldTouched({ email: false });
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
      
      if (shouldRetry && !isOnline) {
        const retryRequest = async () => {
          try {
            await handleSubmit(new Event('submit') as unknown as React.FormEvent);
          } catch (retryError) {
            logger.debug('Retry failed:', retryError);
          }
        };
        setRetryQueue(prev => [...prev, retryRequest]);
      }
      
      logger.error('Password reset error', { error: errorMsg });
    } finally {
      setLoading(false);
    }
  }, [isOnline, email, validateField, connectionQuality, onSuccess, onClose]);

  useEffect(() => {
    if (isOpen && emailRef.current) {
      setTimeout(() => emailRef.current?.focus(), 100);
    }

    // Connection monitoring
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionQuality(getConnectionQuality());
      
      // Process retry queue
      if (retryQueue.length > 0) {
        retryQueue.forEach(retryFn => retryFn());
        setRetryQueue([]);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowConnectionStatus(true);
    };

    const measureConnectionQuality = async () => {
      if (!navigator.onLine) {
        setConnectionQuality('poor');
        setShowConnectionStatus(true);
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

    if (isOpen) {
      setIsOnline(navigator.onLine);
      measureConnectionQuality();

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      const qualityInterval = setInterval(measureConnectionQuality, 30000);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(qualityInterval);
      };
    }
  }, [isOpen, retryQueue]);

  // Real-time field validation
  const handleFieldChange = (value: string) => {
    setEmail(value);
    
    // Clear error when user starts typing
    if (fieldErrors.email && value.trim()) {
      setFieldErrors({ email: '' });
    }
    
    // Validate if field has been touched
    if (fieldTouched.email) {
      const error = validateField('email', value);
      setFieldErrors({ email: error });
    }
  };

  const handleFieldBlur = (value: string) => {
    setFieldTouched({ email: true });
    const error = validateField('email', value);
    setFieldErrors({ email: error });
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setFieldErrors({ email: '' });
    setFieldTouched({ email: false });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={handleClose}
    >
      {/* Connection Status Indicator */}
      {showConnectionStatus && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: !isOnline ? '#fef2f2' : connectionQuality === 'poor' ? '#fff7ed' : '#fffbeb',
          border: `1px solid ${!isOnline ? '#fecaca' : connectionQuality === 'poor' ? '#fed7aa' : '#fde68a'}`,
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          zIndex: 10000
        }}>
          <span style={{ fontSize: '18px' }}>
            {!isOnline ? '⚠️' : connectionQuality === 'slow' ? '🐌' : '⚡'}
          </span>
          <span style={{
            fontSize: '14px',
            fontWeight: 500,
            color: !isOnline ? '#dc2626' : connectionQuality === 'poor' ? '#ea580c' : '#d97706'
          }}>
            {!isOnline ? 'No internet connection' : 
             connectionQuality === 'slow' ? 'Slow connection detected' : 
             'Poor connection quality'}
          </span>
          {!isOnline && retryQueue.length > 0 && (
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              Will retry when connected
            </span>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowConnectionStatus(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>
      )}

      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '450px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#1f2937'
          }}>Reset Password</h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: '14px',
            color: '#6b7280'
          }}>Enter your email to receive a reset code</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Error Message */}
          {error && (
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Email Input */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '6px'
            }}>
              Email Address *
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => handleFieldChange(e.target.value)}
              onBlur={(e) => handleFieldBlur(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '15px',
                border: `2px solid ${
                  fieldErrors.email ? '#ef4444' : 
                  fieldTouched.email && !fieldErrors.email && email.trim() ? '#22c55e' :
                  '#e5e7eb'
                }`,
                borderRadius: '10px',
                outline: 'none',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.6 : 1
              }}
              onFocus={(e) => {
                if (!fieldErrors.email) {
                  e.currentTarget.style.borderColor = '#6366f1';
                }
              }}
              onBlurCapture={(e) => {
                if (!fieldErrors.email && (!fieldTouched.email || !email.trim())) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            />
            {fieldErrors.email && (
              <div style={{
                marginTop: '6px',
                fontSize: '13px',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>⚠️</span>
                {fieldErrors.email}
              </div>
            )}
            {!fieldErrors.email && fieldTouched.email && email.trim() && (
              <div style={{
                marginTop: '6px',
                fontSize: '13px',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>✓</span>
                Valid email format
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#6b7280',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!fieldErrors.email || !email.trim() || isValidating}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#ffffff',
                background: (loading || !!fieldErrors.email || !email.trim() || isValidating) 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #f0a500 0%, #e09800 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: (loading || !!fieldErrors.email || !email.trim() || isValidating) 
                  ? 'not-allowed' 
                  : 'pointer',
                boxShadow: '0 4px 12px rgba(240, 165, 0, 0.25)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading && !fieldErrors.email && email.trim() && !isValidating) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(240, 165, 0, 0.35)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(240, 165, 0, 0.25)';
                }
              }}
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </div>
        </form>

        {/* Keyboard Shortcuts */}
        <div style={{
          padding: '0 24px 24px',
          borderTop: '1px solid #f3f4f6'
        }}>
          <details style={{ marginTop: '16px' }}>
            <summary style={{
              fontSize: '13px',
              color: '#6b7280',
              cursor: 'pointer',
              userSelect: 'none',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⌨️</span>
              Keyboard Shortcuts
            </summary>
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#4b5563'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span><kbd style={{ 
                  padding: '2px 6px', 
                  background: '#e5e7eb', 
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>Ctrl</kbd> + <kbd style={{ 
                  padding: '2px 6px', 
                  background: '#e5e7eb', 
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>Enter</kbd></span>
                <span>Submit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><kbd style={{ 
                  padding: '2px 6px', 
                  background: '#e5e7eb', 
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>Esc</kbd></span>
                <span>Close</span>
              </div>
            </div>
          </details>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
