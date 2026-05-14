import React, { useState } from 'react';

import styles from './MobileTable.module.css';
import { logger } from '../app/lib/logger';
import { handleTableArrowNavigation } from '../app/lib/tableKeyboard';

interface MobileTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: {
    key: string;
    label: string;
    render?: (value: unknown, row: T) => React.ReactNode;
    sortable?: boolean;
    width?: string;
    mobileHide?: boolean; // Hide on mobile
    mobilePriority?: number; // 1 = highest priority (always show)
  }[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function MobileTable({ 
  data, 
  columns, 
  onRowClick, 
  isLoading, 
  emptyMessage = 'No data available' 
}: MobileTableProps) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  // Filter columns for mobile - show priority columns first
  const mobileColumns = columns
    .filter(col => !col.mobileHide)
    .sort((a, b) => (a.mobilePriority || 999) - (b.mobilePriority || 999))
    .slice(0, 3); // Show max 3 columns on mobile

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortDirection('asc');
    }
    logger.userAction('Table sorted', { column: columnKey, direction: sortDirection });
  };

  const sortedData = React.useMemo(() => {
    if (!sortBy) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [data, sortBy, sortDirection]);

  if (isLoading) {
    return (
      <div className={styles.mobileTableLoading}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={styles.mobileLoadingRow}>
            <div className={`${styles.loadingSkeleton} ${styles.loadingSkeleton60}`} />
            <div className={`${styles.loadingSkeleton} ${styles.loadingSkeleton40}`} />
            <div className={`${styles.loadingSkeleton} ${styles.loadingSkeleton80}`} />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={styles.mobileTableEmpty}>
        <div className={styles.mobileTableEmptyMessage}>
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mobileTableContainer}>
      <div className={styles.mobileViewToggle}>
        <button
          onClick={() => setViewMode('cards')}
          className={`${styles.viewToggleBtn} ${viewMode === 'cards' ? styles.active : ''}`}
        >
          Cards
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
        >
          Table
        </button>
      </div>

      {viewMode === 'cards' ? (
        <div className={styles.mobileCardsView}>
          {sortedData.map((row, index) => (
            <div
              key={index}
              className={`${styles.mobileCard} ${onRowClick ? styles.mobileCardClickable : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {mobileColumns.map((column) => (
                <div key={column.key} className={styles.mobileCardRow}>
                  <div className={styles.mobileCardLabel}>
                    {column.label}
                  </div>
                  <div className={styles.mobileCardValue}>
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] || '-')
                    }
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.mobileTableWrapper}>
          <table className={styles.mobileTable} onKeyDownCapture={handleTableArrowNavigation}>
            <thead>
              <tr>
                {mobileColumns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => column.sortable && handleSort(column.key)}
                    className={`${styles.mobileTh} ${column.sortable ? styles.mobileThSortable : ''}`}
                  >
                    {column.label}
                    {column.sortable && sortBy === column.key && (
                      <span className={styles.mobileSortIndicator}>
                        {sortDirection === 'asc' ? ' (Low-High)' : ' (High-Low)'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={`${styles.mobileTableRow} ${onRowClick ? styles.mobileRowClickable : ''}`}
                >
                  {mobileColumns.map((column) => (
                    <td key={column.key} className={styles.mobileTd}>
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] || '-')
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
