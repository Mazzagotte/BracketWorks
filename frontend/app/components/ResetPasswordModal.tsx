'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../lib/api';
import { logger } from '../lib/logger';
import CloseControl from '../../components/CloseControl';
import styles from './ResetPasswordModal.module.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ResetPasswordModal({ isOpen, onClose, onSuccess }: ResetPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [touched, setTouched] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const validateEmail = useCallback((value: string): string => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
    return '';
  }, []);

  const handleChange = (value: string) => {
    setEmail(value);
    if (error) setError('');
    if (success) setSuccess('');
    if (fieldError && value.trim()) setFieldError('');
    if (touched) setFieldError(validateEmail(value));
  };

  const handleBlur = (value: string) => {
    setTouched(true);
    setFieldError(validateEmail(value));
  };

  const handleClose = () => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setEmail('');
    setError('');
    setSuccess('');
    setFieldError('');
    setTouched(false);
    setCooldownSeconds(0);
    onClose();
  };

  const startCooldown = (seconds: number) => {
    const initial = Math.max(0, seconds);
    setCooldownSeconds(initial);
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    if (initial <= 0) {
      cooldownTimerRef.current = null;
      return;
    }
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds} seconds before sending another code.`);
      return;
    }

    const emailError = validateEmail(email);
    setFieldError(emailError);
    setTouched(true);

    if (emailError) {
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API('/api/v1/users/request-password-reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfterRaw = res.headers.get('Retry-After');
          const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : NaN;
          const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
          startCooldown(waitSeconds);
          setError(`Too many requests. Please wait ${waitSeconds} seconds before trying again.`);
          emailRef.current?.focus();
          return;
        }

        // Return a neutral message for non-429 errors to avoid account enumeration.
        logger.warn('Password reset request returned non-429 error', { status: res.status });
      }

      logger.info('Password reset requested', { email });
      startCooldown(30);
      setSuccess('If an account exists for this email, a reset code has been sent.');
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please check your connection';
      setError(`Network error: ${msg}`);
      logger.error('Password reset error', { error: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isValid = touched && !fieldError && email.trim();
  const submitDisabled = loading || !!fieldError || !email.trim() || cooldownSeconds > 0;
  const submitHelper = cooldownSeconds > 0
    ? `You can request another reset code in ${cooldownSeconds}s.`
    : (!email.trim()
      ? 'Enter your email to receive a reset code.'
      : (fieldError ? fieldError : 'A reset code will be sent if the account exists.'));

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={`surface-card surface-modalShell ${styles.modal}`} onClick={e => e.stopPropagation()}>
        <CloseControl onClick={handleClose} position="absolute" size="sm" label="Close reset password modal" disabled={loading} />
        <div className={`surface-cardHeader ${styles.header}`}>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>Enter your email to receive a reset code</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.body}>
          {success && <div className="surface-feedback surface-feedbackSuccess">{success}</div>}
          {error && <div className="surface-feedback surface-feedbackError">{error}</div>}

          <div className={styles.field}>
            <label className="surface-authLabel">Email Address *</label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => handleChange(e.target.value)}
              onBlur={e => handleBlur(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              className={`surface-authInput ${
                fieldError ? 'surface-authInputError' :
                isValid ? 'surface-authInputValid' : ''
              }`}
            />
            {fieldError && <div className="surface-authHint">{fieldError}</div>}
            {isValid && <div className="surface-authHint surface-authHintSuccess">Valid email format</div>}
          </div>

          <div className={styles.buttons}>
            <button
              type="submit"
              disabled={submitDisabled}
              className="surface-authButton surface-authButtonPrimary"
            >
              {loading ? 'Sending...' : (cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : 'Send Reset Code')}
            </button>
            <button type="button" onClick={handleClose} disabled={loading} className="surface-authButton surface-authButtonSecondary">
              {success ? 'Close' : 'Cancel'}
            </button>
          </div>

          <div className={styles.submitHelper}>{submitHelper}</div>
        </form>
      </div>
    </div>
  );
}
