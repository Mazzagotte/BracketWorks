import React, { memo, useEffect, useMemo, useState } from 'react';

import { PlayersTableProps, SidePotsSettings } from '../types';
import { OptimizedTableRow, OptimizedTableCell } from '../../lib/performance';
import { handleTableArrowNavigation } from '../../lib/tableKeyboard';
import { divisionOptions, isProgramAllowedForDivision, normalizeDivision } from '../../lib/bracketPrograms';
import { COMPACT_CONTENT_VIEWPORT_QUERY } from '../../lib/responsive';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { SortableHeader, SortConfig } from '../../components/SortableHeader';
import styles from './PlayersTable.module.css';
import { ChevronDown, ChevronUp, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { Badge, Button, CheckboxField, DataTable, EmptyState, ICON_SIZE, Menu, MenuItem, Pagination, SelectField, TextField } from '@bracketworks/ui';

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

type PaymentStatus = {
  label: string;
  tone: 'warning' | 'success' | 'info' | 'danger';
  isPaid: boolean;
  canToggle: boolean;
};

/** One payment status rule for the table and the phone rows. */
function getPaymentStatus(player: { bracketEntries?: Record<string, number>; totalCost: number; amountPaid: number }): PaymentStatus {
  const totalEntries = Object.values(player.bracketEntries || {}).reduce((sum, count) => sum + Number(count || 0), 0);
  const needsEntryFee = totalEntries > 0 && player.totalCost <= 0;
  const hasPayableAmount = player.totalCost > 0;
  const isPaid = hasPayableAmount && !needsEntryFee && player.amountPaid >= player.totalCost;
  const isPartial = hasPayableAmount && !needsEntryFee && !isPaid && player.amountPaid > 0;
  const canToggle = hasPayableAmount && !needsEntryFee;
  if (needsEntryFee) return { label: 'Set fee', tone: 'warning', isPaid, canToggle };
  if (isPaid) return { label: 'Paid', tone: 'success', isPaid, canToggle };
  if (isPartial) return { label: 'Partial', tone: 'info', isPaid, canToggle };
  return { label: 'Due', tone: 'danger', isPaid, canToggle };
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
  const isMobileLayout = useMediaQuery(COMPACT_CONTENT_VIEWPORT_QUERY);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const globalSaveStatus = useMemo(() => {
    const values = Object.values(savingStatus);
    if (values.some(v => v === 'saving')) return 'saving';
    if (values.some(v => v === 'error')) return 'error';
    if (values.some(v => v === 'success')) return 'success';
    return 'idle';
  }, [savingStatus]);


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

  const renderMobileRow = (player: typeof players[number], rowIndex: number) => {
    const status = getPaymentStatus(player);
    const isExpanded = Boolean(expandedRows[player.id]);
    const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unnamed bowler';
    const detailsId = `mobile-player-details-${player.id}`;

    return (
      <li key={`${player.id}-${rowIndex}`} className={styles.mobileRow}>
        <button
          type="button"
          className={styles.mobileRowHeader}
          onClick={() => toggleMobileCard(player.id)}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
        >
          <span className={styles.mobileIdentity}>
            <span className={styles.mobileName}>{playerName}</span>
            <span className={styles.mobileMeta}>
              {[player.lane ? `Lane ${player.lane}` : null, `Avg ${player.average}`, normalizeDivision(player.division)].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className={styles.mobileTotal}>${player.totalCost.toFixed(2)}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
          {isExpanded
            ? <ChevronUp size={ICON_SIZE.md} aria-hidden="true" />
            : <ChevronDown size={ICON_SIZE.md} aria-hidden="true" />}
        </button>

        {isExpanded ? (
          <div id={detailsId} className={styles.mobileDetails}>
            <div className={styles.mobileFields}>
              <TextField label="First name" value={player.firstName || ''} onChange={event => handleCellEdit(player.id, 'firstName', event.target.value)} />
              <TextField label="Last name" value={player.lastName || ''} onChange={event => handleCellEdit(player.id, 'lastName', event.target.value)} />
              <TextField label="USBC number" value={player.usbc || ''} onChange={event => handleCellEdit(player.id, 'usbc', event.target.value)} />
              <SelectField label="Division" value={normalizeDivision(player.division)} onChange={event => handleCellEdit(player.id, 'division', event.target.value)}>
                {divisionOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectField>
              <TextField label="Lane" value={player.lane || ''} onChange={event => handleCellEdit(player.id, 'lane', event.target.value)} />
              <TextField label="Average" inputMode="numeric" value={player.average} onChange={event => handleCellEdit(player.id, 'average', event.target.value)} />
              {bracketPrograms.map(program => {
                const isAllowed = isProgramAllowedForDivision(program.division, player.division);
                return (
                  <TextField
                    key={program.key}
                    label={`${program.name} entries`}
                    inputMode="numeric"
                    value={isAllowed ? (player.bracketEntries?.[program.key] || 0) : 0}
                    disabled={!isAllowed}
                    helper={isAllowed ? undefined : 'Not open to this division'}
                    onChange={event => handleBracketEntryEdit(player.id, program.key, event.target.value)}
                  />
                );
              })}
            </div>

            {enabledPots.length > 0 ? (
              <fieldset className={styles.mobilePots}>
                <legend className={styles.mobileLegend}>Side pots</legend>
                {enabledPots.map(pot => {
                  const checked = Boolean(player.sidePotEntries?.[pot.key]);
                  return (
                    <CheckboxField
                      key={pot.key}
                      label={pot.name}
                      checked={checked}
                      onChange={() => handleSidePotToggle(player.id, pot.key, checked)}
                    />
                  );
                })}
              </fieldset>
            ) : null}

            <div className={styles.mobileActions}>
              <Button
                size="sm"
                variant="ghost-danger"
                icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />}
                onClick={() => onDeletePlayer(player.id)}
              >
                Delete entry
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!status.canToggle}
                onClick={() => handleCellEdit(player.id, 'amountPaid', (status.isPaid ? 0 : player.totalCost).toString())}
              >
                {status.isPaid ? 'Mark as due' : 'Mark as paid'}
              </Button>
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  if (players.length === 0) {
    return (
      <EmptyState
        icon={<Users size={ICON_SIZE['2xl']} aria-hidden="true" />}
        title={hasActiveFilters ? 'No matching entries' : 'No entries yet'}
        description={hasActiveFilters
          ? 'Try searching by USBC number, first name, or last name.'
          : 'Add a bowler to begin building this squad.'}
        action={hasActiveFilters && onClearFilters ? (
          <Button variant="secondary" onClick={onClearFilters}>Clear search</Button>
        ) : undefined}
      />
    );
  }

  const firstShown = sortedPlayers.length === 0 ? 0 : pageStart + 1;
  const lastShown = Math.min(pageStart + pageSize, sortedPlayers.length);

  return (
    <>
      {globalSaveStatus !== 'idle' ? (
        <p className={globalSaveStatus === 'error' ? styles.saveError : styles.saveStatus} role="status">
          {globalSaveStatus === 'saving' && 'Saving...'}
          {globalSaveStatus === 'success' && 'All changes saved'}
          {globalSaveStatus === 'error' && 'Failed to save. Check your connection.'}
        </p>
      ) : null}
      {isMobileLayout ? (
        <ul className={styles.mobileList}>
          {paginatedPlayers.map((player, rowIndex) => renderMobileRow(player, pageStart + rowIndex))}
        </ul>
      ) : (
        <DataTable caption="Entries" className={styles.entriesTable} onKeyDownCapture={handleTableArrowNavigation}>
          <thead>
            <tr>
              <SortableHeader column="usbc" sortConfig={sortConfig} onSort={toggleSort}>USBC</SortableHeader>
              <SortableHeader column="name" sortConfig={sortConfig} onSort={toggleSort}>Bowler</SortableHeader>
              <SortableHeader column="division" sortConfig={sortConfig} onSort={toggleSort}>Division</SortableHeader>
              <SortableHeader column="lane" sortConfig={sortConfig} onSort={toggleSort} align="right">Lane</SortableHeader>
              <SortableHeader column="average" sortConfig={sortConfig} onSort={toggleSort} align="right">Avg</SortableHeader>
              {bracketPrograms.map((program) => (
                <SortableHeader key={`program-header-${program.key}`} column={`bracket:${program.key}`} sortConfig={sortConfig} onSort={toggleSort} align="right">
                  <abbr title={program.name} className={styles.programAbbr}>{abbreviateProgramName(program.name)}</abbr>
                </SortableHeader>
              ))}
              {enabledPots.map(pot => (
                <th key={`sidepot-header-${pot.key}`} scope="col" data-align="center">{pot.name}</th>
              ))}
              <SortableHeader column="cost" sortConfig={sortConfig} onSort={toggleSort} align="right">Total</SortableHeader>
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {paginatedPlayers.map((player, rowIndex) => {
              const status = getPaymentStatus(player);
              const playerName = `${player.firstName || ''} ${player.lastName || ''}`.trim();
              return (
                <OptimizedTableRow key={`${player.id}-${rowIndex}`}>
                  <OptimizedTableCell className={styles.codeCell}>{player.usbc || <span className={styles.emptyCell}>-</span>}</OptimizedTableCell>
                  <OptimizedTableCell className={styles.nameCell}>{playerName || <span className={styles.emptyCell}>Unnamed</span>}</OptimizedTableCell>
                  <OptimizedTableCell>
                    <select
                      className={styles.cellControl}
                      aria-label={`Division for ${playerName || 'bowler'}`}
                      value={normalizeDivision(player.division)}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'division', changeEvent.target.value)}
                    >
                      {divisionOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </OptimizedTableCell>
                  <OptimizedTableCell data-align="right">
                    <input
                      className={`${styles.cellControl} ${styles.cellNumber}`}
                      aria-label={`Lane for ${playerName || 'bowler'}`}
                      type="text"
                      inputMode="numeric"
                      size={3}
                      maxLength={3}
                      value={player.lane?.toString() || ''}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'lane', changeEvent.target.value)}
                    />
                  </OptimizedTableCell>
                  <OptimizedTableCell data-align="right">
                    <input
                      className={`${styles.cellControl} ${styles.cellNumber}`}
                      aria-label={`Average for ${playerName || 'bowler'}`}
                      type="text"
                      inputMode="numeric"
                      size={3}
                      maxLength={3}
                      value={player.average}
                      onChange={(changeEvent) => handleCellEdit(player.id, 'average', changeEvent.target.value)}
                    />
                  </OptimizedTableCell>
                  {bracketPrograms.map((program) => {
                    const isAllowed = isProgramAllowedForDivision(program.division, player.division);
                    const visibleValue = isAllowed ? (player.bracketEntries?.[program.key] || 0) : 0;
                    return (
                      <OptimizedTableCell key={`program-cell-${player.id}-${program.key}`} data-align="right">
                        <input
                          className={`${styles.cellControl} ${styles.cellNumber}`}
                          aria-label={`${program.name} entries for ${playerName || 'bowler'}`}
                          type="text"
                          inputMode="numeric"
                          size={3}
                          maxLength={3}
                          value={visibleValue}
                          onChange={(changeEvent) => handleBracketEntryEdit(player.id, program.key, changeEvent.target.value)}
                          disabled={!isAllowed}
                        />
                      </OptimizedTableCell>
                    );
                  })}
                  {enabledPots.map(pot => {
                    const checked = Boolean(player.sidePotEntries?.[pot.key]);
                    return (
                      <OptimizedTableCell key={`sidepot-cell-${player.id}-${pot.key}`} data-align="center">
                        <input
                          type="checkbox"
                          className={styles.cellCheckbox}
                          checked={checked}
                          onChange={() => handleSidePotToggle(player.id, pot.key, checked)}
                          aria-label={`${pot.name} for ${playerName || 'bowler'}`}
                        />
                      </OptimizedTableCell>
                    );
                  })}
                  <OptimizedTableCell data-align="right" data-emphasis="true">${player.totalCost.toFixed(2)}</OptimizedTableCell>
                  <OptimizedTableCell>
                    {!status.canToggle ? (
                      <span title={status.label === 'Set fee' ? 'Set a bracket entry fee in tournament settings to calculate player cost.' : undefined}>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.statusToggle}
                        onClick={() => handleCellEdit(player.id, 'amountPaid', (status.isPaid ? 0 : player.totalCost).toString())}
                        aria-label={`Mark ${playerName || 'bowler'} as ${status.isPaid ? 'unpaid' : 'paid'}`}
                      >
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </button>
                    )}
                  </OptimizedTableCell>
                  <OptimizedTableCell data-align="right">
                    <Menu triggerLabel={`More actions for ${playerName || 'bowler'}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                      <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => onDeletePlayer(player.id)} aria-label={`Delete ${playerName}`.trim()}>
                        Delete entry
                      </MenuItem>
                    </Menu>
                  </OptimizedTableCell>
                </OptimizedTableRow>
              );
            })}
          </tbody>
        </DataTable>
      )}
      <Pagination
        page={currentPage}
        pageCount={totalPages}
        onPageChange={setCurrentPage}
        summary={`Showing ${firstShown}-${lastShown} of ${sortedPlayers.length} entries`}
        pageSizeControl={(
          <SelectField label="Rows per page" hideLabel value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </SelectField>
        )}
      />
    </>
  );
});

PlayersTable.displayName = 'PlayersTable';

export default PlayersTable;
