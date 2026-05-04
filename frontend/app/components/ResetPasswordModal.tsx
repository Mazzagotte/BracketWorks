'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../lib/api';
import { logger } from '../lib/logger';
import CloseControl from '../../components/CloseControl';
import styles from './ResetPasswordModal.module.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ResetPasswordModal({ isOpen, onClose, onSuccess }: ResetPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => emailRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const validateEmail = useCallback((value: string): string => {
    if (!value.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
    return '';
  }, []);

  const handleChange = (value: string) => {
    setEmail(value);
    if (fieldError && value.trim()) setFieldError('');
    if (touched) setFieldError(validateEmail(value));
  };

  const handleBlur = (value: string) => {
    setTouched(true);
    setFieldError(validateEmail(value));
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setFieldError('');
    setTouched(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailError = validateEmail(email);
    setFieldError(emailError);
    setTouched(true);

    if (emailError) {
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API('/api/v1/users/request-password-reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Failed to send reset code' }));
        let errorMessage = 'Failed to send reset code';
        if (res.status === 404) {
          errorMessage = 'Email address not found';
          setFieldError('Email not found');
        } else if (res.status === 429) {
          errorMessage = 'Too many requests. Please try again later.';
        } else if (data.detail) {
          errorMessage = data.detail;
        }
        setError(errorMessage);
        emailRef.current?.focus();
        return;
      }

      logger.info('Password reset requested', { email });
      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please check your connection';
      setError(`Network error: ${msg}`);
      logger.error('Password reset error', { error: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isValid = touched && !fieldError && email.trim();

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <CloseControl onClick={handleClose} position="absolute" size="sm" label="Close reset password modal" disabled={loading} />
        <div className={styles.header}>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>Enter your email to receive a reset code</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label}>Email Address *</label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => handleChange(e.target.value)}
              onBlur={e => handleBlur(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              className={`${styles.input} ${
                fieldError ? styles.inputError :
                isValid ? styles.inputValid : ''
              }`}
            />
            {fieldError && <div className={styles.fieldHint}>{fieldError}</div>}
            {isValid && <div className={`${styles.fieldHint} ${styles.fieldHintValid}`}>Valid email format</div>}
          </div>

          <div className={styles.buttons}>
            <button
              type="submit"
              disabled={loading || !!fieldError || !email.trim()}
              className={styles.submitBtn}
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
            <button type="button" onClick={handleClose} disabled={loading} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
