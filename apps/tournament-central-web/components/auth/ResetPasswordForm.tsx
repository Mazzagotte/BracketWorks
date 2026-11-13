'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { Button, Notice, PasswordField } from '@bracketworks/ui';

import AuthShell from './AuthShell';
import styles from './authForm.module.css';

type ResetState = 'idle' | 'loading' | 'success' | 'error';

function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d|[^A-Za-z0-9]).{8,}$/.test(password);
}

/** The page a Tournament Central password reset email links to: /reset-password?token=… */
export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<ResetState>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isStrongPassword(newPassword)) {
      setState('error');
      setMessage('Password must be at least 8 characters and include uppercase, lowercase, and a number or symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setState('error');
      setMessage('Passwords do not match.');
      return;
    }

    setState('loading');
    setMessage('');

    try {
      const response = await fetch('/api/v1/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'Unable to reset your password.';
        throw new Error(detail);
      }

      setState('success');
      setMessage('Your password has been reset. You can sign in with your new password.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (resetError) {
      setState('error');
      setMessage(resetError instanceof Error ? resetError.message : 'Unable to reset your password.');
    }
  };

  if (!token) {
    return (
      <AuthShell mode="login" title="Reset password" subtitle="This reset link is missing its token.">
        <div className={styles.form}>
          <Notice tone="danger" role="alert">
            Open the link from your reset email again, or request a new one.
          </Notice>
          <div className={styles.links}>
            <Link href="/forgot-password">Request a new link</Link>
            <Link href="/login">Back to sign in</Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="login" title="Reset password" subtitle="Choose a new password for your account.">
      <form className={styles.form} onSubmit={handleSubmit}>
        {message ? (
          <Notice tone={state === 'success' ? 'success' : 'danger'} role={state === 'success' ? 'status' : 'alert'}>
            {message}
          </Notice>
        ) : null}

        {state === 'success' ? (
          <div className={styles.links}>
            <Link href="/login">Sign in</Link>
          </div>
        ) : (
          <>
            <PasswordField
              id="reset-new-password"
              label="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <PasswordField
              id="reset-confirm-password"
              label="Confirm new password"
              showLabel="Show confirm password"
              hideLabelText="Hide confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <p className={styles.helper}>
              This password works on both Tournament Central and BracketWorks.
            </p>

            <Button type="submit" variant="primary" fullWidth disabled={state === 'loading'}>
              {state === 'loading' ? 'Resetting...' : 'Reset password'}
            </Button>

            <div className={styles.links}>
              <Link href="/login">Back to sign in</Link>
              <Link href="/forgot-password">Request a new link</Link>
            </div>
          </>
        )}
      </form>
    </AuthShell>
  );
}
