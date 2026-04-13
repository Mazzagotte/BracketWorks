"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import "../styles/bowling-animations.css";
import styles from "./login.module.css";

import { API } from "../lib/api";
import { LoadingButton } from "../components/LoadingComponents";
import { useToast } from "../components/Toast";
import { ErrorMessage } from "../components/ErrorHandling";
import { AccessibleInput } from "../components/Accessibility";
import { useAuth } from "../lib/auth-context";
import { logger } from "../lib/logger";
import SignupModal from "../components/SignupModal";
import ResetPasswordModal from "../components/ResetPasswordModal";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showButtonBall, setShowButtonBall] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);

  // Security enhancements
  const [passwordVisibilityTimer, setPasswordVisibilityTimer] = useState<NodeJS.Timeout | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loginDelay, setLoginDelay] = useState(0);

  const { addToast } = useToast();

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
    logger.info('Login page loaded');
  }, []);

  // Password visibility timeout - auto-hide after 5 seconds
  useEffect(() => {
    if (showPassword) {
      if (passwordVisibilityTimer) {
        clearTimeout(passwordVisibilityTimer);
      }
      const timer = setTimeout(() => {
        setShowPassword(false);
        addToast({ type: 'info', message: 'Password hidden for security', duration: 2000 });
      }, 5000);
      setPasswordVisibilityTimer(timer);
    } else {
      if (passwordVisibilityTimer) {
        clearTimeout(passwordVisibilityTimer);
        setPasswordVisibilityTimer(null);
      }
    }
    return () => {
      if (passwordVisibilityTimer) {
        clearTimeout(passwordVisibilityTimer);
      }
    };
  }, [showPassword, addToast, passwordVisibilityTimer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleLogin = async (e: React.FormEvent) => {
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
    setLoading(true);
    setShowButtonBall(true);

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
          setLoginDelay(delaySeconds);
          errorMessage += ` Please wait ${delaySeconds} seconds before trying again.`;
          const timer = setInterval(() => {
            setLoginDelay(prev => {
              if (prev <= 1) { clearInterval(timer); return 0; }
              return prev - 1;
            });
          }, 1000);
        }

        if (newFailedAttempts >= 3) {
          addToast({ type: 'error', message: `${errorMessage} (Attempt ${newFailedAttempts})`, duration: 8000 });
        } else {
          addToast({ type: 'error', message: errorMessage, duration: 6000 });
        }

        setError(errorMessage);
        setShowButtonBall(false);
        return;
      }

      // Success
      setFailedAttempts(0);
      setLoginDelay(0);

      const displayName = data.first_name || username;

      login(data.access_token, data.user_id, { name: data.first_name });

      if (data.first_name) {
        localStorage.setItem('first_name', data.first_name);
      }

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
      setShowButtonBall(false);
      logger.error('Login failed', { error: error?.message, username });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${loading ? styles.loading : ''}`}>
        {/* Header */}
        <div className={styles.logoWrap}>
          <Image
            src="/logo.png"
            alt="BracketWorks Logo"
            width={56}
            height={56}
            style={{ borderRadius: '12px' }}
          />
        </div>
        <h1 className={styles.title}>BracketWorks</h1>
        <div className={styles.subtitle}>Bowling Brackets & Side Pots</div>

        {/* Form */}
        <form id="login-form" onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <AccessibleInput
              type="text"
              id="login-username"
              name="username"
              label="Username"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.passwordWrap}>
            <AccessibleInput
              type={showPassword ? "text" : "password"}
              id="login-password"
              name="password"
              label="Password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              autoComplete="current-password"
              required
              className={`${styles.input} ${capsLockOn ? styles.inputCapsLock : ''}`}
              style={mounted ? { paddingRight: '52px' } : undefined}
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
            {capsLockOn && mounted && (
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
            {showButtonBall && <div className={`buttonBowlingBall ${styles.bowlingBall}`} />}
            Login
          </LoadingButton>
        </form>

        {error && (
          <div className={styles.errorWrap}>
            <ErrorMessage
              error={error}
              type="error"
              onRetry={() => {
                setError("");
                setPassword("");
                document.getElementById('login-username')?.focus();
              }}
              onDismiss={() => setError("")}
              retryLabel="Try Again"
            />
          </div>
        )}

        {/* Divider */}
        <div className={styles.divider}>or</div>

        {/* Secondary Actions */}
        <div className={styles.actions}>
          <button
            onClick={() => setShowSignupModal(true)}
            className={styles.createAccountBtn}
          >
            Create Account
          </button>
          <button
            onClick={() => setShowResetPasswordModal(true)}
            className={styles.forgotLink}
          >
            Forgot Password?
          </button>
        </div>
      </div>

      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSuccess={() => {
          setShowSignupModal(false);
          addToast({ type: 'success', message: 'Account created successfully! Please log in.', duration: 4000 });
        }}
      />

      <ResetPasswordModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        onSuccess={() => {
          setShowResetPasswordModal(false);
          addToast({ type: 'success', message: 'Password reset link sent! Check your email.', duration: 4000 });
        }}
      />
    </div>
  );
}
