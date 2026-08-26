'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';

import { TournamentProvider } from '@/components/organizer/TournamentContext';

export default function TournamentLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ tournamentId: string }>();
  const tournamentId = useMemo(() => Number(params.tournamentId), [params.tournamentId]);

  return (
    <TournamentProvider tournamentId={tournamentId}>
      {children}
    </TournamentProvider>
  );
}
