import React, { memo } from 'react';

import { PlayersTableProps } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';

const PlayersTable = memo(({ 
  players, 
  onUpdatePlayer, 
  onDeletePlayer, 
  savingStatus,
  isDemoMode,
  entryFee 
}: PlayersTableProps) => {
  // Add pulse animation to document head if not already present
  React.useEffect(() => {
    if (!document.querySelector('#pulse-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'pulse-animation-styles';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
        {isDemoMode ? 'No demo players available' : 'No players found. Add some players to get started.'}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb' }}>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Name
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              USBC
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Lane
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Average
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Handicap Entries
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Scratch Entries
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Division
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Total Cost
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Amount Paid
            </th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <OptimizedTableRow key={player.id}>
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

