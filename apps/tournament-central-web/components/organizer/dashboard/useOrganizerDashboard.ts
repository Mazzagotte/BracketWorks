'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';

import { listMyOrganizerSetupStates, listMyTournaments, listTournamentRegistrations } from '../organizerApi';
import { buildPaymentSummary } from '../tournamentInsights';

export type OrganizerAttentionItem = {
  id: string;
  tournamentId: number;
  message: string;
};

export type OrganizerDashboardTournament = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  isPublic: boolean;
  entryCount: number | null;
  squadCount: number | null;
  upcomingSquadCount: number;
  amountPaidCents: number;
  hasPublishedSetup: boolean;
  publicUrl: string | null;
  hasLogo: boolean;
};

function countSquads(squadTimes: TournamentContract['squad_times']): number | null {
  if (!squadTimes || typeof squadTimes !== 'object') {
    return null;
  }

  let total = 0;
  for (const times of Object.values(squadTimes)) {
    if (Array.isArray(times)) {
      total += times.length;
    }
  }

  return total;
}

// Counts squads whose date key falls within [today, today + windowDays], inclusive.
function countUpcomingSquads(squadTimes: TournamentContract['squad_times'], referenceDate: Date, windowDays: number): number {
  if (!squadTimes || typeof squadTimes !== 'object') {
    return 0;
  }

  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const windowEnd = new Date(startOfToday);
  windowEnd.setDate(windowEnd.getDate() + windowDays);

  let total = 0;
  for (const [dateKey, times] of Object.entries(squadTimes)) {
    if (!Array.isArray(times) || times.length === 0) {
      continue;
    }

    const squadDate = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(squadDate.getTime())) {
      continue;
    }

    if (squadDate >= startOfToday && squadDate <= windowEnd) {
      total += times.length;
    }
  }

  return total;
}

function buildAttentionItems(
  tournaments: OrganizerDashboardTournament[],
  setupById: Record<number, TournamentSetupStateSummaryContract>,
): OrganizerAttentionItem[] {
  const today = new Date();
  const items: OrganizerAttentionItem[] = [];

  for (const tournament of tournaments) {
    const setup = setupById[tournament.id];
    if (!setup || !setup.is_published) {
      items.push({
        id: `setup-${tournament.id}`,
        tournamentId: tournament.id,
        message: `${tournament.name}: setup changes are not published yet.`,
      });
    }

    if (!tournament.startDate) {
      items.push({
        id: `dates-${tournament.id}`,
        tournamentId: tournament.id,
        message: `${tournament.name}: tournament dates are incomplete.`,
      });
      continue;
    }

    const start = new Date(`${tournament.startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
      continue;
    }

    const msUntilStart = start.getTime() - today.getTime();
    const daysUntilStart = Math.ceil(msUntilStart / (1000 * 60 * 60 * 24));
    if (daysUntilStart >= 0 && daysUntilStart <= 7) {
      items.push({
        id: `soon-${tournament.id}`,
        tournamentId: tournament.id,
        message: `${tournament.name}: starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}.`,
      });
    }
  }

  return items.slice(0, 8);
}

export function useOrganizerDashboard() {
  const [tournaments, setTournaments] = useState<OrganizerDashboardTournament[]>([]);
  const [setupById, setSetupById] = useState<Record<number, TournamentSetupStateSummaryContract>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Your session expired. Please sign in again.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [tournamentRows, setupRows] = await Promise.all([
        listMyTournaments(token),
        listMyOrganizerSetupStates(token),
      ]);

      const paidCentsByTournamentId = new Map<number, number>();
      await Promise.all(tournamentRows.map(async (item) => {
        try {
          const registrations = await listTournamentRegistrations(token, item.id);
          paidCentsByTournamentId.set(item.id, buildPaymentSummary(registrations).paidCents);
        } catch {
          paidCentsByTournamentId.set(item.id, 0);
        }
      }));

      const mapped = tournamentRows.map((item) => {
        const publicUrl = (item as { public_url?: string | null }).public_url ?? null;
        return {
          id: item.id,
          name: item.name,
          startDate: item.start_date ?? null,
          endDate: item.end_date ?? null,
          location: item.location ?? null,
          isPublic: Boolean(item.is_public),
          entryCount: typeof item.entry_count === 'number' ? item.entry_count : null,
          squadCount: countSquads(item.squad_times),
          upcomingSquadCount: countUpcomingSquads(item.squad_times, new Date(), 7),
          amountPaidCents: paidCentsByTournamentId.get(item.id) ?? 0,
          hasPublishedSetup: setupRows.some((row) => row.tournament_id === item.id && row.is_published),
          publicUrl,
          hasLogo: Boolean(item.has_logo),
        } satisfies OrganizerDashboardTournament;
      });

      setTournaments(mapped);
      setSetupById(Object.fromEntries(setupRows.map((row) => [row.tournament_id, row])));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load organizer dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const attentionItems = useMemo(() => buildAttentionItems(tournaments, setupById), [setupById, tournaments]);

  const upcomingItems = useMemo(() => {
    const now = new Date();
    return tournaments
      .filter((item) => item.startDate)
      .map((item) => ({
        tournamentId: item.id,
        name: item.name,
        date: new Date(`${item.startDate}T00:00:00`),
      }))
      .filter((item) => !Number.isNaN(item.date.getTime()) && item.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);
  }, [tournaments]);

  return {
    tournaments,
    attentionItems,
    upcomingItems,
    isLoading,
    error,
    refresh,
  };
}
