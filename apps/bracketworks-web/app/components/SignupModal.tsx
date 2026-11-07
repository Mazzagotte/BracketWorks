'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, CardDivider, FormGrid, Modal, Notice, PasswordField, TextField } from '@bracketworks/ui';

import BWAuthShell from './BWAuthShell';
import PasswordStrengthPanel from './PasswordStrengthPanel';
import { useSignupForm } from '../hooks/useSignupForm';
import { getSignupValidationError, submitSignup } from '../lib/auth/signup';
import { logger } from '../lib/logger';
import styles from './SignupModal.module.css';

interface SignupModalProps {
  mode?: 'modal' | 'page';
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (message: string) => void;
}

const FORM_ID = 'signup-form';
const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];

/** Create an account: the /signup page (inside BWAuthShell) or a dialog opened from login. */
export default function SignupModal({ mode = 'modal', isOpen = false, onClose, onSuccess }: SignupModalProps) {
  const router = useRouter();
  const isPageMode = mode === 'page';
  const idPrefix = isPageMode ? 'signup' : 'modal-signup';
  const successCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const {
    checkingUsername,
    isFormReady,
    passwordRequirementChecks,
    passwordStrength,
    resetForm,
    showPasswordRequirements,
    updateValue,
    usernameAvailable,
    values: { confirmPassword, email, firstName, lastName, organization, password, username },
  } = useSignupForm();

  // Reset ephemeral state only when the modal version closes.
  useEffect(() => {
    if (!isPageMode && !isOpen) {
      if (successCloseTimerRef.current) {
        clearTimeout(successCloseTimerRef.current);
        successCloseTimerRef.current = null;
      }
      resetForm();
      setError('');
      setSignupSuccess(false);
    }
  }, [isOpen, isPageMode, resetForm]);

  useEffect(() => {
    return () => {
      if (successCloseTimerRef.current) {
        clearTimeout(successCloseTimerRef.current);
      }
    };
  }, []);

  const clearTransientFeedback = () => {
    if (error) setError('');
    if (signupSuccess) setSignupSuccess(false);
  };

  const handleChange = (field: Parameters<typeof updateValue>[0]) => (event: React.ChangeEvent<HTMLInputElement>) => {
    clearTransientFeedback();
    updateValue(field, event.target.value);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = getSignupValidationError({
      firstName,
      lastName,
      username,
      organization,
      email,
      password,
      confirmPassword,
      usernameAvailable,
      checkingUsername,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!isFormReady) {
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    try {
      const { successMessage } = await submitSignup({
        firstName,
        lastName,
        username,
        organization,
        email,
        password,
      });

      logger.info('Signup successful', { username });
      setError('');
      setSignupSuccess(true);
      successCloseTimerRef.current = setTimeout(() => {
        onSuccess?.(successMessage);
        if (isPageMode) {
          router.push('/login?signup=success');
          return;
        }
        onClose?.();
      }, 650);
    } catch (err: unknown) {
      logger.error('Signup error', { error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  const strengthTone = useMemo(() => {
    if (passwordStrength <= 1) return 'weak';
    if (passwordStrength === 2) return 'fair';
    if (passwordStrength === 3) return 'good';
    return 'strong';
  }, [passwordStrength]);
  const passwordStrengthPercent = Math.max(passwordStrength * 20, 8);

  const usernameError = usernameAvailable === false && !checkingUsername ? 'Username is taken' : undefined;
  const usernameHelper = checkingUsername
    ? 'Checking availability...'
    : 'Choose a unique username. Do not use your email address.';
  const submitLabel = loading ? 'Creating account...' : 'Create account';
  const submitDisabled = loading || !isFormReady;

  if (!isPageMode && !isOpen) return null;

  const form = (
    <form id={FORM_ID} onSubmit={handleSignup} className={styles.form}>
      {signupSuccess ? (
        <Notice tone="success" role="status">
          Account created. Check your email for your welcome message and verification link. Redirecting to login...
        </Notice>
      ) : null}
      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

      <h3 className={styles.subsectionTitle}>Your information</h3>
      <FormGrid>
        <TextField
          id={`${idPrefix}-firstName`}
          label="First name"
          value={firstName}
          onChange={handleChange('firstName')}
          autoComplete="given-name"
          required
        />
        <TextField
          id={`${idPrefix}-lastName`}
          label="Last name"
          value={lastName}
          onChange={handleChange('lastName')}
          autoComplete="family-name"
          required
        />
        <TextField
          id={`${idPrefix}-username`}
          label="Username"
          fullRow
          value={username}
          onChange={handleChange('username')}
          placeholder="Choose a unique username"
          autoComplete="username"
          helper={usernameHelper}
          error={usernameError}
          required
        />
        <TextField
          id={`${idPrefix}-organization`}
          label="Organization"
          optional
          fullRow
          value={organization}
          onChange={handleChange('organization')}
          placeholder="League, center, association, or event name"
          helper="Bowling center, league, association, or event name."
          autoComplete="organization"
        />
      </FormGrid>

      <CardDivider />
      <h3 className={styles.subsectionTitle}>Account security</h3>
      <FormGrid>
        <TextField
          id={`${idPrefix}-email`}
          label="Email address"
          fullRow
          type="email"
          value={email}
          onChange={handleChange('email')}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <PasswordField
          id={`${idPrefix}-password`}
          label="Password"
          value={password}
          onChange={handleChange('password')}
          autoComplete="new-password"
          required
        />
        <PasswordField
          id={`${idPrefix}-confirmPassword`}
          label="Confirm password"
          showLabel="Show confirm password"
          hideLabelText="Hide confirm password"
          value={confirmPassword}
          onChange={handleChange('confirmPassword')}
          autoComplete="new-password"
          required
        />
      </FormGrid>

      {showPasswordRequirements ? (
        <PasswordStrengthPanel
          strengthText={STRENGTH_LABELS[passwordStrength] || ''}
          strengthPercent={passwordStrengthPercent}
          tone={strengthTone}
          requirements={[
            { met: passwordRequirementChecks.minLength, label: 'At least 8 characters with a number or symbol.' },
            { met: passwordRequirementChecks.lower, label: 'Lowercase letter' },
            { met: passwordRequirementChecks.upper, label: 'Uppercase letter' },
            { met: passwordRequirementChecks.number, label: 'Number' },
            { met: passwordRequirementChecks.special, label: 'Special character' },
          ]}
        />
      ) : null}
      {!showPasswordRequirements && password ? (
        <p className={styles.helper}>Use at least 8 characters with a number or symbol.</p>
      ) : null}

      {isPageMode ? (
        <Button type="submit" variant="primary" fullWidth disabled={submitDisabled}>{submitLabel}</Button>
      ) : null}

      <p className={styles.helper}>
        By creating an account, you agree to our <Link href="/terms">Terms of service</Link> and{' '}
        <Link href="/privacy">Privacy policy</Link>.
      </p>
    </form>
  );

  if (isPageMode) {
    return (
      <BWAuthShell
        title="Create your account"
        subtitle="Create your account to build brackets, manage side pots, and publish live results."
        switchRow={<>Already have an account? <Link href="/login">Log in</Link></>}
      >
        {form}
      </BWAuthShell>
    );
  }

  return (
    <Modal
      open={isOpen}
      onClose={() => onClose?.()}
      title="Create your account"
      description="Create your account to build brackets, manage side pots, and publish live results."
      size="md"
      closeLabel="Close signup modal"
      closeOnBackdrop={false}
      footer={(
        <>
          <Button variant="secondary" onClick={() => onClose?.()}>Cancel</Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={submitDisabled}>{submitLabel}</Button>
        </>
      )}
    >
      {form}
    </Modal>
  );
}
