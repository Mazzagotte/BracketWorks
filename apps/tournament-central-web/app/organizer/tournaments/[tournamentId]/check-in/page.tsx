'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Printer, UserPlus, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ICON_SIZE,
  Notice,
  Page,
  PageHeader,
  SearchField,
  SegmentedControl,
  SelectField,
  StatGroup,
  TableToolbar,
  buttonClassName,
} from '@bracketworks/ui';

import { setBowlerCheckIn } from '@/components/organizer/checkInApi';
import type { OrganizerRegistrationRecord } from '@/components/organizer/organizerApi';
import { formatSquadTime, formatTournamentDate, normalizeTournamentDate } from '@/components/organizer/organizerFormatting';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import { usePaymentToggle } from '@/components/organizer/usePaymentToggle';
import type { SquadConfig } from '@/components/organizer/types';
import cells from '@/components/organizer/OrganizerTable.module.css';
import styles from './check-in.module.css';

type ShowFilter = 'all' | 'not-here' | 'checked-in';

type SquadOption = {
  id: string;
  name: string;
  dateIso: string;
  startTime: string;
};

type CheckInRow = {
  bowlerId: number;
  name: string;
  sortName: string;
  usbcNumber: string;
  email: string;
  events: string[];
  /** Brackets bought at registration, so the desk can confirm the count. */
  brackets: number;
  registration: OrganizerRegistrationRecord;
  checkedInAt: string | null;
};

const NO_SQUAD = '__no_squad__';
const ACTIVE_REGISTRATION_STATUSES = new Set(['confirmed', 'pending']);
const INACTIVE_ENTRY_STATUSES = new Set(['cancelled', 'refunded', 'waitlisted']);
const LATE_ARRIVAL_WINDOW_MINUTES = 60;
const checkInTimeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function formatCheckInTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : checkInTimeFormatter.format(date);
}

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/u.exec(time.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isActiveRegistration(registration: OrganizerRegistrationRecord): boolean {
  return ACTIVE_REGISTRATION_STATUSES.has(registration.status ?? 'pending');
}

/** Squads from setup, plus any squad that only appears on entries (renamed or removed later). */
function buildSquadOptions(squads: SquadConfig[], registrations: OrganizerRegistrationRecord[]): SquadOption[] {
  const options: SquadOption[] = squads.map((squad) => ({
    id: squad.id,
    name: squad.name,
    dateIso: normalizeTournamentDate(squad.dateIso) ?? '',
    startTime: squad.startTime ?? '',
  }));
  const known = new Set(options.map((option) => option.id));
  let hasUnassigned = false;
  registrations.filter(isActiveRegistration).forEach((registration) => {
    (registration.entries ?? []).forEach((entry) => {
      if (INACTIVE_ENTRY_STATUSES.has(entry.status)) return;
      const id = entry.squad_config_id;
      if (!id) {
        hasUnassigned = true;
        return;
      }
      if (known.has(id)) return;
      known.add(id);
      options.push({
        id,
        name: entry.squad_name || 'Squad',
        dateIso: normalizeTournamentDate(entry.squad_date) ?? '',
        startTime: entry.squad_time ?? '',
      });
    });
  });
  if (hasUnassigned) options.push({ id: NO_SQUAD, name: 'No squad', dateIso: '', startTime: '' });
  return options;
}

/** The next squad starting today (a squad that started within the last hour still counts), else the first. */
function pickDefaultSquad(options: SquadOption[], now: Date): string {
  const today = localDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = options
    .filter((option) => option.dateIso === today)
    .map((option) => ({ id: option.id, minutes: toMinutes(option.startTime) }))
    .filter((option): option is { id: string; minutes: number } => option.minutes !== null)
    .filter((option) => option.minutes >= nowMinutes - LATE_ARRIVAL_WINDOW_MINUTES)
    .sort((left, right) => left.minutes - right.minutes);
  return upcoming[0]?.id ?? options[0]?.id ?? '';
}

function squadLabel(option: SquadOption, singleDay: boolean): string {
  if (option.id === NO_SQUAD) return option.name;
  const hasTime = toMinutes(option.startTime) !== null;
  if (singleDay) return hasTime ? formatSquadTime(option.startTime) : option.name;
  const date = option.dateIso ? formatTournamentDate(option.dateIso) : '';
  const parts = [date, hasTime ? formatSquadTime(option.startTime) : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : option.name;
}

function bracketsBought(registration: OrganizerRegistrationRecord, bowlerId: number): number {
  return (registration.side_events ?? [])
    .filter((record) => record.kind === 'brackets' && record.bowler_id === bowlerId)
    .reduce((total, record) => total + record.quantity, 0);
}

function sellsBrackets(registrations: OrganizerRegistrationRecord[]): boolean {
  return registrations.some((registration) => (registration.side_events ?? []).some((record) => record.kind === 'brackets'));
}

function buildRows(registrations: OrganizerRegistrationRecord[], squadId: string): CheckInRow[] {
  const rows = new Map<number, CheckInRow>();
  registrations.filter(isActiveRegistration).forEach((registration) => {
    (registration.entries ?? []).forEach((entry) => {
      if (INACTIVE_ENTRY_STATUSES.has(entry.status)) return;
      const entrySquad = entry.squad_config_id || NO_SQUAD;
      if (entrySquad !== squadId) return;
      (entry.bowlers ?? []).forEach((bowler) => {
        const existing = rows.get(bowler.id);
        if (existing) {
          if (entry.event_name && !existing.events.includes(entry.event_name)) existing.events.push(entry.event_name);
          return;
        }
        const name = `${bowler.first_name ?? ''} ${bowler.last_name ?? ''}`.trim() || 'Unnamed bowler';
        rows.set(bowler.id, {
          bowlerId: bowler.id,
          name,
          sortName: `${bowler.last_name ?? ''} ${bowler.first_name ?? ''}`.trim().toLowerCase(),
          usbcNumber: bowler.usbc_number ?? '',
          email: bowler.email ?? '',
          events: entry.event_name ? [entry.event_name] : [],
          brackets: bracketsBought(registration, bowler.id),
          registration,
          checkedInAt: bowler.checked_in_at ?? null,
        });
      });
    });
  });
  return [...rows.values()].sort((left, right) => left.sortName.localeCompare(right.sortName));
}

export default function CheckInPage() {
  const {
    tournamentId,
    tournament,
    squads,
    registrations,
    isRegistrationsLoading,
    isSetupLoading,
    registrationsError,
    setupError,
    tournamentError,
    refreshRegistrations,
  } = useTournamentContext();
  const payments = usePaymentToggle({ tournamentId, refreshRegistrations });

  const squadOptions = useMemo(() => buildSquadOptions(squads ?? [], registrations ?? []), [squads, registrations]);
  const [selectedSquad, setSelectedSquad] = useState('');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<ShowFilter>('all');
  // Check-in changes made on this page, layered over the loaded registrations until they refresh.
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [checkInError, setCheckInError] = useState('');
  const savingRef = useRef<Set<number>>(new Set());

  const squadId = squadOptions.some((option) => option.id === selectedSquad)
    ? selectedSquad
    : pickDefaultSquad(squadOptions, new Date());

  useEffect(() => {
    if (squadId && squadId !== selectedSquad) setSelectedSquad(squadId);
  }, [squadId, selectedSquad]);

  const singleDay = new Set(squadOptions.filter((option) => option.id !== NO_SQUAD).map((option) => option.dateIso)).size <= 1;
  const currentSquad = squadOptions.find((option) => option.id === squadId);

  const rows = useMemo(() => buildRows(registrations ?? [], squadId).map((row) => (
    row.bowlerId in overrides ? { ...row, checkedInAt: overrides[row.bowlerId] } : row
  )), [registrations, squadId, overrides]);

  const showBrackets = useMemo(() => sellsBrackets(registrations ?? []), [registrations]);
  const checkedInCount = rows.filter((row) => row.checkedInAt).length;
  const unpaidCount = rows.filter((row) => (row.registration.payment_status ?? 'unpaid') === 'unpaid').length;

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (show === 'not-here' && row.checkedInAt) return false;
      if (show === 'checked-in' && !row.checkedInAt) return false;
      if (!query) return true;
      return [row.name, row.usbcNumber, row.email, row.registration.confirmation_code ?? '']
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [rows, search, show]);

  const toggleCheckIn = async (row: CheckInRow, checked: boolean) => {
    if (savingRef.current.has(row.bowlerId)) return;
    setCheckInError('');
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setCheckInError('Your session expired. Please sign in again.');
      return;
    }
    const previous = row.checkedInAt;
    savingRef.current.add(row.bowlerId);
    setSavingIds(new Set(savingRef.current));
    setOverrides((current) => ({ ...current, [row.bowlerId]: checked ? new Date().toISOString() : null }));
    try {
      const result = await setBowlerCheckIn(token, tournamentId, row.bowlerId, checked);
      setOverrides((current) => ({ ...current, [row.bowlerId]: result.checked_in_at }));
    } catch (cause) {
      setOverrides((current) => ({ ...current, [row.bowlerId]: previous }));
      const reason = cause instanceof Error ? cause.message : 'Please try again.';
      setCheckInError(`${row.name} could not be ${checked ? 'checked in' : 'marked as not here'}. ${reason}`);
    } finally {
      savingRef.current.delete(row.bowlerId);
      setSavingIds(new Set(savingRef.current));
    }
  };

  const tournamentName = tournament?.name || 'this tournament';
  const pageError = tournamentError || registrationsError || setupError;
  const isLoading = isRegistrationsLoading || isSetupLoading;
  const squadName = currentSquad ? squadLabel(currentSquad, false) : '';
  const squadPicker = squadOptions.length > 5 ? (
    <SelectField label="Squad" hideLabel value={squadId} onChange={(event) => setSelectedSquad(event.target.value)}>
      {squadOptions.map((option) => (
        <option key={option.id} value={option.id}>{squadLabel(option, singleDay)}</option>
      ))}
    </SelectField>
  ) : (
    <SegmentedControl
      label="Squad"
      value={squadId}
      onChange={setSelectedSquad}
      options={squadOptions.map((option) => ({ value: option.id, label: squadLabel(option, singleDay) }))}
    />
  );

  return (
    <Page className={styles.page}>
      <PageHeader
        className={styles.screenOnly}
        title="Check-in"
        description="Check bowlers in as they arrive, collect payment at the desk, and print a sign-in sheet."
        actions={(
          <>
            <Button
              variant="secondary"
              icon={<Printer size={ICON_SIZE.md} aria-hidden="true" />}
              onClick={() => window.print()}
              disabled={rows.length === 0}
            >
              Print sign-in sheet
            </Button>
            <Link href={organizerRoutes.registrations(tournamentId)} className={buttonClassName({ variant: 'secondary' })}>
              <UserPlus size={ICON_SIZE.md} aria-hidden="true" />
              Add walk-in
            </Link>
          </>
        )}
      />

      {payments.confirmationDialog}
      {pageError ? <Notice className={styles.screenOnly} tone="danger" role="alert">{pageError}</Notice> : null}
      {checkInError ? <Notice className={styles.screenOnly} tone="danger" role="alert">{checkInError}</Notice> : null}
      {payments.actionError ? <Notice className={styles.screenOnly} tone="danger" role="alert">{payments.actionError}</Notice> : null}
      {payments.message ? <Notice className={styles.screenOnly} tone="success" role="status">{payments.message}</Notice> : null}
      {isLoading ? <Notice className={styles.screenOnly} tone="info" role="status">Loading bowlers...</Notice> : null}

      {!pageError && !isLoading ? (
        squadOptions.length === 0 ? (
          <Card className={styles.screenOnly}>
            <EmptyState
              icon={<Users size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No bowlers to check in"
              description="Bowlers appear here once they register for a squad."
              action={(
                <Link href={organizerRoutes.registrations(tournamentId)} className={buttonClassName({ variant: 'secondary' })}>
                  Go to registrations
                </Link>
              )}
            />
          </Card>
        ) : (
          <>
            <StatGroup
              className={styles.screenOnly}
              label={`Check-in summary for ${squadName || 'this squad'}`}
              items={[
                { label: 'Checked in', value: `${checkedInCount} of ${rows.length}` },
                { label: 'Not here yet', value: String(rows.length - checkedInCount) },
                { label: 'Unpaid', value: String(unpaidCount) },
              ]}
            />

            <Card padding="flush" className={styles.screenOnly} aria-label="Bowlers">
              <CardHeader
                title={currentSquad && currentSquad.id !== NO_SQUAD ? currentSquad.name : 'Bowlers'}
                description={`${visibleRows.length} of ${rows.length} bowler${rows.length === 1 ? '' : 's'} shown`}
                actions={(
                  <SegmentedControl
                    label="Show"
                    value={show}
                    onChange={setShow}
                    options={[
                      { value: 'all', label: 'All', count: rows.length },
                      { value: 'not-here', label: 'Not here', count: rows.length - checkedInCount },
                      { value: 'checked-in', label: 'Checked in', count: checkedInCount },
                    ]}
                  />
                )}
              />
              <TableToolbar
                search={(
                  <SearchField
                    label="Find a bowler"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a bowler"
                  />
                )}
              >
                {squadOptions.length > 1 ? squadPicker : null}
              </TableToolbar>
              {visibleRows.length === 0 ? (
                <EmptyState
                  icon={<Users size={ICON_SIZE['2xl']} aria-hidden="true" />}
                  title={rows.length === 0 ? 'No bowlers in this squad' : 'No bowlers match'}
                  description={rows.length === 0
                    ? 'Confirmed and pending bowlers for this squad appear here.'
                    : 'Try a different search or show all bowlers.'}
                />
              ) : (
                <DataTable caption={`Bowlers in ${squadName || 'this squad'}`}>
                  <thead>
                    <tr>
                      <th scope="col">Bowler</th>
                      <th scope="col">Event</th>
                      {showBrackets ? <th scope="col" data-align="right">Brackets</th> : null}
                      <th scope="col">Payment</th>
                      <th scope="col">Checked in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const checked = Boolean(row.checkedInAt);
                      return (
                        <tr key={row.bowlerId}>
                          <td>
                            <div className={cells.stack}>
                              <span className={cells.primaryText}>{row.name}</span>
                              {row.usbcNumber ? <span className={cells.secondaryText}>USBC {row.usbcNumber}</span> : null}
                            </div>
                          </td>
                          <td>{row.events.join(', ') || 'Not selected'}</td>
                          {showBrackets ? <td data-align="right">{row.brackets}</td> : null}
                          <td>{payments.renderPaymentCell(row.registration)}</td>
                          <td>
                            <label className={styles.checkIn}>
                              <input
                                type="checkbox"
                                aria-label={`Check in ${row.name}`}
                                checked={checked}
                                disabled={savingIds.has(row.bowlerId)}
                                onChange={(event) => { void toggleCheckIn(row, event.target.checked); }}
                              />
                              {checked && row.checkedInAt ? (
                                <span className={styles.checkInTime}>{formatCheckInTime(row.checkedInAt)}</span>
                              ) : null}
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              )}
            </Card>

            <section className={styles.printSheet} aria-label="Sign-in sheet">
              <h2 className={styles.printTitle}>{`Sign-in sheet: ${tournamentName}`}</h2>
              <p className={styles.printMeta}>{`${squadName || 'All bowlers'} · ${rows.length} bowler${rows.length === 1 ? '' : 's'}`}</p>
              <DataTable caption="Sign-in sheet">
                <thead>
                  <tr>
                    <th scope="col">Bowler</th>
                    <th scope="col">USBC</th>
                    <th scope="col">Event</th>
                    {showBrackets ? <th scope="col" data-align="right">Brackets</th> : null}
                    <th scope="col">Payment</th>
                    <th scope="col">Checked in</th>
                    <th scope="col" className={styles.signatureCell}>Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.bowlerId}>
                      <td>{row.name}</td>
                      <td className={cells.code}>{row.usbcNumber}</td>
                      <td>{row.events.join(', ')}</td>
                      {showBrackets ? <td data-align="right">{row.brackets}</td> : null}
                      <td>{row.registration.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</td>
                      <td>{row.checkedInAt ? formatCheckInTime(row.checkedInAt) : ''}</td>
                      <td className={styles.signatureCell} />
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </section>
          </>
        )
      ) : null}
    </Page>
  );
}
