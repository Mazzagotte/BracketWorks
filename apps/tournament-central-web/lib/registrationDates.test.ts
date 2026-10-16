import { afterEach, describe, expect, it, vi } from 'vitest';
import { registrationDateErrors } from './registrationDates';
import { saveOrganizerSetupState, saveTournamentRecord } from '@/components/organizer/setupPersistence';
import { buildDefaultDraft, buildOrganizerSetupPayload, buildTournamentPayload } from '@/components/organizer/setupSerialization';

const dates = {
  startDateIso: '2026-11-15', endDateIso: '2026-11-17',
  registrationOpenIso: '2026-11-01', registrationCloseIso: '2026-11-17',
  registrationOpenTime: '00:00', registrationCloseTime: '23:59',
};

afterEach(() => vi.unstubAllGlobals());

describe('registration date validation', () => {
  it('accepts registration during a multi-day tournament and at the final-day boundary', () => {
    expect(registrationDateErrors(dates)).toEqual({});
    expect(registrationDateErrors({ ...dates, startDateIso: dates.endDateIso, registrationOpenIso: dates.endDateIso, registrationOpenTime: '23:59' })).toEqual({});
  });

  it('flags opening after closing, including times on the same day', () => {
    expect(registrationDateErrors({ ...dates, registrationOpenIso: '2026-11-18' })).toHaveProperty('registrationOpenIso');
    expect(registrationDateErrors({ ...dates, registrationOpenIso: dates.endDateIso, registrationOpenTime: '18:00', registrationCloseTime: '17:59' })).toHaveProperty('registrationCloseIso');
  });

  it('flags deadlines after the final day and malformed dates or times', () => {
    expect(registrationDateErrors({ ...dates, registrationCloseIso: '2026-11-18' })).toHaveProperty('registrationCloseIso');
    expect(registrationDateErrors({ ...dates, registrationCloseIso: '2026-02-30' })).toHaveProperty('registrationCloseIso');
    expect(registrationDateErrors({ ...dates, registrationCloseTime: '25:00' })).toHaveProperty('registrationCloseTime');
  });

  it.each([false, true])('blocks invalid %s publication saves before any HTTP request', async (isPublished) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const draft = buildDefaultDraft();
    draft.details = { ...draft.details, ...dates, registrationCloseIso: '2026-11-18' };
    const payload = buildOrganizerSetupPayload(draft);
    await expect(saveOrganizerSetupState({ token: 'test-token', tournamentId: 1, payload, isPublished })).rejects.toThrow('final tournament day');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(() => buildTournamentPayload(draft.details, [], false)).toThrow('final tournament day');
  });

  it('saves coordinated date corrections before updating an existing tournament record', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    vi.stubGlobal('fetch', fetchMock);
    const draft = buildDefaultDraft();
    draft.details = { ...draft.details, ...dates };
    await saveTournamentRecord({
      token: 'test-token', tournamentId: 1,
      payload: buildTournamentPayload(draft.details, [], false),
      setupPayload: buildOrganizerSetupPayload(draft),
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/tc/organizer-setup/1', '/api/v1/tc/tournaments/1',
    ]);
  });

  it('surfaces server field validation messages instead of generic save failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ detail: { errors: ['Registration must close on or before the final tournament day.'] } }),
    }));
    const draft = buildDefaultDraft();
    await expect(saveOrganizerSetupState({
      token: 'test-token', tournamentId: 1, payload: buildOrganizerSetupPayload(draft), isPublished: false,
    })).rejects.toThrow('Registration must close on or before the final tournament day.');
  });
});
