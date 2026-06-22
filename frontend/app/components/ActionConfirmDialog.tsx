import CloseControl from '../../components/CloseControl';
import styles from './ActionConfirmDialog.module.css';
import modalStyles from '../styles/modals.module.css';
import buttonStyles from '../styles/buttons.module.css';

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
    <div className={modalStyles.overlay}>
      <div className={`${modalStyles.modal} ${modalStyles.compactModal}`} role="dialog" aria-modal="true" aria-label={title}>
        {showCloseButton && (
          <CloseControl onClick={onCancel} position="absolute" size="sm" label="Close confirmation dialog" />
        )}
        <div className={modalStyles.header}>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.actionButton}`} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={`${buttonStyles.button} ${buttonStyles.danger} ${styles.actionButton}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
