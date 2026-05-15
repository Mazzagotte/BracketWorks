import { API } from '../api';
import { getErrorMessage } from '../error-utils';
import { getEmailValidationError, hasStrongPassword } from './validation';

export type SignupPayload = {
  firstName: string;
  lastName: string;
  username: string;
  organization: string;
  email: string;
  password: string;
};

export type SignupResult = {
  successMessage: string;
};

type SignupValidationPayload = SignupPayload & {
  confirmPassword: string;
  usernameAvailable?: boolean | null;
  checkingUsername?: boolean;
};

export function getSignupValidationError(payload: SignupValidationPayload): string {
  if (!payload.firstName.trim()) return 'First name is required';
  if (!payload.lastName.trim()) return 'Last name is required';
  if (!payload.username.trim()) return 'Username is required';
  if (!payload.email.trim()) return 'Email is required';
  if (!payload.password.trim()) return 'Password is required';
  if (!hasStrongPassword(payload.password)) {
    return 'Password must be at least 6 characters and include uppercase, lowercase, number, and special character';
  }
  if (payload.password !== payload.confirmPassword) return 'Passwords do not match';

  const emailError = getEmailValidationError(payload.email);
  if (emailError) return emailError;
  if (payload.usernameAvailable === false) return 'Username is taken';
  if (payload.checkingUsername || payload.usernameAvailable === null) {
    return 'Please wait for username availability check to complete';
  }

  return '';
}

export async function submitSignup(payload: SignupPayload): Promise<SignupResult> {
  try {
    const response = await fetch(API('/api/v1/users/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: payload.firstName.trim(),
        last_name: payload.lastName.trim(),
        username: payload.username.trim(),
        organization: payload.organization.trim() || undefined,
        email: payload.email.trim(),
        password: payload.password,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        throw new Error('Username or email already exists');
      }
      throw new Error(typeof data.detail === 'string' && data.detail ? data.detail : 'Signup failed');
    }

    return {
      successMessage: `Welcome ${payload.firstName}! Your account is ready. Check your email for your welcome message and verification link.`,
    };
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(`Network error: ${getErrorMessage(error) || 'Please check your connection'}`);
  }
}