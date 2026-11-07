"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useRef, useCallback, useMemo } from "react";
import { Button, Notice, TextField, buttonClassName } from '@bracketworks/ui';

import BWAuthShell from "../../components/BWAuthShell";
import { useFieldValidation } from "../../hooks/useFieldValidation";
import { describeNetworkRequestError, useNetworkRequest } from "../../hooks/useNetworkRequest";
import { PasswordResetApiError, verifyResetCode } from "../../lib/auth/password-reset";
import { getEmailValidationError, getResetCodeValidationError } from '../../lib/auth/validation';
import { useToast } from "../../components/Toast";
import { logger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/error-utils';
import styles from "../styles/resetPassword.module.css";

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
    <BWAuthShell
      title="Verify your reset code"
      subtitle="Enter your email address and the reset code we sent you. Check your inbox for the verification code."
      switchRow={<>Remembered your password? <Link href="/login">Back to log in</Link></>}
    >
      <form onSubmit={handleVerify} className={styles.form} noValidate>
        {success ? <Notice tone="success" role="status">{success}</Notice> : null}
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

        <TextField
          ref={emailRef}
          id="reset-email"
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            handleFieldChange('email', e.target.value, { ...formValues, email: e.target.value });
          }}
          onBlur={(e) => handleFieldBlur('email', e.target.value, { ...formValues, email: e.target.value })}
          placeholder="name@example.com"
          autoComplete="email"
          disabled={loading}
          required
          error={fieldErrors.email || undefined}
        />

        <TextField
          ref={codeRef}
          id="reset-code"
          label="Reset code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            handleFieldChange('code', e.target.value, { ...formValues, code: e.target.value });
          }}
          onBlur={(e) => handleFieldBlur('code', e.target.value, { ...formValues, code: e.target.value })}
          placeholder="000000"
          autoComplete="one-time-code"
          disabled={loading}
          required
          error={fieldErrors.code || undefined}
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={loading || !!fieldErrors.email || !!fieldErrors.code || !email.trim() || !code.trim() || isValidating}
        >
          {loading ? 'Verifying...' : 'Verify code'}
        </Button>

        <Link href="/reset-password/request" className={buttonClassName({ variant: 'secondary', fullWidth: true })}>
          Request a new code
        </Link>

        <p className={styles.helper}>
          Need help? <a href="mailto:support@bracketworks.app">Contact support</a>
        </p>
      </form>
    </BWAuthShell>
  );
}
