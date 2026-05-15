'use client';

import type { KeyboardEventHandler, RefObject } from 'react';

type AuthValidatedInputFieldProps = {
  label: string;
  inputId: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  type?: 'email' | 'text' | 'password';
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  className: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  errorMessage?: string;
  successMessage?: string;
  containerClassName?: string;
  labelClassName?: string;
  errorId: string;
  successId: string;
};

export default function AuthValidatedInputField({
  label,
  inputId,
  inputRef,
  type = 'text',
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  placeholder,
  autoComplete,
  required = true,
  disabled = false,
  errorMessage,
  successMessage,
  containerClassName = 'input-container',
  labelClassName = 'input-label',
  errorId,
  successId,
}: AuthValidatedInputFieldProps) {
  const describedBy = errorMessage ? errorId : successMessage ? successId : undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={event => onBlur(event.target.value)}
        onKeyDown={onKeyDown}
        className={className}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={Boolean(errorMessage)}
      />
      {errorMessage ? (
        <div id={errorId} className="field-error" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div id={successId} className="field-success">
          {successMessage}
        </div>
      ) : null}
    </div>
  );
}