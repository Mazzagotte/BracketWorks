'use client';

import type { ReactNode, TableHTMLAttributes } from 'react';
import { cx } from './cx';
import styles from './Table.module.css';

export interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Visible or screen-reader caption describing the table. */
  caption?: ReactNode;
}

/**
 * A table styled to the standard. Put it directly in a `Card` with `padding="flush"`.
 * Cell options: `data-align="right"` for numbers, `data-tone="secondary"` for
 * de-emphasized columns, `data-emphasis="true"` for a totals column.
 */
export function DataTable({ caption, className, children, ...rest }: DataTableProps) {
  return (
    <div className={styles.scroll}>
      <table className={cx(styles.table, className)} {...rest}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export interface TableToolbarProps {
  /** Usually a search `TextField` or input; it fills the row. */
  search?: ReactNode;
  /** Filter selects, then at most one secondary action such as Export. */
  children?: ReactNode;
  className?: string;
}

/** Search, filters, and a secondary action above a table, inside the same card. */
export function TableToolbar({ search, children, className }: TableToolbarProps) {
  return (
    <div className={cx(styles.toolbar, className)}>
      {search ? <div className={styles.toolbarSearch}>{search}</div> : null}
      {children}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** For example "Showing 1–25 of 140". */
  summary: ReactNode;
  /** Optional rows-per-page control on the right. */
  pageSizeControl?: ReactNode;
  className?: string;
}

function visiblePages(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) result.push('gap');
    result.push(value);
  });
  return result;
}

/** Summary on the left, ghost page buttons on the right. The current page is never solid orange. */
export function Pagination({ page, pageCount, onPageChange, summary, pageSizeControl, className }: PaginationProps) {
  const pages = visiblePages(page, Math.max(1, pageCount));
  return (
    <div className={cx(styles.pagination, className)}>
      <span className={styles.paginationSummary}>{summary}</span>
      <nav aria-label="Pagination" className={styles.pages}>
        <button type="button" className={styles.page} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          Prev
        </button>
        {pages.map((value, index) =>
          value === 'gap' ? (
            <span key={`gap-${index}`} className={styles.paginationSummary} aria-hidden="true">...</span>
          ) : (
            <button
              key={value}
              type="button"
              className={styles.page}
              aria-current={value === page ? 'page' : undefined}
              aria-label={`Page ${value}`}
              onClick={() => onPageChange(value)}
            >
              {value}
            </button>
          ),
        )}
        <button type="button" className={styles.page} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          Next
        </button>
      </nav>
      {pageSizeControl}
    </div>
  );
}
