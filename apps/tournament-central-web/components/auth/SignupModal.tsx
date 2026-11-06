'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Button, CardDivider, FormGrid, Modal, Notice, PasswordField, TextField, capitalizeFirstLetter } from '@bracketworks/ui';

import styles from './authForm.module.css';

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
    const normalizedValue = field === 'firstName' || field === 'lastName' || field === 'organization'
      ? capitalizeFirstLetter(value)
      : value;
    setValues((prev) => ({ ...prev, [field]: normalizedValue }));
    if (error) setError('');
  };

  const closeModal = () => {
    setError('');
    setValues(EMPTY_FORM);
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

  return (
    <Modal
      open={isOpen}
      onClose={closeModal}
      title="Create your account"
      description="Create your account to browse tournaments, register, and follow live results."
      size="md"
      closeLabel="Close signup modal"
      closeOnBackdrop={false}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

        <h3 className={styles.subsectionTitle}>Your information</h3>
        <FormGrid>
          <TextField id="modal-signup-firstName" label="First name" value={values.firstName} onChange={(event) => updateField('firstName', event.target.value)} autoComplete="given-name" required />
          <TextField id="modal-signup-lastName" label="Last name" value={values.lastName} onChange={(event) => updateField('lastName', event.target.value)} autoComplete="family-name" required />
          <TextField id="modal-signup-username" label="Username" fullRow value={values.username} onChange={(event) => updateField('username', event.target.value)} placeholder="Choose a unique username" autoComplete="username" required />
          <TextField id="modal-signup-organization" label="Organization" optional fullRow value={values.organization} onChange={(event) => updateField('organization', event.target.value)} placeholder="League, center, association, or event" autoComplete="organization" />
        </FormGrid>

        <CardDivider />
        <h3 className={styles.subsectionTitle}>Account security</h3>
        <FormGrid>
          <TextField id="modal-signup-email" label="Email" fullRow type="email" value={values.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" autoComplete="email" required />
          <PasswordField id="modal-signup-password" label="Password" value={values.password} onChange={(event) => updateField('password', event.target.value)} autoComplete="new-password" required />
          <PasswordField
            id="modal-signup-confirmPassword"
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
      </form>
    </Modal>
  );
}
