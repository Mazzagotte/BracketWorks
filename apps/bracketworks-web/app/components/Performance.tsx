/** Client-side pagination state for lists; the shared Pagination component renders the controls. */
import { useState, useEffect, useMemo, useCallback } from 'react';

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

