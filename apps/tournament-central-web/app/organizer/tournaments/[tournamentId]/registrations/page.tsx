'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownToLine, CircleDollarSign, MoreHorizontal, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardDivider,
  CardHeader,
  DataTable,
  EmptyState,
  FormGrid,
  ICON_SIZE,
  Menu,
  MenuDivider,
  MenuItem,
  Modal,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SearchField,
  SelectField,
  StatGroup,
  TableToolbar,
  TextAreaField,
  TextField,
  useModalFocus,
} from '@bracketworks/ui';

import {
  deleteTournamentEntry,
  markTournamentRegistrationPaid,
  markTournamentRegistrationsPaid,
  updateTournamentEntry,
  type OrganizerRegistrationRecord,
} from '@/components/organizer/organizerApi';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import ConfirmDialog from '@/components/organizer/ConfirmDialog';
import { formatMoney } from '@/components/organizer/organizerFormatting';
import TournamentRegistrationForm from '@/components/public/TournamentRegistrationForm';
import type { RegistrationFormState, RegistrationQuestionAnswerValue } from '@/components/public/TournamentRegistrationForm';
import publicStyles from '@/app/page.module.css';
import styles from './registrations.module.css';

type FilterValue = 'all' | 'confirmed' | 'pending' | 'cancelled';

type RegistrationEntry = NonNullable<OrganizerRegistrationRecord['entries']>[number];
type EditableBowler = NonNullable<RegistrationEntry['bowlers']>[number];
type EntryEditForm = {
  eventConfigId: string;
  eventName: string;
  divisionConfigId: string;
  divisionName: string;
  squadConfigId: string;
  squadName: string;
  squadDate: string;
  squadTime: string;
  status: string;
  entryNumber: string;
  entryFee: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  bowlers: EditableBowler[];
};

type ManualRegistrationEvent = {
  id: string;
  name: string;
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  connectedDivisionIds?: string[];
  connectedSquadIds?: string[];
};

type ManualRegistrationConfig = {
  tournament_id: number;
  tournament_name: string;
  events: ManualRegistrationEvent[];
  divisions: Array<{ id: string; name: string; enabled?: boolean }>;
  squads: Array<{ id: string; name: string; dateIso?: string; startTime?: string }>;
  fields: Array<{ id: string; key: string; label: string; customLabel?: string; mode: 'required' | 'optional' | 'dont-ask'; validation?: string; displayOrder?: number }>;
  questions: Array<{ id: string; label: string; type?: 'short-text' | 'long-text' | 'number' | 'yes-no' | 'dropdown' | 'multiple-choice' | 'checkbox' | 'date'; required: boolean; enabled?: boolean; options?: string[]; displayOrder?: number }>;
};

const EMPTY_MANUAL_REGISTRATION_FORM: RegistrationFormState = {
  bowlers: [{}],
  eventId: '',
  divisionId: '',
  squadId: '',
  notes: '',
  bowlerQuestionAnswers: [{}],
  acceptTerms: false,
};

function requiredBowlersForEvent(event: ManualRegistrationEvent | null): number {
  if (!event) return 1;
  const minPlayers = Number.isFinite(event.minPlayers) ? Number(event.minPlayers) : 1;
  const maxPlayers = Number.isFinite(event.maxPlayers) ? Number(event.maxPlayers) : minPlayers;
  return Math.max(1, minPlayers, maxPlayers);
}

function hasManualQuestionAnswer(answer: RegistrationQuestionAnswerValue | undefined): boolean {
  if (Array.isArray(answer)) return answer.some((value) => value.trim().length > 0);
  if (typeof answer === 'boolean') return true;
  return typeof answer === 'string' && answer.trim().length > 0;
}

function formatSubmittedAt(value: string | undefined): { date: string; time: string } {
  if (!value) return { date: 'Unknown date', time: '' };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: 'Unknown date', time: '' };
  return {
    date: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

function labelStatus(status: string | undefined): string {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function entryLabel(entry: RegistrationEntry, key: 'event' | 'squad'): string {
  if (key === 'event') return entry.event_name || entry.event_config_id;
  return entry.squad_name || entry.squad_config_id || 'Unassigned';
}

export default function OrganizerTournamentRegistrationsPage() {
  const {
    tournamentId,
    tournament,
    registrations,
    refreshRegistrations,
    isRegistrationsLoading,
    tournamentError,
    registrationsError,
  } = useTournamentContext();
  const tournamentName = tournament?.name || 'Tournament';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [squadFilter, setSquadFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ entry: RegistrationEntry; registrationId: number } | null>(null);
  const [editForm, setEditForm] = useState<EntryEditForm | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<RegistrationEntry | null>(null);
  const [isManualRegistrationOpen, setIsManualRegistrationOpen] = useState(false);
  const [manualRegistrationConfig, setManualRegistrationConfig] = useState<ManualRegistrationConfig | null>(null);
  const [manualRegistrationForm, setManualRegistrationForm] = useState<RegistrationFormState>(EMPTY_MANUAL_REGISTRATION_FORM);
  const [isManualRegistrationLoading, setIsManualRegistrationLoading] = useState(false);
  const [isManualRegistrationSubmitting, setIsManualRegistrationSubmitting] = useState(false);
  const [manualRegistrationMessage, setManualRegistrationMessage] = useState<string | null>(null);
  const [manualRegistrationError, setManualRegistrationError] = useState<string | null>(null);
  const pageSize = 10;

  const manualEvents = useMemo(
    () => (manualRegistrationConfig?.events ?? []).filter((event) => event.enabled !== false),
    [manualRegistrationConfig],
  );
  const manualEventsForSquad = useMemo(() => {
    if (!manualRegistrationForm.squadId) return manualEvents;
    const linked = manualEvents.filter((event) => event.connectedSquadIds?.includes(manualRegistrationForm.squadId));
    return linked.length > 0 ? linked : manualEvents;
  }, [manualEvents, manualRegistrationForm.squadId]);
  const manualSelectedEvent = useMemo(
    () => manualEvents.find((event) => event.id === manualRegistrationForm.eventId) ?? manualEventsForSquad[0] ?? null,
    [manualEvents, manualEventsForSquad, manualRegistrationForm.eventId],
  );
  const manualRequiredBowlerCount = requiredBowlersForEvent(manualSelectedEvent);
  const manualDivisions = useMemo(
    () => (manualRegistrationConfig?.divisions ?? []).filter((division) => division.enabled !== false),
    [manualRegistrationConfig],
  );
  const manualDivisionsForEvent = useMemo(() => {
    const connectedIds = new Set(manualSelectedEvent?.connectedDivisionIds ?? []);
    const linked = manualDivisions.filter((division) => connectedIds.has(division.id));
    return linked.length > 0 ? linked : manualDivisions;
  }, [manualDivisions, manualSelectedEvent]);
  const manualSquads = useMemo(() => manualRegistrationConfig?.squads ?? [], [manualRegistrationConfig]);
  const manualSquadsForEvent = useMemo(() => {
    const connectedIds = new Set(manualSelectedEvent?.connectedSquadIds ?? []);
    const linked = manualSquads.filter((squad) => connectedIds.has(squad.id));
    return linked.length > 0 ? linked : manualSquads;
  }, [manualSelectedEvent, manualSquads]);
  const manualFields = useMemo(
    () => (manualRegistrationConfig?.fields ?? [])
      .filter((field) => field.mode !== 'dont-ask')
      .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)),
    [manualRegistrationConfig],
  );
  const manualQuestions = useMemo(
    () => (manualRegistrationConfig?.questions ?? [])
      .filter((question) => question.enabled !== false)
      .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)),
    [manualRegistrationConfig],
  );

  useEffect(() => {
    if (!manualRegistrationConfig) return;
    setManualRegistrationForm((previous) => {
      const eventId = manualEventsForSquad.some((event) => event.id === previous.eventId)
        ? previous.eventId
        : manualEventsForSquad[0]?.id ?? '';
      const event = manualEventsForSquad.find((entry) => entry.id === eventId) ?? null;
      const requiredCount = requiredBowlersForEvent(event);
      const bowlers = Array.from({ length: requiredCount }, (_, index) => previous.bowlers[index] ?? {});
      const answers = Array.from({ length: requiredCount }, (_, index) => previous.bowlerQuestionAnswers[index] ?? {});
      if (
        eventId === previous.eventId
        && bowlers.length === previous.bowlers.length
        && answers.length === previous.bowlerQuestionAnswers.length
      ) {
        return previous;
      }
      return { ...previous, eventId, bowlers, bowlerQuestionAnswers: answers };
    });
  }, [manualEventsForSquad, manualRegistrationConfig]);

  const openManualRegistration = async () => {
    setIsManualRegistrationOpen(true);
    setIsManualRegistrationLoading(true);
    setManualRegistrationConfig(null);
    setManualRegistrationMessage(null);
    setManualRegistrationError(null);

    try {
      const response = await fetch(`/api/v1/public/tc-tournament/${tournamentId}/registration`, { cache: 'no-store' });
      const responseData = await response.json().catch(() => null) as ManualRegistrationConfig & { detail?: string } | null;
      if (!response.ok || !responseData) {
        throw new Error(responseData?.detail || 'Registration is not available for this tournament.');
      }

      setManualRegistrationConfig(responseData);
      const event = responseData.events.find((entry) => entry.enabled !== false) ?? null;
      const requiredCount = requiredBowlersForEvent(event);
      setManualRegistrationForm({
        ...EMPTY_MANUAL_REGISTRATION_FORM,
        eventId: event?.id ?? '',
        divisionId: responseData.divisions.find((entry) => entry.enabled !== false)?.id ?? '',
        squadId: responseData.squads[0]?.id ?? '',
        bowlers: Array.from({ length: requiredCount }, () => ({})),
        bowlerQuestionAnswers: Array.from({ length: requiredCount }, () => ({})),
      });
    } catch (caughtError) {
      setManualRegistrationError(caughtError instanceof Error ? caughtError.message : 'Unable to load registration form.');
    } finally {
      setIsManualRegistrationLoading(false);
    }
  };

  const handleManualRegistrationSubmit = async () => {
    if (!manualRegistrationConfig) return;
    if (!manualRegistrationForm.squadId) {
      setManualRegistrationError('Please select a squad first.');
      return;
    }
    if (manualRegistrationForm.bowlers.length !== manualRequiredBowlerCount) {
      setManualRegistrationError(`This event requires ${manualRequiredBowlerCount} bowler form${manualRequiredBowlerCount === 1 ? '' : 's'}.`);
      return;
    }

    const requiredField = manualFields.find((field) => field.mode === 'required' && manualRegistrationForm.bowlers.some((bowler) => !(bowler[field.key.trim().toLowerCase()] || '').trim()));
    if (requiredField) {
      const bowlerIndex = manualRegistrationForm.bowlers.findIndex((bowler) => !(bowler[requiredField.key.trim().toLowerCase()] || '').trim());
      setManualRegistrationError(`Bowler ${bowlerIndex + 1}: ${requiredField.customLabel || requiredField.label || 'Required field'} is required.`);
      return;
    }
    if (!manualRegistrationForm.acceptTerms) {
      setManualRegistrationError('Please agree to the registration disclosure before submitting.');
      return;
    }

    const missingQuestion = manualQuestions.find((question) => question.required
      && manualRegistrationForm.bowlerQuestionAnswers.some((answers) => !hasManualQuestionAnswer(answers[question.id])));
    if (missingQuestion) {
      const bowlerIndex = manualRegistrationForm.bowlerQuestionAnswers.findIndex((answers) => !hasManualQuestionAnswer(answers[missingQuestion.id]));
      setManualRegistrationError(`Bowler ${Math.max(1, bowlerIndex + 1)}: ${missingQuestion.label || 'Required question'} is required.`);
      return;
    }

    setIsManualRegistrationSubmitting(true);
    setManualRegistrationError(null);
    setManualRegistrationMessage(null);
    try {
      const firstBowler = manualRegistrationForm.bowlers[0] ?? {};
      const response = await fetch(`/api/v1/public/tc-tournament/${tournamentId}/registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          tournamentName: tournamentName,
          submittedAt: new Date().toISOString(),
          form: {
            firstName: firstBowler.first_name || '',
            lastName: firstBowler.last_name || '',
            email: firstBowler.email || '',
            phone: firstBowler.phone || '',
            usbcNumber: firstBowler.usbc_number || '',
            bowlers: manualRegistrationForm.bowlers,
            eventId: manualRegistrationForm.eventId,
            divisionId: manualRegistrationForm.divisionId,
            squadId: manualRegistrationForm.squadId,
            notes: manualRegistrationForm.notes,
            questionAnswers: manualRegistrationForm.bowlerQuestionAnswers[0] || {},
            bowlerQuestionAnswers: manualRegistrationForm.bowlerQuestionAnswers,
            fieldValues: firstBowler,
            acceptTerms: manualRegistrationForm.acceptTerms,
          },
        }),
      });
      const responseData = await response.json().catch(() => null) as { detail?: string } | null;
      if (!response.ok) {
        throw new Error(responseData?.detail || 'Unable to submit registration right now.');
      }

      setManualRegistrationMessage('Registration submitted successfully. The organizer can now review the entry.');
      setManualRegistrationForm({
        ...EMPTY_MANUAL_REGISTRATION_FORM,
        eventId: manualSelectedEvent?.id ?? '',
        divisionId: manualDivisionsForEvent[0]?.id ?? '',
        squadId: manualSquadsForEvent[0]?.id ?? '',
        bowlers: Array.from({ length: manualRequiredBowlerCount }, () => ({})),
        bowlerQuestionAnswers: Array.from({ length: manualRequiredBowlerCount }, () => ({})),
      });
      void refreshRegistrations();
    } catch (caughtError) {
      setManualRegistrationError(caughtError instanceof Error ? caughtError.message : 'Unable to submit registration right now.');
    } finally {
      setIsManualRegistrationSubmitting(false);
    }
  };

  const openEntryEditor = (entry: RegistrationEntry, registration: OrganizerRegistrationRecord) => {
    const registrationId = Number(registration.id);
    setEditingEntry({ entry, registrationId });
    setEditForm({
      eventConfigId: entry.event_config_id,
      eventName: entry.event_name,
      divisionConfigId: entry.division_config_id ?? '',
      divisionName: entry.division_name ?? '',
      squadConfigId: entry.squad_config_id ?? '',
      squadName: entry.squad_name ?? '',
      squadDate: entry.squad_date ?? '',
      squadTime: entry.squad_time ?? '',
      status: entry.status,
      entryNumber: entry.entry_number ? String(entry.entry_number) : '',
      entryFee: String((entry.entry_fee_cents ?? 0) / 100),
      firstName: registration.contact_first_name ?? registration.form?.first_name ?? '',
      lastName: registration.contact_last_name ?? registration.form?.last_name ?? '',
      email: registration.contact_email ?? registration.form?.email ?? '',
      phone: registration.contact_phone ?? registration.form?.phone ?? '',
      notes: registration.notes ?? registration.form?.notes ?? '',
      bowlers: entry.bowlers ?? [],
    });
  };

  const handleSaveEntry = async () => {
    if (!editingEntry || !editForm) return;
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setIsMutating(true);
    try {
      await updateTournamentEntry(token, tournamentId, editingEntry.entry.id, {
        status: editForm.status,
        entry_number: editForm.entryNumber.trim() ? Number(editForm.entryNumber) : undefined,
        event_config_id: editForm.eventConfigId,
        event_name_snapshot: editForm.eventName,
        division_config_id: editForm.divisionConfigId,
        division_name_snapshot: editForm.divisionName,
        squad_config_id: editForm.squadConfigId,
        squad_name_snapshot: editForm.squadName,
        squad_date_snapshot: editForm.squadDate,
        squad_time_snapshot: editForm.squadTime,
        entry_fee_cents: Math.round(Number(editForm.entryFee || 0) * 100),
        contact_first_name: editForm.firstName,
        contact_last_name: editForm.lastName,
        contact_email: editForm.email,
        contact_phone: editForm.phone,
        notes: editForm.notes,
        bowlers: editForm.bowlers,
      });
      await refreshRegistrations();
      setEditingEntry(null);
      setEditForm(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update entry.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteEntry = async (entry: RegistrationEntry) => {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setIsMutating(true);
    try {
      await deleteTournamentEntry(token, tournamentId, entry.id);
      await refreshRegistrations();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete entry.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleMarkPaid = async (registration: OrganizerRegistrationRecord) => {
    const registrationId = Number(registration.id);
    const token = sessionStorage.getItem('access_token');
    if (!token || !Number.isInteger(registrationId)) return;
    setIsMutating(true);
    try {
      await markTournamentRegistrationPaid(token, tournamentId, registrationId);
      await refreshRegistrations();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to mark registration as paid.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token || selectedIds.size === 0) return;
    setIsMutating(true);
    try {
      await markTournamentRegistrationsPaid(token, tournamentId, Array.from(selectedIds));
      await refreshRegistrations();
      setSelectedIds(new Set());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to mark registrations as paid.');
    } finally {
      setIsMutating(false);
    }
  };

  const toggleSelected = (registrationId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(registrationId)) {
        next.delete(registrationId);
      } else {
        next.add(registrationId);
      }
      return next;
    });
  };

  const allEntries = useMemo(
    () => registrations.flatMap((registration) => registration.entries ?? []),
    [registrations],
  );

  const squadOptions = useMemo(
    () => Array.from(new Map(allEntries.map((entry) => [entry.squad_config_id ?? entry.squad_name ?? 'unassigned', entryLabel(entry, 'squad')])).entries()),
    [allEntries],
  );

  const eventOptions = useMemo(
    () => Array.from(new Map(allEntries.map((entry) => [entry.event_config_id, entryLabel(entry, 'event')])).entries()),
    [allEntries],
  );

  const filteredRegistrations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return registrations.filter((registration) => {
      const name = `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim();
      const email = registration.contact_email ?? registration.form?.email ?? '';
      const matchesSearch = !normalizedSearch
        || `${name} ${email} ${registration.confirmation_code ?? registration.id ?? ''}`.toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || registration.status === statusFilter;
      const entries = registration.entries ?? [];
      const matchesSquad = squadFilter === 'all' || entries.some((entry) => (entry.squad_config_id ?? entry.squad_name ?? 'unassigned') === squadFilter);
      const matchesEvent = eventFilter === 'all' || entries.some((entry) => entry.event_config_id === eventFilter);
      return matchesSearch && matchesStatus && matchesSquad && matchesEvent;
    });
  }, [eventFilter, registrations, search, squadFilter, statusFilter]);

  const metrics = useMemo(() => {
    const confirmed = registrations.filter((registration) => registration.status === 'confirmed').length;
    const pending = registrations.filter((registration) => registration.status === 'pending' || registration.status === 'waitlisted').length;
    const cancelled = registrations.filter((registration) => registration.status === 'cancelled' || registration.status === 'refunded').length;
    const paid = registrations.filter((registration) => registration.payment_status === 'paid').reduce((total, registration) => total + (registration.total_cents ?? 0), 0);
    const dates = registrations.map((registration) => registration.submitted_at ? new Date(registration.submitted_at).getTime() : 0).filter(Boolean);
    const days = dates.length > 1 ? Math.max(1, Math.ceil((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1) : 1;
    return {
      total: registrations.length,
      confirmed,
      pending,
      cancelled,
      paid,
      averagePerDay: registrations.length / days,
      confirmedPercent: registrations.length ? (confirmed / registrations.length) * 100 : 0,
      pendingPercent: registrations.length ? (pending / registrations.length) * 100 : 0,
      cancelledPercent: registrations.length ? (cancelled / registrations.length) * 100 : 0,
    };
  }, [registrations]);

  const pageCount = Math.max(1, Math.ceil(filteredRegistrations.length / pageSize));
  const visibleRegistrations = filteredRegistrations.slice((page - 1) * pageSize, page * pageSize);
  const pageStart = filteredRegistrations.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, filteredRegistrations.length);
  const unpaidVisibleIds = useMemo(
    () => visibleRegistrations
      .filter((registration) => (registration.payment_status ?? 'unpaid') !== 'paid' && Number.isInteger(Number(registration.id)))
      .map((registration) => Number(registration.id)),
    [visibleRegistrations],
  );
  useEffect(() => {
    setPage(1);
  }, [eventFilter, search, squadFilter, statusFilter]);

  const exportRegistrations = () => {
    const header = ['Confirmation', 'Contact', 'Email', 'Event', 'Squad', 'Status', 'Payment', 'Total', 'Submitted'];
    const rows = filteredRegistrations.map((registration) => {
      const entry = registration.entries?.[0];
      const submitted = formatSubmittedAt(registration.submitted_at);
      return [
        registration.confirmation_code ?? registration.id ?? '',
        `${registration.contact_first_name ?? ''} ${registration.contact_last_name ?? ''}`.trim(),
        registration.contact_email ?? '',
        entry ? entryLabel(entry, 'event') : '',
        entry ? entryLabel(entry, 'squad') : '',
        labelStatus(registration.status),
        labelStatus(registration.payment_status),
        formatMoney(registration.total_cents, registration.currency),
        `${submitted.date} ${submitted.time}`,
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',');
    });
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-registrations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateEditField = (key: Exclude<keyof EntryEditForm, 'bowlers'>) => (
    event: { target: { value: string } },
  ) => {
    const { value } = event.target;
    setEditForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateBowler = (bowlerId: EditableBowler['id'], changes: Partial<EditableBowler>) => {
    setEditForm((current) => (current
      ? { ...current, bowlers: current.bowlers.map((item) => (item.id === bowlerId ? { ...item, ...changes } : item)) }
      : current));
  };

  const closeManualRegistration = () => setIsManualRegistrationOpen(false);
  const pageError = error || tournamentError || registrationsError;
  const isFormOpen = isManualRegistrationOpen && Boolean(manualRegistrationConfig);

  return (
    <Page>
      <PageHeader
        overline="Tournament registrations"
        title="Registrations"
        description={`Review bowlers, payments, events, and squad assignments for ${tournamentName}.`}
      />

      {pageError ? <Notice tone="danger" role="alert">{pageError}</Notice> : null}
      {isRegistrationsLoading ? <Notice tone="info" role="status">Loading registrations...</Notice> : null}

      {!pageError && !isRegistrationsLoading ? (
        <>
          <StatGroup
            label="Registration summary"
            items={[
              { label: 'Registrations', value: String(metrics.total) },
              { label: 'Confirmed', value: String(metrics.confirmed), detail: `${metrics.confirmedPercent.toFixed(0)}% of total` },
              { label: 'Pending', value: String(metrics.pending), detail: 'Includes waitlisted' },
              { label: 'Cancelled', value: String(metrics.cancelled), detail: `${metrics.cancelledPercent.toFixed(0)}% of total` },
              { label: 'Collected', value: formatMoney(metrics.paid) },
            ]}
          />

          <Card padding="flush" aria-label="Registration list">
            <CardHeader
              title="Registration list"
              description={`${filteredRegistrations.length} of ${metrics.total} registrations shown`}
              actions={(
                <Button
                  variant="primary"
                  icon={<UserPlus size={ICON_SIZE.md} aria-hidden="true" />}
                  onClick={() => { void openManualRegistration(); }}
                  disabled={isManualRegistrationLoading}
                >
                  Manual registration
                </Button>
              )}
            />
            <TableToolbar
              search={(
                <SearchField
                  label="Search registrations"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, email, or confirmation number"
                />
              )}
            >
              <SelectField label="Status" hideLabel value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterValue)}>
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </SelectField>
              <SelectField label="Squad" hideLabel value={squadFilter} onChange={(event) => setSquadFilter(event.target.value)}>
                <option value="all">All squads</option>
                {squadOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
              <SelectField label="Event" hideLabel value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
                <option value="all">All events</option>
                {eventOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
              <Button variant="secondary" icon={<ArrowDownToLine size={ICON_SIZE.md} aria-hidden="true" />} onClick={exportRegistrations}>
                Export
              </Button>
            </TableToolbar>

            {selectedIds.size > 0 ? (
              <div className={styles.selectionBar} role="status">
                <span>{selectedIds.size} selected</span>
                <Button size="sm" variant="secondary" icon={<CircleDollarSign size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleBulkMarkPaid} disabled={isMutating}>
                  Mark {selectedIds.size} as paid
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
              </div>
            ) : null}

            {visibleRegistrations.length === 0 ? (
              <EmptyState
                icon={<Users size={ICON_SIZE['2xl']} aria-hidden="true" />}
                title={metrics.total === 0 ? 'No registrations yet' : 'No registrations match these filters'}
                description={metrics.total === 0 ? 'Registrations appear here as bowlers sign up.' : 'Try a different search or clear the filters.'}
              />
            ) : (
              <DataTable caption="Registrations" className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">
                      <input
                        type="checkbox"
                        aria-label="Select all unpaid registrations on this page"
                        checked={unpaidVisibleIds.length > 0 && unpaidVisibleIds.every((id) => selectedIds.has(id))}
                        onChange={(event) => {
                          const { checked } = event.target;
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            unpaidVisibleIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
                            return next;
                          });
                        }}
                        disabled={unpaidVisibleIds.length === 0}
                      />
                    </th>
                    <th scope="col">Confirmation</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Events</th>
                    <th scope="col">Squad</th>
                    <th scope="col">Status</th>
                    <th scope="col">Payment</th>
                    <th scope="col" data-align="right">Total</th>
                    <th scope="col" aria-sort="descending">Submitted</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRegistrations.map((registration) => {
                    const entry = registration.entries?.[0];
                    const entries = registration.entries ?? [];
                    const submitted = formatSubmittedAt(registration.submitted_at);
                    const name = `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim() || 'Unnamed bowler';
                    const payment = registration.payment_status ?? 'unpaid';
                    const registrationId = Number(registration.id);
                    const isSelected = selectedIds.has(registrationId);
                    return (
                      <tr key={registration.id} aria-selected={isSelected || undefined}>
                        <td>
                          {payment !== 'paid' && Number.isInteger(registrationId) ? (
                            <input
                              type="checkbox"
                              aria-label={`Select registration for ${name}`}
                              checked={isSelected}
                              onChange={() => toggleSelected(registrationId)}
                            />
                          ) : null}
                        </td>
                        <td className={styles.code}>{registration.confirmation_code ?? registration.id}</td>
                        <td>
                          <span className={styles.stack}>
                            <span className={styles.primaryText}>{name}</span>
                            <span className={styles.secondaryText}>{registration.contact_email ?? registration.form?.email ?? 'No email'}</span>
                          </span>
                        </td>
                        <td>{entries.map((item) => entryLabel(item, 'event')).join(', ') || 'Not selected'}</td>
                        <td>{entry ? entryLabel(entry, 'squad') : 'Not selected'}</td>
                        <td><OrganizerStatusBadge status={registration.status ?? 'pending'} /></td>
                        <td><OrganizerStatusBadge status={payment} /></td>
                        <td data-align="right">{formatMoney(registration.total_cents, registration.currency)}</td>
                        <td>
                          <span className={styles.stack}>
                            <span>{submitted.date}</span>
                            <span className={styles.secondaryText}>{submitted.time}</span>
                          </span>
                        </td>
                        <td data-align="right">
                          {entries.length > 0 || payment !== 'paid' ? (
                            <Menu triggerLabel={`More actions for ${name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                              {entries.map((registrationEntry) => (
                                <MenuItem
                                  key={`edit-${registrationEntry.id}`}
                                  icon={<Pencil size={ICON_SIZE.md} />}
                                  onSelect={() => Number.isInteger(registrationId) && openEntryEditor(registrationEntry, registration)}
                                  disabled={isMutating}
                                >
                                  {entries.length > 1 ? `Edit ${entryLabel(registrationEntry, 'event')}` : 'Edit entry'}
                                </MenuItem>
                              ))}
                              {payment !== 'paid' ? (
                                <MenuItem icon={<CircleDollarSign size={ICON_SIZE.md} />} onSelect={() => { void handleMarkPaid(registration); }} disabled={isMutating}>
                                  Mark as paid
                                </MenuItem>
                              ) : null}
                              {entries.length > 0 ? <MenuDivider /> : null}
                              {entries.map((registrationEntry) => (
                                <MenuItem
                                  key={`delete-${registrationEntry.id}`}
                                  tone="danger"
                                  icon={<Trash2 size={ICON_SIZE.md} />}
                                  onSelect={() => setPendingDeleteEntry(registrationEntry)}
                                  disabled={isMutating}
                                >
                                  {entries.length > 1 ? `Delete ${entryLabel(registrationEntry, 'event')}` : 'Delete entry'}
                                </MenuItem>
                              ))}
                            </Menu>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            )}

            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              summary={`Showing ${pageStart}-${pageEnd} of ${filteredRegistrations.length}`}
            />
          </Card>
        </>
      ) : null}

      {isFormOpen && manualRegistrationConfig ? (
        <ManualRegistrationSurface onClose={closeManualRegistration} label={`Manual registration for ${tournamentName}`}>
          <TournamentRegistrationForm
            tournamentName={manualRegistrationConfig.tournament_name || tournamentName}
            tournamentDate={[tournament?.start_date, tournament?.end_date].filter(Boolean).join(' - ')}
            tournamentLocation={tournament?.location || 'TBD'}
            tournamentLogoUrl={tournament?.has_logo ? `/api/v1/tc/tournaments/${tournamentId}/logo` : null}
            squads={manualSquadsForEvent}
            events={manualEventsForSquad}
            divisions={manualDivisionsForEvent}
            fields={manualFields}
            questions={manualQuestions}
            requiredBowlerCount={manualRequiredBowlerCount}
            formState={manualRegistrationForm}
            setFormState={setManualRegistrationForm}
            submitMessage={manualRegistrationError || manualRegistrationMessage}
            isSubmitting={isManualRegistrationSubmitting}
            onSubmit={() => { void handleManualRegistrationSubmit(); }}
            onClose={closeManualRegistration}
            footerHint="Entered by tournament staff on behalf of the participant."
          />
        </ManualRegistrationSurface>
      ) : null}

      <Modal
        open={isManualRegistrationOpen && !manualRegistrationConfig}
        onClose={closeManualRegistration}
        title="Manual registration"
        size="sm"
        closeLabel="Close manual registration"
        footer={!isManualRegistrationLoading ? <Button variant="secondary" onClick={closeManualRegistration}>Close</Button> : undefined}
      >
        {isManualRegistrationLoading
          ? <p className={styles.bodyText}>Loading registration settings...</p>
          : <Notice tone="danger" role="alert">{manualRegistrationError || 'Registration settings are unavailable.'}</Notice>}
      </Modal>

      <Modal
        open={Boolean(editingEntry && editForm)}
        onClose={() => setEditingEntry(null)}
        title={editingEntry ? `Edit entry: ${entryLabel(editingEntry.entry, 'event')}` : 'Edit entry'}
        size="lg"
        closeLabel="Close edit entry dialog"
        dismissible={!isMutating}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditingEntry(null)} disabled={isMutating}>Cancel</Button>
            <Button variant="primary" onClick={() => { void handleSaveEntry(); }} disabled={isMutating}>
              {isMutating ? 'Saving...' : 'Save entry'}
            </Button>
          </>
        )}
      >
        {editForm ? (
          <div className={styles.editForm}>
            <section className={styles.editSection} aria-labelledby="edit-entry-contact">
              <h3 id="edit-entry-contact" className={styles.subsectionTitle}>Contact</h3>
              <FormGrid>
                <TextField label="First name" value={editForm.firstName} onChange={updateEditField('firstName')} />
                <TextField label="Last name" value={editForm.lastName} onChange={updateEditField('lastName')} />
                <TextField label="Email" type="email" value={editForm.email} onChange={updateEditField('email')} />
                <TextField label="Phone" value={editForm.phone} onChange={updateEditField('phone')} />
              </FormGrid>
            </section>
            <CardDivider />
            <section className={styles.editSection} aria-labelledby="edit-entry-competition">
              <h3 id="edit-entry-competition" className={styles.subsectionTitle}>Competition entry</h3>
              <FormGrid>
                <TextField label="Event name" value={editForm.eventName} onChange={updateEditField('eventName')} />
                <TextField label="Event ID" value={editForm.eventConfigId} onChange={updateEditField('eventConfigId')} />
                <TextField label="Division name" value={editForm.divisionName} onChange={updateEditField('divisionName')} />
                <TextField label="Division ID" value={editForm.divisionConfigId} onChange={updateEditField('divisionConfigId')} />
                <TextField label="Squad name" value={editForm.squadName} onChange={updateEditField('squadName')} />
                <TextField label="Squad ID" value={editForm.squadConfigId} onChange={updateEditField('squadConfigId')} />
                <TextField label="Squad date" value={editForm.squadDate} onChange={updateEditField('squadDate')} />
                <TextField label="Squad time" value={editForm.squadTime} onChange={updateEditField('squadTime')} />
                <SelectField label="Status" value={editForm.status} onChange={updateEditField('status')}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="waitlisted">Waitlisted</option>
                  <option value="cancelled">Cancelled</option>
                </SelectField>
                <TextField label="Entry number" optional type="number" min="1" value={editForm.entryNumber} onChange={updateEditField('entryNumber')} placeholder="Not assigned" />
                <TextField label="Entry fee" type="number" min="0" step="0.01" value={editForm.entryFee} onChange={updateEditField('entryFee')} />
              </FormGrid>
            </section>
            <CardDivider />
            <section className={styles.editSection} aria-labelledby="edit-entry-notes">
              <h3 id="edit-entry-notes" className={styles.subsectionTitle}>Notes</h3>
              <TextAreaField label="Notes" hideLabel optional value={editForm.notes} onChange={updateEditField('notes')} rows={3} />
            </section>
            {editForm.bowlers.map((bowler, index) => (
              <section key={bowler.id} className={styles.editSection} aria-labelledby={`edit-entry-bowler-${bowler.id}`}>
                <CardDivider />
                <h3 id={`edit-entry-bowler-${bowler.id}`} className={styles.subsectionTitle}>Bowler {index + 1}</h3>
                <FormGrid>
                  <TextField label="First name" value={bowler.first_name} onChange={(event) => updateBowler(bowler.id, { first_name: event.target.value })} />
                  <TextField label="Last name" value={bowler.last_name} onChange={(event) => updateBowler(bowler.id, { last_name: event.target.value })} />
                  <TextField label="Email" optional value={bowler.email ?? ''} onChange={(event) => updateBowler(bowler.id, { email: event.target.value })} />
                  <TextField label="Phone" optional value={bowler.phone ?? ''} onChange={(event) => updateBowler(bowler.id, { phone: event.target.value })} />
                  <TextField label="USBC number" optional value={bowler.usbc_number ?? ''} onChange={(event) => updateBowler(bowler.id, { usbc_number: event.target.value })} />
                  <TextField
                    label="Average"
                    optional
                    type="number"
                    value={bowler.average ?? ''}
                    onChange={(event) => updateBowler(bowler.id, { average: event.target.value ? Number(event.target.value) : null })}
                  />
                </FormGrid>
              </section>
            ))}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDeleteEntry)}
        title="Delete this entry?"
        message="This cannot be undone."
        confirmLabel="Delete entry"
        tone="danger"
        onConfirm={() => {
          if (pendingDeleteEntry) void handleDeleteEntry(pendingDeleteEntry);
          setPendingDeleteEntry(null);
        }}
        onCancel={() => setPendingDeleteEntry(null)}
      />
    </Page>
  );
}

/**
 * Frame for the shared registration form, which draws its own header and footer. It matches the
 * public site's registration dialog; both move to the shared Modal when the public pages migrate.
 */
function ManualRegistrationSurface({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  return (
    <div className={publicStyles.detailsModalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className={publicStyles.registrationModalCard} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </section>
    </div>
  );
}
