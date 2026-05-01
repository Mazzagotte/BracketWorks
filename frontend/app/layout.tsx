"use client";

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import './styles/globals.css';
import './styles/colors.global.css';
import './styles/login.css';
import './styles/bowling-animations.css';
import styles from './layout.module.css';

import Sidebar from '../components/Sidebar';
import ModernHeader from './components/ModernHeader';
import { MobileNav } from '../components/MobileNav';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './lib/auth-context';
import { HeaderProvider, useHeader } from './lib/header-context';
import { logger } from './lib/logger';
import { ApiHealthCheck } from './components/ApiHealthCheck';
import { DevAuthStatus } from './components/DevAuthStatus';



function ClientLayout({ children }: { children: React.ReactNode }) {
  // All hooks must be called before any conditional returns
  const auth = useAuth(); // Get auth directly
  const headerContext = useHeader();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoginPage, setIsLoginPage] = useState(false);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [mounted, setMounted] = useState(false);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    setMounted(true);
    // Force enable touch scrolling on body for all devices
    document.body.style.overflow = 'auto';
    document.body.style.touchAction = 'pan-y pan-x';
    (document.body.style as any).webkitOverflowScrolling = 'touch';
    document.documentElement.style.touchAction = 'pan-y pan-x';
    
    // Treat phones and tablets up to 768px as mobile — sidebar at narrower widths is too cramped
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const currentPath = pathname || '/';
    const onLoginLikePage = currentPath === '/login' || currentPath.startsWith('/reset-password') || currentPath.startsWith('/signup') || currentPath.startsWith('/view');
    setIsLoginPage(onLoginLikePage);
    setCurrentPage(currentPath.slice(1) || 'dashboard');
  }, [pathname]);

  // Track whether the user has been authenticated this session
  useEffect(() => {
    if (auth.isAuthenticated) {
      wasAuthenticated.current = true;
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!mounted) return;

    const currentPath = pathname || '/';
    const isPublicRoute =
      currentPath === '/login' ||
      currentPath.startsWith('/reset-password') ||
      currentPath.startsWith('/signup') ||
      currentPath.startsWith('/view');

    if (!auth.isAuthenticated && !isPublicRoute) {
      // If user was authenticated before, their session expired — tell them why
      router.replace(wasAuthenticated.current ? '/login?expired=true' : '/login');
      return;
    }

    if (auth.isAuthenticated && currentPath === '/login') {
      router.replace('/dashboard');
    }
  }, [mounted, pathname, auth.isAuthenticated, router]);

  // Update firstName whenever auth state changes
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const storedFirstName = localStorage.getItem('first_name') || auth.user.name || undefined;
      setFirstName(storedFirstName);
      logger.info('Layout: Auth state updated', { 
        isAuthenticated: auth.isAuthenticated, 
        hasUser: !!auth.user, 
        firstName: storedFirstName,
        userId: auth.user?.id 
      });
    } else {
      setFirstName(undefined);
      logger.info('Layout: Auth state cleared', { 
        isAuthenticated: auth.isAuthenticated, 
        hasUser: !!auth.user 
      });
    }
  }, [auth.isAuthenticated, auth.user]);

  // Additional effect for sidebar management and touch scrolling
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as any).webkitOverflowScrolling = 'touch';
    }
    
    return () => {
      // Always restore scroll on cleanup to prevent stuck state
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as any).webkitOverflowScrolling = 'touch';
    };
  }, [isMobile, sidebarOpen]);

  // Ensure body overflow is reset when navigating between pages
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as any).webkitOverflowScrolling = 'touch';
    };
  }, []);

  // Simple authentication check - trust the auth context
  const isUserAuthenticated = mounted && auth.isAuthenticated;
  
  // Debug logging for auth state
  useEffect(() => {
    if (mounted) {
      logger.info('Layout render - Auth State:', {
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
      <ErrorBoundary>
        <div id="main-content">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
        <ApiHealthCheck />
        <DevAuthStatus />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
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
          
          {/* Mobile Header */}
          {isMobile && isUserAuthenticated && (
            <header className={styles.mobileHeader}>
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
                className={styles.hamburgerBtn}
              >
                ☰
              </button>
              <div className={styles.mobileHeaderCenter}>
                <h1 className={styles.mobileHeaderTitle}>BracketWorks</h1>
              </div>
              <div className={styles.pageIndicator}>{currentPage}</div>
            </header>
          )}
          
          <main
            id="main-content"
            className={`${styles.main} ${isMobile ? styles.mainMobile : styles.mainDesktop} ${isMobile && isUserAuthenticated ? styles.mainMobileAuth : ''}`}
          >
            {/* Modern Header for authenticated pages */}
            {mounted && isUserAuthenticated && (
              <ModernHeader
                title={headerContext.title}
                subtitle={headerContext.subtitle}
                actions={headerContext.actions}
              />
            )}

            {/* Page Content */}
            <div className={`${styles.contentCard} ${isMobile ? styles.contentCardMobile : ''} ${!(mounted && isUserAuthenticated) ? styles.contentCardNoAuth : ''}`}>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </main>
          
          {/* Mobile Bottom Navigation */}
        </>
      )}
      
      {/* Development Authentication Status Indicator - Upper Right */}
      <DevAuthStatus />
      </ErrorBoundary>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="theme-color" content="var(--color-primary)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BracketWorks" />
        
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        
        {/* Preconnect to backend API */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'} />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/logo.svg" as="image" type="image/png" />
        
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
            <ToastProvider>
              <AuthAwareLayout>{children}</AuthAwareLayout>
            </ToastProvider>
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
    logger.info('AuthAwareLayout: Auth state changed, forcing re-render', {
      isAuthenticated: auth.isAuthenticated,
      hasUser: !!auth.user,
      authKey: authKey + 1
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, auth.user]);
  
  return <ClientLayout key={authKey}>{children}</ClientLayout>;
}


