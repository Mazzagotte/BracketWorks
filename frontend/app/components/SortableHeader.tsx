import React from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  column: string | null;
  direction: SortDirection;
}

export interface SortableHeaderProps {
  column: string;
  children: React.ReactNode;
  sortConfig: SortConfig;
  onSort: (column: string) => void;
  align?: 'left' | 'center' | 'right';
  width?: string;
  /** Extra CSS class(es) appended to the <th> — use for column-specific sizing classes */
  className?: string;
  rowSpan?: number;
  colSpan?: number;
  scope?: 'col' | 'colgroup' | 'row';
}

const SortIcon = ({ direction }: { direction: SortDirection }) => {
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

const widthClass: Record<string, string> = {
  '6%': 'bw-sortable-header-w-6',
  '10%': 'bw-sortable-header-w-10',
  '12%': 'bw-sortable-header-w-12',
  '14%': 'bw-sortable-header-w-14',
};

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  column,
  children,
  sortConfig,
  onSort,
  align = 'center',
  width,
  className,
  rowSpan,
  colSpan,
  scope = 'col',
}) => {
  const isActive = sortConfig.column === column;
  const direction = isActive ? sortConfig.direction : null;
  const ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';

  const thClass = [
    'entries-header-cell',
    'bw-sortable-header',
    isActive ? 'bw-sortable-header-active' : '',
    width ? widthClass[width] ?? '' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <th
      className={thClass}
      rowSpan={rowSpan}
      colSpan={colSpan}
      scope={scope}
      onClick={() => onSort(column)}
      aria-sort={ariaSort}
      title={
        isActive
          ? direction === 'asc'
            ? 'Sorted ascending. Click to sort descending.'
            : 'Sorted descending. Click to clear sort.'
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
