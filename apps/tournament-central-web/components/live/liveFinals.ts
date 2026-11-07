import type { BracketMatchData, BracketPlayerData, BracketRoundData, RoundRobinGame, RoundRobinPlayer } from '@bracketworks/ui';

import type { FinalsMatch, FinalsRound, FinalsSide, LiveDivision, LiveFinals, StandingRow } from './liveStandingsTypes';

/* What the live finals page derives from the LiveFinals contract: the match being bowled now, what
   comes next, and the data each finals shape draws. Pure functions, so the page only renders. */

/** A bye: the first slot is set and the second is empty. */
export function isBye(match: FinalsMatch): boolean {
  return match.a !== null && match.b === null;
}

function isDecided(match: FinalsMatch): boolean {
  return Boolean(match.a?.winner || match.b?.winner);
}

function bothKnown(match: FinalsMatch): match is FinalsMatch & { a: FinalsSide; b: FinalsSide } {
  return match.a !== null && match.b !== null;
}

function scoreMissing(match: FinalsMatch): boolean {
  return match.a?.score == null || match.b?.score == null;
}

export type FinalsFocus =
  | { kind: 'match'; match: FinalsMatch & { a: FinalsSide; b: FinalsSide }; next: FinalsMatch | null }
  | { kind: 'round'; round: FinalsRound }
  | null;

/**
 * What is being bowled now, while the finals are in progress. Stepladder and match play: the first
 * match (in order) with both finalists known and no winner yet (a score is missing, or a tie waits on
 * a roll-off). Round robin: the first game with a score missing. Survivor: the first round with a
 * score missing. Null when the finals are not started, complete, or double elimination.
 */
export function currentFinalsFocus(finals: LiveFinals): FinalsFocus {
  if (finals.status !== 'in-progress') return null;
  if (finals.type === 'survivor') {
    const rounds = [...finals.rounds].sort((a, b) => a.round - b.round);
    const round = rounds.find((item) => item.rows.some((row) => row.score === null)) ?? rounds[rounds.length - 1];
    return round ? { kind: 'round', round } : null;
  }
  if (finals.type === 'match-play-double') return null;
  const open = finals.type === 'round-robin'
    ? (match: FinalsMatch) => bothKnown(match) && scoreMissing(match)
    : (match: FinalsMatch) => bothKnown(match) && !isDecided(match);
  const index = finals.matches.findIndex(open);
  if (index < 0) return null;
  const match = finals.matches[index] as FinalsMatch & { a: FinalsSide; b: FinalsSide };
  const waiting = finals.type === 'round-robin'
    ? (item: FinalsMatch) => scoreMissing(item)
    : (item: FinalsMatch) => !isDecided(item) && !isBye(item);
  const next = finals.matches.slice(index + 1).find(waiting) ?? null;
  return { kind: 'match', match, next };
}

/** The earlier matches whose winners fill this match's slots. */
function feeders(finals: LiveFinals, match: FinalsMatch): FinalsMatch[] {
  if (finals.type === 'stepladder') {
    const index = finals.matches.findIndex((item) => item.id === match.id);
    const previous = index > 0 ? finals.matches[index - 1] : undefined;
    return previous ? [previous] : [];
  }
  if (finals.type === 'match-play-single') {
    const inRound = finals.matches.filter((item) => item.round === match.round);
    const position = inRound.findIndex((item) => item.id === match.id);
    const before = finals.matches.filter((item) => item.round === match.round - 1);
    return before.slice(position * 2, position * 2 + 2);
  }
  return [];
}

export function sideText(side: FinalsSide): string {
  return `${side.name} (seed ${side.seed})`;
}

/** "Up next: Title match, winner of Match 3 vs Alex Brooks (seed 1)". */
export function upNextText(finals: LiveFinals, next: FinalsMatch): string {
  const pending = feeders(finals, next).filter((item) => !isDecided(item));
  const describe = (side: FinalsSide | null) => {
    if (side) return sideText(side);
    const feeder = pending.shift();
    return feeder ? `winner of ${feeder.label}` : 'to be decided';
  };
  const a = describe(next.a);
  const b = describe(next.b);
  return `Up next: ${next.label}, ${a} vs ${b}`;
}

export function sidePlayer(side: FinalsSide | null, bye: boolean): BracketPlayerData {
  if (!side) return { name: bye ? 'Bye' : null };
  return { name: side.name, score: side.score, winner: side.winner, seed: side.seed };
}

function roundTitle(type: LiveFinals['type'], round: FinalsMatch[], roundNumber: number): string {
  if (type === 'stepladder' && round.length === 1) return round[0].label;
  if (round.length === 1) return 'Final';
  if (round.length === 2) return 'Semifinals';
  if (round.length === 4) return 'Quarterfinals';
  return `Round ${roundNumber}`;
}

function matchData(match: FinalsMatch, currentId: string | null): BracketMatchData {
  return {
    id: match.id,
    label: match.label,
    players: [sidePlayer(match.a, false), sidePlayer(match.b, match.a !== null)],
    current: currentId !== null && match.id === currentId,
  };
}

/** Bracket rounds for BracketTree and BracketTwoSided, with the current match marked. */
export function finalsRounds(finals: LiveFinals, currentId: string | null = null): BracketRoundData[] {
  const byRound = new Map<number, FinalsMatch[]>();
  for (const match of finals.matches) byRound.set(match.round, [...(byRound.get(match.round) ?? []), match]);
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([roundNumber, matches]) => ({
      title: roundTitle(finals.type, matches, roundNumber),
      matches: matches.map((match) => matchData(match, currentId)),
    }));
}

/** Stepladder rungs, bottom-up: the climber first in each match, then the seed waiting. */
export function ladderMatches(finals: LiveFinals): BracketMatchData[] {
  return [...finals.matches]
    .sort((a, b) => a.round - b.round)
    .map((match) => ({
      id: match.id,
      label: match.label,
      players: [sidePlayer(match.a, false), sidePlayer(match.b, false)],
    }));
}

function seedKey(row: { key?: string; seed: number }): string {
  return row.key ?? `seed:${row.seed}`;
}

/** Round robin grid rows and columns (seed order) and its games. */
export function roundRobinGrid(finals: LiveFinals): { players: RoundRobinPlayer[]; games: RoundRobinGame[] } {
  const players = [...finals.table].sort((a, b) => a.seed - b.seed).map((row) => ({ key: seedKey(row), seed: row.seed, name: row.name }));
  const keyBySeed = new Map(players.map((player) => [player.seed, player.key]));
  const games = finals.matches.filter(bothKnown).map((match) => ({
    id: match.id,
    a: { key: keyBySeed.get(match.a.seed) ?? `seed:${match.a.seed}`, score: match.a.score },
    b: { key: keyBySeed.get(match.b.seed) ?? `seed:${match.b.seed}`, score: match.b.score },
  }));
  return { players, games };
}

export type SurvivorRow = FinalsRound['rows'][number] & { key: string };

/**
 * A survivor round's rows: those still in (highest score first once scored, else by seed), then the
 * rows eliminated this round. `cutAfter` is how many rows sit above the cut (null before the cut).
 */
export function survivorRound(round: FinalsRound): { rows: SurvivorRow[]; cutAfter: number | null } {
  const keyed = round.rows.map((row) => ({ ...row, key: seedKey(row) }));
  const order = (a: SurvivorRow, b: SurvivorRow) => (b.score ?? -1) - (a.score ?? -1) || a.seed - b.seed;
  const alive = keyed.filter((row) => !row.eliminated).sort(order);
  const out = keyed.filter((row) => row.eliminated).sort(order);
  return { rows: [...alive, ...out], cutAfter: out.length > 0 ? alive.length : null };
}

/** Qualifiers inside the cut, in seed (rank) order, for finals that have not started. */
export function advancingQualifiers(division: LiveDivision): StandingRow[] {
  return division.rows
    .filter((row) => row.status === 'advancing')
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
}

export type FinalsStats = {
  finalists: number;
  progressLabel: string;
  progress: string;
  high: { score: number; name: string } | null;
};

/** Key numbers for one finals group: finalists, how far along it is, and the high game. */
export function finalsStats(finals: LiveFinals, division: LiveDivision): FinalsStats {
  const seeds = new Map<number, string>();
  let high: FinalsStats['high'] = null;
  const see = (seed: number, name: string, score: number | null) => {
    seeds.set(seed, name);
    if (score !== null && (!high || score > high.score)) high = { score, name };
  };
  for (const match of finals.matches) {
    if (match.a) see(match.a.seed, match.a.name, isBye(match) ? null : match.a.score);
    if (match.b) see(match.b.seed, match.b.name, match.b.score);
  }
  for (const round of finals.rounds) for (const row of round.rows) see(row.seed, row.name, row.score);
  for (const row of finals.table) seeds.set(row.seed, row.name);
  const finalists = seeds.size || division.advancingCount || advancingQualifiers(division).length;

  if (finals.type === 'survivor') {
    const bowled = finals.rounds.filter((round) => round.rows.length > 0 && round.rows.every((row) => row.score !== null)).length;
    return { finalists, progressLabel: 'Rounds bowled', progress: String(bowled), high };
  }
  const games = finals.matches.filter((match) => !isBye(match));
  const done = finals.type === 'round-robin'
    ? games.filter((match) => bothKnown(match) && !scoreMissing(match)).length
    : games.filter(isDecided).length;
  return { finalists, progressLabel: 'Matches bowled', progress: games.length ? `${done} of ${games.length}` : '0', high };
}
