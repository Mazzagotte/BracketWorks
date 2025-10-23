import React, { memo } from 'react';

import { PlayersTableProps } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';

const PlayersTable = memo(({ 
  players, 
  onUpdatePlayer, 
  onDeletePlayer, 
  savingStatus,
  isDemoMode 
}: PlayersTableProps) => {
  const getSavingIndicator = (playerId: number, field: string) => {
    const key = `${playerId}-${field}`;
    const status = savingStatus[key];
    
    if (!status || status === 'idle') return null;
    
    return (
      <span style={{
        fontSize: '12px',
        marginLeft: '8px',
        color: status === 'saving' ? '#6b7280' : status === 'success' ? '#10b981' : '#ef4444'
      }}>
        {status === 'saving' ? '●' : status === 'success' ? '✓' : '✗'}
      </span>
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
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Name
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              USBC
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Lane
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Average
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Handicap
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Scratch
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Division
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Total Cost
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Amount Paid
            </th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '14px' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <OptimizedTableRow key={player.id}>
              <OptimizedTableCell>
                <div>
                  <input
                    type="text"
                    value={player.firstName}
                    onChange={(e) => handleCellEdit(player.id, 'firstName', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '4px',
                      fontSize: '14px',
                      width: '80px',
                      marginRight: '4px'
                    }}
                    placeholder="First"
                  />
                  <input
                    type="text"
                    value={player.lastName}
                    onChange={(e) => handleCellEdit(player.id, 'lastName', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '4px',
                      fontSize: '14px',
                      width: '80px'
                    }}
                    placeholder="Last"
                  />
                  {getSavingIndicator(player.id, 'firstName')}
                  {getSavingIndicator(player.id, 'lastName')}
                </div>
              </OptimizedTableCell>
              
              <OptimizedTableCell>
                <input
                  type="text"
                  value={player.usbc || ''}
                  onChange={(e) => handleCellEdit(player.id, 'usbc', e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '4px',
                    fontSize: '14px',
                    width: '100px'
                  }}
                  placeholder="USBC #"
                />
                {getSavingIndicator(player.id, 'usbc')}
              </OptimizedTableCell>

              <OptimizedTableCell>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => handleDecrement(player.id, 'lane', parseInt(player.lane.slice(1)) || 0)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↓
                  </button>
                  <input
                    type="text"
                    value={player.lane}
                    onChange={(e) => handleCellEdit(player.id, 'lane', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '4px',
                      fontSize: '14px',
                      width: '60px',
                      textAlign: 'center'
                    }}
                  />
                  <button
                    onClick={() => handleIncrement(player.id, 'lane', parseInt(player.lane.slice(1)) || 0)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↑
                  </button>
                  {getSavingIndicator(player.id, 'lane')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => handleDecrement(player.id, 'average', player.average)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↓
                  </button>
                  <input
                    type="number"
                    value={player.average}
                    onChange={(e) => handleCellEdit(player.id, 'average', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '4px',
                      fontSize: '14px',
                      width: '60px',
                      textAlign: 'center'
                    }}
                  />
                  <button
                    onClick={() => handleIncrement(player.id, 'average', player.average)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↑
                  </button>
                  {getSavingIndicator(player.id, 'average')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => handleDecrement(player.id, 'handicap', player.handicap)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↓
                  </button>
                  <input
                    type="number"
                    value={player.handicap}
                    onChange={(e) => handleCellEdit(player.id, 'handicap', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '4px',
                      fontSize: '14px',
                      width: '60px',
                      textAlign: 'center'
                    }}
                  />
                  <button
                    onClick={() => handleIncrement(player.id, 'handicap', player.handicap)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↑
                  </button>
                  {getSavingIndicator(player.id, 'handicap')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => handleDecrement(player.id, 'scratch', player.scratch)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↓
                  </button>
                  <input
                    type="number"
                    value={player.scratch}
                    onChange={(e) => handleCellEdit(player.id, 'scratch', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '4px',
                      fontSize: '14px',
                      width: '60px',
                      textAlign: 'center'
                    }}
                  />
                  <button
                    onClick={() => handleIncrement(player.id, 'scratch', player.scratch)}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ↑
                  </button>
                  {getSavingIndicator(player.id, 'scratch')}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell>
                <select
                  value={player.division}
                  onChange={(e) => handleCellEdit(player.id, 'division', e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '4px',
                    fontSize: '14px',
                    width: '100px'
                  }}
                >
                  <option value="Open">Open</option>
                  <option value="Womens">Womens</option>
                  <option value="Senior">Senior</option>
                  <option value="Junior">Junior</option>
                </select>
                {getSavingIndicator(player.id, 'division')}
              </OptimizedTableCell>

              <OptimizedTableCell>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  ${((player.scratch + player.handicap) * 25).toFixed(2)}
                </span>
              </OptimizedTableCell>

              <OptimizedTableCell>
                <input
                  type="number"
                  value={player.amountPaid}
                  onChange={(e) => handleCellEdit(player.id, 'amountPaid', e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '4px',
                    fontSize: '14px',
                    width: '80px'
                  }}
                  step="0.01"
                  min="0"
                />
                {getSavingIndicator(player.id, 'amountPaid')}
              </OptimizedTableCell>

              <OptimizedTableCell>
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