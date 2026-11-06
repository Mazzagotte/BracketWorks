'use client';

import { ConfirmDialog as SharedConfirmDialog } from '@bracketworks/ui';

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

/** Organizer confirmations use the shared dialog; `message` maps to its description. */
export default function ConfirmDialog({ message, confirmLabel = 'Confirm', error, ...rest }: ConfirmDialogProps) {
  return <SharedConfirmDialog {...rest} description={message} confirmLabel={confirmLabel} error={error ?? undefined} />;
}
