import { useState, useEffect, useCallback } from 'react';

import { Player, Squad } from '../types';
import { logger } from '../../lib/logger';
import { API } from '../../lib/api';

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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'success' | 'error'>>({});

  const getDemoPlayers = useCallback(() => {
    return [
      { id: 1, firstName: 'John', lastName: 'Doe', usbc: '12345678', average: 180, handicap: 0, scratch: 1, lane: 'A1', division: 'Open', totalCost: (0 + 1) * entryFee, amountPaid: entryFee },
      { id: 2, firstName: 'Jane', lastName: 'Smith', usbc: '87654321', average: 150, handicap: 2, scratch: 0, lane: 'A2', division: 'Womens', totalCost: (2 + 0) * entryFee, amountPaid: entryFee },
      { id: 3, firstName: 'Bob', lastName: 'Johnson', usbc: '11111111', average: 200, handicap: 1, scratch: 2, lane: 'B1', division: 'Senior', totalCost: (1 + 2) * entryFee, amountPaid: entryFee * 3 }
    ];
  }, [entryFee]);

  const loadPlayers = useCallback(async () => {
    if (!authToken) return;
    
    setIsLoading(true);
    
    try {
      let bowlersUrl = '/api/v1/bowlers';
      if (selectedSquad) {
        bowlersUrl = `/api/v1/bowlers?squad_id=${selectedSquad}`;
      }
      
      const response = await fetch(API(bowlersUrl), {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (!response.ok) {
        // If API fails, load demo data
        logger.warn('API not available, loading demo data', { status: response.status });
        setIsDemoMode(true);
        setPlayers(getDemoPlayers());
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
      // Load demo data as fallback
      setPlayers(getDemoPlayers());
    } finally {
      setIsLoading(false);
    }
  }, [selectedSquad, squads, authToken, getDemoPlayers]);

  const addPlayer = useCallback(async (newPlayer: Omit<Player, 'id'>) => {
    if (!authToken) return;

    try {
      const response = await fetch(API('/api/v1/bowlers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: `${newPlayer.firstName} ${newPlayer.lastName}`,
          usbc: newPlayer.usbc || '',
          average: newPlayer.average,
          handicap: newPlayer.handicap,
          scratch: newPlayer.scratch,
          lane: newPlayer.lane,
          division: newPlayer.division,
          amount_paid: newPlayer.amountPaid,
          tournament_id: parseInt(getItem('tournament_id') || '1'),
          squad_id: selectedSquad || null
        })
      });

      if (response.ok) {
        const createdPlayer = await response.json();
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
      } else {
        const error = await response.text();
        alert(`Failed to add player: ${error}`);
      }
    } catch (err) {
      logger.error('Failed to add player', { error: err });
      alert('Failed to add player. Please try again.');
    }
  }, [authToken, selectedSquad, getItem]);

  const updatePlayer = useCallback(async (playerId: number, field: string, value: string | number) => {
    console.log('updatePlayer called:', { playerId, field, value, authToken: !!authToken, isDemoMode });
    
    const saveKey = `${playerId}-${field}`;
    setSavingStatus(prev => ({ ...prev, [saveKey]: 'saving' }));

    // If in demo mode, just update local state
    if (isDemoMode || !authToken) {
      console.log('Demo mode or no auth - updating local state only');
      
      // Update local state with potential total cost recalculation
      setPlayers(prev => prev.map(player => {
        if (player.id === playerId) {
          const updatedPlayer = { ...player, [field]: value };
          
          // Recalculate total cost if handicap or scratch changed
          if (field === 'handicap' || field === 'scratch') {
            updatedPlayer.totalCost = (updatedPlayer.handicap + updatedPlayer.scratch) * entryFee;
          }
          
          return updatedPlayer;
        }
        return player;
      }));

      setSavingStatus(prev => ({ ...prev, [saveKey]: 'success' }));

      // Clear success status after 2 seconds
      setTimeout(() => {
        setSavingStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[saveKey];
          return newStatus;
        });
      }, 2000);
      
      return;
    }

    // Optimistic update
    const updatedPlayer = players.find(pItem => pItem.id === playerId);
    if (!updatedPlayer) {
      console.log('Player not found:', playerId);
      setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }));
      return;
    }

    try {
      console.log('Making API call to update player:', API(`/api/v1/bowlers/${playerId}`));
      
      const response = await fetch(API(`/api/v1/bowlers/${playerId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          [field]: value,
          tournament_id: parseInt(getItem('tournament_id') || '1')
        })
      });

      console.log('API response:', response.status, response.ok);

      if (response.ok) {
        // Update local state with potential total cost recalculation
        setPlayers(prev => prev.map(player => {
          if (player.id === playerId) {
            const updatedPlayer = { ...player, [field]: value };
            
            // Recalculate total cost if handicap or scratch changed
            if (field === 'handicap' || field === 'scratch') {
              updatedPlayer.totalCost = (updatedPlayer.handicap + updatedPlayer.scratch) * entryFee;
            }
            
            return updatedPlayer;
          }
          return player;
        }));

        setSavingStatus(prev => ({ ...prev, [saveKey]: 'success' }));

        // Clear success status after 2 seconds
        setTimeout(() => {
          setSavingStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[saveKey];
            return newStatus;
          });
        }, 2000);
      } else {
        const errorText = await response.text();
        console.log('API error response:', errorText);
        setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }));
        
        // Clear error status after 3 seconds
        setTimeout(() => {
          setSavingStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[saveKey];
            return newStatus;
          });
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to update player:', err);
      logger.error('Failed to update player', { error: err, playerId, field });
      setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }));
      
      // Clear error status after 3 seconds
      setTimeout(() => {
        setSavingStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[saveKey];
          return newStatus;
        });
      }, 3000);
    }
  }, [authToken, players, getItem, isDemoMode, entryFee]);

  const deletePlayer = useCallback(async (playerId: number) => {
    if (!authToken) return;
    
    if (!confirm('Are you sure you want to delete this player?')) return;

    try {
      const response = await fetch(API(`/api/v1/bowlers/${playerId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.ok) {
        setPlayers(prev => prev.filter(pItem => pItem.id !== playerId));
      } else {
        const error = await response.text();
        alert(`Failed to delete player: ${error}`);
      }
    } catch (err) {
      logger.error('Failed to delete player', { error: err, playerId });
      alert('Failed to delete player. Please try again.');
    }
  }, [authToken]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  return {
    players,
    isLoading,
    isDemoMode,
    savingStatus,
    addPlayer,
    updatePlayer,
    deletePlayer,
    loadPlayers
  };
}
