'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { capitalizeFirstLetter } from '@bracketworks/ui';

import {
  calculatePasswordStrength,
  getPasswordRequirementChecks,
  hasStrongPassword,
  isValidEmail,
  isValidUsername,
} from '../lib/auth/validation';
import { useFieldValidity } from './useFieldValidity';
import { useUsernameAvailability } from './useUsernameAvailability';

export type SignupFormValues = {
  firstName: string;
  lastName: string;
  username: string;
  organization: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type SignupValidationValues = Omit<SignupFormValues, 'organization'>;

const EMPTY_SIGNUP_VALUES: SignupFormValues = {
  firstName: '',
  lastName: '',
  username: '',
  organization: '',
  email: '',
  password: '',
  confirmPassword: '',
};

function sanitizePasswordInput(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\r\n]/g, '');
}

function getValidationValues(values: SignupFormValues): SignupValidationValues {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    username: values.username,
    email: values.email,
    password: values.password,
    confirmPassword: values.confirmPassword,
  };
}

function validateSignupField(
  field: keyof SignupValidationValues,
  value: string,
  values: SignupValidationValues
): boolean {
  switch (field) {
    case 'firstName':
    case 'lastName':
      return value.trim().length >= 2;
    case 'username':
      return isValidUsername(value);
    case 'email':
      return isValidEmail(value);
    case 'password':
      return hasStrongPassword(value);
    case 'confirmPassword':
      return value === values.password && value.length > 0;
    default:
      return false;
  }
}

export function useSignupForm() {
  const [values, setValues] = useState<SignupFormValues>(EMPTY_SIGNUP_VALUES);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  const validationValues = useMemo(
    () => getValidationValues(values),
    [values]
  );
  const { fieldValidity, resetFieldValidity, updateFieldValidity, validateSingle } = useFieldValidity(
    validationValues,
    validateSignupField
  );
  const { checkingUsername, resetUsernameAvailability, usernameAvailable } = useUsernameAvailability(values.username);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (values.password) {
      setPasswordStrength(calculatePasswordStrength(values.password));
    } else {
      setPasswordStrength(0);
    }
  }, [values.password]);

  const passwordRequirementChecks = useMemo(
    () => getPasswordRequirementChecks(values.password),
    [values.password]
  );

  const updateValue = useCallback(
    (field: keyof SignupFormValues, nextValue: string) => {
      const resolvedValue = field === 'password' || field === 'confirmPassword'
        ? sanitizePasswordInput(nextValue)
        : field === 'firstName' || field === 'lastName' || field === 'organization'
          ? capitalizeFirstLetter(nextValue)
          : nextValue;
      const nextValues = { ...values, [field]: resolvedValue };
      const nextValidationValues = getValidationValues(nextValues);

      setValues(nextValues);

      if (field !== 'organization') {
        updateFieldValidity(field as keyof SignupValidationValues, resolvedValue, nextValidationValues);
      }

      if (field === 'password') {
        updateFieldValidity('confirmPassword', nextValidationValues.confirmPassword, nextValidationValues);
      }
    },
    [updateFieldValidity, values]
  );

  const resetForm = useCallback(() => {
    setValues(EMPTY_SIGNUP_VALUES);
    resetUsernameAvailability();
    resetFieldValidity();
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordRequirements(false);
    setPasswordStrength(0);
  }, [resetFieldValidity, resetUsernameAvailability]);

  const isFormReady = useMemo(
    () =>
      validateSingle('firstName', validationValues.firstName, validationValues) &&
      validateSingle('lastName', validationValues.lastName, validationValues) &&
      validateSingle('username', validationValues.username, validationValues) &&
      validateSingle('email', validationValues.email, validationValues) &&
      validateSingle('password', validationValues.password, validationValues) &&
      validateSingle('confirmPassword', validationValues.confirmPassword, validationValues) &&
      usernameAvailable === true &&
      !checkingUsername,
    [checkingUsername, usernameAvailable, validateSingle, validationValues]
  );

  return {
    checkingUsername,
    fieldValidity,
    isFormReady,
    mounted,
    passwordRequirementChecks,
    passwordStrength,
    resetForm,
    resetUsernameAvailability,
    setShowConfirmPassword,
    setShowPassword,
    setShowPasswordRequirements,
    showConfirmPassword,
    showPassword,
    showPasswordRequirements,
    updateValue,
    usernameAvailable,
    validateSingle,
    values,
  };
}