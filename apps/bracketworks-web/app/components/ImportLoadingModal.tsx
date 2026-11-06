'use client'

import { Modal } from '@bracketworks/ui'

import styles from './ImportLoadingModal.module.css'

interface ImportLoadingModalProps {
  isOpen: boolean
  fileName?: string
}

/** Blocks the page while an Excel import runs. It cannot be dismissed. */
export default function ImportLoadingModal({ isOpen, fileName }: ImportLoadingModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={() => undefined}
      dismissible={false}
      size="sm"
      title="Importing bowlers"
      description={fileName}
    >
      <div className={styles.status} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.text}>Please wait and stay on this page.</p>
      </div>
    </Modal>
  )
}
