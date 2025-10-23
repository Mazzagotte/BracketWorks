import React, { useState, useEffect } from 'react';

import { useAuth } from '../app/lib/auth-context';
import { logger } from '../app/lib/logger';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  firstName?: string;
  currentPage?: string;
}

export function MobileNav({ isOpen, onClose, firstName, currentPage }: MobileNavProps) {
  const { logout } = useAuth();
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/players', label: 'Entries', icon: '👥' },
    { href: '/scores', label: 'Scores', icon: '🏆' },
    { href: '/brackets', label: 'Brackets', icon: '🏅' },
    { href: '/payouts', label: 'Payouts', icon: '💰' },
  ];

  const handleLogout = () => {
    logger.userAction('User logged out via mobile nav');
    logout();
    window.location.href = '/login';
  };

  // Handle swipe to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    
    const touchEndY = e.touches[0].clientY;
    const diff = touchStartY - touchEndY;
    
    // Swipe up to close (threshold of 50px)
    if (diff > 50) {
      onClose();
      setTouchStartY(null);
    }
  };

  // Prevent background scroll when nav is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="mobile-nav-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          backdropFilter: 'blur(4px)'
        }}
      />
      
      {/* Navigation Panel */}
      <nav
        className="mobile-nav-panel"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{
          position: 'fixed',
          left: 0,
          top: '60px',
          width: '100%',
          height: 'calc(100vh - 60px)',
          backgroundColor: '#1a1f2e',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideDown 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            color: '#f0a500',
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            Welcome back!
          </div>
          {firstName && (
            <div style={{
              color: '#ffffff',
              fontSize: '16px'
            }}>
              {firstName}
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div style={{
          flex: 1,
          padding: '20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.href.slice(1);
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 20px',
                  color: isActive ? '#f0a500' : '#ffffff',
                  backgroundColor: isActive ? 'rgba(240, 165, 0, 0.1)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: isActive ? 600 : 400,
                  borderLeft: isActive ? '4px solid #f0a500' : '4px solid transparent',
                  transition: 'all 0.2s ease'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.backgroundColor = isActive ? 'rgba(240, 165, 0, 0.1)' : 'transparent';
                }}
              >
                <span style={{ marginRight: '12px', fontSize: '18px' }}>
                  {item.icon}
                </span>
                {item.label}
              </a>
            );
          })}
        </div>

        {/* Logout Button */}
        <div style={{ padding: '20px' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#f0a500',
              color: '#1a1f2e',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.backgroundColor = '#ff9800';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.backgroundColor = '#f0a500';
            }}
          >
            Logout
          </button>
        </div>

        {/* Swipe Indicator */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40px',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '2px'
        }} />
      </nav>

      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}