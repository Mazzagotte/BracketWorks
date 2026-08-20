import { Search } from 'lucide-react'

import { SearchPanel } from '../../components/primitives'
import formStyles from '../../styles/forms.module.css'
import primitiveStyles from '../../components/primitives/primitives.module.css'
import styles from '../payouts.module.css'

type PayoutsSearchPanelProps = {
  searchFirstName: string
  searchLastName: string
  onSearchFirstNameChange: (value: string) => void
  onSearchLastNameChange: (value: string) => void
  onClear: () => void
}

export default function PayoutsSearchPanel({
  searchFirstName,
  searchLastName,
  onSearchFirstNameChange,
  onSearchLastNameChange,
  onClear,
}: PayoutsSearchPanelProps) {
  const hasSearch = searchFirstName.trim().length > 0 || searchLastName.trim().length > 0

  return (
    <SearchPanel
      className={styles.searchStandalone}
      title={<span className={styles.sectionTitle}><Search aria-hidden="true" />Search Payouts</span>}
      useToolbar={false}
      accented={false}
      left={(
        <>
          <input
            type="text"
            placeholder="First name"
            value={searchFirstName}
            onChange={(event) => onSearchFirstNameChange(event.target.value)}
            className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
          />
          <input
            type="text"
            placeholder="Last name"
            value={searchLastName}
            onChange={(event) => onSearchLastNameChange(event.target.value)}
            className={`${formStyles.search} ${formStyles.compactControl} ${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
          />
        </>
      )}
      right={(
        <button
          type="button"
          className={primitiveStyles.searchPanelClearButton}
          onClick={onClear}
          disabled={!hasSearch}
        >
          Clear
        </button>
      )}
    />
  )
}
