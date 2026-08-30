"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BarChart3, ClipboardList, GitFork, Lock, User } from "lucide-react";

import styles from "./login.module.css";

import { API } from "../lib/api";
import { LoadingButton } from "../components/LoadingComponents";
import { useToast } from "../components/Toast";
import { useLoginSecurity } from "../hooks/useLoginSecurity";
import { useAuth } from "../lib/auth-context";
import { logger } from "../lib/logger";
import FeatureIconCard from "../components/FeatureIconCard";
import SignupModal from "../components/SignupModal";
import ResetPasswordModal from "../components/ResetPasswordModal";
import PasswordVisibilityToggle from "../components/PasswordVisibilityToggle";
import ResetSuccessModal from "../components/ResetSuccessModal";
import { useAuthModals } from "../hooks/useAuthModals";
import { useAuthQueryParams } from "../hooks/useAuthQueryParams";
import { useResetSuccessCountdown } from "../hooks/useResetSuccessCountdown";
import { parseLoginError, parseNetworkError, getLoginErrorDuration } from "../lib/auth/login-error-handler";
import DevNoticeModal from "../components/DevNoticeModal";

const TOURNAMENT_CENTRAL_URL = 'https://tournamentcentral.app/login';

const featureCards = [
  {
    icon: ClipboardList,
    label: 'Organize Your Tournament',
    title: 'Organize Your Tournament',
    description: 'Manage entries, squads, divisions, formats, and bowler information.',
  },
  {
    icon: GitFork,
    label: 'Run Brackets & Side Pots',
    title: 'Run Brackets & Side Pots',
    description: 'Generate brackets, track participation, advance winners, and calculate payouts.',
  },
  {
    icon: BarChart3,
    label: 'Publish Live Results',
    title: 'Publish Live Results',
    description: 'Enter scores and share standings, brackets, and tournament updates in real time.',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { authenticateUser } = useAuth();
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [devNoticeOpen, setDevNoticeOpen] = useState(false);
  const [devNoticeVersion, setDevNoticeVersion] = useState('1.0');

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
        const version = typeof data.dev_notice_version === 'string' ? data.dev_notice_version : '1.0';
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
    <div className={styles.page}>
      <DevNoticeModal
        isOpen={devNoticeOpen}
        mode="require-acceptance"
        noticeVersion={devNoticeVersion}
        onAccepted={() => {
          localStorage.setItem('dev_notice_version_accepted', devNoticeVersion);
          setDevNoticeOpen(false);
          router.push('/dashboard');
        }}
        onLogout={() => { setDevNoticeOpen(false); router.push('/login'); }}
      />
      <ResetSuccessModal
        isOpen={modals.resetSuccess}
        countdown={resetSuccessCountdown}
        onDismiss={dismissResetSuccessModal}
      />

      <div className={styles.shell}>
        <section className={styles.brandPanel}>
          <div className={styles.brandTop}>
            <Image
              src="/BW Banner.svg"
              alt="BracketWorks"
              width={520}
              height={120}
              className={styles.bannerImage}
              priority
            />
          </div>

          <h2 className={styles.brandHeadline}>
            Run Your Tournament<br />
            Without the <span className={styles.brandHeadlineOrange}>Spreadsheet Chaos.</span>
          </h2>

          <p className={styles.brandDescription}>
            Manage entries, brackets, side pots, scores, standings,
            and payouts from one organized workspace.
          </p>

          <ul className={styles.featureList}>
            {featureCards.map(({ icon, label, title, description }) => (
              <li key={label} className={styles.featureItem}>
                <FeatureIconCard icon={icon} label={label} />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.ecosystemCallout}>
            <span className={styles.ecosystemLabel}>Part of the Connected Tournament Platform</span>
            <div className={styles.ecosystemRow}>
              <Image
                src="/TC_logo_No_Text.svg"
                alt=""
                width={40}
                height={40}
                unoptimized
                className={styles.ecosystemLogo}
              />
              <span className={styles.ecosystemText}>
                Looking for a tournament?{' '}
                <a href={TOURNAMENT_CENTRAL_URL} className={styles.ecosystemLink}>
                  Find tournaments and register →
                </a>
              </span>
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${loading ? styles.loading : ''}`}>

          {queryParams.sessionExpired && (
            <div className={styles.sessionExpiredBanner}>
              Your session expired. Please log in again.
            </div>

          )}

          {queryParams.signupSuccess && (
            <div className={styles.infoBanner} role="status" aria-live="polite">
              Account created. Check your email for your welcome message and verification link.
            </div>
          )}

          {queryParams.verificationSuccess && (
            <div className={styles.successBanner} role="status" aria-live="polite">
              Email verified. You can log in now.
            </div>
          )}

          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Welcome back</h1>
            <p className={styles.cardSubtitle}>Log in to manage your tournaments and live results.</p>
          </div>

          <form id="login-form" onSubmit={handleLogin} className={styles.form}>
            {error && (
              <div className={styles.errorBanner} role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="login-username" className={styles.inputLabel}>Username or email</label>
              <User className={styles.inputIcon} aria-hidden="true" strokeWidth={1.8} />
              <input
                ref={usernameInputRef}
                type="text"
                id="login-username"
                name="username"
                aria-label="Email or Username"
                placeholder="Enter username or email"
                value={username}
                onChange={e => updateFieldValue(e.target.value, setUsername)}
                autoComplete="username"
                autoFocus
                required
                className={`${styles.input} ${loginFailed ? styles.inputError : ''}`}
              />
            </div>

            <div>
              <label htmlFor="login-password" className={styles.inputLabel}>Password</label>
              <div className={styles.passwordField}>
                <Lock className={styles.inputIcon} aria-hidden="true" strokeWidth={1.8} />
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  name="password"
                  aria-label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => updateFieldValue(e.target.value, setPassword)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  autoComplete="current-password"
                  required
                  className={`${styles.input} ${capsLockOn ? styles.inputCapsLock : ''} ${loginFailed ? styles.inputError : ''}`}
                />
                <PasswordVisibilityToggle
                  isVisible={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  disabled={loading}
                />
              </div>
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
              Log In <span className={styles.btnArrow} aria-hidden="true">→</span>
            </LoadingButton>
            <p className={styles.submitHelper}>One account. BracketWorks + Tournament Central.</p>
          </form>

          <div className={styles.forgotRow}>
            <button
              type="button"
              onClick={() => openModal('resetPassword')}
              className={styles.forgotLink}
              disabled={loading}
            >
              Forgot your password?
            </button>
          </div>

          <div className={styles.signupPrompt}>
            <span className={styles.signupPromptText}>New to BracketWorks?</span>
            <button
              type="button"
              onClick={() => openModal('signup')}
              className={styles.signupPromptLink}
              disabled={loading}
            >
              Create a free account
            </button>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} BracketWorks + Tournament Central. All rights reserved.
      </footer>

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
    </div>
  );
}
