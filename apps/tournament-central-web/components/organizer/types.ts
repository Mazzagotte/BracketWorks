import type { DivisionRules, EventRules, SideEventSettings } from './formatTypes';

export type SetupStatus = 'complete' | 'incomplete' | 'needs-attention' | 'not-used';

export type SetupSectionKey =
  | 'tournament-details'
  | 'events-divisions'
  | 'squads-availability'
  | 'registration-setup'
  | 'fees-payments-documents'
  | 'review-publish';

export type SetupSection = {
  key: SetupSectionKey;
  label: string;
  description: string;
};

export type EventConfig = {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  scoring: 'handicap' | 'scratch' | 'no-tap';
  requireSquad: boolean;
  requireDivision: boolean;
  allowReentry: boolean;
  maxReentries: number;
  enabled: boolean;
  displayOrder: number;
  connectedDivisionIds: string[];
  connectedSquadIds: string[];
  entryFeeCents: number;
  /** Format, games, handicap, averages, team rules, finals. Filled in by normalizeEventConfig. */
  rules?: EventRules;
};

export type DivisionMode = 'scratch' | 'handicap' | 'both';

export type DivisionConfig = {
  id: string;
  name: string;
  description: string;
  minAverage: number | null;
  maxAverage: number | null;
  minAge: number | null;
  maxAge: number | null;
  mode: DivisionMode;
  eligibilityNotes: string;
  enabled: boolean;
  eventIds: string[];
  /** Gender and prize type. Filled in when the draft is normalized. */
  rules?: DivisionRules;
};

export type SquadConfig = {
  id: string;
  name: string;
  dateIso: string;
  startTime: string;
  checkInTime: string;
  requiredBowlerCount: number;
  locationName: string;
  capacity: number;
  waitlistEnabled: boolean;
  registrationDeadlineIso: string | null;
  notes: string;
  eventIds: string[];
  registeredCount: number;
};

export type RegistrationFieldMode = 'required' | 'optional' | 'dont-ask';

export type RegistrationFieldConfig = {
  id: string;
  key: string;
  label: string;
  customLabel: string;
  helpText: string;
  mode: RegistrationFieldMode;
  displayOrder: number;
  validation: string;
};

export type CustomQuestionType =
  | 'short-text'
  | 'long-text'
  | 'number'
  | 'yes-no'
  | 'dropdown'
  | 'multiple-choice'
  | 'checkbox'
  | 'date';

export type QuestionScope = {
  all: boolean;
  eventIds: string[];
  divisionIds: string[];
  squadIds: string[];
};

export type RegistrationQuestionAnswerValue = string | boolean | string[];

export type CustomQuestionConfig = {
  id: string;
  label: string;
  type: CustomQuestionType;
  required: boolean;
  options: string[];
  helpText: string;
  displayOrder: number;
  enabled: boolean;
  scope: QuestionScope;
};

export type FeeConfig = {
  id: string;
  name: string;
  amountCents: number;
  required: boolean;
  enabled: boolean;
  displayOrder: number;
  eventIds: string[];
  divisionIds: string[];
  squadIds: string[];
  /** What the fee is (plain fee, brackets, a pot) and how bowlers buy it. Filled in when the draft is normalized. */
  sideEvent?: SideEventSettings;
};

export type LocationConfig = {
  id: string;
  name: string;
  city: string;
  state: string;
  defaultLocation: boolean;
};

export type ValidationIssue = {
  id: string;
  section: SetupSectionKey;
  severity: 'warning' | 'error';
  message: string;
};
