import { SidePot, SidePotsSettings } from '../../lib/types';

export const DEFAULT_SIDE_POTS: SidePot[] = [
  { key: 'high_game_scratch', name: 'High Game Scratch', enabled: false },
  { key: 'high_series_scratch', name: 'High Series Scratch', enabled: false },
  { key: 'high_game_handicap', name: 'High Game Handicap', enabled: false },
  { key: 'high_series_handicap', name: 'High Series Handicap', enabled: false },
];

export const createDefaultSidePots = (tournamentId = 0): SidePotsSettings => ({
  tournament_id: tournamentId,
  entry_fee: 0,
  prize_amount: 0,
  pots: DEFAULT_SIDE_POTS.map(pot => ({ ...pot })),
});

type ParsedStoredSidePots = Partial<SidePotsSettings> & {
  pots?: Array<Partial<SidePot> & { entry_fee?: number }>;
};

export function hydrateStoredSidePots(stored: string, tournamentId: number): SidePotsSettings {
  const parsed = JSON.parse(stored) as ParsedStoredSidePots;

  const mergedPots = DEFAULT_SIDE_POTS.map(defaultPot => {
    const savedPot = parsed.pots?.find(pot => pot.key === defaultPot.key);
    return savedPot
      ? { key: defaultPot.key, name: defaultPot.name, enabled: savedPot.enabled ?? false }
      : { ...defaultPot };
  });

  const entryFee = typeof parsed.entry_fee === 'number' && !isNaN(parsed.entry_fee) ? parsed.entry_fee : 0;
  const prizeAmount = typeof parsed.prize_amount === 'number' && !isNaN(parsed.prize_amount) ? parsed.prize_amount : 0;

  return {
    tournament_id: tournamentId,
    entry_fee: entryFee,
    prize_amount: prizeAmount,
    pots: mergedPots,
  };
}
