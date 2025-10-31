"use client";

import React, { useState, useEffect } from 'react';

import { usePathname } from 'next/navigation';

import { useAuth } from '../lib/auth-context';





interface ModernHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showBreadcrumbs?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  centerContent?: boolean;
}

export default function ModernHeader({ 
  title, 
  subtitle, 
  actions, 
  showBreadcrumbs = false, 
  breadcrumbs = [], 
  centerContent = false 
}: ModernHeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get page title based on pathname
  const getPageTitle = () => {
    if (title) return title;
    
    const pathSegments = pathname.split('/').filter(Boolean);
    const currentPage = pathSegments[pathSegments.length - 1] || 'dashboard';
    
    const pageTitles: Record<string, string> = {
      'dashboard': 'Tournament Dashboard',
      'brackets': 'Tournament Brackets',
      'players': 'Player Management',
      'scores': 'Score Management',
      'payouts': 'Payout Distribution',
      'login': 'Login',
      'signup': 'Sign Up'
    };
    
    return pageTitles[currentPage] || currentPage.charAt(0).toUpperCase() + currentPage.slice(1);
  };

  // Get current time
  const getCurrentTime = () => {
    if (!mounted) return '';
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Get greeting based on time
  const getGreeting = () => {
    if (!mounted) return 'Welcome';
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = mounted ? (user?.name || localStorage.getItem('first_name') || 'User') : 'User';

  return (
    <header style={{
      background: 'linear-gradient(135deg, rgba(26, 31, 46, 0.98) 0%, rgba(45, 55, 72, 0.98) 50%, rgba(55, 65, 81, 0.98) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(240, 165, 0, 0.2)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(240, 165, 0, 0.1)',
      padding: '20px 0',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      width: '100%',
      maxWidth: '100%',
      borderRadius: '16px',
      margin: '8px 0',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      {/* Clean Status Indicator - Top Left to avoid overlap */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '20px',
        zIndex: 101
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '4px 8px',
          borderRadius: '12px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          backdropFilter: 'blur(8px)'
        }}>
          {/* Online Status */}
          <div style={{
            width: '5px',
            height: '5px',
            background: '#10b981',
            borderRadius: '50%',
            boxShadow: '0 0 3px rgba(16, 185, 129, 0.6)'
          }} />
          
          {/* Status Text */}
          <span style={{
            fontSize: '9px',
            color: '#10b981',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>
            ONLINE
          </span>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '0 16px' : '0 24px',
        paddingTop: '12px', // Add space to avoid status indicator
        boxSizing: 'border-box'
      }}>
        {/* Main header content - forced column layout */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%'
        }}>
          {/* Top row: Title and user info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            {/* Left: Page Title and Tournament Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <h1 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: 700,
                margin: 0,
                background: 'linear-gradient(135deg, #fff 0%, #f0a500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.4px',
                lineHeight: '1.2'
              }}>
                {getPageTitle()}
              </h1>
              {subtitle && (
                <p style={{
                  margin: 0,
                  fontSize: isMobile ? '12px' : '13px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: 500,
                  lineHeight: '1.4'
                }}>
                  {subtitle}
                </p>
              )}
            </div>

            {/* Right: User info - compact */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px'
            }}>
              {/* Time - more compact */}
              {!isMobile && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1px',
                  padding: '6px 10px',
                  background: 'rgba(240, 165, 0, 0.06)',
                  borderRadius: '6px',
                  border: '1px solid rgba(240, 165, 0, 0.12)'
                }}>
                  <span 
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontWeight: 600
                    }}
                    suppressHydrationWarning
                  >
                    {mounted ? new Date().toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    }) : 'Wed, Oct 8'}
                  </span>
                  <span 
                    style={{
                      fontSize: '9px',
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontWeight: 500
                    }}
                    suppressHydrationWarning
                  >
                    {mounted ? getCurrentTime() : '12:00 PM'}
                  </span>
                </div>
              )}

              {/* User greeting - compact */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '1px'
              }}>
                <span 
                  style={{
                    fontSize: isMobile ? '10px' : '11px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontWeight: 500
                  }}
                  suppressHydrationWarning
                >
                  {mounted ? getGreeting() : 'Welcome'}
                </span>
                <span style={{
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#f0a500',
                  fontWeight: 600
                }}>
                  {firstName}
                </span>
              </div>

              {/* Avatar - smaller */}
              <div style={{
                width: isMobile ? '32px' : '36px',
                height: isMobile ? '32px' : '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f0a500 0%, #ff9800 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: 700,
                color: '#1a1f2e',
                boxShadow: '0 3px 10px rgba(240, 165, 0, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.transform = 'translateY(-1px)';
                changeEvent.currentTarget.style.boxShadow = '0 4px 12px rgba(240, 165, 0, 0.4)';
              }}
              onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.transform = 'translateY(0)';
                changeEvent.currentTarget.style.boxShadow = '0 3px 10px rgba(240, 165, 0, 0.3)';
              }}
              >
                {firstName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Actions Section - FORCED to new line */}
          {actions && (
            <div style={{
              width: '100%',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(240, 165, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

