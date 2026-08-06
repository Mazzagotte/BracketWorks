/**
 * Centralized storage key generators to ensure consistency across all pages
 * that read or write the same localStorage keys.
 */

/**
 * Key that tracks whether payouts are unlocked for a given tournament/squad.
 * Returns null when no tournament is selected.
 */
export const getPayoutUnlockKey = (
  tournamentId: number | null,
  squadId: number | null
): string | null => {
  if (!tournamentId) return null;
  return `payouts_unlocked_${tournamentId}_${squadId ?? 'all'}`;
};

/**
 * Key that tracks whether the scores table is locked (pending payout calculation)
 * for a given tournament/squad. Returns null when no tournament is selected.
 */
export const getScoresLockKey = (
  tournamentId: number | null,
  squadId: number | null
): string | null => {
  if (!tournamentId) return null;
  return `scores_locked_${tournamentId}_${squadId ?? 'all'}`;
};
