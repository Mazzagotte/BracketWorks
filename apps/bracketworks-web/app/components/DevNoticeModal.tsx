'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { apiClient } from '../lib/api';
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
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) setAcknowledged(false);
  }, [isOpen]);

  // Block Escape key in require-acceptance mode
  useEffect(() => {
    if (!isOpen || mode !== 'require-acceptance') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, mode]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Never close on backdrop click in require-acceptance mode
    if (mode === 'require-acceptance') return;
    if (e.target === overlayRef.current) onClose?.();
  };

  const handleAgree = async () => {
    if (!acknowledged || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post('/api/v1/users/dev-notice/accept', { version: noticeVersion });
    } catch {
      // Non-critical — proceed even if the request fails; the notice will reappear next login.
    } finally {
      setSubmitting(false);
    }
    onAccepted?.();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-notice-title"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.warningIcon} aria-hidden="true">
            <AlertTriangle size={18} strokeWidth={2.5} />
          </div>
          <div className={styles.headerText}>
            <p className={styles.kicker}>
              {mode === 'require-acceptance' ? 'First Login — Development Notice (Required)' : 'Development Notice'}
            </p>
            <h2 id="dev-notice-title" className={styles.title}>
              BracketWorks Is Still in Development
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
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
                  className={styles.checkboxInput}
                  checked={acknowledged}
                  onChange={e => setAcknowledged(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>
                  I acknowledge that BracketWorks is currently in development, and I agree to
                  independently review and verify tournament data, results, and payouts before
                  relying on or publishing them.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {mode === 'require-acceptance' ? (
            <>
              <button
                className={styles.agreeButton}
                disabled={!acknowledged || submitting}
                onClick={handleAgree}
              >
                {submitting ? 'Saving…' : 'Agree and Continue'}
              </button>
              <button className={styles.cancelButton} onClick={onLogout}>
                Cancel and Log Out
              </button>
            </>
          ) : (
            <button className={styles.closeButton} onClick={onClose}>
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
