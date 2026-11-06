'use client';

import { useEffect, useState } from 'react';
import { Button, CheckboxField, Modal, Notice } from '@bracketworks/ui';
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

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setAcknowledged(false);
      setError('');
    }
  }, [isOpen]);

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

  const requireAcceptance = mode === 'require-acceptance';

  return (
    <Modal
      open={isOpen}
      onClose={() => onClose?.()}
      dismissible={!requireAcceptance}
      closeOnBackdrop={!requireAcceptance}
      role={requireAcceptance ? 'alertdialog' : 'dialog'}
      closeLabel="Close development notice"
      title="BracketWorks is still in development"
      description={requireAcceptance ? 'Please read and accept this notice before you continue.' : undefined}
      footer={requireAcceptance ? (
        <>
          <Button variant="secondary" onClick={onLogout}>Cancel and log out</Button>
          <Button variant="primary" disabled={!acknowledged || submitting} onClick={handleAgree}>
            {submitting ? 'Saving...' : 'Agree and continue'}
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={onClose}>Close</Button>
      )}
    >
      <div className={styles.body}>
        <p className={styles.text}>
          BracketWorks is in active development and may contain incomplete features, errors, interruptions, or unexpected behavior.
        </p>
        <p className={styles.text}>
          Tournament directors are responsible for reviewing and verifying all entries, scores, bracket results, standings,
          payouts, and exported reports before they are published, distributed, or relied on.
        </p>
        <p className={styles.text}>
          Do not use BracketWorks as the only record of important tournament information. Keep a separate backup of entries,
          scores, results, and payout records while the platform is in development. Inactive accounts, including their
          tournament data, may be deleted at any time.
        </p>
        <h3 className={styles.label}>By continuing, you acknowledge that:</h3>
        <ul className={styles.list} aria-label="Acknowledgment checklist">
          {CHECKLIST_ITEMS.map(item => <li key={item}>{item}</li>)}
        </ul>
        {requireAcceptance ? (
          <CheckboxField
            label="I understand and agree"
            helper="I will independently review and verify tournament data, results, and payouts before relying on or publishing them, and I understand that inactive accounts and their data may be deleted at any time."
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
          />
        ) : null}
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
      </div>
    </Modal>
  );
}
