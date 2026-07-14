import { TournamentForm } from '../../lib/types';

export function normalizeSquadTimes(squadTimes?: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(squadTimes || {})
      .map(([date, times]) => [date, [...(times || [])].filter(Boolean).sort()] as [string, string[]])
      .filter(([, times]) => times.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function normalizeTournamentForm(form: TournamentForm): TournamentForm {
  return {
    name: form.name || '',
    location: form.location || '',
    start_date: form.start_date || '',
    end_date: form.end_date || '',
    squad_times: normalizeSquadTimes(form.squad_times),
  };
}

export function getDatesBetween(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];

  const dateList: string[] = [];
  let currentDate = new Date(startDate);
  const finalDate = new Date(endDate);

  while (currentDate <= finalDate) {
    dateList.push(currentDate.toISOString().slice(0, 10));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dateList;
}
