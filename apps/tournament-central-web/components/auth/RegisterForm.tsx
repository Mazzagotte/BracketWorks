'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

import AuthShell from './AuthShell';
import styles from './RegisterForm.module.css';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    setValues((prev) => ({ ...prev, [field]: value }));
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
      title="Create account"
      subtitle="Register to browse events, save favorites, and manage tournament participation."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && (
          <p className={styles.errorMessage} role="alert" aria-live="polite">
            {error}
          </p>
        )}
        {success && (
          <p className={styles.successMessage} role="status" aria-live="polite">
            {success}
          </p>
        )}

        <div className={styles.twoCol}>
          <div>
            <label className={styles.fieldLabel} htmlFor="signup-firstName">First name</label>
            <input
              id="signup-firstName"
              className={styles.fieldInput}
              value={values.firstName}
              onChange={(event) => updateField('firstName', event.target.value)}
              autoComplete="given-name"
              required
            />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="signup-lastName">Last name</label>
            <input
              id="signup-lastName"
              className={styles.fieldInput}
              value={values.lastName}
              onChange={(event) => updateField('lastName', event.target.value)}
              autoComplete="family-name"
              required
            />
          </div>
        </div>

        <label className={styles.fieldLabel} htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          className={styles.fieldInput}
          value={values.username}
          onChange={(event) => updateField('username', event.target.value)}
          placeholder="Choose a unique username"
          autoComplete="username"
          required
        />

        <label className={styles.fieldLabel} htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          className={styles.fieldInput}
          type="email"
          value={values.email}
          onChange={(event) => updateField('email', event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label className={styles.fieldLabel} htmlFor="signup-organization">Organization (optional)</label>
        <input
          id="signup-organization"
          className={styles.fieldInput}
          value={values.organization}
          onChange={(event) => updateField('organization', event.target.value)}
          placeholder="League, center, association, or event"
          autoComplete="organization"
        />

        <div className={styles.twoCol}>
          <div>
            <label className={styles.fieldLabel} htmlFor="signup-password">Password</label>
            <div className={styles.passwordRow}>
              <input
                id="signup-password"
                className={styles.fieldInput}
                type={showPassword ? 'text' : 'password'}
                value={values.password}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className={styles.fieldLabel} htmlFor="signup-confirmPassword">Confirm password</label>
            <div className={styles.passwordRow}>
              <input
                id="signup-confirmPassword"
                className={styles.fieldInput}
                type={showConfirmPassword ? 'text' : 'password'}
                value={values.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>

        <p className={styles.hint}>{passwordHint}</p>

        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <div className={styles.helperLinks}>
          <span>Already have a verification token?</span>
          <Link href="/verify-email">Verify email</Link>
        </div>
      </form>
    </AuthShell>
  );
}
