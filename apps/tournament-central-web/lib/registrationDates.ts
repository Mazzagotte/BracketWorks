import { parseTournamentDate } from './tournamentDates';

type RegistrationDates = {
  startDateIso?: string;
  endDateIso?: string;
  registrationOpenIso?: string;
  registrationCloseIso?: string;
  registrationOpenTime?: string;
  registrationCloseTime?: string;
};

export function registrationDateErrors(details: RegistrationDates): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ['startDateIso', 'endDateIso', 'registrationOpenIso', 'registrationCloseIso'] as const) {
    const value = details[field];
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !parseTournamentDate(value))) {
      errors[field] = 'Enter a valid calendar date.';
    }
  }
  for (const field of ['registrationOpenTime', 'registrationCloseTime'] as const) {
    if (details[field] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(details[field])) errors[field] = 'Enter a valid time.';
  }
  if (details.startDateIso && details.endDateIso && details.startDateIso > details.endDateIso) {
    errors.endDateIso = 'Tournament end date must be on or after the start date.';
  }
  const opens = `${details.registrationOpenIso}T${details.registrationOpenTime || '00:00'}`;
  const closes = `${details.registrationCloseIso}T${details.registrationCloseTime || '23:59'}`;
  if (details.registrationOpenIso && details.registrationCloseIso && opens > closes) {
    errors.registrationOpenIso = 'Registration must open on or before it closes.';
    errors.registrationCloseIso = 'Registration must close on or after it opens.';
  }
  if (details.endDateIso && details.registrationCloseIso && details.registrationCloseIso > details.endDateIso) {
    errors.registrationCloseIso = 'Registration must close on or before the final tournament day.';
  }
  return errors;
}

export function assertValidRegistrationDates(details: RegistrationDates): void {
  const errors = registrationDateErrors(details);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
}
