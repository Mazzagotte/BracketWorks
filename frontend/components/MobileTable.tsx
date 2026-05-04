import React, { useState } from 'react';

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
      <div className="mobile-table-loading">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="mobile-loading-row">
            <div className="loading-skeleton loading-skeleton-60" />
            <div className="loading-skeleton loading-skeleton-40" />
            <div className="loading-skeleton loading-skeleton-80" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="mobile-table-empty">
        <div className="mobile-table-empty-message">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-table-container">
      {/* View Toggle - Mobile Only */}
      <div className="mobile-view-toggle">
        <button
          onClick={() => setViewMode('cards')}
          className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
        >
          Cards
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
        >
          Table
        </button>
      </div>

      {viewMode === 'cards' ? (
        /* Card View - Better for Mobile */
        <div className="mobile-cards-view">
          {sortedData.map((row, index) => (
            <div
              key={index}
              className={`mobile-card ${onRowClick ? 'mobile-card-clickable' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {mobileColumns.map((column) => (
                <div key={column.key} className="mobile-card-row">
                  <div className="mobile-card-label">
                    {column.label}
                  </div>
                  <div className="mobile-card-value">
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
        /* Table View - Horizontally Scrollable */
        <div className="mobile-table-wrapper">
          <table className="mobile-table" onKeyDownCapture={handleTableArrowNavigation}>
            <thead>
              <tr>
                {mobileColumns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => column.sortable && handleSort(column.key)}
                    className={column.sortable ? 'mobile-th-sortable' : ''}
                    width={column.width || '100px'}
                  >
                    {column.label}
                    {column.sortable && sortBy === column.key && (
                      <span className="mobile-sort-indicator">
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
                  className={onRowClick ? 'mobile-row-clickable' : ''}
                >
                  {mobileColumns.map((column) => (
                    <td key={column.key}>
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

      <style jsx>{`
        .mobile-table-container {
          width: 100%;
        }

        .mobile-view-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          background: var(--color-gray-50);
          padding: 4px;
          border-radius: 8px;
        }

        .view-toggle-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .view-toggle-btn.active {
          background: var(--color-white);
          color: var(--color-text-primary);
          box-shadow: 0 1px 3px var(--opacity-black-10);
        }

        .mobile-cards-view {
          display: flex;
          flex-direction: column;
        }

        .mobile-card {
          background-color: var(--color-white);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px var(--opacity-black-10);
          border: 1px solid var(--color-gray-200);
        }

        .mobile-card-clickable {
          cursor: pointer;
        }

        .mobile-card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--color-gray-100);
        }

        .mobile-card-row:last-child {
          border-bottom: none;
        }

        .mobile-card-label {
          font-weight: 600;
          color: var(--color-text-secondary);
          font-size: 14px;
          flex: 1;
        }

        .mobile-card-value {
          color: var(--color-text-primary);
          font-size: 14px;
          text-align: right;
          flex: 1;
        }

        .mobile-table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 8px;
          border: 1px solid var(--color-gray-200);
        }

        .mobile-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--color-white);
          min-width: 500px; /* Ensure horizontal scroll */
        }

        .mobile-table th,
        .mobile-table td {
          padding: 12px 8px;
          text-align: left;
          border-bottom: 1px solid var(--color-gray-100);
          font-size: 14px;
        }

        .mobile-table th {
          background: var(--color-gray-50);
          font-weight: 600;
          color: var(--color-text-primary);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .mobile-th-sortable {
          cursor: pointer;
        }

        .mobile-sort-indicator {
          margin-left: 4px;
        }

        .mobile-table tr:hover {
          background: var(--color-gray-50);
        }

        .mobile-row-clickable {
          cursor: pointer;
        }

        .mobile-loading-row {
          padding: 16px;
          border-bottom: 1px solid var(--color-gray-100);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .loading-skeleton {
          height: 20px;
          background: linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-200) 50%, var(--color-gray-100) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 4px;
        }

        .loading-skeleton-40 {
          width: 40%;
        }

        .loading-skeleton-60 {
          width: 60%;
        }

        .loading-skeleton-80 {
          width: 80%;
        }

        .mobile-table-empty-message {
          text-align: center;
          padding: 40px 20px;
          color: var(--color-text-secondary);
          font-size: 16px;
        }

        @keyframes loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        /* Hide view toggle on tablets and desktop */
        @media (min-width: 481px) {
          .mobile-view-toggle {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
