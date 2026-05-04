/**
 * Batch localStorage operations for better performance
 * Reduces multiple localStorage reads to a single operation
 */

import { getSelectedSquadId, getSelectedTournamentId } from './selection-session'

export interface TournamentSessionData {
  lastTournamentId: string | null;
  token: string | null;
  userId: string | null;
  selectedSquadId: string | null;
}

/**
 * Read all tournament-related data from localStorage in one go
 * More efficient than multiple individual reads
 */
export function getTournamentSessionData(): TournamentSessionData {
  if (typeof window === 'undefined') {
    return {
      lastTournamentId: null,
      token: null,
      userId: null,
      selectedSquadId: null,
    };
  }

  try {
    return {
      lastTournamentId: getSelectedTournamentId(),
      token: localStorage.getItem('token'),
      userId: localStorage.getItem('user_id'),
      selectedSquadId: getSelectedSquadId(),
    };
  } catch (error) {
    console.error('Failed to read tournament session data:', error);
    return {
      lastTournamentId: null,
      token: null,
      userId: null,
      selectedSquadId: null,
    };
  }
}

/**
 * Cache for tournament session data to avoid repeated localStorage reads
 * within the same page load
 */
let cachedSessionData: TournamentSessionData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000; // 1 second cache

/**
 * Get cached tournament session data or read from localStorage
 * Useful for pages that need this data multiple times
 */
export function getCachedTournamentSessionData(): TournamentSessionData {
  const now = Date.now();
  
  if (cachedSessionData && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedSessionData;
  }
  
  cachedSessionData = getTournamentSessionData();
  cacheTimestamp = now;
  
  return cachedSessionData;
}

/**
 * Clear the cache - call when tournament/user changes
 */
export function clearSessionDataCache(): void {
  cachedSessionData = null;
  cacheTimestamp = 0;
}
