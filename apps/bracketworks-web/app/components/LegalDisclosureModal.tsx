'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, CheckboxField, Modal, Notice } from '@bracketworks/ui';
import { apiClient } from '../lib/api';
import { OPEN_LEGAL_DISCLOSURE_EVENT } from '../lib/legalDisclosure';
import styles from './LegalDisclosureModal.module.css';

export type LegalDisclosureStatus = {
  required: boolean;
  version: string;
  title: string;
  effective_date: string;
  body: string[];
  acknowledgment: string;
  accepted_at: string | null;
  next_required_at: string | null;
};

type Props = {
  enabled: boolean;
  onBlockingChange?: (blocked: boolean) => void;
  onLogout: () => void;
};

export default function LegalDisclosureModal({ enabled, onBlockingChange, onLogout }: Props) {
  const [disclosure, setDisclosure] = useState<LegalDisclosureStatus | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const status = await apiClient.get<LegalDisclosureStatus>('/api/v1/users/legal-disclosure/status', false);
      setDisclosure(status);
      onBlockingChange?.(status.required);
    } catch {
      setError('We could not load the required disclosure. Try again or sign out.');
      onBlockingChange?.(true);
    }
  }, [enabled, onBlockingChange]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const open = () => {
      setViewOnly(true);
      setAgreed(false);
      void load();
    };
    window.addEventListener(OPEN_LEGAL_DISCLOSURE_EVENT, open);
    return () => window.removeEventListener(OPEN_LEGAL_DISCLOSURE_EVENT, open);
  }, [load]);

  const isOpen = enabled && Boolean(disclosure?.required || viewOnly || error);
  const isRequired = Boolean(disclosure?.required || error);

  const accept = async () => {
    if (!disclosure || !agreed || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const updated = await apiClient.post<LegalDisclosureStatus>('/api/v1/users/legal-disclosure/accept', { version: disclosure.version });
      setDisclosure(updated);
      setViewOnly(false);
      setAgreed(false);
      onBlockingChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acceptance could not be saved.');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => setViewOnly(false)}
      dismissible={!isRequired}
      closeOnBackdrop={!isRequired}
      role={isRequired ? 'alertdialog' : 'dialog'}
      closeLabel="Close disclosure"
      title={disclosure?.title || 'Legal disclosure'}
      description={disclosure ? `Version ${disclosure.version} · Effective ${disclosure.effective_date}` : undefined}
      footer={isRequired ? (
        <>
          <Button variant="secondary" onClick={onLogout}>Sign out</Button>
          <Button variant="primary" disabled={!agreed || submitting || !disclosure} onClick={accept}>{submitting ? 'Saving...' : 'Agree and continue'}</Button>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setViewOnly(false)}>Close</Button>
      )}
    >
      <div className={styles.body}>
        {disclosure?.body.map(paragraph => <p key={paragraph} className={styles.text}>{paragraph}</p>)}
        <p className={styles.links}><Link href="/terms">Terms of service</Link><Link href="/privacy">Privacy policy</Link></p>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        {isRequired && disclosure ? (
          <CheckboxField label={disclosure.acknowledgment} checked={agreed} onChange={event => setAgreed(event.target.checked)} />
        ) : null}
        {isRequired ? <p className={styles.meta}>You need to accept this to use the tournament pages.</p> : null}
        {!isRequired && disclosure?.next_required_at ? <p className={styles.meta}>Accepted through {new Date(disclosure.next_required_at).toLocaleString()}.</p> : null}
      </div>
    </Modal>
  );
}
