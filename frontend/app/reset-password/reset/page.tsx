"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useEffect, useRef, useMemo, useCallback } from "react";

import { useAuthFormShortcuts } from "../../hooks/useAuthFormShortcuts";
import { useFieldValidation } from "../../hooks/useFieldValidation";
import { useResetPasswordForm } from "../../hooks/useResetPasswordForm";
import { describeNetworkRequestError, useNetworkRequest } from "../../hooks/useNetworkRequest";
import { completePasswordReset, PasswordResetApiError } from "../../lib/auth/password-reset";
import { getPasswordRequirementChecks, getPasswordValidationError } from "../../lib/auth/validation";
import PasswordStrengthPanel from "../../components/PasswordStrengthPanel";
import { useToast } from "../../components/Toast";
import { logger } from '../../lib/logger';
import { getErrorMessage as getUtilErrorMessage, getErrorContext } from '../../lib/error-utils';
import loginStyles from "../../login/login.module.css";

export default function ResetPasswordPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Refs for form navigation
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { addToast } = useToast();
  const { connectionQuality, enqueueRetry, fetchWithRetry, isOnline } = useNetworkRequest();
  const formState = useResetPasswordForm();
  const {
    hydrateFromQueryParams,
    mounted,
    passwordStrength,
    passwordsMatch,
    setFieldValue,
    setShowConfirmPassword,
    setShowNewPassword,
    showConfirmPassword,
    showNewPassword,
    strengthClass,
    strengthText,
    values: { code, confirmPassword, email, newPassword },
  } = formState;
  const isPreview = code.trim() === "preview-reset-token";
  const hasToken = code.trim().length > 0;
  const formValues = useMemo(
    () => ({
      email,
      code,
      newPassword,
      confirmPassword,
    }),
    [code, confirmPassword, email, newPassword]
  );
  const {
    fieldErrors,
    handleFieldBlur,
    handleFieldChange,
    resetValidation,
    validateAll,
  } = useFieldValidation(formValues, (fieldName, value, values) => {
    switch (fieldName) {
      case 'newPassword':
        return getPasswordValidationError(value, {
          minLength: 8,
          requiredMessage: 'New password is required',
          unmetMessage: 'Password does not meet requirements',
        });
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== values.newPassword) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  });
  const strengthTone = useMemo(() => {
    if (passwordStrength < 25) return 'weak';
    if (passwordStrength < 50) return 'fair';
    if (passwordStrength < 75) return 'good';
    return 'strong';
  }, [passwordStrength]);
  const passwordChecks = useMemo(() => getPasswordRequirementChecks(newPassword, 8), [newPassword]);
  const requirementItems = useMemo(
    () => [
      { label: 'At least 8 characters', met: passwordChecks.minLength },
      { label: 'One lowercase letter', met: passwordChecks.lower },
      { label: 'One uppercase letter', met: passwordChecks.upper },
      { label: 'One number', met: passwordChecks.number },
      { label: 'One symbol', met: passwordChecks.special },
    ],
    [passwordChecks]
  );

  const submitReset = useCallback(async () => {
    if (isPreview) {
      addToast({
        type: 'info',
        message: 'Development preview mode only. This page is not submitting a real password reset.',
        duration: 3500,
      });
      return;
    }

    if (!hasToken) {
      setError('This reset link is missing or invalid. Request a new password reset email.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await completePasswordReset(email, code, newPassword, fetchWithRetry);
      addToast({
        type: 'success',
        message: 'Password reset successfully. Redirecting to login...',
        duration: 2500
      });
      router.replace(`${result.redirectUrl}?reset=success`);

    } catch (err: unknown) {
      if (err instanceof PasswordResetApiError) {
        setError(err.message);
        addToast({
          type: 'error',
          message: err.message,
          duration: 5000
        });
        return;
      }

      logger.error('Reset password error:', getErrorContext(err));
      const networkError = describeNetworkRequestError(err, connectionQuality);
      const errorMessage = networkError.message || getUtilErrorMessage(err);
      setError(errorMessage || 'Failed to reset password. Please try again.');
      
      addToast({
        type: 'error',
        message: errorMessage || 'Failed to reset password',
        duration: 5000
      });

      if (networkError.shouldRetry && !isOnline) {
        enqueueRetry(async () => {
          try {
            await submitReset();
          } catch (retryError) {
            logger.debug('Retry failed:', retryError);
          }
        });

        addToast({
          type: 'info',
          message: 'Password reset will retry automatically when your connection is restored.',
          duration: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [addToast, code, connectionQuality, email, enqueueRetry, fetchWithRetry, hasToken, isOnline, isPreview, newPassword, router]);

  const handleReset = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    await submitReset();
  }, [submitReset]);

  const clearResetFeedback = useCallback(() => {
    setError('');
    resetValidation();
  }, [resetValidation]);

  useEffect(() => {
    hydrateFromQueryParams();
  }, [hydrateFromQueryParams]);

  useEffect(() => {
    if (!hasToken) {
      return;
    }

    const timerId = window.setTimeout(() => {
      passwordRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timerId);
  }, [hasToken]);

  const canSubmitShortcut = useCallback(
    () => !loading && Object.values(fieldErrors).every(fieldError => fieldError === '') &&
      hasToken && Boolean(newPassword) && Boolean(confirmPassword),
    [confirmPassword, fieldErrors, hasToken, loading, newPassword]
  );

  const handleShortcutSubmit = useCallback(() => {
    void submitReset();
  }, [submitReset]);

  useAuthFormShortcuts({
    canSubmitShortcut,
    onSubmitShortcut: handleShortcutSubmit,
    enableEscape: true,
    onEscape: clearResetFeedback,
  });

  return (
    <div className={loginStyles.page}>
      <div className={`${loginStyles.card} ${loginStyles.resetCard}`}>
        <div className={loginStyles.logoWrap}>
          <Image
            src="/logo.svg"
            alt="BracketWorks Logo"
            width={220}
            height={220}
            className={loginStyles.logoImage}
            priority
          />
        </div>

        <form onSubmit={handleReset} className={loginStyles.form}>
          <div className={loginStyles.formIntro}>
            {isPreview
              ? 'Development preview mode for the reset password email landing page.'
              : hasToken
              ? 'Create a new secure password for your account.'
              : 'This reset link is missing or invalid. Request a new password reset email.'}
          </div>

          {isPreview ? (
            <div className={loginStyles.sessionExpiredBanner} role="status" aria-live="polite">
              Preview token detected. You can inspect the real page layout here, but submitting is disabled.
            </div>
          ) : null}

          {error ? (
            <div className={loginStyles.errorBanner} role="alert" aria-live="polite">
              {error}
            </div>
          ) : null}

          {hasToken ? (
            <>
              <div className={loginStyles.passwordWrap}>
                <input
                  ref={passwordRef}
                  type={mounted && showNewPassword ? 'text' : 'password'}
                  aria-label="New Password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={event => {
                    const nextValue = event.target.value;
                    const nextValues = { ...formValues, newPassword: nextValue };
                    setFieldValue('newPassword', nextValue);
                    handleFieldChange('newPassword', nextValue, nextValues);
                    if (confirmPassword) {
                      handleFieldChange('confirmPassword', confirmPassword, nextValues);
                    }
                  }}
                  onBlur={event => handleFieldBlur('newPassword', event.target.value, { ...formValues, newPassword: event.target.value })}
                  onKeyDown={changeEvent => {
                    if (changeEvent.key === 'Enter' && passwordStrength >= 50) {
                      changeEvent.preventDefault();
                      confirmPasswordRef.current?.focus();
                    }
                  }}
                  autoComplete="new-password"
                  required
                  className={`${loginStyles.input} ${fieldErrors.newPassword ? loginStyles.inputError : ''}`}
                />
                {mounted ? (
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={loginStyles.passwordToggle}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                ) : null}
              </div>

              {Boolean(newPassword) ? (
                <PasswordStrengthPanel
                  strengthText={strengthText}
                  strengthPercent={passwordStrength}
                  tone={strengthTone}
                  requirements={requirementItems}
                />
              ) : null}

              <div className={loginStyles.passwordWrap}>
                <input
                  ref={confirmPasswordRef}
                  type={mounted && showConfirmPassword ? 'text' : 'password'}
                  aria-label="Confirm New Password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={event => {
                    const nextValue = event.target.value;
                    setFieldValue('confirmPassword', nextValue);
                    handleFieldChange('confirmPassword', nextValue, { ...formValues, confirmPassword: nextValue });
                  }}
                  onBlur={event => handleFieldBlur('confirmPassword', event.target.value, { ...formValues, confirmPassword: event.target.value })}
                  onKeyDown={changeEvent => {
                    if (changeEvent.key === 'Enter' && passwordsMatch && passwordStrength >= 50) {
                      changeEvent.preventDefault();
                      void submitReset();
                    }
                  }}
                  autoComplete="new-password"
                  required
                  className={`${loginStyles.input} ${fieldErrors.confirmPassword ? loginStyles.inputError : ''}`}
                />
                {mounted ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={loginStyles.passwordToggle}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isPreview || loading || !hasToken || passwordStrength < 50 || !passwordsMatch || Object.values(fieldErrors).some(Boolean)}
                className={`${loginStyles.resetSubmitButton} surface-authButton surface-authButtonPrimary`}
              >
                {isPreview ? 'Preview Only' : loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </>
          ) : (
            <div className={loginStyles.actions}>
              <a href="/reset-password/request" className={loginStyles.createAccountBtn}>
                Request New Reset Link
              </a>
            </div>
          )}

          <div className={loginStyles.actions}>
            <a href="/login" className={loginStyles.forgotLink}>Back to Login</a>
          </div>
        </form>
      </div>
    </div>
  );
}


