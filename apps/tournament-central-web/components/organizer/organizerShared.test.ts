import { describe, expect, it } from 'vitest';

import {
  formatMoney,
  formatSquadTime,
  formatTournamentDate,
  formatTournamentDateRange,
} from './organizerFormatting';
import { isOrganizerRouteActive, organizerRoutes } from './organizerRoutes';

describe('organizerRoutes', () => {
  it('builds and encodes tournament routes in one place', () => {
    expect(organizerRoutes.overview(42)).toBe('/organizer/tournaments/42');
    expect(organizerRoutes.setup(42, 'registration setup')).toBe('/organizer/tournaments/42/setup?section=registration%20setup');
    expect(organizerRoutes.team(42)).toBe('/organizer/tournaments/42/team');
    expect(organizerRoutes.activity(42)).toBe('/organizer/tournaments/42/activity');
    expect(organizerRoutes.account).toBe('/organizer/account');
  });

  it('marks nested routes active without making overview active for every section', () => {
    expect(isOrganizerRouteActive('/organizer/tournaments/42/setup/events', organizerRoutes.setup(42))).toBe(true);
    expect(isOrganizerRouteActive('/organizer/tournaments/42/setup', organizerRoutes.overview(42))).toBe(false);
    expect(isOrganizerRouteActive('/organizer/tournaments/42/payments', organizerRoutes.setup(42))).toBe(false);
  });
});

describe('organizerFormatting', () => {
  it('formats calendar dates without parsing date-only values as UTC', () => {
    expect(formatTournamentDate('2026-01-02')).toBe('Jan 2, 2026');
    expect(formatTournamentDateRange('2026-01-02', '2026-01-04')).toBe('Jan 2, 2026 - Jan 4, 2026');
  });

  it('formats squad times and safe money values consistently', () => {
    expect(formatSquadTime('13:05')).toBe('1:05 PM');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(undefined)).toBe('$0.00');
    expect(formatMoney(12345)).toBe('$123.45');
  });
});
