'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { Button, Notice, TextAreaField } from '@bracketworks/ui';

import AuthShell from './AuthShell';
import styles from './authForm.module.css';

type VerificationState = 'idle' | 'loading' | 'success' | 'error';

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const queryToken = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const [token, setToken] = useState(queryToken);
  const [state, setState] = useState<VerificationState>(queryToken ? 'loading' : 'idle');
  const [message, setMessage] = useState(queryToken ? 'Verifying your email...' : 'Paste your verification token to continue.');

  const submitVerification = async (value: string) => {
    const cleanToken = value.trim();
    if (!cleanToken) {
      setState('error');
      setMessage('Verification token is required.');
      return;
    }

    setState('loading');
    setMessage('Verifying your email...');

    try {
      const response = await fetch('/api/v1/users/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: cleanToken,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'Email verification failed.';
        throw new Error(detail);
      }

      setState('success');
      setMessage('Your email has been verified. You can sign in now.');
    } catch (verifyError) {
      const detail = verifyError instanceof Error ? verifyError.message : 'Email verification failed.';
      setState('error');
      setMessage(detail);
    }
  };

  useEffect(() => {
    if (!queryToken) {
      return;
    }

    let isCancelled = false;
    const run = async () => {
      if (isCancelled) {
        return;
      }
      await submitVerification(queryToken);
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [queryToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitVerification(token);
  };

  return (
    <AuthShell
      mode="login"
      title="Verify email"
      subtitle="Confirm your email to finish setting up your account."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <Notice
          tone={state === 'success' ? 'success' : state === 'error' ? 'danger' : 'info'}
          role="status"
        >
          {message}
        </Notice>

        <TextAreaField
          id="verify-token"
          label="Verification token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste the verification token from your email"
          rows={3}
          required
        />

        <Button type="submit" variant="primary" fullWidth disabled={state === 'loading'}>
          {state === 'loading' ? 'Verifying...' : 'Verify email'}
        </Button>

        <div className={styles.links}>
          <Link href="/login">Back to sign in</Link>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
      </form>
    </AuthShell>
  );
}
