/**
 * Public live standings contract: GET /api/v1/public/tc-tournament/{tournamentId}/standings
 *
 * The API computes everything (handicap, totals, ranks, cut and cash lines, finals progress) so the
 * live page only renders. Field names are camelCase on purpose: this payload is built for the page.
 * `fingerprint` changes whenever any score, finals game, or registration affecting standings changes;
 * the page compares it to skip re-rendering when nothing changed.
 */

export type LiveTournamentStatus = 'upcoming' | 'in-progress' | 'final';

export type LiveStandings = {
  tournament: {
    id: number;
    name: string;
    /** "Nov 15, 2026" or "Feb 27 - Feb 28, 2027". */
    dateText: string;
    /** "Meridian Bowling Lanes, Meridian, ID". */
    locationText: string;
    status: LiveTournamentStatus;
    logoUrl: string | null;
  };
  /** ISO timestamp of the latest score or finals change (null before any score is entered). */
  updatedAt: string | null;
  fingerprint: string;
  events: LiveEvent[];
  /** Association tournaments: every bowler's total across all events. Null when not used. */
  allEvents: LiveAllEvents | null;
};

export type LiveEvent = {
  id: string;
  name: string;
  /** 'singles' | 'doubles' | 'scotch-doubles' | 'team' | 'baker-team' */
  format: string;
  /** 'handicap' | 'scratch' | 'no-tap' (no-tap is scored as scratch) */
  scoring: string;
  /** Games in qualifying (0 when not set; the page then uses the most games bowled). */
  games: number;
  /** "Handicap 90% of 220", "Scratch", or "9-pin no-tap, scratch". */
  scoringLabel: string;
  /**
   * One per division. Events without divisions have a single entry with id and name null.
   * When the event's finals are for each squad, there is one entry per division and squad
   * (ordered by division, then squad date and time), each with `squad` set.
   */
  divisions: LiveDivision[];
};

export type LiveDivision = {
  id: string | null;
  name: string | null;
  /**
   * The squad this group's standings and finals are for. Null or absent when the event's standings
   * are tournament-wide (all squads combined). Set when the event's finals are for each squad: each
   * squad then has its own ranks, cut, cash line (its own prize fund), and finals. `id` is null for
   * entries without a squad ("No squad"). `label` is "Sat Mar 6 · 2:00 PM", or just "2:00 PM" when
   * the tournament is one day. Keys for this group must include the squad id.
   */
  squad?: { id: string | null; label: string } | null;
  /** Entries registered (confirmed or pending) in this event and division (and squad, when set). */
  entryCount: number;
  /** How many of the top places advance to finals (null: no cut). */
  advancingCount: number | null;
  /**
   * How many places are paid, from the payout ratio (null: not stated). Without finals these are the
   * top qualifying places. With finals, the finals finish decides the money: the top places in the
   * finals cash, and only places beyond the finals field cash from qualifying.
   */
  cashingCount: number | null;
  /**
   * How the money works for this group when there are finals, shown under the qualifying card header:
   * "Top 2 finishers in the finals cash." or "Places 6-8 cash from qualifying". Null without finals
   * or without a payout ratio (absent in older payloads).
   */
  cashNote?: string | null;
  rows: StandingRow[];
  finals: LiveFinals | null;
};

export type StandingBowler = {
  name: string;
  average: number | null;
  /** Per-game handicap used for this bowler (0 for scratch and no-tap). */
  handicapPerGame: number;
};

export type StandingRow = {
  /** Stable key for React lists (entry id, or "bowler:<id>" when only the best set counts). */
  key: string;
  /** Shared rank for ties (1, 2, 2, 4). Null until the entry has bowled a game. */
  rank: number | null;
  tied: boolean;
  /** "Ann Lee", "Ann Lee & Bob Ray", or a team label; re-entries add " (re-entry 2)". */
  name: string;
  bowlers: StandingBowler[];
  /** One value per qualifying game: the entry's game total (all bowlers, scratch). Null = not bowled. */
  games: Array<number | null>;
  gamesBowled: number;
  scratchTotal: number;
  /** Handicap added for the games bowled so far. */
  handicapTotal: number;
  total: number;
  /**
   * 'advancing' (inside the cut), 'cashing' (cashes from qualifying: without finals, inside the money
   * line; with finals, only the places below the cut that still pay), or null.
   */
  status: 'advancing' | 'cashing' | null;
  /** Squad label the entry bowled in, for example "Sat 2:00 PM". */
  squadLabel: string | null;
};

export type LiveFinalsType = 'stepladder' | 'match-play-single' | 'match-play-double' | 'round-robin' | 'survivor';

export type LiveFinals = {
  type: LiveFinalsType;
  /** "Stepladder, top 5", "Match play, top 8", "Round robin, Petersen points", "Survivor". */
  label: string;
  status: 'not-started' | 'in-progress' | 'complete';
  champion: { name: string; detail: string } | null;
  /** Stepladder and match play. Ordered by round, then match. */
  matches: FinalsMatch[];
  /** Survivor: one entry per round. */
  rounds: FinalsRound[];
  /** Round robin standings. */
  table: RoundRobinRow[];
  /**
   * Finishing places decided so far, ordered by place (empty until a place is decided; optional for
   * older payloads). Stepladder: each match's loser takes the next place down the ladder and the
   * title match decides 1st and 2nd. Match play: final loser 2nd, semifinal losers tie 3rd,
   * quarterfinal losers tie 5th. Survivor: reverse elimination order. Round robin: the final table,
   * once every match is bowled. `cashing` marks places inside the cash count.
   */
  placings?: FinalsPlacing[];
  notes: string;
};

export type FinalsPlacing = {
  /** The finalist's seed key, stable across refreshes. */
  key: string;
  place: number;
  /** Shares the place with another finalist (for example both semifinal losers are 3rd). */
  tied: boolean;
  name: string;
  cashing: boolean;
};

export type FinalsSide = {
  seed: number;
  name: string;
  /** Game score including handicap when the event is handicap; null until entered. */
  score: number | null;
  winner: boolean;
};

export type FinalsMatch = {
  id: string;
  round: number;
  /** "Match 1", "Semifinal", "Final", "Title match". */
  label: string;
  /** Null when this slot waits on an earlier match ("To be decided"). */
  a: FinalsSide | null;
  /** Null for a bye when `a` is set; null with `a` null means both slots are still to be decided. */
  b: FinalsSide | null;
};

export type FinalsRound = {
  round: number;
  label: string;
  /** `key` is stable across refreshes (the finalist's seed key); optional for older payloads. */
  rows: Array<{ key?: string; seed: number; name: string; score: number | null; eliminated: boolean }>;
};

export type RoundRobinRow = {
  /** Stable across refreshes (the finalist's seed key); optional for older payloads. */
  key?: string;
  rank: number;
  seed: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pins: number;
  /** Petersen points, or pins plus win bonus, depending on the event's round robin scoring. */
  points: number;
};

export type LiveAllEvents = {
  /** Event ids and names in column order. */
  events: Array<{ id: string; name: string }>;
  cashingCount: number | null;
  rows: Array<{
    key: string;
    rank: number | null;
    tied: boolean;
    name: string;
    /** Total with handicap per event, null when the bowler hasn't bowled it. */
    eventTotals: Array<number | null>;
    total: number;
    status: 'cashing' | null;
  }>;
};
