'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { Button, Notice, TextField } from '@bracketworks/ui';

import AuthShell from './AuthShell';
import styles from './authForm.module.css';

const GENERIC_SUCCESS_MESSAGE = 'If an account exists for this email, a password reset link has been sent.';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

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

      setSuccess(GENERIC_SUCCESS_MESSAGE);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to request password reset.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      title="Forgot password"
      subtitle="Enter your email and we will send a reset link if your account exists."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        {success ? <Notice tone="success" role="status">{success}</Notice> : null}

        <TextField
          id="reset-email"
          label="Email"
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

        <div className={styles.links}>
          <Link href="/login">Back to sign in</Link>
          <Link href="/verify-email">Verify email</Link>
        </div>
      </form>
    </AuthShell>
  );
}
