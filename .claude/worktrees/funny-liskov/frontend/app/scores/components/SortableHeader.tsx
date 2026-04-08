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
    if (isActive) {
      return direction === 'asc' ? '#3b82f6' : direction === 'desc' ? '#3b82f6' : '#9ca3af';
    }
    return isHovered ? '#5E6B75' : '#d1d5db';
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
      style={{ 
        cursor: 'pointer',
        padding: '10px 12px',
        textAlign: getTextAlign(),
        verticalAlign: 'middle',
        fontWeight: isActive ? '800' : '700',
        color: isActive ? '#1e40af' : '#374151',
        fontSize: '12px',
        borderBottom: isActive ? '2px solid #3b82f6' : '2px solid #e5e7eb',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: isActive ? '#eff6ff' : isHovered ? '#f8fafc' : 'transparent',
        position: 'relative',
        ...(width && { width }),
        lineHeight: '1.3'
      }}
      onClick={() => onSort(column)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Click to sort by ${children}${isActive ? ` (${direction === 'asc' ? 'ascending' : 'descending'})` : ''}`}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: getTextAlign(),
        gap: '6px',
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
          backgroundColor: '#3b82f6',
          borderRadius: '1px'
        }} />
      )}
    </th>
  );
};
