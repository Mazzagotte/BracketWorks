import React from 'react';
import { RefreshCcw, Search, UserRound } from 'lucide-react';
import primitiveStyles from '../../components/primitives/primitives.module.css';
import styles from '../styles/search-filter.module.css';

export interface SearchFilterProps {
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onClearFilters: () => void;
  searchResultCount?: number | null;
}

export function SearchFilter({
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  onClearFilters,
  searchResultCount,
}: SearchFilterProps) {
  const hasSearch = firstName.trim().length > 0 || lastName.trim().length > 0;

  return (
    <div className={styles.container}>
      <span className={styles.searchHeading}>
          <Search aria-hidden="true" />
          Find Bowler
      </span>
      <div className={styles.searchInputsRow}>
        <label className={styles.searchInputWrap}>
          <UserRound aria-hidden="true" />
          <input
            type="text"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && hasSearch) onClearFilters()
            }}
            placeholder="First name"
            className={`${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
            aria-label="Search by first name"
          />
        </label>
        <label className={styles.searchInputWrap}>
          <UserRound aria-hidden="true" />
          <input
            type="text"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && hasSearch) onClearFilters()
            }}
            placeholder="Last name"
            className={`${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
            aria-label="Search by last name"
          />
        </label>
      </div>
      <span className={`${styles.resultCount} ${searchResultCount === 0 ? styles.resultCountEmpty : ''}`}>
        {hasSearch && searchResultCount !== null && searchResultCount !== undefined
          ? searchResultCount === 0
            ? 'No brackets found'
            : `${searchResultCount} bracket${searchResultCount !== 1 ? 's' : ''} found`
          : 'Search by player name'}
      </span>
      <button
        onClick={onClearFilters}
        className={`${primitiveStyles.searchPanelClearButton} ${styles.clearButton}`}
        aria-label="Clear search"
        disabled={!hasSearch}
      >
        <RefreshCcw aria-hidden="true" />
        Clear
      </button>
    </div>
  );
}
