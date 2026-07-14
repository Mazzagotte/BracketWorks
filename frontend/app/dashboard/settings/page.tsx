"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import pageStyles from './dashboard-settings-page.module.css';
import { TournamentSettingsContent } from './TournamentSettingsContent';

export default function TournamentSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentIdParam = searchParams.get('tournament_id');
  const isModalView = searchParams.get('modal') === '1';
  const tournamentId = tournamentIdParam ? Number(tournamentIdParam) : null;

  useEffect(() => {
    if (!tournamentIdParam) {
      router.push('/');
    }
  }, [router, tournamentIdParam]);

  if (!tournamentId || Number.isNaN(tournamentId)) {
    return <div className={pageStyles.pageState}>Loading tournament settings...</div>;
  }

  return <TournamentSettingsContent tournamentId={tournamentId} layout={isModalView ? 'route-modal' : 'page'} />;
}
