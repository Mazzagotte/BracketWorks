'use client';

import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ICON_SIZE } from '../iconSize';
import { Button } from './Button';
import { cx } from './cx';
import styles from './Overlay.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** `sm` 448px, `md` 576px (default), `lg` 768px. */
  size?: 'sm' | 'md' | 'lg';
  /** Actions, right-aligned: secondary first, then primary. */
  footer?: ReactNode;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  children?: ReactNode;
  className?: string;
}

/** The only overlay. No cards inside it. */
export function Modal({ open, onClose, title, description, size = 'md', footer, closeOnBackdrop = true, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    if (!firstElement || !lastElement) return;
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(styles.dialog, styles[size], className)}
        onKeyDown={trapFocus}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
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
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for consequential actions. */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancel', tone = 'default', busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
