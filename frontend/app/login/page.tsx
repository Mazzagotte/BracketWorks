"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import styles from "./login.module.css";

import { API } from "../lib/api";
import { LoadingButton } from "../components/LoadingComponents";
import { useToast } from "../components/Toast";
import { useLoginSecurity } from "../hooks/useLoginSecurity";
import { useAuth } from "../lib/auth-context";
import { logger } from "../lib/logger";
import SignupModal from "../components/SignupModal";
import ResetPasswordModal from "../components/ResetPasswordModal";

export default function LoginPage() {
  const router = useRouter();
  const { authenticateUser } = useAuth();
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showResetSuccessModal, setShowResetSuccessModal] = useState(false);
  const [resetSuccessCountdown, setResetSuccessCountdown] = useState(10);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [signupSuccessNotice, setSignupSuccessNotice] = useState(false);
  const [verificationSuccessNotice, setVerificationSuccessNotice] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);

  const { addToast } = useToast();
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

    // Check if redirected here due to session expiry
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setSessionExpired(true);
    }

    if (params.get('signup') === 'success') {
      setSignupSuccessNotice(true);
    }

    if (params.get('verified') === 'success') {
      setVerificationSuccessNotice(true);
    }

    if (params.get('reset') === 'success') {
      setShowResetSuccessModal(true);
      setResetSuccessCountdown(10);
    }

    // Pre-fill last used username
    const lastUsername = localStorage.getItem('last_username');
    if (lastUsername) setUsername(lastUsername);

    usernameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!showResetSuccessModal) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setResetSuccessCountdown(previous => {
        if (previous <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [showResetSuccessModal]);

  const dismissResetSuccessModal = () => {
    setShowResetSuccessModal(false);
    setResetSuccessCountdown(10);

    const params = new URLSearchParams(window.location.search);
    params.delete('reset');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  };

  useEffect(() => {
    if (showResetSuccessModal || resetSuccessCountdown !== 0) {
      return;
    }

    dismissResetSuccessModal();
  }, [resetSuccessCountdown, showResetSuccessModal]);

  const updateUsername = (value: string) => {
    setUsername(value);
    if (error) setError('');
    if (loginFailed) setLoginFailed(false);
  };

  const updatePassword = (value: string) => {
    setPassword(value);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      logger.debug('Login response received', { userId: data.user_id });

      if (!res.ok) {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        let errorMessage = 'Login failed';
        let delaySeconds = 0;

        if (res.status === 401) {
          errorMessage = 'Invalid username or password';
          if (newFailedAttempts >= 2) {
            delaySeconds = Math.min(30, Math.pow(2, newFailedAttempts - 1) + (newFailedAttempts > 3 ? 10 : 0));
          }
        } else if (res.status === 429) {
          errorMessage = 'Too many login attempts. Please try again later.';
          delaySeconds = 60;
        } else if (data.detail) {
          errorMessage = data.detail;
        }

        if (delaySeconds > 0) {
          startLoginDelay(delaySeconds);
          errorMessage += ` Please wait ${delaySeconds} seconds before trying again.`;
        }

        if (newFailedAttempts >= 3) {
          addToast({ type: 'error', message: `${errorMessage} (Attempt ${newFailedAttempts})`, duration: 8000 });
        } else {
          addToast({ type: 'error', message: errorMessage, duration: 6000 });
        }

        setError(errorMessage);
        setLoginFailed(true);
        return;
      }

      // Success
      setFailedAttempts(0);
      clearLoginDelay();
      setLoginFailed(false);
      setError('');
      localStorage.setItem('last_username', username.trim());

      const displayName = data.first_name || username;

      authenticateUser(data.access_token, data.user_id, {
        name: data.first_name,
        isAdmin: Boolean(data.is_admin),
      }, {
        refreshToken: data.refresh_token,
        sessionId: data.session_id,
      });

      if (data.first_name) {
        localStorage.setItem('first_name', data.first_name);
      }
      localStorage.setItem('is_admin', data.is_admin ? 'true' : 'false');

      logger.userAction('User logged in', { userId: data.user_id, name: displayName });

      window.dispatchEvent(new Event('auth-state-changed'));
      window.dispatchEvent(new Event('storage'));

      addToast({ type: 'success', message: `Welcome back, ${displayName}!`, duration: 3000 });
      router.push('/dashboard');

    } catch (err: unknown) {
      const error = err as Error;
      const errorMsg = `Network error: ${error?.message || 'Please check your connection'}`;
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg, duration: 6000 });
      logger.error('Login failed', { error: error?.message, username });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {showResetSuccessModal ? (
        <div className={styles.successModalOverlay} role="presentation">
          <div
            className={`${styles.successModalCard} surface-card surface-modalShell`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reset-success-title"
          >
            <div className={styles.successModalHeader}>
              <h2 id="password-reset-success-title" className={styles.successModalTitle}>Password Updated</h2>
              <p className={styles.successModalText}>
                Your password has been reset successfully. You can log in now with your new password.
              </p>
            </div>
            <div className={styles.successModalCountdown}>
              This message closes in {resetSuccessCountdown}s.
            </div>
            <button
              type="button"
              className={`${styles.successModalButton} surface-authButton surface-authButtonPrimary`}
              onClick={dismissResetSuccessModal}
            >
              Continue to Login
            </button>
          </div>
        </div>
      ) : null}

      <div className={`${styles.card} ${loading ? styles.loading : ''}`}>
        {/* Header */}
        <div className={styles.logoWrap}>
          <Image
            src="/logo.svg"
            alt="BracketWorks Logo"
            width={220}
            height={220}
            className={styles.logoImage}
            priority
          />
        </div>

        {sessionExpired && (
          <div className={styles.sessionExpiredBanner}>
            Your session expired. Please log in again.
          </div>
        )}

        {signupSuccessNotice && (
          <div className={styles.infoBanner} role="status" aria-live="polite">
            Account created. Check your email for your welcome message and verification link.
          </div>
        )}

        {verificationSuccessNotice && (
          <div className={styles.successBanner} role="status" aria-live="polite">
            Email verified. You can log in now.
          </div>
        )}

        {/* Form */}
        <form id="login-form" onSubmit={handleLogin} className={styles.form}>
          <div className={styles.formIntro}>
            Log in to BracketWorks
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div className={styles.inputGroup}>
            <input
              ref={usernameInputRef}
              type="text"
              id="login-username"
              name="username"
              aria-label="Username"
              placeholder="Username"
              value={username}
              onChange={e => updateUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className={`${styles.input} ${loginFailed ? styles.inputError : ''}`}
            />
          </div>

          <div className={styles.passwordWrap}>
            <input
              type={showPassword ? "text" : "password"}
              id="login-password"
              name="password"
              aria-label="Password"
              placeholder="Password"
              value={password}
              onChange={e => updatePassword(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              autoComplete="current-password"
              required
              className={`${styles.input} ${capsLockOn ? styles.inputCapsLock : ''} ${loginFailed ? styles.inputError : ''}`}
            />
            <button
              type="button"
              className={`${styles.passwordToggle} surface-authPasswordToggle`}
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
              {showPassword ? 'Hide Password' : 'Show Password'}
            </button>
            {capsLockOn && (
              <div className={styles.capsLockWarning}>
                <span>Caps Lock is ON</span>
              </div>
            )}
          </div>

          {loginDelay > 0 && (
            <div className={styles.delayWarning}>
              Please wait {loginDelay} seconds before trying again
            </div>
          )}

          {failedAttempts > 0 && loginDelay === 0 && (
            <div className={styles.attemptsInfo}>
              {failedAttempts === 1 ? '1 failed attempt' : `${failedAttempts} failed attempts`}
            </div>
          )}

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Logging in..."
            className={styles.loginBtn}
            disabled={loginDelay > 0}
            aria-label={loading ? 'Logging in, please wait' : 'Log in to your account'}
          >
            Login
          </LoadingButton>
        </form>

        {/* Divider */}
        <div className={styles.divider}>or</div>

        {/* Secondary Actions */}
        <div className={styles.actions}>
          <button
            onClick={() => setShowSignupModal(true)}
            className={styles.createAccountBtn}
            disabled={loading}
          >
            Create Account
          </button>
          <button
            onClick={() => setShowResetPasswordModal(true)}
            className={styles.forgotLink}
            disabled={loading}
          >
            Forgot Password?
          </button>
        </div>
      </div>

      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSuccess={(message) => {
          setShowSignupModal(false);
          addToast({ type: 'success', message, duration: 5000 });
          setSignupSuccessNotice(true);
        }}
      />

      <ResetPasswordModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        onSuccess={() => {
          addToast({ type: 'success', message: 'If an account exists for this email, a password reset link has been sent.', duration: 4000 });
        }}
      />
    </div>
  );
}
