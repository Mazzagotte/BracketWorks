import { useState, useEffect, useCallback } from 'react';

import { Player, Squad } from '../types';
import { logger } from '../../lib/logger';
import { API, apiClient } from '../../lib/api';

interface BowlerApiResponse {
  id: number;
  name?: string;
  usbc?: string;
  average?: number;
  handicap?: number;
  scratch?: number;
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
          handicap: bowler.handicap || 0,
          scratch: bowler.scratch || 0,
          lane: bowler.lane || '',
          division: bowler.division || 'Open',
          totalCost: ((bowler.scratch || 0) + (bowler.handicap || 0)) * entryFee,
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
  }, [selectedSquad, squads, authToken]);

  const addPlayer = useCallback(async (newPlayer: Omit<Player, 'id'>) => {
    if (!authToken) return;

    try {
      const playerData = {
        name: `${newPlayer.firstName} ${newPlayer.lastName}`,
        usbc: newPlayer.usbc || '',
        average: newPlayer.average,
        handicap: newPlayer.handicap,
        scratch: newPlayer.scratch,
        lane: newPlayer.lane,
        division: newPlayer.division,
        amount_paid: newPlayer.amountPaid,
        tournament_id: parseInt(getItem('tournament_id') || getItem('lastTournamentId') || '1'),
        squad_id: selectedSquad ? selectedSquad.id : null
      };

      console.log('Adding player with data:', playerData);
      
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
    } catch (err: any) {
      console.error('Failed to add player:', err);
      alert(`Failed to add player: ${err.message || 'Unknown error'}`);
    }
  }, [authToken, selectedSquad, getItem]);

  const updatePlayer = useCallback(async (id: number, updates: Partial<Player>) => {
    // Update local state immediately for better UX
    setPlayers(prevPlayers => 
      prevPlayers.map(player => 
        player.id === id ? { ...player, ...updates } : player
      )
    );

    if (!authToken) {
      console.log('No auth - updating local state only');
      return;
    }

    try {
      setSavingStatus(prev => ({ ...prev, [id]: 'saving' }));
      
      const playerData = {
        name: `${updates.firstName || ''} ${updates.lastName || ''}`.trim(),
        usbc: updates.usbc,
        average: updates.average,
        handicap: updates.handicap,
        scratch: updates.scratch,
        lane: updates.lane,
        division: updates.division,
        amount_paid: updates.amountPaid,
        squad_id: selectedSquad ? selectedSquad.id : null
      };

      await apiClient.put(`/api/v1/bowlers/${id}`, playerData);
      setSavingStatus(prev => ({ ...prev, [id]: 'success' }));
      
      // Clear success status after a delay
      setTimeout(() => {
        setSavingStatus(prev => ({ ...prev, [id]: 'idle' }));
      }, 2000);
    } catch (err: any) {
      console.error('Failed to update player:', err);
      setSavingStatus(prev => ({ ...prev, [id]: 'error' }));
      // Revert the local change on error
      loadPlayers();
      alert(`Failed to update player: ${err.message || 'Unknown error'}`);
    }
  }, [authToken, selectedSquad, loadPlayers]);

  const deletePlayer = useCallback(async (playerId: number) => {
    if (!authToken) return;
    
    if (!confirm('Are you sure you want to delete this player?')) return;

    try {
      await apiClient.delete(`/api/v1/bowlers/${playerId}`);
      setPlayers(prev => prev.filter(pItem => pItem.id !== playerId));
    } catch (err: any) {
      console.error('Failed to delete player:', err);
      alert(`Failed to delete player: ${err.message || 'Unknown error'}`);
    }
  }, [authToken]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  return {
    players,
    isLoading,
    savingStatus,
    addPlayer,
    updatePlayer,
    deletePlayer,
    loadPlayers
  };
}
