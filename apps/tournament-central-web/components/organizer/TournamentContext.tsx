'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';

import {
  getTournament,
  getTournamentSetupSummary,
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
  isTournamentLoading: boolean;
  isSetupLoading: boolean;
  isRegistrationsLoading: boolean;
  tournamentError: string | null;
  setupError: string | null;
  registrationsError: string | null;
  /** @deprecated Prefer the resource-specific loading flags. */
  isLoading: boolean;
  /** @deprecated Prefer the resource-specific errors. */
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
  const pathname = (usePathname() ?? '').replace(/\/+$/, '');
  const routeSection = pathname.split('/').filter(Boolean).slice(3).join('/');
  const isSetupEditorRoute = routeSection === 'setup';
  const needsTournament = !isSetupEditorRoute;
  const needsSetup = routeSection === '' || routeSection === 'squads';
  const needsRegistrations = routeSection === ''
    || ['registrations', 'participants', 'payments', 'squads'].includes(routeSection);

  const [tournament, setTournament] = useState<TournamentContract | null>(null);
  const [setupSummary, setSetupSummary] = useState<TournamentSetupStateSummaryContract | undefined>(undefined);
  const [squads, setSquads] = useState<SquadConfig[]>([]);
  const [registrations, setRegistrations] = useState<OrganizerRegistrationRecord[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [hasRulesDocument, setHasRulesDocument] = useState(false);
  const [registrationOpenIso, setRegistrationOpenIso] = useState<string | null>(null);
  const [registrationCloseIso, setRegistrationCloseIso] = useState<string | null>(null);
  const [isTournamentLoading, setIsTournamentLoading] = useState(needsTournament);
  const [isSetupLoading, setIsSetupLoading] = useState(needsSetup);
  const [isRegistrationsLoading, setIsRegistrationsLoading] = useState(needsRegistrations);
  const [tournamentError, setTournamentError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);

  const getAccessToken = useCallback((): string => {
    const token = sessionStorage.getItem('access_token');
    if (!token) throw new Error('Your session expired. Please sign in again.');
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) throw new Error('Invalid tournament id.');
    return token;
  }, [tournamentId]);

  const refreshTournament = useCallback(async () => {
    setIsTournamentLoading(true);
    setTournamentError(null);
    try {
      const matched = await getTournament(getAccessToken(), tournamentId);
      setTournament(matched);
      localStorage.setItem('tc_active_tournament_name', matched.name || '');
      window.dispatchEvent(new Event('storage'));
    } catch (caughtError) {
      setTournament(null);
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load tournament.';
      setTournamentError(message);
      throw caughtError;
    } finally {
      setIsTournamentLoading(false);
    }
  }, [getAccessToken, tournamentId]);

  const refreshSetup = useCallback(async () => {
    setIsSetupLoading(true);
    setSetupError(null);
    try {
      const token = getAccessToken();
      const [summary, setupState] = await Promise.all([
        getTournamentSetupSummary(token, tournamentId),
        loadOrganizerSetupState<TournamentSetupPayloadSlice>(token, tournamentId),
      ]);
      setSetupSummary(summary);
      setSquads(Array.isArray(setupState?.payload.squads) ? setupState.payload.squads : []);
      setEventCount((setupState?.payload.events ?? []).filter((event) => event.enabled !== false).length);
      setHasRulesDocument(Boolean(setupState?.payload.hasRulesDocument));
      setRegistrationOpenIso(setupState?.payload.details?.registrationOpenIso || null);
      setRegistrationCloseIso(setupState?.payload.details?.registrationCloseIso || null);
    } catch (caughtError) {
      setSetupError(caughtError instanceof Error ? caughtError.message : 'Unable to load tournament setup.');
      throw caughtError;
    } finally {
      setIsSetupLoading(false);
    }
  }, [getAccessToken, tournamentId]);

  const refreshRegistrations = useCallback(async () => {
    setIsRegistrationsLoading(true);
    setRegistrationsError(null);
    try {
      setRegistrations(await listTournamentRegistrations(getAccessToken(), tournamentId));
    } catch (caughtError) {
      setRegistrationsError(caughtError instanceof Error ? caughtError.message : 'Unable to load registrations.');
      throw caughtError;
    } finally {
      setIsRegistrationsLoading(false);
    }
  }, [getAccessToken, tournamentId]);

  const refresh = useCallback(async () => {
    const requests: Promise<void>[] = [];
    if (needsTournament) {
      requests.push(refreshTournament());
    } else {
      setIsTournamentLoading(false);
      setTournamentError(null);
    }

    if (needsSetup) {
      requests.push(refreshSetup());
    } else {
      setIsSetupLoading(false);
      setSetupError(null);
    }

    if (needsRegistrations) {
      requests.push(refreshRegistrations());
    } else {
      setIsRegistrationsLoading(false);
      setRegistrationsError(null);
    }

    await Promise.allSettled(requests);
  }, [needsRegistrations, needsSetup, needsTournament, refreshRegistrations, refreshSetup, refreshTournament]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    isTournamentLoading,
    isSetupLoading,
    isRegistrationsLoading,
    tournamentError,
    setupError,
    registrationsError,
    isLoading: isTournamentLoading || isSetupLoading || isRegistrationsLoading,
    error: tournamentError,
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
    isTournamentLoading,
    isSetupLoading,
    isRegistrationsLoading,
    tournamentError,
    setupError,
    registrationsError,
    refreshTournament,
    refreshSetup,
    refreshRegistrations,
    refresh,
  ]);

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}
