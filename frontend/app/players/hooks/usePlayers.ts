import { useState, useEffect, useCallback, useRef } from 'react';

import { Player, Squad } from '../types';
import { logger } from '../../lib/logger';
import { API, apiClient } from '../../lib/api';
import { BracketProgramDefinition } from '../../lib/types';
import { calculatePlayerTotalCost, normalizePlayerBracketEntries } from '../../lib/bracketPrograms';

interface PlayerApiResponse {
  id: number;
  full_name?: string;
  usbc_number?: string;
  average?: number;
  handicap_entry_count?: number;
  scratch_entry_count?: number;
  program_entry_counts?: Record<string, number>;
  lane?: string;
  squad_id?: number;
  amount_paid?: number;
}

interface UsePlayersOptions {
  selectedSquad: Squad | null;
  squads: Squad[];
  authToken: string | null;
  getItem: (key: string) => string | null;
  entryFee: number;
  bracketPrograms: BracketProgramDefinition[];
}

export function usePlayers({ selectedSquad, squads, authToken, getItem, entryFee, bracketPrograms }: UsePlayersOptions) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'success' | 'error'>>({});

  // Pending debounce timers per player: playerId -> timeout handle
  const patchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Latest pending patch payload per player — so the debounced call always sends the freshest values
  const pendingPatches = useRef<Record<number, Record<string, any>>>({});
  // Single shared timer for flushing all pending patches as one bulk request
  const bulkFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPlayers = useCallback(async () => {
    if (!authToken) {
      setPlayers([]);
      setIsLoading(false);
      return;
    }
    
    // Check if there's a tournament loaded
    const tournamentId = getItem('lastTournamentId');
    if (!tournamentId) {
      setPlayers([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({ tournament_id: tournamentId });
      if (selectedSquad) {
        params.set('squad_id', String(selectedSquad.id));
      }
      const bowlersUrl = `/api/v1/bowlers?${params.toString()}`;
      
      const response = await fetch(API(bowlersUrl), {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (!response.ok) {
        // If API fails, show empty players list
        logger.warn('API not available, showing empty players list', { status: response.status });
        setPlayers([]);
        return;
      }

      const data = await response.json();
      
      const transformedData = data.map((player: PlayerApiResponse) => {
        const squad = squads?.find(sItem => sItem.id === player.squad_id);
        const [firstName = '', ...rest] = (player.full_name || '').split(' ')
        return {
          id: player.id,
          firstName,
          lastName: rest.join(' '),
          usbc: player.usbc_number || '',
          average: player.average || 0,
          handicap: player.handicap_entry_count || 0,
          scratch: player.scratch_entry_count || 0,
          bracketEntries: normalizePlayerBracketEntries(
            player.program_entry_counts,
            player.handicap_entry_count || 0,
            player.scratch_entry_count || 0,
          ),
          lane: player.lane || '',
          totalCost: calculatePlayerTotalCost(
            normalizePlayerBracketEntries(player.program_entry_counts, player.handicap_entry_count || 0, player.scratch_entry_count || 0),
            bracketPrograms,
            entryFee,
          ),
          amountPaid: player.amount_paid || 0,
          squad: squad ? { id: squad.id, date: squad.date, time: squad.time } : undefined
        };
      });
      
      setPlayers(transformedData);
    } catch (err) {
      logger.error('Failed to fetch bowlers', { error: err });
      // Don't load demo data - just show empty array
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSquad, squads, authToken, bracketPrograms, entryFee]);

  const addPlayer = useCallback(async (newPlayer: Omit<Player, 'id'>) => {
    if (!authToken) return;

    try {
      const playerData = {
        full_name: `${newPlayer.firstName} ${newPlayer.lastName}`,
        usbc_number: newPlayer.usbc || '',
        average: newPlayer.average,
        handicap_entry_count: newPlayer.handicap,
        scratch_entry_count: newPlayer.scratch,
        program_entry_counts: newPlayer.bracketEntries,
        lane: newPlayer.lane,
        amount_paid: newPlayer.amountPaid,
        tournament_id: parseInt(getItem('tournament_id') || getItem('lastTournamentId') || '1'),
        squad_id: selectedSquad ? selectedSquad.id : null,
        user_id: parseInt(getItem('user_id') || '0')
      };
      
      const createdPlayer = await apiClient.post('/api/v1/bowlers', playerData) as PlayerApiResponse;
      
      const transformedPlayer = {
        id: createdPlayer.id,
        firstName: newPlayer.firstName,
        lastName: newPlayer.lastName,
        usbc: newPlayer.usbc || '',
        average: newPlayer.average,
        handicap: newPlayer.handicap,
        scratch: newPlayer.scratch,
        bracketEntries: newPlayer.bracketEntries,
        lane: newPlayer.lane,
        totalCost: newPlayer.totalCost,
        amountPaid: newPlayer.amountPaid
      };
      setPlayers(prev => [...prev, transformedPlayer]);
    } catch (err: unknown) {
      logger.error('Failed to add player', { error: err });
      alert(`Failed to add player: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [authToken, selectedSquad, getItem]);

  const importPlayers = useCallback(async (newPlayers: Omit<Player, 'id'>[]) => {
    if (!authToken || newPlayers.length === 0) {
      return { successCount: 0, failedCount: newPlayers.length };
    }

    const payloads = newPlayers.map((newPlayer) => ({
      full_name: `${newPlayer.firstName} ${newPlayer.lastName}`.trim(),
      usbc_number: newPlayer.usbc || '',
      average: newPlayer.average,
      handicap_entry_count: newPlayer.handicap,
      scratch_entry_count: newPlayer.scratch,
      program_entry_counts: newPlayer.bracketEntries,
      lane: newPlayer.lane,
      amount_paid: newPlayer.amountPaid,
      tournament_id: parseInt(getItem('tournament_id') || getItem('lastTournamentId') || '1'),
      squad_id: selectedSquad ? selectedSquad.id : null,
      user_id: parseInt(getItem('user_id') || '0')
    }));

    const results = await Promise.allSettled(payloads.map((playerData) => apiClient.post('/api/v1/bowlers', playerData)));
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      await loadPlayers();
    }

    if (failedCount > 0) {
      logger.warn('Some imported players failed to save', { successCount, failedCount });
    }

    return { successCount, failedCount };
  }, [authToken, getItem, loadPlayers, selectedSquad]);

  const updatePlayer = useCallback(async (id: number, updates: Partial<Player>) => {
    // Update local state immediately for better UX
    setPlayers(prevPlayers =>
      prevPlayers.map(player => {
        if (player.id !== id) return player;
        const merged = { ...player, ...updates };
        if ('handicap' in updates || 'scratch' in updates || 'bracketEntries' in updates) {
          merged.totalCost = calculatePlayerTotalCost(
            normalizePlayerBracketEntries(merged.bracketEntries, merged.handicap, merged.scratch),
            bracketPrograms,
            entryFee,
          );
        }
        return merged;
      })
    );

    if (!authToken) {
      logger.debug('No auth - updating local state only');
      return;
    }

    // Build the API payload for this update
    const playerData: Record<string, any> = {};

    // Name requires the current merged state — read from setPlayers' functional updater isn't possible
    // here, so we still need the current snapshot for name fields only
    if ('firstName' in updates || 'lastName' in updates) {
      setPlayers(prev => {
        const current = prev.find(p => p.id === id);
        if (current) {
          const merged = { ...current, ...updates };
          playerData.full_name = `${merged.firstName || ''} ${merged.lastName || ''}`.trim();
        }
        return prev; // no change — just reading
      });
    }

    if ('usbc' in updates) playerData.usbc_number = updates.usbc;
    if ('average' in updates) playerData.average = updates.average;
    if ('handicap' in updates) playerData.handicap_entry_count = updates.handicap;
    if ('scratch' in updates) playerData.scratch_entry_count = updates.scratch;
    if ('bracketEntries' in updates) playerData.program_entry_counts = updates.bracketEntries;
    if ('lane' in updates) playerData.lane = String(updates.lane ?? '');
    if ('amountPaid' in updates) playerData.amount_paid = updates.amountPaid;

    // Merge into the pending patch for this player so the debounced call always
    // sends ALL accumulated changes, not just the latest single field
    pendingPatches.current[id] = { ...(pendingPatches.current[id] ?? {}), ...playerData };

    // Mark unsaved immediately so the UI shows a saving indicator
    const firstField = Object.keys(updates)[0];
    const statusKey = `${id}-${firstField}`;
    setSavingStatus(prev => ({ ...prev, [statusKey]: 'saving' }));

    // Single shared flush: restart the shared timer on every change.
    // When it fires, all accumulated patches across ALL players are sent
    // as one bulk-update request instead of N individual PATCHes.
    if (bulkFlushTimer.current) clearTimeout(bulkFlushTimer.current);
    bulkFlushTimer.current = setTimeout(async () => {
      const snapshot = { ...pendingPatches.current };
      pendingPatches.current = {};
      bulkFlushTimer.current = null;

      const payload = Object.entries(snapshot)
        .filter(([, data]) => Object.keys(data).length > 0)
        .map(([playerId, data]) => ({ id: Number(playerId), ...data }));

      if (payload.length === 0) return;

      try {
        await apiClient.bulkPatch('/api/v1/bowlers/bulk-update', payload);
        payload.forEach(row => {
          const key = `${row.id}-${Object.keys(snapshot[row.id] ?? {})[0] ?? 'field'}`;
          setSavingStatus(prev => ({ ...prev, [key]: 'success' }));
          setTimeout(() => setSavingStatus(prev => ({ ...prev, [key]: 'idle' })), 2000);
        });
      } catch (err: unknown) {
        logger.error('Failed to bulk update players', { error: err });
        payload.forEach(row => {
          setSavingStatus(prev => ({ ...prev, [`${row.id}-${firstField}`]: 'error' }));
        });
        loadPlayers(); // revert optimistic updates
        alert(`Failed to save changes: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }, 400);
  }, [authToken, bracketPrograms, entryFee, loadPlayers]);

  // Cancel all pending debounced patches (e.g. after a bulk write)
  const cancelPendingPatches = useCallback(() => {
    if (bulkFlushTimer.current) clearTimeout(bulkFlushTimer.current);
    bulkFlushTimer.current = null;
    patchTimers.current = {};
    pendingPatches.current = {};
  }, []);

  const deletePlayer = useCallback(async (playerId: number) => {
    if (!authToken) return;
    
    try {
      await apiClient.delete(`/api/v1/bowlers/${playerId}`);
      setPlayers(prev => prev.filter(pItem => pItem.id !== playerId));
    } catch (err: unknown) {
      logger.error('Failed to delete player', { error: err, playerId });
      alert(`Failed to delete player: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [authToken]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  useEffect(() => {
    setPlayers(prevPlayers =>
      prevPlayers.map(player => ({
        ...player,
        totalCost: calculatePlayerTotalCost(
          normalizePlayerBracketEntries(player.bracketEntries, player.handicap, player.scratch),
          bracketPrograms,
          entryFee,
        ),
      }))
    );
  }, [bracketPrograms, entryFee]);

  // Clear any pending debounce timers when the hook unmounts
  useEffect(() => {
    return () => {
      if (bulkFlushTimer.current) clearTimeout(bulkFlushTimer.current);
      Object.values(patchTimers.current).forEach(clearTimeout);
    };
  }, []);

  return {
    players,
    isLoading,
    savingStatus,
    addPlayer,
    updatePlayer,
    importPlayers,
    cancelPendingPatches,
    deletePlayer,
    loadPlayers,
    bulkSetPlayers: setPlayers,
  };
}
