import React from 'react';
import { SearchPanel } from '../../components/primitives';
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
    <SearchPanel
      className={styles.container}
      title="Search Bowlers"
      useToolbar={false}
      left={(
        <div className={styles.searchFieldStack}>
          <div className={styles.searchInputsRow}>
            <input
              type="text"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && hasSearch) {
                  onClearFilters()
                }
              }}
              placeholder="First name"
              className={`${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
              aria-label="Search by first name"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && hasSearch) {
                  onClearFilters()
                }
              }}
              placeholder="Last name"
              className={`${styles.searchInput} ${primitiveStyles.searchPanelInput}`}
              aria-label="Search by last name"
            />
          </div>
          {hasSearch && searchResultCount !== null && searchResultCount !== undefined && (
            <span className={`${styles.resultCount} ${searchResultCount === 0 ? styles.resultCountEmpty : ''}`}>
              {searchResultCount === 0
                ? 'No brackets match this name search'
                : `${searchResultCount} bracket${searchResultCount !== 1 ? 's' : ''} match this name search`}
            </span>
          )}
        </div>
      )}
      right={(
        <button
          onClick={onClearFilters}
          className={`${primitiveStyles.searchPanelClearButton} ${styles.clearButton}`}
          aria-label="Clear search"
          disabled={!hasSearch}
        >
          Clear
        </button>
      )}
    />
  );
}
