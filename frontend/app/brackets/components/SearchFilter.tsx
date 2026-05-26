import React from 'react';
import styles from '../styles/search-filter.module.css';

export interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onClearFilters: () => void;
  searchResultCount?: number | null;
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  onClearFilters,
  searchResultCount,
}: SearchFilterProps) {
  return (
    <div className={styles.container}>
      <div className={styles.filterGroup}>
        <label className={styles.label}>
          <span className={styles.labelText}>Search Bowlers</span>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchTerm) {
                  onSearchChange('')
                }
              }}
              placeholder="Search by bowler name across visible brackets..."
              className={styles.searchInput}
              aria-label="Search bowlers"
            />
          </div>
          {searchTerm && searchResultCount !== null && searchResultCount !== undefined && (
            <span className={`${styles.resultCount} ${searchResultCount === 0 ? styles.resultCountEmpty : ''}`}>
              {searchResultCount === 0
                ? 'No brackets match this player search'
                : `${searchResultCount} bracket${searchResultCount !== 1 ? 's' : ''} match this player search`}
            </span>
          )}
        </label>

        {searchTerm && (
          <button
            onClick={onClearFilters}
            className={styles.clearButton}
            aria-label="Clear search"
          >
            <span className={styles.clearIcon}>x</span>
            <span>Clear Search</span>
          </button>
        )}
      </div>
    </div>
  );
}
