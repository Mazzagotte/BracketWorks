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
          ⚠️ {error}
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
          color: #1a1f2e;
          margin-bottom: 8px;
          gap: 8px;
        }

        .field-icon {
          font-size: 18px;
        }

        .required-indicator {
          color: #ef4444;
          margin-left: 4px;
        }

        .mobile-input-container {
          position: relative;
          border-radius: 12px;
          border: 2px solid #e5e7eb;
          background: #ffffff;
          transition: all 0.2s ease;
          overflow: hidden;
        }

        .mobile-input-container.focused {
          border-color: #4f8cff;
          box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
        }

        .mobile-input-container.error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .mobile-input {
          width: 100%;
          padding: 16px;
          font-size: 16px; /* Prevents zoom on iOS */
          border: none;
          background: transparent;
          color: #1a1f2e;
          outline: none;
          appearance: none;
          box-sizing: border-box;
        }

        .mobile-input::placeholder {
          color: #9ca3af;
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
          color: #ef4444;
          font-size: 14px;
          margin-top: 8px;
          padding: 8px 12px;
          background: #fef2f2;
          border-radius: 8px;
          border: 1px solid #fecaca;
        }

        .mobile-field-help {
          color: #6b7280;
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
            background: #374151;
            border-color: #4b5563;
          }
          
          .mobile-input {
            color: #f9fafb;
          }
          
          .mobile-input::placeholder {
            color: #9ca3af;
          }
          
          .mobile-form-label {
            color: #f9fafb;
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
}

export function MobileForm({ 
  children, 
  onSubmit, 
  title, 
  submitText = 'Submit',
  isSubmitting = false,
  className = ''
}: MobileFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logger.userAction('Form submitted', { formTitle: title });
    onSubmit(e);
  };

  return (
    <div className={`mobile-form-container ${className}`}>
      {title && (
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
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .mobile-form-title {
          font-size: 24px;
          font-weight: 700;
          color: #1a1f2e;
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
          color: #ffffff;
          background: linear-gradient(135deg, #4f8cff 0%, #6ed0fa 100%);
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
          box-shadow: 0 6px 20px rgba(79, 140, 255, 0.3);
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
          background: #9ca3af;
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
