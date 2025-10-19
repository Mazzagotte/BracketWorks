"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { API } from "../lib/api";
import "../styles/bowling-animations.css";
import { LoadingButton, Spinner } from "../components/LoadingComponents";
import { useToast } from "../components/Toast";
import { ErrorMessage } from "../components/ErrorHandling";
import { AccessibleInput } from "../components/Accessibility";
import { useAuth } from "../lib/auth-context";
import { logger } from "../lib/logger";

export default function LoginPage() {
  const { login, clearAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showButtonBall, setShowButtonBall] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Security enhancements
  const [passwordVisibilityTimer, setPasswordVisibilityTimer] = useState<NodeJS.Timeout | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loginDelay, setLoginDelay] = useState(0);
  
  // Enhanced UX hooks
  const { addToast } = useToast();

  useEffect(() => {
    // Set mounted after a small delay to ensure hydration is complete
    setTimeout(() => setMounted(true), 100);
    
    // Log for debugging
    logger.info('Login page loaded');
  }, []);

  // Password visibility timeout - auto-hide after 5 seconds
  useEffect(() => {
    if (showPassword) {
      // Clear existing timer
      if (passwordVisibilityTimer) {
        clearTimeout(passwordVisibilityTimer);
      }
      
      // Set new timer to hide password after 5 seconds
      const timer = setTimeout(() => {
        setShowPassword(false);
        addToast({
          type: 'info',
          message: 'Password hidden for security',
          duration: 2000
        });
      }, 5000);
      
      setPasswordVisibilityTimer(timer);
    } else {
      // Clear timer when password is manually hidden
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

  // Caps lock detection
  const handleKeyDown = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if we're in a delay period
    if (loginDelay > 0) {
      addToast({
        type: 'warning',
        message: `Please wait ${loginDelay} seconds before trying again`,
        duration: 3000
      });
      return;
    }
    
    // Basic validation
    if (!username.trim() || !password.trim()) {
      addToast({
        type: 'warning',
        message: 'Please enter both username and password',
        duration: 4000
      });
      return;
    }
    
    setError("");
    setSuccess("");
    setLoading(true);
    setShowButtonBall(true);
    
    // Clean JSON-based login request
    const loginData = {
      username: username.trim(),
      password: password.trim(),
      grant_type: "password"
    };
    
    try {
      const res = await fetch(API("/api/v1/users/login"), {
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
        // Increment failed attempts and implement progressive delay
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        let errorMessage = 'Login failed';
        let delaySeconds = 0;
        
        if (res.status === 401) {
          errorMessage = 'Invalid username or password';
          // Progressive delays: 2s, 5s, 10s, 15s, then 30s
          if (newFailedAttempts >= 2) {
            delaySeconds = Math.min(30, Math.pow(2, newFailedAttempts - 1) + (newFailedAttempts > 3 ? 10 : 0));
          }
        } else if (res.status === 429) {
          errorMessage = 'Too many login attempts. Please try again later.';
          delaySeconds = 60;
        } else if (data.detail) {
          errorMessage = data.detail;
        }
        
        // Set delay if needed
        if (delaySeconds > 0) {
          setLoginDelay(delaySeconds);
          errorMessage += ` Please wait ${delaySeconds} seconds before trying again.`;
          
          // Countdown timer
          const timer = setInterval(() => {
            setLoginDelay(prev => {
              if (prev <= 1) {
                clearInterval(timer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        
        // Enhanced error messaging based on attempt count
        if (newFailedAttempts >= 3) {
          addToast({
            type: 'error',
            message: `${errorMessage} (Attempt ${newFailedAttempts})`,
            duration: 8000
          });
        } else {
          addToast({
            type: 'error',
            message: errorMessage,
            duration: 6000
          });
        }
        
        setError(errorMessage);
        setShowButtonBall(false);
        return;
      }
      
      // Success - reset failed attempts
      setFailedAttempts(0);
      setLoginDelay(0);
      
      // Success
      const displayName = data.first_name || username;
      setSuccess(`Welcome back, ${displayName}!`);
      
      addToast({
        type: 'success',
        message: `Welcome back, ${displayName}!`,
        duration: 3000
      });
      
      // Store user data using auth context
      login(data.access_token, data.user_id, {
        name: data.first_name
      });
      
      if (data.first_name) {
        localStorage.setItem('first_name', data.first_name);
      }
      
      logger.userAction('User logged in', { userId: data.user_id, name: displayName });
      
      setShowButtonBall(false);
      
      // Smooth redirect with better UX
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      
    } catch (err: any) {
      const errorMsg = `Network error: ${err?.message || 'Please check your connection'}`;
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
        duration: 6000
      });
      setShowButtonBall(false);
      logger.error('Login failed', { error: err?.message, username });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="login-page-container"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#434955',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        overflow: 'auto',
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif'
      }}
    >
      <div 
        className="enhanced-card"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '400px',
          padding: '48px 32px',
          background: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          textAlign: 'center'
        }}
      >
        <div className="header-section" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="logo-container" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            margin: '0 auto 24px auto',
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(240, 165, 0, 0.1) 0%, rgba(240, 165, 0, 0.05) 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(240, 165, 0, 0.15)'
          }}>
            <Image 
              src="/logo.png" 
              alt="BracketWorks Logo" 
              width={72} 
              height={72} 
              style={{ borderRadius: '16px' }}
            />
          </div>
          <h1 className="login-title" style={{
            fontSize: '32px',
            fontWeight: 700,
            margin: '0 0 12px 0',
            background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 25%, #4a5568 50%, #f0a500 75%, #ff9800 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px',
            lineHeight: 1.2
          }}>BracketWorks</h1>
          <div className="login-subtitle" style={{
            color: '#6b7280',
            fontSize: '16px',
            fontWeight: 500,
            margin: '0 0 32px 0',
            lineHeight: 1.5
          }}>Bowling Brackets & Side Pots</div>
        </div>
        <form id="login-form" onSubmit={handleLogin} className="login-form" style={{ marginTop: 0, textAlign: 'left' }}>
          <div className="input-container" style={{ marginBottom: '24px', position: 'relative' }}>
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
              style={{
                width: '100%',
                height: '48px',
                padding: '0 16px',
                fontSize: '16px',
                fontWeight: 400,
                border: '2px solid #d1d5db',
                borderRadius: '12px',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxShadow: 'none',
                letterSpacing: '0.3px',
                boxSizing: 'border-box',
                fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                color: '#374151'
              }}
            />
          </div>
          <div className="password-container" style={{ marginBottom: '24px', position: 'relative' }}>
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
              style={{
                width: '100%',
                height: '48px',
                padding: '0 16px',
                paddingRight: mounted ? '48px' : '16px',
                fontSize: '16px',
                fontWeight: 400,
                border: capsLockOn ? '2px solid #ef4444' : '2px solid #d1d5db',
                borderRadius: '12px',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxShadow: 'none',
                letterSpacing: '0.3px',
                boxSizing: 'border-box',
                fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                color: '#374151'
              }}
            />
            {mounted && (
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  marginTop: '12px', // Account for label space
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#6b7280',
                  transition: 'all 0.2s ease',
                  zIndex: 10
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            )}
            {/* Caps Lock Warning */}
            {capsLockOn && mounted && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                right: '0',
                marginTop: '4px',
                padding: '8px 12px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 20
              }}>
                <span>⚠️</span>
                <span>Caps Lock is ON</span>
              </div>
            )}
          </div>
          {/* Login Delay Warning */}
          {loginDelay > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              fontSize: '14px',
              color: '#dc2626',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span>🔒</span>
              <span>Please wait {loginDelay} seconds before trying again</span>
            </div>
          )}
          {/* Failed Attempts Info */}
          {failedAttempts > 0 && loginDelay === 0 && (
            <div style={{
              marginTop: '16px',
              padding: '8px 12px',
              background: '#fffbeb',
              border: '1px solid #fed7aa',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#ea580c',
              textAlign: 'center'
            }}>
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
            style={{
              width: '100%',
              height: '48px',
              marginTop: '24px',
              padding: '0 24px',
              fontSize: '16px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              color: '#ffffff',
              background: loginDelay > 0 ? '#9ca3af' : '#f0a500',
              border: 'none',
              borderRadius: '12px',
              cursor: loginDelay > 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
              fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
              opacity: loginDelay > 0 ? 0.6 : 1
            }}
          >
            {/* Button Bowling Ball Animation */}
            {showButtonBall && (
              <div className="buttonBowlingBall" style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2
              }}></div>
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
                setPassword(""); // Clear password for security
                document.getElementById('login-username')?.focus();
              }}
              onDismiss={() => setError("")}
              retryLabel="Try Again"
            />
          </div>
        )}
        {success && <div className="success-message" style={{
          marginTop: '20px',
          padding: '16px 20px',
          background: '#10b981',
          color: 'white',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: 600,
          textAlign: 'center'
        }}>
          🎉 {success}
        </div>}
        <div className="links-container" style={{
          marginTop: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'center'
        }}>
          <a href="/signup" className="signup-link" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            borderRadius: '12px',
            transition: 'all 0.2s ease',
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
            color: '#6b7280',
            background: '#f9fafb',
            border: '1px solid #e5e7eb'
          }}>
            Create Account
          </a>
          <a href="/reset-password/request" className="forgot-link" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            borderRadius: '12px',
            transition: 'all 0.2s ease',
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
            color: '#f0a500',
            background: 'rgba(240, 165, 0, 0.08)',
            border: '1px solid rgba(240, 165, 0, 0.2)'
          }}>
            Forgot Password?
          </a>
        </div>
      </div>
    </div>
  );
}
