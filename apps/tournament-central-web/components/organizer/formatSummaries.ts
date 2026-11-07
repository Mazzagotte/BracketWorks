/**
 * Plain-language summaries of event rules, divisions, and side events. Used by setup (editor
 * helpers, review step, downloaded summary) and by the public tournament information.
 */
import {
  EVENT_FORMAT_LABEL,
  FINALS_LABEL,
  SIDE_EVENT_LABEL,
  handicapPins,
} from './formatTypes';
import type { BracketRules, DivisionRules, EventRules, FinalsRule, HandicapRule, SideEventSettings } from './formatTypes';

export function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** "90% of 220", plus a cap or pair note when set. */
export function handicapFormula(rule: HandicapRule): string {
  const parts = [`${rule.percent}% of ${rule.basis}`];
  if (rule.perPair) parts.push('from the pair average');
  if (rule.maxPins !== null) parts.push(`up to ${rule.maxPins} pins`);
  return parts.join(', ');
}

/** A worked example for the editor, for example "A 180 average gets 36 pins per game." */
export function handicapExample(rule: HandicapRule): string {
  if (rule.perPair) {
    const pairAverage = 360;
    return `A pair averaging ${pairAverage} combined gets ${handicapPins(rule, pairAverage)} pins per game.`;
  }
  return `A 180 average gets ${handicapPins(rule, 180)} pins per game.`;
}

function cutText(finals: FinalsRule): string | null {
  if (!finals.cut || finals.cut.value <= 0) return null;
  return finals.cut.by === 'percent' ? `top ${finals.cut.value}%` : `top ${finals.cut.value}`;
}

/** "Stepladder, top 5" or "Round robin, Petersen points". null when there are no finals. */
export function finalsSummary(finals: FinalsRule): string | null {
  if (finals.type === 'none') return null;
  const parts = [FINALS_LABEL[finals.type]];
  const cut = cutText(finals);
  if (cut) parts.push(cut);
  if (finals.type === 'round-robin') {
    if (finals.roundRobinScoring === 'petersen') parts.push('Petersen points');
    if (finals.roundRobinScoring === 'bonus-pins') {
      parts.push(finals.winBonusPins ? `${finals.winBonusPins} bonus pins per win` : 'bonus pins');
    }
  }
  return parts.join(', ');
}

export function payoutRatioText(ratio: number | null): string | null {
  return ratio && ratio > 0 ? `About 1 in ${ratio} entries cash` : null;
}

/** Short phrases describing an event, in reading order. */
export function eventRulesParts(rules: EventRules, scoring: 'handicap' | 'scratch' | 'no-tap'): string[] {
  const parts: string[] = [EVENT_FORMAT_LABEL[rules.format]];
  if (rules.games > 0) parts.push(`${rules.games} game${rules.games === 1 ? '' : 's'}`);
  if (scoring === 'handicap' && rules.handicap) parts.push(`Handicap ${handicapFormula(rules.handicap)}`);
  else if (scoring === 'scratch') parts.push('Scratch');
  else if (scoring === 'no-tap') parts.push('9-pin no-tap');
  if (rules.team.mixedRequired) parts.push('Mixed');
  if (rules.team.combinedAverageMax) parts.push(`Combined average ${rules.team.combinedAverageMax} or less`);
  const finals = finalsSummary(rules.finals);
  if (finals) parts.push(finals);
  return parts;
}

/** One line for the review step and the downloaded summary. */
export function eventRulesSummary(rules: EventRules, scoring: 'handicap' | 'scratch' | 'no-tap'): string {
  return eventRulesParts(rules, scoring).join(' · ');
}

/** "8 entries at $5 = $40: pays $30 and $10" plus the house share when there is one. */
export function bracketPayoutSummary(amountCents: number, brackets: BracketRules): string {
  const pool = brackets.size * amountCents;
  const house = brackets.houseCents > 0 ? `, ${formatDollars(brackets.houseCents)} to the house` : '';
  return `${brackets.size} entries at ${formatDollars(amountCents)} = ${formatDollars(pool)}: pays ${formatDollars(brackets.firstPlaceCents)} and ${formatDollars(brackets.secondPlaceCents)}${house}`;
}

/** Payouts plus house minus the pool. 0 when the bracket balances. */
export function bracketPayoutGap(amountCents: number, brackets: BracketRules): number {
  return brackets.firstPlaceCents + brackets.secondPlaceCents + brackets.houseCents - brackets.size * amountCents;
}

/** "Brackets · Per bowler · Up to 10" for list rows. */
export function sideEventSummary(sideEvent: SideEventSettings): string {
  const parts = [SIDE_EVENT_LABEL[sideEvent.kind], sideEvent.per === 'bowler' ? 'Per bowler' : 'Per registration'];
  if (sideEvent.allowQuantity) parts.push(sideEvent.maxQuantity ? `Up to ${sideEvent.maxQuantity} each` : 'Bowlers choose how many');
  return parts.join(' · ');
}

type DivisionLimits = {
  minAverage?: number | null;
  maxAverage?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  rules?: DivisionRules;
};

function rangeText(noun: string, min: number | null | undefined, max: number | null | undefined): string | null {
  const hasMin = typeof min === 'number';
  const hasMax = typeof max === 'number';
  if (hasMin && hasMax) return `${noun} ${min}-${max}`;
  if (hasMin) return `${noun} ${min} and up`;
  if (hasMax) return `${noun} ${max} and under`;
  return null;
}

/** "Women only · Age 50 and up · Average 180 and under · Scholarship prizes". */
export function divisionLimitParts(division: DivisionLimits): string[] {
  const parts: string[] = [];
  if (division.rules?.gender === 'men') parts.push('Men only');
  if (division.rules?.gender === 'women') parts.push('Women only');
  const age = rangeText('Age', division.minAge, division.maxAge);
  if (age) parts.push(age);
  const average = rangeText('Average', division.minAverage, division.maxAverage);
  if (average) parts.push(average);
  if (division.rules?.prizeType === 'scholarship') parts.push('Scholarship prizes');
  return parts;
}
