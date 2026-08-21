'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type OrganizerAuthGuardProps = {
  children: ReactNode;
};

// Single place that enforces organizer authentication; API authorization remains the real security boundary.
export default function OrganizerAuthGuard({ children }: OrganizerAuthGuardProps) {
  const router = useRouter();

  useEffect(() => {
    const hasToken = Boolean(sessionStorage.getItem('access_token'));
    const hasUser = Boolean(localStorage.getItem('user_id'));
    if (!hasToken || !hasUser) {
      router.replace('/login?expired=true');
    }
  }, [router]);

  return <>{children}</>;
}
