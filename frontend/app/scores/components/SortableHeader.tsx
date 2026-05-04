import React from 'react';
import { SortableHeaderProps } from '../types';

export const SortableHeader: React.FC<SortableHeaderProps> = ({ 
  column, 
  children, 
  sortConfig, 
  onSort,
  align = 'center',
  width
}) => {
  const isActive = sortConfig.column === column;
  const direction = isActive ? sortConfig.direction : null;
  const [isHovered, setIsHovered] = React.useState(false);
  
  const getTextAlignClass = () => {
    switch (align) {
      case 'left': return 'bw-sortable-header-align-left';
      case 'right': return 'bw-sortable-header-align-right';
      default: return 'bw-sortable-header-align-center';
    }
  };

  return (
    <th
      className={`entries-header-cell bw-sortable-header ${isActive ? 'bw-sortable-header-active' : ''} ${isHovered ? 'bw-sortable-header-hover' : ''}`}
      width={width}
      onClick={() => onSort(column)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Click to sort by ${children}${isActive ? ` (${direction === 'asc' ? 'ascending' : 'descending'})` : ''}`}
    >
      <div className={`bw-sortable-header-inner ${getTextAlignClass()}`}>
        <span className="bw-sortable-header-text">
          {children}
        </span>
        <div className={`bw-sortable-header-icon ${isActive ? 'bw-sortable-header-icon-active' : ''} ${isHovered ? 'bw-sortable-header-icon-hover' : ''}`}>
          {direction === 'asc' ? (
            <span className="bw-sortable-header-arrow-up">▲</span>
          ) : direction === 'desc' ? (
            <span className="bw-sortable-header-arrow-down">▼</span>
          ) : (
            <>
              <span className="bw-sortable-header-arrow-muted">▲</span>
              <span className="bw-sortable-header-arrow-muted">▼</span>
            </>
          )}
        </div>
      </div>
      {isActive && (
        <div className="bw-sortable-header-indicator" />
      )}
    </th>
  );
};
