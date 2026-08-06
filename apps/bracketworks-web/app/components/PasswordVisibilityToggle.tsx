'use client';

import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordVisibilityToggle.module.css';

interface PasswordVisibilityToggleProps {
  isVisible: boolean;
  onToggle: () => void;
  disabled?: boolean;
  showText?: boolean;
  variant?: 'default' | 'compact';
}

export default function PasswordVisibilityToggle({
  isVisible,
  onToggle,
  disabled = false,
  showText = true,
  variant = 'default',
}: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${styles[variant]}`}
      onClick={onToggle}
      disabled={disabled}
      aria-label={isVisible ? "Hide password" : "Show password"}
      tabIndex={variant === 'compact' ? -1 : 0}
    >
      {isVisible ? (
        <EyeOff size={variant === 'compact' ? 16 : 15} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Eye size={variant === 'compact' ? 16 : 15} strokeWidth={2} aria-hidden="true" />
      )}
      {showText && (isVisible ? 'Hide' : 'Show')}
    </button>
  );
}
