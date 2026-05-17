import React from 'react';
import { SortableHeaderProps } from '../types';

const SortIcon = ({ direction }: { direction: 'asc' | 'desc' | null }) => {
  if (direction === 'asc') {
    return (
      <svg className="bw-sort-icon bw-sort-icon-active" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
        <path d="M5 1L9.5 9H0.5L5 1Z" fill="currentColor" />
      </svg>
    );
  }
  if (direction === 'desc') {
    return (
      <svg className="bw-sort-icon bw-sort-icon-active" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
        <path d="M5 9L0.5 1H9.5L5 9Z" fill="currentColor" />
      </svg>
    );
  }
  // Idle: two stacked triangles (shown on hover)
  return (
    <svg className="bw-sort-icon bw-sort-icon-idle" viewBox="0 0 10 14" aria-hidden="true" focusable="false">
      <path d="M5 1L8.5 6H1.5L5 1Z" fill="currentColor" />
      <path d="M5 13L1.5 8H8.5L5 13Z" fill="currentColor" />
    </svg>
  );
};

const alignClass: Record<string, string> = {
  left: 'bw-sortable-header-align-left',
  center: 'bw-sortable-header-align-center',
  right: 'bw-sortable-header-align-right',
};

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  column,
  children,
  sortConfig,
  onSort,
  align = 'center',
  width,
}) => {
  const isActive = sortConfig.column === column;
  const direction = isActive ? sortConfig.direction : null;

  const ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';

  return (
    <th
      className={`entries-header-cell bw-sortable-header${isActive ? ' bw-sortable-header-active' : ''}`}
      style={width ? { width } : undefined}
      onClick={() => onSort(column)}
      aria-sort={ariaSort}
      title={
        isActive
          ? direction === 'asc'
            ? `Sorted ascending — click to sort descending`
            : `Sorted descending — click to clear sort`
          : `Click to sort by ${String(children)}`
      }
    >
      <div className={`bw-sortable-header-inner ${alignClass[align] ?? alignClass.center}`}>
        <span className="bw-sortable-header-text">{children}</span>
        <SortIcon direction={direction} />
      </div>
    </th>
  );
};
