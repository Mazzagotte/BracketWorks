"use client";

import { useState, useEffect } from "react";

import Image from "next/image";

import "../styles/signup.css";
import "../styles/validation.css";

import { API } from "../lib/api";
import { getErrorMessage } from "../lib/error-utils";






export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

  // Enhanced UX hooks
  // Simple toast replacement
  const addToast = (toast: { message: string; type?: string; duration?: number }) => {
    // Could implement toast UI here if needed
  };

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Password strength effect
  useEffect(() => {
    if (password) {
      const strength = calculatePasswordStrength(password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(0);
    }
  }, [password]);

  // Username availability effect
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (username.trim().length >= 3) {
        checkUsernameAvailability(username);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [username]);

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.length >= 10) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return Math.min(strength, 5);
  };

  // Username availability check
  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const res = await fetch(API(`/api/v1/users/check-username?username=${encodeURIComponent(username)}`));
      setUsernameAvailable(res.ok);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Real-time field validation
  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'firstName':
      case 'lastName':
        return value.trim().length >= 2;
      case 'username':
        return value.trim().length >= 3 && /^[a-zA-Z0-9_]+$/.test(value);
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'password':
        return value.length >= 6;
      case 'confirmPassword':
        return value === password;
      default:
        return false;
    }
  };

  // Update field validation state
  const updateFieldValidation = (field: string, value: string) => {
    const isValid = validateField(field, value);
    setFieldValidation(prev => ({
      ...prev,
      [field]: isValid
    }));
    return isValid;
  };

  // Form validation
  const validateForm = () => {
    if (!firstName.trim()) return "First name is required";
    if (!lastName.trim()) return "Last name is required";
    if (!username.trim()) return "Username is required";
    if (!email.trim()) return "Email is required";
    if (!password.trim()) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    
    return null;
  };

  const handleSignup = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      addToast({
        type: 'warning',
        message: validationError,
        duration: 4000
      });
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(API("/api/v1/users/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        const data = await res.json().catch(() => ({}));
        let errorMessage = "Signup failed";
        
        if (res.status === 409) {
          errorMessage = "Username or email already exists";
        } else if (data.detail) {
          errorMessage = data.detail;
        }
        
        setError(errorMessage);
        addToast({
          type: 'error',
          message: errorMessage,
          duration: 6000
        });
        return;
      }
      
      const successMessage = `Welcome ${firstName}! Your account has been created successfully.`;
      setSuccess(successMessage);
      addToast({
        type: 'success',
        message: successMessage,
        duration: 5000
      });

      // Clear form
      setFirstName("");
      setLastName("");
      setUsername("");
      setOrganization("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      // Redirect to login after a delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);

    } catch (err: unknown) {
      const errorMsg = `Network error: ${getErrorMessage(err) || 'Please check your connection'}`;
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
        duration: 6000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page-container">
      <div className="signup-card">
        <div className="signup-header-section">
          <div className="logo-container">
            <Image src="/logo.png" alt="BracketWorks Logo" width={72} height={72} className="logo-image" />
          </div>
          <h1 className="signup-title">Create Account</h1>
          <div className="signup-subtitle">Join BracketWorks today</div>
        </div>
        
        <form id="signup-form" onSubmit={handleSignup} className="signup-form">
          <div className="signup-input-grid">
            <div className="signup-input-container">
              <label htmlFor="signup-firstname" className="signup-input-label">First Name:</label>
              <input
                type="text"
                id="signup-firstname"
                name="firstName"
                placeholder="First Name"
                value={firstName}
                onChange={changeEvent => {
                  setFirstName(changeEvent.target.value);
                  updateFieldValidation('firstName', changeEvent.target.value);
                }}
                required
                className={`signup-input ${fieldValidation.firstName === true ? 'valid' : fieldValidation.firstName === false ? 'invalid' : ''}`}
                aria-label="First Name"
              />
              {fieldValidation.firstName === true && <span className="validation-check">✓</span>}
            </div>
            <div className="signup-input-container">
              <label htmlFor="signup-lastname" className="signup-input-label">Last Name:</label>
              <input
                type="text"
                id="signup-lastname"
                name="lastName"
                placeholder="Last Name"
                value={lastName}
                onChange={changeEvent => {
                  setLastName(changeEvent.target.value);
                  updateFieldValidation('lastName', changeEvent.target.value);
                }}
                required
                className={`signup-input ${fieldValidation.lastName === true ? 'valid' : fieldValidation.lastName === false ? 'invalid' : ''}`}
                aria-label="Last Name"
              />
              {fieldValidation.lastName === true && <span className="validation-check">✓</span>}
            </div>
          </div>
          
          <div className="signup-input-container username-container">
            <label htmlFor="signup-username" className="signup-input-label">Username:</label>
            <input
              type="text"
              id="signup-username"
              name="username"
              placeholder="Choose a username"
              value={username}
              onChange={changeEvent => {
                setUsername(changeEvent.target.value);
                updateFieldValidation('username', changeEvent.target.value);
              }}
              autoComplete="username"
              required
              className={`signup-input ${
                checkingUsername ? 'checking' :
                usernameAvailable === true ? 'valid available' :
                usernameAvailable === false ? 'invalid taken' :
                fieldValidation.username === false ? 'invalid' : ''
              }`}
              aria-label="Username"
            />
            {checkingUsername && <span className="validation-spinner">⋯</span>}
            {usernameAvailable === true && <span className="validation-check">✓</span>}
            {usernameAvailable === false && <span className="validation-error">Username taken</span>}
          </div>
          
          <div className="signup-input-container">
            <label htmlFor="signup-organization" className="signup-input-label">Organization (optional):</label>
            <input
              type="text"
              id="signup-organization"
              name="organization"
              placeholder="Organization Name (optional)"
              value={organization}
              onChange={changeEvent => setOrganization(changeEvent.target.value)}
              className="signup-input"
              aria-label="Organization"
            />
          </div>
          
          <div className="signup-input-container">
            <label htmlFor="signup-email" className="signup-input-label">Email:</label>
            <input
              type="email"
              id="signup-email"
              name="email"
              placeholder="Enter your email"
              value={email}
              onChange={changeEvent => {
                setEmail(changeEvent.target.value);
                updateFieldValidation('email', changeEvent.target.value);
              }}
              autoComplete="email"
              required
              className={`signup-input ${fieldValidation.email === true ? 'valid' : fieldValidation.email === false ? 'invalid' : ''}`}
              aria-label="Email"
            />
            {fieldValidation.email === true && <span className="validation-check">✓</span>}
          </div>
          
          <div className="signup-password-container">
            <label htmlFor="signup-password" className="signup-input-label">Password:</label>
            <div className="signup-password-field-wrapper">
              <input
                type={mounted && showPassword ? "text" : "password"}
                id="signup-password"
                name="password"
                placeholder="Create a password (min 6 characters)"
                value={password}
                onChange={changeEvent => {
                  setPassword(changeEvent.target.value);
                  updateFieldValidation('password', changeEvent.target.value);
                }}
                onFocus={() => setShowPasswordRequirements(true)}
                onBlur={() => setShowPasswordRequirements(false)}
                autoComplete="new-password"
                required
                className={`signup-password-input ${fieldValidation.password === true ? 'valid' : fieldValidation.password === false ? 'invalid' : ''}`}
                aria-label="Password"
              />
              {mounted && (
                <button
                  type="button"
                  className="signup-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              )}
            </div>
            {password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div 
                    className={`strength-fill strength-${passwordStrength}`}
                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                  ></div>
                </div>
                <span className={`strength-text strength-${passwordStrength}`}>
                  {passwordStrength === 0 && 'Very Weak'}
                  {passwordStrength === 1 && 'Weak'}
                  {passwordStrength === 2 && 'Fair'}
                  {passwordStrength === 3 && 'Good'}
                  {passwordStrength === 4 && 'Strong'}
                  {passwordStrength === 5 && 'Very Strong'}
                </span>
              </div>
            )}
            {showPasswordRequirements && (
              <div className="password-requirements">
                <div className="requirement-title">Password requirements:</div>
                <div className={`requirement ${password.length >= 6 ? 'met' : ''}`}>
                  ✓ At least 6 characters
                </div>
                <div className={`requirement ${/[a-z]/.test(password) ? 'met' : ''}`}>
                  ✓ Lowercase letter
                </div>
                <div className={`requirement ${/[A-Z]/.test(password) ? 'met' : ''}`}>
                  ✓ Uppercase letter
                </div>
                <div className={`requirement ${/[0-9]/.test(password) ? 'met' : ''}`}>
                  ✓ Number
                </div>
                <div className={`requirement ${/[^A-Za-z0-9]/.test(password) ? 'met' : ''}`}>
                  ✓ Special character
                </div>
              </div>
            )}
          </div>
          
          <div className="signup-password-container">
            <label htmlFor="signup-confirm-password" className="signup-input-label">Confirm Password:</label>
            <div className="signup-password-field-wrapper">
              <input
                type={mounted && showConfirmPassword ? "text" : "password"}
                id="signup-confirm-password"
                name="confirmPassword"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={changeEvent => {
                  setConfirmPassword(changeEvent.target.value);
                  updateFieldValidation('confirmPassword', changeEvent.target.value);
                }}
                autoComplete="new-password"
                required
                className={`signup-password-input ${fieldValidation.confirmPassword === true ? 'valid' : fieldValidation.confirmPassword === false ? 'invalid' : ''}`}
                aria-label="Confirm Password"
              />
              {mounted && (
                <button
                  type="button"
                  className="signup-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              )}
            </div>
            {fieldValidation.confirmPassword === true && <span className="validation-check">✓</span>}
            {fieldValidation.confirmPassword === false && confirmPassword && (
              <span className="validation-error">Passwords don&apos;t match</span>
            )}
          </div>

          {error && (
            <div className="signup-error-container" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '16px',
              color: '#ef4444',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div className="signup-success-message">
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="signup-button"
            aria-label={loading ? 'Creating account, please wait' : 'Create your account'}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
          
          <div className="signup-login-link">
            <button
              type="button"
              className="signup-login-button"
              onClick={() => window.location.href = "/login"}
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

