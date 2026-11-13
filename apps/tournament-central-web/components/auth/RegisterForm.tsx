'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { Button, FormGrid, Notice, PasswordField, TextField, capitalizeFirstLetter } from '@bracketworks/ui';

import AuthShell from './AuthShell';
import { ACCOUNT_SITE } from './accountSite';
import styles from './authForm.module.css';

type RegisterValues = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  organization: string;
  password: string;
  confirmPassword: string;
};

const EMPTY_FORM: RegisterValues = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  organization: '',
  password: '',
  confirmPassword: '',
};

function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d|[^A-Za-z0-9]).{8,}$/.test(password);
}

export default function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<RegisterValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const passwordHint = useMemo(() => {
    if (!values.password) {
      return 'Use at least 8 characters with uppercase, lowercase, and a number or symbol.';
    }
    return isStrongPassword(values.password) ? 'Password strength looks good.' : 'Password does not meet strength requirements.';
  }, [values.password]);

  const updateField = (field: keyof RegisterValues, value: string) => {
    const normalizedValue = field === 'firstName' || field === 'lastName' || field === 'organization'
      ? capitalizeFirstLetter(value)
      : value;
    setValues((prev) => ({ ...prev, [field]: normalizedValue }));
    if (error) {
      setError('');
    }
    if (success) {
      setSuccess('');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!values.firstName.trim() || !values.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }

    if (values.username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (!values.email.trim()) {
      setError('Email is required.');
      return;
    }

    if (!isStrongPassword(values.password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and a number or symbol.');
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/users/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          username: values.username.trim(),
          email: values.email.trim().toLowerCase(),
          organization: values.organization.trim() || undefined,
          password: values.password,
          site: ACCOUNT_SITE,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { detail?: string };

      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'Unable to create account.';
        throw new Error(detail);
      }

      setSuccess('Account created successfully. Redirecting to sign in...');
      setTimeout(() => {
        router.push('/login?signup=success');
      }, 700);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create account.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="signup"
      title="Create an account"
      subtitle="Register to browse tournaments, enter events, and follow your registrations."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        {success ? <Notice tone="success" role="status">{success}</Notice> : null}

        <FormGrid>
          <TextField id="signup-firstName" label="First name" value={values.firstName} onChange={(event) => updateField('firstName', event.target.value)} autoComplete="given-name" required />
          <TextField id="signup-lastName" label="Last name" value={values.lastName} onChange={(event) => updateField('lastName', event.target.value)} autoComplete="family-name" required />
          <TextField id="signup-username" label="Username" fullRow value={values.username} onChange={(event) => updateField('username', event.target.value)} placeholder="Choose a unique username" autoComplete="username" required />
          <TextField id="signup-email" label="Email" fullRow type="email" value={values.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" autoComplete="email" required />
          <TextField id="signup-organization" label="Organization" optional fullRow value={values.organization} onChange={(event) => updateField('organization', event.target.value)} placeholder="League, center, association, or event" autoComplete="organization" />
          <PasswordField id="signup-password" label="Password" value={values.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="new-password" required />
          <PasswordField
            id="signup-confirmPassword"
            label="Confirm password"
            showLabel="Show confirm password"
            hideLabelText="Hide confirm password"
            value={values.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            autoComplete="new-password"
            required
          />
        </FormGrid>
        <p className={styles.helper}>{passwordHint}</p>

        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>

        <p className={styles.center}>
          Already have a verification token? <Link href="/verify-email">Verify your email</Link>
        </p>
      </form>
    </AuthShell>
  );
}
