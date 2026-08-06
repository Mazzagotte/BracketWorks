'use client';

/**
 * Shared validation utilities for authentication forms
 */

/**
 * Validates an email field with consistent error messaging
 */
export function validateEmail(
  value: string,
  requiredMessage: string = 'Email address is required',
  invalidMessage: string = 'Please enter a valid email address'
): string {
  if (!value || !value.trim()) {
    return requiredMessage;
  }

  const trimmed = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return invalidMessage;
  }

  return '';
}

/**
 * Validates a password field with consistent error messaging
 */
export function validatePassword(
  value: string,
  minLength: number = 8,
  requiredMessage: string = 'Password is required'
): string {
  if (!value) {
    return requiredMessage;
  }

  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }

  return '';
}

/**
 * Validates password confirmation field
 */
export function validatePasswordConfirm(
  confirmPassword: string,
  password: string
): string {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }

  if (confirmPassword !== password) {
    return 'Passwords do not match';
  }

  return '';
}

/**
 * Check if email validation error exists but other fields are valid
 * Used to show inline validation feedback
 */
export function hasEmailError(value: string, touched: boolean): boolean {
  if (!touched) return false;
  return validateEmail(value) !== '';
}
