"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useRef, useCallback, useMemo } from "react";

import AuthFeedback from "../../components/AuthFeedback";
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
  const [isValidating, setIsValidating] = useState(false);
  const formValues = useMemo(() => ({ email, code }), [code, email]);
  
  // Refs for form fields
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  
  const { addToast } = useToast();
  const {
    connectionQuality,
    enqueueRetry,
    fetchWithRetry,
    isOnline,
  } = useNetworkRequest();
  const {
    fieldErrors,
    handleFieldBlur,
    handleFieldChange,
    resetValidation,
    setFieldError,
    validateAll,
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

  const clearVerificationFeedback = useCallback(() => {
    setError('');
    resetValidation();
    emailRef.current?.focus();
  }, [resetValidation]);

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
    <div className="rp-req-page">
      <div className="rp-req-card">
        {/* Shield with lock icon */}
        <div className="rp-req-icon-wrap">
          <div className="rp-req-icon-box">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FF6A00"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {/* Shield outline */}
              <path d="M12 1L3 5v7c0 5.55 4.91 10.74 9 11.9c4.09-1.16 9-6.35 9-11.9V5l-9-4z" />
              {/* Lock */}
              <rect x="8" y="11" width="8" height="6" rx="1" />
              <path d="M10 11V9a2 2 0 0 1 4 0v2" />
              <circle cx="12" cy="14" r="0.5" fill="#FF6A00" />
            </svg>
          </div>
        </div>

        <h1 className="rp-req-title">Verify Reset Code</h1>
        <p className="rp-req-subtitle">
          Enter your email address and the reset code we sent you.<br />
          Check your inbox for the verification code.
        </p>

        <form onSubmit={handleVerify} className="rp-req-form" noValidate>
          {/* Email Field */}
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
                  handleFieldChange('email', e.target.value, { ...formValues, email: e.target.value });
                }}
                onBlur={(e) => handleFieldBlur('email', e.target.value, { ...formValues, email: e.target.value })}
                className={`rp-req-input${fieldErrors.email ? ' is-error' : ''}`}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={loading}
                required
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
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
            {fieldErrors.email && (
              <p id="email-error" className="rp-req-field-error" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Reset Code Field */}
          <div>
            <label htmlFor="reset-code" className="rp-req-label">
              Reset code<span className="rp-req-required" aria-hidden="true"> *</span>
            </label>
            <div className="rp-req-input-wrap">
              <input
                ref={codeRef}
                id="reset-code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  handleFieldChange('code', e.target.value, { ...formValues, code: e.target.value });
                }}
                onBlur={(e) => handleFieldBlur('code', e.target.value, { ...formValues, code: e.target.value })}
                className={`rp-req-input${fieldErrors.code ? ' is-error' : ''}`}
                placeholder="000000"
                disabled={loading}
                required
                aria-describedby={fieldErrors.code ? 'code-error' : undefined}
                aria-invalid={Boolean(fieldErrors.code)}
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
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M7 14a6 6 0 0 0-6 6v3h18v-3a6 6 0 0 0-6-6H7z" />
                </svg>
              </span>
            </div>
            {fieldErrors.code && (
              <p id="code-error" className="rp-req-field-error" role="alert">
                {fieldErrors.code}
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
            disabled={loading || !!fieldErrors.email || !!fieldErrors.code || !email.trim() || !code.trim() || isValidating}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <Link href="/reset-password/request" className="rp-error-action-link">
            Request New Code
          </Link>
        </form>

        <div className="rp-req-back-wrap">
          <span className="rp-req-back-line" />
          <Link href="/login" className="rp-req-back-link">← Back to Log In</Link>
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

