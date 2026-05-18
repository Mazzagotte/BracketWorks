"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Sidebar from '../../components/Sidebar';
import { MobileNav } from '../../components/MobileNav';
import ModernHeader from './ModernHeader';
import { ErrorBoundary } from './ErrorBoundary';
import { useAuth } from '../lib/auth-context';
import { useHeader } from '../lib/header-context';
import styles from '../layout.module.css';

function ClientLayout({ children }: { children: React.ReactNode }) {
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
    setCurrentPage(currentPath.slice(1) || 'dashboard');
  }, [pathname]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      wasAuthenticated.current = true;
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!mounted) return;

    if (!auth.isAuthenticated) {
      router.replace(wasAuthenticated.current ? '/login?expired=true' : '/login');
      return;
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
            <h1 className={styles.mobileHeaderTitle}>BracketWorks</h1>
          </div>
          <div className={styles.pageIndicator}>{currentPage}</div>
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

    </ErrorBoundary>
  );
}

export default function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
