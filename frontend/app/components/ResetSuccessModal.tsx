'use client';

import styles from './ResetSuccessModal.module.css';

interface ResetSuccessModalProps {
  isOpen: boolean;
  countdown: number;
  onDismiss: () => void;
}

export default function ResetSuccessModal({
  isOpen,
  countdown,
  onDismiss,
}: ResetSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-reset-success-title"
      >
        <div className={styles.header}>
          <h2 id="password-reset-success-title" className={styles.title}>
            Password Updated
          </h2>
          <p className={styles.text}>
            Your password has been reset successfully. You can log in now with your new password.
          </p>
        </div>
        <div className={styles.countdown}>
          This message closes in {countdown}s.
        </div>
        <button
          type="button"
          className={styles.button}
          onClick={onDismiss}
        >
          Continue to Login
        </button>
      </div>
    </div>
  );
}
