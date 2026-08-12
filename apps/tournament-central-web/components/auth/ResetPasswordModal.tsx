'use client';

import { FormEvent, useState } from 'react';

import styles from './ResetPasswordModal.module.css';

type ResetPasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export default function ResetPasswordModal({ isOpen, onClose, onSuccess }: ResetPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setEmail('');
    setError('');
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/users/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      if (!response.ok && response.status !== 429) {
        throw new Error('Unable to process reset request right now. Please try again.');
      }

      onSuccess('If an account exists for this email, a password reset link has been sent.');
      handleClose();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to request password reset.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Reset password">
      <div className={styles.modal}>
        <button type="button" onClick={handleClose} className={styles.closeButton} aria-label="Close reset password modal">
          x
        </button>

        <div className={styles.header}>
          <h2>Reset your password</h2>
          <p>Enter the email connected to your account and we will send a secure reset link.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <p className={styles.errorMessage} role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <label className={styles.fieldLabel} htmlFor="modal-reset-email">Email address *</label>
          <input
            id="modal-reset-email"
            className={styles.fieldInput}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
