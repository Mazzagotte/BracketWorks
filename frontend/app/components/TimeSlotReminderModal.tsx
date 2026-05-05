'use client'

import { useEffect, useState } from 'react'
import styles from './TimeSlotReminderModal.module.css'

const EVENT_NAME = 'bw-select-time-slot-reminder'

export function TimeSlotReminderModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleOpen = () => setOpen(true)
    window.addEventListener(EVENT_NAME, handleOpen)
    return () => window.removeEventListener(EVENT_NAME, handleOpen)
  }, [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.modal} onClick={event => event.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Select Time Slot</h3>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>
            Please select a time slot from the available times on the Dashboard before leaving this page.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
