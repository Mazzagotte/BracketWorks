'use client';

import { useModalFocus } from '@/lib/useModalFocus';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, Trash2, X } from 'lucide-react';

import styles from './ConfirmDialog.module.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
  busy = false,
  error,
}: ConfirmDialogProps) {
  const close = () => { if (!busy) onCancel(); };
  const dialogRef = useModalFocus<HTMLElement>(open, close);
  const titleId = useId();
  const messageId = useId();

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section ref={dialogRef} tabIndex={-1} className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} aria-busy={busy}>
        <header className={styles.header}>
          <span className={`${styles.icon} ${tone === 'danger' ? styles.dangerIcon : ''}`} aria-hidden="true">
            {tone === 'danger' ? <Trash2 size={22} /> : <CircleAlert size={22} />}
          </span>
          <button type="button" className={styles.closeButton} aria-label="Close confirmation" onClick={close} disabled={busy}><X size={20} aria-hidden="true" /></button>
        </header>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <footer>
          <button type="button" className={styles.cancelButton} onClick={close} disabled={busy}>{cancelLabel}</button>
          <button
            type="button"
            className={tone === 'danger' ? styles.dangerButton : styles.confirmButton}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
