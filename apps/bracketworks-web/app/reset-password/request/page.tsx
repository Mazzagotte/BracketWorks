"use client";

import Link from 'next/link';
import { type FormEvent, useState, useRef, useCallback, useMemo } from "react";
import { Button, Notice, TextField } from '@bracketworks/ui';

import BWAuthShell from "../../components/BWAuthShell";
import { useAuthFormShortcuts } from "../../hooks/useAuthFormShortcuts";
import { useCooldownTimer } from "../../hooks/useCooldownTimer";
import { useFieldValidation } from "../../hooks/useFieldValidation";
import { describeNetworkRequestError, useNetworkRequest } from "../../hooks/useNetworkRequest";
import { PasswordResetRateLimitError, requestPasswordReset } from "../../lib/auth/password-reset";
import { getEmailValidationError } from '../../lib/auth/validation';
import { useToast } from "../../components/Toast";
import { logger } from '../../lib/logger';
import { getErrorMessage } from '../../lib/error-utils';
import styles from '../styles/resetPassword.module.css';

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
    handleFieldBlur,
    handleFieldChange,
    resetValidation,
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

  const connectionMessage = !isOnline
    ? 'No internet connection.'
    : connectionQuality === 'slow'
      ? 'Slow connection detected.'
      : 'Poor connection quality.';

  return (
    <BWAuthShell
      title="Reset your password"
      subtitle="Enter the email connected to your BracketWorks account. We'll send you a secure link to create a new password."
      switchRow={<>Remembered your password? <Link href="/login">Back to log in</Link></>}
    >
      {showConnectionStatus ? (
        <Notice
          tone="warning"
          role="alert"
          action={<Button variant="ghost" size="sm" onClick={dismissConnectionStatus} aria-label="Dismiss connection status">Dismiss</Button>}
        >
          {connectionMessage}
          {!isOnline && pendingRetryCount > 0 ? ' Will retry when connected.' : null}
        </Notice>
      ) : null}

      <form onSubmit={handleRequest} className={styles.form} noValidate>
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
            handleFieldChange('email', e.target.value, { email: e.target.value });
          }}
          onBlur={(e) => handleFieldBlur('email', e.target.value, { email: e.target.value })}
          placeholder="name@example.com"
          autoComplete="email"
          disabled={loading}
          required
          error={fieldErrors.email || undefined}
          helper="Enter the email used for your BracketWorks account."
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={loading || !!fieldErrors.email || !email.trim() || isValidating || cooldownSeconds > 0}
        >
          {loading
            ? 'Sending...'
            : cooldownSeconds > 0
              ? `Retry in ${cooldownSeconds}s`
              : 'Send reset link'}
        </Button>

        <p className={styles.helper}>
          Need help? <a href="mailto:support@bracketworks.app">Contact support</a>
        </p>
      </form>
    </BWAuthShell>
  );
}
