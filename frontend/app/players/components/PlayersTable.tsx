import React, { memo, useMemo, useState } from 'react';

import { PlayersTableProps } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';
import { handleTableArrowNavigation } from '../../lib/tableKeyboard';
import { divisionOptions, isProgramAllowedForDivision, normalizeDivision } from '../../lib/bracketPrograms';

type SortDirection = 'asc' | 'desc';

type SortConfig = {
  column: string;
  direction: SortDirection;
};

const PlayersTable = memo(({ 
  players, 
  onUpdatePlayer,
  onDeletePlayer,
  bracketPrograms,
  selectedSquad
}: PlayersTableProps) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'lane', direction: 'asc' });

  const sortedPlayers = useMemo(() => {
    const getNumber = (value: unknown) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseFloat(value) || 0;
      return 0;
    };

    const getSortValue = (player: typeof players[number], column: string): string | number => {
      if (column === 'name') return `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase();
      if (column === 'usbc') return String(player.usbc || '').toLowerCase();
      if (column === 'lane') return getNumber(player.lane);
      if (column === 'division') return normalizeDivision(player.division).toLowerCase();
      if (column === 'average') return getNumber(player.average);
      if (column === 'cost') return getNumber(player.totalCost);
      if (column.startsWith('bracket:')) {
        const programKey = column.replace('bracket:', '');
        return getNumber(player.bracketEntries?.[programKey] || 0);
      }
      return '';
    };

    return [...players].sort((left, right) => {
      const leftValue = getSortValue(left, sortConfig.column);
      const rightValue = getSortValue(right, sortConfig.column);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return sortConfig.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }

      const comparison = String(leftValue).localeCompare(String(rightValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [players, sortConfig]);

  const toggleSort = (column: string) => {
    setSortConfig(current => {
      if (current.column === column) {
        return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
  };

  const getSortState = (column: string): 'asc' | 'desc' | 'none' => {
    if (sortConfig.column !== column) return 'none';
    return sortConfig.direction;
  };

  const getAriaSort = (column: string): 'ascending' | 'descending' | 'none' => {
    const state = getSortState(column);
    if (state === 'asc') return 'ascending';
    if (state === 'desc') return 'descending';
    return 'none';
  };
  
  // Styles moved to globals.css; no inline style injection
  
  // No inline style injection; styles are defined in globals.css

  const handleCellEdit = (playerId: number, field: string, value: string) => {
    const numericFields = ['average', 'handicap', 'scratch', 'amountPaid'];
    const processedValue = numericFields.includes(field) ? parseInt(value) || 0 : value;
    onUpdatePlayer(playerId, field, processedValue);
  };

  const handleBracketEntryEdit = (playerId: number, programKey: string, value: string) => {
    onUpdatePlayer(playerId, `bracketEntry:${programKey}`, parseInt(value, 10) || 0)
  }

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
      <table className="entries-table" onKeyDownCapture={handleTableArrowNavigation}>
        <thead>
          {selectedSquad && (
            <tr>
              <td colSpan={7 + bracketPrograms.length} className="squad-banner">
                Showing players for: {selectedSquad.date} — {selectedSquad.time}
              </td>
            </tr>
          )}
          <tr className="entries-header-row">
            <th className="entries-header-cell col-usbc" aria-sort={getAriaSort('usbc')}>
              <button type="button" className={`entries-sort-btn ${getSortState('usbc') !== 'none' ? 'is-active' : ''}`} onClick={() => toggleSort('usbc')}>
                <span>USBC</span>
                <span className={`entries-sort-icon ${getSortState('usbc')}`} aria-hidden="true">{getSortState('usbc') === 'asc' ? '▲' : getSortState('usbc') === 'desc' ? '▼' : '▲▼'}</span>
              </button>
            </th>
            <th className="entries-header-cell col-name" aria-sort={getAriaSort('name')}>
              <button type="button" className={`entries-sort-btn ${getSortState('name') !== 'none' ? 'is-active' : ''}`} onClick={() => toggleSort('name')}>
                <span>Name</span>
                <span className={`entries-sort-icon ${getSortState('name')}`} aria-hidden="true">{getSortState('name') === 'asc' ? '▲' : getSortState('name') === 'desc' ? '▼' : '▲▼'}</span>
              </button>
            </th>
            <th className="entries-header-cell col-division" aria-sort={getAriaSort('division')}>
              <button type="button" className={`entries-sort-btn ${getSortState('division') !== 'none' ? 'is-active' : ''}`} onClick={() => toggleSort('division')}>
                <span>Division</span>
                <span className={`entries-sort-icon ${getSortState('division')}`} aria-hidden="true">{getSortState('division') === 'asc' ? '▲' : getSortState('division') === 'desc' ? '▼' : '▲▼'}</span>
              </button>
            </th>
            <th className="entries-header-cell col-lane" aria-sort={getAriaSort('lane')}>
              <button type="button" className={`entries-sort-btn ${getSortState('lane') !== 'none' ? 'is-active' : ''}`} onClick={() => toggleSort('lane')}>
                <span>Lane</span>
                <span className={`entries-sort-icon ${getSortState('lane')}`} aria-hidden="true">{getSortState('lane') === 'asc' ? '▲' : getSortState('lane') === 'desc' ? '▼' : '▲▼'}</span>
              </button>
            </th>
            <th className="entries-header-cell col-average" aria-sort={getAriaSort('average')}>
              <button type="button" className={`entries-sort-btn ${getSortState('average') !== 'none' ? 'is-active' : ''}`} onClick={() => toggleSort('average')}>
                <span>Average</span>
                <span className={`entries-sort-icon ${getSortState('average')}`} aria-hidden="true">{getSortState('average') === 'asc' ? '▲' : getSortState('average') === 'desc' ? '▼' : '▲▼'}</span>
              </button>
            </th>
            {bracketPrograms.map(program => (
              <th key={program.key} className="entries-header-cell col-scratch" aria-sort={getAriaSort(`bracket:${program.key}`)}>
                <button type="button" className={`entries-sort-btn ${getSortState(`bracket:${program.key}`) !== 'none' ? 'is-active' : ''}`} onClick={() => toggleSort(`bracket:${program.key}`)}>
                  <span>{program.name}</span>
                  <span className={`entries-sort-icon ${getSortState(`bracket:${program.key}`)}`} aria-hidden="true">{getSortState(`bracket:${program.key}`) === 'asc' ? '▲' : getSortState(`bracket:${program.key}`) === 'desc' ? '▼' : '▲▼'}</span>
                </button>
              </th>
            ))}
            <th className="entries-header-cell col-cost" aria-sort={getAriaSort('cost')}>
              <button type="button" className={`entries-sort-btn ${getSortState('cost') !== 'none' ? 'is-active' : ''}`} onClick={() => toggleSort('cost')}>
                <span>Cost / Status</span>
                <span className={`entries-sort-icon ${getSortState('cost')}`} aria-hidden="true">{getSortState('cost') === 'asc' ? '▲' : getSortState('cost') === 'desc' ? '▼' : '▲▼'}</span>
              </button>
            </th>
            <th className="entries-header-cell col-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => {
            const totalEntries = Object.values(player.bracketEntries || {}).reduce((sum, count) => sum + Number(count || 0), 0)
            const needsEntryFee = totalEntries > 0 && player.totalCost <= 0
            const isPaid = !needsEntryFee && player.amountPaid >= player.totalCost

            return (
            <OptimizedTableRow 
              key={player.id}
              className="players-table-row"
            >
              <OptimizedTableCell className="entries-cell medium">
                <div className="pos-relative flex-center">
                    <input
                    className="entries-input entries-control w-80"
                    type="text"
                    value={player.usbc || ''}
                    onChange={(changeEvent) => handleCellEdit(player.id, 'usbc', changeEvent.target.value)}
                    placeholder="USBC #"
                  />
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center gap-3">
                  <div className="pos-relative">
                    <input
                      className="entries-input entries-control w-75"
                      type="text"
                      value={player.firstName}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'firstName', changeEvent.target.value)}
                      placeholder="First"
                    />
                  </div>
                  <div className="pos-relative">
                    <input
                      className="entries-input entries-control w-75"
                      type="text"
                      value={player.lastName}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'lastName', changeEvent.target.value)}
                      placeholder="Last"
                    />
                  </div>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center">
                  <div className="pos-relative inline-block">
                    <select
                      className="entries-select entries-control w-85"
                      value={normalizeDivision(player.division)}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'division', changeEvent.target.value)}
                    >
                      {divisionOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
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
                  </div>
                </div>
              </OptimizedTableCell>

              {bracketPrograms.map(program => (
                <OptimizedTableCell key={program.key} className="entries-cell">
                  <div className="flex-center">
                    <div className="pos-relative inline-block">
                      {(() => {
                        const isAllowed = isProgramAllowedForDivision(program.division, player.division)
                        const visibleValue = isAllowed ? (player.bracketEntries?.[program.key] || 0) : 0
                        return (
                      <input
                        className="entries-input entries-control w-65"
                        type="text"
                        value={visibleValue}
                        onChange={(changeEvent) => handleBracketEntryEdit(player.id, program.key, changeEvent.target.value)}
                        disabled={!isAllowed}
                      />
                        )
                      })()}
                    </div>
                  </div>
                </OptimizedTableCell>
              ))}

              <OptimizedTableCell className="entries-cell">
                <div className="flex-center gap-6">
                  <span className="entries-cost">
                    ${player.totalCost.toFixed(2)}
                  </span>
                  <span 
                    onClick={() => {
                      if (needsEntryFee) return;
                      const newPaidAmount = isPaid ? 0 : player.totalCost;
                      handleCellEdit(player.id, 'amountPaid', newPaidAmount.toString());
                    }}
                    className={`payment-badge ${isPaid ? 'payment-badge--paid' : 'payment-badge--due'}`}
                    title={needsEntryFee ? 'Set a bracket entry fee in tournament settings to calculate player cost.' : `Click to toggle payment status. Current: $${player.amountPaid.toFixed(2)}`}
                  >
                    {needsEntryFee ? 'SET FEE' : isPaid ? 'PAID' : 'DUE'}
                  </span>
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell">
                <button
                  className="entries-delete-btn"
                  onClick={() => onDeletePlayer(player.id)}
                  aria-label={`Delete ${player.firstName} ${player.lastName}`.trim()}
                  title="Delete player"
                >
                  <span className="entries-delete-icon" aria-hidden="true">{'\u{1F5D1}'}</span>
                </button>
              </OptimizedTableCell>
            </OptimizedTableRow>
          )})}
        </tbody>
      </table>
    </div>
  );
});

PlayersTable.displayName = 'PlayersTable';

export default PlayersTable;

