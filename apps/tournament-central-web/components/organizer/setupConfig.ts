import type {
  CustomQuestionConfig,
  DivisionConfig,
  EventConfig,
  FeeConfig,
  LocationConfig,
  RegistrationFieldConfig,
  SetupSection,
  SetupSectionKey,
  SquadConfig,
  ValidationIssue,
} from './types';

export const setupSections: SetupSection[] = [
  { key: 'tournament-details', label: 'Tournament Details', description: 'Identity, dates, location, and publishing' },
  { key: 'events-divisions', label: 'Events & Divisions', description: 'Event types and division eligibility' },
  { key: 'squads-availability', label: 'Squads & Availability', description: 'Date and time groups with capacities and availability' },
  { key: 'registration-setup', label: 'Registration Setup', description: 'Fields and custom questions' },
  { key: 'fees-payments-documents', label: 'Add-ons, Payments & Docs', description: 'Optional add-ons, payment methods, and rules' },
  { key: 'review-publish', label: 'Review & Publish', description: 'Validation and publishing checks' },
];

export const initialLocations: LocationConfig[] = [
  { id: 'loc-1', name: 'Sunset Lanes', city: 'Boise', state: 'ID', defaultLocation: true },
  { id: 'loc-2', name: 'Strike Arena', city: 'Meridian', state: 'ID', defaultLocation: false },
];

export const initialEvents: EventConfig[] = [
  {
    id: 'ev-1',
    name: 'Main Event',
    description: 'Primary tournament event.',
    minPlayers: 1,
    maxPlayers: 1,
    scoring: 'handicap',
    requireSquad: true,
    requireDivision: true,
    allowReentry: true,
    maxReentries: 2,
    enabled: true,
    displayOrder: 1,
    connectedDivisionIds: ['div-1', 'div-2'],
    connectedSquadIds: ['sq-1', 'sq-2'],
    entryFeeCents: 12000,
  },
  {
    id: 'ev-2',
    name: 'Optional Shootout',
    description: 'Optional elimination side event.',
    minPlayers: 1,
    maxPlayers: 1,
    scoring: 'scratch',
    requireSquad: false,
    requireDivision: false,
    allowReentry: false,
    maxReentries: 0,
    enabled: true,
    displayOrder: 2,
    connectedDivisionIds: [],
    connectedSquadIds: ['sq-1'],
    entryFeeCents: 3000,
  },
];

export const initialDivisions: DivisionConfig[] = [
  {
    id: 'div-1',
    name: 'Classic',
    description: 'Standard bracket division.',
    minAverage: 170,
    maxAverage: 220,
    minAge: null,
    maxAge: null,
    mode: 'both',
    eligibilityNotes: '',
    enabled: true,
    eventIds: ['ev-1'],
  },
  {
    id: 'div-2',
    name: 'Development',
    description: 'For newer competitive bowlers.',
    minAverage: null,
    maxAverage: 169,
    minAge: null,
    maxAge: null,
    mode: 'handicap',
    eligibilityNotes: 'Average sheet required at check-in.',
    enabled: true,
    eventIds: ['ev-1'],
  },
];

export const initialSquads: SquadConfig[] = [
  {
    id: 'sq-1',
    name: 'Saturday AM Squad',
    dateIso: '2026-10-17',
    startTime: '09:00',
    checkInTime: '08:15',
    requiredBowlerCount: 1,
    locationName: 'Sunset Lanes',
    capacity: 84,
    waitlistEnabled: true,
    registrationDeadlineIso: '2026-10-16',
    notes: '',
    eventIds: ['ev-1', 'ev-2'],
    registeredCount: 52,
  },
  {
    id: 'sq-2',
    name: 'Saturday PM Squad',
    dateIso: '2026-10-17',
    startTime: '14:00',
    checkInTime: '13:15',
    requiredBowlerCount: 1,
    locationName: 'Sunset Lanes',
    capacity: 84,
    waitlistEnabled: true,
    registrationDeadlineIso: '2026-10-16',
    notes: '',
    eventIds: ['ev-1'],
    registeredCount: 41,
  },
];

export const initialRegistrationFields: RegistrationFieldConfig[] = [
  { id: 'rf-1', key: 'first_name', label: 'First Name', customLabel: '', helpText: '', mode: 'required', displayOrder: 1, validation: 'Text' },
  { id: 'rf-2', key: 'last_name', label: 'Last Name', customLabel: '', helpText: '', mode: 'required', displayOrder: 2, validation: 'Text' },
  { id: 'rf-3', key: 'email', label: 'Email', customLabel: '', helpText: '', mode: 'required', displayOrder: 3, validation: 'Email' },
  { id: 'rf-4', key: 'phone', label: 'Phone', customLabel: '', helpText: '', mode: 'optional', displayOrder: 4, validation: 'Phone' },
  { id: 'rf-5', key: 'usbc_number', label: 'USBC Number', customLabel: '', helpText: '', mode: 'optional', displayOrder: 5, validation: 'Pattern' },
  { id: 'rf-6', key: 'date_of_birth', label: 'Date of Birth', customLabel: '', helpText: '', mode: 'optional', displayOrder: 6, validation: 'Date' },
  { id: 'rf-7', key: 'average', label: 'Average', customLabel: '', helpText: '', mode: 'required', displayOrder: 7, validation: 'Number' },
  { id: 'rf-8', key: 'address', label: 'Address', customLabel: '', helpText: '', mode: 'dont-ask', displayOrder: 8, validation: 'Text' },
  { id: 'rf-9', key: 'city', label: 'City', customLabel: '', helpText: '', mode: 'dont-ask', displayOrder: 9, validation: 'Text' },
  { id: 'rf-10', key: 'state', label: 'State', customLabel: '', helpText: '', mode: 'dont-ask', displayOrder: 10, validation: 'Text' },
  { id: 'rf-11', key: 'zip', label: 'ZIP', customLabel: '', helpText: '', mode: 'dont-ask', displayOrder: 11, validation: 'ZIP' },
  { id: 'rf-12', key: 'bowling_hand', label: 'Bowling Hand', customLabel: '', helpText: '', mode: 'dont-ask', displayOrder: 12, validation: 'Enum' },
];

export const initialCustomQuestions: CustomQuestionConfig[] = [
  {
    id: 'cq-1',
    label: 'Will you attend the banquet?',
    type: 'yes-no',
    required: false,
    options: [],
    helpText: 'Used for meal planning.',
    displayOrder: 1,
    enabled: true,
    scope: { all: true, eventIds: [], divisionIds: [], squadIds: [] },
  },
  {
    id: 'cq-2',
    label: 'Preferred lane partner (optional)',
    type: 'short-text',
    required: false,
    options: [],
    helpText: '',
    displayOrder: 2,
    enabled: true,
    scope: { all: false, eventIds: ['ev-1'], divisionIds: [], squadIds: [] },
  },
];

export const initialFees: FeeConfig[] = [
  {
    id: 'fee-2',
    name: 'All-Events',
    amountCents: 2500,
    required: false,
    enabled: true,
    displayOrder: 2,
    eventIds: ['ev-1'],
    divisionIds: [],
    squadIds: [],
  },
];

export const initialValidationIssues: ValidationIssue[] = [
  {
    id: 'val-1',
    section: 'fees-payments-documents',
    severity: 'error',
    message: 'Payment processor account is not connected.',
  },
  {
    id: 'val-2',
    section: 'fees-payments-documents',
    severity: 'warning',
    message: 'No rules document uploaded yet.',
  },
];

export const sectionOrder: SetupSectionKey[] = setupSections.map((section) => section.key);
