'use client';

import { FormEvent, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import styles from './SignupModal.module.css';

type SignupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

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

export default function SignupModal({ isOpen, onClose, onSuccess }: SignupModalProps) {
  const [values, setValues] = useState<RegisterValues>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordHint = useMemo(() => {
    if (!values.password) {
      return 'Use at least 8 characters with uppercase, lowercase, and a number or symbol.';
    }
    return isStrongPassword(values.password)
      ? 'Password strength looks good.'
      : 'Password does not meet strength requirements.';
  }, [values.password]);

  const updateField = (field: keyof RegisterValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const closeModal = () => {
    setError('');
    setValues(EMPTY_FORM);
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

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

      onSuccess('Account created. Check your email for a verification message, then sign in.');
      closeModal();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create account.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Create account">
      <div className={styles.modal}>
        <button type="button" onClick={closeModal} className={styles.closeButton} aria-label="Close signup modal">
          <X size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>

        <div className={styles.header}>
          <h2>Create your account</h2>
          <p>Create your account to browse tournaments, register, and follow live results.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <p className={styles.errorMessage} role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <h3 className={styles.sectionHeader}>YOUR INFORMATION</h3>

          <div className={styles.twoCol}>
            <div>
              <label className={styles.fieldLabel} htmlFor="modal-signup-firstName">First name *</label>
              <input
                id="modal-signup-firstName"
                className={styles.fieldInput}
                value={values.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="modal-signup-lastName">Last name *</label>
              <input
                id="modal-signup-lastName"
                className={styles.fieldInput}
                value={values.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <label className={styles.fieldLabel} htmlFor="modal-signup-username">Username *</label>
          <input
            id="modal-signup-username"
            className={styles.fieldInput}
            value={values.username}
            onChange={(event) => updateField('username', event.target.value)}
            placeholder="Choose a unique username"
            autoComplete="username"
            required
          />

          <label className={styles.fieldLabel} htmlFor="modal-signup-organization">Organization (optional)</label>
          <input
            id="modal-signup-organization"
            className={styles.fieldInput}
            value={values.organization}
            onChange={(event) => updateField('organization', event.target.value)}
            placeholder="League, center, association, or event"
            autoComplete="organization"
          />

          <h3 className={styles.sectionHeader}>ACCOUNT SECURITY</h3>

          <label className={styles.fieldLabel} htmlFor="modal-signup-email">Email *</label>
          <input
            id="modal-signup-email"
            className={styles.fieldInput}
            type="email"
            value={values.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <div className={styles.twoCol}>
            <div>
              <label className={styles.fieldLabel} htmlFor="modal-signup-password">Password *</label>
              <div className={styles.passwordRow}>
                <input
                  id="modal-signup-password"
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
              <label className={styles.fieldLabel} htmlFor="modal-signup-confirmPassword">Confirm password *</label>
              <div className={styles.passwordRow}>
                <input
                  id="modal-signup-confirmPassword"
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
        </form>
      </div>
    </div>
  );
}
