import type { CustomQuestionConfig, EventConfig, FeeConfig, RegistrationFieldConfig, RegistrationQuestionAnswerValue, SquadConfig, ValidationIssue } from './types';

export function registrationFieldFallbackHelp(field: Pick<RegistrationFieldConfig, 'key' | 'label'>): string {
  const byKey: Record<string, string> = {
    usbc_number: 'Helps verify your average and membership.',
    first_name: "Bowler's legal first name.",
    last_name: "Bowler's legal last name.",
    email: "We'll use this to send important updates.",
    phone: 'In case we need to reach you.',
    address: 'Optional mailing address.',
    city: 'City for your address.',
    state: 'State or province for your address.',
    zip: 'Postal code for your address.',
  };

  const direct = byKey[field.key.toLowerCase()];
  if (direct) {
    return direct;
  }

  return `Add helper text for ${field.label.toLowerCase()}.`;
}

export function normalizeRegistrationFieldKey(key: string): string {
  return key.trim().toLowerCase();
}

export function getRegistrationFieldInputType(field: RegistrationFieldConfig): 'text' | 'email' | 'tel' | 'number' | 'date' {
  const key = normalizeRegistrationFieldKey(field.key);
  const validation = (field.validation || '').trim().toLowerCase();

  if (validation === 'email' || key.includes('email')) {
    return 'email';
  }

  if (validation === 'phone' || key.includes('phone')) {
    return 'tel';
  }

  if (validation === 'number' || key.includes('average')) {
    return 'number';
  }

  if (validation === 'date' || key.includes('date')) {
    return 'date';
  }

  return 'text';
}

export function isWideRegistrationField(field: RegistrationFieldConfig): boolean {
  const key = normalizeRegistrationFieldKey(field.key);
  return key.includes('email')
    || key.includes('phone')
    || key.includes('usbc')
    || key.includes('address')
    || key.includes('zip')
    || key.includes('city')
    || key.includes('state');
}

export function normalizeQuestionOptions(options: string[] | undefined): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => option.trim()).filter(Boolean);
}

export function isRegistrationQuestionAnswered(
  question: CustomQuestionConfig,
  answer: RegistrationQuestionAnswerValue | undefined,
): boolean {
  const type = (question.type || 'short-text').toLowerCase();
  const options = normalizeQuestionOptions(question.options);

  if (type === 'checkbox' && options.length > 0) {
    return Array.isArray(answer) && answer.some((value) => value.trim().length > 0);
  }

  if (type === 'checkbox') {
    return answer === true;
  }

  if (Array.isArray(answer)) {
    return answer.some((value) => value.trim().length > 0);
  }

  if (typeof answer === 'boolean') {
    return true;
  }

  return typeof answer === 'string' && answer.trim().length > 0;
}

export function getRequiredBowlerCountFromSquad(squad: SquadConfig | null): number | null {
  if (!squad) {
    return null;
  }

  const rawValue = typeof squad.requiredBowlerCount === 'number'
    ? squad.requiredBowlerCount
    : null;

  if (rawValue === null || !Number.isFinite(rawValue)) {
    return null;
  }

  return Math.max(1, Math.round(rawValue));
}

export function getRequiredBowlerCountFromEvent(event: EventConfig | null): number {
  if (!event) {
    return 1;
  }

  const minPlayers = typeof event.minPlayers === 'number' ? Number(event.minPlayers) : 1;
  const maxPlayers = typeof event.maxPlayers === 'number' ? Number(event.maxPlayers) : minPlayers;

  return Math.max(1, Math.max(minPlayers, maxPlayers));
}

/** One problem with an event's rules or a side event, keyed by the field it belongs to. */
export type RuleProblem = { field: string; message: string; severity: 'error' | 'warning' };

/** Checks an event's format rules. Field keys match the event editor's fields. */
export function eventRuleProblems(event: EventConfig): RuleProblem[] {
  const rules = event.rules;
  if (!rules) return [];
  const problems: RuleProblem[] = [];
  const add = (field: string, message: string, severity: RuleProblem['severity'] = 'error') => problems.push({ field, message, severity });

  if (!Number.isInteger(rules.games) || rules.games < 0) add('games', 'Games must be 0 or more.');
  if (event.scoring === 'handicap' && rules.handicap) {
    if (!(rules.handicap.percent >= 1 && rules.handicap.percent <= 100)) add('handicapPercent', 'Handicap percent must be between 1 and 100.');
    if (!(rules.handicap.basis > 0)) add('handicapBasis', 'Handicap basis must be more than 0.');
    if (rules.handicap.maxPins !== null && rules.handicap.maxPins < 0) add('handicapMaxPins', 'Maximum handicap cannot be negative.');
  }
  if (rules.average.minGames < 0) add('averageMinGames', 'Minimum games cannot be negative.');
  if (rules.average.assignedAverage !== null && rules.average.assignedAverage < 0) add('assignedAverage', 'Assigned average cannot be negative.');
  if (rules.team.combinedAverageMax !== null && !(rules.team.combinedAverageMax > 0)) add('combinedAverageMax', 'Combined average limit must be more than 0.');
  if (rules.finals.type === 'cut' && !rules.finals.cut) add('cutValue', 'Choose how many bowlers make the cut.');
  if (rules.finals.type !== 'none' && rules.finals.cut) {
    if (!(rules.finals.cut.value > 0)) add('cutValue', 'The cut must be more than 0.');
    else if (rules.finals.cut.by === 'percent' && rules.finals.cut.value > 100) add('cutValue', 'The cut cannot be more than 100%.');
  }
  if (rules.finals.type === 'round-robin' && rules.finals.roundRobinScoring === 'bonus-pins' && !(Number(rules.finals.winBonusPins) > 0)) {
    add('winBonusPins', 'Set the bonus pins for a win.', 'warning');
  }
  if (rules.payoutRatio !== null && !(rules.payoutRatio >= 1)) add('payoutRatio', 'Entries per cash prize must be 1 or more.');
  return problems;
}

/** Checks a side event's settings. Bracket payouts that don't add up are a warning, not a block. */
export function sideEventProblems(fee: FeeConfig): RuleProblem[] {
  const sideEvent = fee.sideEvent;
  if (!sideEvent) return [];
  const problems: RuleProblem[] = [];
  if (sideEvent.allowQuantity && sideEvent.maxQuantity !== null && !(sideEvent.maxQuantity >= 1)) {
    problems.push({ field: 'maxQuantity', message: 'Maximum quantity must be 1 or more.', severity: 'error' });
  }
  const brackets = sideEvent.brackets;
  if (sideEvent.kind === 'brackets' && brackets) {
    if (!Number.isInteger(brackets.size) || brackets.size < 2) {
      problems.push({ field: 'bracketSize', message: 'A bracket needs at least 2 bowlers.', severity: 'error' });
    } else {
      const pool = brackets.size * fee.amountCents;
      const paid = brackets.firstPlaceCents + brackets.secondPlaceCents + brackets.houseCents;
      if (paid !== pool) {
        problems.push({
          field: 'bracketPayouts',
          message: `Bracket payouts and house add up to ${formatCents(paid)}, but ${brackets.size} entries bring in ${formatCents(pool)}.`,
          severity: 'warning',
        });
      }
    }
  }
  return problems;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** Setup issues for event rules (enabled events) and side events (offered add-ons). */
export function formatRuleIssues(events: EventConfig[], fees: FeeConfig[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const event of events.filter((entry) => entry.enabled)) {
    for (const problem of eventRuleProblems(event)) {
      issues.push({
        id: `event-rules-${problem.field}-${event.id}`,
        section: 'events-divisions',
        severity: problem.severity,
        message: `${event.name || 'An enabled event'}: ${problem.message}`,
      });
    }
  }
  for (const fee of fees.filter((entry) => entry.enabled)) {
    for (const problem of sideEventProblems(fee)) {
      issues.push({
        id: `fee-rules-${problem.field}-${fee.id}`,
        section: 'fees-payments-documents',
        severity: problem.severity,
        message: `${fee.name || 'An add-on'}: ${problem.message}`,
      });
    }
  }
  return issues;
}
