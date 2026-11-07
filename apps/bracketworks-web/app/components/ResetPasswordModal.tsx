'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Button, Modal, Notice, TextField } from '@bracketworks/ui';

import { useCooldownTimer } from '../hooks/useCooldownTimer';
import { PasswordResetRateLimitError, requestPasswordReset } from '../lib/auth/password-reset';
import { logger } from '../lib/logger';
import { usePasswordResetModalForm } from '../hooks/usePasswordResetModalForm';
import styles from './ResetPasswordModal.module.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const FORM_ID = 'reset-password-modal-form';

/** "Forgot your password?" dialog on the login page. */
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

  const submitDisabled = form.loading || !!form.fieldError || !form.email.trim() || cooldownSeconds > 0;
  const submitLabel = form.loading
    ? 'Sending...'
    : cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : 'Send reset link';

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Reset your password"
      description="Enter the email connected to your BracketWorks account. We'll send you a secure link to create a new password."
      size="sm"
      closeLabel="Close reset password modal"
      footer={(
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={submitDisabled}>{submitLabel}</Button>
        </>
      )}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className={styles.form} noValidate>
        {form.success ? <Notice tone="success" role="status">{form.success}</Notice> : null}
        {form.error ? <Notice tone="danger" role="alert">{form.error}</Notice> : null}

        <TextField
          ref={emailRef}
          id="modal-reset-email"
          label="Email address"
          type="email"
          value={form.email}
          onChange={e => form.updateEmail(e.target.value)}
          onBlur={e => form.handleBlur(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          required
          disabled={form.loading || cooldownSeconds > 0}
          error={form.fieldError || undefined}
          helper="Enter the email used for your BracketWorks account."
        />

        <p className={styles.helper}>
          Need help? <a href="mailto:support@bracketworks.app">Contact support</a>
        </p>
      </form>
    </Modal>
  );
}
