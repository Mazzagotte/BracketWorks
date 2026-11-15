'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { Button, Notice, TextField } from '@bracketworks/ui';

import AuthShell from '@/components/auth/AuthShell';
import styles from '@/components/auth/authForm.module.css';

const SENT_MESSAGE = "If that email is on a registration, we've sent the links to manage it. Check your inbox in a few minutes.";

/** Lost your Manage registration link? Enter your email and we send your links again. */
export default function FindRegistrationForm() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSent('');
    if (!email.trim()) {
      setError('Enter the email address on your registration.');
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/v1/public/tc-registration/manage-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok && response.status !== 429) throw new Error('We could not send your links right now. Try again.');
      setSent(SENT_MESSAGE);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not send your links right now. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      title="Find your registration"
      subtitle="Enter the email address on your registration. We'll email you a link to view or change it."
      showSwitchRow={false}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        {sent ? <Notice tone="success" role="status">{sent}</Notice> : null}

        <TextField
          id="registration-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Button type="submit" variant="primary" fullWidth disabled={sending}>
          {sending ? 'Sending...' : 'Email me my links'}
        </Button>

        <div className={styles.links}>
          <Link href="/">Find a tournament</Link>
        </div>
      </form>
    </AuthShell>
  );
}
