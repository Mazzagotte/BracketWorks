'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCooldownTimer } from '../hooks/useCooldownTimer';
import { PasswordResetRateLimitError, requestPasswordReset } from '../lib/auth/password-reset';
import { logger } from '../lib/logger';
import { usePasswordResetModalForm } from '../hooks/usePasswordResetModalForm';
import AuthFeedback from './AuthFeedback';
import styles from './ResetPasswordModal.module.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ResetPasswordModal({ isOpen, onClose, onSuccess }: ResetPasswordModalProps) {
  const emailRef = useRef<HTMLInputElement>(null);
  const { clearCooldown, cooldownSeconds, startCooldown } = useCooldownTimer();
  const form = usePasswordResetModalForm();

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    clearCooldown();
    form.reset();
    onClose();
  }, [clearCooldown, form, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldownSeconds > 0) {
      form.setError(`Please wait ${cooldownSeconds} seconds before sending another code.`);
      return;
    }

    const emailError = form.validateEmailField(form.email);
    if (emailError) {
      form.setError(emailError);
      form.handleBlur(form.email);
      emailRef.current?.focus();
      return;
    }

    form.setLoading(true);
    try {
      const result = await requestPasswordReset(form.email);
      logger.info('Password reset requested', { email: form.email });
      startCooldown(result.cooldownSeconds);
      form.setSuccess(result.successMessage);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof PasswordResetRateLimitError) {
        startCooldown(err.retryAfterSeconds);
        form.setError(err.message);
        emailRef.current?.focus();
        return;
      }

      const msg = err instanceof Error ? err.message : 'Please check your connection';
      form.setError(`Network error: ${msg}`);
      logger.error('Password reset error', { error: msg });
    } finally {
      form.setLoading(false);
    }
  }, [cooldownSeconds, form, onSuccess, startCooldown]);

  if (!isOpen) return null;

  const submitDisabled = form.loading || !!form.fieldError || !form.email.trim() || cooldownSeconds > 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <div className={styles.iconBox}>
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FF6A00"
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
          <h2 className={styles.title}>Reset your password</h2>
          <p className={styles.subtitle}>
            Enter the email connected to your BracketWorks account.<br />
            We&apos;ll send you a secure link to create a new password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.body} noValidate>
          <div className={styles.field}>
            <label className="surface-authLabel">
              Email address<span className={styles.required}> *</span>
            </label>
            <input
              ref={emailRef}
              type="email"
              value={form.email}
              onChange={e => form.updateEmail(e.target.value)}
              onBlur={e => form.handleBlur(e.target.value)}
              placeholder="name@example.com"
              required
              disabled={form.loading || cooldownSeconds > 0}
              className={`surface-authInput ${
                form.fieldError ? 'surface-authInputError' :
                form.touched && !form.fieldError && form.email.trim() ? 'surface-authInputValid' : ''
              }`}
              aria-describedby={form.fieldError ? 'email-error' : 'email-hint'}
              aria-invalid={Boolean(form.fieldError)}
            />
            {form.fieldError ? (
              <p id="email-error" className={styles.fieldError} role="alert">
                {form.fieldError}
              </p>
            ) : (
              <p id="email-hint" className={styles.fieldHint}>
                Enter the email used for your BracketWorks account.
              </p>
            )}
          </div>

          <div className={styles.feedback}>
            <AuthFeedback success={form.success} error={form.error} />
          </div>

          <button
            type="submit"
            disabled={form.loading || !!form.fieldError || !form.email.trim() || cooldownSeconds > 0}
            className={styles.submitBtn}
          >
            {form.loading ? 'Sending…' : (cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : 'Send Reset Link')}
          </button>

          <div className={styles.backWrap}>
            <span className={styles.backLine} />
            <button
              type="button"
              onClick={handleClose}
              className={styles.backLink}
              style={{ background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', font: 'inherit' }}
            >
              ← Back to Log In
            </button>
            <span className={styles.backLine} />
          </div>

          <p className={styles.support}>
            Need help?{' '}
            <button
              type="button"
              onClick={handleClose}
              className={styles.supportLink}
              style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer', font: 'inherit' }}
            >
              Contact Support
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
