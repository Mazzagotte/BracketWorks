'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';

import {
  listMyOrganizerSetupStates,
  listMyTournaments,
  listTournamentRegistrations,
  loadOrganizerSetupState,
  type OrganizerRegistrationRecord,
} from './organizerApi';
import type { SquadConfig } from './types';

// Only the slice of the setup payload the shared tournament context needs.
type TournamentSetupPayloadSlice = {
  squads?: SquadConfig[];
  events?: Array<{ enabled?: boolean }>;
  hasRulesDocument?: boolean;
  details?: {
    registrationOpenIso?: string;
    registrationCloseIso?: string;
  };
};

export type TournamentContextValue = {
  tournamentId: number;
  tournament: TournamentContract | null;
  setupSummary: TournamentSetupStateSummaryContract | undefined;
  squads: SquadConfig[];
  registrations: OrganizerRegistrationRecord[];
  eventCount: number;
  hasRulesDocument: boolean;
  registrationOpenIso: string | null;
  registrationCloseIso: string | null;
  isLoading: boolean;
  error: string | null;
  refreshTournament: () => Promise<void>;
  refreshSetup: () => Promise<void>;
  refreshRegistrations: () => Promise<void>;
  refresh: () => Promise<void>;
};

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function useTournamentContext(): TournamentContextValue {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournamentContext must be used within a TournamentProvider');
  }
  return context;
}

type TournamentProviderProps = {
  tournamentId: number;
  children: ReactNode;
};

export function TournamentProvider({ tournamentId, children }: TournamentProviderProps) {
  const [tournament, setTournament] = useState<TournamentContract | null>(null);
  const [setupSummary, setSetupSummary] = useState<TournamentSetupStateSummaryContract | undefined>(undefined);
  const [squads, setSquads] = useState<SquadConfig[]>([]);
  const [registrations, setRegistrations] = useState<OrganizerRegistrationRecord[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [hasRulesDocument, setHasRulesDocument] = useState(false);
  const [registrationOpenIso, setRegistrationOpenIso] = useState<string | null>(null);
  const [registrationCloseIso, setRegistrationCloseIso] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback((): string => {
    const token = sessionStorage.getItem('access_token');
    if (!token) throw new Error('Your session expired. Please sign in again.');
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) throw new Error('Invalid tournament id.');
    return token;
  }, [tournamentId]);

  const refreshTournament = useCallback(async () => {
    const tournaments = await listMyTournaments(getAccessToken());
    const matched = tournaments.find((item) => item.id === tournamentId) ?? null;
    setTournament(matched);
    if (!matched) throw new Error('Tournament not found for this organizer account.');
    localStorage.setItem('tc_active_tournament_name', matched.name || '');
    window.dispatchEvent(new Event('storage'));
  }, [getAccessToken, tournamentId]);

  const refreshSetup = useCallback(async () => {
    const token = getAccessToken();
    const [setupStates, setupState] = await Promise.all([
      listMyOrganizerSetupStates(token),
      loadOrganizerSetupState<TournamentSetupPayloadSlice>(token, tournamentId),
    ]);
    setSetupSummary(setupStates.find((item) => item.tournament_id === tournamentId));
    setSquads(Array.isArray(setupState?.payload.squads) ? setupState.payload.squads : []);
    setEventCount((setupState?.payload.events ?? []).filter((event) => event.enabled !== false).length);
    setHasRulesDocument(Boolean(setupState?.payload.hasRulesDocument));
    setRegistrationOpenIso(setupState?.payload.details?.registrationOpenIso || null);
    setRegistrationCloseIso(setupState?.payload.details?.registrationCloseIso || null);
  }, [getAccessToken, tournamentId]);

  const refreshRegistrations = useCallback(async () => {
    setRegistrations(await listTournamentRegistrations(getAccessToken(), tournamentId));
  }, [getAccessToken, tournamentId]);

  const refresh = useCallback(async () => {
    // OrganizerAuthGuard (parent layout) already redirects unauthenticated users before this mounts.
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Your session expired. Please sign in again.');
      setIsLoading(false);
      return;
    }

    if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
      setError('Invalid tournament id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([refreshTournament(), refreshSetup(), refreshRegistrations()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load tournament.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshRegistrations, refreshSetup, refreshTournament, tournamentId]);

  useEffect(() => {
    void refresh();
    // Intentionally re-runs only when the tournament id changes; refresh() is stable per id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const value = useMemo<TournamentContextValue>(() => ({
    tournamentId,
    tournament,
    setupSummary,
    squads,
    registrations,
    eventCount,
    hasRulesDocument,
    registrationOpenIso,
    registrationCloseIso,
    isLoading,
    error,
    refreshTournament,
    refreshSetup,
    refreshRegistrations,
    refresh,
  }), [
    tournamentId,
    tournament,
    setupSummary,
    squads,
    registrations,
    eventCount,
    hasRulesDocument,
    registrationOpenIso,
    registrationCloseIso,
    isLoading,
    error,
    refreshTournament,
    refreshSetup,
    refreshRegistrations,
    refresh,
  ]);

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}
