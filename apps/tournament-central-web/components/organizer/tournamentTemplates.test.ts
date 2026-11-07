import { describe, expect, it } from 'vitest';
import { initialRegistrationFields } from './setupConfig';
import { defaultTournamentDetails } from './setupDefaults';
import { eventRuleProblems, sideEventProblems } from './setupValidation';
import { TOURNAMENT_TEMPLATES, applyTournamentTemplate, findTournamentTemplate } from './tournamentTemplates';

const target = () => ({
  details: { ...defaultTournamentDetails },
  events: [],
  divisions: [],
  fees: [],
  questions: [],
  fields: initialRegistrationFields,
});

describe('tournament templates', () => {
  it('covers every requested tournament type with a name and one-line description', () => {
    expect(TOURNAMENT_TEMPLATES.map((template) => template.id)).toEqual([
      'handicap-singles', 'scratch-singles', 'handicap-doubles', 'scratch-doubles', 'mixed-doubles', 'scotch-doubles',
      'team-4', 'team-5', 'baker-team', 'no-tap', 'sweeper', 'association', 'senior', 'youth', 'pro-am', 'fundraiser',
    ]);
    for (const template of TOURNAMENT_TEMPLATES) {
      expect(template.name).not.toBe('');
      expect(template.description).not.toContain('\n');
    }
  });

  it.each(TOURNAMENT_TEMPLATES.map((template) => [template.id, template] as const))('%s builds valid events with rules', (_id, template) => {
    const built = template.build();
    expect(built.events.length).toBeGreaterThan(0);
    for (const event of built.events) {
      expect(event.rules).toBeDefined();
      expect(event.name).not.toBe('');
      expect(event.rules!.games).toBeGreaterThan(0);
      expect(event.minPlayers).toBe(event.maxPlayers);
      expect(event.rules!.handicap === null).toBe(event.scoring !== 'handicap');
      expect(eventRuleProblems(event)).toEqual([]);
    }
    for (const fee of built.fees) {
      expect(fee.sideEvent).toBeDefined();
      expect(sideEventProblems(fee)).toEqual([]);
    }
    for (const division of built.divisions) {
      expect(division.rules).toBeDefined();
      expect(division.eventIds).toEqual(built.events.map((event) => event.id));
    }
    const ids = [...built.events, ...built.divisions, ...built.fees, ...(built.questions ?? [])].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each build fresh ids', () => {
    const template = findTournamentTemplate('association')!;
    const first = template.build();
    const second = template.build();
    expect(first.events.map((event) => event.id)).not.toEqual(second.events.map((event) => event.id));
  });

  it('uses the usual defaults from the reference list', () => {
    const singles = findTournamentTemplate('handicap-singles')!.build();
    expect(singles.events[0].rules!.handicap).toMatchObject({ percent: 90, basis: 220 });
    expect(singles.fees.find((fee) => fee.sideEvent?.kind === 'brackets')).toMatchObject({
      amountCents: 500,
      sideEvent: { brackets: { firstPlaceCents: 3000, secondPlaceCents: 1000, size: 8 } },
    });

    const sweeper = findTournamentTemplate('sweeper')!.build().events[0];
    expect(sweeper.rules).toMatchObject({ reentryScoring: 'best-counts', handicap: { percent: 80, basis: 220 }, finals: { type: 'stepladder', cut: { by: 'count', value: 5 }, scope: 'squad' } });
    expect(sweeper.allowReentry).toBe(true);

    expect(findTournamentTemplate('scotch-doubles')!.build().events[0].rules).toMatchObject({ format: 'scotch-doubles', handicap: { perPair: true }, team: { mixedRequired: true } });
    expect(findTournamentTemplate('team-5')!.build().events[0].maxPlayers).toBe(5);
    expect(findTournamentTemplate('baker-team')!.build().events[0].rules!.format).toBe('baker-team');
    expect(findTournamentTemplate('youth')!.build().divisions[0].rules!.prizeType).toBe('scholarship');
    expect(findTournamentTemplate('senior')!.build().divisions.map((division) => division.minAge)).toEqual([50, 65]);
    expect(findTournamentTemplate('fundraiser')!.build().fees.map((fee) => fee.sideEvent!.kind)).toEqual(['mystery-doubles', 'high-game-pot', 'strike-pot', 'donation']);
  });

  it('association has team, doubles, and singles with USBC required, handicap and scratch divisions', () => {
    const template = findTournamentTemplate('association')!;
    expect(template.description).toContain('All Events');
    const built = template.build();
    expect(built.events.map((event) => event.rules!.format)).toEqual(['team', 'doubles', 'singles']);
    expect(built.events.every((event) => event.rules!.usbcRequired && event.requireDivision)).toBe(true);
    expect(built.divisions.map((division) => division.mode)).toEqual(['handicap', 'scratch']);
    expect(built.fieldOverrides).toEqual({ usbc_number: 'required' });
  });
});

describe('applyTournamentTemplate', () => {
  it('fills events, divisions, fees, questions, and field modes and records the template', () => {
    const next = applyTournamentTemplate(target(), 'youth');
    expect(next.details.formatTemplateId).toBe('youth');
    expect(next.details.tournamentType).toBe('Youth');
    expect(next.events).toHaveLength(1);
    expect(next.divisions).toHaveLength(1);
    expect(next.fields.find((field) => field.key === 'date_of_birth')!.mode).toBe('required');
    expect(next.fields.find((field) => field.key === 'phone')!.mode).toBe('optional');

    const mixed = applyTournamentTemplate(target(), 'mixed-doubles');
    expect(mixed.questions).toEqual([]);
    expect(mixed.fields.find((field) => field.key === 'gender')!.mode).toBe('required');
  });

  it('keeps a tournament type the organizer already picked', () => {
    const current = { ...target(), details: { ...defaultTournamentDetails, tournamentType: 'Women' } };
    expect(applyTournamentTemplate(current, 'senior').details.tournamentType).toBe('Women');
  });

  it('starts blank with an empty setup', () => {
    const withEvents = applyTournamentTemplate(target(), 'handicap-singles');
    const blank = applyTournamentTemplate(withEvents, null);
    expect(blank.details.formatTemplateId).toBe('');
    expect(blank.events).toEqual([]);
    expect(blank.fees).toEqual([]);
  });
});
