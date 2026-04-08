'use client';

import { useState, useEffect } from 'react';
import { API } from '../lib/api';
import { getErrorMessage } from '../lib/error-utils';
import { logger } from '../lib/logger';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SignupModal({ isOpen, onClose, onSuccess }: SignupModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
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
      } else {
        setUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [username]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFirstName('');
      setLastName('');
      setUsername('');
      setOrganization('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setUsernameAvailable(null);
      setPasswordStrength(0);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowPasswordRequirements(false);
      setFieldValidation({
        firstName: false,
        lastName: false,
        username: false,
        email: false,
        password: false,
        confirmPassword: false
      });
    }
  }, [isOpen]);

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
        return value === password && value.length > 0;
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(API('/api/v1/users/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const errorData = await res.json().catch(() => ({ detail: 'Signup failed' }));
        let errorMessage = 'Signup failed';
        
        if (res.status === 409) {
          errorMessage = 'Username or email already exists';
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
        
        throw new Error(errorMessage);
      }

      // Success!
      logger.info('Signup successful', { username });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      logger.error('Signup error', { error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStrengthText = () => {
    switch(passwordStrength) {
      case 0: return 'Very Weak';
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      case 5: return 'Very Strong';
      default: return '';
    }
  };

  const getStrengthColor = () => {
    switch(passwordStrength) {
      case 0:
      case 1: return '#D64545';
      case 2: return '#f97316';
      case 3: return '#F2A900';
      case 4: return '#84cc16';
      case 5: return '#2FBF71';
      default: return '#e5e7eb';
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#1F2A33'
          }}>Create Account</h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: '14px',
            color: '#5E6B75'
          }}>Join BracketWorks today</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} style={{ padding: '24px' }}>
          {/* Error Message */}
          {error && (
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#D64545',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* First Name and Last Name - Two Column Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {/* First Name */}
            <div style={{ position: 'relative' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2A33',
                marginBottom: '6px'
              }}>
                First Name *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  updateFieldValidation('firstName', e.target.value);
                }}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingRight: fieldValidation.firstName ? '40px' : '14px',
                  fontSize: '15px',
                  border: `2px solid ${fieldValidation.firstName ? '#2FBF71' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  if (!fieldValidation.firstName) {
                    e.currentTarget.style.borderColor = '#F47C20';
                  }
                }}
                onBlur={(e) => {
                  if (!fieldValidation.firstName) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              />
              {fieldValidation.firstName && (
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '41px',
                  color: '#2FBF71',
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}></span>
              )}
            </div>

            {/* Last Name */}
            <div style={{ position: 'relative' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2A33',
                marginBottom: '6px'
              }}>
                Last Name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  updateFieldValidation('lastName', e.target.value);
                }}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingRight: fieldValidation.lastName ? '40px' : '14px',
                  fontSize: '15px',
                  border: `2px solid ${fieldValidation.lastName ? '#2FBF71' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  if (!fieldValidation.lastName) {
                    e.currentTarget.style.borderColor = '#F47C20';
                  }
                }}
                onBlur={(e) => {
                  if (!fieldValidation.lastName) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              />
              {fieldValidation.lastName && (
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '41px',
                  color: '#2FBF71',
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}></span>
              )}
            </div>
          </div>

          {/* Username with availability checker */}
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1F2A33',
              marginBottom: '6px'
            }}>
              Username *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                updateFieldValidation('username', e.target.value);
              }}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                paddingRight: '40px',
                fontSize: '15px',
                border: `2px solid ${
                  usernameAvailable === false ? '#D64545' :
                  usernameAvailable === true ? '#2FBF71' :
                  '#e5e7eb'
                }`,
                borderRadius: '10px',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                if (usernameAvailable === null) {
                  e.currentTarget.style.borderColor = '#F47C20';
                }
              }}
              onBlur={(e) => {
                if (usernameAvailable === null) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            />
            {checkingUsername && (
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '41px',
                color: '#5E6B75',
                fontSize: '16px'
              }}>⋯</span>
            )}
            {usernameAvailable === true && !checkingUsername && (
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '41px',
                color: '#2FBF71',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>[✓]</span>
            )}
            {usernameAvailable === false && !checkingUsername && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                fontSize: '13px',
                color: '#D64545',
                fontWeight: 500
              }}>Username taken</div>
            )}
          </div>

          {/* Organization */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1F2A33',
              marginBottom: '6px'
            }}>
              Organization (optional)
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Organization Name"
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '15px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#F47C20'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1F2A33',
              marginBottom: '6px'
            }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                updateFieldValidation('email', e.target.value);
              }}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                paddingRight: fieldValidation.email ? '40px' : '14px',
                fontSize: '15px',
                border: `2px solid ${fieldValidation.email ? '#2FBF71' : '#e5e7eb'}`,
                borderRadius: '10px',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                if (!fieldValidation.email) {
                  e.currentTarget.style.borderColor = '#F47C20';
                }
              }}
              onBlur={(e) => {
                if (!fieldValidation.email) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            />
            {fieldValidation.email && (
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '41px',
                color: '#2FBF71',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>[✓]</span>
            )}
          </div>

          {/* Password with strength meter and requirements */}
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1F2A33',
              marginBottom: '6px'
            }}>
              Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mounted && showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  updateFieldValidation('password', e.target.value);
                }}
                onFocus={() => setShowPasswordRequirements(true)}
                onBlur={() => setShowPasswordRequirements(false)}
                required
                placeholder="Create a password (min 6 characters)"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingRight: '100px',
                  fontSize: '15px',
                  border: `2px solid ${fieldValidation.password ? '#2FBF71' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocusCapture={(e) => {
                  if (!fieldValidation.password) {
                    e.currentTarget.style.borderColor = '#F47C20';
                  }
                }}
                onBlurCapture={(e) => {
                  if (!fieldValidation.password) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              />
              {mounted && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px 10px',
                    background: 'rgba(94, 107, 117, 0.08)',
                    border: '1px solid rgba(94, 107, 117, 0.2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#5E6B75',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(94, 107, 117, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(94, 107, 117, 0.08)';
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              )}
            </div>

            {/* Password Strength Meter */}
            {password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{
                  height: '4px',
                  background: '#e5e7eb',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(passwordStrength / 5) * 100}%`,
                    background: getStrengthColor(),
                    transition: 'all 0.3s ease'
                  }}></div>
                </div>
                <div style={{
                  marginTop: '4px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: getStrengthColor()
                }}>
                  {getStrengthText()}
                </div>
              </div>
            )}

            {/* Password Requirements Tooltip */}
            {showPasswordRequirements && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '8px',
                padding: '12px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                zIndex: 10,
                fontSize: '13px'
              }}>
                <div style={{
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#1F2A33'
                }}>Password requirements:</div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ color: password.length >= 6 ? '#2FBF71' : '#5E6B75' }}>
                    {password.length >= 6 ? '[Yes]' : '[ ]'} At least 6 characters
                  </div>
                  <div style={{ color: /[a-z]/.test(password) ? '#2FBF71' : '#5E6B75' }}>
                    {/[a-z]/.test(password) ? '[Yes]' : '[ ]'} Lowercase letter
                  </div>
                  <div style={{ color: /[A-Z]/.test(password) ? '#2FBF71' : '#5E6B75' }}>
                    {/[A-Z]/.test(password) ? '[Yes]' : '[ ]'} Uppercase letter
                  </div>
                  <div style={{ color: /[0-9]/.test(password) ? '#2FBF71' : '#5E6B75' }}>
                    {/[0-9]/.test(password) ? '[Yes]' : '[ ]'} Number
                  </div>
                  <div style={{ color: /[^A-Za-z0-9]/.test(password) ? '#2FBF71' : '#5E6B75' }}>
                    {/[^A-Za-z0-9]/.test(password) ? '[Yes]' : '[ ]'} Special character
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1F2A33',
              marginBottom: '6px'
            }}>
              Confirm Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mounted && showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  updateFieldValidation('confirmPassword', e.target.value);
                }}
                required
                placeholder="Confirm your password"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingRight: '100px',
                  fontSize: '15px',
                  border: `2px solid ${
                    confirmPassword && !fieldValidation.confirmPassword ? '#D64545' :
                    fieldValidation.confirmPassword ? '#2FBF71' :
                    '#e5e7eb'
                  }`,
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  if (!fieldValidation.confirmPassword && !(confirmPassword && !fieldValidation.confirmPassword)) {
                    e.currentTarget.style.borderColor = '#F47C20';
                  }
                }}
                onBlur={(e) => {
                  if (!fieldValidation.confirmPassword && !(confirmPassword && !fieldValidation.confirmPassword)) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              />
              {mounted && (
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px 10px',
                    background: 'rgba(107, 114, 128, 0.08)',
                    border: '1px solid rgba(107, 114, 128, 0.2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#6b7280',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.08)';
                  }}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              )}
            </div>
            {fieldValidation.confirmPassword && (
              <span style={{
                position: 'absolute',
                right: '92px',
                top: '41px',
                color: '#2FBF71',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>[✓]</span>
            )}
            {confirmPassword && !fieldValidation.confirmPassword && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                fontSize: '13px',
                color: '#D64545',
                fontWeight: 500
              }}>Passwords don't match</div>
            )}
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#5E6B75',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#ffffff',
                background: loading ? '#E3E0DC' : '#F47C20',
                border: '2px solid ' + (loading ? '#E3E0DC' : '#F47C20'),
                borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#D9651A';
                  e.currentTarget.style.borderColor = '#D9651A';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#F47C20';
                  e.currentTarget.style.borderColor = '#F47C20';
                }
              }}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
