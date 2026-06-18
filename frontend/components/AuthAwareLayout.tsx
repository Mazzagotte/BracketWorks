"use client";

import { Suspense, type ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { MobileNav } from './MobileNav';
import TopNav from '../app/components/TopNav';
import { ErrorBoundary } from '../app/components/ErrorBoundary';
import { DevAuthStatus } from '../app/components/DevAuthStatus';
import { TimeSlotReminderModal } from '../app/components/TimeSlotReminderModal';
import { useAuth } from '../app/lib/auth-context';
import { resetScrollLocks, setBodyInteractionState } from '../app/utils/modalUtils';
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
  const { isUserAuthenticated, currentUser, isAuthInitialized } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [mounted, setMounted] = useState(false);
  const wasAuthenticated = useRef(false);
  const currentPath = pathname || '/';
  const isPublicPath = isPublicRoute(currentPath);
  const isEmbeddedModalRoute = searchParams.get('modal') === '1';

  useEffect(() => {
    setMounted(true);
    resetScrollLocks();

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
    if (isUserAuthenticated) {
      wasAuthenticated.current = true;
    }
  }, [isUserAuthenticated]);

  useEffect(() => {
    if (!mounted || !isAuthInitialized) return;

    if (!isUserAuthenticated && !isPublicPath) {
      router.replace(wasAuthenticated.current ? '/login?expired=true' : '/login');
    }
  }, [mounted, isAuthInitialized, isUserAuthenticated, isPublicPath, router]);

  useEffect(() => {
    if (isUserAuthenticated && currentUser) {
      const storedFirstName = localStorage.getItem('first_name') || currentUser.name || undefined;
      setFirstName(storedFirstName);
      return;
    }

    setFirstName(undefined);
  }, [isUserAuthenticated, currentUser]);

  useEffect(() => {
    if (isPublicPath) {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
      return () => {
        setBodyInteractionState({ scrollLocked: false, touchLocked: false });
      };
    }

    if (isMobile && mobileNavOpen) {
      setBodyInteractionState({ scrollLocked: true, touchLocked: true });
    } else {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
    }

    return () => {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
    };
  }, [isMobile, isPublicPath, mobileNavOpen]);

  useEffect(() => {
    return () => {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
    };
  }, []);

  const showAuthenticatedShell = mounted && isAuthInitialized && isUserAuthenticated && !isPublicPath && !isEmbeddedModalRoute;

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

  if (isEmbeddedModalRoute) {
    return (
      <ErrorBoundary>
        <div id="main-content">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {/* Unified top nav — desktop pill bar */}
      {!isMobile && showAuthenticatedShell && (
        <TopNav firstName={firstName} />
      )}

      {/* Mobile top bar */}
      {isMobile && showAuthenticatedShell && (
        <TopNav
          firstName={firstName}
          isMobile={true}
          onMobileMenuOpen={() => setMobileNavOpen(true)}
        />
      )}

      {/* Mobile slide-in nav drawer */}
      {isMobile && showAuthenticatedShell && (
        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          firstName={firstName}
          currentPage={currentPage}
        />
      )}

      <main
        id="main-content"
        className={`${styles.main} ${isMobile ? styles.mainMobile : (showAuthenticatedShell ? styles.mainDesktop : styles.mainPublic)} ${isMobile && showAuthenticatedShell ? styles.mainMobileAuth : ''}`}
      >
        <div className={`${styles.contentCard} ${isMobile ? styles.contentCardMobile : ''} ${!showAuthenticatedShell ? styles.contentCardNoAuth : ''}`}>
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
  return (
    <Suspense
      fallback={(
        <ErrorBoundary>
          <div id="main-content">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </ErrorBoundary>
      )}
    >
      <ClientLayout>{children}</ClientLayout>
    </Suspense>
  );
}
