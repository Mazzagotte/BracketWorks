"use client";

import { useEffect, useState } from 'react';
import { colors, rgba } from './styles/colors';
import './styles/globals.css';
import './styles/colors.global.css';
import './styles/login.css';

import Sidebar from '../components/Sidebar';
import ModernHeader from './components/ModernHeader';
import { MobileNav } from '../components/MobileNav';
import { ToastProvider, ToastContainer, SkipNavigation } from './components';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth, useIsAuthenticated } from './lib/auth-context';
import { HeaderProvider, useHeader } from './lib/header-context';
import { logger } from './lib/logger';
import { ApiHealthCheck } from './components/ApiHealthCheck';
import { DevAuthStatus } from './components/DevAuthStatus';



function ClientLayout({ children }: { children: React.ReactNode }) {
  // All hooks must be called before any conditional returns
  const auth = useAuth(); // Get auth directly
  const headerContext = useHeader();
  const [isLoginPage, setIsLoginPage] = useState(false);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const pathname = window.location.pathname;
    setIsLoginPage(pathname === '/login' || pathname.startsWith('/reset-password'));
    setCurrentPage(pathname.slice(1) || 'dashboard'); // Remove leading slash
    
    // Enhanced mobile detection with better breakpoints
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobileWidth = width <= 768;
      const isMobileHeight = height <= 800;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileWidth || (isMobileHeight && isTouchDevice));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update login page detection when authenticated to handle cases where user logs in but hasn't redirected yet
  useEffect(() => {
    if (auth.isAuthenticated) {
      setIsLoginPage(false);
    }
  }, [auth.isAuthenticated]);

  // Update firstName whenever auth state changes
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const storedFirstName = localStorage.getItem('first_name') || auth.user.name || undefined;
      setFirstName(storedFirstName);
      logger.info('🔐 Layout: Auth state updated', { 
        isAuthenticated: auth.isAuthenticated, 
        hasUser: !!auth.user, 
        firstName: storedFirstName,
        userId: auth.user?.id 
      });
    } else {
      setFirstName(undefined);
      logger.info('🔐 Layout: Auth state cleared', { 
        isAuthenticated: auth.isAuthenticated, 
        hasUser: !!auth.user 
      });
    }
  }, [auth.isAuthenticated, auth.user]);

  // Additional effect for sidebar management
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobile, sidebarOpen]);

  // Simple authentication check - trust the auth context
  const isUserAuthenticated = mounted && auth.isAuthenticated;
  
  // Debug logging for auth state
  useEffect(() => {
    if (mounted) {
      logger.info('🔍 Layout render - Auth State:', {
        mounted,
        'auth.isAuthenticated': auth.isAuthenticated,
        'auth.user': auth.user,
        'auth.token': !!auth.token,
        isUserAuthenticated,
        isLoginPage,
        firstName
      });
    }
  }, [mounted, auth.isAuthenticated, auth.user, auth.token, isUserAuthenticated, isLoginPage, firstName]);

  // Prevent hydration mismatch by not rendering dynamic content until mounted
  if (!mounted) {
    return (
      <ToastProvider>
        <ErrorBoundary>
          <SkipNavigation />
          <div id="main-content">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
          <ToastContainer />
          <ApiHealthCheck />
          <DevAuthStatus />
        </ErrorBoundary>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
        <SkipNavigation />
        
        {isLoginPage ? (
          <div id="main-content">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        ) : (
        <>
          {/* Desktop Sidebar - Only show when authenticated */}
          {!isMobile && isUserAuthenticated && (
            <Sidebar 
              firstName={firstName} 
              isMobile={false}
              isOpen={true}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          {/* Mobile Navigation */}
          {isMobile && isUserAuthenticated && (
            <MobileNav
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              firstName={firstName}
              currentPage={currentPage}
            />
          )}
          
          {/* Enhanced Mobile Header */}
          {isMobile && isUserAuthenticated && (
            <header 
              className="mobile-header"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '60px',
                background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                zIndex: 997,
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  background: rgba(colors.brand.gold, 0.1),
                  border: `1px solid ${rgba(colors.brand.gold, 0.3)}`,
                  borderRadius: '12px',
                  color: colors.brand.gold,
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onTouchStart={(changeEvent) => { 
                  changeEvent.currentTarget.style.backgroundColor = rgba(colors.brand.gold, 0.2);
                  changeEvent.currentTarget.style.transform = 'scale(0.95)';
                }}
                onTouchEnd={(changeEvent) => { 
                  changeEvent.currentTarget.style.backgroundColor = rgba(colors.brand.gold, 0.1);
                  changeEvent.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ☰
              </button>
              
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <h1 style={{
                  color: colors.white,
                  fontSize: '18px',
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: '0.5px'
                }}>
                  BracketWorks
                </h1>
              </div>

              {/* Page indicator */}
              <div style={{
                fontSize: '12px',
                color: colors.gray[400],
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '4px 8px',
                borderRadius: '6px',
                textTransform: 'capitalize'
              }}>
                {currentPage}
              </div>
            </header>
          )}
          
          <main 
            id="main-content"
            style={{ 
              marginLeft: !isMobile ? '260px' : '0',
              marginTop: isMobile && isUserAuthenticated ? '60px' : '0',
              minHeight: isMobile && isUserAuthenticated ? 'calc(100vh - 60px)' : '100vh',
              width: !isMobile ? 'calc(100% - 260px)' : '100%',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
              padding: isMobile ? '16px' : '24px',
              boxSizing: 'border-box',
              overflowX: 'hidden'
            }}
            suppressHydrationWarning={true}
          >
            {/* Modern Header for authenticated pages */}
            {mounted && isUserAuthenticated && (
              <ModernHeader 
                title={headerContext.title}
                subtitle={headerContext.subtitle}
                actions={headerContext.actions}
                centerContent={headerContext.centerContent}
                showBreadcrumbs={headerContext.showBreadcrumbs}
                breadcrumbs={headerContext.breadcrumbs}
              />
            )}
            
            {/* Page Content - White card container */}
            <div 
              style={{ 
                background: colors.white,
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '20px' : '24px',
                paddingTop: mounted && isUserAuthenticated ? '20px' : '20px',
                maxWidth: '1200px',
                margin: mounted && isUserAuthenticated ? '20px auto 0 auto' : '0 auto',
                marginBottom: '0',
                boxSizing: 'border-box'
              }}
              suppressHydrationWarning={true}
            >
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </>
      )}
      
      {/* Development Authentication Status Indicator - Upper Right */}
      <DevAuthStatus />
      
      <ToastContainer />
      </ErrorBoundary>
    </ToastProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content={colors.brand.gold} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BracketWorks" />
        
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        
        {/* Favicon configuration */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Additional favicon sizes for better compatibility */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-192.png" />
      </head>
      <body>
        <AuthProvider>
          <HeaderProvider>
            <AuthAwareLayout>{children}</AuthAwareLayout>
          </HeaderProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

// Separate component that's aware of auth changes
function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [authKey, setAuthKey] = useState(0);
  
  // Force re-render when auth state changes
  useEffect(() => {
    setAuthKey(prev => prev + 1);
    logger.info('🔄 AuthAwareLayout: Auth state changed, forcing re-render', {
      isAuthenticated: auth.isAuthenticated,
      hasUser: !!auth.user,
      authKey: authKey + 1
    });
  }, [auth.isAuthenticated, auth.user]);
  
  return <ClientLayout key={authKey}>{children}</ClientLayout>;
}


