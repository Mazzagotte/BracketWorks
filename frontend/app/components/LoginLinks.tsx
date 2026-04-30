'use client';

import React from 'react';





interface LoginLinksProps {
  className?: string;
  style?: React.CSSProperties;
}

export const LoginLinks: React.FC<LoginLinksProps> = ({ 
  className,
  style 
}) => {
  return (
    <div 
      className={`links-container ${className || ''}`} 
      style={{
        marginTop: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        ...style
      }}
    >
      <a 
        href="/signup" 
        className="signup-link" 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          borderRadius: '12px',
          transition: 'all 0.2s ease',
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-gray-50)',
          border: '1px solid var(--color-border)'
        }}
      >
        Create Account
      </a>
      
      <a 
        href="/reset-password/request" 
        className="forgot-link" 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          borderRadius: '12px',
          transition: 'all 0.2s ease',
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          color: 'var(--color-warning)',
          background: 'var(--color-yellow-light)',
          border: '1px solid var(--color-border-light)'
        }}
      >
        Forgot Password?
      </a>
    </div>
  );
};

export default LoginLinks;
