export type PasswordRequirementChecks = {
  minLength: boolean;
  lower: boolean;
  upper: boolean;
  number: boolean;
  special: boolean;
};

type PasswordValidationOptions = {
  minLength?: number;
  requiredMessage?: string;
  unmetMessage?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[a-zA-Z0-9_]+$/;

export function isValidEmail(value: string): boolean {
  return emailRegex.test(value.trim());
}

export function getEmailValidationError(
  value: string,
  requiredMessage = "Email is required",
  invalidMessage = "Please enter a valid email address"
): string {
  if (!value.trim()) return requiredMessage;
  return isValidEmail(value) ? "" : invalidMessage;
}

export function isValidUsername(value: string): boolean {
  return value.trim().length >= 3 && usernameRegex.test(value);
}

export function hasMinimumPasswordLength(value: string, minLength = 6): boolean {
  return value.length >= minLength;
}

export function getPasswordRequirementChecks(password: string, minLength = 6): PasswordRequirementChecks {
  return {
    minLength: password.length >= minLength,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function hasStrongPassword(password: string, minLength = 6): boolean {
  const checks = getPasswordRequirementChecks(password, minLength);
  return checks.minLength && checks.lower && checks.upper && checks.number && checks.special;
}

export function calculatePasswordStrength(password: string, minLength = 6): number {
  let strength = 0;
  if (password.length >= minLength) strength += 1;
  if (password.length >= 10) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  return Math.min(strength, 5);
}

export function calculatePasswordStrengthPercent(password: string, minLength = 6): number {
  if (!password) return 0;

  const checks = getPasswordRequirementChecks(password, minLength);
  const metChecks = Object.values(checks).filter(Boolean).length;
  return Math.round((metChecks / Object.keys(checks).length) * 100);
}

export function getPasswordValidationError(
  value: string,
  options: PasswordValidationOptions = {}
): string {
  const {
    minLength = 6,
    requiredMessage = "Password is required",
    unmetMessage = "Password does not meet requirements",
  } = options;

  if (!value) return requiredMessage;
  return hasStrongPassword(value, minLength) ? "" : unmetMessage;
}

export function getResetCodeValidationError(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "Reset code is required";
  if (trimmedValue.length < 4) return "Reset code is too short";
  if (trimmedValue.length > 10) return "Reset code is too long";
  return "";
}