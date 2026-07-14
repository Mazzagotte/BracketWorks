import { Dispatch, SetStateAction, useCallback, useEffect } from 'react';
import {
  BracketSettings,
  DashboardTournamentBootstrapResponse,
  Player,
  SidePotsSettings,
  Squad,
  Tournament,
} from '../../lib/types';
import { apiClient } from '../../lib/api';
import { getErrorContext } from '../../lib/error-utils';
import { logger } from '../../lib/logger';
import { storage } from '../../lib/storage';
import {
  clearSelectedSquad,
  clearSelectedTournament,
  getSelectedSquadId,
  getSelectedTournamentId,
  setActiveSquadLabel,
  setSelectedSquad,
  setSelectedTournament,
} from '../../lib/selection-session';
import { applyAutoHouse, createDefaultBracketSettings, normalizeLoadedBracketSettings } from '../utils/bracketSettings';
import { createDefaultSidePots } from '../utils/sidePots';

type AddToast = (toast: { type: 'success' | 'error' | 'warning' | 'info'; message: string; duration?: number }) => string;

type SetBracketSettings = Dispatch<SetStateAction<BracketSettings>>;
type SetTournament = Dispatch<SetStateAction<Tournament | null>>;
type SetWorkflowStatus = Dispatch<SetStateAction<DashboardTournamentBootstrapResponse['workflow_status']>>;
type SetSquads = Dispatch<SetStateAction<Squad[]>>;
type SetSelectedSquadId = Dispatch<SetStateAction<number | null>>;
type SetSquadEntryCounts = Dispatch<SetStateAction<Record<number, number>>>;
type SetSummaryPlayers = Dispatch<SetStateAction<Player[]>>;
type SetSidePots = Dispatch<SetStateAction<SidePotsSettings>>;
type SetLoadModalOpen = Dispatch<SetStateAction<boolean>>;

type UseTournamentOrchestrationArgs = {
  tournament: Tournament | null;
  addToast: AddToast;
  setTournament: SetTournament;
  setWorkflowStatus: SetWorkflowStatus;
  setSquads: SetSquads;
  setSelectedSquadId: SetSelectedSquadId;
  setSquadEntryCounts: SetSquadEntryCounts;
  setSummaryPlayers: SetSummaryPlayers;
  setBracketSettings: SetBracketSettings;
  setSidePots: SetSidePots;
  setLoadModalOpen: SetLoadModalOpen;
  loadSidePots: (tournamentId: number) => void;
  loadSquadEntryCounts: (tournamentId: number, squadList: Squad[]) => Promise<void>;
};

export function useTournamentOrchestration({
  tournament,
  addToast,
  setTournament,
  setWorkflowStatus,
  setSquads,
  setSelectedSquadId,
  setSquadEntryCounts,
  setSummaryPlayers,
  setBracketSettings,
  setSidePots,
  setLoadModalOpen,
  loadSidePots,
  loadSquadEntryCounts,
}: UseTournamentOrchestrationArgs) {
  const fetchTournamentBootstrap = useCallback(async (tournamentId: number): Promise<DashboardTournamentBootstrapResponse | null> => {
    try {
      return await apiClient.get<DashboardTournamentBootstrapResponse>(`/api/v1/tournaments/bootstrap?tournament_id=${tournamentId}`, false);
    } catch (error) {
      logger.error('Failed to load tournament bootstrap data', { tournamentId, error: getErrorContext(error) });
      return null;
    }
  }, []);

  const restoreSelectedSquadFromBootstrap = useCallback((
    squadsData: Squad[],
    selectedSquadData: DashboardTournamentBootstrapResponse['selected_squad'] | null | undefined,
  ) => {
    const storedSelectedSquadId = getSelectedSquadId();
    const restoredSelectedSquadId = selectedSquadData?.squad_id
      ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null)
      ?? squadsData[0]?.id
      ?? null;

    if (restoredSelectedSquadId && squadsData.some(squad => squad.id === restoredSelectedSquadId)) {
      const restoredSquad = squadsData.find(squad => squad.id === restoredSelectedSquadId) || null;
      setSelectedSquadId(restoredSelectedSquadId);
      setSelectedSquad(restoredSelectedSquadId);
      setActiveSquadLabel(restoredSquad ? [restoredSquad.date, restoredSquad.time].filter(Boolean).join(' ') : '');
      return;
    }

    setSelectedSquadId(null);
    clearSelectedSquad();
  }, [setSelectedSquadId]);

  useEffect(() => {
    const lastTournamentId = getSelectedTournamentId();
    const token = storage.getItem('token');

    if (!lastTournamentId || !token) {
      clearSelectedSquad();
      clearSelectedTournament();
      setWorkflowStatus(null);
      return;
    }

    const bootstrapStarted = performance.now();
    void fetchTournamentBootstrap(Number(lastTournamentId))
      .then(bootstrap => {
        const tournamentData = bootstrap?.tournament ?? null;
        const squadsData = bootstrap?.squads ?? [];
        const selectedSquadData = bootstrap?.selected_squad ?? null;
        const loadedBracketSettings = normalizeLoadedBracketSettings(
          bootstrap?.bracket_settings,
          Number(lastTournamentId),
        );

        if (tournamentData && tournamentData.id) {
          setTournament(tournamentData);
          setWorkflowStatus(bootstrap?.workflow_status ?? null);
          setSelectedTournament(tournamentData.id, tournamentData.name);
          setBracketSettings(previous => applyAutoHouse(previous, loadedBracketSettings));
          loadSidePots(tournamentData.id);
          void loadSquadEntryCounts(tournamentData.id, squadsData);
        } else {
          clearSelectedTournament({ clearSquad: true });
          setSquadEntryCounts({});
          setWorkflowStatus(null);
        }

        setSquads(squadsData);
        restoreSelectedSquadFromBootstrap(squadsData, selectedSquadData);

        logger.info('Dashboard bootstrap load completed', {
          tournamentId: Number(lastTournamentId),
          durationMs: Math.round((performance.now() - bootstrapStarted) * 100) / 100,
          squadsCount: squadsData.length,
          hasSelectedSquad: Boolean(selectedSquadData?.squad_id),
          hasBracketSettings: Boolean(bootstrap?.bracket_settings),
        });
      })
      .catch(error => {
        logger.error('Error loading initial dashboard data:', error);
      });
  }, [
    fetchTournamentBootstrap,
    loadSidePots,
    loadSquadEntryCounts,
    restoreSelectedSquadFromBootstrap,
    setBracketSettings,
    setSquadEntryCounts,
    setSquads,
    setTournament,
    setWorkflowStatus,
  ]);

  const handleLoadTournament = useCallback(async (nextTournament: Tournament) => {
    setTournament(nextTournament);
    setWorkflowStatus(null);
    setLoadModalOpen(false);
    loadSidePots(nextTournament.id);
    setSelectedTournament(nextTournament.id, nextTournament.name);

    const token = storage.getItem('token');
    if (!token) return;

    try {
      const bootstrap = await fetchTournamentBootstrap(nextTournament.id);
      if (!bootstrap || !bootstrap.tournament) {
        throw new Error('Tournament bootstrap payload missing');
      }

      const loadedBracketSettings = normalizeLoadedBracketSettings(bootstrap.bracket_settings, nextTournament.id);
      const squadsData = bootstrap.squads || [];

      setTournament(bootstrap.tournament);
      setWorkflowStatus(bootstrap.workflow_status ?? null);
      setSelectedTournament(bootstrap.tournament.id, bootstrap.tournament.name);
      setBracketSettings(previous => applyAutoHouse(previous, loadedBracketSettings));
      setSquads(squadsData);
      void loadSquadEntryCounts(nextTournament.id, squadsData);
      restoreSelectedSquadFromBootstrap(squadsData, bootstrap.selected_squad);
    } catch (error) {
      logger.error('Error loading squads for tournament', { tournamentId: nextTournament.id, error });
      setWorkflowStatus(null);
      setSquads([]);
      setSquadEntryCounts({});
      addToast({
        type: 'error',
        message: 'Failed to load squads for this tournament',
        duration: 5000,
      });
    }
  }, [
    addToast,
    fetchTournamentBootstrap,
    loadSidePots,
    loadSquadEntryCounts,
    restoreSelectedSquadFromBootstrap,
    setBracketSettings,
    setLoadModalOpen,
    setSquadEntryCounts,
    setSquads,
    setTournament,
    setWorkflowStatus,
  ]);

  const handleUnloadTournament = useCallback(() => {
    const unloadedName = tournament?.name || 'Tournament';
    setTournament(null);
    setWorkflowStatus(null);
    setSquads([]);
    setSquadEntryCounts({});
    setSummaryPlayers([]);
    setSelectedSquadId(null);
    setBracketSettings(createDefaultBracketSettings());
    setSidePots(createDefaultSidePots());
    clearSelectedTournament({ clearSquad: true });
    addToast({
      type: 'success',
      message: `${unloadedName} unloaded`,
      duration: 3000,
    });
  }, [
    addToast,
    setBracketSettings,
    setSelectedSquadId,
    setSidePots,
    setSquadEntryCounts,
    setSquads,
    setSummaryPlayers,
    setTournament,
    setWorkflowStatus,
    tournament?.name,
  ]);

  return {
    fetchTournamentBootstrap,
    handleLoadTournament,
    handleUnloadTournament,
  };
}
