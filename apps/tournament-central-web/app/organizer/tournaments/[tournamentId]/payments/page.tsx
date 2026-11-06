'use client';

import { useMemo, useRef, useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { Card, CardHeader, DataTable, EmptyState, ICON_SIZE, Notice, Page, PageHeader, StatGroup } from '@bracketworks/ui';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { useConfirmation } from '@/components/organizer/useConfirmation';
import { formatMoney } from '@/components/organizer/organizerFormatting';
import { buildPaymentSummary } from '@/components/organizer/tournamentInsights';
import { updateTournamentRegistrationPaymentStatus, type OrganizerRegistrationRecord } from '@/components/organizer/organizerApi';
import cells from '@/components/organizer/OrganizerTable.module.css';

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
    <Page>
      {confirmationDialog}
      <PageHeader
        title="Payments"
        description={`Record payments received for ${tournament?.name || 'this tournament'}. Payment is collected at the venue; nothing here charges a bowler or issues a refund.`}
      />

      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
      {actionError ? <Notice tone="danger" role="alert">{actionError}</Notice> : null}
      {message ? <Notice tone="success" role="status">{message}</Notice> : null}
      {isRegistrationsLoading ? <Notice tone="info">Loading payments...</Notice> : null}

      {!error && !isRegistrationsLoading ? (
        <>
          <StatGroup
            label="Payment summary"
            items={[
              { label: 'Expected', value: formatMoney(paymentSummary.expectedCents) },
              { label: 'Paid', value: formatMoney(paymentSummary.paidCents), detail: `${paymentSummary.paidCount} registration${paymentSummary.paidCount === 1 ? '' : 's'}` },
              { label: 'Unpaid', value: formatMoney(paymentSummary.unpaidCents) },
              { label: 'Refunded', value: formatMoney(paymentSummary.refundedCents) },
            ]}
          />

          <Card padding="flush" aria-label="Payment list">
            <CardHeader
              title="Registration payments"
              description={`${paymentRows.length} registration${paymentRows.length === 1 ? '' : 's'}. Select a Paid or Unpaid status to change it after payment is received or to correct the record.`}
            />
            {paymentRows.length === 0 ? (
              <EmptyState
                icon={<CircleDollarSign size={ICON_SIZE['2xl']} aria-hidden="true" />}
                title="No registrations yet"
                description="Payments appear here once bowlers register."
              />
            ) : (
              <DataTable caption="Registration payments" className={cells.nowrap}>
                <thead>
                  <tr>
                    <th scope="col">Confirmation</th>
                    <th scope="col">Contact</th>
                    <th scope="col" data-align="right">Amount</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Registration</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((registration) => {
                    const name = `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim() || 'Unnamed bowler';
                    const status = registration.status ?? 'pending';
                    const payment = registration.payment_status ?? 'unpaid';
                    const reference = registration.confirmation_code ?? registration.id;
                    const isSaving = savingId === Number(registration.id);
                    return (
                      <tr key={registration.id}>
                        <td className={cells.code}>{reference}</td>
                        <td>
                          <span className={cells.stack}>
                            <span className={cells.primaryText}>{name}</span>
                            <span className={cells.secondaryText}>{registration.contact_email ?? registration.form?.email ?? 'No email'}</span>
                          </span>
                        </td>
                        <td data-align="right">{formatMoney(registration.total_cents ?? 0, registration.currency)}</td>
                        <td>
                          {(payment === 'unpaid' || payment === 'paid') && status !== 'refunded' ? (
                            <button
                              type="button"
                              className={cells.statusToggle}
                              disabled={savingId !== null}
                              aria-busy={isSaving}
                              aria-label={`Mark ${reference} as ${payment === 'paid' ? 'unpaid' : 'paid'}`}
                              onClick={() => void togglePayment(registration)}
                            >
                              <OrganizerStatusBadge status={payment} />
                              {isSaving ? 'Saving...' : null}
                            </button>
                          ) : <OrganizerStatusBadge status={payment} />}
                        </td>
                        <td><OrganizerStatusBadge status={status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            )}
          </Card>
        </>
      ) : null}
    </Page>
  );
}
