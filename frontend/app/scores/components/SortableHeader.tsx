import React from 'react';
import { SortableHeaderProps, SortableScoreColumn } from '../types';

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
  
  const getSortIcon = () => {
    if (!isActive && !isHovered) return null;
    if (direction === 'asc') return '▲';
    if (direction === 'desc') return '▼';
    return '▲▼';
  };

  const getIconColor = () => {
    if (isActive) return 'var(--color-primary)';
    return isHovered ? 'var(--color-text-secondary)' : 'var(--color-gray-400)';
  };

  const getTextAlign = () => {
    switch (align) {
      case 'left': return 'left';
      case 'right': return 'right';
      default: return 'center';
    }
  };

  return (
    <th 
      className="entries-header-cell"
      style={{ 
        cursor: 'pointer',
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
        background: isActive ? 'var(--color-border-light)' : isHovered ? 'var(--color-surface-hover)' : undefined,
        borderBottom: isActive ? '3px solid var(--color-primary)' : undefined,
        transition: 'all 0.15s ease',
        position: 'relative',
        ...(width && { width }),
      }}
      onClick={() => onSort(column)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Click to sort by ${children}${isActive ? ` (${direction === 'asc' ? 'ascending' : 'descending'})` : ''}`}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '4px',
        minHeight: '20px'
      }}>
        <span style={{ 
          fontWeight: 'inherit',
          letterSpacing: '0.025em'
        }}>
          {children}
        </span>
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '12px',
          height: '16px',
          fontSize: '8px',
          lineHeight: '4px',
          color: getIconColor(),
          transition: 'color 0.2s ease',
          opacity: isActive || isHovered ? 1 : 0.4,
          animation: isActive ? 'sortChange 0.3s ease' : 'none'
        }}>
          {direction === 'asc' ? (
            <span style={{ transform: 'translateY(2px)' }}>▲</span>
          ) : direction === 'desc' ? (
            <span style={{ transform: 'translateY(-2px)' }}>▼</span>
          ) : (
            <>
              <span style={{ opacity: 0.6 }}>▲</span>
              <span style={{ opacity: 0.6 }}>▼</span>
            </>
          )}
        </div>
      </div>
      {isActive && (
        <div style={{
          position: 'absolute',
          bottom: '-2px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '24px',
          height: '2px',
          backgroundColor: 'var(--color-primary)',
          borderRadius: '1px'
        }} />
      )}
    </th>
  );
};
