import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatTournamentDate, formatTournamentDateRange } from './tournamentDates';

describe('tournament calendar dates', () => {
  it('collapses same-day dates and normalizes legacy display strings', () => {
    expect(formatTournamentDateRange('2026-11-15', '2026-11-15')).toBe('Nov 15, 2026');
    expect(formatTournamentDateRange('Nov 15-2026 (day: 15)', '2026-11-15')).toBe('Nov 15, 2026');
    expect(formatTournamentDateRange('2026-11-15T09:00:00', '2026-11-15T19:00:00')).toBe('Nov 15, 2026');
  });

  it('shows a clear multi-day range and handles absent or invalid dates', () => {
    expect(formatTournamentDateRange('2026-11-15', '2026-11-17')).toBe('Nov 15, 2026 - Nov 17, 2026');
    expect(formatTournamentDateRange(null, '2026-11-17')).toBe('Nov 17, 2026');
    expect(formatTournamentDateRange(null, null)).toBe('Dates not set');
    expect(formatTournamentDate('2026-02-30')).toBe('Date not set');
  });

  it.each(['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'])(
    'preserves date-only values in %s in a real separate runtime',
    (timeZone) => {
      const moduleUrl = pathToFileURL(path.resolve('lib', 'tournamentDates.ts')).href;
      const output = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
        `import { formatTournamentDateRange } from '${moduleUrl}'; console.log(formatTournamentDateRange('2026-11-15', '2026-11-15')); console.log(formatTournamentDateRange('2026-03-08', '2026-03-09'));`,
      ], { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' });
      expect(output.trim()).toBe('Nov 15, 2026\nMar 8, 2026 - Mar 9, 2026');
    },
  );
});
