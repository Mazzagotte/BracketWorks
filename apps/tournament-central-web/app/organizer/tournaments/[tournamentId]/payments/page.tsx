'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CircleDollarSign, Clock3, Users } from 'lucide-react';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { useConfirmation } from '@/components/organizer/useConfirmation';
import { formatMoney } from '@/components/organizer/organizerFormatting';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import { buildPaymentSummary } from '@/components/organizer/tournamentInsights';
import { updateTournamentRegistrationPaymentStatus, type OrganizerRegistrationRecord } from '@/components/organizer/organizerApi';
import styles from '../page.module.css';

export default function OrganizerTournamentPaymentsPage() {
  const { tournamentId, tournament, registrations, isRegistrationsLoading, tournamentError, registrationsError, refreshRegistrations } = useTournamentContext();
  const error = tournamentError || registrationsError;
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const savingRef = useRef(false);
  const { confirm, confirmationDialog } = useConfirmation();

  const togglePayment = async (registration: OrganizerRegistrationRecord) => {
    if (savingRef.current) return;
    setActionError('');
    setMessage('');
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setActionError('Your session expired. Please sign in again.');
      return;
    }
    const id = Number(registration.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setActionError('This registration has an invalid ID. Reload the page before recording payment.');
      return;
    }
    const reference = registration.confirmation_code ?? String(id);
    const nextStatus = registration.payment_status === 'paid' ? 'unpaid' : 'paid';
    const confirmation = nextStatus === 'paid'
      ? `Mark ${reference} as paid in full (${formatMoney(registration.total_cents ?? 0, registration.currency)})? Only continue if payment has been received. This does not charge the bowler.`
      : `Mark ${reference} as unpaid (${formatMoney(registration.total_cents ?? 0, registration.currency)})? This corrects the payment record only; it does not issue a refund.`;
    if (!await confirm({
      title: nextStatus === 'paid' ? 'Record payment?' : 'Mark registration unpaid?',
      message: confirmation,
      confirmLabel: nextStatus === 'paid' ? 'Mark paid' : 'Mark unpaid',
    })) return;
    savingRef.current = true;
    setSavingId(id);
    try {
      await updateTournamentRegistrationPaymentStatus(token, tournamentId, id, nextStatus);
      setMessage(`${reference} marked as ${nextStatus}.`);
      try {
        await refreshRegistrations();
      } catch {
        setActionError('Payment status was updated, but the payment list could not be refreshed. Reload the page to see updated totals.');
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to update this registration’s payment status.');
    } finally {
      savingRef.current = false;
      setSavingId(null);
    }
  };

  const paymentSummary = useMemo(() => buildPaymentSummary(registrations), [registrations]);

  const paymentRows = useMemo(
    () => registrations.filter((registration) => {
      const status = registration.status ?? 'pending';
      return status !== 'cancelled';
    }),
    [registrations],
  );

  return (
    <main className={styles.registrationPage}>
      {confirmationDialog}
      <header className={styles.registrationHeader}>
        <div>
          <h1>Payments</h1>
          <p>{tournament?.name || 'Tournament'}</p>
        </div>
        <Link href={organizerRoutes.overview(tournamentId)} className={styles.registrationBackButton}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Overview
        </Link>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {isRegistrationsLoading ? <section className={styles.registrationLoading}>Loading payments...</section> : null}

      {!error && !isRegistrationsLoading ? (
        <>
          <section className={styles.registrationMetricGrid} aria-label="Payment summary">
            <div className={styles.registrationMetricCard}>
              <span className={`${styles.metricIcon} ${styles.metricblue}`}><CircleDollarSign /></span>
              <div><span>Total Expected</span><strong>{formatMoney(paymentSummary.expectedCents)}</strong></div>
            </div>
            <div className={styles.registrationMetricCard}>
              <span className={`${styles.metricIcon} ${styles.metricgreen}`}><Check /></span>
              <div><span>Total Paid</span><strong>{formatMoney(paymentSummary.paidCents)}</strong></div>
            </div>
            <div className={styles.registrationMetricCard}>
              <span className={`${styles.metricIcon} ${styles.metricorange}`}><Clock3 /></span>
              <div><span>Total Unpaid</span><strong>{formatMoney(paymentSummary.unpaidCents)}</strong></div>
            </div>
            <div className={styles.registrationMetricCard}>
              <span className={`${styles.metricIcon} ${styles.metricred}`}><CircleDollarSign /></span>
              <div><span>Total Refunded</span><strong>{formatMoney(paymentSummary.refundedCents)}</strong></div>
            </div>
            <div className={styles.registrationMetricCard}>
              <span className={`${styles.metricIcon} ${styles.metricpurple}`}><Users /></span>
              <div><span>Paid Registrations</span><strong>{paymentSummary.paidCount}</strong></div>
            </div>
          </section>

          <section className={styles.registrationTableCard} aria-label="Payment list">
            <div className={styles.registrationPanelHeading}>
              <div>
                <h2>Registration Payments</h2>
                <p>{paymentRows.length} registration{paymentRows.length === 1 ? '' : 's'} included</p>
                <p>Click a Paid or Unpaid status to change it. Mark paid after receiving full payment, or unpaid to correct the record. This does not charge the bowler or issue refunds.</p>
              </div>
            </div>

            {paymentRows.length === 0 ? (
              <p className={styles.emptyRegistrations}>No registrations to show yet.</p>
            ) : (
              <div className={styles.registrationTableWrap} tabIndex={0} role="region" aria-label="Payments table, scroll horizontally for more columns">
                <table className={styles.registrationTable}>
                  <thead>
                    <tr>
                      <th>Confirmation #</th>
                      <th>Contact</th>
                      <th>Amount</th>
                      <th>Payment Status</th>
                      <th>Registration Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRows.map((registration) => {
                      const name = `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim() || 'Unnamed bowler';
                      const status = registration.status ?? 'pending';
                      const payment = registration.payment_status ?? 'unpaid';
                      return (
                        <tr key={registration.id}>
                          <td className={styles.confirmationCell}>{registration.confirmation_code ?? registration.id}</td>
                          <td><strong>{name}</strong><span>{registration.contact_email ?? registration.form?.email ?? 'No email'}</span></td>
                          <td className={styles.paymentAmountCell}>{formatMoney(registration.total_cents ?? 0, registration.currency)}</td>
                          <td><div className={styles.registrationPaymentCell}>
                            {(payment === 'unpaid' || payment === 'paid') && status !== 'refunded' ? (
                              <button type="button" className={styles.paymentStatusToggle} disabled={savingId !== null}
                                title={`Click to mark as ${payment === 'paid' ? 'unpaid' : 'paid'}`}
                                aria-busy={savingId === Number(registration.id)}
                                aria-label={`Mark ${registration.confirmation_code ?? registration.id} as ${payment === 'paid' ? 'unpaid' : 'paid'}`}
                                onClick={() => void togglePayment(registration)}>
                                <OrganizerStatusBadge status={payment} />
                                {savingId === Number(registration.id) && <span>Saving...</span>}
                              </button>
                            ) : <OrganizerStatusBadge status={payment} />}
                          </div></td>
                          <td><div className={styles.registrationStatusCell}><OrganizerStatusBadge status={status} /></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
