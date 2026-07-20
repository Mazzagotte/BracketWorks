'use client';

import { useState, useCallback } from 'react';
import { validateEmail } from '../lib/auth/validation-utils';

interface PasswordResetModalState {
  email: string;
  error: string;
  success: string;
  loading: boolean;
  fieldError: string;
  touched: boolean;
}

/**
 * Consolidated form state management for password reset modal (email submission)
 * Reduces 6 useState calls to 1 object with action methods
 * 
 * Different from useResetPasswordForm which is for the reset/page.tsx (new password step)
 */
export function usePasswordResetModalForm() {
  const [formState, setFormState] = useState<PasswordResetModalState>({
    email: '',
    error: '',
    success: '',
    loading: false,
    fieldError: '',
    touched: false,
  });

  const validateEmailField = useCallback((value: string): string => {
    return validateEmail(
      value,
      'Email address is required.',
      'Please enter a valid email address'
    );
  }, []);

  const updateEmail = useCallback((value: string) => {
    setFormState(prev => {
      const newFieldError =
        prev.touched && value.trim() ? validateEmailField(value) : prev.fieldError;

      return {
        ...prev,
        email: value,
        error: prev.error ? '' : prev.error,
        success: prev.success ? '' : prev.success,
        fieldError: value.trim() ? newFieldError : '',
      };
    });
  }, [validateEmailField]);

  const handleBlur = useCallback((value: string) => {
    setFormState(prev => ({
      ...prev,
      touched: true,
      fieldError: validateEmailField(value),
    }));
  }, [validateEmailField]);

  const setError = useCallback((error: string) => {
    setFormState(prev => ({
      ...prev,
      error,
      success: '',
    }));
  }, []);

  const setSuccess = useCallback((success: string) => {
    setFormState(prev => ({
      ...prev,
      success,
      error: '',
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setFormState(prev => ({
      ...prev,
      loading,
    }));
  }, []);

  const reset = useCallback(() => {
    setFormState({
      email: '',
      error: '',
      success: '',
      loading: false,
      fieldError: '',
      touched: false,
    });
  }, []);

  const isValid =
    formState.touched &&
    !formState.fieldError &&
    formState.email.trim();

  return {
    ...formState,
    updateEmail,
    handleBlur,
    setError,
    setSuccess,
    setLoading,
    reset,
    isValid,
    validateEmailField,
  };
}
