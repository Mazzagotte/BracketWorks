"use client";

import React from "react";

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
        <div className={styles.header}>
          <h2 className={styles.title}>Success</h2>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            <button className={styles.okButton} onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;

