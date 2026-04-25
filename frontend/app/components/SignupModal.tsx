'use client';

import { useState, useEffect } from 'react';
import { API } from '../lib/api';
import { logger } from '../lib/logger';
import styles from './SignupModal.module.css';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SignupModal({ isOpen, onClose, onSuccess }: SignupModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [fieldValidation, setFieldValidation] = useState({
    firstName: false,
    lastName: false,
    username: false,
    email: false,
    password: false,
    confirmPassword: false
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (password) {
      setPasswordStrength(calculatePasswordStrength(password));
    } else {
      setPasswordStrength(0);
    }
  }, [password]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (username.trim().length >= 3) {
        checkUsernameAvailability(username);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [username]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFirstName(''); setLastName(''); setUsername('');
      setOrganization(''); setEmail(''); setPassword('');
      setConfirmPassword(''); setError('');
      setUsernameAvailable(null); setPasswordStrength(0);
      setShowPassword(false); setShowConfirmPassword(false);
      setShowPasswordRequirements(false);
      setFieldValidation({
        firstName: false, lastName: false, username: false,
        email: false, password: false, confirmPassword: false
      });
    }
  }, [isOpen]);

  const calculatePasswordStrength = (pw: string) => {
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 5);
  };

  const checkUsernameAvailability = async (un: string) => {
    if (un.length < 3) { setUsernameAvailable(null); return; }
    setCheckingUsername(true);
    try {
      const res = await fetch(API(`/api/v1/users/check-username?username=${encodeURIComponent(un)}`));
      const data = await res.json().catch(() => null);
      setUsernameAvailable(typeof data?.available === 'boolean' ? data.available : null);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'firstName':
      case 'lastName': return value.trim().length >= 2;
      case 'username': return value.trim().length >= 3 && /^[a-zA-Z0-9_]+$/.test(value);
      case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'password': return value.length >= 6;
      case 'confirmPassword': return value === password && value.length > 0;
      default: return false;
    }
  };

  const updateFieldValidation = (field: string, value: string) => {
    const isValid = validateField(field, value);
    setFieldValidation(prev => ({ ...prev, [field]: isValid }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    if (!username.trim()) { setError('Username is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (!password.trim()) { setError('Password is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address'); return; }

    setLoading(true);
    try {
      const res = await fetch(API('/api/v1/users/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim(),
          organization: organization.trim() || undefined,
          email: email.trim(),
          password
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Signup failed' }));
        let errorMessage = 'Signup failed';
        if (res.status === 409) errorMessage = 'Username or email already exists';
        else if (errorData.detail) errorMessage = errorData.detail;
        throw new Error(errorMessage);
      }

      logger.info('Signup successful', { username });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      logger.error('Signup error', { error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStrengthText = () => {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    return labels[passwordStrength] || '';
  };

  const getStrengthColor = () => {
    const colors = ['#D64545', '#D64545', '#f97316', '#F2A900', '#84cc16', '#2FBF71'];
    return colors[passwordStrength] || '#e5e7eb';
  };

  const inputClass = (valid: boolean, hasError?: boolean) =>
    `${styles.input} ${valid ? styles.inputValid : ''} ${hasError ? styles.inputError : ''}`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Create Account</h2>
          <p className={styles.subtitle}>Join BracketWorks today</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}

          {/* First Name / Last Name */}
          <div className={styles.nameRow}>
            <div className={styles.fieldRelative}>
              <label className={styles.label}>First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); updateFieldValidation('firstName', e.target.value); }}
                required
                className={`${inputClass(fieldValidation.firstName)} ${fieldValidation.firstName ? styles.inputWithIcon : ''}`}
              />
              {fieldValidation.firstName && <span className={styles.checkIcon}>&#10003;</span>}
            </div>
            <div className={styles.fieldRelative}>
              <label className={styles.label}>Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={e => { setLastName(e.target.value); updateFieldValidation('lastName', e.target.value); }}
                required
                className={`${inputClass(fieldValidation.lastName)} ${fieldValidation.lastName ? styles.inputWithIcon : ''}`}
              />
              {fieldValidation.lastName && <span className={styles.checkIcon}>&#10003;</span>}
            </div>
          </div>

          {/* Username */}
          <div className={styles.field}>
            <label className={styles.label}>Username *</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); updateFieldValidation('username', e.target.value); }}
              required
              className={`${styles.input} ${styles.inputWithIcon} ${
                usernameAvailable === false ? styles.inputError :
                usernameAvailable === true ? styles.inputValid : ''
              }`}
            />
            {checkingUsername && <span className={styles.checking}>...</span>}
            {usernameAvailable === true && !checkingUsername && (
              <span className={styles.checkIcon}>&#10003;</span>
            )}
            {usernameAvailable === false && !checkingUsername && (
              <div className={styles.fieldHint}>Username is taken</div>
            )}
          </div>

          {/* Organization */}
          <div className={styles.field}>
            <label className={styles.label}>Organization (optional)</label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              placeholder="Organization name"
              className={styles.input}
            />
          </div>

          {/* Email */}
          <div className={styles.field}>
            <label className={styles.label}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); updateFieldValidation('email', e.target.value); }}
              required
              className={`${inputClass(fieldValidation.email)} ${fieldValidation.email ? styles.inputWithIcon : ''}`}
            />
            {fieldValidation.email && <span className={styles.checkIcon}>&#10003;</span>}
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label className={styles.label}>Password *</label>
            <div className={styles.passwordWrap}>
              <input
                type={mounted && showPassword ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); updateFieldValidation('password', e.target.value); }}
                onFocus={() => setShowPasswordRequirements(true)}
                onBlur={() => setShowPasswordRequirements(false)}
                required
                placeholder="Min 6 characters"
                className={`${inputClass(fieldValidation.password)} ${styles.inputWithToggle}`}
              />
              {mounted && (
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-7-10-7a18.08 18.08 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 7 10 7a18.09 18.09 0 01-2.96 3.84M1 1l22 22"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                  {showPassword ? "Hide" : "Show"}
                </button>
              )}
            </div>

            {/* Strength meter */}
            {password && (
              <div className={styles.strengthMeter}>
                <div className={styles.strengthTrack}>
                  <div
                    className={`${styles.strengthFill} ${styles[`strength${passwordStrength}` as keyof typeof styles]}`}
                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                  />
                </div>
                <div className={`${styles.strengthLabel} ${styles[`strength${passwordStrength}` as keyof typeof styles]}`}>
                  {getStrengthText()}
                </div>
              </div>
            )}

            {/* Requirements tooltip */}
            {showPasswordRequirements && (
              <div className={styles.requirements}>
                <div className={styles.requirementsTitle}>Password requirements</div>
                <div className={styles.requirementsList}>
                  {[
                    { met: password.length >= 6, label: 'At least 6 characters' },
                    { met: /[a-z]/.test(password), label: 'Lowercase letter' },
                    { met: /[A-Z]/.test(password), label: 'Uppercase letter' },
                    { met: /[0-9]/.test(password), label: 'Number' },
                    { met: /[^A-Za-z0-9]/.test(password), label: 'Special character' },
                  ].map(r => (
                    <div key={r.label} className={r.met ? styles.requirementMet : styles.requirementUnmet}>
                      {r.met ? '\u2713' : '\u25CB'} {r.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className={styles.field}>
            <label className={styles.label}>Confirm Password *</label>
            <div className={styles.passwordWrap}>
              <input
                type={mounted && showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); updateFieldValidation('confirmPassword', e.target.value); }}
                required
                placeholder="Confirm your password"
                className={`${styles.input} ${styles.inputWithToggle} ${
                  confirmPassword && !fieldValidation.confirmPassword ? styles.inputError :
                  fieldValidation.confirmPassword ? styles.inputValid : ''
                }`}
              />
              {mounted && (
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-7-10-7a18.08 18.08 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 7 10 7a18.09 18.09 0 01-2.96 3.84M1 1l22 22"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              )}
            </div>
            {confirmPassword && !fieldValidation.confirmPassword && (
              <div className={styles.fieldHint}>Passwords don&apos;t match</div>
            )}
          </div>

          {/* Buttons */}
          <div className={styles.buttons}>
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
