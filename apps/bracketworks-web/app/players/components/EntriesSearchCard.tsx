import type { FormEvent } from 'react'
import { Button, Card, CardHeader, TextField } from '@bracketworks/ui'

import styles from './EntriesPanels.module.css'

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

/** Search entries by USBC number or name. Collapsible on phones. */
export default function EntriesSearchCard({
  isMobileView, isCollapsed, searchUsbc, searchFirstName, searchLastName,
  hasActiveEntryFilters, resultCount, onToggleCollapsed, onSubmit,
  onSearchUsbcChange, onSearchFirstNameChange, onSearchLastNameChange, onClear,
}: EntriesSearchCardProps) {
  const isOpen = !isMobileView || !isCollapsed
  return (
    <Card aria-label="Search entries">
      <CardHeader
        title="Search entries"
        description={hasActiveEntryFilters ? `${resultCount} ${resultCount === 1 ? 'entry' : 'entries'} found` : undefined}
        actions={isMobileView ? (
          <Button size="sm" variant="ghost" onClick={onToggleCollapsed} aria-expanded={!isCollapsed}>
            {isCollapsed ? 'Show' : 'Hide'}
          </Button>
        ) : undefined}
      />
      {isOpen ? (
        <form className={styles.searchForm} onSubmit={onSubmit}>
          <TextField label="USBC number" value={searchUsbc} onChange={event => onSearchUsbcChange(event.target.value)} />
          <TextField label="First name" value={searchFirstName} onChange={event => onSearchFirstNameChange(event.target.value)} />
          <TextField label="Last name" value={searchLastName} onChange={event => onSearchLastNameChange(event.target.value)} />
          <div className={styles.searchActions}>
            <Button type="button" variant="ghost" onClick={onClear} disabled={!hasActiveEntryFilters}>Clear</Button>
            <Button type="submit" variant="secondary">Search</Button>
          </div>
        </form>
      ) : null}
    </Card>
  )
}
