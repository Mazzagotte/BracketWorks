import { useState, useEffect, useCallback, useRef } from 'react';

import { Player, Squad } from '../types';
import { logger } from '../../lib/logger';
import { API, apiClient } from '../../lib/api';

interface BowlerApiResponse {
  id: number;
  name?: string;
  usbc?: string;
  average?: number;
  handicap_entries?: number;
  scratch_entries?: number;
  lane?: string;
  division?: string;
  squad_id?: number;
  amount_paid?: number;
}

interface UsePlayersOptions {
  selectedSquad: Squad | null;
  squads: Squad[];
  authToken: string | null;
  getItem: (key: string) => string | null;
  entryFee: number;
}

export function usePlayers({ selectedSquad, squads, authToken, getItem, entryFee }: UsePlayersOptions) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'success' | 'error'>>({});

  // Pending debounce timers per player: playerId -> timeout handle
  const patchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Latest pending patch payload per player — so the debounced call always sends the freshest values
  const pendingPatches = useRef<Record<number, Record<string, any>>>({});

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
      let bowlersUrl = '/api/v1/bowlers';
      if (selectedSquad) {
        bowlersUrl = `/api/v1/bowlers?squad_id=${selectedSquad.id}`;
      }
      
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
      
      const transformedData = data.map((bowler: BowlerApiResponse) => {
        const squad = squads?.find(sItem => sItem.id === bowler.squad_id);
        return {
          id: bowler.id,
          firstName: bowler.name?.split(' ')[0] || '',
          lastName: bowler.name?.split(' ').slice(1).join(' ') || '',
          usbc: bowler.usbc || '',
          average: bowler.average || 0,
          handicap: bowler.handicap_entries || 0,
          scratch: bowler.scratch_entries || 0,
          lane: bowler.lane || '',
          division: bowler.division || 'Open',
          totalCost: ((bowler.scratch_entries || 0) + (bowler.handicap_entries || 0)) * entryFee,
          amountPaid: bowler.amount_paid || 0,
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
  }, [selectedSquad, squads, authToken]);

  const addPlayer = useCallback(async (newPlayer: Omit<Player, 'id'>) => {
    if (!authToken) return;

    try {
      const playerData = {
        name: `${newPlayer.firstName} ${newPlayer.lastName}`,
        usbc: newPlayer.usbc || '',
        average: newPlayer.average,
        handicap_entries: newPlayer.handicap,
        scratch_entries: newPlayer.scratch,
        lane: newPlayer.lane,
        division: newPlayer.division,
        amount_paid: newPlayer.amountPaid,
        tournament_id: parseInt(getItem('tournament_id') || getItem('lastTournamentId') || '1'),
        squad_id: selectedSquad ? selectedSquad.id : null
      };
      
      const createdPlayer = await apiClient.post('/api/v1/bowlers', playerData) as BowlerApiResponse;
      
      const transformedPlayer = {
        id: createdPlayer.id,
        firstName: newPlayer.firstName,
        lastName: newPlayer.lastName,
        usbc: newPlayer.usbc || '',
        average: newPlayer.average,
        handicap: newPlayer.handicap,
        scratch: newPlayer.scratch,
        lane: newPlayer.lane,
        division: newPlayer.division,
        totalCost: newPlayer.totalCost,
        amountPaid: newPlayer.amountPaid
      };
      setPlayers(prev => [...prev, transformedPlayer]);
    } catch (err: unknown) {
      logger.error('Failed to add player', { error: err });
      alert(`Failed to add player: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [authToken, selectedSquad, getItem]);

  const updatePlayer = useCallback(async (id: number, updates: Partial<Player>) => {
    // Update local state immediately for better UX
    setPlayers(prevPlayers =>
      prevPlayers.map(player => {
        if (player.id !== id) return player;
        const merged = { ...player, ...updates };
        if ('handicap' in updates || 'scratch' in updates) {
          merged.totalCost = (merged.scratch + merged.handicap) * entryFee;
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
          playerData.name = `${merged.firstName || ''} ${merged.lastName || ''}`.trim();
        }
        return prev; // no change — just reading
      });
    }

    if ('usbc' in updates) playerData.usbc = updates.usbc;
    if ('average' in updates) playerData.average = updates.average;
    if ('handicap' in updates) playerData.handicap_entries = updates.handicap;
    if ('scratch' in updates) playerData.scratch_entries = updates.scratch;
    if ('lane' in updates) playerData.lane = String(updates.lane ?? '');
    if ('division' in updates) playerData.division = updates.division;
    if ('amountPaid' in updates) playerData.amount_paid = updates.amountPaid;

    // Merge into the pending patch for this player so the debounced call always
    // sends ALL accumulated changes, not just the latest single field
    pendingPatches.current[id] = { ...(pendingPatches.current[id] ?? {}), ...playerData };

    // Mark unsaved immediately so the UI shows a saving indicator
    const firstField = Object.keys(updates)[0];
    const statusKey = `${id}-${firstField}`;
    setSavingStatus(prev => ({ ...prev, [statusKey]: 'saving' }));

    // Clear any existing debounce timer for this player
    if (patchTimers.current[id]) clearTimeout(patchTimers.current[id]);

    // Debounce: send the PATCH 400ms after the last change for this player
    patchTimers.current[id] = setTimeout(async () => {
      const payload = pendingPatches.current[id];
      if (!payload || Object.keys(payload).length === 0) return;
      delete pendingPatches.current[id];

      try {
        await apiClient.patch(`/api/v1/bowlers/${id}`, payload);
        setSavingStatus(prev => ({ ...prev, [statusKey]: 'success' }));
        setTimeout(() => setSavingStatus(prev => ({ ...prev, [statusKey]: 'idle' })), 2000);
      } catch (err: unknown) {
        logger.error('Failed to update player', { error: err, playerId: id });
        setSavingStatus(prev => ({ ...prev, [statusKey]: 'error' }));
        loadPlayers(); // revert optimistic update
        alert(`Failed to update player: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }, 400);
  }, [authToken, entryFee, loadPlayers]);

  // Cancel all pending debounced patches (e.g. after a bulk write)
  const cancelPendingPatches = useCallback(() => {
    Object.values(patchTimers.current).forEach(clearTimeout);
    patchTimers.current = {};
    pendingPatches.current = {};
  }, []);

  const deletePlayer = useCallback(async (playerId: number) => {
    if (!authToken) return;
    
    if (!confirm('Are you sure you want to delete this player?')) return;

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

  // Clear any pending debounce timers when the hook unmounts
  useEffect(() => {
    return () => {
      Object.values(patchTimers.current).forEach(clearTimeout);
    };
  }, []);

  return {
    players,
    isLoading,
    savingStatus,
    addPlayer,
    updatePlayer,
    cancelPendingPatches,
    deletePlayer,
    loadPlayers
  };
}
