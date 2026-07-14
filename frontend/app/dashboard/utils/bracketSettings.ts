import { BracketSettings } from '../../lib/types';
import { defaultBracketPrograms, normalizeBracketPrograms } from '../../lib/bracketPrograms';

export const createDefaultBracketSettings = (tournamentId = 0): BracketSettings => ({
  tournament_id: tournamentId,
  bracket_size: 8,
  first_place_amount: 0,
  second_place_amount: 0,
  house_fee_amount: 0,
  default_entry_fee: 0,
  bracket_programs: defaultBracketPrograms,
  handicap_percentage: 80,
  handicap_base: 200,
  allow_byes: false,
});

export function calculateHouseAmount(
  settings: Pick<BracketSettings, 'bracket_size' | 'default_entry_fee' | 'first_place_amount' | 'second_place_amount'>
): number {
  const bracketSize = Number(settings.bracket_size ?? 0);
  const costPerBracket = Number(settings.default_entry_fee ?? 0);
  const firstPlace = Number(settings.first_place_amount ?? 0);
  const secondPlace = Number(settings.second_place_amount ?? 0);
  return (bracketSize * costPerBracket) - firstPlace - secondPlace;
}

export function applyAutoHouse(prev: BracketSettings, patch: Partial<BracketSettings>): BracketSettings {
  const next = { ...prev, ...patch };
  return {
    ...next,
    house_fee_amount: calculateHouseAmount(next),
  };
}

export type BracketSplitValidation =
  | { ok: true; houseAmount: number }
  | { ok: false; message: string; validationKey?: string };

export function validateBracketSettingsSplit(settings: BracketSettings): BracketSplitValidation {
  const bracketSize = Number(settings.bracket_size ?? 0);
  const costPerBracket = Number(settings.default_entry_fee ?? 0);
  const firstPlace = Number(settings.first_place_amount ?? 0);
  const secondPlace = Number(settings.second_place_amount ?? 0);
  const houseAmount = calculateHouseAmount(settings);
  const expectedTotal = bracketSize * costPerBracket;
  const actualTotal = firstPlace + secondPlace + houseAmount;

  if (houseAmount < 0) {
    return {
      ok: false,
      message: 'Prize split invalid: 1st + 2nd cannot exceed Bracket Size x Entry Fee.',
    };
  }

  if (Math.abs(actualTotal - expectedTotal) > 0.009) {
    return {
      ok: false,
      message: `Prize split mismatch: 1st + 2nd + House ($${actualTotal.toFixed(2)}) must equal Bracket Size x Entry Fee ($${expectedTotal.toFixed(2)}).`,
      validationKey: `${expectedTotal.toFixed(2)}|${actualTotal.toFixed(2)}`,
    };
  }

  return {
    ok: true,
    houseAmount,
  };
}

export function normalizeLoadedBracketSettings(
  settings: Partial<BracketSettings> | null | undefined,
  tournamentId: number
): BracketSettings {
  if (!settings) {
    return createDefaultBracketSettings(tournamentId);
  }

  return {
    ...createDefaultBracketSettings(tournamentId),
    ...settings,
    bracket_size: 8,
    bracket_programs: normalizeBracketPrograms(settings.bracket_programs, settings.default_entry_fee),
    handicap_percentage: settings.handicap_percentage ?? 80,
    handicap_base: settings.handicap_base ?? 200,
  };
}
