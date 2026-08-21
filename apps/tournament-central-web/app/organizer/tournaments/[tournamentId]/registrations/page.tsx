'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Filter,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import {
  deleteTournamentEntry,
  markTournamentRegistrationPaid,
  updateTournamentEntry,
  type OrganizerRegistrationRecord,
} from '@/components/organizer/organizerApi';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { formatMoney } from '@/components/organizer/organizerFormatting';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import styles from '../page.module.css';

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
    isLoading,
    error: contextError,
  } = useTournamentContext();
  const tournamentName = tournament?.name || 'Tournament';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [squadFilter, setSquadFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ entry: RegistrationEntry; registrationId: number } | null>(null);
  const [editForm, setEditForm] = useState<EntryEditForm | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const pageSize = 10;

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
    setActiveActionId(null);
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
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
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
      setActiveActionId(null);
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
      setActiveActionId(null);
    }
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

  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    allEntries.forEach((entry) => counts.set(entryLabel(entry, 'event'), (counts.get(entryLabel(entry, 'event')) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allEntries]);

  const topSquads = useMemo(() => {
    const counts = new Map<string, number>();
    allEntries.forEach((entry) => counts.set(entryLabel(entry, 'squad'), (counts.get(entryLabel(entry, 'squad')) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [allEntries]);

  const pageCount = Math.max(1, Math.ceil(filteredRegistrations.length / pageSize));
  const visibleRegistrations = filteredRegistrations.slice((page - 1) * pageSize, page * pageSize);
  const pageStart = filteredRegistrations.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, filteredRegistrations.length);
  const maxBreakdown = Math.max(1, ...breakdown.map(([, count]) => count));

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

  return (
    <main className={styles.registrationPage}>
      <header className={styles.registrationHeader}>
        <div>
          <h1>Registrations</h1>
          <p>{tournamentName}</p>
        </div>
        <Link href={organizerRoutes.overview(tournamentId)} className={styles.registrationBackButton}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Overview
        </Link>
      </header>

      {error || contextError ? <p className={styles.error} role="alert">{error || contextError}</p> : null}
      {isLoading ? <section className={styles.registrationLoading}>Loading registrations...</section> : null}
      {!error && !contextError && !isLoading ? (
        <>
          <section className={styles.registrationMetricGrid} aria-label="Registration summary">
            <MetricCard icon={<Users />} tone="purple" label="Total Registrations" value={metrics.total} detail="All time" />
            <MetricCard icon={<Check />} tone="green" label="Confirmed" value={metrics.confirmed} detail={`${metrics.confirmedPercent.toFixed(1)}%`} />
            <MetricCard icon={<Clock3 />} tone="orange" label="Pending" value={metrics.pending} detail={`${metrics.pendingPercent.toFixed(1)}%`} />
            <MetricCard icon={<X />} tone="red" label="Cancelled" value={metrics.cancelled} detail={`${metrics.cancelledPercent.toFixed(1)}%`} />
            <MetricCard icon={<CalendarDays />} tone="blue" label="Avg. per Day" value={metrics.averagePerDay.toFixed(2)} detail="Since published" />
            <MetricCard icon={<CircleDollarSign />} tone="green" label="Total Paid" value={formatMoney(metrics.paid)} detail="Collected" />
          </section>

          <div className={styles.registrationDashboardGrid}>
            <section className={styles.registrationTableCard} aria-label="Registration list">
              <div className={styles.registrationPanelHeading}>
                <h2>Registration List</h2>
              </div>
              <div className={styles.registrationToolbar}>
                <label className={styles.registrationSearch}>
                  <Search size={14} aria-hidden="true" />
                  <span className={styles.srOnly}>Search registrations</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, or confirmation #..." />
                </label>
                <FilterSelect label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as FilterValue)} options={[['all', 'All'], ['confirmed', 'Confirmed'], ['pending', 'Pending'], ['cancelled', 'Cancelled']]} />
                <FilterSelect label="Squad" value={squadFilter} onChange={setSquadFilter} options={[["all", 'All'], ...squadOptions]} />
                <FilterSelect label="Event" value={eventFilter} onChange={setEventFilter} options={[["all", 'All'], ...eventOptions]} />
                <button type="button" className={styles.registrationExportButton} onClick={exportRegistrations}><ArrowDownToLine size={14} /> Export</button>
              </div>

              <div className={styles.registrationTableWrap}>
                <table className={styles.registrationTable}>
                  <thead>
                    <tr><th>Confirmation #</th><th>Contact</th><th>Events</th><th>Squad</th><th>Status</th><th>Payment</th><th>Total</th><th>Date <span aria-hidden="true">↓</span></th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {visibleRegistrations.map((registration) => {
                      const entry = registration.entries?.[0];
                      const submitted = formatSubmittedAt(registration.submitted_at);
                      const name = `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim() || 'Unnamed bowler';
                      const status = registration.status ?? 'pending';
                      const payment = registration.payment_status ?? 'unpaid';
                      const registrationId = Number(registration.id);
                      const actionId = `${registration.id}-${entry?.id ?? 'none'}`;
                      return (
                        <tr key={registration.id}>
                          <td className={styles.confirmationCell}>{registration.confirmation_code ?? registration.id}</td>
                          <td><strong>{name}</strong><span>{registration.contact_email ?? registration.form?.email ?? 'No email'}</span></td>
                          <td>{registration.entries?.map((item) => entryLabel(item, 'event')).join(', ') || 'Not selected'}</td>
                          <td>{entry ? entryLabel(entry, 'squad') : 'Not selected'}</td>
                          <td><OrganizerStatusBadge status={status} /></td>
                          <td><OrganizerStatusBadge status={payment} /></td>
                          <td>{formatMoney(registration.total_cents, registration.currency)}</td>
                          <td><strong>{submitted.date}</strong><span>{submitted.time}</span></td>
                          <td className={styles.registrationActionsCell}>
                            <button type="button" className={styles.registrationMoreButton} aria-label={`Open actions for ${name}`} onClick={() => setActiveActionId((current) => current === actionId ? null : actionId)} disabled={isMutating}>
                              <span className={styles.moreDots} aria-hidden="true">⋮</span>
                            </button>
                            {activeActionId === actionId && registration.entries?.length ? (
                              <div className={styles.entryActionModalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveActionId(null); }}>
                                <section className={styles.entryActionModal} role="dialog" aria-modal="true" aria-labelledby={`entry-actions-${registration.id}`}>
                                  <header><div><span>Registration Actions</span><h2 id={`entry-actions-${registration.id}`}>{name}</h2></div><button type="button" onClick={() => setActiveActionId(null)} aria-label="Close actions"><X size={16} /></button></header>
                                  <div className={styles.entryActionModalBody}>
                                    {registration.entries.map((registrationEntry) => (
                                      <div key={registrationEntry.id} className={styles.entryActionGroup}>
                                        <strong>{entryLabel(registrationEntry, 'event')}</strong>
                                        <span>{entryLabel(registrationEntry, 'squad')}</span>
                                        <button type="button" onClick={() => Number.isInteger(registrationId) && openEntryEditor(registrationEntry, registration)}>Edit Entry</button>
                                        <button type="button" className={styles.modalDeleteAction} onClick={() => handleDeleteEntry(registrationEntry)}>Delete Entry</button>
                                      </div>
                                    ))}
                                    {payment !== 'paid' ? <button type="button" className={styles.modalPaidAction} onClick={() => handleMarkPaid(registration)}>Mark as Paid</button> : null}
                                  </div>
                                </section>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visibleRegistrations.length === 0 ? <p className={styles.emptyRegistrations}>No registrations match these filters.</p> : null}
              </div>

              <footer className={styles.registrationPagination}>
                <div className={styles.paginationButtons}>
                  <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={14} /></button>
                  {Array.from({ length: Math.min(pageCount, 3) }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={number === page ? styles.paginationActive : ''} onClick={() => setPage(number)}>{number}</button>)}
                  {pageCount > 3 ? <span>...</span> : null}
                  {pageCount > 3 ? <button type="button" onClick={() => setPage(pageCount)}>{pageCount}</button> : null}
                  <button type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={14} /></button>
                </div>
                <span>Showing {pageStart} to {pageEnd} of {filteredRegistrations.length} registrations</span>
                <label className={styles.pageSizeSelect}>10 / page <ChevronDown size={12} /></label>
              </footer>
            </section>

            <aside className={styles.registrationSidebar}>
              <section className={styles.registrationSideCard}>
                <h2>Quick Actions</h2>
                <Link href={organizerRoutes.setup(tournamentId, 'registration-setup')} className={styles.quickActionPrimary}><ExternalLink size={14} /> View Registration Form</Link>
                <button type="button" className={styles.quickActionSecondary} onClick={() => setSearch('')}><UserPlus size={14} /> Add Manual Registration</button>
              </section>
              <section className={styles.registrationSideCard}>
                <h2>Registration Breakdown</h2>
                <div className={styles.breakdownContent}>
                  <div className={styles.donutChart} style={{ background: buildDonutGradient(breakdown, metrics.total) }}><strong>{metrics.total}</strong><span>Total</span></div>
                  <div className={styles.breakdownLegend}>{breakdown.length > 0 ? breakdown.map(([name, count], index) => <div key={name}><i className={`${styles.legendDot} ${styles[`legend${index % 4}`]}`} /><span>{name}</span><strong>{count} <small>({metrics.total ? ((count / metrics.total) * 100).toFixed(1) : '0.0'}%)</small></strong></div>) : <span className={styles.sideEmpty}>No event entries yet</span>}</div>
                </div>
              </section>
              <section className={styles.registrationSideCard}>
                <h2>Top Squads</h2>
                <div className={styles.topSquadList}>{topSquads.length > 0 ? topSquads.map(([name, count], index) => <div key={name}><div><span>{name}</span><small>{count} ({metrics.total ? ((count / metrics.total) * 100).toFixed(1) : '0.0'}%)</small></div><span className={`${styles.squadBar} ${styles[`squadBar${index}`]}`} style={{ width: `${(count / maxBreakdown) * 100}%` }} /></div>) : <span className={styles.sideEmpty}>No squad entries yet</span>}</div>
              </section>
            </aside>
          </div>

        </>
      ) : null}
      {editingEntry && editForm ? (
        <div className={styles.entryModalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingEntry(null); }}>
          <section className={styles.entryModal} role="dialog" aria-modal="true" aria-labelledby="edit-entry-title">
            <header>
              <div><span>Edit Entry</span><h2 id="edit-entry-title">{entryLabel(editingEntry.entry, 'event')}</h2></div>
              <button type="button" className={styles.entryModalClose} onClick={() => setEditingEntry(null)} aria-label="Close edit entry dialog"><X size={16} /></button>
            </header>
            <div className={styles.entryModalFields}>
              <div className={styles.entryEditSection}><strong>Contact</strong><div className={styles.entryEditGrid}>
                <label>First name<input value={editForm.firstName} onChange={(event) => setEditForm((current) => current ? { ...current, firstName: event.target.value } : current)} /></label>
                <label>Last name<input value={editForm.lastName} onChange={(event) => setEditForm((current) => current ? { ...current, lastName: event.target.value } : current)} /></label>
                <label>Email<input type="email" value={editForm.email} onChange={(event) => setEditForm((current) => current ? { ...current, email: event.target.value } : current)} /></label>
                <label>Phone<input value={editForm.phone} onChange={(event) => setEditForm((current) => current ? { ...current, phone: event.target.value } : current)} /></label>
              </div></div>
              <div className={styles.entryEditSection}><strong>Competition Entry</strong><div className={styles.entryEditGrid}>
                <label>Event ID<input value={editForm.eventConfigId} onChange={(event) => setEditForm((current) => current ? { ...current, eventConfigId: event.target.value } : current)} /></label>
                <label>Event name<input value={editForm.eventName} onChange={(event) => setEditForm((current) => current ? { ...current, eventName: event.target.value } : current)} /></label>
                <label>Division ID<input value={editForm.divisionConfigId} onChange={(event) => setEditForm((current) => current ? { ...current, divisionConfigId: event.target.value } : current)} /></label>
                <label>Division name<input value={editForm.divisionName} onChange={(event) => setEditForm((current) => current ? { ...current, divisionName: event.target.value } : current)} /></label>
                <label>Squad ID<input value={editForm.squadConfigId} onChange={(event) => setEditForm((current) => current ? { ...current, squadConfigId: event.target.value } : current)} /></label>
                <label>Squad name<input value={editForm.squadName} onChange={(event) => setEditForm((current) => current ? { ...current, squadName: event.target.value } : current)} /></label>
                <label>Squad date<input value={editForm.squadDate} onChange={(event) => setEditForm((current) => current ? { ...current, squadDate: event.target.value } : current)} /></label>
                <label>Squad time<input value={editForm.squadTime} onChange={(event) => setEditForm((current) => current ? { ...current, squadTime: event.target.value } : current)} /></label>
                <label>Status<select value={editForm.status} onChange={(event) => setEditForm((current) => current ? { ...current, status: event.target.value } : current)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="waitlisted">Waitlisted</option><option value="cancelled">Cancelled</option></select></label>
                <label>Entry number<input type="number" min="1" value={editForm.entryNumber} onChange={(event) => setEditForm((current) => current ? { ...current, entryNumber: event.target.value } : current)} placeholder="Not assigned" /></label>
                <label>Entry fee<input type="number" min="0" step="0.01" value={editForm.entryFee} onChange={(event) => setEditForm((current) => current ? { ...current, entryFee: event.target.value } : current)} /></label>
              </div></div>
              <div className={styles.entryEditSection}><strong>Notes</strong><label><textarea value={editForm.notes} onChange={(event) => setEditForm((current) => current ? { ...current, notes: event.target.value } : current)} rows={3} /></label></div>
              <div className={styles.entryEditSection}><strong>Bowlers</strong><div className={styles.entryBowlerList}>
                {editForm.bowlers.map((bowler, index) => <div key={bowler.id} className={styles.entryBowlerCard}><span>Bowler {index + 1}</span><div className={styles.entryEditGrid}>
                  <label>First name<input value={bowler.first_name} onChange={(event) => setEditForm((current) => current ? { ...current, bowlers: current.bowlers.map((item) => item.id === bowler.id ? { ...item, first_name: event.target.value } : item) } : current)} /></label>
                  <label>Last name<input value={bowler.last_name} onChange={(event) => setEditForm((current) => current ? { ...current, bowlers: current.bowlers.map((item) => item.id === bowler.id ? { ...item, last_name: event.target.value } : item) } : current)} /></label>
                  <label>Email<input value={bowler.email ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, bowlers: current.bowlers.map((item) => item.id === bowler.id ? { ...item, email: event.target.value } : item) } : current)} /></label>
                  <label>Phone<input value={bowler.phone ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, bowlers: current.bowlers.map((item) => item.id === bowler.id ? { ...item, phone: event.target.value } : item) } : current)} /></label>
                  <label>USBC number<input value={bowler.usbc_number ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, bowlers: current.bowlers.map((item) => item.id === bowler.id ? { ...item, usbc_number: event.target.value } : item) } : current)} /></label>
                  <label>Average<input type="number" value={bowler.average ?? ''} onChange={(event) => setEditForm((current) => current ? { ...current, bowlers: current.bowlers.map((item) => item.id === bowler.id ? { ...item, average: event.target.value ? Number(event.target.value) : null } : item) } : current)} /></label>
                </div></div>)}
              </div></div>
            </div>
            <footer><button type="button" className={styles.entryModalCancel} onClick={() => setEditingEntry(null)}>Cancel</button><button type="button" className={styles.entryModalSave} onClick={handleSaveEntry} disabled={isMutating}>Save Entry</button></footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function MetricCard({ icon, tone, label, value, detail }: { icon: React.ReactNode; tone: string; label: string; value: string | number; detail: string }) {
  return <article className={styles.registrationMetricCard}><span className={`${styles.metricIcon} ${styles[`metric${tone}`]}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className={styles.registrationFilter}><span className={styles.srOnly}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{label}: {optionLabel}</option>)}</select><ChevronDown size={12} aria-hidden="true" /></label>;
}

function buildDonutGradient(breakdown: Array<[string, number]>, total: number): string {
  if (!total || breakdown.length === 0) return 'conic-gradient(#282b39 0 100%)';
  const colors = ['#ff920f', '#4d9dff', '#20d884', '#dc52e9'];
  let cursor = 0;
  const stops = breakdown.map(([, count], index) => {
    const start = cursor;
    cursor += (count / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}
