import React from "react";

import CloseControl from "../../components/CloseControl";
import styles from "./ConfirmationDialog.module.css";

interface ConfirmationDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ open, message, onClose }) => {
  if (!open) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <CloseControl onClick={onClose} position="absolute" size="sm" label="Close confirmation dialog" />
        <h2 className={styles.title}>Success</h2>
        <p className={styles.message}>{message}</p>
        <button className={styles.okButton} onClick={onClose}>OK</button>
      </div>
    </div>
  );
};

export default ConfirmationDialog;

