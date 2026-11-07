'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, Notice, SelectField, TextAreaField, TextField } from '@bracketworks/ui';
import {
  previewTournamentMessage,
  sendTournamentMessage,
  type MessageAudience,
} from './messagesApi';
import styles from './EmailBowlersModal.module.css';

const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

type EmailBowlersModalProps = {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
  /** [squad config ID, squad label] pairs for the "A squad" audience. */
  squadOptions: Array<[string, string]>;
};

function peopleLabel(count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}

export default function EmailBowlersModal({ open, onClose, tournamentId, squadOptions }: EmailBowlersModalProps) {
  const [audience, setAudience] = useState<MessageAudience>('all');
  const [squadId, setSquadId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [maxRecipients, setMaxRecipients] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setAudience('all');
    setSquadId(squadOptions[0]?.[0] ?? '');
    setSubject('');
    setBody('');
    setError(null);
    setResult(null);
    // Reset only when the dialog opens, not when the squad list changes behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Your session expired. Please sign in again.');
      return undefined;
    }
    if (audience === 'squad' && !squadId) {
      setRecipientCount(0);
      return undefined;
    }
    let cancelled = false;
    setIsCounting(true);
    setRecipientCount(null);
    previewTournamentMessage(token, tournamentId, { audience, squad_config_id: squadId })
      .then((preview) => {
        if (cancelled) return;
        setRecipientCount(preview.recipient_count);
        setMaxRecipients(preview.max_recipients ?? null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : 'Unable to count recipients.');
      })
      .finally(() => {
        if (!cancelled) setIsCounting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, open, squadId, tournamentId]);

  const overLimit = recipientCount !== null && maxRecipients !== null && recipientCount > maxRecipients;
  const canSend = !isSending
    && !isCounting
    && recipientCount !== null
    && recipientCount > 0
    && !overLimit
    && subject.trim().length > 0
    && body.trim().length > 0;

  const handleSend = async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Your session expired. Please sign in again.');
      return;
    }
    setIsSending(true);
    setError(null);
    setResult(null);
    try {
      const response = await sendTournamentMessage(
        token,
        tournamentId,
        { audience, squad_config_id: squadId },
        { subject: subject.trim(), body: body.trim() },
      );
      setResult(response);
      if (response.sent > 0) {
        setSubject('');
        setBody('');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send this message.');
    } finally {
      setIsSending(false);
    }
  };

  let countText = 'Counting recipients...';
  if (!isCounting && recipientCount !== null) {
    if (recipientCount === 0) {
      countText = 'No one with an email address matches this audience.';
    } else if (overLimit) {
      countText = `This audience has ${peopleLabel(recipientCount)}. You can send to ${maxRecipients} at a time.`;
    } else {
      countText = `Sends to ${peopleLabel(recipientCount)}. Each person gets their own copy.`;
    }
  }

  const sendLabel = isSending
    ? 'Sending...'
    : recipientCount ? `Send to ${peopleLabel(recipientCount)}` : 'Send';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email bowlers"
      closeLabel="Close email bowlers"
      dismissible={!isSending}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSending}>Cancel</Button>
          <Button variant="primary" onClick={() => { void handleSend(); }} disabled={!canSend}>{sendLabel}</Button>
        </>
      )}
    >
      <div className={styles.form}>
        {result && result.sent > 0 ? (
          <Notice tone="success" role="status">
            {`Sent to ${peopleLabel(result.sent)}.`}
            {result.failed > 0 ? ` ${peopleLabel(result.failed)} could not be emailed.` : ''}
          </Notice>
        ) : null}
        {result && result.sent === 0 ? (
          <Notice tone="danger" role="alert">The message could not be sent. Try again in a few minutes.</Notice>
        ) : null}
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

        <SelectField
          label="Send to"
          value={audience}
          onChange={(event) => setAudience(event.target.value as MessageAudience)}
          disabled={isSending}
        >
          <option value="all">Everyone</option>
          <option value="squad" disabled={squadOptions.length === 0}>A squad</option>
          <option value="unpaid">Unpaid registrations</option>
          <option value="waitlisted">Waitlisted registrations</option>
        </SelectField>
        {audience === 'squad' ? (
          <SelectField label="Squad" value={squadId} onChange={(event) => setSquadId(event.target.value)} disabled={isSending}>
            {squadOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
        ) : null}
        <p className={styles.count} role="status" aria-live="polite">{countText}</p>

        <TextField
          label="Subject"
          value={subject}
          maxLength={SUBJECT_MAX}
          onChange={(event) => setSubject(event.target.value)}
          disabled={isSending}
        />
        <TextAreaField
          label="Message"
          value={body}
          rows={8}
          maxLength={BODY_MAX}
          helper="Cancelled and refunded registrations are not included."
          onChange={(event) => setBody(event.target.value)}
          disabled={isSending}
        />
      </div>
    </Modal>
  );
}
