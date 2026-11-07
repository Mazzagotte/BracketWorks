'use client';

import { useRef, useState } from 'react';

import OrganizerStatusBadge from './OrganizerStatusBadge';
import { formatMoney } from './organizerFormatting';
import { updateTournamentRegistrationPaymentStatus, type OrganizerRegistrationRecord } from './organizerApi';
import { useConfirmation } from './useConfirmation';
import cells from './OrganizerTable.module.css';

/**
 * Records a registration as paid or unpaid after a confirmation step. Payment is collected at the
 * venue, so this only changes the record: it never charges a bowler or issues a refund.
 */
export function usePaymentToggle({
  tournamentId,
  refreshRegistrations,
}: {
  tournamentId: number;
  refreshRegistrations: () => Promise<void>;
}) {
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
    const amount = formatMoney(registration.total_cents ?? 0, registration.currency);
    const nextStatus = registration.payment_status === 'paid' ? 'unpaid' : 'paid';
    const confirmed = await confirm(nextStatus === 'paid'
      ? {
        title: 'Record payment?',
        message: `Mark ${reference} as paid in full (${amount})? Only continue if payment has been received. This does not charge the bowler.`,
        confirmLabel: 'Mark paid',
      }
      : {
        title: 'Mark registration unpaid?',
        message: `Mark ${reference} as unpaid (${amount})? This corrects the payment record only; it does not issue a refund.`,
        confirmLabel: 'Mark unpaid',
      });
    if (!confirmed) return;
    savingRef.current = true;
    setSavingId(id);
    try {
      await updateTournamentRegistrationPaymentStatus(token, tournamentId, id, nextStatus);
      setMessage(`${reference} marked as ${nextStatus}.`);
      try {
        await refreshRegistrations();
      } catch {
        setActionError('Payment status was updated, but the list could not be refreshed. Reload the page to see updated totals.');
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to update this registration’s payment status.');
    } finally {
      savingRef.current = false;
      setSavingId(null);
    }
  };

  /** The Payment cell: a badge that toggles paid or unpaid, or a plain badge when it can't change. */
  const renderPaymentCell = (registration: OrganizerRegistrationRecord) => {
    const status = registration.status ?? 'pending';
    const payment = registration.payment_status ?? 'unpaid';
    const reference = registration.confirmation_code ?? registration.id;
    const canToggle = (payment === 'unpaid' || payment === 'paid') && status !== 'refunded' && status !== 'cancelled';
    if (!canToggle) return <OrganizerStatusBadge status={payment} />;
    const isSaving = savingId === Number(registration.id);
    return (
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
    );
  };

  return { actionError, message, renderPaymentCell, confirmationDialog };
}
