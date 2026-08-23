"use client";

import { Suspense, type ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { MobileNav } from './MobileNav';
import TopNav from '../app/components/TopNav';
import { ErrorBoundary } from '../app/components/ErrorBoundary';
import { DevAuthStatus } from '../app/components/DevAuthStatus';
import { TimeSlotReminderModal } from '../app/components/TimeSlotReminderModal';
import DevNoticeBanner from '../app/components/DevNoticeBanner';
import MobileCompatibilityNotice, { useMobileCompatibilityNotice } from '../app/components/MobileCompatibilityNotice';
import WelcomeOnboardingModal from '../app/components/WelcomeOnboardingModal';
import AnnouncementNotice from '../app/components/AnnouncementNotice';
import LegalDisclosureModal from '../app/components/LegalDisclosureModal';
import { StaffInvitationNotice } from './StaffInvitationNotice';
import { useAuth } from '../app/lib/auth-context';
import { NAVIGATION_DRAWER_VIEWPORT_QUERY } from '../app/lib/responsive';
import { useMediaQuery } from '../app/hooks/useMediaQuery';
import { resetScrollLocks, setBodyInteractionState } from '../app/utils/modalUtils';
import styles from '../app/layout.module.css';

const PUBLIC_ROUTES = new Set([
  '/', '/login', '/signup', '/verify-email',
  '/terms', '/privacy', '/operator-terms', '/acceptable-use',
]);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) {
    return true;
  }

  return pathname === '/reset-password'
    || pathname.startsWith('/reset-password/')
    || pathname === '/view'
    || pathname.startsWith('/view/')
    || pathname === '/demo'
    || pathname.startsWith('/demo/');
}

function ClientLayout({ children }: { children: ReactNode }) {
  const { isUserAuthenticated, currentUser, isAuthInitialized, logoutUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const isMobile = useMediaQuery(NAVIGATION_DRAWER_VIEWPORT_QUERY);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [legalBlocked, setLegalBlocked] = useState(true);
  const [currentPage, setCurrentPage] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isEmbeddedModalRoute, setIsEmbeddedModalRoute] = useState(false);
  const wasAuthenticated = useRef(false);
  const currentPath = pathname || '/';
  const isPublicPath = isPublicRoute(currentPath);
  const mobileCompatibilityNotice = useMobileCompatibilityNotice(currentPath);
  const shouldHoldProtectedContent = !isPublicPath
    && !isEmbeddedModalRoute
    && (!isAuthInitialized || !isUserAuthenticated || legalBlocked);

  useEffect(() => {
    setMounted(true);
    resetScrollLocks();

    const search = window.location.search;
    setIsEmbeddedModalRoute(new URLSearchParams(search).get('modal') === '1');

    return undefined;
  }, []);

  useEffect(() => {
    setCurrentPage(currentPath.slice(1) || 'dashboard');
  }, [currentPath]);

  useEffect(() => {
    if (isUserAuthenticated) {
      wasAuthenticated.current = true;
    } else {
      setLegalBlocked(true);
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

    if (mobileCompatibilityNotice.isOpen || (isMobile && mobileNavOpen)) {
      setBodyInteractionState({ scrollLocked: true, touchLocked: true });
    } else {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
    }

    return () => {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
    };
  }, [isMobile, isPublicPath, mobileCompatibilityNotice.isOpen, mobileNavOpen]);

  useEffect(() => {
    return () => {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
    };
  }, []);

  const showAuthenticatedShell = mounted && isAuthInitialized && isUserAuthenticated && !isPublicPath && !isEmbeddedModalRoute;
  const mainLayoutClass = isPublicPath
    ? styles.mainPublic
    : isMobile
      ? styles.mainMobile
      : showAuthenticatedShell
        ? styles.mainDesktop
        : styles.mainPublic;
  const contentCardClass = isPublicPath
    ? `${styles.contentCard} ${styles.contentCardNoAuth}`
    : `${styles.contentCard} ${isMobile ? styles.contentCardMobile : ''} ${!showAuthenticatedShell ? styles.contentCardNoAuth : ''}`;

  if (!mounted) {
    return (
      <ErrorBoundary>
        <div id="main-content">
          <ErrorBoundary>
            {isPublicPath || isEmbeddedModalRoute ? children : (
              <div className={styles.gateLoading} role="status">Checking account requirements...</div>
            )}
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
        className={`${styles.main} ${mainLayoutClass} ${isMobile && showAuthenticatedShell ? styles.mainMobileAuth : ''}`}
      >
        {/* Development notice banner - render at top of main content */}
        {showAuthenticatedShell && !legalBlocked && (
          <div className={styles.devNoticeWrap}>
            <DevNoticeBanner />
          </div>
        )}
        <StaffInvitationNotice enabled={showAuthenticatedShell && !legalBlocked} />

        <div className={contentCardClass}>
          <ErrorBoundary>
            {shouldHoldProtectedContent ? (
              <div className={styles.gateLoading} role="status">Checking account requirements...</div>
            ) : children}
          </ErrorBoundary>
        </div>
      </main>

      {!legalBlocked && <DevAuthStatus />}
      {!legalBlocked && <TimeSlotReminderModal />}
      <WelcomeOnboardingModal
        enabled={showAuthenticatedShell && !legalBlocked && !mobileCompatibilityNotice.isOpen && !announcementOpen}
        userId={currentUser?.id}
      />
      <AnnouncementNotice enabled={showAuthenticatedShell && !legalBlocked && !mobileCompatibilityNotice.isOpen} onVisibilityChange={setAnnouncementOpen} />
      <MobileCompatibilityNotice
        open={showAuthenticatedShell && !legalBlocked && mobileCompatibilityNotice.isOpen}
        onContinue={mobileCompatibilityNotice.dismiss}
      />
      <LegalDisclosureModal
        enabled={showAuthenticatedShell}
        onBlockingChange={setLegalBlocked}
        onLogout={() => {
          logoutUser();
          router.push('/login');
        }}
      />
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
