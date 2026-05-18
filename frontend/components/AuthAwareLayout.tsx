"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Sidebar from './Sidebar';
import { MobileNav } from './MobileNav';
import ModernHeader from '../app/components/ModernHeader';
import { ErrorBoundary } from '../app/components/ErrorBoundary';
import { DevAuthStatus } from '../app/components/DevAuthStatus';
import { TimeSlotReminderModal } from '../app/components/TimeSlotReminderModal';
import { useAuth } from '../app/lib/auth-context';
import { useHeader } from '../app/lib/header-context';
import styles from '../app/layout.module.css';

function ClientLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
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
    document.body.style.overflow = 'auto';
    document.body.style.touchAction = 'pan-y pan-x';
    (document.body.style as any).webkitOverflowScrolling = 'touch';
    document.documentElement.style.touchAction = 'pan-y pan-x';

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 480);
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
      router.replace(wasAuthenticated.current ? '/login?expired=true' : '/login');
      return;
    }

    if (auth.isAuthenticated && currentPath === '/login') {
      router.replace('/dashboard');
    }
  }, [mounted, pathname, auth.isAuthenticated, router]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const storedFirstName = localStorage.getItem('first_name') || auth.user.name || undefined;
      setFirstName(storedFirstName);
    } else {
      setFirstName(undefined);
    }
  }, [auth.isAuthenticated, auth.user]);

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
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as any).webkitOverflowScrolling = 'touch';
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as any).webkitOverflowScrolling = 'touch';
    };
  }, []);

  const isUserAuthenticated = mounted && auth.isAuthenticated;

  if (!mounted) {
    return (
      <ErrorBoundary>
        <div id="main-content">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
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
          {!isMobile && isUserAuthenticated && (
            <Sidebar
              firstName={firstName}
              isMobile={false}
              isOpen={true}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          {isMobile && isUserAuthenticated && (
            <MobileNav
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              firstName={firstName}
              currentPage={currentPage}
            />
          )}

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
                <h1 className={styles.mobileHeaderTitle}>
                  {headerContext.title || currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
                </h1>
                <span className={styles.mobileHeaderBrand}>BracketWorks</span>
              </div>
            </header>
          )}

          <main
            id="main-content"
            className={`${styles.main} ${isMobile ? styles.mainMobile : styles.mainDesktop} ${isMobile && isUserAuthenticated ? styles.mainMobileAuth : ''}`}
          >
            {mounted && isUserAuthenticated && (
              <ModernHeader
                title={headerContext.title}
                subtitle={headerContext.subtitle}
                actions={headerContext.actions}
              />
            )}

            <div className={`${styles.contentCard} ${isMobile ? styles.contentCardMobile : ''} ${!(mounted && isUserAuthenticated) ? styles.contentCardNoAuth : ''}`}>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </>
      )}

      {!isLoginPage && <DevAuthStatus />}
      <TimeSlotReminderModal />
    </ErrorBoundary>
  );
}

export default function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
