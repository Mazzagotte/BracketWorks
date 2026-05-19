"use client";

import Link from 'next/link';
import { type FormEvent, useState, useEffect, useRef, useCallback, useMemo } from "react";

import Image from "next/image";

import AuthFeedback from "../../components/AuthFeedback";
import AuthValidatedInputField from "../../components/AuthValidatedInputField";
import { useAuthFormShortcuts } from "../../hooks/useAuthFormShortcuts";
import { useCooldownTimer } from "../../hooks/useCooldownTimer";
import { useFieldValidation } from "../../hooks/useFieldValidation";
import { describeNetworkRequestError, useNetworkRequest } from "../../hooks/useNetworkRequest";
import { PasswordResetRateLimitError, requestPasswordReset } from "../../lib/auth/password-reset";
import { getEmailValidationError } from '../../lib/auth/validation';
import { useToast } from "../../components/Toast";
import CloseControl from "../../../components/CloseControl";
import { logger } from '../../lib/logger';
import { getErrorMessage, getErrorContext } from '../../lib/error-utils';

export default function RequestResetPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const formValues = useMemo(() => ({ email }), [email]);
  const { clearCooldown, cooldownSeconds, startCooldown } = useCooldownTimer();
  
  const emailRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const {
    connectionQuality,
    dismissConnectionStatus,
    enqueueRetry,
    fetchWithRetry,
    isOnline,
    pendingRetryCount,
    showConnectionStatus,
  } = useNetworkRequest();
  const {
    fieldErrors,
    fieldTouched,
    handleFieldBlur,
    handleFieldChange,
    resetValidation,
    setFieldError,
    validateAll,
  } = useFieldValidation(formValues, (fieldName, value) => {
    switch (fieldName) {
      case 'email':
        return getEmailValidationError(value);
      default:
        return '';
    }
  });
  
  const submitRequest = useCallback(async () => {
    // Clear previous messages
    setError("");
    setSuccess("");

    if (cooldownSeconds > 0) {
      const errorMsg = `Please wait ${cooldownSeconds} seconds before sending another code.`;
      setError(errorMsg);
      addToast({
        type: 'warning',
        message: errorMsg,
        duration: 4000,
      });
      return;
    }
    
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
    const nextErrors = validateAll(formValues);
    const emailError = nextErrors.email;
    
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
      const result = await requestPasswordReset(email, fetchWithRetry);
      startCooldown(result.cooldownSeconds);
      setSuccess(result.successMessage);
      addToast({
        type: 'success',
        message: 'If an account exists for this email, a password reset link has been sent.',
        duration: 5000
      });

    } catch (err: unknown) {
      if (err instanceof PasswordResetRateLimitError) {
        startCooldown(err.retryAfterSeconds);
        setError(err.message);
        addToast({
          type: 'error',
          message: err.message,
          duration: 6000,
        });

        setTimeout(() => {
          emailRef.current?.focus();
        }, 100);
        return;
      }

      const networkError = describeNetworkRequestError(err, connectionQuality);
      const errorMsg = networkError.message || `Network error: ${getErrorMessage(err) || 'Please check your connection'}`;
      const shouldRetry = networkError.shouldRetry;
      
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
        duration: shouldRetry ? 8000 : 6000
      });
      
      if (shouldRetry && !isOnline) {
        const retryRequest = async () => {
          try {
            await submitRequest();
          } catch (retryError) {
            logger.debug('Retry failed:', retryError);
          }
        };
        enqueueRetry(retryRequest);
        
        addToast({
          type: 'info',
          message: 'Request will be retried automatically when connection is restored.',
          duration: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  }, [addToast, connectionQuality, cooldownSeconds, email, enqueueRetry, fetchWithRetry, formValues, isOnline, startCooldown, validateAll]);

  const handleRequest = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    await submitRequest();
  }, [submitRequest]);

  const clearRequestFeedback = useCallback(() => {
    setError('');
    setSuccess('');
    clearCooldown();
    resetValidation();
  }, [clearCooldown, resetValidation]);

  useAuthFormShortcuts({
    focusOnMount: () => {
      emailRef.current?.focus();
    },
    canSubmitShortcut: () => !loading && fieldErrors.email === '' && email.trim().length > 0,
    onSubmitShortcut: () => {
      void submitRequest();
    },
    enableEscape: true,
    onEscape: clearRequestFeedback,
  });

  return (
    <div className="login-page-container">
      {/* Connection Status Indicator */}
      {showConnectionStatus && (
        <div className={`connection-status ${isOnline ? connectionQuality : 'offline'}`} role="alert" aria-live="polite">
          <div className="connection-content">
            <span className="connection-text">
              {!isOnline ? 'No internet connection' : 
               connectionQuality === 'slow' ? 'Slow connection detected' : 
               'Poor connection quality'}
            </span>
            {!isOnline && pendingRetryCount > 0 && (
              <span className="retry-info">Will retry when connected</span>
            )}
          </div>
          <CloseControl
            className="connection-close"
            onClick={dismissConnectionStatus}
            label="Dismiss connection status"
            size="xs"
          />
        </div>
      )}

      <div className="enhanced-card">
        <div className="header-section">
          <div className="auth-logo-section">
            <Image 
              src="/logo.svg" 
              alt="BracketWorks Logo" 
              width={72}
              height={72}
              className="auth-logo-img"
            />
          </div>
          <h1 className="auth-brand-title">BracketWorks</h1>
          <h2 className="auth-page-heading">Reset Password</h2>
          <div className="login-subtitle">Enter your email address and we&apos;ll send you a reset code.</div>
        </div>

        <form onSubmit={handleRequest} className="login-form">
          <AuthValidatedInputField
            label="Email Address"
            inputId="reset-email"
            inputRef={emailRef}
            type="email"
            value={email}
            onChange={(nextValue) => {
              setEmail(nextValue);
              handleFieldChange('email', nextValue, { email: nextValue });
            }}
            onBlur={(nextValue) => handleFieldBlur('email', nextValue, { email: nextValue })}
            className={`login-input ${fieldErrors.email ? 'error' : ''} ${
              fieldTouched.email && !fieldErrors.email && email.trim() ? 'success' : ''
            }`}
            placeholder="Enter your email address"
            autoComplete="email"
            disabled={loading}
            errorMessage={fieldErrors.email}
            successMessage={!fieldErrors.email && fieldTouched.email && email.trim() ? 'Valid email format' : ''}
            errorId="email-error"
            successId="email-help"
          />

          <AuthFeedback
            success={success}
            error={error}
            successClassName="success-message"
            errorClassName="error-container"
            wrapErrorInSpan={true}
          />

          <button
            type="submit"
            className={`login-button ${loading ? 'loading' : ''}`}
            disabled={loading || !!fieldErrors.email || !email.trim() || isValidating || cooldownSeconds > 0}
          >
            {loading ? 'Sending reset code...' : cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : 'Send Reset Code'}
          </button>
        </form>

        <div className="links-container">
          <Link href="/login" className="signup-link">
            Back to Login
          </Link>
          <Link href="/reset-password/verify" className="forgot-link">
            Have a Code?
          </Link>
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


