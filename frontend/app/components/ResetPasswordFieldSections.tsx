'use client';

import type { ReactNode } from 'react';

type BaseFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inputClassName: string;
  placeholder: string;
  required?: boolean;
};

type BasicFieldSectionProps = BaseFieldProps & {
  containerClassName?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  type?: 'email' | 'text';
};

type PasswordFieldSectionProps = BaseFieldProps & {
  wrapperClassName: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  mounted: boolean;
  showPassword: boolean;
  toggleButton: ReactNode;
};

type PasswordStrengthMeterProps = {
  visible: boolean;
  containerClassName: string;
  headerClassName: string;
  labelClassName: string;
  valueClassName: string;
  meterClassName: string;
  barClassName: string;
  strengthText: string;
};

export function ResetPasswordBasicFieldSection({
  containerClassName,
  inputRef,
  type = 'text',
  value,
  onChange,
  onBlur,
  onKeyDown,
  inputClassName,
  placeholder,
  required = true,
}: BasicFieldSectionProps) {
  return (
    <div className={containerClassName}>
      <input
        ref={inputRef}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={event => onBlur(event.target.value)}
        onKeyDown={onKeyDown}
        className={inputClassName}
        required={required}
      />
    </div>
  );
}

export function ResetPasswordFieldSection({
  wrapperClassName,
  inputRef,
  mounted,
  showPassword,
  toggleButton,
  value,
  onChange,
  onBlur,
  onKeyDown,
  inputClassName,
  placeholder,
  required = true,
}: PasswordFieldSectionProps) {
  return (
    <div className={wrapperClassName}>
      <input
        ref={inputRef}
        type={mounted && showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={event => onBlur(event.target.value)}
        onKeyDown={onKeyDown}
        className={inputClassName}
        required={required}
      />
      {mounted ? toggleButton : null}
    </div>
  );
}

export function ResetPasswordStrengthMeter({
  visible,
  containerClassName,
  headerClassName,
  labelClassName,
  valueClassName,
  meterClassName,
  barClassName,
  strengthText,
}: PasswordStrengthMeterProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className={containerClassName}>
      <div className={headerClassName}>
        <span className={labelClassName}>Password Strength</span>
        <span className={valueClassName}>{strengthText}</span>
      </div>
      <div className={meterClassName}>
        <div className={barClassName}></div>
      </div>
    </div>
  );
}