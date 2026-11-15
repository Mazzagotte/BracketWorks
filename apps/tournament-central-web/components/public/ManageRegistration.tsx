'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ICON_SIZE,
  Notice,
  Page,
  PageHeader,
  TopNav,
  topNavBrandClassName,
} from '@bracketworks/ui';
import { Link2Off } from 'lucide-react';

import TournamentRegistrationForm, { type RegistrationFormState } from './TournamentRegistrationForm';
import { formatSideEventMoney, sideEventPayload, type PublicFeeConfig } from './registrationSideEvents';
import type { SideEventSelection } from '@/components/organizer/formatTypes';
import styles from './ManageRegistration.module.css';

type FieldConfig = { id: string; key: string; label: string; customLabel?: string; mode: 'required' | 'optional' | 'dont-ask'; validation?: string; displayOrder?: number };
type QuestionConfig = { id: string; label: string; type?: 'short-text' | 'long-text' | 'number' | 'yes-no' | 'dropdown' | 'multiple-choice' | 'checkbox' | 'date'; required: boolean; options?: string[]; displayOrder?: number };

type RegistrationConfig = {
  events: Array<{ id: string; name: string; entryFeeCents?: number; rules?: unknown; connectedSquadIds?: string[]; connectedDivisionIds?: string[] }>;
  divisions: Array<{ id: string; name: string; minAverage?: number | null; maxAverage?: number | null; minAge?: number | null; maxAge?: number | null; rules?: unknown }>;
  squads: Array<{ id: string; name: string; dateIso?: string; startTime?: string }>;
  fields: FieldConfig[];
  questions: QuestionConfig[];
  fees?: PublicFeeConfig[];
  start_date?: string | null;
};

export type ManagedRegistration = {
  token: string;
  viewer: { name: string; removed: boolean };
  tournament: { id: number; name: string; dates: string; location: string; url: string };
  organizer: { name: string; email: string; phone: string };
  can_edit: boolean;
  changes_close_at: string;
  registration: {
    confirmation_code: string;
    status: string;
    subtotal_cents: number;
    fees_cents: number;
    total_cents: number;
    squad_name: string;
    event_name: string;
    division_name: string;
  };
  form: {
    eventId: string;
    divisionId: string;
    squadId: string;
    notes: string;
    bowlers: Array<Record<string, string>>;
    bowlerQuestionAnswers: RegistrationFormState['bowlerQuestionAnswers'];
    sideEvents: SideEventSelection[];
  };
};

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  confirmed: { label: 'Confirmed', tone: 'success' },
  pending: { label: 'Pending', tone: 'info' },
  waitlisted: { label: 'Waitlisted', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

async function readJson<T>(response: Response): Promise<T & { detail?: string }> {
  return (await response.json().catch(() => ({}))) as T & { detail?: string };
}

function toFormState(data: ManagedRegistration): RegistrationFormState {
  return {
    bowlers: data.form.bowlers.map((bowler) => ({ ...bowler })),
    eventId: data.form.eventId,
    divisionId: data.form.divisionId,
    squadId: data.form.squadId,
    notes: data.form.notes,
    bowlerQuestionAnswers: data.form.bowlers.map((_, index) => ({ ...(data.form.bowlerQuestionAnswers[index] ?? {}) })),
    acceptTerms: true,
    sideEvents: data.form.sideEvents,
  };
}

function bowlerNames(data: ManagedRegistration): string[] {
  return data.form.bowlers
    .map((bowler) => `${bowler.first_name ?? ''} ${bowler.last_name ?? ''}`.trim())
    .filter(Boolean);
}

export default function ManageRegistration() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(() => searchParams.get('token') ?? '');
  const [data, setData] = useState<ManagedRegistration | null>(null);
  const [config, setConfig] = useState<RegistrationConfig | null>(null);
  const [formState, setFormState] = useState<RegistrationFormState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  /** Show a newly saved registration. A new link (after an email change) replaces the one in the address bar. */
  const show = useCallback((next: ManagedRegistration) => {
    setData(next);
    setFormState(toFormState(next));
    if (next.token && next.token !== token) {
      setToken(next.token);
      window.history.replaceState(null, '', `/registration/manage?token=${encodeURIComponent(next.token)}`);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) {
        setLoadError('This page needs the link from your confirmation email.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/v1/public/tc-registration/manage?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const body = await readJson<ManagedRegistration>(response);
        if (!response.ok) throw new Error(body.detail || 'We could not open this registration.');
        const configResponse = await fetch(`/api/v1/public/tc-tournament/${body.tournament.id}/registration`, { cache: 'no-store' });
        const configBody = await readJson<RegistrationConfig>(configResponse);
        if (!active) return;
        setData(body);
        setFormState(toFormState(body));
        if (configResponse.ok) setConfig(configBody);
      } catch (cause) {
        if (active) setLoadError(cause instanceof Error ? cause.message : 'We could not open this registration.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
    // Load once for the link the page opened with; later link changes come from saving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const event = useMemo(
    () => config?.events.find((entry) => entry.id === formState?.eventId) ?? null,
    [config, formState?.eventId],
  );
  const squads = useMemo(() => {
    const all = config?.squads ?? [];
    const linked = all.filter((squad) => (event?.connectedSquadIds ?? []).includes(squad.id));
    return linked.length > 0 ? linked : all;
  }, [config, event]);
  const divisions = useMemo(() => {
    const all = config?.divisions ?? [];
    const linked = all.filter((division) => (event?.connectedDivisionIds ?? []).includes(division.id));
    return linked.length > 0 ? linked : all;
  }, [config, event]);
  const fields = useMemo(
    () => (config?.fields ?? [])
      .filter((field) => field.mode !== 'dont-ask')
      .map((field) => ({ ...field, id: field.id || field.key }))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [config],
  );
  const questions = useMemo(
    () => [...(config?.questions ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [config],
  );

  const save = async () => {
    if (!formState) return;
    setSaving(true);
    setSaveError('');
    setSaved('');
    const first = formState.bowlers[0] ?? {};
    try {
      const response = await fetch('/api/v1/public/tc-registration/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          form: {
            firstName: first.first_name || '',
            lastName: first.last_name || '',
            email: first.email || '',
            phone: first.phone || '',
            usbcNumber: first.usbc_number || '',
            bowlers: formState.bowlers,
            eventId: formState.eventId,
            divisionId: formState.divisionId,
            squadId: formState.squadId,
            notes: formState.notes,
            questionAnswers: formState.bowlerQuestionAnswers[0] || {},
            bowlerQuestionAnswers: formState.bowlerQuestionAnswers,
            fieldValues: first,
            acceptTerms: true,
            side_events: sideEventPayload(formState.sideEvents),
          },
        }),
      });
      const body = await readJson<ManagedRegistration>(response);
      if (!response.ok) throw new Error(body.detail || 'Your changes were not saved. Try again.');
      show(body);
      setSaved(body.viewer.removed
        ? "Saved. You're no longer on this registration, so this link no longer works. Everyone on it got an email about the change."
        : 'Saved. Everyone on the registration and the organizer got an email about what changed.');
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Your changes were not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancelRegistration = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      const response = await fetch('/api/v1/public/tc-registration/manage/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await readJson<ManagedRegistration>(response);
      if (!response.ok) throw new Error(body.detail || 'The registration was not cancelled. Try again.');
      show(body);
      setConfirmCancel(false);
      setSaved('Your registration is cancelled. Everyone on it and the organizer got an email.');
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : 'The registration was not cancelled. Try again.');
    } finally {
      setCancelling(false);
    }
  };

  const status = data ? STATUS[data.registration.status] ?? { label: data.registration.status, tone: 'neutral' as const } : null;
  const organizerWays = data ? [data.organizer.email, data.organizer.phone].filter(Boolean).join(' or ') : '';
  const contactLine = data && organizerWays
    ? `Questions? Contact ${data.organizer.name || 'the organizer'} at ${organizerWays}.`
    : '';

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <TopNav
        brand={(
          <Link href="/" aria-label="Tournament Central home" className={topNavBrandClassName()}>
            <Image src="/TC_logo_No_Text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />
            Tournament Central
          </Link>
        )}
      />
      <main id="main-content">
        <Page width="narrow">
          {loading ? <p className={styles.body} role="status">Loading your registration...</p> : null}

          {!loading && (loadError || !data) ? (
            <Card>
              <EmptyState
                icon={<Link2Off size={ICON_SIZE['2xl']} aria-hidden="true" />}
                title="This link doesn't work"
                description={loadError || 'We could not open this registration.'}
                action={<ButtonLink href="/registration/find" variant="primary">Email me my links</ButtonLink>}
              />
            </Card>
          ) : null}

          {!loading && data && status ? (
            <>
              <PageHeader
                overline="Your registration"
                title={data.tournament.name}
                badge={<Badge tone={status.tone}>{status.label}</Badge>}
                description={[data.tournament.dates, data.tournament.location].filter(Boolean).join(' · ')}
                actions={<ButtonLink href={data.tournament.url} variant="secondary">Tournament page</ButtonLink>}
              />

              {saved ? <Notice tone="success" role="status">{saved}</Notice> : null}
              {data.viewer.removed ? null : data.can_edit ? (
                <Notice tone="info">
                  {data.changes_close_at
                    ? `You can change this registration until ${data.changes_close_at}.`
                    : 'You can change this registration until the organizer closes changes.'}
                </Notice>
              ) : data.registration.status !== 'cancelled' ? (
                <Notice tone="warning">
                  {`Changes are closed${data.changes_close_at ? ` (they closed ${data.changes_close_at})` : ''}. Contact the organizer to change your registration.`}
                </Notice>
              ) : null}

              <Card>
                <CardHeader title="Registration details" />
                <dl className={styles.details}>
                  <div><dt>Confirmation code</dt><dd className={styles.code}>{data.registration.confirmation_code}</dd></div>
                  {data.registration.event_name ? <div><dt>Event</dt><dd>{data.registration.event_name}</dd></div> : null}
                  {data.registration.division_name ? <div><dt>Division</dt><dd>{data.registration.division_name}</dd></div> : null}
                  {data.registration.squad_name ? <div><dt>Squad</dt><dd>{data.registration.squad_name}</dd></div> : null}
                  <div><dt>Bowlers</dt><dd>{bowlerNames(data).join(', ') || 'None'}</dd></div>
                  <div><dt>Total due at check-in</dt><dd className={styles.amount}>{formatSideEventMoney(data.registration.total_cents)}</dd></div>
                </dl>
                {contactLine ? <p className={styles.helper}>{contactLine}</p> : null}
              </Card>

              {data.can_edit && formState && config ? (
                <Card>
                  <TournamentRegistrationForm
                    mode="edit"
                    presentation="inline"
                    tournamentName={data.tournament.name}
                    squads={squads}
                    events={config.events}
                    divisions={divisions}
                    fields={fields}
                    fees={config.fees}
                    startDate={config.start_date}
                    questions={questions}
                    requiredBowlerCount={formState.bowlers.length}
                    formState={formState}
                    setFormState={(update) => setFormState((prev) => (prev ? (typeof update === 'function' ? update(prev) : update) : prev))}
                    submitMessage={null}
                    isSubmitting={saving}
                    onSubmit={save}
                    footerHint="The total due is updated when you save."
                    notice={saveError ? <Notice tone="danger" role="alert">{saveError}</Notice> : null}
                  />
                </Card>
              ) : null}
              {data.can_edit && !config ? (
                <Notice tone="warning">The registration form isn&apos;t available right now. Try again later or contact the organizer.</Notice>
              ) : null}

              {data.can_edit ? (
                <Card>
                  <CardHeader
                    title="Cancel registration"
                    description="Cancels the whole registration for everyone on it. The organizer and everyone on it get an email."
                    actions={<Button variant="ghost-danger" onClick={() => { setCancelError(''); setConfirmCancel(true); }}>Cancel registration</Button>}
                  />
                </Card>
              ) : null}

              <ConfirmDialog
                open={confirmCancel}
                tone="danger"
                title="Cancel this registration?"
                description={`This cancels ${data.registration.confirmation_code} for everyone on it. To bowl later, you would need to register again, if there's room.`}
                confirmLabel="Cancel registration"
                cancelLabel="Keep registration"
                busy={cancelling}
                busyLabel="Cancelling..."
                error={cancelError || undefined}
                onConfirm={() => void cancelRegistration()}
                onCancel={() => setConfirmCancel(false)}
              />
            </>
          ) : null}
        </Page>
      </main>
    </div>
  );
}
