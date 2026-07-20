'use client';

/**
 * Login error handling and response parsing
 */

interface LoginErrorResult {
  message: string;
  delaySeconds: number;
}

/**
 * Parse login API response errors and determine appropriate messaging and delays
 */
export function parseLoginError(
  status: number,
  detail: string | undefined,
  failedAttempts: number
): LoginErrorResult {
  let message = detail || 'Login failed';
  let delaySeconds = 0;

  if (status === 401) {
    if (!detail) {
      message = 'Invalid username or password';
    }
    if (failedAttempts >= 2) {
      delaySeconds = Math.min(30, Math.pow(2, failedAttempts - 1) + (failedAttempts > 3 ? 10 : 0));
    }
  } else if (status === 429) {
    if (!detail) {
      message = 'Too many login attempts. Please try again later.';
    }
    delaySeconds = 60;
  }

  if (delaySeconds > 0) {
    message += ` Please wait ${delaySeconds} seconds before trying again.`;
  }

  return { message, delaySeconds };
}

/**
 * Determine toast duration based on error severity
 */
export function getLoginErrorDuration(failedAttempts: number): number {
  if (failedAttempts >= 3) {
    return 8000;
  }
  return 6000;
}

/**
 * Parse fetch/network errors during login
 */
export function parseNetworkError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Unable to reach the API proxy. Verify Next.js is running and the backend is available.';
  }

  const message = error instanceof Error ? error.message : '';
  if (message.toLowerCase().includes('failed to fetch') || 
      message.toLowerCase().includes('network')) {
    return 'Unable to reach the API proxy. Verify Next.js is running and the backend is available.';
  }

  return `Login failed: ${message || 'Unexpected error'}`;
}
