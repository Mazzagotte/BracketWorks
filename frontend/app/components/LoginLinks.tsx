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
          color: '#6b7280',
          background: '#f9fafb',
          border: '1px solid #e5e7eb'
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
          color: '#f0a500',
          background: 'rgba(240, 165, 0, 0.08)',
          border: '1px solid rgba(240, 165, 0, 0.2)'
        }}
      >
        Forgot Password?
      </a>
    </div>
  );
};

export default LoginLinks;
