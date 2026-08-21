import type { TournamentDetails } from './setupTypes';

export const DRAFT_VERSION = 1;

export function getDraftStorageKey(): string {
  if (typeof window === 'undefined') {
    return 'tc_organizer_setup_draft';
  }

  const userId = (localStorage.getItem('user_id') || '').trim();
  return userId ? `tc_organizer_setup_draft_user_${userId}` : 'tc_organizer_setup_draft';
}

export const defaultTournamentDetails: TournamentDetails = {
  name: 'Mountain Classic Open',
  subtitle: 'USBC Certified \u2022 Fall Series',
  series: 'Fall Series',
  certification: 'USBC Certified',
  organizer: 'Idaho State Bowling Association',
  tournamentType: 'Adult',
  startDateIso: '2026-10-30',
  endDateIso: '2026-11-01',
  venueId: null,
  bowlingCenter: 'Sunset Lanes',
  venueAddressLine1: '',
  venueAddressLine2: '',
  city: 'Boise',
  state: 'ID',
  venueZip: '',
  venueCountry: 'US',
  venueLatitude: null,
  venueLongitude: null,
  venueExternalProvider: '',
  venueExternalPlaceId: '',
  timezone: 'America/Boise (MT)',
  visibility: 'public',
  tournamentStatus: 'draft',
  supportEmail: 'director@mountainclassic.com',
  supportPhone: '(208) 555-0198',
  registrationOpenIso: '2026-08-12',
  registrationCloseIso: '2026-10-16',
  logoFileName: '',
};

export const TIMEZONES = [
  { value: 'America/New_York (ET)', label: 'America/New_York (ET)' },
  { value: 'America/Chicago (CT)', label: 'America/Chicago (CT)' },
  { value: 'America/Denver (MT)', label: 'America/Denver (MT)' },
  { value: 'America/Boise (MT)', label: 'America/Boise (MT)' },
  { value: 'America/Los_Angeles (PT)', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Phoenix (AZ)', label: 'America/Phoenix (AZ)' },
  { value: 'America/Anchorage (AKT)', label: 'America/Anchorage (AKT)' },
  { value: 'Pacific/Honolulu (HT)', label: 'Pacific/Honolulu (HT)' },
];

export const US_STATES: Array<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];
