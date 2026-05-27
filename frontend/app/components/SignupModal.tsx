'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  SignupConfirmPasswordFieldSection,
  SignupNameFieldsSection,
  SignupPasswordFieldSection,
  SignupUsernameFieldSection,
} from './SignupFieldSections';
import AuthFeedback from './AuthFeedback';
import PasswordStrengthPanel from './PasswordStrengthPanel';
import { useSignupForm } from '../hooks/useSignupForm';
import { getSignupValidationError, submitSignup } from '../lib/auth/signup';
import { logger } from '../lib/logger';
import CloseControl from '../../components/CloseControl';
import styles from './SignupModal.module.css';

interface SignupModalProps {
  mode?: 'modal' | 'page';
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (message: string) => void;
}

export default function SignupModal({ mode = 'modal', isOpen = false, onClose, onSuccess }: SignupModalProps) {
  const router = useRouter();
  const isPageMode = mode === 'page';
  const shouldRender = isPageMode || isOpen;
  const successCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const {
    checkingUsername,
    fieldValidity,
    isFormReady,
    mounted,
    passwordRequirementChecks,
    passwordStrength,
    resetForm,
    setShowConfirmPassword,
    setShowPassword,
    setShowPasswordRequirements,
    showConfirmPassword,
    showPassword,
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

  const getStrengthText = () => {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    return labels[passwordStrength] || '';
  };
  const strengthTone = useMemo(() => {
    if (passwordStrength <= 1) return 'weak';
    if (passwordStrength === 2) return 'fair';
    if (passwordStrength === 3) return 'good';
    return 'strong';
  }, [passwordStrength]);
  const passwordStrengthPercent = Math.max(passwordStrength * 20, 8);

  const inputClass = (valid: boolean, hasError?: boolean) =>
    `surface-authInput ${valid ? 'surface-authInputValid' : ''} ${hasError ? 'surface-authInputError' : ''}`;

  const handleLoginIntent = () => {
    if (isPageMode) {
      router.push('/login');
      return;
    }
    onClose?.();
  };

  if (!shouldRender) return null;

  return (
    <div className={isPageMode ? styles.pageShell : styles.overlay}>
      <div className={`surface-card surface-modalShell ${styles.modal} ${isPageMode ? styles.pageCard : ''}`}>
        {!isPageMode && (
          <CloseControl onClick={onClose || (() => undefined)} position="absolute" size="sm" label="Close signup modal" disabled={false} className={styles.closeBtn} />
        )}
        {/* Header */}
        <div className={`surface-cardHeader ${styles.header}`}>
          <div className={styles.brandRow}>
            <Image
              src="/logo_no_text.svg"
              alt="BracketWorks logo"
              width={34}
              height={34}
              className={styles.logoMark}
              priority
            />
            <h2 className={styles.title}>Create Account</h2>
          </div>
          <p className={styles.subtitle}>Join BracketWorks today</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className={styles.body}>
          <AuthFeedback
            success={signupSuccess ? 'Account created. Check your email for your welcome message and verification link. Redirecting to login...' : ''}
            error={error}
          />

          <SignupNameFieldsSection
            containerClassName={styles.nameRow}
            fieldClassName={styles.fieldRelative}
            labelClassName="surface-authLabel"
            firstName={{
              label: 'First Name *',
              value: firstName,
              onChange: value => {
                clearTransientFeedback();
                updateValue('firstName', value);
              },
              inputClassName: inputClass(fieldValidity.firstName),
              validBadge: null,
            }}
            lastName={{
              label: 'Last Name *',
              value: lastName,
              onChange: value => {
                clearTransientFeedback();
                updateValue('lastName', value);
              },
              inputClassName: inputClass(fieldValidity.lastName),
              validBadge: null,
            }}
          />

          <SignupUsernameFieldSection
            containerClassName={styles.field}
            labelClassName="surface-authLabel"
            value={username}
            onChange={value => {
              clearTransientFeedback();
              updateValue('username', value);
            }}
            checking={checkingUsername}
            availability={usernameAvailable}
            inputClassName={`surface-authInput ${styles.inputWithIcon} ${
              usernameAvailable === false ? 'surface-authInputError' :
              usernameAvailable === true ? 'surface-authInputValid' : ''
            }`}
            checkingIndicator={<span className={`${styles.checking} surface-authValidationBadgePending`}>Checking</span>}
            availableIndicator={null}
            takenIndicator={usernameAvailable === false && !checkingUsername ? <div className="surface-authHint">Username is taken</div> : null}
          />
          {usernameAvailable === true && !checkingUsername && (
            <div className="surface-authHint surface-authHintSuccess">Username available</div>
          )}
          {usernameAvailable === null && !checkingUsername && (
            <p className={styles.fieldHint}>Use a unique name - not your email address</p>
          )}

          {/* Organization */}
          <div className={styles.field}>
            <label className="surface-authLabel">Organization (optional)</label>
            <input
              type="text"
              value={organization}
              onChange={e => {
                clearTransientFeedback();
                updateValue('organization', e.target.value);
              }}
              placeholder="Organization name"
              className="surface-authInput"
            />
          </div>

          {/* Email */}
          <div className={styles.field}>
            <label className="surface-authLabel">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => {
                clearTransientFeedback();
                updateValue('email', e.target.value);
              }}
              required
              className={inputClass(fieldValidity.email)}
            />
          </div>

          <SignupPasswordFieldSection
            containerClassName={styles.field}
            labelClassName="surface-authLabel"
            wrapperClassName={styles.passwordWrap}
            inputClassName={`${inputClass(fieldValidity.password)} ${styles.inputWithToggle}`}
            value={password}
            onChange={value => {
              clearTransientFeedback();
              updateValue('password', value);
            }}
            mounted={mounted}
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword(!showPassword)}
            onFocus={() => setShowPasswordRequirements(true)}
            onBlur={() => setShowPasswordRequirements(false)}
            showRequirements={showPasswordRequirements}
            passwordStrength={passwordStrength}
            passwordRequirementChecks={passwordRequirementChecks}
            toggleButton={
              <button
                type="button"
                className={`${styles.passwordToggle} surface-authPasswordToggle`}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-7-10-7a18.08 18.08 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 7 10 7a18.09 18.09 0 01-2.96 3.84M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
            strengthMeter={
              <PasswordStrengthPanel
                strengthText={getStrengthText()}
                strengthPercent={passwordStrengthPercent}
                tone={strengthTone}
                requirements={[
                  { met: passwordRequirementChecks.minLength, label: 'At least 6 characters' },
                  { met: passwordRequirementChecks.lower, label: 'Lowercase letter' },
                  { met: passwordRequirementChecks.upper, label: 'Uppercase letter' },
                  { met: passwordRequirementChecks.number, label: 'Number' },
                  { met: passwordRequirementChecks.special, label: 'Special character' },
                ]}
              />
            }
            requirementsPanel={null}
            placeholder="Min 6 characters"
          />

          <SignupConfirmPasswordFieldSection
            containerClassName={styles.field}
            labelClassName="surface-authLabel"
            wrapperClassName={styles.passwordWrap}
            inputClassName={`surface-authInput ${styles.inputWithToggle} ${
              confirmPassword && !fieldValidity.confirmPassword ? 'surface-authInputError' :
              fieldValidity.confirmPassword ? 'surface-authInputValid' : ''
            }`}
            value={confirmPassword}
            onChange={value => {
              clearTransientFeedback();
              updateValue('confirmPassword', value);
            }}
            mounted={mounted}
            showPassword={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
            toggleButton={
              <button
                type="button"
                className={`${styles.passwordToggle} surface-authPasswordToggle`}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-7-10-7a18.08 18.08 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 7 10 7a18.09 18.09 0 01-2.96 3.84M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            }
            validIndicator={fieldValidity.confirmPassword ? <div className="surface-authHint surface-authHintSuccess">Passwords match</div> : null}
            invalidIndicator={confirmPassword && !fieldValidity.confirmPassword ? <div className="surface-authHint">Passwords don&apos;t match</div> : null}
            placeholder="Confirm your password"
          />

          {/* Buttons */}
          <div className={styles.buttons}>
            <button type="submit" disabled={loading || !isFormReady} className={`surface-authButton surface-authButtonPrimary ${styles.submitBtn}`}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
          <p className={styles.loginPrompt}>
            Already have an account?{' '}
            <button type="button" onClick={handleLoginIntent} className={styles.loginLink}>
              Log in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}