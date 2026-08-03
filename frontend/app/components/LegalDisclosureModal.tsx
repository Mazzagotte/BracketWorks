'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileCheck2, Lock } from 'lucide-react';
import { apiClient } from '../lib/api';
import { OPEN_LEGAL_DISCLOSURE_EVENT } from '../lib/legalDisclosure';
import buttonStyles from '../styles/buttons.module.css';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => (checkboxRef.current || dialogRef.current)?.focus(), 0);

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isRequired) event.preventDefault();
        else setViewOnly(false);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.body.style.overflow = priorOverflow;
      previous?.focus();
    };
  }, [isOpen, isRequired]);

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

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="legal-disclosure-title" tabIndex={-1}>
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true"><FileCheck2 size={20} /></span>
          <div><p>{isRequired ? 'Required disclosure' : 'Account disclosure'}</p><h2 id="legal-disclosure-title">{disclosure?.title || 'Legal Disclosure'}</h2></div>
        </header>
        <div className={styles.body}>
          {disclosure && <p className={styles.meta}>Version {disclosure.version} · Effective {disclosure.effective_date}</p>}
          {disclosure?.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <p className={styles.links}><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link></p>
          {error && <div className={styles.error} role="alert">{error}</div>}
          {isRequired && disclosure && (
            <label className={styles.checkRow}>
              <input ref={checkboxRef} type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
              <span>{disclosure.acknowledgment}</span>
            </label>
          )}
          {!isRequired && disclosure?.next_required_at && <p className={styles.renewal}>Accepted through {new Date(disclosure.next_required_at).toLocaleString()}.</p>}
        </div>
        <footer className={styles.footer}>
          {isRequired ? <>
            <button className={`${buttonStyles.button} ${buttonStyles.primary}`} disabled={!agreed || submitting || !disclosure} onClick={accept}>{submitting ? 'Saving...' : 'Agree and Continue'}</button>
            <button className={`${buttonStyles.button} ${buttonStyles.secondary}`} onClick={onLogout}>Sign Out</button>
          </> : <button className={`${buttonStyles.button} ${buttonStyles.primary}`} onClick={() => setViewOnly(false)}>Close</button>}
        </footer>
        {isRequired && <div className={styles.requiredHint}><Lock size={12} /> Acceptance is required to use tournament-management pages.</div>}
      </div>
    </div>
  );
}
