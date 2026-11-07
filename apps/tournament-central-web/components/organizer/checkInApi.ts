import { getJsonErrorDetail } from './organizerApi';

export type BowlerCheckInResult = {
  bowler_id: number;
  checked_in_at: string | null;
};

/** Checks a bowler in at the tournament desk, or undoes the check-in. */
export async function setBowlerCheckIn(
  token: string,
  tournamentId: number,
  bowlerId: number,
  checkedIn: boolean,
): Promise<BowlerCheckInResult> {
  const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}/bowlers/${bowlerId}/check-in`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ checked_in: checkedIn }),
  });

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to update check-in (${response.status})`));
  }

  const result = responseData as Partial<BowlerCheckInResult> | null;
  return {
    bowler_id: Number(result?.bowler_id ?? bowlerId),
    checked_in_at: typeof result?.checked_in_at === 'string' ? result.checked_in_at : null,
  };
}
