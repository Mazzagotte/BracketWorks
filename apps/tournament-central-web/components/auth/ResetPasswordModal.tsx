'use client';

import { FormEvent, useState } from 'react';

import { ACCOUNT_SITE } from './accountSite';
import styles from './authForm.module.css';
import { Button, Modal, Notice, TextField } from '@bracketworks/ui';

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
          site: ACCOUNT_SITE,
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

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Reset your password"
      description="Enter the email connected to your account and we will send a secure reset link."
      size="sm"
      closeLabel="Close reset password modal"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        <TextField
          id="modal-reset-email"
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? 'Sending link...' : 'Send reset link'}
        </Button>
      </form>
    </Modal>
  );
}
