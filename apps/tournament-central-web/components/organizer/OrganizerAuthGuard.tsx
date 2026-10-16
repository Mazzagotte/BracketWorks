'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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

  if (error) return <p role="alert">{error} <button type="button" onClick={retry}>Try again</button></p>;
  return session ? <>{children}</> : <p role="status">Checking your session...</p>;
}
