import { useEffect, useState } from 'react';

import { API, apiFetch } from '../../lib/api';
import { getErrorContext } from '../../lib/error-utils';
import { logger } from '../../lib/logger';

export type DashboardScoreProgress = {
  completed: number;
  entered: number;
  total: number;
  percent: number;
  loading: boolean;
};

type UseDashboardScoreProgressArgs = {
  isDemoDashboard: boolean;
  authToken: string | null;
  tournamentId: number | null;
  selectedSquadId: number | null;
  loadedEntries: number;
  statsSummaryPlayersLength: number;
};

const DEMO_PROGRESS: DashboardScoreProgress = {
  completed: 21,
  entered: 21,
  total: 32,
  percent: 66,
  loading: false,
};

const EMPTY_PROGRESS: DashboardScoreProgress = {
  completed: 0,
  entered: 0,
  total: 0,
  percent: 0,
  loading: false,
};

export function useDashboardScoreProgress({
  isDemoDashboard,
  authToken,
  tournamentId,
  selectedSquadId,
  loadedEntries,
  statsSummaryPlayersLength,
}: UseDashboardScoreProgressArgs): DashboardScoreProgress {
  const [scoreProgress, setScoreProgress] = useState<DashboardScoreProgress>(() => (
    isDemoDashboard ? DEMO_PROGRESS : EMPTY_PROGRESS
  ));

  useEffect(() => {
    let isCancelled = false;

    const loadScoreProgress = async () => {
      if (isDemoDashboard) {
        if (!isCancelled) setScoreProgress(DEMO_PROGRESS);
        return;
      }

      if (!tournamentId) {
        if (!isCancelled) {
          setScoreProgress(EMPTY_PROGRESS);
        }
        return;
      }

      if (!authToken) {
        if (!isCancelled) {
          setScoreProgress({
            completed: 0,
            entered: 0,
            total: Math.max(loadedEntries, statsSummaryPlayersLength),
            percent: 0,
            loading: false,
          });
        }
        return;
      }

      if (!isCancelled) {
        setScoreProgress(previous => ({ ...previous, loading: true }));
      }

      try {
        const params = new URLSearchParams({ tournament_id: String(tournamentId) });
        if (selectedSquadId) {
          params.set('squad_id', String(selectedSquadId));
        }

        const response = await apiFetch(API(`/api/v1/scores/?${params.toString()}`), {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to load scores progress: ${response.status}`);
        }

        const rows = await response.json() as Array<{
          player_id: number;
          game1_scratch?: number | null;
          game2_scratch?: number | null;
          game3_scratch?: number | null;
        }>;

        const completed = rows.filter(row => (
          row.game1_scratch != null && row.game2_scratch != null && row.game3_scratch != null
        )).length;
        const entered = rows.filter(row => (
          row.game1_scratch != null || row.game2_scratch != null || row.game3_scratch != null
        )).length;
        const total = Math.max(statsSummaryPlayersLength, loadedEntries, rows.length);
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (!isCancelled) {
          setScoreProgress({ completed, entered, total, percent, loading: false });
        }
      } catch (error) {
        logger.warn('Dashboard score progress load failed', { error: getErrorContext(error) });
        if (!isCancelled) {
          const total = Math.max(statsSummaryPlayersLength, loadedEntries);
          setScoreProgress({ completed: 0, entered: 0, total, percent: 0, loading: false });
        }
      }
    };

    void loadScoreProgress();

    return () => {
      isCancelled = true;
    };
  }, [authToken, isDemoDashboard, loadedEntries, selectedSquadId, statsSummaryPlayersLength, tournamentId]);

  return scoreProgress;
}
