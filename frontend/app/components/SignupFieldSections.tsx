'use client';

import type { ReactNode } from 'react';

import type { PasswordRequirementChecks } from '../lib/auth/validation';

type NameFieldConfig = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  validBadge?: ReactNode;
  inputId?: string;
  inputName?: string;
  placeholder?: string;
  ariaLabel?: string;
};

type NameFieldsSectionProps = {
  containerClassName: string;
  fieldClassName: string;
  labelClassName: string;
  firstName: NameFieldConfig;
  lastName: NameFieldConfig;
};

type UsernameFieldSectionProps = {
  containerClassName: string;
  labelClassName: string;
  inputClassName: string;
  value: string;
  onChange: (value: string) => void;
  checking: boolean;
  availability: boolean | null;
  checkingIndicator?: ReactNode;
  availableIndicator?: ReactNode;
  takenIndicator?: ReactNode;
  inputId?: string;
  inputName?: string;
  placeholder?: string;
  ariaLabel?: string;
};

type PasswordSectionProps = {
  containerClassName: string;
  labelClassName: string;
  wrapperClassName: string;
  inputClassName: string;
  value: string;
  onChange: (value: string) => void;
  mounted: boolean;
  showPassword: boolean;
  onToggleVisibility: () => void;
  onFocus: () => void;
  onBlur: () => void;
  showRequirements: boolean;
  passwordStrength: number;
  passwordRequirementChecks: PasswordRequirementChecks;
  toggleButton?: ReactNode;
  strengthMeter?: ReactNode;
  requirementsPanel?: ReactNode;
  inputId?: string;
  inputName?: string;
  placeholder?: string;
  ariaLabel?: string;
};

type ConfirmPasswordSectionProps = {
  containerClassName: string;
  labelClassName: string;
  wrapperClassName: string;
  inputClassName: string;
  value: string;
  onChange: (value: string) => void;
  mounted: boolean;
  showPassword: boolean;
  onToggleVisibility: () => void;
  toggleButton?: ReactNode;
  validIndicator?: ReactNode;
  invalidIndicator?: ReactNode;
  inputId?: string;
  inputName?: string;
  placeholder?: string;
  ariaLabel?: string;
};

export function SignupNameFieldsSection({
  containerClassName,
  fieldClassName,
  labelClassName,
  firstName,
  lastName,
}: NameFieldsSectionProps) {
  return (
    <div className={containerClassName}>
      <div className={fieldClassName}>
        <label htmlFor={firstName.inputId} className={labelClassName}>{firstName.label}</label>
        <input
          type="text"
          id={firstName.inputId}
          name={firstName.inputName}
          placeholder={firstName.placeholder}
          value={firstName.value}
          onChange={event => firstName.onChange(event.target.value)}
          required
          className={firstName.inputClassName}
          aria-label={firstName.ariaLabel}
        />
        {firstName.validBadge}
      </div>
      <div className={fieldClassName}>
        <label htmlFor={lastName.inputId} className={labelClassName}>{lastName.label}</label>
        <input
          type="text"
          id={lastName.inputId}
          name={lastName.inputName}
          placeholder={lastName.placeholder}
          value={lastName.value}
          onChange={event => lastName.onChange(event.target.value)}
          required
          className={lastName.inputClassName}
          aria-label={lastName.ariaLabel}
        />
        {lastName.validBadge}
      </div>
    </div>
  );
}

export function SignupUsernameFieldSection({
  containerClassName,
  labelClassName,
  inputClassName,
  value,
  onChange,
  checking,
  availability,
  checkingIndicator,
  availableIndicator,
  takenIndicator,
  inputId,
  inputName,
  placeholder,
  ariaLabel,
}: UsernameFieldSectionProps) {
  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className={labelClassName}>Username:</label>
      <input
        type="text"
        id={inputId}
        name={inputName}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        autoComplete="username"
        required
        className={inputClassName}
        aria-label={ariaLabel}
      />
      {checking ? checkingIndicator : null}
      {availability === true ? availableIndicator : null}
      {availability === false ? takenIndicator : null}
    </div>
  );
}

export function SignupPasswordFieldSection({
  containerClassName,
  labelClassName,
  wrapperClassName,
  inputClassName,
  value,
  onChange,
  mounted,
  showPassword,
  onToggleVisibility,
  onFocus,
  onBlur,
  showRequirements,
  toggleButton,
  strengthMeter,
  requirementsPanel,
  inputId,
  inputName,
  placeholder,
  ariaLabel,
}: PasswordSectionProps) {
  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className={labelClassName}>Password:</label>
      <div className={wrapperClassName}>
        <input
          type={mounted && showPassword ? 'text' : 'password'}
          id={inputId}
          name={inputName}
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          autoComplete="new-password"
          required
          className={inputClassName}
          aria-label={ariaLabel}
        />
        {mounted ? toggleButton : null}
      </div>
      {value ? strengthMeter : null}
      {showRequirements ? requirementsPanel : null}
    </div>
  );
}

export function SignupConfirmPasswordFieldSection({
  containerClassName,
  labelClassName,
  wrapperClassName,
  inputClassName,
  value,
  onChange,
  mounted,
  showPassword,
  onToggleVisibility,
  toggleButton,
  validIndicator,
  invalidIndicator,
  inputId,
  inputName,
  placeholder,
  ariaLabel,
}: ConfirmPasswordSectionProps) {
  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className={labelClassName}>Confirm Password:</label>
      <div className={wrapperClassName}>
        <input
          type={mounted && showPassword ? 'text' : 'password'}
          id={inputId}
          name={inputName}
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
          autoComplete="new-password"
          required
          className={inputClassName}
          aria-label={ariaLabel}
        />
        {mounted ? toggleButton : null}
      </div>
      {value ? (validIndicator || invalidIndicator) : null}
    </div>
  );
}