'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button, CardDivider, Notice, PasswordField, TextField } from '@bracketworks/ui';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthTokenResponse } from '@bracketworks/types';

import AuthShell from './AuthShell';
import ResetPasswordModal from './ResetPasswordModal';
import SignupModal from './SignupModal';
import styles from './authForm.module.css';
import { safeNextPath } from './authRetry';
import { persistAuthSession } from './authSession';

type LoginResponse = Partial<AuthTokenResponse>;

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const loginDelayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  const hidePasswordNotice = useCallback(() => setInfoMessage('Password hidden for security.'), []);

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

      // Back to the page the organizer was on when their session expired, if any.
      router.replace(safeNextPath(searchParams.get('next')));
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
      title="Sign in"
      subtitle="Sign in to manage your tournaments, registrations, and live event updates."
      showSwitchRow={false}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {sessionExpired ? <Notice tone="info" role="status">Your session expired. Please sign in again.</Notice> : null}
        {verificationSuccess ? <Notice tone="success" role="status">Email verified. You can sign in now.</Notice> : null}
        {resetSuccess ? <Notice tone="success" role="status">Password reset complete. You can sign in with your new password.</Notice> : null}
        {signupSuccess ? <Notice tone="success" role="status">Account created. Check your email for a verification message, then sign in.</Notice> : null}
        {infoMessage ? <Notice tone="info" role="status">{infoMessage}</Notice> : null}
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

        <TextField
          ref={usernameInputRef}
          id="login-username"
          label="Username or email"
          value={username}
          onChange={(event) => updateFieldValue(event.target.value, setUsername)}
          autoComplete="username"
          placeholder="Enter your username or email"
          aria-invalid={loginFailed || undefined}
          required
        />

        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(event) => updateFieldValue(event.target.value, setPassword)}
          onKeyDown={handlePasswordKeyDown}
          onKeyUp={handlePasswordKeyUp}
          autoComplete="current-password"
          placeholder="Enter your password"
          aria-invalid={loginFailed || undefined}
          helper={capsLockOn ? 'Caps Lock is on.' : undefined}
          autoHideAfterMs={5000}
          onAutoHide={hidePasswordNotice}
          required
        />

        {loginDelay > 0 ? <Notice tone="warning" role="status">Please wait {loginDelay} seconds before trying again.</Notice> : null}
        {failedAttempts > 0 && loginDelay === 0 ? (
          <p className={styles.helper} role="status">{failedAttempts === 1 ? '1 failed attempt' : `${failedAttempts} failed attempts`}</p>
        ) : null}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? 'Signing in...' : 'Log in'}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setResetModalOpen(true)} disabled={loading}>
            Forgot your password?
          </Button>
        </div>

        <p className={styles.helper}>One account for BracketWorks and Tournament Central.</p>

        <CardDivider />
        <p className={styles.center}>New to Tournament Central?</p>
        <Button variant="accent-outline" fullWidth onClick={() => setSignupModalOpen(true)} disabled={loading}>
          Create a free account
        </Button>
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
