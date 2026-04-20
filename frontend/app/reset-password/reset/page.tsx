"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import "../../styles/login.css";
import "../../styles/login-validation.css";
import "../../styles/reset-password.css";

import { API } from "../../lib/api";
import { useToast } from "../../components/Toast";
import { logger } from '../../lib/logger';
import { getErrorMessage as getUtilErrorMessage, getErrorContext } from '../../lib/error-utils';





// Password strength requirements
const PASSWORD_REQUIREMENTS = [
  { test: (pwd: string) => pwd.length >= 8, text: "At least 8 characters" },
  { test: (pwd: string) => /[a-z]/.test(pwd), text: "One lowercase letter" },
  { test: (pwd: string) => /[A-Z]/.test(pwd), text: "One uppercase letter" },
  { test: (pwd: string) => /[0-9]/.test(pwd), text: "One number" },
  { test: (pwd: string) => /[^a-zA-Z0-9]/.test(pwd), text: "One special character" }
];

// Debounce utility for performance optimization
const debounce = <T extends (...args: any[]) => any>(func: T, delay: number): T => {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};

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

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'fast' | 'good' | 'slow' | 'poor'>('good');
  const [retryQueue, setRetryQueue] = useState<(() => Promise<void>)[]>([]);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    code: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [fieldTouched, setFieldTouched] = useState({
    email: false,
    code: false,
    newPassword: false,
    confirmPassword: false
  });
  
  // Refs for form navigation
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const { addToast } = useToast();

  // Memoized regex for email validation
  const EMAIL_REGEX = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  // Memoized password strength calculation
  const passwordStrength = useMemo(() => {
    if (!newPassword) return 0;
    const metRequirements = PASSWORD_REQUIREMENTS.filter(req => req.test(newPassword));
    return Math.round((metRequirements.length / PASSWORD_REQUIREMENTS.length) * 100);
  }, [newPassword]);

  // Memoized validation states
  const emailValid = useMemo(() => EMAIL_REGEX.test(email), [email, EMAIL_REGEX]);
  const passwordsMatch = useMemo(() => 
    newPassword === confirmPassword && newPassword.length > 0, 
    [newPassword, confirmPassword]
  );

  const handleReset = useCallback(async (e: React.FormEvent) => { 
    e.preventDefault();

    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await fetchWithRetry(API('/api/v1/auth/reset-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch((parseError) => {
          logger.debug('Failed to parse password reset error response', { status: response.status });
          return {};
        });
        throw new Error(errorData.detail || 'Failed to reset password');
      }

      setSuccess('Password reset successfully!');
      setMessage('Your password has been reset successfully. You can now log in with your new password.');
      
      addToast({
        type: 'success',
        message: 'Password reset successfully! Redirecting to login...',
        duration: 3000
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);

    } catch (err: unknown) {
      logger.error('Reset password error:', getErrorContext(err));
      const errorMessage = getUtilErrorMessage(err);
      setError(errorMessage || 'Failed to reset password. Please try again.');
      
      addToast({
        type: 'error',
        message: errorMessage || 'Failed to reset password',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [email, code, newPassword, addToast]);

  useEffect(() => {
    // Set mounted to prevent hydration mismatch
    setMounted(true);
    
    // Get email and code from URL parameters if available
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const codeParam = urlParams.get('code');
    if (emailParam) setEmail(emailParam);
    if (codeParam) setCode(codeParam);
    
    // Auto-focus on first empty field
    setTimeout(() => {
      if (!emailParam && emailRef.current) {
        emailRef.current.focus();
      } else if (!codeParam && codeRef.current) {
        codeRef.current.focus();
      } else if (passwordRef.current) {
        passwordRef.current.focus();
      }
    }, 100);

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
      addToast({
        type: 'warning',
        message: 'Connection lost. Requests will be retried automatically.',
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial connection check
    setIsOnline(navigator.onLine);
    setConnectionQuality(getConnectionQuality());

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter': 
            e.preventDefault();
            if (!loading && Object.values(fieldErrors).every(error => error === '') && 
                email.trim() && code.trim() && newPassword && confirmPassword) {
              handleReset(new Event('submit') as unknown as React.FormEvent);
            }
            break;
          case 'Escape': 
            e.preventDefault();
            setError('');
            setSuccess('');
            setFieldErrors({ email: '', code: '', newPassword: '', confirmPassword: '' });
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [retryQueue, loading, fieldErrors, email, code, newPassword, confirmPassword, addToast, handleReset]);

  // Memoized validation function
  const validateField = useCallback((fieldName: string, value: string, confirmValue?: string): string => {
    switch (fieldName) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!EMAIL_REGEX.test(value)) return 'Please enter a valid email address';
        return '';
      case 'code':
        if (!value.trim()) return 'Reset code is required';
        if (value.length < 4) return 'Reset code is too short';
        return '';
      case 'newPassword':
        if (!value) return 'New password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        const unmetRequirements = PASSWORD_REQUIREMENTS.filter(req => !req.test(value));
        if (unmetRequirements.length > 0) return 'Password does not meet requirements';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== confirmValue) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  }, [EMAIL_REGEX]);

  // Optimized field change handlers
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value);
  }, []);

  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    // Also validate confirm password if it exists
    if (confirmPassword) {
      const confirmError = validateField('confirmPassword', confirmPassword, value);
      setFieldErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
  }, [confirmPassword, validateField]);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  }, []);

  // Real-time field validation
  const handleFieldChange = (fieldName: string, value: string) => {
    switch (fieldName) {
      case 'email':
        setEmail(value);
        break;
      case 'code':
        setCode(value);
        break;
      case 'newPassword':
        setNewPassword(value);
        // Also validate confirm password if it exists
        if (confirmPassword) {
          const confirmError = validateField('confirmPassword', confirmPassword, value);
          setFieldErrors(prev => ({ ...prev, confirmPassword: confirmError }));
        }
        break;
      case 'confirmPassword':
        setConfirmPassword(value);
        break;
    }
    
    // Clear error when user starts typing
    if (fieldErrors[fieldName as keyof typeof fieldErrors] && value.trim()) {
      setFieldErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
    
    // Validate on blur or when field has been touched
    if (fieldTouched[fieldName as keyof typeof fieldTouched]) {
      const error = validateField(fieldName, value, fieldName === 'confirmPassword' ? newPassword : undefined);
      setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  };

  const handleFieldBlur = useCallback((fieldName: string, value: string) => {
    setFieldTouched(prev => ({ ...prev, [fieldName]: true }));
    const error = validateField(fieldName, value, fieldName === 'confirmPassword' ? newPassword : undefined);
    setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
  }, [validateField, newPassword]);

  const getStrengthText = useMemo(() => {
    if (passwordStrength < 25) return "Weak";
    if (passwordStrength < 50) return "Fair";
    if (passwordStrength < 75) return "Good";
    return "Strong";
  }, [passwordStrength]);

  const getStrengthClass = useMemo(() => {
    if (passwordStrength < 25) return "strength-weak";
    if (passwordStrength < 50) return "strength-fair";
    if (passwordStrength < 75) return "strength-good";
    return "strength-strong";
  }, [passwordStrength]);

  const getErrorMessage = useCallback((statusCode: number, detail: string) => {
    switch (statusCode) {
      case 400:
        if (detail.includes('expired')) return "Your reset code has expired. Please request a new one.";
        if (detail.includes('invalid')) return "Invalid reset code. Please check and try again.";
        if (detail.includes('password')) return "Password requirements not met. Please choose a stronger password.";
        return "Invalid request. Please check your information and try again.";
      case 404:
        return "Account not found. Please verify your email address.";
      case 429:
        return "Too many attempts. Please wait a few minutes before trying again.";
      case 500:
        return "Server error. Our team has been notified. Please try again later.";
      default:
        return detail || "Something went wrong. Please try again.";
    }
  }, []);


  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <h1 className="reset-password-title">New Password</h1>
        
        <p className="reset-password-subtitle">
          Create a new secure password for your account.
        </p>

        <form onSubmit={handleReset}>
          <div className="form-field">
            <div className="input-wrapper">
              <input
                ref={emailRef}
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={handleEmailChange}
                onKeyDown={(changeEvent) => {
                  if (changeEvent.key === 'Enter' && emailValid) { 
                    changeEvent.preventDefault();
                    codeRef.current?.focus();
                  }
                }}
                className={`form-input form-input--with-validation ${email ? (emailValid ? 'input-valid' : 'input-invalid') : ''}`}
                required
              />
              {email && (
                <div className={`validation-icon ${emailValid ? 'valid' : 'invalid'}`}>
                  {emailValid ? 'OK' : 'X'}
                </div>
              )}
            </div>
            <input
              ref={codeRef}
              type="text"
              placeholder="Reset Code"
              value={code}
              onChange={handleCodeChange}
              onKeyDown={(changeEvent) => {
                if (changeEvent.key === 'Enter' && code.trim()) { 
                  changeEvent.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
              className="form-input auth-code-input"
              required
            />
            <div className="pw-field-wrapper">
              <input
                ref={passwordRef}
                type={mounted && showNewPassword ? "text" : "password"}
                placeholder="New Password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                onKeyDown={(changeEvent) => {
                  if (changeEvent.key === 'Enter' && passwordStrength >= 50) { 
                    changeEvent.preventDefault();
                    confirmPasswordRef.current?.focus();
                  }
                }}
                className={`form-input pw-input ${newPassword ? (passwordStrength > 50 ? 'input-valid' : passwordStrength > 25 ? '' : 'input-invalid') : ''}`}
                required
              />
              {mounted && (
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="pw-toggle-btn"
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              )}
              {newPassword && (
                <div className={`validation-icon ${passwordStrength > 50 ? 'valid' : passwordStrength > 25 ? '' : 'invalid'}`}>
                  {passwordStrength > 50 ? 'OK' : passwordStrength > 25 ? '!' : 'X'}
                </div>
              )}
            </div>

            {newPassword && (
              <div className="strength-wrapper">
                <div className="strength-header">
                  <span className="strength-label">Password Strength</span>
                  <span className={`strength-value ${getStrengthClass}`}>{getStrengthText}</span>
                </div>
                <div className="password-strength-meter">
                  <div className={`password-strength-bar ${getStrengthClass}`}></div>
                </div>
              </div>
            )}

            <div className="pw-field-wrapper" style={{ marginBottom: '16px' }}>
              <input
                ref={confirmPasswordRef}
                type={mounted && showConfirmPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                onKeyDown={(changeEvent) => {
                  if (changeEvent.key === 'Enter' && passwordsMatch && emailValid && code.trim() && passwordStrength >= 50) { 
                    changeEvent.preventDefault();
                    (document.querySelector('button[type="submit"]') as HTMLButtonElement)?.click();
                  }
                }}
                className={`form-input pw-input ${confirmPassword ? (passwordsMatch ? 'input-valid' : 'input-invalid') : ''}`}
                required
              />
              {mounted && (
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="pw-toggle-btn"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              )}
              {confirmPassword && (
                <div className={`validation-icon ${passwordsMatch ? 'valid' : 'invalid'}`}>
                  {passwordsMatch ? 'OK' : 'X'}
                </div>
              )}
            </div>
          </div>

          {error && <div className="auth-alert-error">{error}</div>}

          {message && <div className="auth-alert-success">{message}</div>}

          <button 
            type="submit" 
            disabled={loading || !emailValid || !code.trim() || passwordStrength < 50 || !passwordsMatch}
            className={`auth-submit-btn ${message ? 'is-success' : loading ? 'is-loading' : ''}`}
          >
            {message 
              ? 'Password Reset Complete' 
              : loading 
                ? (
                  <span className="auth-submit-content">
                    <div className="spinner spinner-sm"></div>
                    Resetting Password...
                  </span>
                ) 
                : 'Reset Password'
            }
          </button>
        </form>

        <div className="auth-back-wrapper">
          <a href="/login" className="auth-back-link">Back to Login</a>
        </div>
      </div>
    </div>
  );
}


