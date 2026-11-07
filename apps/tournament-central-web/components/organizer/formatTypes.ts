/**
 * Tournament format model: the rules an organizer sets per event, the side events bowlers buy,
 * and eligibility. Shared by setup (types, templates, event rules), the public registration form
 * (side events, eligibility checks), and the API (which stores side-event picks per registration).
 *
 * Every field is optional in saved payloads. Use the normalize* helpers when reading, so tournaments
 * saved before these fields existed keep working with neutral defaults.
 */

/** How a game is bowled. Scotch and Baker change who throws each shot or frame, not just entry size. */
export type EventFormat = 'singles' | 'doubles' | 'scotch-doubles' | 'team' | 'baker-team';

export type HandicapRule = {
  /** Percentage of the gap between the basis and the bowler's average, for example 90. */
  percent: number;
  /** Basis score, for example 220. */
  basis: number;
  /** Highest handicap allowed per game, or null for no limit. */
  maxPins: number | null;
  /** Scotch doubles usually figures handicap from the pair's combined average. */
  perPair: boolean;
};

export type AverageSource = 'highest-current-or-last' | 'current' | 'last-season' | 'organizer-assigned';

export type AverageRule = {
  source: AverageSource;
  /** Games an average needs behind it to count, for example 21. */
  minGames: number;
  /** What happens when a bowler has no qualifying average. */
  noAverage: 'assigned-average' | 'not-eligible';
  /** Average used for bowlers without one when noAverage is 'assigned-average'. */
  assignedAverage: number | null;
};

export type TeamRules = {
  /** Mixed doubles or mixed teams: at least one man and one woman. */
  mixedRequired: boolean;
  /** Combined average cap for the entry, for example 400. */
  combinedAverageMax: number | null;
};

export type FinalsType =
  | 'none'
  | 'cut'
  | 'stepladder'
  | 'match-play-single'
  | 'match-play-double'
  | 'round-robin'
  | 'survivor';

export type FinalsRule = {
  type: FinalsType;
  /** Who advances from qualifying, when there's a cut. */
  cut: { by: 'count' | 'percent'; value: number } | null;
  /** Round robin only. */
  roundRobinScoring: 'bonus-pins' | 'petersen' | null;
  /** Round robin bonus pins for a win, for example 30. */
  winBonusPins: number | null;
  /** Free text shown to bowlers, for example "Top 5 bowl a stepladder, one game per match." */
  notes: string;
  /**
   * Who the standings and finals are for. 'tournament' (default): all squads combined. 'squad': each
   * squad has its own standings, cut, prize fund (cash line), and finals, as sweeper squads often do.
   */
  scope: FinalsScope;
};

export type FinalsScope = 'tournament' | 'squad';

/** Rules for one event. Kept on EventConfig as `rules`. */
export type EventRules = {
  format: EventFormat;
  /** Games per entry. 0 means not stated. */
  games: number;
  handicap: HandicapRule | null;
  average: AverageRule;
  team: TeamRules;
  /** With re-entries: whether only the best set counts (sweepers) or every set counts. */
  reentryScoring: 'best-counts' | 'all-count';
  finals: FinalsRule;
  /** About 1 in N entries cash. null means not stated. */
  payoutRatio: number | null;
  /** Bowlers must enter a current USBC membership number. */
  usbcRequired: boolean;
};

/** Division prize type: youth events pay scholarships to protect amateur eligibility. */
export type PrizeType = 'cash' | 'scholarship';

export type DivisionGender = 'any' | 'men' | 'women';

/** Extra division rules kept on DivisionConfig as `rules`. Average and age limits already live on DivisionConfig. */
export type DivisionRules = {
  gender: DivisionGender;
  prizeType: PrizeType;
};

/** What a fee is. 'fee' is a plain charge (lineage, processing); the rest are side events. */
export type SideEventKind = 'fee' | 'brackets' | 'high-game-pot' | 'high-series-pot' | 'optional-scratch' | 'strike-pot' | 'mystery-doubles' | 'donation';

export type BracketRules = {
  scoring: 'handicap' | 'scratch';
  /** Bowlers per bracket, usually 8. */
  size: number;
  /** Payouts per bracket, in cents, for example 3000 and 1000. */
  firstPlaceCents: number;
  secondPlaceCents: number;
  /** Kept by the house per bracket, for example 500. */
  houseCents: number;
  /** Refund entries in brackets that don't fill. */
  refundUnfilled: boolean;
};

/** Side-event settings kept on FeeConfig as `sideEvent`. */
export type SideEventSettings = {
  kind: SideEventKind;
  /** Bowlers choose how many (for example 5 brackets). Otherwise it's yes or no. */
  allowQuantity: boolean;
  maxQuantity: number | null;
  /** Charged per bowler (brackets, pots) or once per registration (a team fee). */
  per: 'bowler' | 'registration';
  brackets: BracketRules | null;
};

/** One side-event pick on a registration, as sent by the registration form and stored by the API. */
export type SideEventSelection = {
  feeId: string;
  /** Index of the bowler on the registration, or null when charged per registration. */
  bowlerIndex: number | null;
  quantity: number;
};

export const EVENT_FORMAT_LABEL: Record<EventFormat, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  'scotch-doubles': 'Scotch doubles',
  team: 'Team',
  'baker-team': 'Baker team',
};

export const FINALS_LABEL: Record<FinalsType, string> = {
  none: 'No finals',
  cut: 'Cut to finals',
  stepladder: 'Stepladder',
  'match-play-single': 'Match play, single elimination',
  'match-play-double': 'Match play, double elimination',
  'round-robin': 'Round robin',
  survivor: 'Survivor',
};

export const SIDE_EVENT_LABEL: Record<SideEventKind, string> = {
  fee: 'Fee',
  brackets: 'Brackets',
  'high-game-pot': 'High game pot',
  'high-series-pot': 'High series pot',
  'optional-scratch': 'Optional scratch',
  'strike-pot': 'Strike pot',
  'mystery-doubles': 'Mystery doubles',
  donation: 'Donation',
};

/** Players per entry for each format, before an organizer changes it. */
export const FORMAT_PLAYERS: Record<EventFormat, number> = {
  singles: 1,
  doubles: 2,
  'scotch-doubles': 2,
  team: 4,
  'baker-team': 5,
};

export function defaultEventRules(format: EventFormat = 'singles', scoring: 'handicap' | 'scratch' | 'no-tap' = 'handicap'): EventRules {
  return {
    format,
    games: 0,
    handicap: scoring === 'handicap'
      ? { percent: 90, basis: 220, maxPins: null, perPair: format === 'scotch-doubles' }
      : null,
    average: { source: 'highest-current-or-last', minGames: 21, noAverage: 'assigned-average', assignedAverage: null },
    team: { mixedRequired: false, combinedAverageMax: null },
    reentryScoring: 'all-count',
    finals: { type: 'none', cut: null, roundRobinScoring: null, winBonusPins: null, notes: '', scope: 'tournament' },
    payoutRatio: null,
    usbcRequired: false,
  };
}

export function defaultDivisionRules(): DivisionRules {
  return { gender: 'any', prizeType: 'cash' };
}

export function defaultSideEvent(kind: SideEventKind = 'fee'): SideEventSettings {
  return {
    kind,
    allowQuantity: kind === 'brackets',
    maxQuantity: null,
    per: kind === 'fee' ? 'registration' : 'bowler',
    brackets: kind === 'brackets'
      ? { scoring: 'handicap', size: 8, firstPlaceCents: 3000, secondPlaceCents: 1000, houseCents: 0, refundUnfilled: true }
      : null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOr<T>(value: unknown, fallback: T): number | T {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Fills in any rule the saved event doesn't have. `scoring` and `maxPlayers` come from the event itself. */
export function normalizeEventRules(raw: unknown, event: { scoring: 'handicap' | 'scratch' | 'no-tap'; maxPlayers: number }): EventRules {
  const inferredFormat: EventFormat = event.maxPlayers >= 4 ? 'team' : event.maxPlayers === 2 ? 'doubles' : 'singles';
  const base = defaultEventRules(inferredFormat, event.scoring);
  if (!isObject(raw)) return base;
  const format = (Object.keys(EVENT_FORMAT_LABEL) as EventFormat[]).includes(raw.format as EventFormat) ? raw.format as EventFormat : base.format;
  const handicapRaw = isObject(raw.handicap) ? raw.handicap : null;
  const averageRaw = isObject(raw.average) ? raw.average : {};
  const teamRaw = isObject(raw.team) ? raw.team : {};
  const finalsRaw = isObject(raw.finals) ? raw.finals : {};
  const finalsType = (Object.keys(FINALS_LABEL) as FinalsType[]).includes(finalsRaw.type as FinalsType) ? finalsRaw.type as FinalsType : 'none';
  const cutRaw = isObject(finalsRaw.cut) ? finalsRaw.cut : null;
  return {
    format,
    games: numberOr(raw.games, 0),
    handicap: event.scoring !== 'handicap'
      ? null
      : handicapRaw
        ? {
          percent: numberOr(handicapRaw.percent, 90),
          basis: numberOr(handicapRaw.basis, 220),
          maxPins: numberOr(handicapRaw.maxPins, null),
          perPair: Boolean(handicapRaw.perPair),
        }
        : base.handicap,
    average: {
      source: (['highest-current-or-last', 'current', 'last-season', 'organizer-assigned'] as AverageSource[]).includes(averageRaw.source as AverageSource)
        ? averageRaw.source as AverageSource
        : base.average.source,
      minGames: numberOr(averageRaw.minGames, base.average.minGames),
      noAverage: averageRaw.noAverage === 'not-eligible' ? 'not-eligible' : 'assigned-average',
      assignedAverage: numberOr(averageRaw.assignedAverage, null),
    },
    team: {
      mixedRequired: Boolean(teamRaw.mixedRequired),
      combinedAverageMax: numberOr(teamRaw.combinedAverageMax, null),
    },
    reentryScoring: raw.reentryScoring === 'best-counts' ? 'best-counts' : 'all-count',
    finals: {
      type: finalsType,
      cut: cutRaw ? { by: cutRaw.by === 'percent' ? 'percent' : 'count', value: numberOr(cutRaw.value, 0) } : null,
      roundRobinScoring: finalsRaw.roundRobinScoring === 'petersen' ? 'petersen' : finalsRaw.roundRobinScoring === 'bonus-pins' ? 'bonus-pins' : null,
      winBonusPins: numberOr(finalsRaw.winBonusPins, null),
      notes: typeof finalsRaw.notes === 'string' ? finalsRaw.notes : '',
      scope: finalsRaw.scope === 'squad' ? 'squad' : 'tournament',
    },
    payoutRatio: numberOr(raw.payoutRatio, null),
    usbcRequired: Boolean(raw.usbcRequired),
  };
}

export function normalizeDivisionRules(raw: unknown): DivisionRules {
  if (!isObject(raw)) return defaultDivisionRules();
  return {
    gender: raw.gender === 'men' || raw.gender === 'women' ? raw.gender : 'any',
    prizeType: raw.prizeType === 'scholarship' ? 'scholarship' : 'cash',
  };
}

export function normalizeSideEvent(raw: unknown): SideEventSettings {
  if (!isObject(raw)) return defaultSideEvent('fee');
  const kind = (Object.keys(SIDE_EVENT_LABEL) as SideEventKind[]).includes(raw.kind as SideEventKind) ? raw.kind as SideEventKind : 'fee';
  const base = defaultSideEvent(kind);
  const bracketsRaw = isObject(raw.brackets) ? raw.brackets : null;
  return {
    kind,
    allowQuantity: typeof raw.allowQuantity === 'boolean' ? raw.allowQuantity : base.allowQuantity,
    maxQuantity: numberOr(raw.maxQuantity, null),
    per: raw.per === 'registration' ? 'registration' : raw.per === 'bowler' ? 'bowler' : base.per,
    brackets: kind !== 'brackets'
      ? null
      : bracketsRaw
        ? {
          scoring: bracketsRaw.scoring === 'scratch' ? 'scratch' : 'handicap',
          size: numberOr(bracketsRaw.size, 8),
          firstPlaceCents: numberOr(bracketsRaw.firstPlaceCents, 3000),
          secondPlaceCents: numberOr(bracketsRaw.secondPlaceCents, 1000),
          houseCents: numberOr(bracketsRaw.houseCents, 0),
          refundUnfilled: bracketsRaw.refundUnfilled !== false,
        }
        : base.brackets,
  };
}

/** Per-game handicap for one average, for display and checks. Never negative. */
export function handicapPins(rule: HandicapRule, average: number): number {
  const pins = Math.floor(Math.max(0, rule.basis - average) * (rule.percent / 100));
  return rule.maxPins === null ? pins : Math.min(pins, rule.maxPins);
}
