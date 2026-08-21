import type { CustomQuestionConfig, EventConfig, RegistrationFieldConfig, RegistrationQuestionAnswerValue, SquadConfig } from './types';

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
