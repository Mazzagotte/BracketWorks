"use client";

import Link from 'next/link';
import { type FormEvent, useState, useEffect, useRef, useCallback, useMemo } from "react";

import AuthFeedback from "../../components/AuthFeedback";
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
    <div className="rp-req-page">
      {/* Connection Status Banner */}
      {showConnectionStatus && (
        <div className="rp-req-connection" role="alert" aria-live="polite">
          <span>
            {!isOnline
              ? 'No internet connection'
              : connectionQuality === 'slow'
              ? 'Slow connection detected'
              : 'Poor connection quality'}
          </span>
          {!isOnline && pendingRetryCount > 0 && (
            <span className="rp-req-retry-info">Will retry when connected</span>
          )}
          <CloseControl
            onClick={dismissConnectionStatus}
            label="Dismiss connection status"
            size="xs"
          />
        </div>
      )}

      <div className="rp-req-card">
        {/* Key icon */}
        <div className="rp-req-icon-wrap">
          <div className="rp-req-icon-box">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="7.5" cy="15.5" r="5.5" />
              <path d="M21 2l-9.6 9.6" />
              <path d="M15.5 7.5l3 3L22 7l-3-3" />
            </svg>
          </div>
        </div>

        <h1 className="rp-req-title">Reset your password</h1>
        <p className="rp-req-subtitle">
          Enter the email connected to your BracketWorks account.<br />
          We&apos;ll send you a secure link to create a new password.
        </p>

        <form onSubmit={handleRequest} className="rp-req-form" noValidate>
          <div>
            <label htmlFor="reset-email" className="rp-req-label">
              Email address<span className="rp-req-required" aria-hidden="true"> *</span>
            </label>
            <div className="rp-req-input-wrap">
              <input
                ref={emailRef}
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  handleFieldChange('email', e.target.value, { email: e.target.value });
                }}
                onBlur={(e) => handleFieldBlur('email', e.target.value, { email: e.target.value })}
                className={`rp-req-input${fieldErrors.email ? ' is-error' : ''}`}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={loading}
                required
                aria-describedby={fieldErrors.email ? 'email-error' : 'email-hint'}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              <span className="rp-req-input-icon" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
            </div>
            {fieldErrors.email ? (
              <p id="email-error" className="rp-req-field-error" role="alert">
                {fieldErrors.email}
              </p>
            ) : (
              <p id="email-hint" className="rp-req-hint">
                Enter the email used for your BracketWorks account.
              </p>
            )}
          </div>

          <div className="rp-req-feedback">
            <AuthFeedback
              success={success}
              error={error}
              successClassName="success-message"
              errorClassName="error-container"
              wrapErrorInSpan={true}
            />
          </div>

          <button
            type="submit"
            className="rp-req-submit"
            disabled={loading || !!fieldErrors.email || !email.trim() || isValidating || cooldownSeconds > 0}
          >
            {loading
              ? 'Sending\u2026'
              : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : 'Send Reset Link'}
          </button>
        </form>

        <div className="rp-req-back-wrap">
          <span className="rp-req-back-line" />
          <Link href="/login" className="rp-req-back-link">Back to Log In</Link>
          <span className="rp-req-back-line" />
        </div>

        <p className="rp-req-support">
          Need help?{' '}
          <Link href="/login" className="rp-req-support-link">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}
