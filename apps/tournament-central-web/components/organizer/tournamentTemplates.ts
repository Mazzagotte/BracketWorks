/**
 * Starting points for a new tournament. Picking one fills in events, divisions, and side events
 * with typical defaults. Nothing is locked: organizers edit everything afterwards.
 */
import { FORMAT_PLAYERS, defaultDivisionRules, defaultEventRules, defaultSideEvent } from './formatTypes';
import type { DivisionRules, EventFormat, EventRules, FinalsRule, SideEventKind } from './formatTypes';
import { buildClientId, emptyDivision, emptyEvent, emptyFee, emptyQuestion } from './setupFactories';
import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, RegistrationFieldConfig, RegistrationFieldMode } from './types';
import type { TournamentDetails } from './setupTypes';

export type TemplateBuild = {
  events: EventConfig[];
  divisions: DivisionConfig[];
  fees: FeeConfig[];
  questions?: CustomQuestionConfig[];
  /** Registration fields to ask differently, by field key (for example usbc_number: 'required'). */
  fieldOverrides?: Record<string, RegistrationFieldMode>;
};

export type TournamentTemplateOption = {
  id: string;
  name: string;
  description: string;
  /** Suggested value for the details "Tournament type" select, used only when it's empty. */
  tournamentType?: string;
  build: () => TemplateBuild;
};

type Scoring = EventConfig['scoring'];

type EventSpec = {
  name: string;
  description: string;
  format: EventFormat;
  scoring: Scoring;
  games: number;
  entryFeeCents: number;
  players?: number;
  handicap?: { percent: number; basis: number; perPair?: boolean };
  reentries?: number;
  reentryScoring?: EventRules['reentryScoring'];
  finals?: Partial<FinalsRule>;
  payoutRatio?: number;
  usbcRequired?: boolean;
  mixedRequired?: boolean;
  combinedAverageMax?: number;
};

function makeEvent(order: number, spec: EventSpec): EventConfig {
  const players = spec.players ?? FORMAT_PLAYERS[spec.format];
  const base = defaultEventRules(spec.format, spec.scoring);
  const rules: EventRules = {
    ...base,
    games: spec.games,
    handicap: spec.scoring === 'handicap'
      ? { percent: spec.handicap?.percent ?? 90, basis: spec.handicap?.basis ?? 220, maxPins: null, perPair: spec.handicap?.perPair ?? spec.format === 'scotch-doubles' }
      : null,
    team: { mixedRequired: Boolean(spec.mixedRequired), combinedAverageMax: spec.combinedAverageMax ?? null },
    reentryScoring: spec.reentryScoring ?? 'all-count',
    finals: { ...base.finals, ...spec.finals },
    payoutRatio: spec.payoutRatio ?? null,
    usbcRequired: Boolean(spec.usbcRequired),
  };
  return {
    ...emptyEvent(order),
    id: buildClientId('ev'),
    name: spec.name,
    description: spec.description,
    minPlayers: players,
    maxPlayers: players,
    scoring: spec.scoring,
    allowReentry: Boolean(spec.reentries),
    maxReentries: spec.reentries ?? 0,
    entryFeeCents: spec.entryFeeCents,
    rules,
  };
}

type DivisionSpec = Partial<Pick<DivisionConfig, 'minAge' | 'maxAge' | 'minAverage' | 'maxAverage' | 'eligibilityNotes'>> & {
  name: string;
  description: string;
  mode: DivisionConfig['mode'];
  rules?: Partial<DivisionRules>;
};

function makeDivision(spec: DivisionSpec): DivisionConfig {
  const { rules, ...rest } = spec;
  return {
    ...emptyDivision(),
    ...rest,
    id: buildClientId('div'),
    rules: { ...defaultDivisionRules(), ...rules },
  };
}

function makeFee(order: number, kind: SideEventKind, name: string, amountCents: number, overrides: { maxQuantity?: number; bracketScoring?: 'handicap' | 'scratch'; per?: 'bowler' | 'registration' } = {}): FeeConfig {
  const sideEvent = defaultSideEvent(kind);
  return {
    ...emptyFee(order),
    id: buildClientId('fee'),
    name,
    amountCents,
    sideEvent: {
      ...sideEvent,
      maxQuantity: overrides.maxQuantity ?? sideEvent.maxQuantity,
      per: overrides.per ?? sideEvent.per,
      brackets: sideEvent.brackets && overrides.bracketScoring ? { ...sideEvent.brackets, scoring: overrides.bracketScoring } : sideEvent.brackets,
    },
  };
}

/** $5 handicap brackets paying $30 and $10, plus a $5 high game pot. Offered on most templates. */
function standardSideEvents(): FeeConfig[] {
  return [
    makeFee(1, 'brackets', 'Brackets', 500, { maxQuantity: 10 }),
    makeFee(2, 'high-game-pot', 'High game pot', 500),
  ];
}

/** Connects every event to every division, and requires a division when there are any. */
function connect(events: EventConfig[], divisions: DivisionConfig[]): TemplateBuild {
  const divisionIds = divisions.map((division) => division.id);
  const eventIds = events.map((event) => event.id);
  return {
    events: events.map((event) => ({ ...event, connectedDivisionIds: divisionIds, requireDivision: divisionIds.length > 0 })),
    divisions: divisions.map((division) => ({ ...division, eventIds })),
    fees: [],
  };
}

export const TOURNAMENT_TEMPLATES: TournamentTemplateOption[] = [
  {
    id: 'handicap-singles',
    name: 'Handicap singles',
    description: '3 games, 90% of 220 handicap, re-entries allowed, brackets and a high game pot.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Handicap singles', description: 'Three games with handicap. The best set counts when you re-enter.',
        format: 'singles', scoring: 'handicap', games: 3, entryFeeCents: 4000, reentries: 2, reentryScoring: 'best-counts', payoutRatio: 5,
      })],
      divisions: [],
      fees: standardSideEvents(),
    }),
  },
  {
    id: 'scratch-singles',
    name: 'Scratch singles',
    description: '6 qualifying games, top 25% advance to single elimination match play.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Scratch singles', description: 'Six games of qualifying. The top 25% advance to match play.',
        format: 'singles', scoring: 'scratch', games: 6, entryFeeCents: 6000, payoutRatio: 4,
        finals: { type: 'match-play-single', cut: { by: 'percent', value: 25 }, notes: 'One game per match, single elimination.' },
      })],
      divisions: [],
      fees: [makeFee(1, 'brackets', 'Scratch brackets', 500, { maxQuantity: 10, bracketScoring: 'scratch' })],
    }),
  },
  {
    id: 'handicap-doubles',
    name: 'Handicap doubles',
    description: 'Pairs, combined pinfall plus each bowler\'s 90% of 220 handicap.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Handicap doubles', description: 'Combined pinfall of both bowlers plus each bowler\'s handicap.',
        format: 'doubles', scoring: 'handicap', games: 3, entryFeeCents: 8000, payoutRatio: 5,
      })],
      divisions: [],
      fees: standardSideEvents(),
    }),
  },
  {
    id: 'scratch-doubles',
    name: 'Scratch doubles',
    description: 'Pairs, combined scratch pinfall over 6 games.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Scratch doubles', description: 'Combined scratch pinfall of both bowlers.',
        format: 'doubles', scoring: 'scratch', games: 6, entryFeeCents: 10000, payoutRatio: 5,
      })],
      divisions: [],
      fees: standardSideEvents(),
    }),
  },
  {
    id: 'mixed-doubles',
    name: 'Mixed doubles',
    description: 'One man and one woman per pair, handicap, 3 games.',
    tournamentType: 'Mixed',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Mixed doubles', description: 'Each pair has one man and one woman. Combined pinfall plus handicap.',
        format: 'doubles', scoring: 'handicap', games: 3, entryFeeCents: 8000, payoutRatio: 5, mixedRequired: true,
      })],
      divisions: [],
      fees: standardSideEvents(),
      fieldOverrides: { gender: 'required' },
    }),
  },
  {
    id: 'scotch-doubles',
    name: 'Scotch doubles',
    description: 'Partners alternate shots, mixed, handicap from the pair\'s combined average.',
    tournamentType: 'Mixed',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Scotch doubles', description: 'Partners alternate shots. Handicap comes from the pair\'s combined average.',
        format: 'scotch-doubles', scoring: 'handicap', games: 3, entryFeeCents: 6000, payoutRatio: 5, mixedRequired: true,
        handicap: { percent: 80, basis: 440, perPair: true },
      })],
      divisions: [],
      fees: [makeFee(1, 'high-game-pot', 'High game pot', 500)],
      fieldOverrides: { gender: 'required' },
    }),
  },
  {
    id: 'team-4',
    name: '4-person team',
    description: 'Teams of 4, team pinfall plus handicap, 3 games.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Team', description: 'Teams of four. Team score is everyone\'s pinfall plus handicap.',
        format: 'team', scoring: 'handicap', games: 3, entryFeeCents: 16000, players: 4, payoutRatio: 5,
      })],
      divisions: [],
      fees: standardSideEvents(),
    }),
  },
  {
    id: 'team-5',
    name: '5-person team',
    description: 'Teams of 5, team pinfall plus handicap, 3 games.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Team', description: 'Teams of five. Team score is everyone\'s pinfall plus handicap.',
        format: 'team', scoring: 'handicap', games: 3, entryFeeCents: 20000, players: 5, payoutRatio: 5,
      })],
      divisions: [],
      fees: standardSideEvents(),
    }),
  },
  {
    id: 'baker-team',
    name: 'Baker team',
    description: 'Teams of 5 rotate frames, scratch, best-of-3 match play finals.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Baker team', description: 'Five bowlers share each game, bowling two frames each.',
        format: 'baker-team', scoring: 'scratch', games: 8, entryFeeCents: 15000, payoutRatio: 4,
        finals: { type: 'match-play-single', cut: { by: 'count', value: 4 }, notes: 'Top 4 teams bowl best-of-3 match play.' },
      })],
      divisions: [],
      fees: [],
    }),
  },
  {
    id: 'no-tap',
    name: '9-pin no-tap',
    description: 'Nine on the first ball counts as a strike. Singles and doubles events.',
    tournamentType: 'Open',
    build: () => ({
      events: [
        makeEvent(1, {
          name: 'No-tap singles', description: 'Nine pins on the first ball counts as a strike.',
          format: 'singles', scoring: 'no-tap', games: 3, entryFeeCents: 3000, payoutRatio: 5,
        }),
        makeEvent(2, {
          name: 'No-tap doubles', description: 'Nine pins on the first ball counts as a strike. Combined pinfall.',
          format: 'doubles', scoring: 'no-tap', games: 3, entryFeeCents: 6000, payoutRatio: 5,
        }),
      ],
      divisions: [],
      fees: [makeFee(1, 'high-game-pot', 'High game pot', 500)],
    }),
  },
  {
    id: 'sweeper',
    name: 'Sweeper',
    description: 'Short format with re-entries, best set counts, 80% of 220, cut to a stepladder.',
    tournamentType: 'Open',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Sweeper', description: 'Four games per set. Re-enter as often as allowed; your best set counts.',
        format: 'singles', scoring: 'handicap', games: 4, entryFeeCents: 5000, reentries: 3, reentryScoring: 'best-counts', payoutRatio: 4,
        handicap: { percent: 80, basis: 220 },
        finals: { type: 'stepladder', cut: { by: 'count', value: 5 }, notes: 'Top 5 bowl a stepladder, one game per match.' },
      })],
      divisions: [],
      fees: standardSideEvents(),
    }),
  },
  {
    id: 'association',
    name: 'Association city or state',
    description: 'Team, doubles, and singles plus All Events, handicap and scratch divisions, USBC required.',
    tournamentType: 'Adult',
    build: () => {
      const usbc = { usbcRequired: true, payoutRatio: 5 } as const;
      const linked = connect(
        [
          makeEvent(1, { name: 'Team', description: 'Four-person team. Counts toward All Events.', format: 'team', scoring: 'handicap', games: 3, entryFeeCents: 10000, players: 4, ...usbc }),
          makeEvent(2, { name: 'Doubles', description: 'Counts toward All Events.', format: 'doubles', scoring: 'handicap', games: 3, entryFeeCents: 5000, ...usbc }),
          makeEvent(3, { name: 'Singles', description: 'Counts toward All Events.', format: 'singles', scoring: 'handicap', games: 3, entryFeeCents: 2500, ...usbc }),
        ],
        [
          makeDivision({ name: 'Handicap', description: 'Scores include handicap.', mode: 'handicap' }),
          makeDivision({ name: 'Scratch', description: 'Scores without handicap.', mode: 'scratch' }),
        ],
      );
      return {
        ...linked,
        fees: [makeFee(1, 'fee', 'All Events', 1000, { per: 'bowler' })],
        fieldOverrides: { usbc_number: 'required' },
      };
    },
  },
  {
    id: 'senior',
    name: 'Senior',
    description: 'Handicap singles with Senior 50+ and Super senior 65+ divisions.',
    tournamentType: 'Senior',
    build: () => {
      const linked = connect(
        [makeEvent(1, { name: 'Senior singles', description: 'Three games with handicap.', format: 'singles', scoring: 'handicap', games: 3, entryFeeCents: 3500, payoutRatio: 5 })],
        [
          makeDivision({ name: 'Senior 50+', description: 'Bowlers aged 50 to 64.', mode: 'handicap', minAge: 50, maxAge: 64 }),
          makeDivision({ name: 'Super senior 65+', description: 'Bowlers aged 65 and up.', mode: 'handicap', minAge: 65 }),
        ],
      );
      return { ...linked, fees: standardSideEvents(), fieldOverrides: { date_of_birth: 'required' } };
    },
  },
  {
    id: 'youth',
    name: 'Youth',
    description: 'Bowlers under 21, handicap, scholarship prizes instead of cash.',
    tournamentType: 'Youth',
    build: () => {
      const linked = connect(
        [makeEvent(1, { name: 'Youth singles', description: 'Three games with handicap. Prizes are scholarships.', format: 'singles', scoring: 'handicap', games: 3, entryFeeCents: 2500, payoutRatio: 5, usbcRequired: true })],
        [makeDivision({ name: 'Youth under 21', description: 'Bowlers 20 and under.', mode: 'handicap', maxAge: 20, rules: { prizeType: 'scholarship' } })],
      );
      return { ...linked, fees: [], fieldOverrides: { date_of_birth: 'required', usbc_number: 'required' } };
    },
  },
  {
    id: 'pro-am',
    name: 'Pro-am',
    description: 'Amateurs bowl with a rotating pro, handicap for amateurs, often a fundraiser.',
    tournamentType: 'Invitational',
    build: () => ({
      events: [makeEvent(1, {
        name: 'Pro-am', description: 'Amateurs bowl alongside a different pro each game. Handicap applies to amateurs only.',
        format: 'singles', scoring: 'handicap', games: 3, entryFeeCents: 7500, payoutRatio: 5,
      })],
      divisions: [],
      fees: [makeFee(1, 'donation', 'Donation', 1000)],
    }),
  },
  {
    id: 'fundraiser',
    name: 'Fundraiser',
    description: 'No-tap fun with mystery doubles, pots, and a donation.',
    tournamentType: 'Other',
    build: () => ({
      events: [makeEvent(1, {
        name: 'No-tap fundraiser', description: 'Nine pins on the first ball counts as a strike.',
        format: 'singles', scoring: 'no-tap', games: 3, entryFeeCents: 2500,
      })],
      divisions: [],
      fees: [
        makeFee(1, 'mystery-doubles', 'Mystery doubles', 500),
        makeFee(2, 'high-game-pot', 'High game pot', 500),
        makeFee(3, 'strike-pot', 'Strike pot', 200),
        makeFee(4, 'donation', 'Donation', 1000),
      ],
    }),
  },
];

export function findTournamentTemplate(id: string | null | undefined): TournamentTemplateOption | null {
  return TOURNAMENT_TEMPLATES.find((template) => template.id === id) ?? null;
}

export type TemplateTarget = {
  details: TournamentDetails;
  events: EventConfig[];
  divisions: DivisionConfig[];
  fees: FeeConfig[];
  questions: CustomQuestionConfig[];
  fields: RegistrationFieldConfig[];
};

/**
 * Applies a template to the setup. A template replaces events, divisions, and add-ons and adds
 * its questions. null starts blank: events, divisions, and add-ons are cleared and
 * formatTemplateId becomes '' to record that a choice was made.
 */
export function applyTournamentTemplate(current: TemplateTarget, templateId: string | null): TemplateTarget {
  const template = findTournamentTemplate(templateId);
  if (!template) {
    return { ...current, details: { ...current.details, formatTemplateId: '' }, events: [], divisions: [], fees: [] };
  }
  const built = template.build();
  const overrides = built.fieldOverrides ?? {};
  const questions = [...current.questions, ...(built.questions ?? [])].map((question, index) => ({ ...question, displayOrder: index + 1 }));
  return {
    details: {
      ...current.details,
      formatTemplateId: template.id,
      tournamentType: current.details.tournamentType || template.tournamentType || '',
    },
    events: built.events,
    divisions: built.divisions,
    fees: built.fees,
    questions,
    fields: current.fields.map((field) => (overrides[field.key] ? { ...field, mode: overrides[field.key] } : field)),
  };
}
