"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import "../styles/bowling-animations.css";
import "../styles/login.css";

import { API } from "../lib/api";
import { LoadingButton } from "../components/LoadingComponents";
import { useToast } from "../components/Toast";
import { ErrorMessage } from "../components/ErrorHandling";
import { AccessibleInput } from "../components/Accessibility";
import { useAuth } from "../lib/auth-context";
import { logger } from "../lib/logger";
import SignupModal from "../components/SignupModal";
import ResetPasswordModal from "../components/ResetPasswordModal";

const EyeOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeClosedIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

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

  const [capsLockOn, setCapsLockOn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loginDelay, setLoginDelay] = useState(0);

  // Ref avoids re-render loop from timer stored in state
  const passwordVisibilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
    logger.info('Login page loaded');
  }, []);

  // Auto-hide password after 5 seconds
  useEffect(() => {
    if (passwordVisibilityTimer.current) {
      clearTimeout(passwordVisibilityTimer.current);
      passwordVisibilityTimer.current = null;
    }

    if (showPassword) {
      passwordVisibilityTimer.current = setTimeout(() => {
        setShowPassword(false);
        addToast({ type: 'info', message: 'Password hidden for security', duration: 2000 });
      }, 5000);
    }

    return () => {
      if (passwordVisibilityTimer.current) {
        clearTimeout(passwordVisibilityTimer.current);
      }
    };
  }, [showPassword, addToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => setCapsLockOn(e.getModifierState('CapsLock'));
  const handleKeyUp = (e: React.KeyboardEvent) => setCapsLockOn(e.getModifierState('CapsLock'));

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

    try {
      const res = await fetch(API("/api/v1/users/login-json"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim(), grant_type: "password" }),
      });

      const text = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: Record<string, any>;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      logger.debug('Login response received', { status: res.status });

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
          errorMessage = String(data.detail);
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

        addToast({
          type: 'error',
          message: newFailedAttempts >= 3 ? `${errorMessage} (Attempt ${newFailedAttempts})` : errorMessage,
          duration: newFailedAttempts >= 3 ? 8000 : 6000,
        });

        setError(errorMessage);
        setShowButtonBall(false);
        return;
      }

      setFailedAttempts(0);
      setLoginDelay(0);

      const displayName = String(data.first_name || username);
      login(String(data.access_token), String(data.user_id), { name: String(data.first_name || '') });

      if (data.first_name) {
        localStorage.setItem('first_name', String(data.first_name));
      }

      logger.userAction('User logged in', { userId: data.user_id, name: displayName });
      window.dispatchEvent(new Event('auth-state-changed'));

      addToast({ type: 'success', message: `Welcome back, ${displayName}!`, duration: 3000 });
      router.push('/dashboard');

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please check your connection';
      const errorMsg = `Network error: ${msg}`;
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg, duration: 6000 });
      setShowButtonBall(false);
      logger.error('Login failed', { error: msg, username });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="enhanced-card">

        <div className="header-section">
          <div className="logo-container">
            <Image
              src="/logo.png"
              alt="BracketWorks Logo"
              width={56}
              height={56}
              style={{ borderRadius: '12px' }}
            />
          </div>
          <h1 className="login-title">BracketWorks</h1>
          <div className="login-subtitle">Bowling Brackets &amp; Side Pots</div>
        </div>

        <form id="login-form" onSubmit={handleLogin} className="login-form">
          <div className="input-container">
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
              className="login-input"
            />
          </div>

          <div className="password-container">
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
              className="password-input"
            />
            {mounted && (
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            )}
            {capsLockOn && mounted && (
              <div className="caps-lock-warning">
                <span aria-hidden="true">⚠</span>
                <span>Caps Lock is ON</span>
              </div>
            )}
          </div>

          {loginDelay > 0 && (
            <div className="login-delay-warning">
              ⏱ Please wait {loginDelay}s before trying again
            </div>
          )}

          {failedAttempts > 0 && loginDelay === 0 && (
            <div className="failed-attempts-info">
              {failedAttempts === 1 ? '1 failed attempt' : `${failedAttempts} failed attempts`}
            </div>
          )}

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Logging in..."
            className="login-button"
            disabled={loginDelay > 0}
            aria-label={loading ? 'Logging in, please wait' : 'Log in to your account'}
          >
            {showButtonBall && (
              <div
                className="buttonBowlingBall"
                style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}
              />
            )}
            Login
          </LoadingButton>
        </form>

        {error && (
          <div className="error-container">
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

        <div className="links-container">
          <button
            type="button"
            onClick={() => setShowSignupModal(true)}
            className="signup-link"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => setShowResetPasswordModal(true)}
            className="forgot-link"
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
          addToast({ type: 'success', message: 'Account created! Please log in.', duration: 4000 });
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
