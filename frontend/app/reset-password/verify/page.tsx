"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useEffect, useRef, useCallback, useMemo } from "react";

import Image from "next/image";

import AuthFeedback from "../../components/AuthFeedback";
import AuthValidatedInputField from "../../components/AuthValidatedInputField";
import { useAuthFormShortcuts } from "../../hooks/useAuthFormShortcuts";
import { useFieldValidation } from "../../hooks/useFieldValidation";
import { describeNetworkRequestError, useNetworkRequest } from "../../hooks/useNetworkRequest";
import { PasswordResetApiError, verifyResetCode } from "../../lib/auth/password-reset";
import { getEmailValidationError, getResetCodeValidationError } from '../../lib/auth/validation';
import { useToast } from "../../components/Toast";
import { logger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/error-utils';

export default function VerifyResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const formValues = useMemo(() => ({ email, code }), [code, email]);
  
  const [isValidating, setIsValidating] = useState(false);
  
  // Refs for form fields
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  
  const { addToast } = useToast();
  const {
    connectionQuality,
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
    validateSingle,
  } = useFieldValidation(formValues, (fieldName, value) => {
    switch (fieldName) {
      case 'email':
        return getEmailValidationError(value, 'Email is required', 'Invalid email format');
      case 'code':
        return getResetCodeValidationError(value);
      default:
        return '';
    }
  });

  useEffect(() => {
    // Set mounted immediately to prevent hydration issues
    setMounted(true);
  }, []);

  const clearVerificationFeedback = useCallback(() => {
    setError('');
    resetValidation();
    emailRef.current?.focus();
  }, [resetValidation]);

  useAuthFormShortcuts({
    enableEscape: Boolean(error || Object.values(fieldErrors).some(Boolean)),
    onEscape: clearVerificationFeedback,
    onKeyDown: event => {
      if (event.altKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        emailRef.current?.focus();
        return true;
      }

      if (event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        codeRef.current?.focus();
        return true;
      }

      return false;
    },
  });

  const submitVerification = useCallback(async () => {
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
    const nextErrors = validateAll(formValues);
    const emailError = nextErrors.email;
    const codeError = nextErrors.code;
    
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
      const result = await verifyResetCode(email, code, fetchWithRetry);
      setSuccess(result.successMessage);
      addToast({
        type: 'success',
        message: result.successMessage,
        duration: 3000
      });
      
      setTimeout(() => {
        router.push(result.redirectUrl);
      }, 2000);
      
    } catch (err: unknown) {
      if (err instanceof PasswordResetApiError) {
        if (err.fieldErrors.email) setFieldError('email', err.fieldErrors.email);
        if (err.fieldErrors.code) setFieldError('code', err.fieldErrors.code);

        setError(err.message);
        addToast({
          type: 'error',
          message: err.message,
          duration: 6000
        });

        setTimeout(() => {
          document.getElementById('reset-email')?.focus();
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
        const retryVerify = async () => {
          try {
            await submitVerification();
          } catch (retryError) {
            logger.debug('Retry failed:', retryError);
          }
        };
        enqueueRetry(retryVerify);
        
        addToast({
          type: 'info',
          message: 'Verification will be retried automatically when connection is restored.',
          duration: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  }, [addToast, code, connectionQuality, email, enqueueRetry, fetchWithRetry, formValues, isOnline, router, setFieldError, validateAll]);

  const handleVerify = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    await submitVerification();
  }, [submitVerification]);

  return (
    <div className="login-page-container">
      {/* Connection Status Bar */}
      {!isOnline && (
        <div className="connection-status offline">
          <span>No internet connection - requests will be retried automatically</span>
          {pendingRetryCount > 0 && <span className="retry-info">Waiting to retry</span>}
        </div>
      )}
      
      {isOnline && showConnectionStatus && connectionQuality !== 'good' && (
        <div className={`connection-status ${connectionQuality}`}>
          <span>
            {connectionQuality === 'slow' && 'Slow connection detected'}
            {connectionQuality === 'poor' && 'Poor connection detected'}
          </span>
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
          <h2 className="auth-page-heading">Verify Reset Code</h2>
          <div className="login-subtitle">Enter your email address and the reset code we sent you.</div>
        </div>

        <form onSubmit={handleVerify} className="login-form">
          <AuthValidatedInputField
            label="Email Address"
            inputId="reset-email"
            inputRef={emailRef}
            type="email"
            value={email}
            onChange={(nextValue) => {
              setEmail(nextValue);
              handleFieldChange('email', nextValue, { ...formValues, email: nextValue });
            }}
            onBlur={(nextValue) => handleFieldBlur('email', nextValue, { ...formValues, email: nextValue })}
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

          <AuthValidatedInputField
            label="Reset Code"
            inputId="reset-code"
            inputRef={codeRef}
            type="text"
            value={code}
            onChange={(nextValue) => {
              setCode(nextValue);
              handleFieldChange('code', nextValue, { ...formValues, code: nextValue });
            }}
            onBlur={(nextValue) => handleFieldBlur('code', nextValue, { ...formValues, code: nextValue })}
            className={`login-input ${fieldErrors.code ? 'error' : ''} ${
              fieldTouched.code && !fieldErrors.code && code.trim() ? 'success' : ''
            }`}
            placeholder="Enter your reset code"
            disabled={loading}
            errorMessage={fieldErrors.code}
            successMessage={!fieldErrors.code && fieldTouched.code && code.trim() ? 'Valid reset code format' : ''}
            errorId="code-error"
            successId="code-help"
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
            disabled={loading || !!fieldErrors.email || !!fieldErrors.code || !email.trim() || !code.trim() || isValidating}
          >
            {loading ? 'Verifying code...' : 'Verify Code'}
          </button>
        </form>

        <div className="links-container">
          <Link href="/login" className="signup-link">
            Back to Login
          </Link>
          <Link href="/reset-password/request" className="forgot-link">
            Request New Code
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

