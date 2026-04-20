import React from 'react';
import styles from '../styles/search-filter.module.css';

export interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedSeedRange: string;
  onSeedRangeChange: (range: string) => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
  searchResultCount?: number | null;
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedSeedRange,
  onSeedRangeChange,
  onClearFilters,
  activeFiltersCount,
  searchResultCount,
}: SearchFilterProps) {
  return (
    <div className={styles.container}>
      <div className={styles.filterGroup}>
        <label className={styles.label}>
          <span className={styles.labelText}>Search Players</span>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, USBC number..."
              className={styles.searchInput}
              aria-label="Search players"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className={styles.clearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          {searchTerm && searchResultCount !== null && searchResultCount !== undefined && (
            <span className={`${styles.resultCount} ${searchResultCount === 0 ? styles.resultCountEmpty : ''}`}>
              {searchResultCount === 0
                ? 'No players found'
                : `${searchResultCount} player${searchResultCount !== 1 ? 's' : ''} found`}
            </span>
          )}
        </label>

        <label className={styles.label}>
          <span className={styles.labelText}>Match Status</span>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className={styles.select}
            aria-label="Filter by match status"
          >
            <option value="all">All Matches</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="next_up">Next Up</option>
          </select>
        </label>

        <label className={styles.label}>
          <span className={styles.labelText}>Seed Range</span>
          <select
            value={selectedSeedRange}
            onChange={(e) => onSeedRangeChange(e.target.value)}
            className={styles.select}
            aria-label="Filter by seed range"
          >
            <option value="all">All Seeds</option>
            <option value="1-4">Top Seeds (1-4)</option>
            <option value="5-8">5-8 Seeds</option>
            <option value="9-16">9-16 Seeds</option>
            <option value="17+">Lower Seeds (17+)</option>
          </select>
        </label>

        {activeFiltersCount > 0 && (
          <button
            onClick={onClearFilters}
            className={styles.clearButton}
            aria-label={`Clear ${activeFiltersCount} active filters`}
          >
            <span className={styles.clearIcon}>🗑️</span>
            <span>Clear Filters</span>
            <span className={styles.badge}>{activeFiltersCount}</span>
          </button>
        )}
      </div>
    </div>
  );
}
