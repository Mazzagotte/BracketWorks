import type { FormEvent } from 'react'
import { Search as SearchIcon } from 'lucide-react'

import buttonStyles from '../../styles/buttons.module.css'
import cardStyles from '../../styles/cards.module.css'
import formStyles from '../../styles/forms.module.css'
import primitiveStyles from '../../components/primitives/primitives.module.css'
import styles from '../entries.module.css'

interface EntriesSearchCardProps {
  isMobileView: boolean
  isCollapsed: boolean
  searchUsbc: string
  searchFirstName: string
  searchLastName: string
  hasActiveEntryFilters: boolean
  resultCount: number
  onToggleCollapsed: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSearchUsbcChange: (value: string) => void
  onSearchFirstNameChange: (value: string) => void
  onSearchLastNameChange: (value: string) => void
  onClear: () => void
}

export default function EntriesSearchCard({
  isMobileView, isCollapsed, searchUsbc, searchFirstName, searchLastName,
  hasActiveEntryFilters, resultCount, onToggleCollapsed, onSubmit,
  onSearchUsbcChange, onSearchFirstNameChange, onSearchLastNameChange, onClear,
}: EntriesSearchCardProps) {
  return (
    <div className={`${cardStyles.card} ${styles.formCard} ${styles.standaloneEntrySearchCard}`}>
      {isMobileView ? (
        <button type="button" className={`${cardStyles.cardHeader} ${styles.formTitleToggle}`} aria-expanded={!isCollapsed} onClick={onToggleCollapsed}>
          <span className={styles.entrySearchHeading}><SearchIcon aria-hidden="true" /> Search Entries</span>
          <span className={styles.formTitleExpandIcon}>{isCollapsed ? '+' : '−'}</span>
        </button>
      ) : (
        <h3 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${styles.formTitle} ${styles.entrySearchHeading}`}>
          <SearchIcon aria-hidden="true" /> Search Entries
        </h3>
      )}
      {(!isMobileView || !isCollapsed) && (
        <div className={styles.tableSearchPanelBody}>
          <form className={`${primitiveStyles.searchPanelContentRow} ${styles.entrySearchForm}`} onSubmit={onSubmit}>
            <div className={primitiveStyles.searchPanelContentLeft}>
              <input type="text" className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${primitiveStyles.searchPanelInput}`} placeholder="USBC #" value={searchUsbc} onChange={event => onSearchUsbcChange(event.target.value)} />
              <input type="text" className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${primitiveStyles.searchPanelInput}`} placeholder="First name" value={searchFirstName} onChange={event => onSearchFirstNameChange(event.target.value)} />
              <input type="text" className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${primitiveStyles.searchPanelInput}`} placeholder="Last name" value={searchLastName} onChange={event => onSearchLastNameChange(event.target.value)} />
            </div>
            <div className={primitiveStyles.searchPanelContentRight}>
              <button type="submit" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction} ${styles.searchActionBtn}`}>Search</button>
              <button type="button" className={`${primitiveStyles.searchPanelClearButton} ${styles.clearSearchBtn} ${hasActiveEntryFilters ? styles.clearSearchBtnActive : ''}`} onClick={onClear} disabled={!hasActiveEntryFilters}>Clear</button>
            </div>
          </form>
          {hasActiveEntryFilters && <p className={styles.entrySearchResults} aria-live="polite">{resultCount} {resultCount === 1 ? 'entry' : 'entries'} found</p>}
        </div>
      )}
    </div>
  )
}
