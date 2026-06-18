import React, { memo } from 'react';

// Memoized table row component
export const OptimizedTableRow = memo(({ 
  children, 
  onClick, 
  className,
  ...props 
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
} & React.HTMLAttributes<HTMLTableRowElement>) => {
  return (
    <tr 
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </tr>
  );
});

OptimizedTableRow.displayName = 'OptimizedTableRow';

// Memoized table cell component
export const OptimizedTableCell = memo(({ 
  children, 
  isEditing,
  onDoubleClick,
  className,
  ...props 
}: {
  children: React.ReactNode;
  isEditing?: boolean;
  onDoubleClick?: () => void;
  className?: string;
} & React.HTMLAttributes<HTMLTableCellElement>) => {
  return (
    <td
      onDoubleClick={onDoubleClick}
      className={className}
      {...props}
    >
      {children}
    </td>
  );
});

OptimizedTableCell.displayName = 'OptimizedTableCell';
