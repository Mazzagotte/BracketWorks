'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ICON_SIZE } from '../iconSize';
import { useModalFocus } from '../useModalFocus';
import { Button } from './Button';
import { cx } from './cx';
import styles from './Overlay.module.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** `sm` 448px, `md` 576px (default), `lg` 768px. */
  size?: 'sm' | 'md' | 'lg';
  /** Actions, right-aligned: secondary first, then primary. */
  footer?: ReactNode;
  /** `alertdialog` for confirmations that interrupt the user. Default `dialog`. */
  role?: 'dialog' | 'alertdialog';
  /** Accessible name of the close button. Default "Close". */
  closeLabel?: string;
  /** When false, Escape, the backdrop, and the close button do nothing (for example while saving). */
  dismissible?: boolean;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * The only overlay. Focus moves to the dialog, Tab stays inside, Escape closes only the top
 * modal, page scroll is locked, and focus returns to the trigger. No cards inside it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  role = 'dialog',
  closeLabel = 'Close',
  dismissible = true,
  closeOnBackdrop = true,
  children,
  className,
}: ModalProps) {
  const close = () => {
    if (dismissible) onClose();
  };
  const dialogRef = useModalFocus<HTMLDivElement>(open, close);
  const titleId = useId();
  const descriptionId = useId();

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={dismissible ? undefined : true}
        tabIndex={-1}
        className={cx(styles.dialog, styles[size], className)}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label={closeLabel} disabled={!dismissible}>
            <svg width={ICON_SIZE.md} height={ICON_SIZE.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>
        {children ? <div className={styles.body}>{children}</div> : null}
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` uses the solid danger button: the one place it appears. */
  tone?: 'default' | 'danger';
  /** While true, the dialog cannot be dismissed and both buttons are disabled. */
  busy?: boolean;
  /** Confirm button text while busy. Default: the confirm label. */
  busyLabel?: string;
  /** Shown above the actions when the action fails. */
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for consequential actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  busyLabel,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      role="alertdialog"
      closeLabel="Close confirmation"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel ?? confirmLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </Modal>
  );
}
