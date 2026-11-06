'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button, Modal, buttonClassName } from '@bracketworks/ui'

import styles from './HelpGuideModal.module.css'

interface HelpGuideModalProps {
  open: boolean
  onClose: () => void
  /** For example "Entries guide". */
  title: string
  /** Anchor on the getting-started page, for example "entries". */
  section: string
  children: ReactNode
}

/** A page's help guide: plain sections split by dividers inside the shared Modal. */
export default function HelpGuideModal({ open, onClose, title, section, children }: HelpGuideModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      description="See how this area connects to the rest of the tournament in the full workflow."
      footer={(
        <>
          <Link href={`/help/getting-started#${section}`} className={buttonClassName({ variant: 'secondary' })}>View full workflow</Link>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </>
      )}
    >
      <div className={styles.guide}>{children}</div>
    </Modal>
  )
}
