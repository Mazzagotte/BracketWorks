'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User } from 'lucide-react';
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthTokenResponse } from '@bracketworks/types';

import AuthShell from './AuthShell';
import ResetPasswordModal from './ResetPasswordModal';
import SignupModal from './SignupModal';
import styles from './SignInForm.module.css';
import { persistAuthSession } from './authSession';

type LoginResponse = Partial<AuthTokenResponse>;

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const loginDelayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loginFailed, setLoginFailed] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loginDelay, setLoginDelay] = useState(0);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const signupSuccess = useMemo(() => searchParams.get('signup') === 'success', [searchParams]);
  const verificationSuccess = useMemo(() => searchParams.get('verified') === 'success', [searchParams]);
  const sessionExpired = useMemo(() => searchParams.get('expired') === 'true', [searchParams]);
  const resetSuccess = useMemo(() => searchParams.get('reset') === 'success', [searchParams]);

  const clearLoginDelay = () => {
    if (loginDelayTimerRef.current) {
      clearInterval(loginDelayTimerRef.current);
      loginDelayTimerRef.current = null;
    }
    setLoginDelay(0);
  };

  const startLoginDelay = (seconds: number) => {
    clearLoginDelay();
    setLoginDelay(seconds);
    loginDelayTimerRef.current = setInterval(() => {
      setLoginDelay((prev) => {
        if (prev <= 1) {
          if (loginDelayTimerRef.current) {
            clearInterval(loginDelayTimerRef.current);
            loginDelayTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    usernameInputRef.current?.focus();
    return () => {
      if (loginDelayTimerRef.current) {
        clearInterval(loginDelayTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showPassword) return;
    const timer = window.setTimeout(() => {
      setShowPassword(false);
      setInfoMessage('Password hidden for security.');
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [showPassword]);

  const updateFieldValue = (value: string, setter: (value: string) => void) => {
    setter(value);
    if (error) setError('');
    if (infoMessage) setInfoMessage('');
    if (loginFailed) setLoginFailed(false);
  };

  const parseLoginError = (status: number, detail: string, nextFailedAttempts: number) => {
    const normalized = detail.toLowerCase();
    if (status === 429) {
      const retryMatch = normalized.match(/(\d+)\s*second/);
      const retryAfter = retryMatch ? Number.parseInt(retryMatch[1], 10) : 15;
      return {
        message: detail || 'Too many attempts. Please wait before trying again.',
        delaySeconds: retryAfter,
      };
    }

    if (status === 401 || status === 400) {
      if (nextFailedAttempts >= 3) {
        return {
          message: detail || 'Invalid username or password.',
          delaySeconds: Math.min(25, 5 + nextFailedAttempts * 2),
        };
      }
      return { message: detail || 'Invalid username or password.', delaySeconds: 0 };
    }

    return {
      message: detail || 'Unable to sign in right now. Please try again.',
      delaySeconds: 0,
    };
  };

  const handlePasswordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.getModifierState && event.getModifierState('CapsLock')) {
      setCapsLockOn(true);
    }
  };

  const handlePasswordKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.getModifierState && !event.getModifierState('CapsLock')) {
      setCapsLockOn(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loginDelay > 0) {
      setError(`Please wait ${loginDelay} seconds before trying again.`);
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');
    setLoginFailed(false);

    try {
      const response = await fetch('/api/v1/users/login-json', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          grant_type: 'password',
        }),
      });

      const data = (await response.json().catch(() => ({}))) as LoginResponse & { detail?: string };

      if (!response.ok) {
        const nextFailedAttempts = failedAttempts + 1;
        setFailedAttempts(nextFailedAttempts);
        const detail = typeof data.detail === 'string' ? data.detail : '';
        const parsed = parseLoginError(response.status, detail, nextFailedAttempts);

        if (parsed.delaySeconds > 0) {
          startLoginDelay(parsed.delaySeconds);
        }

        setError(
          nextFailedAttempts >= 3
            ? `${parsed.message} (Attempt ${nextFailedAttempts})`
            : parsed.message
        );
        setLoginFailed(true);
        return;
      }

      if (!data.access_token || typeof data.user_id !== 'number') {
        throw new Error('Login succeeded but response payload was incomplete.');
      }

      setFailedAttempts(0);
      clearLoginDelay();
      setCapsLockOn(false);
      setLoginFailed(false);

      persistAuthSession({
        accessToken: data.access_token,
        userId: data.user_id,
        firstName: data.first_name,
        isAdmin: data.is_admin,
        sessionId: data.session_id,
      });

      router.replace('/organizer');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to sign in.';
      setError(message);
      setLoginFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle="Sign in to access tournaments, registrations, and live event updates."
      showSwitchRow={false}
      showHeaderLogo={false}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {sessionExpired && (
          <p className={styles.infoMessage} role="status" aria-live="polite">
            Your session expired. Please log in again.
          </p>
        )}

        {verificationSuccess && (
          <p className={styles.successMessage} role="status" aria-live="polite">
            Email verified. You can log in now.
          </p>
        )}

        {resetSuccess && (
          <p className={styles.successMessage} role="status" aria-live="polite">
            Password reset complete. You can log in with your new password.
          </p>
        )}

        {signupSuccess && (
          <p className={styles.successMessage} role="status" aria-live="polite">
            Account created. Check your email for a verification message, then sign in.
          </p>
        )}

        {infoMessage && (
          <p className={styles.infoMessage} role="status" aria-live="polite">
            {infoMessage}
          </p>
        )}

        {error && (
          <p className={styles.errorBanner} role="alert" aria-live="polite">
            {error}
          </p>
        )}

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="login-username">Username or email</label>
          <User className={styles.inputIcon} aria-hidden="true" strokeWidth={1.8} />
          <input
            ref={usernameInputRef}
            id="login-username"
            className={`${styles.input} ${loginFailed ? styles.inputError : ''}`}
            type="text"
            value={username}
            onChange={(event) => updateFieldValue(event.target.value, setUsername)}
            autoComplete="username"
            placeholder="Enter username or email"
            required
          />
        </div>

        <div>
          <label className={styles.inputLabel} htmlFor="login-password">Password</label>
          <div className={styles.passwordField}>
            <Lock className={styles.inputIcon} aria-hidden="true" strokeWidth={1.8} />
            <input
              id="login-password"
              className={`${styles.input} ${capsLockOn ? styles.inputCapsLock : ''} ${loginFailed ? styles.inputError : ''}`}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => updateFieldValue(event.target.value, setPassword)}
              onKeyDown={handlePasswordKeyDown}
              onKeyUp={handlePasswordKeyUp}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {capsLockOn && (
          <p className={styles.capsLockWarning} role="status" aria-live="polite">
            Caps Lock is ON.
          </p>
        )}

        {loginDelay > 0 && (
          <p className={styles.delayWarning} role="status" aria-live="polite">
            Please wait {loginDelay} seconds before trying again.
          </p>
        )}

        {failedAttempts > 0 && loginDelay === 0 && (
          <p className={styles.attemptsInfo} role="status" aria-live="polite">
            {failedAttempts === 1 ? '1 failed attempt' : `${failedAttempts} failed attempts`}
          </p>
        )}

        <button type="submit" className={styles.loginBtn} disabled={loading}>
          {loading ? 'Signing in...' : 'Log In'} <span className={styles.btnArrow} aria-hidden="true">→</span>
        </button>

        <p className={styles.submitHelper}>One account. BracketWorks + Tournament Central.</p>

        <div className={styles.forgotRow}>
          <button type="button" onClick={() => setResetModalOpen(true)} className={styles.forgotLink} disabled={loading}>
            Forgot your password?
          </button>
        </div>

        <div className={styles.signupPrompt}>
          <span className={styles.signupPromptText}>New to Tournament Central?</span>
          <button type="button" onClick={() => setSignupModalOpen(true)} className={styles.signupPromptLink} disabled={loading}>
            Create a free account
          </button>
        </div>
      </form>

      <SignupModal
        isOpen={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        onSuccess={(message) => {
          setInfoMessage(message);
        }}
      />

      <ResetPasswordModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onSuccess={(message) => {
          setInfoMessage(message);
        }}
      />
    </AuthShell>
  );
}
