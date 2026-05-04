import React, { useState } from 'react';

import { logger } from '../app/lib/logger';

interface MobileFormFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'email' | 'tel' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  icon?: string;
  help?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
}

export function MobileFormField({
  label,
  value,
  onChange,
  type = 'text',
  options = [],
  placeholder,
  required = false,
  error,
  icon,
  help,
  inputMode
}: MobileFormFieldProps) {
  const [focused, setFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (error) {
      // Clear error on change
      logger.debug('Field error cleared on change', { field: label });
    }
  };

  const fieldId = `mobile-field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="mobile-form-field">
      <label htmlFor={fieldId} className="mobile-form-label">
        {icon && <span className="field-icon">{icon}</span>}
        {label}
        {required && <span className="required-indicator">*</span>}
      </label>

      <div className={`mobile-input-container ${focused ? 'focused' : ''} ${error ? 'error' : ''}`}>
        {type === 'select' ? (
          <select
            id={fieldId}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="mobile-input"
            required={required}
          >
            <option value="">{placeholder || `Select ${label}`}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            id={fieldId}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className="mobile-input mobile-textarea"
            required={required}
            rows={3}
          />
        ) : (
          <input
            id={fieldId}
            type={type}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className="mobile-input"
            required={required}
            inputMode={inputMode || (type === 'number' ? 'numeric' : 'text')}
            autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'off'}
          />
        )}
      </div>

      {error && (
        <div className="mobile-field-error">
          {error}
        </div>
      )}

      {help && !error && (
        <div className="mobile-field-help">
          {help}
        </div>
      )}

      <style jsx>{`
        .mobile-form-field {
          margin-bottom: 20px;
          width: 100%;
        }

        .mobile-form-label {
          display: flex;
          align-items: center;
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 8px;
          gap: 8px;
        }

        .field-icon {
          font-size: 18px;
        }

        .required-indicator {
          color: var(--color-error);
          margin-left: 4px;
        }

        .mobile-input-container {
          position: relative;
          border-radius: 12px;
          border: 2px solid var(--color-gray-200);
          background: var(--color-white);
          transition: all 0.2s ease;
          overflow: hidden;
        }

        .mobile-input-container.focused {
          border-color: var(--color-blue-accent);
          box-shadow: var(--ring-blue);
        }

        .mobile-input-container.error {
          border-color: var(--color-error);
          box-shadow: 0 0 0 3px var(--color-error-input-bg);
        }

        .mobile-input {
          width: 100%;
          padding: 16px;
          font-size: 16px; /* Prevents zoom on iOS */
          border: none;
          background: transparent;
          color: var(--color-text-primary);
          outline: none;
          appearance: none;
          box-sizing: border-box;
        }

        .mobile-input::placeholder {
          color: var(--color-gray-400);
        }

        .mobile-textarea {
          resize: vertical;
          min-height: 80px;
          font-family: inherit;
        }

        /* Custom select styling */
        select.mobile-input {
          background-image: url("data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6,9 12,15 18,9'></polyline></svg>");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 40px;
          cursor: pointer;
        }

        .mobile-field-error {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-error);
          font-size: 14px;
          margin-top: 8px;
          padding: 8px 12px;
          background: var(--color-hc-error-bg);
          border-radius: 8px;
          border: 1px solid var(--color-error-border);
        }

        .mobile-field-help {
          color: var(--color-text-secondary);
          font-size: 14px;
          margin-top: 6px;
          padding-left: 4px;
        }

        /* Number input arrows removal for mobile */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }

        /* Enhanced touch targets */
        @media (hover: none) and (pointer: coarse) {
          .mobile-input {
            padding: 18px 16px;
            font-size: 16px;
          }
          
          .mobile-form-label {
            font-size: 17px;
            margin-bottom: 10px;
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .mobile-input-container {
            background: var(--color-gray-700);
            border-color: var(--color-dark-lighter);
          }
          
          .mobile-input {
            color: var(--color-gray-50);
          }
          
          .mobile-input::placeholder {
            color: var(--color-gray-400);
          }
          
          .mobile-form-label {
            color: var(--color-gray-50);
          }
        }
      `}</style>
    </div>
  );
}

interface MobileFormProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  title?: string;
  submitText?: string;
  isSubmitting?: boolean;
  className?: string;
  flat?: boolean;
}

export function MobileForm({ 
  children, 
  onSubmit, 
  title, 
  submitText = 'Submit',
  isSubmitting = false,
  className = '',
  flat = false
}: MobileFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logger.userAction('Form submitted', { formTitle: title });
    onSubmit(e);
  };

  return (
    <div className={`mobile-form-container ${flat ? 'mobile-form-container--flat' : ''} ${className}`}>
      {title && !flat && (
        <h2 className="mobile-form-title">{title}</h2>
      )}
      
      <form onSubmit={handleSubmit} className="mobile-form">
        <div className="mobile-form-fields">
          {children}
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`mobile-form-submit ${isSubmitting ? 'submitting' : ''}`}
        >
          {isSubmitting ? (
            <>
              <span className="loading-spinner" />
              Submitting...
            </>
          ) : (
            submitText
          )}
        </button>
      </form>

      <style jsx>{`
        .mobile-form-container {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
          background: var(--color-white);
          border-radius: 16px;
          box-shadow: 0 4px 16px var(--opacity-black-10);
        }

        .mobile-form-container--flat {
          background: transparent;
          border-radius: 0;
          box-shadow: none;
          padding: 20px 24px 8px;
          max-width: 100%;
        }

        .mobile-form-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 24px;
          text-align: center;
        }

        .mobile-form {
          width: 100%;
        }

        .mobile-form-fields {
          margin-bottom: 24px;
        }

        .mobile-form-submit {
          width: 100%;
          padding: 16px;
          font-size: 17px;
          font-weight: 600;
          color: var(--color-white);
          background: var(--gradient-blue-light);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 56px; /* Large touch target */
        }

        .mobile-form-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: var(--shadow-blue-md);
        }

        .mobile-form-submit:active {
          transform: translateY(0);
        }

        .mobile-form-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .mobile-form-submit.submitting {
          background: var(--color-gray-400);
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Enhanced spacing on smaller screens */
        @media (max-width: 480px) {
          .mobile-form-container {
            margin: 10px;
            padding: 16px;
            border-radius: 12px;
          }
          
          .mobile-form-title {
            font-size: 20px;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </div>
  );
}
