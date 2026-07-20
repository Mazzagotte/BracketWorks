'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import AuthFeedback from './AuthFeedback';
import PasswordStrengthPanel from './PasswordStrengthPanel';
import PasswordVisibilityToggle from './PasswordVisibilityToggle';
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
          <div className={styles.headerContent}>
            <Image
              src="/BW Logo No Text.png"
              alt="BracketWorks"
              width={40}
              height={40}
              className={styles.logoIcon}
              priority
            />
            <div>
              <h2 className={styles.title}>Create your account</h2>
              <p className={styles.subtitle}>Create your account to build brackets, manage side pots, and publish live results.</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className={styles.body}>
          <AuthFeedback
            success={signupSuccess ? 'Account created. Check your email for your welcome message and verification link. Redirecting to login...' : ''}
            error={error}
          />

          {/* Your Information Section */}
          <h3 className={styles.sectionHeader}>YOUR INFORMATION</h3>

          {/* Name Fields - Two Columns */}
          <div className={styles.nameRow}>
            <div className={styles.field}>
              <label className="surface-authLabel">First name *</label>
              <div className={styles.inputWrapper}>
                <svg className={styles.fieldIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                </svg>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => {
                    clearTransientFeedback();
                    updateValue('firstName', e.target.value);
                  }}
                  placeholder="First name"
                  required
                  className={inputClass(fieldValidity.firstName)}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className="surface-authLabel">Last name *</label>
              <div className={styles.inputWrapper}>
                <svg className={styles.fieldIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                </svg>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => {
                    clearTransientFeedback();
                    updateValue('lastName', e.target.value);
                  }}
                  placeholder="Last name"
                  required
                  className={inputClass(fieldValidity.lastName)}
                />
              </div>
            </div>
          </div>

          {/* Username */}
          <div className={styles.field}>
            <label className="surface-authLabel">Username *</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.fieldIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
              </svg>
              <input
                type="text"
                value={username}
                onChange={e => {
                  clearTransientFeedback();
                  updateValue('username', e.target.value);
                }}
                placeholder="Choose a unique username"
                className={`${inputClass(
                  usernameAvailable === true ? true : usernameAvailable === false ? false : fieldValidity.username
                )}`}
              />
            </div>
            <p className={styles.fieldHint}>Choose a unique username. Do not use your email address.</p>
            {usernameAvailable === false && !checkingUsername && (
              <div className="surface-authHint">Username is taken</div>
            )}
            {checkingUsername && (
              <div className={`${styles.checking} surface-authValidationBadgePending`}>Checking</div>
            )}
          </div>

          {/* Organization */}
          <div className={styles.field}>
            <label className="surface-authLabel">Organization (optional)</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.fieldIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M9 21h6M9 17h6M9 13h6"></path>
              </svg>
              <input
                type="text"
                value={organization}
                onChange={e => {
                  clearTransientFeedback();
                  updateValue('organization', e.target.value);
                }}
                placeholder="League, center, association, or event name"
              />
            </div>
            <p className={styles.fieldHint}>Optional — bowling center, league, association, or event name.</p>
          </div>

          {/* Account Security Section */}
          <h3 className={styles.sectionHeader}>ACCOUNT SECURITY</h3>

          {/* Email */}
          <div className={styles.field}>
            <label className="surface-authLabel">Email address *</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.fieldIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
              <input
                type="email"
                value={email}
                onChange={e => {
                  clearTransientFeedback();
                  updateValue('email', e.target.value);
                }}
                placeholder="you@example.com"
                required
                className={inputClass(fieldValidity.email)}
              />
            </div>
          </div>

          {/* Password Fields - Two Columns */}
          <div className={styles.passwordRow}>
            <div className={styles.field}>
              <label className="surface-authLabel">Password *</label>
              <div className={styles.passwordField}>
                <div className={styles.inputWrapper}>
                  <svg className={styles.fieldIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      clearTransientFeedback();
                      updateValue('password', e.target.value);
                    }}
                    placeholder="Enter your password"
                    required
                    className={inputClass(fieldValidity.password)}
                  />
                </div>
                <PasswordVisibilityToggle
                  isVisible={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  showText={false}
                  variant="compact"
                  disabled={loading}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className="surface-authLabel">Confirm password *</label>
              <div className={styles.passwordField}>
                <div className={styles.inputWrapper}>
                  <svg className={styles.fieldIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => {
                      clearTransientFeedback();
                      updateValue('confirmPassword', e.target.value);
                    }}
                    placeholder="Confirm your password"
                    required
                    className={`${inputClass(fieldValidity.confirmPassword)}`}
                  />
                </div>
                <PasswordVisibilityToggle
                  isVisible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                  showText={false}
                  variant="compact"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Password Requirements and Strength */}
          {showPasswordRequirements && (
            <div className={styles.passwordRequirements}>
              <PasswordStrengthPanel
                strengthText={getStrengthText()}
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
            </div>
          )}
          {!showPasswordRequirements && password && (
            <p className={styles.fieldHint}>Use at least 8 characters with a number or symbol.</p>
          )}

          {/* Button */}
          <button type="submit" disabled={loading || !isFormReady} className={`surface-authButton surface-authButtonPrimary ${styles.submitBtn}`}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>

          {/* Footer */}
          <div className={styles.footer}>
            <p className={styles.tosText}>
              By creating an account, you agree to our{' '}
              <a href="/terms" className={styles.tosLink}>Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className={styles.tosLink}>Privacy Policy</a>.
            </p>
            <div className={styles.divider}>OR</div>
            <p className={styles.loginPrompt}>
              Already have an account?{' '}
              <button type="button" onClick={handleLoginIntent} className={styles.loginLink}>
                Log in
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}