'use client';

import { SegmentedControl, SelectField } from '@bracketworks/ui';

import type { LiveDivision, LiveEvent } from './liveStandingsTypes';
import styles from './LiveShell.module.css';

/* Event, division, and squad pickers and the group keys behind them. Shared by the live standings
   page and the live finals page. */

const DIVISION_ALL = '__all';
/** Picker value for a per-squad group of entries without a squad. */
const SQUAD_NONE = '__none';
/** Segmented controls hold up to five options; more become a select. */
const MAX_SEGMENTS = 5;

export type PickerOption = { value: string; label: string; count?: number };

export function divisionKey(division: LiveDivision): string {
  return division.id ?? DIVISION_ALL;
}

/** '' for tournament-wide groups; the squad id (or SQUAD_NONE) when the event's finals are per squad. */
export function squadKey(division: LiveDivision): string {
  return division.squad ? division.squad.id ?? SQUAD_NONE : '';
}

/** Stable key for one standings group: division plus squad. */
export function groupKey(division: LiveDivision): string {
  return `${divisionKey(division)}|${squadKey(division)}`;
}

export function sectionTitle(event: LiveEvent, division: LiveDivision): string {
  return [event.name, division.name, division.squad?.label].filter(Boolean).join(' · ');
}

/** One option per division (per-squad events list each division once, with every squad's entries counted). */
export function divisionOptions(event: LiveEvent): PickerOption[] {
  const options = new Map<string, PickerOption>();
  for (const item of event.divisions) {
    const key = divisionKey(item);
    const current = options.get(key);
    if (current) current.count = (current.count ?? 0) + item.entryCount;
    else options.set(key, { value: key, label: item.name ?? 'All', count: item.entryCount });
  }
  return [...options.values()];
}

export function squadOptions(event: LiveEvent, division: LiveDivision): PickerOption[] {
  return event.divisions
    .filter((item) => item.squad && divisionKey(item) === divisionKey(division))
    .map((item) => ({ value: squadKey(item), label: item.squad?.label ?? 'Squad', count: item.entryCount }));
}

/** The group for a division and squad choice, falling back to the division's first squad, then the event's first group. */
export function findGroup(event: LiveEvent, divisionId: string | null, squadId: string | null): LiveDivision | null {
  const first = event.divisions[0];
  const wanted = divisionId ?? (first ? divisionKey(first) : null);
  const inDivision = event.divisions.filter((item) => divisionKey(item) === wanted);
  return inDivision.find((item) => squadKey(item) === squadId) ?? inDivision[0] ?? event.divisions[0] ?? null;
}

/** Every event, division, and squad group in order, for TV mode to step through. */
export function groupStops(events: LiveEvent[]): Array<{ eventId: string; divisionId: string; squadId: string }> {
  return events.flatMap((item) => item.divisions.map((entry) => ({ eventId: item.id, divisionId: divisionKey(entry), squadId: squadKey(entry) })));
}

export function Picker({ label, options, value, onChange }: { label: string; options: PickerOption[]; value: string; onChange: (value: string) => void }) {
  if (options.length < 2) return null;
  if (options.length <= MAX_SEGMENTS) {
    return (
      <SegmentedControl
        label={label}
        className={styles.segmented}
        options={options.map((option) => ({ value: option.value, label: option.label, count: option.count }))}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <SelectField label={label} hideLabel value={value} onChange={(event) => onChange(event.target.value)} className={styles.select}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </SelectField>
  );
}
