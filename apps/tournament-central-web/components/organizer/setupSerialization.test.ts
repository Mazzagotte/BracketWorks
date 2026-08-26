import { describe, expect, it } from 'vitest';
import { buildDefaultDraft, normalizeEventConfig, normalizeOrganizerDraft } from './setupSerialization';

describe('organizer draft structure', () => {
  it('starts new tournaments without sample configuration', () => {
    const draft = buildDefaultDraft();

    expect(draft.details.name).toBe('');
    expect(draft.events).toEqual([]);
    expect(draft.divisions).toEqual([]);
    expect(draft.squads).toEqual([]);
    expect(draft.fees).toEqual([]);
    expect(draft.questions).toEqual([]);
  });

  it('preserves old event requirements during normalization', () => {
    const event = normalizeEventConfig({
      id: 'event-1', name: 'Singles', description: '', minPlayers: 1, maxPlayers: 1,
      scoring: 'scratch', requireSquad: true, requireDivision: true, allowReentry: false,
      maxReentries: 0, enabled: false, displayOrder: 1, connectedDivisionIds: [],
      connectedSquadIds: [], entryFeeCents: 0,
    });

    expect(event.requireDivision).toBe(true);
    expect(event.requireSquad).toBe(true);
    expect(event.enabled).toBe(false);
  });

  it('does not inject sample records into older sparse payloads', () => {
    const draft = normalizeOrganizerDraft({ tournamentId: 42, payload: { version: 1 } });

    expect(draft.tournamentId).toBe(42);
    expect(draft.events).toEqual([]);
    expect(draft.divisions).toEqual([]);
    expect(draft.squads).toEqual([]);
  });
});
