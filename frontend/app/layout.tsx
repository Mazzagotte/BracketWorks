"use client";

import './styles/globals.css';
import './styles/login.css';
import Sidebar from '../components/Sidebar';
import ModernHeader from './components/ModernHeader';
import { MobileNav } from '../components/MobileNav';
import { useEffect, useState } from 'react';
import { ToastProvider, ToastContainer, SkipNavigation } from './components';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth, useIsAuthenticated } from './lib/auth-context';
import { HeaderProvider, useHeader } from './lib/header-context';
import { logger } from './lib/logger';
import { ApiHealthCheck } from './components/ApiHealthCheck';

function ClientLayout({ children }: { children: React.ReactNode }) {
  // All hooks must be called before any conditional returns
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
    setFirstName(localStorage.getItem('first_name') || undefined);
    
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

  let user, isAuthenticated;
  
  try {
    const auth = useAuth();
    user = auth.user;
    isAuthenticated = auth.isAuthenticated;
  } catch (error) {
    console.error('Auth context error in ClientLayout:', error);
    // Return minimal layout during auth initialization
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading application...</div>
      </div>
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
          {/* Desktop Sidebar - Show for debugging auth issues */}
          {!isMobile && (
            <Sidebar 
              firstName={firstName} 
              isMobile={false}
              isOpen={true}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          {/* Mobile Navigation */}
          {isMobile && isAuthenticated && (
            <MobileNav
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              firstName={firstName}
              currentPage={currentPage}
            />
          )}
          
          {/* Enhanced Mobile Header */}
          {isMobile && isAuthenticated && (
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
                  background: 'rgba(240, 165, 0, 0.1)',
                  border: '1px solid rgba(240, 165, 0, 0.3)',
                  borderRadius: '12px',
                  color: '#f0a500',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.2)';
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
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
                  color: '#ffffff',
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
                color: '#9ca3af',
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
            className="container" 
            style={{ 
              marginLeft: !isMobile ? '260px' : '0',
              marginTop: isMobile && isAuthenticated ? '60px' : '0',
              minHeight: '100vh',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
            }}
            suppressHydrationWarning={true}
          >
            {/* Modern Header for authenticated pages */}
            {mounted && (isAuthenticated || (!isLoginPage && (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('user_id'))))) && (
              <ModernHeader 
                title={headerContext.title}
                subtitle={headerContext.subtitle}
                actions={headerContext.actions}
                centerContent={headerContext.centerContent}
                showBreadcrumbs={headerContext.showBreadcrumbs}
                breadcrumbs={headerContext.breadcrumbs}
              />
            )}
            
            {/* Page Content */}
            <div 
              style={{ 
                padding: isMobile ? '20px' : '32px',
                paddingTop: mounted && (isAuthenticated || (!isLoginPage && (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('user_id'))))) ? '0' : '20px'
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
      <ToastContainer />
      {/* API Health Check - only show in development or when there are issues */}
      {(process.env.NODE_ENV === 'development' || typeof window !== 'undefined') && (
        <ApiHealthCheck />
      )}
      </ErrorBoundary>
    </ToastProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#f0a500" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BracketWorks" />
        
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
            <ClientLayout>{children}</ClientLayout>
          </HeaderProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
