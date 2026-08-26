import type { SquadConfig } from './types';

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function formatEntryFeeInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function normalizeEntryFeeInput(value: string): string {
  const sanitized = value.replace(/[^\d.]/g, '');
  const firstDecimalIndex = sanitized.indexOf('.');

  if (firstDecimalIndex === -1) {
    return sanitized;
  }

  const whole = sanitized.slice(0, firstDecimalIndex + 1);
  const fraction = sanitized.slice(firstDecimalIndex + 1).replace(/\./g, '').slice(0, 2);
  return `${whole}${fraction}`;
}

export function parseEntryFeeInputToCents(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / (1024 ** unitIndex);
  const precision = unitIndex === 0 ? 0 : size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function inferLogoFileLabel(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith('.svg')) {
    return 'SVG';
  }
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'JPG';
  }
  if (normalized.endsWith('.png')) {
    return 'PNG';
  }
  return 'Image';
}

export function formatDateLabel(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(dateIso: string): string {
  if (!dateIso) {
    return 'Not set';
  }

  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateIso;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatSquadTimeLabel(time: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return time;
  }

  const [hoursText, minutesText] = time.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return time;
  }

  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function buildSquadDisplayName(squad: Pick<SquadConfig, 'dateIso' | 'startTime'>): string {
  const dateLabel = squad.dateIso ? formatDateLabel(squad.dateIso) : 'Squad';
  const timeLabel = squad.startTime ? formatSquadTimeLabel(squad.startTime) : 'Time TBD';
  return `${dateLabel} - ${timeLabel}`;
}

export function formatTournamentCardDate(startDateIso: string | null | undefined, endDateIso: string | null | undefined): string {
  const value = (startDateIso || endDateIso || '').trim();
  if (!value) {
    return 'No dates set';
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function countTournamentSquads(squadTimes: Record<string, string[]> | undefined): number {
  return Object.values(squadTimes || {}).reduce((count, times) => {
    if (!Array.isArray(times)) {
      return count;
    }
    return count + times.length;
  }, 0);
}

export function buildSquadTimesPayload(squads: SquadConfig[]): Record<string, string[]> {
  const byDate = new Map<string, Set<string>>();

  for (const squad of squads) {
    const dateIso = squad.dateIso.trim();
    const startTime = squad.startTime.trim();
    if (!dateIso || !startTime) {
      continue;
    }

    const times = byDate.get(dateIso) ?? new Set<string>();
    times.add(startTime);
    byDate.set(dateIso, times);
  }

  const squadTimes: Record<string, string[]> = {};
  for (const [dateIso, times] of byDate.entries()) {
    squadTimes[dateIso] = [...times].sort((a, b) => a.localeCompare(b));
  }

  return squadTimes;
}
