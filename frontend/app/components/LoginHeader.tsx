'use client';

import React from 'react';

import Image from 'next/image';






interface LoginHeaderProps {
  className?: string;
  style?: React.CSSProperties;
}

export const LoginHeader: React.FC<LoginHeaderProps> = ({ 
  className,
  style 
}) => {
  return (
    <div 
      className={`header-section ${className || ''}`} 
      style={{ 
        textAlign: 'center', 
        marginBottom: '32px',
        ...style 
      }}
    >
      <div className="logo-container" style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '80px',
        height: '80px',
        margin: '0 auto 24px auto',
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(240, 165, 0, 0.1) 0%, rgba(240, 165, 0, 0.05) 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(240, 165, 0, 0.15)'
      }}>
        <Image 
          src="/logo.png" 
          alt="BracketWorks Logo" 
          width={72} 
          height={72} 
          style={{ borderRadius: '16px' }}
        />
      </div>
      
      <h1 className="login-title" style={{
        fontSize: '32px',
        fontWeight: 700,
        margin: '0 0 12px 0',
        background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 25%, #4a5568 50%, #f0a500 75%, #ff9800 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.5px',
        lineHeight: 1.2
      }}>
        BracketWorks
      </h1>
      
      <div className="login-subtitle" style={{
        color: '#6b7280',
        fontSize: '16px',
        fontWeight: 500,
        margin: '0 0 32px 0',
        lineHeight: 1.5
      }}>
        Bowling Brackets & Side Pots
      </div>
    </div>
  );
};

export default LoginHeader;
