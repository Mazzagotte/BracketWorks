"use client";

import { type FormEvent, useMemo, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import AuthFeedback from "../components/AuthFeedback";
import PasswordStrengthPanel from "../components/PasswordStrengthPanel";
import {
  SignupConfirmPasswordFieldSection,
  SignupNameFieldsSection,
  SignupPasswordFieldSection,
  SignupUsernameFieldSection,
} from "../components/SignupFieldSections";
import { useToast } from "../components/Toast";
import { useSignupForm } from "../hooks/useSignupForm";
import { getSignupValidationError, submitSignup } from "../lib/auth/signup";

export default function SignupPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    checkingUsername,
    fieldValidity,
    mounted,
    passwordRequirementChecks,
    passwordStrength,
    resetForm,
    setShowConfirmPassword,
    setShowPassword,
    setShowPasswordRequirements,
    showConfirmPassword,
    showPassword,
    showPasswordRequirements,
    updateValue,
    usernameAvailable,
    values: { confirmPassword, email, firstName, lastName, organization, password, username },
  } = useSignupForm();
  const strengthTone = useMemo(() => {
    if (passwordStrength <= 1) return 'weak';
    if (passwordStrength === 2) return 'fair';
    if (passwordStrength === 3) return 'good';
    return 'strong';
  }, [passwordStrength]);
  const passwordStrengthPercent = Math.max(passwordStrength * 20, 8);
  const requirementItems = useMemo(
    () => [
      { met: passwordRequirementChecks.minLength, label: 'At least 6 characters' },
      { met: passwordRequirementChecks.lower, label: 'Lowercase letter' },
      { met: passwordRequirementChecks.upper, label: 'Uppercase letter' },
      { met: passwordRequirementChecks.number, label: 'Number' },
      { met: passwordRequirementChecks.special, label: 'Special character' },
    ],
    [passwordRequirementChecks]
  );

  const handleSignup = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    
    const validationError = getSignupValidationError({
      firstName,
      lastName,
      username,
      organization,
      email,
      password,
      confirmPassword,
      usernameAvailable,
      checkingUsername,
    });
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
      const { successMessage } = await submitSignup({
        firstName,
        lastName,
        username,
        organization,
        email,
        password,
      });

      setSuccess(successMessage);
      addToast({
        type: 'success',
        message: successMessage,
        duration: 5000
      });

      resetForm();

      // Redirect to login after a delay
      window.setTimeout(() => {
        router.push('/login?signup=success');
      }, 2000);

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Signup failed';
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
            <Image src="/logo.svg" alt="BracketWorks Logo" width={72} height={72} className="logo-image" priority />
          </div>
          <h1 className="signup-title">Create Account</h1>
          <div className="signup-subtitle">Join BracketWorks today</div>
        </div>
        
        <form id="signup-form" onSubmit={handleSignup} className="signup-form">
          <SignupNameFieldsSection
            containerClassName="signup-input-grid"
            fieldClassName="signup-input-container"
            labelClassName="signup-input-label"
            firstName={{
              label: 'First Name:',
              value: firstName,
              onChange: value => updateValue('firstName', value),
              inputClassName: `signup-input ${fieldValidity.firstName === true ? 'valid' : fieldValidity.firstName === false ? 'invalid' : ''}`,
              validBadge: fieldValidity.firstName === true ? <span className="validation-check">Valid</span> : null,
              inputId: 'signup-firstname',
              inputName: 'firstName',
              placeholder: 'First Name',
              ariaLabel: 'First Name',
            }}
            lastName={{
              label: 'Last Name:',
              value: lastName,
              onChange: value => updateValue('lastName', value),
              inputClassName: `signup-input ${fieldValidity.lastName === true ? 'valid' : fieldValidity.lastName === false ? 'invalid' : ''}`,
              validBadge: fieldValidity.lastName === true ? <span className="validation-check">Valid</span> : null,
              inputId: 'signup-lastname',
              inputName: 'lastName',
              placeholder: 'Last Name',
              ariaLabel: 'Last Name',
            }}
          />

          <SignupUsernameFieldSection
            containerClassName="signup-input-container username-container"
            labelClassName="signup-input-label"
            value={username}
            onChange={value => updateValue('username', value)}
            checking={checkingUsername}
            availability={usernameAvailable}
            inputClassName={`signup-input ${
              checkingUsername ? 'checking' :
              usernameAvailable === true ? 'valid available' :
              usernameAvailable === false ? 'invalid taken' :
              fieldValidity.username === false ? 'invalid' : ''
            }`}
            checkingIndicator={<span className="validation-spinner">Checking</span>}
            availableIndicator={<span className="validation-check">Valid</span>}
            takenIndicator={<span className="validation-error">Username taken</span>}
            inputId="signup-username"
            inputName="username"
            placeholder="Choose a username"
            ariaLabel="Username"
          />
          
          <div className="signup-input-container">
            <label htmlFor="signup-organization" className="signup-input-label">Organization (optional):</label>
            <input
              type="text"
              id="signup-organization"
              name="organization"
              placeholder="Organization Name (optional)"
              value={organization}
              onChange={changeEvent => updateValue('organization', changeEvent.target.value)}
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
              onChange={changeEvent => updateValue('email', changeEvent.target.value)}
              autoComplete="email"
              required
              className={`signup-input ${fieldValidity.email === true ? 'valid' : fieldValidity.email === false ? 'invalid' : ''}`}
              aria-label="Email"
            />
            {fieldValidity.email === true && <span className="validation-check">Valid</span>}
          </div>
          
          <SignupPasswordFieldSection
            containerClassName="signup-password-container"
            labelClassName="signup-input-label"
            wrapperClassName="signup-password-field-wrapper"
            inputClassName={`signup-password-input ${fieldValidity.password === true ? 'valid' : fieldValidity.password === false ? 'invalid' : ''}`}
            value={password}
            onChange={value => updateValue('password', value)}
            mounted={mounted}
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword(!showPassword)}
            onFocus={() => setShowPasswordRequirements(true)}
            onBlur={() => setShowPasswordRequirements(false)}
            showRequirements={showPasswordRequirements}
            passwordStrength={passwordStrength}
            passwordRequirementChecks={passwordRequirementChecks}
            toggleButton={
              <button
                type="button"
                className="signup-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? 'Hide Password' : 'Show Password'}
              </button>
            }
            strengthMeter={
              <PasswordStrengthPanel
                strengthText={
                  passwordStrength === 0 ? 'Very Weak' :
                  passwordStrength === 1 ? 'Weak' :
                  passwordStrength === 2 ? 'Fair' :
                  passwordStrength === 3 ? 'Good' :
                  passwordStrength === 4 ? 'Strong' :
                  'Very Strong'
                }
                strengthPercent={passwordStrengthPercent}
                tone={strengthTone}
                requirements={requirementItems}
              />
            }
            requirementsPanel={null}
            inputId="signup-password"
            inputName="password"
            placeholder="Create a password (min 6 characters)"
            ariaLabel="Password"
          />

          <SignupConfirmPasswordFieldSection
            containerClassName="signup-password-container"
            labelClassName="signup-input-label"
            wrapperClassName="signup-password-field-wrapper"
            inputClassName={`signup-password-input ${fieldValidity.confirmPassword === true ? 'valid' : fieldValidity.confirmPassword === false ? 'invalid' : ''}`}
            value={confirmPassword}
            onChange={value => updateValue('confirmPassword', value)}
            mounted={mounted}
            showPassword={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
            toggleButton={
              <button
                type="button"
                className="signup-password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? 'Hide Password' : 'Show Password'}
              </button>
            }
            validIndicator={fieldValidity.confirmPassword === true ? <span className="validation-check">Valid</span> : null}
            invalidIndicator={fieldValidity.confirmPassword === false ? <span className="validation-error">Passwords don&apos;t match</span> : null}
            inputId="signup-confirm-password"
            inputName="confirmPassword"
            placeholder="Confirm your password"
            ariaLabel="Confirm Password"
          />

          <AuthFeedback
            success={success}
            error={error}
            successClassName="signup-success-message"
            errorClassName="signup-error-container signup-error-msg"
          />

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
              onClick={() => router.push('/login')}
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

