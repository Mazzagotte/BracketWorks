import { API } from '../api';

type PasswordResetFetch = (input: string, init?: RequestInit) => Promise<Response>;

type PasswordResetFieldErrors = Partial<Record<'email' | 'code', string>>;

export class PasswordResetRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`);
    this.name = 'PasswordResetRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PasswordResetApiError extends Error {
  fieldErrors: PasswordResetFieldErrors;

  constructor(message: string, fieldErrors: PasswordResetFieldErrors = {}) {
    super(message);
    this.name = 'PasswordResetApiError';
    this.fieldErrors = fieldErrors;
  }
}

export type PasswordResetRequestResult = {
  cooldownSeconds: number;
  successMessage: string;
};

export type VerifyResetCodeResult = {
  redirectUrl: string;
  successMessage: string;
};

export type CompletePasswordResetResult = {
  redirectUrl: string;
  successMessage: string;
};

const NEUTRAL_PASSWORD_RESET_RESPONSE: PasswordResetRequestResult = {
  cooldownSeconds: 30,
  successMessage: 'If an account exists for this email, a password reset link has been sent.',
};

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function requestPasswordReset(
  email: string,
  fetcher: PasswordResetFetch = fetch
): Promise<PasswordResetRequestResult> {
  const response = await fetcher(API('/api/v1/users/request-password-reset'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterRaw = response.headers.get('Retry-After');
      const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : NaN;
      const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
      throw new PasswordResetRateLimitError(waitSeconds);
    }

    // Return the same neutral success response for non-429 failures to avoid account enumeration.
    return NEUTRAL_PASSWORD_RESET_RESPONSE;
  }

  return NEUTRAL_PASSWORD_RESET_RESPONSE;
}

export async function verifyResetCode(
  email: string,
  code: string,
  fetcher: PasswordResetFetch = fetch
): Promise<VerifyResetCodeResult> {
  const response = await fetcher(API('/api/v1/users/verify-reset-code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.trim() }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    if (response.status === 429) {
      throw new PasswordResetApiError('Too many attempts. Please try again later.');
    }

    if (response.status === 400) {
      throw new PasswordResetApiError('Invalid reset code', { code: 'Invalid code' });
    }

    if (response.status === 404) {
      throw new PasswordResetApiError('Email not found or code expired', { email: 'Email not found' });
    }

    if (typeof data.detail === 'string' && data.detail) {
      const normalizedDetail = data.detail.toLowerCase();

      if (normalizedDetail.includes('code')) {
        throw new PasswordResetApiError('Invalid or expired reset code', { code: 'Invalid or expired code' });
      }

      if (normalizedDetail.includes('email')) {
        throw new PasswordResetApiError('Email not found', { email: 'Email not found' });
      }

      throw new PasswordResetApiError(data.detail);
    }

    throw new PasswordResetApiError('Verification failed');
  }

  return {
    redirectUrl: `/reset-password?token=${encodeURIComponent(code)}${email.trim() ? `&email=${encodeURIComponent(email)}` : ''}`,
    successMessage: 'Code verified successfully! Redirecting to password reset...',
  };
}

export async function completePasswordReset(
  email: string,
  code: string,
  newPassword: string,
  fetcher: PasswordResetFetch = fetch
): Promise<CompletePasswordResetResult> {
  const normalizedEmail = email.trim();
  const response = await fetcher(API('/api/v1/users/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      code: code.trim(),
      new_password: newPassword,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new PasswordResetApiError(
      typeof data.detail === 'string' && data.detail ? data.detail : 'Failed to reset password'
    );
  }

  return {
    redirectUrl: '/login',
    successMessage: 'Your password has been reset successfully. You can now log in with your new password.',
  };
}