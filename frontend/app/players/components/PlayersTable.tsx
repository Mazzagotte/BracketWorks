import React, { memo, useEffect, useMemo, useState } from 'react';

import { PlayersTableProps, SidePotsSettings } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';
import { handleTableArrowNavigation } from '../../lib/tableKeyboard';
import { divisionOptions, isProgramAllowedForDivision, normalizeDivision } from '../../lib/bracketPrograms';
import { SortableHeader, SortConfig } from '../../components/SortableHeader';
import styles from '../entries.module.css';

function abbreviateProgramName(name: string): string {
  const map: [string, string][] = [
    ['Reverse Scratch', 'Rev. Scratch'],
    ['Reverse Handicap', 'Rev. Hcap'],
    ["Women's Scratch", "Women's"],
    ["Women's Handicap", "Women's Hcap"],
    ['High Game Scratch', 'HG Scratch'],
    ['High Game Handicap', 'HG Hcap'],
    ['Seniors Scratch', 'Sr. Scratch'],
    ['Seniors Handicap', 'Sr. Hcap'],
    ['Juniors Scratch', 'Jr. Scratch'],
    ['Juniors Handicap', 'Jr. Hcap'],
  ];
  for (const [from, to] of map) {
    if (name.includes(from)) return name.replace(from, to);
  }
  return name;
}

const PlayersTable = memo(({ 
  players, 
  onUpdatePlayer,
  onDeletePlayer,
  savingStatus,
  bracketPrograms,
  selectedSquad,
  sidePots,
}: PlayersTableProps) => {
  const enabledPots = useMemo(
    () => (sidePots?.pots ?? []).filter(p => p.enabled),
    [sidePots]
  );
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'lane', direction: 'asc' });
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [editingRowId, setEditingRowId] = useState<number | null>(null);

  const globalSaveStatus = useMemo(() => {
    const values = Object.values(savingStatus);
    if (values.some(v => v === 'saving')) return 'saving';
    if (values.some(v => v === 'error')) return 'error';
    if (values.some(v => v === 'success')) return 'success';
    return 'idle';
  }, [savingStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 900px)');
    const syncLayout = () => setIsMobileLayout(mediaQuery.matches);
    syncLayout();

    mediaQuery.addEventListener('change', syncLayout);
    return () => mediaQuery.removeEventListener('change', syncLayout);
  }, []);

  const maxUsbcChars = useMemo(() => {
    const maxChars = players.reduce((maxValue, player) => Math.max(maxValue, String(player.usbc || '').trim().length), 0)
    return Math.min(14, Math.max(8, maxChars))
  }, [players])

  const maxFirstNameChars = useMemo(() => {
    const maxChars = players.reduce((maxValue, player) => Math.max(maxValue, (player.firstName || '').trim().length), 0)
    return Math.min(16, Math.max(5, maxChars))
  }, [players])

  const maxLastNameChars = useMemo(() => {
    const maxChars = players.reduce((maxValue, player) => Math.max(maxValue, (player.lastName || '').trim().length), 0)
    return Math.min(20, Math.max(6, maxChars))
  }, [players])

  const sortedPlayers = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) return [...players];

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
      const leftValue = getSortValue(left, sortConfig.column!);
      const rightValue = getSortValue(right, sortConfig.column!);

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
        const newDir = current.direction === 'asc' ? 'desc' : current.direction === 'desc' ? null : 'asc';
        return { column: newDir ? column : null, direction: newDir };
      }
      return { column, direction: 'asc' };
    });
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

  const handleSidePotToggle = (playerId: number, potKey: string, current: boolean) => {
    onUpdatePlayer(playerId, `sidePot:${potKey}`, !current)
  }

  const handleIncrement = (playerId: number, field: string, currentValue: number, step = 1) => {
    const newValue = currentValue + step;
    onUpdatePlayer(playerId, field, newValue);
  };

  const handleDecrement = (playerId: number, field: string, currentValue: number, step = 1) => {
    const newValue = Math.max(0, currentValue - step);
    onUpdatePlayer(playerId, field, newValue);
  };

  const toggleMobileCard = (playerId: number) => {
    setExpandedRows(previous => ({ ...previous, [playerId]: !previous[playerId] }));
  };

  const renderMobileCard = (player: typeof players[number]) => {
    const totalEntries = Object.values(player.bracketEntries || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    const needsEntryFee = totalEntries > 0 && player.totalCost <= 0;
    const isPaid = !needsEntryFee && player.amountPaid >= player.totalCost;
    const isExpanded = Boolean(expandedRows[player.id]);
    const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unnamed Player';
    const cardStatusClass = needsEntryFee
      ? styles.mobilePlayerCardSetFee
      : isPaid
        ? styles.mobilePlayerCardPaid
        : styles.mobilePlayerCardDue;
    const statusPillClass = needsEntryFee
      ? styles.mobileStatusPillSetFee
      : isPaid
        ? styles.mobileStatusPillPaid
        : styles.mobileStatusPillDue;

    return (
      <article key={player.id} className={`${styles.mobilePlayerCard} ${cardStatusClass}`}>
        <button
          type="button"
          className={styles.mobilePlayerHeader}
          onClick={() => toggleMobileCard(player.id)}
          aria-expanded={isExpanded}
          aria-controls={`mobile-player-details-${player.id}`}
        >
          <div className={styles.mobilePlayerCompactView}>
            <div className={styles.mobilePlayerIdentity}>
              <h4 className={styles.mobilePlayerName}>{playerName}</h4>
            </div>

            <div className={styles.mobilePlayerTotals}>
              <span className={styles.mobilePlayerCost}>${player.totalCost.toFixed(2)}</span>
              <span className={`${styles.mobileStatusPill} ${statusPillClass}`}>
                {needsEntryFee ? 'SET FEE' : isPaid ? 'PAID' : 'DUE'}
              </span>
            </div>

            <span className={styles.mobileExpandIcon}>{isExpanded ? '−' : '+'}</span>
          </div>
        </button>

        {isExpanded && (
          <div id={`mobile-player-details-${player.id}`} className={styles.mobilePlayerDetails}>
            <div className={styles.mobilePlayerFieldGrid}>
              <label className={styles.mobilePlayerField}>
                <span>USBC</span>
                <input className="entries-input entries-control" type="text" value={player.usbc || ''} onChange={event => handleCellEdit(player.id, 'usbc', event.target.value)} />
              </label>

              <label className={styles.mobilePlayerField}>
                <span>First Name</span>
                <input className="entries-input entries-control" type="text" value={player.firstName || ''} onChange={event => handleCellEdit(player.id, 'firstName', event.target.value)} />
              </label>

              <label className={styles.mobilePlayerField}>
                <span>Last Name</span>
                <input className="entries-input entries-control" type="text" value={player.lastName || ''} onChange={event => handleCellEdit(player.id, 'lastName', event.target.value)} />
              </label>

              <label className={styles.mobilePlayerField}>
                <span>Division</span>
                <select className="entries-select entries-control" value={normalizeDivision(player.division)} onChange={event => handleCellEdit(player.id, 'division', event.target.value)}>
                  {divisionOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className={styles.mobilePlayerField}>
                <span>Lane</span>
                <input className="entries-input entries-control" type="text" value={player.lane || ''} onChange={event => handleCellEdit(player.id, 'lane', event.target.value)} />
              </label>

              <label className={styles.mobilePlayerField}>
                <span>Average</span>
                <input className="entries-input entries-control" type="text" value={player.average} onChange={event => handleCellEdit(player.id, 'average', event.target.value)} />
              </label>
            </div>

            {bracketPrograms.length > 0 && (
              <div className={styles.mobileProgramSection}>
                <div className={styles.mobileSectionTitle}>Bracket Entries</div>
                <div className={styles.mobileProgramGrid}>
                  {bracketPrograms.map(program => {
                    const isAllowed = isProgramAllowedForDivision(program.division, player.division);
                    const visibleValue = isAllowed ? (player.bracketEntries?.[program.key] || 0) : 0;

                    return (
                      <label key={program.key} className={styles.mobilePlayerField}>
                        <span>{program.name}</span>
                        <input
                          className="entries-input entries-control"
                          type="text"
                          value={visibleValue}
                          disabled={!isAllowed}
                          onChange={event => handleBracketEntryEdit(player.id, program.key, event.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {enabledPots.length > 0 && (
              <div className={styles.mobileProgramSection}>
                <div className={styles.mobileSectionTitle}>Side Pots</div>
                <div className={styles.mobileSidePotList}>
                  {enabledPots.map(pot => {
                    const checked = Boolean(player.sidePotEntries?.[pot.key]);
                    return (
                      <label key={pot.key} className={styles.mobileSidePotToggle}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleSidePotToggle(player.id, pot.key, checked)}
                        />
                        <span>{pot.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={styles.mobilePlayerActionsRow}>
              <button
                type="button"
                className={styles.mobilePlayerActionBtn}
                onClick={() => {
                  if (needsEntryFee) return;
                  const newPaidAmount = isPaid ? 0 : player.totalCost;
                  handleCellEdit(player.id, 'amountPaid', newPaidAmount.toString());
                }}
                disabled={needsEntryFee}
              >
                {isPaid ? 'Mark Due' : 'Mark Paid'}
              </button>
              <button
                type="button"
                className={styles.mobilePlayerActionBtnDanger}
                onClick={() => onDeletePlayer(player.id)}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </article>
    );
  };

  if (players.length === 0) {
    return (
      <div className="entries-empty">
        No players found. Add some players to get started.
      </div>
    );
  }

  return (
    <>
      {globalSaveStatus !== 'idle' && (
        <div className={`table-save-status table-save-status--${globalSaveStatus}`}>
          {globalSaveStatus === 'saving' && 'Saving…'}
          {globalSaveStatus === 'success' && 'All changes saved'}
          {globalSaveStatus === 'error' && 'Failed to save — check your connection'}
        </div>
      )}
      <div className={`entries-container ${isMobileLayout ? styles.mobileEntriesContainer : ''}`}>
      {isMobileLayout ? (
        <>
          {selectedSquad && (
            <div className={styles.mobileSquadBanner}>
              Entries for {selectedSquad.date} · {selectedSquad.time} Squad
            </div>
          )}
          <div className={styles.mobilePlayersList}>
            {sortedPlayers.map(player => renderMobileCard(player))}
          </div>
        </>
      ) : (
      <table className="entries-table" onKeyDownCapture={handleTableArrowNavigation}>
        <thead>
          {selectedSquad && (
            <tr>
              <td colSpan={7 + bracketPrograms.length + enabledPots.length} className="squad-banner">
                Entries for {selectedSquad.date} · {selectedSquad.time} Squad
              </td>
            </tr>
          )}
          <tr className="entries-header-row">
            <SortableHeader column="usbc" sortConfig={sortConfig} onSort={toggleSort} className="col-usbc">
              USBC
            </SortableHeader>
            <SortableHeader column="name" sortConfig={sortConfig} onSort={toggleSort} className="col-name">
              Bowler
            </SortableHeader>
            <SortableHeader column="division" sortConfig={sortConfig} onSort={toggleSort} className="col-division">
              Division
            </SortableHeader>
            <SortableHeader column="lane" sortConfig={sortConfig} onSort={toggleSort} className="col-lane">
              Lane
            </SortableHeader>
            <SortableHeader column="average" sortConfig={sortConfig} onSort={toggleSort} className="col-average">
              Avg
            </SortableHeader>
            {bracketPrograms.map(program => (
              <SortableHeader key={program.key} column={`bracket:${program.key}`} sortConfig={sortConfig} onSort={toggleSort} className="col-scratch">
                <abbr title={program.name} style={{ textDecoration: 'none' }}>{abbreviateProgramName(program.name)}</abbr>
              </SortableHeader>
            ))}
            {enabledPots.map(pot => (
              <th key={pot.key} className="entries-header-cell col-sidepot">
                {pot.name}
              </th>
            ))}
            <SortableHeader column="cost" sortConfig={sortConfig} onSort={toggleSort} className="col-cost">
              Total / Status
            </SortableHeader>
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
            const isEditing = editingRowId === player.id

            return (
            <OptimizedTableRow 
              key={player.id}
              className="players-table-row"
            >
              <OptimizedTableCell className="entries-cell medium col-usbc">
                <div className="pos-relative flex-center">
                  {isEditing ? (
                    <input
                      className="entries-input entries-control"
                      type="text"
                      size={maxUsbcChars}
                      value={player.usbc || ''}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'usbc', changeEvent.target.value)}
                      placeholder="USBC #"
                    />
                  ) : (
                    <span className="cell-readonly-text">{player.usbc || <span className="cell-empty">—</span>}</span>
                  )}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell col-name">
                {isEditing ? (
                  <div className="flex-center gap-3">
                    <div className="pos-relative">
                      <input
                        className="entries-input entries-control"
                        type="text"
                        size={maxFirstNameChars}
                        value={player.firstName}
                        onChange={(changeEvent) => handleCellEdit(player.id, 'firstName', changeEvent.target.value)}
                        placeholder="First"
                      />
                    </div>
                    <div className="pos-relative">
                      <input
                        className="entries-input entries-control"
                        type="text"
                        size={maxLastNameChars}
                        value={player.lastName}
                        onChange={(changeEvent) => handleCellEdit(player.id, 'lastName', changeEvent.target.value)}
                        placeholder="Last"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="cell-readonly-text cell-bowler-name">
                    {player.firstName || player.lastName
                      ? `${player.firstName || ''} ${player.lastName || ''}`.trim()
                      : <span className="cell-empty">Unnamed</span>}
                  </span>
                )}
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell col-division">
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

              <OptimizedTableCell className="entries-cell col-lane">
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

              <OptimizedTableCell className="entries-cell col-average">
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
                <OptimizedTableCell key={program.key} className="entries-cell col-scratch">
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

              {enabledPots.map(pot => {
                const checked = Boolean(player.sidePotEntries?.[pot.key])
                return (
                  <OptimizedTableCell key={pot.key} className="entries-cell entries-cell--sidepot col-sidepot">
                    <div className="flex-center">
                      <input
                        type="checkbox"
                        className="sidepot-checkbox"
                        checked={checked}
                        onChange={() => handleSidePotToggle(player.id, pot.key, checked)}
                        aria-label={`${pot.name} for ${player.firstName} ${player.lastName}`}
                      />
                    </div>
                  </OptimizedTableCell>
                )
              })}
              <OptimizedTableCell className="entries-cell col-cost">
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

              <OptimizedTableCell className="entries-cell col-actions">
                <div className="row-actions">
                  <button
                    className={`entries-edit-btn${isEditing ? ' entries-edit-btn--active' : ''}`}
                    onClick={() => setEditingRowId(isEditing ? null : player.id)}
                    aria-label={isEditing ? 'Done editing' : 'Edit bowler name and USBC'}
                    title={isEditing ? 'Done editing' : 'Edit name / USBC'}
                  >
                    {isEditing ? '✕' : '✏'}
                  </button>
                  <button
                    className="entries-delete-btn"
                    onClick={() => onDeletePlayer(player.id)}
                    aria-label={`Delete ${player.firstName} ${player.lastName}`.trim()}
                    title="Delete player"
                  >
                    <span className="entries-delete-icon" aria-hidden="true">{'\u{1F5D1}'}</span>
                  </button>
                </div>
              </OptimizedTableCell>
            </OptimizedTableRow>
          )})}
        </tbody>
      </table>
      )}
    </div>
    </>
  );
});

PlayersTable.displayName = 'PlayersTable';

export default PlayersTable;

