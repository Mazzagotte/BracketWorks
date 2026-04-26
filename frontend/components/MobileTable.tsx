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
            <div className="loading-skeleton" style={{ width: '60%', height: '20px' }} />
            <div className="loading-skeleton" style={{ width: '40%', height: '20px' }} />
            <div className="loading-skeleton" style={{ width: '80%', height: '20px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="mobile-table-empty">
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#6b7280',
          fontSize: '16px'
        }}>
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
              className="mobile-card"
              onClick={() => onRowClick?.(row)}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e5e7eb',
                cursor: onRowClick ? 'pointer' : 'default'
              }}
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
                    style={{
                      cursor: column.sortable ? 'pointer' : 'default',
                      minWidth: column.width || '100px'
                    }}
                  >
                    {column.label}
                    {column.sortable && sortBy === column.key && (
                      <span style={{ marginLeft: '4px' }}>
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
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default'
                  }}
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
          background: #f8f9fb;
          padding: 4px;
          border-radius: 8px;
        }

        .view-toggle-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: #6b7280;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .view-toggle-btn.active {
          background: #ffffff;
          color: #1a1f2e;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .mobile-cards-view {
          display: flex;
          flex-direction: column;
        }

        .mobile-card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .mobile-card-row:last-child {
          border-bottom: none;
        }

        .mobile-card-label {
          font-weight: 600;
          color: #6b7280;
          font-size: 14px;
          flex: 1;
        }

        .mobile-card-value {
          color: #1a1f2e;
          font-size: 14px;
          text-align: right;
          flex: 1;
        }

        .mobile-table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .mobile-table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          min-width: 500px; /* Ensure horizontal scroll */
        }

        .mobile-table th,
        .mobile-table td {
          padding: 12px 8px;
          text-align: left;
          border-bottom: 1px solid #f3f4f6;
          font-size: 14px;
        }

        .mobile-table th {
          background: #f8f9fb;
          font-weight: 600;
          color: #1a1f2e;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .mobile-table tr:hover {
          background: #f8f9fb;
        }

        .mobile-loading-row {
          padding: 16px;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .loading-skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 4px;
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
