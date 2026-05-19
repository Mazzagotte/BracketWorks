"use client";

import { type ReactNode, useEffect, useRef, useState } from 'react';
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

const PUBLIC_ROUTES = new Set(['/', '/login', '/signup', '/verify-email']);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) {
    return true;
  }

  return pathname === '/reset-password'
    || pathname.startsWith('/reset-password/')
    || pathname === '/view'
    || pathname.startsWith('/view/');
}

function ClientLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const headerContext = useHeader();
  const pathname = usePathname();
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [mounted, setMounted] = useState(false);
  const wasAuthenticated = useRef(false);
  const currentPath = pathname || '/';
  const isPublicPath = isPublicRoute(currentPath);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'auto';
    document.body.style.touchAction = 'pan-y pan-x';
    (document.body.style as { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
    document.documentElement.style.touchAction = 'pan-y pan-x';

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 480);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setCurrentPage(currentPath.slice(1) || 'dashboard');
  }, [currentPath]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      wasAuthenticated.current = true;
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!mounted) return;

    if (!auth.isAuthenticated && !isPublicPath) {
      router.replace(wasAuthenticated.current ? '/login?expired=true' : '/login');
    }
  }, [mounted, auth.isAuthenticated, isPublicPath, router]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const storedFirstName = localStorage.getItem('first_name') || auth.user.name || undefined;
      setFirstName(storedFirstName);
      return;
    }

    setFirstName(undefined);
  }, [auth.isAuthenticated, auth.user]);

  useEffect(() => {
    if (isPublicPath) {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
      return () => {
        document.body.style.overflow = 'auto';
        document.body.style.touchAction = 'pan-y pan-x';
        (document.body.style as { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
      };
    }

    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
    }

    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
    };
  }, [isMobile, isPublicPath, sidebarOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'pan-y pan-x';
      (document.body.style as { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
    };
  }, []);

  const isUserAuthenticated = mounted && auth.isAuthenticated && !isPublicPath;

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

        <div className={`${styles.contentCard} ${isMobile ? styles.contentCardMobile : ''} ${!isUserAuthenticated ? styles.contentCardNoAuth : ''}`}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      <DevAuthStatus />
      <TimeSlotReminderModal />
    </ErrorBoundary>
  );
}

export default function AuthAwareLayout({ children }: { children: ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
