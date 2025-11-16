import React, { memo } from 'react';

import { PlayersTableProps } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';

const PlayersTable = memo(({ 
  players, 
  onUpdatePlayer,
  onDeletePlayer,
  selectedSquad,
  savingStatus
}: PlayersTableProps) => {
  
  // Sort players by lane assignment
  const sortedPlayers = [...players].sort((a, b) => {
    const laneA = typeof a.lane === 'string' ? parseInt(a.lane) || 0 : a.lane || 0;
    const laneB = typeof b.lane === 'string' ? parseInt(b.lane) || 0 : b.lane || 0;
    return laneA - laneB;
  });
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
        {status === 'success' && ''}
        {status === 'error' && ''}
      </div>
    );
  };

  const handleCellEdit = (playerId: number, field: string, value: string) => {
    const numericFields = ['average', 'handicap', 'scratch', 'amountPaid'];
    const processedValue = numericFields.includes(field) ? parseInt(value) || 0 : value;
    onUpdatePlayer(playerId, field, processedValue);
  };

  const handleIncrement = (playerId: number, field: string, currentValue: number, step = 1) => {
    const newValue = currentValue + step;
    onUpdatePlayer(playerId, field, newValue);
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
              <td colSpan={9} style={{ 
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
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '16%',
              lineHeight: '1.3'
            }}>
              Name
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '9%',
              lineHeight: '1.3'
            }}>
              USBC
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '7%',
              lineHeight: '1.3'
            }}>
              Lane
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '7%',
              lineHeight: '1.3'
            }}>
              Average
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '9%',
              lineHeight: '1.3'
            }}>
              Handicap<br/>Entries
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '9%',
              lineHeight: '1.3'
            }}>
              Scratch<br/>Entries
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '11%',
              lineHeight: '1.3'
            }}>
              Division
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '15%',
              lineHeight: '1.3'
            }}>
              Cost / Status
            </th>
            <th style={{ 
              padding: '10px 12px', 
              textAlign: 'center', 
              borderBottom: '2px solid #e5e7eb', 
              fontWeight: '700', 
              fontSize: '12px',
              color: '#374151',
              letterSpacing: '0.025em',
              width: '15%',
              lineHeight: '1.3'
            }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => (
            <OptimizedTableRow 
              key={player.id} 
              className="players-table-row"
              style={{ backgroundColor: 'transparent' }}
            >
              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={player.firstName}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'firstName', changeEvent.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '6px',
                        fontSize: '13px',
                        width: '70px',
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
                        padding: '6px',
                        fontSize: '13px',
                        width: '70px',
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
              
              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="text"
                    value={player.usbc || ''}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'usbc', changeEvent.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      padding: '6px',
                      fontSize: '13px',
                      width: '90px',
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

                            <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <input
                      type="text"
                      value={player.lane?.toString() || ''}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'lane', changeEvent.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '6px 20px 6px 6px',
                        fontSize: '13px',
                        width: '60px',
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
                    {/* Increment/Decrement Arrows */}
                    <div style={{ 
                      position: 'absolute',
                      right: '2px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1px'
                    }}>
                    <button
                      onClick={() => {
                        const laneNum = typeof player.lane === 'string' 
                          ? parseInt(player.lane) || 0
                          : player.lane || 0;
                        handleIncrement(player.id, 'lane', laneNum);
                      }}
                      style={{
                        width: '14px',
                        height: '10px',
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
                      onClick={() => {
                        const laneNum = typeof player.lane === 'string' 
                          ? parseInt(player.lane) || 0
                          : player.lane || 0;
                        handleDecrement(player.id, 'lane', laneNum);
                      }}
                      style={{
                        width: '14px',
                        height: '10px',
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
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <input
                      type="text"
                      value={player.average}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'average', changeEvent.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '6px 20px 6px 6px',
                        fontSize: '13px',
                        width: '70px',
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
                    
                    {/* Increment/Decrement Arrows */}
                    <div style={{ 
                      position: 'absolute',
                      right: '2px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1px'
                    }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'average', player.average)}
                      style={{
                        width: '14px',
                        height: '10px',
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
                        width: '14px',
                        height: '10px',
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
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <input
                      type="text"
                      value={player.handicap}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'handicap', changeEvent.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '6px 20px 6px 6px',
                        fontSize: '13px',
                        width: '60px',
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
                    
                    {/* Increment/Decrement Arrows */}
                    <div style={{ 
                      position: 'absolute',
                      right: '2px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1px'
                    }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'handicap', player.handicap)}
                      style={{
                        width: '14px',
                        height: '10px',
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
                        width: '14px',
                        height: '10px',
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
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <input
                      type="text"
                      value={player.scratch}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'scratch', changeEvent.target.value)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '6px 20px 6px 6px',
                        fontSize: '13px',
                        width: '60px',
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
                    
                    {/* Increment/Decrement Arrows */}
                    <div style={{ 
                      position: 'absolute',
                      right: '2px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1px'
                    }}>
                    <button
                      onClick={() => handleIncrement(player.id, 'scratch', player.scratch)}
                      style={{
                        width: '14px',
                        height: '10px',
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
                        width: '14px',
                        height: '10px',
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
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <select
                  value={player.division}
                  onChange={(changeEvent) => handleCellEdit(player.id, 'division', changeEvent.target.value)}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px',
                    fontSize: '13px',
                    width: '90px',
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

              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>
                    ${player.totalCost.toFixed(2)}
                  </span>
                  <span 
                    onClick={() => {
                      const newPaidAmount = player.amountPaid >= player.totalCost ? 0 : player.totalCost;
                      handleCellEdit(player.id, 'amountPaid', newPaidAmount.toString());
                    }}
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      userSelect: 'none',
                      ...(player.amountPaid >= player.totalCost 
                        ? {
                            backgroundColor: '#10b981',
                            color: 'white'
                          }
                        : {
                            backgroundColor: '#ef4444',
                            color: 'white'
                          }
                      )
                    }}
                    title={`Click to toggle payment status. Current: $${player.amountPaid.toFixed(2)}`}
                  >
                    {player.amountPaid >= player.totalCost ? 'PAID' : 'DUE'}
                  </span>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell style={{ textAlign: 'center', padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
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

