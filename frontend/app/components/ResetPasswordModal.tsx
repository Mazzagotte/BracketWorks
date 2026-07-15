'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCooldownTimer } from '../hooks/useCooldownTimer';
import { PasswordResetRateLimitError, requestPasswordReset } from '../lib/auth/password-reset';
import { getEmailValidationError } from '../lib/auth/validation';
import { logger } from '../lib/logger';
import AuthFeedback from './AuthFeedback';
import styles from './ResetPasswordModal.module.css';
import buttonStyles from '../styles/buttons.module.css';

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
  const emailRef = useRef<HTMLInputElement>(null);
  const { clearCooldown, cooldownSeconds, startCooldown } = useCooldownTimer();

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }, [isOpen]);

  const validateEmail = useCallback((value: string): string => {
    return getEmailValidationError(
      value,
      'Email address is required.',
      'Please enter a valid email address'
    );
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
    clearCooldown();
    setEmail('');
    setError('');
    setSuccess('');
    setFieldError('');
    setTouched(false);
    onClose();
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
      const result = await requestPasswordReset(email);
      logger.info('Password reset requested', { email });
      startCooldown(result.cooldownSeconds);
      setSuccess(result.successMessage);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof PasswordResetRateLimitError) {
        startCooldown(err.retryAfterSeconds);
        setError(err.message);
        emailRef.current?.focus();
        return;
      }

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

  return (
    <div className={styles.overlay}>
      <div className={`surface-card surface-modalShell ${styles.modal}`}>
        <div className={`surface-cardHeader ${styles.header}`}>
          <h2 className={styles.title}>Reset your password</h2>
          <p className={styles.subtitle}>Enter your email address and we&apos;ll send you a password reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.body}>
          <AuthFeedback success={success} error={error} />

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
          </div>

          <div className={styles.buttons}>
            <button
              type="submit"
              disabled={submitDisabled}
              className="surface-authButton surface-authButtonPrimary"
            >
              {loading ? 'Sending...' : (cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : 'Send Reset Link')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.cancelBtn}`}
            >
              {success ? 'Close' : 'Cancel'}
            </button>
          </div>
          <p className={styles.submitHelper}>Use the email linked to your BracketWorks account.</p>
        </form>
      </div>
    </div>
  );
}
