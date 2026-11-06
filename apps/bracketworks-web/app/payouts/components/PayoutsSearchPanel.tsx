import { Button, Card, CardHeader, TextField } from '@bracketworks/ui'

import styles from './Payouts.module.css'

type PayoutsSearchPanelProps = {
  searchFirstName: string
  searchLastName: string
  onSearchFirstNameChange: (value: string) => void
  onSearchLastNameChange: (value: string) => void
  onClear: () => void
}

/** Filters payout results by first or last name as you type. */
export default function PayoutsSearchPanel({
  searchFirstName,
  searchLastName,
  onSearchFirstNameChange,
  onSearchLastNameChange,
  onClear,
}: PayoutsSearchPanelProps) {
  const hasSearch = searchFirstName.trim().length > 0 || searchLastName.trim().length > 0

  return (
    <Card aria-label="Search payouts">
      <CardHeader title="Search payouts" />
      <div className={styles.searchForm}>
        <TextField label="First name" value={searchFirstName} onChange={event => onSearchFirstNameChange(event.target.value)} />
        <TextField label="Last name" value={searchLastName} onChange={event => onSearchLastNameChange(event.target.value)} />
        <Button variant="ghost" onClick={onClear} disabled={!hasSearch}>Clear</Button>
      </div>
    </Card>
  )
}
