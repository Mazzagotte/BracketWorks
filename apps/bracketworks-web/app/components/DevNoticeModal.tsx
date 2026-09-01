'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { apiClient } from '../lib/api';
import CloseControl from '../../components/CloseControl';
import buttonStyles from '../styles/buttons.module.css';
import modalStyles from '../styles/modals.module.css';
import styles from './DevNoticeModal.module.css';

export interface DevNoticeModalProps {
  isOpen: boolean;
  /** 'require-acceptance': user must agree before continuing. 'view-only': read-only with a close button. */
  mode: 'require-acceptance' | 'view-only';
  noticeVersion: string;
  onAccepted?: () => void;
  onLogout?: () => void;
  onClose?: () => void;
}

const CHECKLIST_ITEMS = [
  'BracketWorks is still being developed',
  'Features may change without notice',
  'Errors and temporary service interruptions may occur',
  'Tournament information may require manual review or correction',
  'You are responsible for verifying results and payouts',
  'Important tournament records should be backed up separately',
  'Inactive accounts and their tournament data may be deleted at any time',
];

export default function DevNoticeModal({
  isOpen,
  mode,
  noticeVersion,
  onAccepted,
  onLogout,
  onClose,
}: DevNoticeModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setAcknowledged(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => (mode === 'require-acceptance' ? checkboxRef.current : dialogRef.current)?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mode === 'require-acceptance') event.preventDefault();
        else onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = priorOverflow;
      previous?.focus();
    };
  }, [isOpen, mode, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Never close on backdrop click in require-acceptance mode
    if (mode === 'require-acceptance') return;
    if (e.target === overlayRef.current) onClose?.();
  };

  const handleAgree = async () => {
    if (!acknowledged || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/api/v1/users/dev-notice/accept', { version: noticeVersion });
    } catch {
      setError('We could not save your acknowledgement. Check your connection and try again.');
      return;
    } finally {
      setSubmitting(false);
    }
    onAccepted?.();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={modalStyles.overlay}
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className={`${modalStyles.modal} ${modalStyles.compactModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-notice-title"
        tabIndex={-1}
      >
        {mode === 'view-only' && <CloseControl className={modalStyles.closeButton} position="absolute" size="sm" label="Close development notice" onClick={onClose} />}
        {/* Header */}
        <div className={`${modalStyles.header} ${styles.header}`}>
          <div className={styles.warningIcon} aria-hidden="true">
            <AlertTriangle size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className={styles.kicker}>
              {mode === 'require-acceptance' ? 'First Login — Development Notice (Required)' : 'Development Notice'}
            </p>
            <h2 id="dev-notice-title" className={styles.title}>
              BracketWorks Is Still in Development
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className={`${modalStyles.content} ${styles.body}`}>
          <p className={styles.bodyText}>
            BracketWorks is currently in active development and may contain incomplete features,
            errors, interruptions, or unexpected behavior.
          </p>
          <p className={styles.bodyText}>
            Tournament directors are responsible for reviewing and verifying all entries, scores,
            bracket results, standings, payouts, and exported reports before they are published,
            distributed, or relied upon.
          </p>
          <p className={styles.bodyText}>
            Please do not use BracketWorks as the only record of important tournament information.
            Maintain a separate backup of tournament entries, scores, results, and payout records
            while the platform remains in development.
          </p>
          <p className={styles.bodyText}>
            Inactive accounts, including their tournament data, may be deleted at any time.
            Maintain backups of any information you want to keep.
          </p>

          <p className={styles.sectionLabel}>By continuing, you acknowledge that:</p>
          <ul className={styles.checkList} aria-label="Acknowledgment checklist">
            {CHECKLIST_ITEMS.map(item => (
              <li key={item} className={styles.checkItem}>
                <CheckCircle2 size={16} className={styles.checkIcon} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          {mode === 'require-acceptance' && (
            <div className={styles.acknowledgment}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  ref={checkboxRef}
                  className={styles.checkboxInput}
                  checked={acknowledged}
                  onChange={e => setAcknowledged(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>
                  I acknowledge that BracketWorks is currently in development, and I agree to
                  independently review and verify tournament data, results, and payouts before
                  relying on or publishing them. I understand that inactive accounts and their
                  tournament data may be deleted at any time.
                </span>
              </label>
            </div>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>

        {/* Footer */}
        <div className={`${modalStyles.footer} ${styles.footer}`}>
          {mode === 'require-acceptance' ? (
            <>
              <button
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.fullWidth}`}
                disabled={!acknowledged || submitting}
                onClick={handleAgree}
              >
                {submitting ? 'Saving…' : 'Agree and Continue'}
              </button>
              <button className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.fullWidth}`} onClick={onLogout}>
                Cancel and Log Out
              </button>
            </>
          ) : (
            <button className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.fullWidth}`} onClick={onClose}>
              Close
            </button>
          )}
        </div>
        {mode === 'require-acceptance' && (
          <p className={styles.footerHint}>
            <Lock size={11} aria-hidden="true" />
            You must agree to continue.
          </p>
        )}
      </div>
    </div>
  );
}
