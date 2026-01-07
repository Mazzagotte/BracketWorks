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
  
  // Styles moved to globals.css; no inline style injection
  
  // No inline style injection; styles are defined in globals.css

  const getSavingIndicator = (playerId: number, field: string) => {
    const key = `${playerId}-${field}`;
    const status = savingStatus[key];
    
    if (!status || status === 'idle') return null;
    
    const cls = `saving-indicator ${status}`;
    return (<div className={cls}>{status === 'saving' ? '⋯' : ''}</div>);
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
      <div className="entries-empty">
        No players found. Add some players to get started.
      </div>
    );
  }

  return (
    <div className="entries-container">
      <table className="entries-table">
        <thead>
          {selectedSquad && (
            <tr>
              <td colSpan={9} className="squad-banner">
                Showing players for: {selectedSquad.date} — {selectedSquad.time}
              </td>
            </tr>
          )}
          <tr className="entries-header-row">
            <th className="entries-header-cell col-name">
              Name
            </th>
            <th className="entries-header-cell col-usbc">
              USBC
            </th>
            <th className="entries-header-cell col-lane">
              Lane
            </th>
            <th className="entries-header-cell col-average">
              Average
            </th>
            <th className="entries-header-cell col-handicap">
              Handicap<br/>Entries
            </th>
            <th className="entries-header-cell col-scratch">
              Scratch<br/>Entries
            </th>
            <th className="entries-header-cell col-division">
              Division
            </th>
            <th className="entries-header-cell col-cost">
              Cost / Status
            </th>
            <th className="entries-header-cell col-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => (
            <OptimizedTableRow 
              key={player.id}
              className="players-table-row"
            >
              <OptimizedTableCell className="entries-cell">
                <div className="flex-center gap-6">
                  <div className="pos-relative">
                    <input
                      className="entries-input entries-control w-75"
                      type="text"
                      value={player.firstName}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'firstName', changeEvent.target.value)}
                      placeholder="First"
                    />
                    {getSavingIndicator(player.id, 'firstName')}
                  </div>
                  <div className="pos-relative">
                    <input
                      className="entries-input entries-control w-75"
                      type="text"
                      value={player.lastName}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'lastName', changeEvent.target.value)}
                      placeholder="Last"
                    />
                    {getSavingIndicator(player.id, 'lastName')}
                  </div>
                </div>
              </OptimizedTableCell>
              
              <OptimizedTableCell className="entries-cell medium">
                <div className="pos-relative flex-center">
                    <input
                    className="entries-input entries-control w-95"
                    type="text"
                    value={player.usbc || ''}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'usbc', changeEvent.target.value)}
                    placeholder="USBC #"
                  />
                  {getSavingIndicator(player.id, 'usbc')}
                </div>
              </OptimizedTableCell>

                            <OptimizedTableCell className="entries-cell">
                <div className="flex-center">
                  <div className="pos-relative inline-block">
                    <input
                      className="entries-input entries-control w-65"
                      type="text"
                      value={player.lane?.toString() || ''}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'lane', changeEvent.target.value)}
                    />
                  {getSavingIndicator(player.id, 'lane')}
                  </div>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center">
                  <div className="pos-relative inline-block">
                    <input
                      className="entries-input entries-control w-65"
                      type="text"
                      value={player.average}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'average', changeEvent.target.value)}
                    />
                    
                  {getSavingIndicator(player.id, 'average')}
                  </div>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center">
                  <div className="pos-relative inline-block">
                    <input
                      className="entries-input entries-control w-65"
                      type="text"
                      value={player.handicap}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'handicap', changeEvent.target.value)}
                    />
                    
                  {getSavingIndicator(player.id, 'handicap')}
                  </div>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center">
                  <div className="pos-relative inline-block">
                    <input
                      className="entries-input entries-control w-65"
                      type="text"
                      value={player.scratch}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'scratch', changeEvent.target.value)}
                    />
                    
                  {getSavingIndicator(player.id, 'scratch')}
                  </div>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center">
                  <div className="pos-relative inline-block">
                    <select
                      className="entries-select entries-control w-65"
                      value={player.division}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'division', changeEvent.target.value)}
                    >
                      <option value="Open">Open</option>
                      <option value="Womens">Womens</option>
                      <option value="Senior">Senior</option>
                      <option value="Junior">Junior</option>
                    </select>
                    {getSavingIndicator(player.id, 'division')}
                  </div>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center gap-10">
                  <span className="entries-cost">
                    ${player.totalCost.toFixed(2)}
                  </span>
                  <span 
                    onClick={() => {
                      const newPaidAmount = player.amountPaid >= player.totalCost ? 0 : player.totalCost;
                      handleCellEdit(player.id, 'amountPaid', newPaidAmount.toString());
                    }}
                    className={`payment-badge ${player.amountPaid >= player.totalCost ? 'payment-badge--paid' : 'payment-badge--due'}`}
                    title={`Click to toggle payment status. Current: $${player.amountPaid.toFixed(2)}`}
                  >
                    {player.amountPaid >= player.totalCost ? 'PAID' : 'DUE'}
                  </span>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <button
                  className="entries-delete-btn entries-control"
                  onClick={() => onDeletePlayer(player.id)}
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

