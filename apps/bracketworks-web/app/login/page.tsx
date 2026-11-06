"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice, PasswordField, TextField } from "@bracketworks/ui";

import styles from "./login.module.css";

import { API } from "../lib/api";
import { useToast } from "../components/Toast";
import { useLoginSecurity } from "../hooks/useLoginSecurity";
import { useAuth } from "../lib/auth-context";
import { logger } from "../lib/logger";
import BWAuthShell from "../components/BWAuthShell";
import SignupModal from "../components/SignupModal";
import ResetPasswordModal from "../components/ResetPasswordModal";
import ResetSuccessModal from "../components/ResetSuccessModal";
import { useAuthModals } from "../hooks/useAuthModals";
import { useAuthQueryParams } from "../hooks/useAuthQueryParams";
import { useResetSuccessCountdown } from "../hooks/useResetSuccessCountdown";
import { parseLoginError, parseNetworkError, getLoginErrorDuration } from "../lib/auth/login-error-handler";
import DevNoticeModal from "../components/DevNoticeModal";


export default function LoginPage() {
  const router = useRouter();
  const { authenticateUser, logoutUser } = useAuth();
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [devNoticeOpen, setDevNoticeOpen] = useState(false);
  const [devNoticeVersion, setDevNoticeVersion] = useState('1.1');

  const { addToast } = useToast();
  const { modals, openModal, closeModal } = useAuthModals();
  const queryParams = useAuthQueryParams();
  const { countdown: resetSuccessCountdown, reset: resetCountdown } = useResetSuccessCountdown(modals.resetSuccess);

  const {
    capsLockOn,
    clearLoginDelay,
    failedAttempts,
    handleKeyDown,
    handleKeyUp,
    loginDelay,
    setFailedAttempts,
    setShowPassword,
    showPassword,
    startLoginDelay,
  } = useLoginSecurity({
    passwordAutoHideMs: 5000,
    onPasswordAutoHide: () => {
      addToast({ type: 'info', message: 'Password hidden for security', duration: 2000 });
    },
  });

  useEffect(() => {
    logger.info('Login page loaded');

    // Pre-fill last used username
    const lastUsername = localStorage.getItem('last_username');
    if (lastUsername) setUsername(lastUsername);

    usernameInputRef.current?.focus();

  }, []);

  useEffect(() => {
    if (queryParams.resetSuccess) {
      openModal('resetSuccess');
      resetCountdown();
    }
  }, [openModal, queryParams.resetSuccess, resetCountdown]);

  const dismissResetSuccessModal = useCallback(() => {
    closeModal('resetSuccess');
    const params = new URLSearchParams(window.location.search);
    params.delete('reset');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [closeModal]);

  useEffect(() => {
    if (!modals.resetSuccess || resetSuccessCountdown !== 0) {
      return;
    }

    dismissResetSuccessModal();
  }, [dismissResetSuccessModal, resetSuccessCountdown, modals.resetSuccess]);

  const updateFieldValue = (value: string, setter: (value: string) => void) => {
    setter(value);
    if (error) setError('');
    if (loginFailed) setLoginFailed(false);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (loginDelay > 0) {
      addToast({ type: 'warning', message: `Please wait ${loginDelay} seconds before trying again`, duration: 3000 });
      return;
    }

    if (!username.trim() || !password.trim()) {
      addToast({ type: 'warning', message: 'Please enter both username and password', duration: 4000 });
      return;
    }

    setError("");
    setLoginFailed(false);
    setLoading(true);

    const loginData = {
      username: username.trim(),
      password: password.trim(),
      grant_type: "password"
    };

    try {
      const res = await fetch(API("/api/v1/users/login-json"), {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      logger.debug('Login response received', { userId: data.user_id });

      if (!res.ok) {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        const backendDetail = typeof data?.detail === 'string' ? data.detail.trim() : '';
        const { message: errorMessage, delaySeconds } = parseLoginError(res.status, backendDetail, newFailedAttempts);

        if (delaySeconds > 0) {
          startLoginDelay(delaySeconds);
        }

        const displayMessage = newFailedAttempts >= 3
          ? `${errorMessage} (Attempt ${newFailedAttempts})`
          : errorMessage;
        const duration = getLoginErrorDuration(newFailedAttempts);

        addToast({ type: 'error', message: displayMessage, duration });
        setError(errorMessage);
        setLoginFailed(true);
        return;
      }

      const accessToken = typeof data.access_token === 'string' ? data.access_token : null;
      const userId =
        typeof data.user_id === 'string'
          ? data.user_id
          : typeof data.user_id === 'number'
            ? String(data.user_id)
            : null;

      // Success
      if (!accessToken || !userId) {
        addToast({ type: 'error', message: 'Login failed: unexpected server response.', duration: 6000 });
        setError('Unexpected server response.');
        setLoginFailed(true);
        return;
      }

      setFailedAttempts(0);
      clearLoginDelay();
      setLoginFailed(false);
      setError('');
      localStorage.setItem('last_username', username.trim());

      const firstName = typeof data.first_name === 'string' ? data.first_name : undefined;
      const displayName = firstName || username;

      authenticateUser(accessToken, userId, {
        name: firstName,
        isAdmin: Boolean(data.is_admin),
      }, {
        sessionId: typeof data.session_id === 'string' ? data.session_id : undefined,
      });

      if (firstName) {
        localStorage.setItem('first_name', firstName);
      }
      localStorage.setItem('is_admin', data.is_admin ? 'true' : 'false');

      logger.userAction('User logged in', { userId, name: displayName });

      window.dispatchEvent(new Event('auth-state-changed'));

      addToast({ type: 'success', message: `Welcome back, ${displayName}!`, duration: 3000 });

      const noticeRequired = Boolean(data.dev_notice_required);
      if (noticeRequired) {
        const version = typeof data.dev_notice_version === 'string' ? data.dev_notice_version : '1.1';
        setDevNoticeVersion(version);
        setDevNoticeOpen(true);
      } else {
        router.push('/dashboard');
      }

    } catch (err: unknown) {
      const errorMsg = parseNetworkError(err);
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg, duration: 6000 });
      logger.error('Login failed', { error: err instanceof Error ? err.message : 'unknown', username });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DevNoticeModal
        isOpen={devNoticeOpen}
        mode="require-acceptance"
        noticeVersion={devNoticeVersion}
        onAccepted={() => {
          setDevNoticeOpen(false);
          router.push('/dashboard');
        }}
        onLogout={() => {
          setDevNoticeOpen(false);
          logoutUser({ fastRedirect: true });
          router.push('/login');
        }}
      />
      <ResetSuccessModal
        isOpen={modals.resetSuccess}
        countdown={resetSuccessCountdown}
        onDismiss={dismissResetSuccessModal}
      />

      <BWAuthShell
        title="Welcome back"
        subtitle="Log in to manage your tournaments and live results."
        switchRow={(
          <>
            New to BracketWorks?{' '}
            <button type="button" onClick={() => openModal('signup')} disabled={loading}>Create a free account</button>
          </>
        )}
      >
        {queryParams.sessionExpired ? <Notice tone="warning">Your session expired. Please log in again.</Notice> : null}
        {queryParams.signupSuccess ? (
          <Notice tone="info" role="status">Account created. Check your email for your welcome message and verification link.</Notice>
        ) : null}
        {queryParams.verificationSuccess ? <Notice tone="success" role="status">Email verified. You can log in now.</Notice> : null}

        <form id="login-form" onSubmit={handleLogin} className={styles.form} aria-busy={loading || undefined}>
          {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

          <TextField
            ref={usernameInputRef}
            id="login-username"
            name="username"
            label="Username or email"
            value={username}
            onChange={e => updateFieldValue(e.target.value, setUsername)}
            autoComplete="username"
            autoFocus
            required
          />

          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            value={password}
            onChange={e => updateFieldValue(e.target.value, setPassword)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            autoComplete="current-password"
            required
            helper={capsLockOn ? 'Caps Lock is on.' : undefined}
          />

          {loginDelay > 0 ? (
            <p className={styles.status} role="status">Please wait {loginDelay} seconds before trying again.</p>
          ) : failedAttempts > 0 ? (
            <p className={styles.status}>{failedAttempts === 1 ? '1 failed attempt' : `${failedAttempts} failed attempts`}</p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={loading || loginDelay > 0}
            aria-label={loading ? 'Logging in, please wait' : undefined}
          >
            {loading ? 'Logging in...' : 'Log in'}
          </Button>
          <p className={styles.helper}>One account for BracketWorks and Tournament Central.</p>
          <div className={styles.forgot}>
            <Button variant="ghost" size="sm" onClick={() => openModal('resetPassword')} disabled={loading}>Forgot your password?</Button>
          </div>
        </form>
      </BWAuthShell>

      <SignupModal
        isOpen={modals.signup}
        onClose={() => closeModal('signup')}
        onSuccess={(message) => {
          closeModal('signup');
          addToast({ type: 'success', message, duration: 5000 });
        }}
      />

      <ResetPasswordModal
        isOpen={modals.resetPassword}
        onClose={() => closeModal('resetPassword')}
        onSuccess={() => {
          addToast({ type: 'success', message: 'If an account exists for this email, a password reset link has been sent.', duration: 4000 });
        }}
      />
    </>
  );
}
