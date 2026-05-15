'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCooldownTimer } from '../hooks/useCooldownTimer';
import { PasswordResetRateLimitError, requestPasswordReset } from '../lib/auth/password-reset';
import { logger } from '../lib/logger';
import AuthFeedback from './AuthFeedback';
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
  const emailRef = useRef<HTMLInputElement>(null);
  const { clearCooldown, cooldownSeconds, startCooldown } = useCooldownTimer();

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }, [isOpen]);

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
  const submitHelper = cooldownSeconds > 0
    ? `You can request another reset code in ${cooldownSeconds}s.`
    : (!email.trim()
      ? 'Enter your email to receive a password reset link.'
      : (fieldError ? fieldError : 'A password reset link will be sent if the account exists.'));

  return (
    <div className={styles.overlay}>
      <div className={`surface-card surface-modalShell ${styles.modal}`}>
        <CloseControl onClick={handleClose} position="absolute" size="sm" label="Close reset password modal" disabled={loading} />
        <div className={`surface-cardHeader ${styles.header}`}>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>Enter your email to receive a password reset link</p>
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
            {isValid && <div className="surface-authHint surface-authHintSuccess">Valid email format</div>}
          </div>

          <div className={styles.buttons}>
            <button
              type="submit"
              disabled={submitDisabled}
              className="surface-authButton surface-authButtonPrimary"
            >
              {loading ? 'Sending...' : (cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : 'Send Reset Link')}
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
