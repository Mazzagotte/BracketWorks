import React, { useState } from 'react';
import styles from './MobileForm.module.css';

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
    <div className={styles.mobileFormField}>
      <label htmlFor={fieldId} className={styles.mobileFormLabel}>
        {icon && <span className={styles.fieldIcon}>{icon}</span>}
        {label}
        {required && <span className={styles.requiredIndicator}>*</span>}
      </label>

      <div className={`${styles.mobileInputContainer} ${focused ? styles.focused : ''} ${error ? styles.error : ''}`}>
        {type === 'select' ? (
          <select
            id={fieldId}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`${styles.mobileInput} ${styles.mobileSelect}`}
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
            className={`${styles.mobileInput} ${styles.mobileTextarea}`}
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
            className={`${styles.mobileInput} ${type === 'number' ? styles.mobileNumberInput : ''}`}
            required={required}
            inputMode={inputMode || (type === 'number' ? 'numeric' : 'text')}
            autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'off'}
          />
        )}
      </div>

      {error && (
        <div className={styles.mobileFieldError}>
          {error}
        </div>
      )}

      {help && !error && (
        <div className={styles.mobileFieldHelp}>
          {help}
        </div>
      )}
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
    <div className={`${styles.mobileFormContainer} ${flat ? styles.mobileFormContainerFlat : ''} ${className}`}>
      {title && !flat && (
        <h2 className={styles.mobileFormTitle}>{title}</h2>
      )}
      
      <form onSubmit={handleSubmit} className={styles.mobileForm}>
        <div className={styles.mobileFormFields}>
          {children}
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`${styles.mobileFormSubmit} ${isSubmitting ? styles.mobileFormSubmitSubmitting : ''}`}
        >
          {isSubmitting ? (
            <>
              <span className={styles.loadingSpinner} />
              Submitting...
            </>
          ) : (
            submitText
          )}
        </button>
      </form>
    </div>
  );
}
