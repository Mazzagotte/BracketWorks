'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Notice, Page } from '@bracketworks/ui';
import { useAuthSession } from '../auth/useAuthSession';

type OrganizerAuthGuardProps = {
  children: ReactNode;
};

// Single place that enforces organizer authentication; API authorization remains the real security boundary.
export default function OrganizerAuthGuard({ children }: OrganizerAuthGuardProps) {
  const router = useRouter();
  const { displayName: session, error, retry } = useAuthSession();

  useEffect(() => {
    if (session === '') {
      router.replace('/login?expired=true');
    }
  }, [router, session]);

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
