import React, { useState, useEffect } from 'react';

import { logger } from '../app/lib/logger';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  headerActions?: React.ReactNode;
  fullWidth?: boolean;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export function MobileLayout({
  children,
  title,
  subtitle,
  showBackButton = false,
  onBack,
  headerActions,
  fullWidth = false,
  padding = 'medium'
}: MobileLayoutProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBackClick = () => {
    logger.userAction('Back button clicked', { currentTitle: title });
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const paddingValue = {
    none: '0',
    small: '12px',
    medium: '16px',
    large: '24px'
  }[padding];

  return (
    <div className="mobile-layout">
      {(title || showBackButton || headerActions) && (
        <header className={`mobile-header ${isScrolled ? 'scrolled' : ''}`}>
          <div className="mobile-header-content">
            <div className="mobile-header-left">
              {showBackButton && (
                <button
                  onClick={handleBackClick}
                  className="mobile-back-button"
                  aria-label="Go back"
                >
                  ←
                </button>
              )}
              <div className="mobile-header-text">
                {title && <h1 className="mobile-title">{title}</h1>}
                {subtitle && <p className="mobile-subtitle">{subtitle}</p>}
              </div>
            </div>
            
            {headerActions && (
              <div className="mobile-header-actions">
                {headerActions}
              </div>
            )}
          </div>
        </header>
      )}

      <main 
        className={`mobile-main ${fullWidth ? 'full-width' : ''}`}
        style={{ 
          padding: paddingValue,
          paddingTop: (title || showBackButton || headerActions) 
            ? `calc(${paddingValue} + 80px)` 
            : paddingValue
        }}
      >
        {children}
      </main>

      <style jsx>{`
        .mobile-layout {
          min-height: 100vh;
          background: #f8f9fb;
          position: relative;
        }

        .mobile-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(229, 231, 235, 0.8);
          z-index: 100;
          transition: all 0.2s ease;
        }

        .mobile-header.scrolled {
          background: rgba(255, 255, 255, 0.98);
          border-bottom-color: #e5e7eb;
          box-shadow: 0 1px 8px rgba(0, 0, 0, 0.1);
        }

        .mobile-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          max-width: 100%;
          margin: 0 auto;
        }

        .mobile-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0; /* Allow text truncation */
        }

        .mobile-back-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #f3f4f6;
          color: #1a1f2e;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .mobile-back-button:hover {
          background: #e5e7eb;
          transform: translateX(-2px);
        }

        .mobile-back-button:active {
          background: #d1d5db;
          transform: translateX(0);
        }

        .mobile-header-text {
          flex: 1;
          min-width: 0;
        }

        .mobile-title {
          font-size: 20px;
          font-weight: 700;
          color: #1a1f2e;
          margin: 0;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 2px 0 0 0;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .mobile-main {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .mobile-main.full-width {
          max-width: none;
        }

        /* Responsive adjustments */
        @media (max-width: 480px) {
          .mobile-header-content {
            padding: 12px 16px;
          }
          
          .mobile-title {
            font-size: 18px;
          }
          
          .mobile-subtitle {
            font-size: 13px;
          }
          
          .mobile-back-button {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }
        }

        /* Safe area support for modern mobile devices */
        @supports (padding: max(0px)) {
          .mobile-header {
            padding-left: max(0px, env(safe-area-inset-left));
            padding-right: max(0px, env(safe-area-inset-right));
            padding-top: max(0px, env(safe-area-inset-top));
          }
          
          .mobile-main {
            padding-left: max(${paddingValue}, env(safe-area-inset-left));
            padding-right: max(${paddingValue}, env(safe-area-inset-right));
            padding-bottom: max(${paddingValue}, env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}

// Mobile-optimized container component
interface MobileContainerProps {
  children: React.ReactNode;
  maxWidth?: 'small' | 'medium' | 'large' | 'full';
  padding?: boolean;
  background?: 'transparent' | 'white' | 'gray';
  rounded?: boolean;
  shadow?: boolean;
}

export function MobileContainer({
  children,
  maxWidth = 'large',
  padding = true,
  background = 'transparent',
  rounded = false,
  shadow = false
}: MobileContainerProps) {
  const maxWidthValue = {
    small: '400px',
    medium: '600px',
    large: '800px',
    full: '100%'
  }[maxWidth];

  const backgroundColor = {
    transparent: 'transparent',
    white: '#ffffff',
    gray: '#f8f9fb'
  }[background];

  return (
    <div className="mobile-container">
      {children}
      
      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: ${maxWidthValue};
          margin: 0 auto;
          padding: ${padding ? '16px' : '0'};
          background: ${backgroundColor};
          border-radius: ${rounded ? '12px' : '0'};
          box-shadow: ${shadow ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'};
        }

        @media (max-width: 480px) {
          .mobile-container {
            padding: ${padding ? '12px' : '0'};
            border-radius: ${rounded ? '8px' : '0'};
          }
        }
      `}</style>
    </div>
  );
}

// Mobile-optimized grid component
interface MobileGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'small' | 'medium' | 'large';
  breakpoint?: '480px' | '640px' | '768px';
}

export function MobileGrid({
  children,
  columns = 1,
  gap = 'medium',
  breakpoint = '640px'
}: MobileGridProps) {
  const gapValue = {
    small: '8px',
    medium: '16px',
    large: '24px'
  }[gap];

  return (
    <div className="mobile-grid">
      {children}
      
      <style jsx>{`
        .mobile-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${gapValue};
        }

        @media (min-width: ${breakpoint}) {
          .mobile-grid {
            grid-template-columns: repeat(${columns}, 1fr);
          }
        }
      `}</style>
    </div>
  );
}