import CloseControl from '../../components/CloseControl';
import styles from './ActionConfirmDialog.module.css';

interface ActionConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ActionConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ActionConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={`surface-card ${styles.dialog}`} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <CloseControl onClick={onCancel} position="absolute" size="sm" label="Close confirmation dialog" />
        <div className={`surface-cardHeader ${styles.header}`}>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            <button type="button" className={`ds-btn ds-btn-secondary ds-btn-sm ${styles.cancelButton}`} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={`ds-btn ds-btn-sm ${styles.confirmButton}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}