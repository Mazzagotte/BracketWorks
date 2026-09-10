'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCcw, Search as SearchIcon, UserRound } from 'lucide-react'

import CloseControl from '../../../components/CloseControl'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import type { BowlerHistoryProfile } from '../hooks/useBowlerHistorySearch'
import buttonStyles from '../../styles/buttons.module.css'
import formStyles from '../../styles/forms.module.css'
import modalStyles from '../../styles/modals.module.css'
import primitiveStyles from '../../components/primitives/primitives.module.css'
import styles from '../entries.module.css'

interface FindExistingBowlerModalProps {
  isOpen: boolean
  onClose: () => void
  historySearchUsbc: string
  historySearchFirstName: string
  historySearchLastName: string
  historyResults: BowlerHistoryProfile[]
  isHistorySearching: boolean
  hasHistorySearchInput: boolean
  hasSubmittedSearch: boolean
  onSearchUsbcChange: (value: string) => void
  onSearchFirstNameChange: (value: string) => void
  onSearchLastNameChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  onUseBowler: (profile: BowlerHistoryProfile) => void
}

export default function FindExistingBowlerModal({
  isOpen,
  onClose,
  historySearchUsbc,
  historySearchFirstName,
  historySearchLastName,
  historyResults,
  isHistorySearching,
  hasHistorySearchInput,
  hasSubmittedSearch,
  onSearchUsbcChange,
  onSearchFirstNameChange,
  onSearchLastNameChange,
  onSearch,
  onClear,
  onUseBowler,
}: FindExistingBowlerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const canClear = hasHistorySearchInput || hasSubmittedSearch || isHistorySearching || historyResults.length > 0
  const { onOverlayClick } = useModalBehavior({
    open: isOpen,
    onClose,
    dialogRef,
    initialFocusRef: firstInputRef,
  })

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className={modalStyles.overlay} onClick={onOverlayClick}>
      <div
        ref={dialogRef}
        className={`${modalStyles.modal} ${styles.findExistingBowlerModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-existing-bowler-title"
        tabIndex={-1}
      >
        <div className={modalStyles.header}>
          <div>
            <p className={modalStyles.kicker}>Entries</p>
            <h2 id="find-existing-bowler-title">Find Existing Bowler</h2>
            <p className={styles.findBowlerSubtitle}>Reuse a bowler profile from a previous tournament.</p>
          </div>
          <CloseControl onClick={onClose} position="absolute" size="sm" label="Close modal" className={modalStyles.closeButton} />
        </div>

        <div className={`${modalStyles.content} ${styles.findExistingBowlerContent}`}>
          <form
            className={styles.findExistingBowlerSearch}
            onSubmit={(event) => {
              event.preventDefault()
              onSearch()
            }}
          >
            <div className={styles.findExistingBowlerFields}>
              <label className={styles.findBowlerInputWrap}>
                <UserRound aria-hidden="true" />
                <input
                  ref={firstInputRef}
                  type="text"
                  className={`${formStyles.search} ${formStyles.compactControl} ${styles.findExistingBowlerInput}`}
                  placeholder="USBC #"
                  aria-label="USBC number"
                  value={historySearchUsbc}
                  onChange={(event) => onSearchUsbcChange(event.target.value)}
                />
              </label>
              <label className={styles.findBowlerInputWrap}>
                <UserRound aria-hidden="true" />
                <input
                  type="text"
                  className={`${formStyles.search} ${formStyles.compactControl} ${styles.findExistingBowlerInput}`}
                  placeholder="First name"
                  aria-label="First name"
                  value={historySearchFirstName}
                  onChange={(event) => onSearchFirstNameChange(event.target.value)}
                />
              </label>
              <label className={styles.findBowlerInputWrap}>
                <UserRound aria-hidden="true" />
                <input
                  type="text"
                  className={`${formStyles.search} ${formStyles.compactControl} ${styles.findExistingBowlerInput}`}
                  placeholder="Last name"
                  aria-label="Last name"
                  value={historySearchLastName}
                  onChange={(event) => onSearchLastNameChange(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.findExistingBowlerActions}>
              <button type="submit" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction} ${styles.searchActionBtn}`} disabled={!hasHistorySearchInput}>
                <SearchIcon aria-hidden="true" />
                Find Bowler
              </button>
              <button type="button" className={`${primitiveStyles.searchPanelClearButton} ${styles.clearSearchBtn} ${canClear ? styles.clearSearchBtnActive : ''}`} onClick={onClear} disabled={!canClear}>
                <RefreshCcw aria-hidden="true" />
                Clear
              </button>
            </div>
          </form>

          <div className={styles.findExistingBowlerResults}>
            {isHistorySearching ? (
              <p className={styles.historyMeta}>Searching bowler history...</p>
            ) : historyResults.length > 0 ? (
              <div className={styles.historyResults}>
                <p className={styles.historyMeta}>{historyResults.length} {historyResults.length === 1 ? 'bowler' : 'bowlers'} found</p>
                <div className={styles.historyResultsList}>
                  {historyResults.map(profile => (
                    <button key={profile.id} type="button" className={styles.historyResultButton} onClick={() => onUseBowler(profile)}>
                      <span className={styles.historyResultName}>{profile.first_name} {profile.last_name}</span>
                      <span className={styles.historyResultUsbc}>{profile.usbc_number ? `USBC ${profile.usbc_number}` : 'No USBC on file'}</span>
                      <span className={styles.historyResultAction}>Use Bowler</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : hasSubmittedSearch && hasHistorySearchInput ? (
              <p className={styles.historyMeta}>No matching bowlers found.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}