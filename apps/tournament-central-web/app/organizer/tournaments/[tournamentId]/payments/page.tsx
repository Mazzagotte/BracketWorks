'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowLeft, Check, CircleDollarSign, Clock3, Users } from 'lucide-react';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { formatMoney } from '@/components/organizer/organizerFormatting';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import { buildPaymentSummary } from '@/components/organizer/tournamentInsights';
import styles from '../page.module.css';

export default function OrganizerTournamentPaymentsPage() {
  const { tournamentId, tournament, registrations, isRegistrationsLoading, tournamentError, registrationsError } = useTournamentContext();
  const error = tournamentError || registrationsError;

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
              <h2>Registration Payments</h2>
            </div>

            {paymentRows.length === 0 ? (
              <p className={styles.emptyRegistrations}>No registrations to show yet.</p>
            ) : (
              <div className={styles.registrationTableWrap}>
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
                          <td>{formatMoney(registration.total_cents ?? 0, registration.currency)}</td>
                          <td><OrganizerStatusBadge status={payment} /></td>
                          <td><OrganizerStatusBadge status={status} /></td>
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
