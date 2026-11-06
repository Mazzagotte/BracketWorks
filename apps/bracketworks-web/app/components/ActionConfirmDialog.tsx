import { ConfirmDialog } from '@bracketworks/ui';

interface ActionConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Kept for existing callers; the shared dialog always has a close button. */
  showCloseButton?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** BracketWorks confirmations for destructive actions, on the shared ConfirmDialog. */
export default function ActionConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ActionConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
