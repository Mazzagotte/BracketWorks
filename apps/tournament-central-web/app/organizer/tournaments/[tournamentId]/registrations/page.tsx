'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, CircleDollarSign, Mail, MoreHorizontal, Pencil, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardDivider,
  CardHeader,
  CheckboxField,
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
  SegmentedControl,
  SelectField,
  StatGroup,
  TableToolbar,
  TextAreaField,
  TextField,
} from '@bracketworks/ui';

import {
  deleteTournamentEntry,
  markTournamentRegistrationsPaid,
  updateTournamentEntry,
  type OrganizerRegistrationRecord,
} from '@/components/organizer/organizerApi';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import ConfirmDialog from '@/components/organizer/ConfirmDialog';
import { formatMoney, formatSquadTime, formatTournamentDate } from '@/components/organizer/organizerFormatting';
import { loadOrganizerSetupState } from '@/components/organizer/organizerApi';
import type { DivisionConfig, EventConfig, SquadConfig } from '@/components/organizer/types';
import { buildParticipantRows, buildSquadSummaries } from '@/components/organizer/tournamentInsights';
import { usePaymentToggle } from '@/components/organizer/usePaymentToggle';
import EmailBowlersModal from '@/components/organizer/EmailBowlersModal';
import {
  loadTournamentSquads,
  promoteWaitlistedRegistration,
  resendRegistrationConfirmation,
} from '@/components/organizer/messagesApi';
import TournamentRegistrationForm from '@/components/public/TournamentRegistrationForm';
import type { RegistrationFormState, RegistrationQuestionAnswerValue } from '@/components/public/TournamentRegistrationForm';
import { sideEventPayload, summarizeSideEvents, type PublicFeeConfig } from '@/components/public/registrationSideEvents';
import styles from './registrations.module.css';
import cells from '@/components/organizer/OrganizerTable.module.css';

type FilterValue = 'all' | 'confirmed' | 'pending' | 'waitlisted' | 'cancelled';
type PaymentFilter = 'all' | 'unpaid' | 'paid';
type ListView = 'registrations' | 'bowlers';

/** Events, divisions, and squads from setup, so an entry can be moved by picking from lists instead of typing IDs. */
type EntryOptions = { events: EventConfig[]; divisions: DivisionConfig[]; squads: SquadConfig[] };

function squadOptionLabel(squad: Pick<SquadConfig, 'name' | 'dateIso' | 'startTime'>): string {
  const when = [squad.dateIso ? formatTournamentDate(squad.dateIso) : '', squad.startTime ? formatSquadTime(squad.startTime) : '']
    .filter(Boolean).join(' · ');
  return when && squad.name && !squad.name.includes(formatSquadTime(squad.startTime)) ? `${squad.name} (${when})` : when || squad.name;
}

const EMPTY_CELL = '—';

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
  entryFeeCents?: number;
  rules?: unknown;
};

type ManualRegistrationConfig = {
  tournament_id: number;
  tournament_name: string;
  events: ManualRegistrationEvent[];
  divisions: Array<{
    id: string;
    name: string;
    enabled?: boolean;
    minAverage?: number | null;
    maxAverage?: number | null;
    minAge?: number | null;
    maxAge?: number | null;
    rules?: unknown;
  }>;
  fees?: PublicFeeConfig[];
  start_date?: string | null;
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

type SideEventRecord = NonNullable<OrganizerRegistrationRecord['side_events']>[number];

/** "Brackets x5, High game": one name per side event, quantities added across bowlers. */
function summarizeRecords(records: SideEventRecord[]): string {
  const totals = new Map<string, number>();
  records.forEach((record) => totals.set(record.name, (totals.get(record.name) ?? 0) + record.quantity));
  return summarizeSideEvents([...totals.entries()].map(([name, quantity]) => ({ name, quantity })));
}

function labelStatus(status: string | undefined): string {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function entryLabel(entry: RegistrationEntry, key: 'event' | 'squad'): string {
  if (key === 'event') return entry.event_name || entry.event_config_id;
  return entry.squad_name || entry.squad_config_id || 'Unassigned';
}

function registrationName(registration: OrganizerRegistrationRecord): string {
  return `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim() || 'Unnamed bowler';
}

/** Squads that would go over capacity if this waitlisted registration were confirmed. */
function capacityWarnings(
  registration: OrganizerRegistrationRecord,
  squads: SquadConfig[],
  registrations: OrganizerRegistrationRecord[],
): string[] {
  const summaries = buildSquadSummaries(squads, registrations);
  const warnings: string[] = [];
  for (const entry of registration.entries ?? []) {
    if (entry.status !== 'waitlisted' || !entry.squad_config_id) continue;
    const summary = summaries.find((item) => item.squad.id === entry.squad_config_id);
    if (!summary || summary.squad.capacity <= 0) continue;
    if (summary.bowlerCount + entry.bowler_count > summary.squad.capacity) {
      const squadName = summary.squad.name || entryLabel(entry, 'squad');
      const open = Math.max(summary.squad.capacity - summary.bowlerCount, 0);
      const state = open === 0
        ? `is full (${summary.bowlerCount} of ${summary.squad.capacity} bowlers)`
        : `has ${open} open spot${open === 1 ? '' : 's'}`;
      warnings.push(`${squadName} ${state}. Confirming this registration puts it over capacity.`);
    }
  }
  return warnings;
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
    squads: contextSquads,
  } = useTournamentContext();
  const tournamentName = tournament?.name || 'Tournament';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [squadFilter, setSquadFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [view, setView] = useState<ListView>('registrations');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ entry: RegistrationEntry; registrationId: number } | null>(null);
  const [editForm, setEditForm] = useState<EntryEditForm | null>(null);
  const [entryOptions, setEntryOptions] = useState<EntryOptions | null>(null);
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
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [rowMessage, setRowMessage] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<OrganizerRegistrationRecord | null>(null);
  const [promoteNotify, setPromoteNotify] = useState(true);
  const [promoteWarnings, setPromoteWarnings] = useState<string[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const pageSize = 10;
  const payments = usePaymentToggle({ tournamentId, refreshRegistrations });

  const handleResendConfirmation = async (registration: OrganizerRegistrationRecord) => {
    setRowMessage(null);
    setRowError(null);
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setRowError('Your session expired. Please sign in again.');
      return;
    }
    const registrationId = Number(registration.id);
    if (!Number.isInteger(registrationId)) {
      setRowError('This registration has an invalid ID. Reload the page and try again.');
      return;
    }
    try {
      const response = await resendRegistrationConfirmation(token, tournamentId, registrationId);
      if (response.sent) {
        setRowMessage(`Confirmation sent to ${registration.contact_email || registrationName(registration)}.`);
      } else {
        setRowError('The confirmation email could not be sent. Check the contact email and try again in a few minutes.');
      }
    } catch (caughtError) {
      setRowError(caughtError instanceof Error ? caughtError.message : 'Unable to send the confirmation email.');
    }
  };

  const openPromote = async (registration: OrganizerRegistrationRecord) => {
    setRowMessage(null);
    setRowError(null);
    setPromoteError(null);
    setPromoteNotify(true);
    setPromoteWarnings([]);
    setPromoteTarget(registration);
    let squads = contextSquads ?? [];
    if (squads.length === 0) {
      const token = sessionStorage.getItem('access_token');
      // Capacity is advisory: if squad settings cannot load, the dialog still works without the warning.
      squads = token ? await loadTournamentSquads(token, tournamentId).catch(() => []) : [];
    }
    setPromoteWarnings(capacityWarnings(registration, squads, registrations));
  };

  const handlePromote = async () => {
    if (!promoteTarget) return;
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setPromoteError('Your session expired. Please sign in again.');
      return;
    }
    const registrationId = Number(promoteTarget.id);
    if (!Number.isInteger(registrationId)) {
      setPromoteError('This registration has an invalid ID. Reload the page and try again.');
      return;
    }
    setIsPromoting(true);
    setPromoteError(null);
    try {
      const response = await promoteWaitlistedRegistration(token, tournamentId, registrationId, promoteNotify);
      const reference = promoteTarget.confirmation_code ?? registrationName(promoteTarget);
      let emailNote = '';
      if (promoteNotify) {
        emailNote = response.notified ? ' The bowler was emailed.' : ' The email to the bowler could not be sent.';
      }
      setPromoteTarget(null);
      setRowMessage(`${reference} moved off the waitlist.${emailNote}`);
      try {
        await refreshRegistrations();
      } catch {
        setRowError('The registration was confirmed, but the list could not be refreshed. Reload the page to see it.');
      }
    } catch (caughtError) {
      setPromoteError(caughtError instanceof Error ? caughtError.message : 'Unable to move this registration off the waitlist.');
    } finally {
      setIsPromoting(false);
    }
  };

  // Links from other pages open a view directly: ?view=bowlers or ?payment=unpaid.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'bowlers') setView('bowlers');
    const payment = params.get('payment');
    if (payment === 'unpaid' || payment === 'paid') setPaymentFilter(payment);
  }, []);

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
      const overrideEligibility = Boolean(manualRegistrationForm.overrideEligibility);
      const token = sessionStorage.getItem('access_token');
      if (overrideEligibility && !token) {
        throw new Error('Your session expired. Sign in again to register a bowler anyway.');
      }
      const response = await fetch(`/api/v1/public/tc-tournament/${tournamentId}/registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(overrideEligibility && token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
            side_events: sideEventPayload(manualRegistrationForm.sideEvents),
            override_eligibility: overrideEligibility,
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
    setEntryOptions(null);
    const token = sessionStorage.getItem('access_token');
    if (token) {
      void loadOrganizerSetupState<Partial<EntryOptions>>(token, tournamentId)
        .then((state) => {
          const payload = state?.payload;
          if (!payload) return;
          setEntryOptions({
            events: (payload.events ?? []).filter((event) => event.enabled !== false),
            divisions: (payload.divisions ?? []).filter((division) => division.enabled !== false),
            squads: payload.squads ?? [],
          });
        })
        // Without setup lists the selects still show the entry's current values.
        .catch(() => setEntryOptions({ events: [], divisions: [], squads: [] }));
    }
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

  const emailSquadOptions = useMemo(
    () => squadOptions.filter(([value]) => allEntries.some((entry) => entry.squad_config_id === value)),
    [allEntries, squadOptions],
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
      const payment = registration.payment_status ?? 'unpaid';
      const matchesPayment = paymentFilter === 'all'
        || (paymentFilter === 'paid' ? payment === 'paid' : payment !== 'paid' && registration.status !== 'cancelled' && registration.status !== 'refunded');
      return matchesSearch && matchesStatus && matchesSquad && matchesEvent && matchesPayment;
    });
  }, [eventFilter, paymentFilter, registrations, search, squadFilter, statusFilter]);


  const sideEventsByBowler = useMemo(() => {
    const byBowler = new Map<number, SideEventRecord[]>();
    registrations.forEach((registration) => (registration.side_events ?? []).forEach((record) => {
      if (record.bowler_id === null) return;
      byBowler.set(record.bowler_id, [...(byBowler.get(record.bowler_id) ?? []), record]);
    }));
    return byBowler;
  }, [registrations]);
  const hasSideEvents = useMemo(() => registrations.some((registration) => (registration.side_events ?? []).length > 0), [registrations]);

  // The bowler view lists each person once, across every registration that matches the filters.
  const bowlerRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    // Search applies to each bowler here (team events list several bowlers per registration).
    const withoutSearch = registrations.filter((registration) => {
      const entries = registration.entries ?? [];
      const payment = registration.payment_status ?? 'unpaid';
      return (statusFilter === 'all' || registration.status === statusFilter)
        && (squadFilter === 'all' || entries.some((entry) => (entry.squad_config_id ?? entry.squad_name ?? 'unassigned') === squadFilter))
        && (eventFilter === 'all' || entries.some((entry) => entry.event_config_id === eventFilter))
        && (paymentFilter === 'all' || (paymentFilter === 'paid' ? payment === 'paid' : payment !== 'paid'));
    });
    return buildParticipantRows(withoutSearch).filter((row) => !normalizedSearch
      || [row.firstName, row.lastName, row.usbcNumber ?? '', row.email ?? ''].join(' ').toLowerCase().includes(normalizedSearch));
  }, [eventFilter, paymentFilter, registrations, search, squadFilter, statusFilter]);

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
  }, [eventFilter, paymentFilter, search, squadFilter, statusFilter]);

  const exportRegistrations = () => {
    const header = ['Confirmation', 'Contact', 'Email', 'Event', 'Squad', 'Status', 'Payment', 'Entry fees', 'Side events', 'Side events total', 'Total', 'Submitted'];
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
        formatMoney(registration.subtotal_cents ?? registration.total_cents, registration.currency),
        summarizeRecords(registration.side_events ?? []),
        formatMoney(registration.fees_cents ?? 0, registration.currency),
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

  const selectEvent = (eventId: string) => {
    const event = entryOptions?.events.find((item) => item.id === eventId);
    setEditForm((current) => (current && event ? { ...current, eventConfigId: event.id, eventName: event.name } : current));
  };
  const selectDivision = (divisionId: string) => {
    const division = entryOptions?.divisions.find((item) => item.id === divisionId);
    setEditForm((current) => (current
      ? { ...current, divisionConfigId: division?.id ?? '', divisionName: division?.name ?? '' }
      : current));
  };
  const selectSquad = (squadId: string) => {
    const squad = entryOptions?.squads.find((item) => item.id === squadId);
    setEditForm((current) => (current && squad
      ? { ...current, squadConfigId: squad.id, squadName: squad.name, squadDate: squad.dateIso ?? '', squadTime: squad.startTime ?? '' }
      : current));
  };
  const squadSpotsLeft = (squadId: string): number | null => {
    const squad = entryOptions?.squads.find((item) => item.id === squadId);
    if (!squad || !(squad.capacity > 0)) return null;
    const taken = registrations.flatMap((registration) => registration.entries ?? [])
      .filter((entry) => entry.squad_config_id === squadId && entry.status !== 'cancelled' && entry.status !== 'waitlisted'
        && entry.id !== editingEntry?.entry.id)
      .reduce((total, entry) => total + Math.max(1, entry.bowlers?.length ?? 1), 0);
    return squad.capacity - taken;
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
        actions={!pageError && !isRegistrationsLoading ? (
          <>
            <Button
              variant="secondary"
              icon={<Mail size={ICON_SIZE.md} aria-hidden="true" />}
              onClick={() => setIsEmailOpen(true)}
            >
              Email bowlers
            </Button>
            <Button variant="secondary" icon={<ArrowDownToLine size={ICON_SIZE.md} aria-hidden="true" />} onClick={exportRegistrations}>
              Export
            </Button>
            <Button
              variant="primary"
              icon={<UserPlus size={ICON_SIZE.md} aria-hidden="true" />}
              onClick={() => { void openManualRegistration(); }}
              disabled={isManualRegistrationLoading}
            >
              Manual registration
            </Button>
          </>
        ) : undefined}
      />

      {payments.confirmationDialog}
      {pageError ? <Notice tone="danger" role="alert">{pageError}</Notice> : null}
      {payments.actionError ? <Notice tone="danger" role="alert">{payments.actionError}</Notice> : null}
      {payments.message ? <Notice tone="success" role="status">{payments.message}</Notice> : null}
      {rowError ? <Notice tone="danger" role="alert">{rowError}</Notice> : null}
      {rowMessage ? <Notice tone="success" role="status">{rowMessage}</Notice> : null}
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
            ]}
          />

          <Card padding="flush" aria-label={view === 'bowlers' ? 'Bowler list' : 'Registration list'}>
            <CardHeader
              title={view === 'bowlers' ? 'Bowler list' : 'Registration list'}
              description={view === 'bowlers'
                ? `${bowlerRows.length} bowler${bowlerRows.length === 1 ? '' : 's'} shown`
                : `${filteredRegistrations.length} of ${metrics.total} registrations shown`}
              actions={(
                <SegmentedControl
                  label="List by"
                  value={view}
                  onChange={setView}
                  options={[{ value: 'registrations', label: 'Registrations' }, { value: 'bowlers', label: 'Bowlers' }]}
                />
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
                <option value="waitlisted">Waitlisted</option>
                <option value="cancelled">Cancelled</option>
              </SelectField>
              <SelectField label="Payment" hideLabel value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}>
                <option value="all">All payments</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </SelectField>
              <SelectField label="Squad" hideLabel value={squadFilter} onChange={(event) => setSquadFilter(event.target.value)}>
                <option value="all">All squads</option>
                {squadOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
              <SelectField label="Event" hideLabel value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
                <option value="all">All events</option>
                {eventOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
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

            {view === 'bowlers' ? (
              bowlerRows.length === 0 ? (
                <EmptyState
                  icon={<Users size={ICON_SIZE['2xl']} aria-hidden="true" />}
                  title={metrics.total === 0 ? 'No bowlers yet' : 'No bowlers match these filters'}
                  description={metrics.total === 0 ? 'Bowlers appear here once they register.' : 'Try a different search or clear the filters.'}
                />
              ) : (
                <DataTable caption="Bowlers" className={cells.nowrap}>
                  <thead>
                    <tr>
                      <th scope="col">Bowler</th>
                      <th scope="col">USBC number</th>
                      <th scope="col" data-align="right">Average</th>
                      <th scope="col">Events</th>
                      <th scope="col">Divisions</th>
                      <th scope="col">Squads</th>
                      <th scope="col" data-align="right">Entries</th>
                      {hasSideEvents ? <th scope="col">Side events</th> : null}
                      <th scope="col">Payment</th>
                      <th scope="col">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bowlerRows.map((bowler) => (
                      <tr key={bowler.key}>
                        <td className={cells.primaryText}>{`${bowler.firstName} ${bowler.lastName}`.trim()}</td>
                        <td className={cells.code}>{bowler.usbcNumber || EMPTY_CELL}</td>
                        <td data-align="right">{bowler.average ?? EMPTY_CELL}</td>
                        <td>{bowler.events.join(', ') || EMPTY_CELL}</td>
                        <td>{bowler.divisions.join(', ') || EMPTY_CELL}</td>
                        <td>{bowler.squads.join(', ') || EMPTY_CELL}</td>
                        <td data-align="right">{bowler.entryCount}</td>
                        {hasSideEvents ? (
                          <td>{summarizeRecords(bowler.bowlerIds.flatMap((id) => sideEventsByBowler.get(id) ?? [])) || EMPTY_CELL}</td>
                        ) : null}
                        <td><OrganizerStatusBadge status={bowler.paymentStatus} /></td>
                        <td data-tone="secondary">{bowler.email || bowler.phone || EMPTY_CELL}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )
            ) : visibleRegistrations.length === 0 ? (
              <EmptyState
                icon={<Users size={ICON_SIZE['2xl']} aria-hidden="true" />}
                title={metrics.total === 0 ? 'No registrations yet' : 'No registrations match these filters'}
                description={metrics.total === 0 ? 'Registrations appear here as bowlers sign up.' : 'Try a different search or clear the filters.'}
              />
            ) : (
              <DataTable caption="Registrations" className={cells.nowrap}>
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
                        <td className={cells.code}>{registration.confirmation_code ?? registration.id}</td>
                        <td>
                          <span className={cells.stack}>
                            <span className={cells.primaryText}>{name}</span>
                            <span className={cells.secondaryText}>{registration.contact_email ?? registration.form?.email ?? 'No email'}</span>
                          </span>
                        </td>
                        <td>
                          {(registration.side_events ?? []).length > 0 ? (
                            <span className={cells.stack}>
                              <span>{entries.map((item) => entryLabel(item, 'event')).join(', ') || 'Not selected'}</span>
                              <span className={cells.secondaryText}>{summarizeRecords(registration.side_events ?? [])}</span>
                            </span>
                          ) : entries.map((item) => entryLabel(item, 'event')).join(', ') || 'Not selected'}
                        </td>
                        <td>{entry ? entryLabel(entry, 'squad') : 'Not selected'}</td>
                        <td><OrganizerStatusBadge status={registration.status ?? 'pending'} /></td>
                        <td>{payments.renderPaymentCell(registration)}</td>
                        <td data-align="right">{formatMoney(registration.total_cents, registration.currency)}</td>
                        <td>
                          <span className={cells.stack}>
                            <span>{submitted.date}</span>
                            <span className={cells.secondaryText}>{submitted.time}</span>
                          </span>
                        </td>
                        <td data-align="right">
                          {entries.length > 0 || Number.isInteger(registrationId) ? (
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
                              <MenuItem
                                icon={<Mail size={ICON_SIZE.md} />}
                                onSelect={() => { void handleResendConfirmation(registration); }}
                                disabled={isMutating}
                              >
                                Resend confirmation
                              </MenuItem>
                              {registration.status === 'waitlisted' ? (
                                <MenuItem
                                  icon={<UserCheck size={ICON_SIZE.md} />}
                                  onSelect={() => { void openPromote(registration); }}
                                  disabled={isMutating}
                                >
                                  Move off waitlist
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

            {view === 'registrations' ? <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              summary={`Showing ${pageStart}-${pageEnd} of ${filteredRegistrations.length}`}
            /> : null}
          </Card>
        </>
      ) : null}

      {isFormOpen && manualRegistrationConfig ? (
        <TournamentRegistrationForm
          tournamentName={manualRegistrationConfig.tournament_name || tournamentName}
          tournamentDate={[tournament?.start_date, tournament?.end_date].filter(Boolean).join(' - ')}
          tournamentLocation={tournament?.location || 'TBD'}
          tournamentLogoUrl={tournament?.has_logo ? `/api/v1/tc/tournaments/${tournamentId}/logo` : null}
          squads={manualSquadsForEvent}
          events={manualEventsForSquad}
          divisions={manualDivisionsForEvent}
          fields={manualFields}
          fees={manualRegistrationConfig.fees}
          startDate={manualRegistrationConfig.start_date}
          eligibility="warn"
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
                {entryOptions ? (
                  <>
                    <SelectField label="Event" value={editForm.eventConfigId} onChange={(event) => selectEvent(event.target.value)}>
                      {entryOptions.events.some((item) => item.id === editForm.eventConfigId) ? null : (
                        <option value={editForm.eventConfigId}>{editForm.eventName || 'Current event'}</option>
                      )}
                      {entryOptions.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </SelectField>
                    <SelectField label="Division" optional value={editForm.divisionConfigId} onChange={(event) => selectDivision(event.target.value)}>
                      <option value="">No division</option>
                      {editForm.divisionConfigId && !entryOptions.divisions.some((item) => item.id === editForm.divisionConfigId) ? (
                        <option value={editForm.divisionConfigId}>{editForm.divisionName || 'Current division'}</option>
                      ) : null}
                      {entryOptions.divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </SelectField>
                    <SelectField
                      label="Squad"
                      fullRow
                      value={editForm.squadConfigId}
                      onChange={(event) => selectSquad(event.target.value)}
                      helper={(() => {
                        const left = squadSpotsLeft(editForm.squadConfigId);
                        if (left === null) return 'Moving an entry keeps its payment and confirmation number.';
                        return left > 0
                          ? `${left} bowler spot${left === 1 ? '' : 's'} left in this squad.`
                          : 'This squad is full. Saving will go over capacity.';
                      })()}
                    >
                      {editForm.squadConfigId && !entryOptions.squads.some((item) => item.id === editForm.squadConfigId) ? (
                        <option value={editForm.squadConfigId}>{editForm.squadName || 'Current squad'}</option>
                      ) : null}
                      {!editForm.squadConfigId ? <option value="">Not assigned</option> : null}
                      {entryOptions.squads.map((item) => <option key={item.id} value={item.id}>{squadOptionLabel(item)}</option>)}
                    </SelectField>
                  </>
                ) : (
                  <>
                    <TextField label="Event" value={editForm.eventName} readOnly helper="Loading events, divisions, and squads..." />
                    <TextField label="Squad" value={editForm.squadName} readOnly />
                  </>
                )}
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

      <EmailBowlersModal
        open={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        tournamentId={tournamentId}
        squadOptions={emailSquadOptions}
      />

      <Modal
        open={Boolean(promoteTarget)}
        onClose={() => setPromoteTarget(null)}
        title="Move off waitlist?"
        description={promoteTarget
          ? `${registrationName(promoteTarget)} (${promoteTarget.confirmation_code ?? promoteTarget.id}) and their waitlisted entries will be confirmed.`
          : undefined}
        size="sm"
        role="alertdialog"
        closeLabel="Close move off waitlist"
        dismissible={!isPromoting}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setPromoteTarget(null)} disabled={isPromoting}>Cancel</Button>
            <Button variant="primary" onClick={() => { void handlePromote(); }} disabled={isPromoting}>
              {isPromoting ? 'Moving...' : 'Move off waitlist'}
            </Button>
          </>
        )}
      >
        <div className={styles.editForm}>
          {promoteWarnings.map((warning) => <Notice key={warning} tone="warning">{warning}</Notice>)}
          <CheckboxField
            label="Notify by email"
            helper="Tells the bowler a spot opened and they are confirmed."
            checked={promoteNotify}
            onChange={(event) => setPromoteNotify(event.target.checked)}
            disabled={isPromoting}
          />
          {promoteError ? <Notice tone="danger" role="alert">{promoteError}</Notice> : null}
        </div>
      </Modal>
    </Page>
  );
}

