'use client';

import React, { useState, useRef } from 'react';





interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => Promise<void> | void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
}

export default function EnhancedButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  loading = false
}: ButtonProps) {
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ripples, setRipples] = useState<Array<{id: number, x: number, y: number}>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const baseStyles = `
    relative overflow-hidden
    font-semibold
    transition-all duration-300 ease-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:cursor-not-allowed
    transform-gpu border-0
    ${className}
  `;

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  // Define comprehensive style objects for each variant
  const getVariantStyles = (variant: 'primary' | 'secondary' | 'success' | 'danger' | 'glass') => {
    const baseButtonStyle = {
      borderRadius: '12px',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      border: 'none',
      outline: 'none',
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseButtonStyle,
          background: 'linear-gradient(135deg, #f0a500 0%, #e6941a 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(240, 165, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(240, 165, 0, 0.2)',
        };
      case 'secondary':
        return {
          ...baseButtonStyle,
          background: 'linear-gradient(135deg, rgba(240, 165, 0, 0.9) 0%, rgba(230, 148, 26, 0.85) 100%)',
          backdropFilter: 'blur(8px)',
          border: '2px solid rgba(240, 165, 0, 1)',
          color: '#ffffff',
          fontWeight: '700',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
          boxShadow: '0 4px 12px rgba(240, 165, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)',
        };
      case 'success':
        return {
          ...baseButtonStyle,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        };
      case 'danger':
        return {
          ...baseButtonStyle,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
        };
      case 'glass':
        return {
          ...baseButtonStyle,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(240, 165, 0, 0.3)',
          color: '#374151',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        };
      default:
        return baseButtonStyle;
    }
  };

  const createRipple = (event: React.MouseEvent) => {
    if (buttonRef.current && !disabled && buttonState === 'idle') {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const newRipple = {
        id: Date.now(),
        x,
        y
      };
      
      setRipples(prev => [...prev, newRipple]);
      
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
      }, 600);
    }
  };

  const handleClick = async (event: React.MouseEvent) => {
    createRipple(event);
    
    if (!disabled && onClick && buttonState === 'idle') {
      try {
        setButtonState('loading');
        const result = onClick();
        
        if (result instanceof Promise) {
          await result;
        }
        
        setButtonState('success');
        setTimeout(() => setButtonState('idle'), 2000);
      } catch (error) {
        setButtonState('error');
        setTimeout(() => setButtonState('idle'), 3000);
      }
    }
  };

  const currentState = loading ? 'loading' : buttonState;
  const isDisabled = disabled || currentState === 'loading';
  const variantStyles = getVariantStyles(variant);

  return (
    <button
      ref={buttonRef}
      type={type}
      className={`
        ${baseStyles} 
        ${sizeStyles[size]} 
        ${!isDisabled ? 'hover:transform hover:scale-105 active:scale-95' : 'opacity-60'}
      `}
      style={{
        ...variantStyles,
        // Override for button states
        ...(currentState === 'success' && {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: '#ffffff',
        }),
        ...(currentState === 'error' && {
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ffffff',
        }),
        ...(currentState === 'loading' && {
          opacity: 0.8,
        }),
        ...(isDisabled && {
          opacity: 0.6,
          cursor: 'not-allowed',
        }),
      }}
      onClick={handleClick}
      disabled={isDisabled}
    >
      {/* Ripple Effects */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
            animationDuration: '0.6s',
            backgroundColor: 'rgba(240, 165, 0, 0.4)'
          }}
        />
      ))}

      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {/* Loading State */}
        {currentState === 'loading' && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
              fill="none"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Success State */}
        {currentState === 'success' && (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}

        {/* Error State */}
        {currentState === 'error' && (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}

        {/* Button Text */}
        <span>
          {currentState === 'loading' && 'Loading...'}
          {currentState === 'success' && 'Success!'}
          {currentState === 'error' && 'Error'}
          {currentState === 'idle' && children}
        </span>
      </span>

      {/* Gradient Overlay for Hover Effect */}
      <div 
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-lg"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(240, 165, 0, 0.2), transparent)'
        }}
      />
    </button>
  );
}
