/**
 * Who may enter an event and division, checked on the registration form before submit.
 *
 * This mirrors apps/api/app/services/tc_eligibility.py, which enforces the same rules on the server
 * with the same messages. Only rules the organizer set are checked: a missing rule means no check.
 *
 * - Division: minAverage/maxAverage, minAge/maxAge (age on the first tournament day), and
 *   rules.gender ('men' or 'women'; 'any' means no check).
 * - Event rules: usbcRequired, team.combinedAverageMax, team.mixedRequired, and average.noAverage
 *   ('not-eligible' requires an average; 'assigned-average' with assignedAverage fills a blank one).
 */

export type EligibilityEvent = { rules?: unknown } | null | undefined;

export type EligibilityDivision = {
  name?: string;
  minAverage?: number | string | null;
  maxAverage?: number | string | null;
  minAge?: number | string | null;
  maxAge?: number | string | null;
  rules?: unknown;
} | null | undefined;

/** Registration field keys to submitted values: first_name, average, date_of_birth, gender, usbc_number. */
export type EligibilityBowler = Record<string, string | undefined>;

export type GenderCode = 'M' | 'F';

const GENDER_ALIASES: Record<string, GenderCode> = {
  m: 'M', male: 'M', man: 'M', men: 'M',
  f: 'F', female: 'F', woman: 'F', women: 'F',
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  return String(value);
}

export function normalizeGender(value: unknown): GenderCode | null {
  return GENDER_ALIASES[String(value ?? '').trim().toLowerCase()] ?? null;
}

/** USBC IDs look like 1234-56789. Accepts digits with one optional dash, 6 to 14 digits in all. */
export function isValidUsbcNumber(value: unknown): boolean {
  const text = String(value ?? '').replace(/\s+/gu, '');
  if (!/^\d+(?:-\d+)?$/u.test(text)) return false;
  const digits = text.replace('-', '').length;
  return digits >= 6 && digits <= 14;
}

type SimpleDate = { year: number; month: number; day: number };

function validDate(year: number, month: number, day: number): SimpleDate | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

/** Accepts 2026-10-01, 10/01/2026, and 10-01-2026. */
export function parseBirthDate(value: unknown): SimpleDate | null {
  const text = String(value ?? '').trim().slice(0, 10);
  let match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(text);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/u.exec(text);
  if (match) return validDate(Number(match[3]), Number(match[1]), Number(match[2]));
  return null;
}

export function parseReferenceDate(value: unknown): SimpleDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(String(value ?? '').trim());
  return match ? validDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

export function ageOn(birthDate: SimpleDate, onDate: SimpleDate): number {
  let years = onDate.year - birthDate.year;
  if (onDate.month < birthDate.month || (onDate.month === birthDate.month && onDate.day < birthDate.day)) years -= 1;
  return years;
}

function bowlerLabel(index: number, bowler: EligibilityBowler, total: number): string {
  const name = `${bowler.first_name ?? ''} ${bowler.last_name ?? ''}`.split(/\s+/u).filter(Boolean).join(' ');
  if (total <= 1) return name || 'Bowler';
  return name ? `Bowler ${index + 1} (${name})` : `Bowler ${index + 1}`;
}

/** The bowler's average, or the event's assigned average when they left it blank. */
export function effectiveAverage(bowler: EligibilityBowler, eventRules: unknown): number | null {
  const average = toNumber(bowler.average);
  if (average !== null) return average;
  const rule = asRecord(asRecord(eventRules).average);
  return rule.noAverage !== 'not-eligible' ? toNumber(rule.assignedAverage) : null;
}

/** Bowler field keys the configured rules need, so the form can ask for them. */
export function requiredBowlerFields(event: EligibilityEvent, division: EligibilityDivision): Set<string> {
  const rules = asRecord(event?.rules);
  const divisionRow = asRecord(division);
  const keys = new Set<string>();
  if (rules.usbcRequired === true) keys.add('usbc_number');
  if (asRecord(rules.average).noAverage === 'not-eligible') keys.add('average');
  const team = asRecord(rules.team);
  if (toNumber(team.combinedAverageMax) !== null) keys.add('average');
  if (team.mixedRequired === true) keys.add('gender');
  if (toNumber(divisionRow.minAverage) !== null || toNumber(divisionRow.maxAverage) !== null) keys.add('average');
  if (toNumber(divisionRow.minAge) !== null || toNumber(divisionRow.maxAge) !== null) keys.add('date_of_birth');
  const gender = asRecord(divisionRow.rules).gender;
  if (gender === 'men' || gender === 'women') keys.add('gender');
  return keys;
}

/** Plain-language problems that keep these bowlers out of this event and division. Empty when eligible. */
export function checkRegistrationEligibility({
  event,
  division,
  bowlers,
  referenceDate,
}: {
  event: EligibilityEvent;
  division: EligibilityDivision;
  bowlers: EligibilityBowler[];
  referenceDate: SimpleDate | null;
}): string[] {
  const rules = asRecord(event?.rules);
  const divisionRow = asRecord(division);
  const divisionName = String(divisionRow.name ?? '').trim() || 'this division';
  const divisionGenderRaw = asRecord(divisionRow.rules).gender;
  const divisionGender = divisionGenderRaw === 'men' || divisionGenderRaw === 'women' ? divisionGenderRaw : null;
  const team = asRecord(rules.team);
  const minAverage = toNumber(divisionRow.minAverage);
  const maxAverage = toNumber(divisionRow.maxAverage);
  const minAge = toNumber(divisionRow.minAge);
  const maxAge = toNumber(divisionRow.maxAge);
  const combinedMax = toNumber(team.combinedAverageMax);
  const averageRequired = asRecord(rules.average).noAverage === 'not-eligible';
  const usbcRequired = rules.usbcRequired === true;
  const mixedRequired = team.mixedRequired === true;

  const problems: string[] = [];
  const total = bowlers.length;
  const genders: Array<GenderCode | null> = [];
  let combined = 0;
  let combinedKnown = true;

  bowlers.forEach((bowler, index) => {
    const label = bowlerLabel(index, bowler, total);
    const average = effectiveAverage(bowler, rules);
    const gender = normalizeGender(bowler.gender);
    genders.push(gender);

    if (usbcRequired) {
      const usbc = String(bowler.usbc_number ?? '').trim();
      if (!usbc) problems.push(`${label}: a USBC number is required for this event.`);
      else if (!isValidUsbcNumber(usbc)) problems.push(`${label}: enter the USBC number like 1234-56789.`);
    }

    if (average === null && averageRequired) {
      problems.push(`${label}: an average is required for this event.`);
    } else if (average === null && (minAverage !== null || maxAverage !== null)) {
      problems.push(`${label}: an average is required for ${divisionName}.`);
    }
    if (average !== null) {
      if (minAverage !== null && average < minAverage) {
        problems.push(`${label}: average ${formatNumber(average)} is below the ${divisionName} minimum of ${formatNumber(minAverage)}.`);
      }
      if (maxAverage !== null && average > maxAverage) {
        problems.push(`${label}: average ${formatNumber(average)} is above the ${divisionName} maximum of ${formatNumber(maxAverage)}.`);
      }
      combined += average;
    } else {
      combinedKnown = false;
    }

    if (minAge !== null || maxAge !== null) {
      const birthDate = parseBirthDate(bowler.date_of_birth);
      if (!birthDate) {
        problems.push(`${label}: a date of birth is required for ${divisionName}.`);
      } else if (referenceDate) {
        const age = ageOn(birthDate, referenceDate);
        if (minAge !== null && age < minAge) {
          problems.push(`${label}: must be at least ${formatNumber(minAge)} on the first day of the tournament for ${divisionName}.`);
        }
        if (maxAge !== null && age > maxAge) {
          problems.push(`${label}: must be ${formatNumber(maxAge)} or younger on the first day of the tournament for ${divisionName}.`);
        }
      }
    }

    if (divisionGender) {
      const wanted: GenderCode = divisionGender === 'men' ? 'M' : 'F';
      if (!gender) problems.push(`${label}: gender is required for ${divisionName}.`);
      else if (gender !== wanted) problems.push(`${label}: ${divisionName} is for ${divisionGender} only.`);
    } else if (mixedRequired && !gender) {
      problems.push(`${label}: gender is required for this mixed event.`);
    }
  });

  if (combinedMax !== null && combinedKnown && total > 0 && combined > combinedMax) {
    problems.push(`Combined average ${formatNumber(combined)} is above this event's limit of ${formatNumber(combinedMax)}.`);
  }

  if (mixedRequired && total > 1 && genders.every(Boolean) && !(genders.includes('M') && genders.includes('F'))) {
    problems.push('This event is mixed: include at least one man and one woman.');
  }

  return problems;
}
