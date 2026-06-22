"use client";

import React from "react";

import styles from "./ConfirmationDialog.module.css";
import modalStyles from "../styles/modals.module.css";
import buttonStyles from "../styles/buttons.module.css";

interface ConfirmationDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ open, message, onClose }) => {
  if (!open) return null;
  return (
    <div className={modalStyles.overlay}>
      <div className={`${modalStyles.modal} ${modalStyles.compactModal}`}>
        <div className={modalStyles.header}>
          <h2 className={styles.title}>Success</h2>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            <button className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.okButton}`} onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;

