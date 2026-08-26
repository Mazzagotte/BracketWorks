import type { RegistrationFieldConfig, SetupSection, SetupSectionKey } from './types';

export const setupSections: SetupSection[] = [
  { key: 'tournament-details', label: 'Tournament Details', description: 'Identity, dates, location, and publishing' },
  { key: 'squads-availability', label: 'Squads & Availability', description: 'Date and time groups with capacities and availability' },
  { key: 'events-divisions', label: 'Events & Divisions', description: 'Event types, division eligibility, and squad assignments' },
  { key: 'registration-setup', label: 'Registration Setup', description: 'Fields and custom questions' },
  { key: 'fees-payments-documents', label: 'Add-ons, Payments & Docs', description: 'Optional add-ons, payment methods, and rules' },
  { key: 'review-publish', label: 'Review & Publish', description: 'Validation and publishing checks' },
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

export const sectionOrder: SetupSectionKey[] = setupSections.map((section) => section.key);
