'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './EnhancedButton.module.css';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => Promise<void> | void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  disableSuccessState?: boolean;
}

export default function EnhancedButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  loading = false,
  disableSuccessState = false
}: ButtonProps) {
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ripples, setRipples] = useState<Array<{id: number, x: number, y: number}>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const createRipple = (event: React.MouseEvent) => {
    if (buttonRef.current && !disabled && buttonState === 'idle') {
      const rect = buttonRef.current.getBoundingClientRect();
      const newRipple = { id: Date.now(), x: event.clientX - rect.left, y: event.clientY - rect.top };
      setRipples(prev => [...prev, newRipple]);
      setTimeout(() => {
        if (mountedRef.current) {
          setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }
      }, 600);
    }
  };

  const handleClick = async (event: React.MouseEvent) => {
    createRipple(event);
    if (!disabled && onClick && buttonState === 'idle') {
      if (disableSuccessState) {
        await onClick();
        return;
      }
      try {
        setButtonState('loading');
        const result = onClick();
        if (result instanceof Promise) await result;
        if (mountedRef.current) {
          setButtonState('success');
          setTimeout(() => { if (mountedRef.current) setButtonState('idle'); }, 2000);
        }
      } catch {
        if (mountedRef.current) {
          setButtonState('error');
          setTimeout(() => { if (mountedRef.current) setButtonState('idle'); }, 3000);
        }
      }
    }
  };

  const currentState = loading ? 'loading' : buttonState;
  const isDisabled = disabled || currentState === 'loading';

  const stateClass =
    currentState === 'success' ? styles.stateSuccess :
    currentState === 'error' ? styles.stateError :
    currentState === 'loading' ? styles.stateLoading :
    '';

  return (
    <button
      ref={buttonRef}
      type={type}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${stateClass} ${className}`}
      onClick={handleClick}
      disabled={isDisabled}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className={styles.ripple}
          style={{ left: ripple.x - 10, top: ripple.y - 10 }}
        />
      ))}

      <span className={styles.content}>
        {currentState === 'loading' && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {currentState === 'success' && (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {currentState === 'error' && (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
        <span>
          {currentState === 'loading' && 'Loading...'}
          {currentState === 'success' && 'Success!'}
          {currentState === 'error' && 'Error'}
          {currentState === 'idle' && children}
        </span>
      </span>

      <div className={styles.overlay} />
    </button>
  );
}
