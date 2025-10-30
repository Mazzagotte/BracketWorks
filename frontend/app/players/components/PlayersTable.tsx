import React, { memo } from 'react';

import { PlayersTableProps, SortableColumn } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';

// Sortable header component
const SortableHeader: React.FC<{
  column: SortableColumn;
  children: React.ReactNode;
  sortConfig: { column: SortableColumn | null; direction: 'asc' | 'desc' | null };
  onSort: (column: SortableColumn) => void;
}> = ({ column, children, sortConfig, onSort }) => {
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
    return isHovered ? '#6b7280' : '#d1d5db';
  };

  return (
    <th 
      style={{ 
        padding: '12px 16px', 
        textAlign: 'center', 
        borderBottom: isActive ? '2px solid #3b82f6' : '1px solid #e5e7eb', 
        fontWeight: isActive ? '700' : '600', 
        fontSize: '13px',
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: isActive ? '#eff6ff' : isHovered ? '#f8fafc' : 'transparent',
        transition: 'all 0.2s ease',
        position: 'relative',
        color: isActive ? '#1e40af' : '#374151'
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

const PlayersTable = memo(({ 
  players, 
  onUpdatePlayer, 
  onDeletePlayer, 
  savingStatus,
  entryFee,
  sortConfig,
  onSort,
  selectedSquad
}: PlayersTableProps) => {
  // Add pulse animation and hide number input spinners
  React.useEffect(() => {
    if (!document.querySelector('#pulse-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'pulse-animation-styles';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes sortChange {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        /* Hide number input spinners for cleaner look */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
        
        /* Add subtle row hover effect */
        .players-table-row {
          transition: background-color 0.15s ease;
        }
        
        .players-table-row:hover {
          background-color: #f8fafc !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const getSavingIndicator = (playerId: number, field: string) => {
    const key = `${playerId}-${field}`;
    const status = savingStatus[key];
    
    if (!status || status === 'idle') return null;
    
    return (
      <div style={{
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
        ...(status === 'saving' && {
          backgroundColor: '#f59e0b',
          color: 'white',
          animation: 'pulse 1s infinite'
        }),
        ...(status === 'success' && {
          backgroundColor: '#10b981',
          color: 'white'
        }),
        ...(status === 'error' && {
          backgroundColor: '#ef4444',
          color: 'white'
        })
      }}>
        {status === 'saving' && '⋯'}
        {status === 'success' && '✓'}
        {status === 'error' && '✗'}
      </div>
    );
  };

  const handleCellEdit = (playerId: number, field: string, value: string) => {
    const numericFields = ['average', 'handicap', 'scratch', 'amountPaid'];
    const processedValue = numericFields.includes(field) ? parseInt(value) || 0 : value;
    onUpdatePlayer(playerId, field, processedValue);
  };

  const handleIncrement = (playerId: number, field: string, currentValue: number, step = 1) => {
    onUpdatePlayer(playerId, field, currentValue + step);
  };

  const handleDecrement = (playerId: number, field: string, currentValue: number, step = 1) => {
    const newValue = Math.max(0, currentValue - step);
    onUpdatePlayer(playerId, field, newValue);
  };

  if (players.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem', 
        color: '#6b7280',
        fontSize: '1rem'
      }}>
        No players found. Add some players to get started.
      </div>
    );
  }

  return (
    <div style={{ 
      overflowX: 'auto',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
    }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <thead>
          {selectedSquad && (
            <tr>
              <td colSpan={10} style={{ 
                backgroundColor: 'rgba(79, 140, 255, 0.1)', 
                color: '#4f8cff',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '600',
                padding: '12px'
              }}>
                Showing players for: {selectedSquad.date} — {selectedSquad.time}
              </td>
            </tr>
          )}
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <SortableHeader column="name" sortConfig={sortConfig} onSort={onSort}>
              Name
            </SortableHeader>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'center', 
              borderBottom: '1px solid #e5e7eb', 
              fontWeight: '600', 
              fontSize: '13px',
              color: '#374151',
              letterSpacing: '0.025em'
            }}>
              USBC
            </th>
            <SortableHeader column="lane" sortConfig={sortConfig} onSort={onSort}>
              Lane
            </SortableHeader>
            <SortableHeader column="average" sortConfig={sortConfig} onSort={onSort}>
              Average
            </SortableHeader>
            <SortableHeader column="handicap" sortConfig={sortConfig} onSort={onSort}>
              Handicap Entries
            </SortableHeader>
            <SortableHeader column="scratch" sortConfig={sortConfig} onSort={onSort}>
              Scratch Entries
            </SortableHeader>
            <SortableHeader column="division" sortConfig={sortConfig} onSort={onSort}>
              Division
            </SortableHeader>
            <SortableHeader column="totalCost" sortConfig={sortConfig} onSort={onSort}>
              Total Cost
            </SortableHeader>
            <SortableHeader column="amountPaid" sortConfig={sortConfig} onSort={onSort}>
              Amount Paid
            </SortableHeader>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'center', 
              borderBottom: '1px solid #e5e7eb', 
              fontWeight: '600', 
              fontSize: '13px',
              color: '#374151',
              letterSpacing: '0.025em'
            }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <OptimizedTableRow 
              key={player.id} 
              className="players-table-row"
              style={{ backgroundColor: 'transparent' }}
            >
              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={player.firstName}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'firstName', changeEvent.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '8px',
                        fontSize: '14px',
                        width: '80px',
                        marginRight: '4px',
                        background: '#ffffff',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      placeholder="First"
                      onFocus={(changeEvent) => {
                        changeEvent.target.style.borderColor = '#3b82f6';
                        changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(changeEvent) => {
                        changeEvent.target.style.borderColor = '#d1d5db';
                        changeEvent.target.style.boxShadow = 'none';
                      }}
                    />
                    {getSavingIndicator(player.id, 'firstName')}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={player.lastName}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'lastName', changeEvent.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '8px',
                        fontSize: '14px',
                        width: '80px',
                        background: '#ffffff',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      placeholder="Last"
                      onFocus={(changeEvent) => {
                        changeEvent.target.style.borderColor = '#3b82f6';
                        changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(changeEvent) => {
                        changeEvent.target.style.borderColor = '#d1d5db';
                        changeEvent.target.style.boxShadow = 'none';
                      }}
                    />
                    {getSavingIndicator(player.id, 'lastName')}
                  </div>
                </div>
              </OptimizedTableCell>
              
              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="text"
                    value={player.usbc || ''}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'usbc', changeEvent.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      padding: '8px',
                      fontSize: '14px',
                      width: '100px',
                      background: '#ffffff',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                    placeholder="USBC #"
                    onFocus={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#3b82f6';
                      changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#d1d5db';
                      changeEvent.target.style.boxShadow = 'none';
                    }}
                  />
                  {getSavingIndicator(player.id, 'usbc')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type="text"
                    value={player.lane}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'lane', changeEvent.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      padding: '8px 24px 8px 8px',
                      fontSize: '14px',
                      width: '80px',
                      textAlign: 'center',
                      background: '#ffffff',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#3b82f6';
                      changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#d1d5db';
                      changeEvent.target.style.boxShadow = 'none';
                    }}
                  />
                  {getSavingIndicator(player.id, 'lane')}
                  
                  {/* Increment/Decrement Arrows - Inside Input */}
                  <div style={{ 
                    position: 'absolute', 
                    right: '4px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1px' 
                  }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'lane', parseInt(player.lane.slice(1)) || 0)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleDecrement(player.id, 'lane', parseInt(player.lane.slice(1)) || 0)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▼
                    </button>
                  </div>
                  {getSavingIndicator(player.id, 'lane')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type="number"
                    value={player.average}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'average', changeEvent.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      padding: '8px 24px 8px 8px',
                      fontSize: '14px',
                      width: '80px',
                      textAlign: 'center',
                      background: '#ffffff',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#3b82f6';
                      changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#d1d5db';
                      changeEvent.target.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* Increment/Decrement Arrows - Inside Input */}
                  <div style={{ 
                    position: 'absolute', 
                    right: '4px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1px' 
                  }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'average', player.average)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleDecrement(player.id, 'average', player.average)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▼
                    </button>
                  </div>
                  {getSavingIndicator(player.id, 'average')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type="number"
                    value={player.handicap}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'handicap', changeEvent.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      padding: '8px 24px 8px 8px',
                      fontSize: '14px',
                      width: '80px',
                      textAlign: 'center',
                      background: '#ffffff',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#3b82f6';
                      changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#d1d5db';
                      changeEvent.target.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* Increment/Decrement Arrows - Inside Input */}
                  <div style={{ 
                    position: 'absolute', 
                    right: '4px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1px' 
                  }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'handicap', player.handicap)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleDecrement(player.id, 'handicap', player.handicap)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▼
                    </button>
                  </div>
                  {getSavingIndicator(player.id, 'handicap')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type="number"
                    value={player.scratch}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'scratch', changeEvent.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      padding: '8px 24px 8px 8px',
                      fontSize: '14px',
                      width: '80px',
                      textAlign: 'center',
                      background: '#ffffff',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#3b82f6';
                      changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#d1d5db';
                      changeEvent.target.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* Increment/Decrement Arrows - Inside Input */}
                  <div style={{ 
                    position: 'absolute', 
                    right: '4px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1px' 
                  }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'scratch', player.scratch)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleDecrement(player.id, 'scratch', player.scratch)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▼
                    </button>
                  </div>
                  {getSavingIndicator(player.id, 'scratch')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <select
                  value={player.division}
                  onChange={(changeEvent) => handleCellEdit(player.id, 'division', changeEvent.target.value)}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '8px',
                    fontSize: '14px',
                    width: '100px',
                    background: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                  onFocus={(changeEvent) => {
                    changeEvent.target.style.borderColor = '#3b82f6';
                    changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(changeEvent) => {
                    changeEvent.target.style.borderColor = '#d1d5db';
                    changeEvent.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="Open">Open</option>
                  <option value="Womens">Womens</option>
                  <option value="Senior">Senior</option>
                  <option value="Junior">Junior</option>
                </select>
                {getSavingIndicator(player.id, 'division')}
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  ${player.totalCost.toFixed(2)}
                </span>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type="number"
                    value={player.amountPaid}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'amountPaid', changeEvent.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      padding: '8px 24px 8px 8px',
                      fontSize: '14px',
                      width: '100px',
                      textAlign: 'center',
                      background: '#ffffff',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    step="0.01"
                    min="0"
                    onFocus={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#3b82f6';
                      changeEvent.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(changeEvent) => {
                      changeEvent.target.style.borderColor = '#d1d5db';
                      changeEvent.target.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* Increment/Decrement Arrows - Inside Input */}
                  <div style={{ 
                    position: 'absolute', 
                    right: '4px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1px' 
                  }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'amountPaid', player.amountPaid, 0.01)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleDecrement(player.id, 'amountPaid', player.amountPaid, 0.01)}
                      style={{
                        width: '12px',
                        height: '8px',
                        border: 'none',
                        borderRadius: '1px',
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = '#f3f4f6';
                        changeEvent.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(changeEvent) => { 
                        changeEvent.currentTarget.style.backgroundColor = 'transparent';
                        changeEvent.currentTarget.style.color = '#6b7280';
                      }}
                    >
                      ▼
                    </button>
                  </div>
                  {getSavingIndicator(player.id, 'amountPaid')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => onDeletePlayer(player.id)}
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: '#dc2626',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </OptimizedTableCell>
            </OptimizedTableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
});

PlayersTable.displayName = 'PlayersTable';

export default PlayersTable;

