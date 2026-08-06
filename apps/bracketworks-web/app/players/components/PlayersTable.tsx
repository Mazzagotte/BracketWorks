import React, { memo, useEffect, useMemo, useState } from 'react';

import { PlayersTableProps, SidePotsSettings } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';
import { handleTableArrowNavigation } from '../../lib/tableKeyboard';
import { divisionOptions, isProgramAllowedForDivision, normalizeDivision } from '../../lib/bracketPrograms';
import { SortableHeader, SortConfig } from '../../components/SortableHeader';
import styles from '../entries.module.css';
import tableStyles from '../../styles/tables.module.css';
import badgeStyles from '../../styles/badges.module.css';
import iconButtonStyles from '../../styles/icon-buttons.module.css';
import buttonStyles from '../../styles/buttons.module.css';
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';

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
  hasActiveFilters = false,
  onClearFilters,
}: PlayersTableProps) => {
  const enabledPots = useMemo(
    () => (sidePots?.pots ?? []).filter(p => p.enabled),
    [sidePots]
  );
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'lane', direction: 'asc' });
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  const totalPages = Math.max(1, Math.ceil(sortedPlayers.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedPlayers = sortedPlayers.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setCurrentPage(current => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [players.length, pageSize]);

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

  const renderMobileCard = (player: typeof players[number], rowIndex: number) => {
    const totalEntries = Object.values(player.bracketEntries || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    const needsEntryFee = totalEntries > 0 && player.totalCost <= 0;
    const hasPayableAmount = player.totalCost > 0;
    const isPaid = hasPayableAmount && !needsEntryFee && player.amountPaid >= player.totalCost;
    const isExpanded = Boolean(expandedRows[player.id]);
    const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unnamed Player';
    const cardStatusClass = needsEntryFee
      ? styles.mobilePlayerCardSetFee
      : isPaid
        ? styles.mobilePlayerCardPaid
        : styles.mobilePlayerCardDue;
    const statusPillClass = needsEntryFee
      ? badgeStyles.warning
      : isPaid
        ? badgeStyles.success
        : badgeStyles.danger;

    return (
      <article key={`${player.id}-${rowIndex}`} className={`${styles.mobilePlayerCard} ${cardStatusClass}`}>
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
              <span className={`${badgeStyles.badge} ${badgeStyles.compact} ${statusPillClass}`}>
                {needsEntryFee ? 'SET FEE' : isPaid ? 'PAID' : 'DUE'}
              </span>
            </div>

            <span className={styles.mobileExpandIcon}>{isExpanded ? '−' : '+'}</span>
          </div>
        </button>

        {isExpanded && (
          <div id={`mobile-player-details-${player.id}`} className={styles.mobilePlayerDetails}>
            <div className={styles.mobilePlayerFieldGrid}>
              <label className={`${styles.mobilePlayerField} ${styles.mobileFieldUsbc}`}>
                <span>USBC</span>
                <input className="entries-input entries-control" type="text" value={player.usbc || ''} onChange={event => handleCellEdit(player.id, 'usbc', event.target.value)} />
              </label>

              <label className={`${styles.mobilePlayerField} ${styles.mobileFieldFirstName}`}>
                <span>First Name</span>
                <input className="entries-input entries-control" type="text" value={player.firstName || ''} onChange={event => handleCellEdit(player.id, 'firstName', event.target.value)} />
              </label>

              <label className={`${styles.mobilePlayerField} ${styles.mobileFieldLastName}`}>
                <span>Last Name</span>
                <input className="entries-input entries-control" type="text" value={player.lastName || ''} onChange={event => handleCellEdit(player.id, 'lastName', event.target.value)} />
              </label>

              <label className={`${styles.mobilePlayerField} ${styles.mobileFieldDivision}`}>
                <span>Division</span>
                <select className="entries-select entries-control" value={normalizeDivision(player.division)} onChange={event => handleCellEdit(player.id, 'division', event.target.value)}>
                  {divisionOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className={`${styles.mobilePlayerField} ${styles.mobileFieldLane}`}>
                <span>Lane</span>
                <input className="entries-input entries-control" type="text" value={player.lane || ''} onChange={event => handleCellEdit(player.id, 'lane', event.target.value)} />
              </label>

              <label className={`${styles.mobilePlayerField} ${styles.mobileFieldAverage}`}>
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
                        <span title={program.name}>{abbreviateProgramName(program.name)}</span>
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
                  if (needsEntryFee || !hasPayableAmount) return;
                  const newPaidAmount = isPaid ? 0 : player.totalCost;
                  handleCellEdit(player.id, 'amountPaid', newPaidAmount.toString());
                }}
                disabled={needsEntryFee || !hasPayableAmount}
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
      <div className={styles.tableEmptyState}>
        <div className={styles.tableEmptyTitle}>{hasActiveFilters ? 'No matching entries' : 'No entries yet'}</div>
        <div className={styles.tableEmptyText}>
          {hasActiveFilters
            ? 'Try searching by USBC number, first name, or last name.'
            : 'Add a bowler to begin building this squad.'}
        </div>
        {hasActiveFilters && onClearFilters && (
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.clearSearchBtn} ${styles.tableEmptyClearBtn}`}
            onClick={onClearFilters}
          >
            Clear Search
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {globalSaveStatus !== 'idle' && (
        <div className={`table-save-status table-save-status--${globalSaveStatus}`}>
          {globalSaveStatus === 'saving' && 'Saving...'}
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
            {paginatedPlayers.map((player, rowIndex) => renderMobileCard(player, pageStart + rowIndex))}
          </div>
        </>
      ) : (
      <table className={`${tableStyles.table} entries-table`} onKeyDownCapture={handleTableArrowNavigation}>
        <thead>
          <tr className="entries-header-row">
            <SortableHeader column="usbc" sortConfig={sortConfig} onSort={toggleSort} className="col-usbc">
              USBC
            </SortableHeader>
            <SortableHeader column="name" sortConfig={sortConfig} onSort={toggleSort} className="col-name">
              Bowler
            </SortableHeader>
            <SortableHeader column="division" sortConfig={sortConfig} onSort={toggleSort} className="col-division group-start">
              Division
            </SortableHeader>
            <SortableHeader column="lane" sortConfig={sortConfig} onSort={toggleSort} className="col-lane">
              Lane
            </SortableHeader>
            <SortableHeader column="average" sortConfig={sortConfig} onSort={toggleSort} className="col-average">
              Avg
            </SortableHeader>
            {bracketPrograms.map((program, programIndex) => (
              <SortableHeader key={`program-header-${program.key}`} column={`bracket:${program.key}`} sortConfig={sortConfig} onSort={toggleSort} className={`col-scratch${programIndex === 0 ? ' group-start' : ''}`}>
                <abbr title={program.name} className={styles.programAbbr}>{abbreviateProgramName(program.name)}</abbr>
              </SortableHeader>
            ))}
            {enabledPots.map(pot => (
              <th key={`sidepot-header-${pot.key}`} className="entries-header-cell col-sidepot">
                {pot.name}
              </th>
            ))}
            <SortableHeader column="cost" sortConfig={sortConfig} onSort={toggleSort} className={`${tableStyles.numericCell} col-cost group-start`}>
              Total
            </SortableHeader>
            <th className={`${tableStyles.statusCell} entries-header-cell col-status`}>
              Status
            </th>
            <th className={`${tableStyles.actionCell} entries-header-cell col-actions group-start`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedPlayers.map((player, rowIndex) => {
            const totalEntries = Object.values(player.bracketEntries || {}).reduce((sum, count) => sum + Number(count || 0), 0)
            const needsEntryFee = totalEntries > 0 && player.totalCost <= 0
            const hasPayableAmount = player.totalCost > 0
            const isPaid = hasPayableAmount && !needsEntryFee && player.amountPaid >= player.totalCost
            const isPartial = hasPayableAmount && !needsEntryFee && !isPaid && player.amountPaid > 0
            const isEditing = editingRowId === player.id
            return (
            <OptimizedTableRow 
              key={`${player.id}-${rowIndex}`}
              className={`players-table-row${isEditing ? ' entries-row--editing' : ''}`}
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

              <OptimizedTableCell className="entries-cell col-division group-start">
                <div className="flex-center">
                  {isEditing ? <div className="pos-relative inline-block">
                    <select
                      className="entries-select entries-control w-85"
                      value={normalizeDivision(player.division)}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'division', changeEvent.target.value)}
                    >
                      {divisionOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div> : <span className="cell-readonly-text">{normalizeDivision(player.division)}</span>}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell col-lane">
                <div className="flex-center">
                  {isEditing ? <div className="pos-relative inline-block">
                    <input
                      className="entries-input entries-control"
                      type="text"
                      inputMode="numeric"
                      size={3}
                      maxLength={3}
                      value={player.lane?.toString() || ''}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'lane', changeEvent.target.value)}
                    />
                  </div> : <span className="cell-readonly-text numeric-readonly">{player.lane || '—'}</span>}
                </div>
              </OptimizedTableCell>

              <OptimizedTableCell className="entries-cell col-average">
                <div className="flex-center">
                  {isEditing ? <div className="pos-relative inline-block">
                    <input
                      className="entries-input entries-control"
                      type="text"
                      inputMode="numeric"
                      size={3}
                      maxLength={3}
                      value={player.average}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'average', changeEvent.target.value)}
                    />
                  </div> : <span className="cell-readonly-text numeric-readonly">{player.average}</span>}
                </div>
              </OptimizedTableCell>

              {bracketPrograms.map((program, programIndex) => (
                <OptimizedTableCell key={`program-cell-${player.id}-${program.key}`} className={`entries-cell col-scratch${programIndex === 0 ? ' group-start' : ''}`}>
                  <div className="flex-center">
                    <div className="pos-relative inline-block">
                      {(() => {
                        const isAllowed = isProgramAllowedForDivision(program.division, player.division)
                        const visibleValue = isAllowed ? (player.bracketEntries?.[program.key] || 0) : 0
                        return isEditing ? (
                          <input
                            className="entries-input entries-control"
                            type="text"
                            inputMode="numeric"
                            size={3}
                            maxLength={3}
                            value={visibleValue}
                            onChange={(changeEvent) => handleBracketEntryEdit(player.id, program.key, changeEvent.target.value)}
                            disabled={!isAllowed}
                          />
                        ) : (
                          <span className="cell-readonly-text numeric-readonly">{visibleValue}</span>
                        )
                      })()}
                    </div>
                  </div>
                </OptimizedTableCell>
              ))}

              {enabledPots.map(pot => {
                const checked = Boolean(player.sidePotEntries?.[pot.key])
                return (
                  <OptimizedTableCell key={`sidepot-cell-${player.id}-${pot.key}`} className="entries-cell entries-cell--sidepot col-sidepot">
                    <div className="flex-center">
                      {isEditing ? <input
                        type="checkbox"
                        className="sidepot-checkbox"
                        checked={checked}
                        onChange={() => handleSidePotToggle(player.id, pot.key, checked)}
                        aria-label={`${pot.name} for ${player.firstName} ${player.lastName}`}
                      /> : <span className="cell-readonly-text">{checked ? 'Yes' : '—'}</span>}
                    </div>
                  </OptimizedTableCell>
                )
              })}
              <OptimizedTableCell className={`${tableStyles.numericCell} entries-cell col-cost group-start`}>
                <span className="entries-cost">
                  ${player.totalCost.toFixed(2)}
                </span>
              </OptimizedTableCell>

              <OptimizedTableCell className={`${tableStyles.statusCell} entries-cell col-status`}>
                <span
                  onClick={() => {
                    if (needsEntryFee || !hasPayableAmount) return;
                    const newPaidAmount = isPaid ? 0 : player.totalCost;
                    handleCellEdit(player.id, 'amountPaid', newPaidAmount.toString());
                  }}
                  className={`${badgeStyles.badge} ${badgeStyles.compact} ${
                    needsEntryFee
                      ? badgeStyles.warning
                      : isPaid
                        ? badgeStyles.success
                        : isPartial
                          ? badgeStyles.accent
                          : badgeStyles.danger
                  }`}
                  title={needsEntryFee ? 'Set a bracket entry fee in tournament settings to calculate player cost.' : `Click to toggle payment status. Current: $${player.amountPaid.toFixed(2)}`}
                >
                  {needsEntryFee ? 'SET FEE' : isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'DUE'}
                </span>
              </OptimizedTableCell>

              <OptimizedTableCell className={`${tableStyles.actionCell} entries-cell col-actions group-start`}>
                <div className={`${tableStyles.rowActions} ${styles.tableRowActions}`}>
                  <button
                    className={`${iconButtonStyles.iconButton} entries-edit-btn${isEditing ? ' entries-edit-btn--active' : ''}`}
                    onClick={() => setEditingRowId(isEditing ? null : player.id)}
                    aria-label={isEditing ? 'Done editing' : 'Edit bowler name and USBC'}
                    title={isEditing ? 'Done editing' : 'Edit name / USBC'}
                  >
                    {isEditing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                  </button>
                  <button
                    className={`${iconButtonStyles.iconButton} ${iconButtonStyles.danger} entries-delete-btn`}
                    onClick={() => onDeletePlayer(player.id)}
                    aria-label={`Delete ${player.firstName} ${player.lastName}`.trim()}
                    title="Delete player"
                  >
                    <Trash2 className="entries-delete-icon" aria-hidden="true" />
                  </button>
                </div>
              </OptimizedTableCell>
            </OptimizedTableRow>
          )})}
        </tbody>
      </table>
      )}
      <div className={styles.tablePagination}>
        <span className={styles.tablePaginationSummary}>
          Showing {sortedPlayers.length === 0 ? 0 : pageStart + 1} to {Math.min(pageStart + pageSize, sortedPlayers.length)} of {sortedPlayers.length} entries
        </span>
        <div className={styles.tablePaginationControls}>
          <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Previous page">
            <ChevronLeft aria-hidden="true" />
          </button>
          <span>{currentPage} / {totalPages}</span>
          <button type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} aria-label="Next page">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <label className={styles.tablePageSize}>
          Rows per page
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>
    </div>
    </>
  );
});

PlayersTable.displayName = 'PlayersTable';

export default PlayersTable;

