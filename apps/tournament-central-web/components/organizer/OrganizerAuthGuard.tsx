'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Notice, Page } from '@bracketworks/ui';
import { installAuthRetry } from '../auth/authRetry';
import { useAuthSession } from '../auth/useAuthSession';

type OrganizerAuthGuardProps = {
  children: ReactNode;
};

// Single place that enforces organizer authentication; API authorization remains the real security boundary.
export default function OrganizerAuthGuard({ children }: OrganizerAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { displayName: session, error, retry } = useAuthSession();

  // An expired token refreshes quietly on the next API call; if it can't, the session clears and we redirect below.
  useEffect(() => installAuthRetry(), []);

  useEffect(() => {
    if (session === '') {
      const next = `${pathname ?? '/organizer'}${window.location.search}`;
      router.replace(`/login?expired=true&next=${encodeURIComponent(next)}`);
    }
  }, [pathname, router, session]);

  if (error) {
    return (
      <Page width="narrow">
        <Notice tone="danger" role="alert" action={<Button size="sm" variant="ghost" onClick={retry}>Try again</Button>}>
          {error}
        </Notice>
      </Page>
    );
  }
  if (!session) {
    return (
      <Page width="narrow">
        <Notice tone="info" role="status">Checking your session...</Notice>
      </Page>
    );
  }
  return <>{children}</>;
}
