import CloseControl from '../../components/CloseControl';
import styles from './ActionConfirmDialog.module.css';

interface ActionConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCloseButton?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ActionConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  showCloseButton = false,
  onConfirm,
  onCancel,
}: ActionConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={`surface-card ${styles.dialog}`} role="dialog" aria-modal="true" aria-label={title}>
        {showCloseButton && (
          <CloseControl onClick={onCancel} position="absolute" size="sm" label="Close confirmation dialog" />
        )}
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.actionButton} ${styles.cancelButton}`} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={`${styles.actionButton} ${styles.confirmButton}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}