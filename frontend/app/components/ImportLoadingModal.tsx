'use client'

import { createPortal } from 'react-dom'
import styles from './ImportLoadingModal.module.css'

interface ImportLoadingModalProps {
  isOpen: boolean
  fileName?: string
}

export default function ImportLoadingModal({ isOpen, fileName }: ImportLoadingModalProps) {
  if (!isOpen) return null

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Importing players">
      <div className={styles.card}>
        <div className={styles.bowlingBall}>
          <div className={styles.ballBody} />
          <div className={`${styles.fingerHole} ${styles.fingerHole1}`} />
          <div className={`${styles.fingerHole} ${styles.fingerHole2}`} />
          <div className={`${styles.fingerHole} ${styles.fingerHole3}`} />
        </div>
        <h2 className={styles.title}>Importing Players…</h2>
        {fileName && <p className={styles.subtitle}>{fileName}</p>}
        <p className={styles.subtitle}>Please wait, do not navigate away.</p>
      </div>
    </div>,
    document.body
  )
}
