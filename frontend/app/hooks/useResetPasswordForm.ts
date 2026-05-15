'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { calculatePasswordStrengthPercent, isValidEmail } from '../lib/auth/validation';

export type ResetPasswordFormValues = {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY_RESET_PASSWORD_VALUES: ResetPasswordFormValues = {
  email: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
};

export function useResetPasswordForm() {
  const [values, setValues] = useState<ResetPasswordFormValues>(EMPTY_RESET_PASSWORD_VALUES);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const passwordStrength = useMemo(
    () => calculatePasswordStrengthPercent(values.newPassword, 8),
    [values.newPassword]
  );

  const emailValid = useMemo(() => isValidEmail(values.email), [values.email]);
  const passwordsMatch = useMemo(
    () => values.newPassword === values.confirmPassword && values.newPassword.length > 0,
    [values.confirmPassword, values.newPassword]
  );

  const strengthText = useMemo(() => {
    if (passwordStrength < 25) return 'Weak';
    if (passwordStrength < 50) return 'Fair';
    if (passwordStrength < 75) return 'Good';
    return 'Strong';
  }, [passwordStrength]);

  const strengthClass = useMemo(() => {
    if (passwordStrength < 25) return 'strength-weak';
    if (passwordStrength < 50) return 'strength-fair';
    if (passwordStrength < 75) return 'strength-good';
    return 'strength-strong';
  }, [passwordStrength]);

  const setFieldValue = useCallback(
    (fieldName: keyof ResetPasswordFormValues, value: string) => {
      setValues(previous => ({ ...previous, [fieldName]: value }));
    },
    []
  );

  const hydrateFromQueryParams = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email') || '';
    const codeParam = urlParams.get('code') || urlParams.get('token') || '';

    setValues(previous => ({
      ...previous,
      email: emailParam || previous.email,
      code: codeParam || previous.code,
    }));

    return {
      hasEmailParam: Boolean(emailParam),
      hasCodeParam: Boolean(codeParam),
    };
  }, []);

  return {
    emailValid,
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
    values,
  };
}