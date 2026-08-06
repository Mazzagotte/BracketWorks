import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
  showItemCount?: boolean;
  showPageSize?: boolean;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage = 10,
  totalItems,
  showItemCount = true,
  showPageSize = false,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
}) => {
  const pageNumbers = useMemo(() => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    let prev: number | null = null;
    for (const page of range) {
      if (prev && page - prev > 1) rangeWithDots.push('...');
      rangeWithDots.push(page);
      prev = page;
    }

    return rangeWithDots;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="bw-pagination">
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`bw-pagination-btn ${currentPage <= 1 ? 'bw-pagination-btn-disabled' : ''}`}
        aria-label="Previous page"
      >
        Prev
      </button>

      {/* Page numbers */}
      {pageNumbers.map((page, index) =>
        page === '...' ? (
          <span key={`dots-${index}`} className="bw-pagination-ellipsis">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={`bw-pagination-btn ${currentPage === page ? 'bw-pagination-btn-active' : ''}`}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`bw-pagination-btn ${currentPage >= totalPages ? 'bw-pagination-btn-disabled' : ''}`}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
};

// Hook for pagination logic
interface UsePaginationOptions<T> {
  items: T[];
  itemsPerPage?: number;
  initialPage?: number;
  resetOnItemsChange?: boolean;
}

export function usePagination<T>({
  items,
  itemsPerPage = 10,
  initialPage = 1,
  resetOnItemsChange = true,
}: UsePaginationOptions<T>) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(itemsPerPage);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Optionally reset to page 1 when items change
  useEffect(() => {
    if (resetOnItemsChange) {
      setCurrentPage(1);
    }
  }, [items, resetOnItemsChange]);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, pageSize]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const changePageSize = useCallback((newPageSize: number) => {
    const currentItemIndex = (currentPage - 1) * pageSize;
    const newPage = Math.floor(currentItemIndex / newPageSize) + 1;
    setPageSize(newPageSize);
    setCurrentPage(newPage);
  }, [currentPage, pageSize]);

  return {
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

