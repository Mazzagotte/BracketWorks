import { Badge, DataTable, Pagination, SortableHeader } from '@bracketworks/ui'

import { Player } from '../../lib/types'
import type { SortConfig } from '../types'
import type { RowSaveState } from '../types'
import { calculateTotalScratch, calculateDisplayTotal, validateScore, getPlayerScoreStatus } from '../utils/scoreUtils'
import { handleTableArrowNavigation } from '../../lib/tableKeyboard'
import styles from './ScoreTable.module.css'

const PAGE_SIZE = 50

const STATUS_TONE = {
  complete: 'success',
  progress: 'info',
  pending: 'neutral',
} as const

interface ScoreEntryTableProps {
  paginatedItems: Player[]
  filteredPlayers: Player[]
  sortConfig: SortConfig
  onSort: (column: string) => void
  rowSaveState: Record<number, RowSaveState>
  isScoresLocked: boolean
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onKeyDown: (e: React.KeyboardEvent, playerId: number, field: string) => void
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems: number
}

/**
 * Desktop scores table: grouped game columns, sortable headers, inline score inputs.
 * Rendering only: no state or API calls. Sits inside a flush Card.
 */
export function ScoreEntryTable({
  paginatedItems,
  filteredPlayers,
  sortConfig,
  onSort,
  rowSaveState,
  isScoresLocked,
  onUpdateScore,
  onKeyDown,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
}: ScoreEntryTableProps) {
  const firstShown = filteredPlayers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filteredPlayers.length)

  return (
    <>
      <DataTable caption="Player scores" className={styles.scoreTable} onKeyDownCapture={handleTableArrowNavigation}>
        <thead>
          <tr>
            <SortableHeader column="firstName" sortConfig={sortConfig} onSort={onSort} rowSpan={2}>Bowler</SortableHeader>
            <SortableHeader column="lane" sortConfig={sortConfig} onSort={onSort} rowSpan={2} align="right">Lane</SortableHeader>
            <SortableHeader column="average" sortConfig={sortConfig} onSort={onSort} rowSpan={2} align="right">Avg</SortableHeader>
            {[1, 2, 3].map(g => (
              <th key={g} colSpan={2} scope="colgroup" data-align="center" className={styles.groupHeader}>Game {g}</th>
            ))}
            <SortableHeader column="totalScratch" sortConfig={sortConfig} onSort={onSort} rowSpan={2} align="right">Scratch total</SortableHeader>
            <SortableHeader column="totalWithHandicap" sortConfig={sortConfig} onSort={onSort} rowSpan={2} align="right">Final total</SortableHeader>
            <th rowSpan={2} scope="col">Status</th>
          </tr>
          <tr>
            {([1, 2, 3] as const).flatMap(g => [
              <SortableHeader key={`${g}-scratch`} column={`game${g}_scratch`} sortConfig={sortConfig} onSort={onSort} align="right">Scratch</SortableHeader>,
              <SortableHeader key={`${g}-total`} column={`game${g}_total`} sortConfig={sortConfig} onSort={onSort} align="right">Total</SortableHeader>,
            ])}
          </tr>
        </thead>
        <tbody>
          {paginatedItems.map(player => (
            <ScoreEntryRow
              key={player.id}
              player={player}
              saveState={rowSaveState[player.id] || 'idle'}
              isScoresLocked={isScoresLocked}
              onUpdateScore={onUpdateScore}
              onKeyDown={onKeyDown}
            />
          ))}
        </tbody>
      </DataTable>

      {totalPages > 1 ? (
        <Pagination
          page={currentPage}
          pageCount={totalPages}
          onPageChange={onPageChange}
          summary={`Showing ${firstShown}-${lastShown} of ${totalItems} players`}
        />
      ) : null}
    </>
  )
}

interface ScoreEntryRowProps {
  player: Player
  saveState: RowSaveState
  isScoresLocked: boolean
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onKeyDown: (e: React.KeyboardEvent, playerId: number, field: string) => void
}

function ScoreEntryRow({ player, saveState, isScoresLocked, onUpdateScore, onKeyDown }: ScoreEntryRowProps) {
  const scoreStatus = getPlayerScoreStatus(player)
  const playerName = `${player.firstName} ${player.lastName}`.trim()

  return (
    <tr>
      <td className={styles.nameCell}>{playerName}</td>
      <td data-align="right" data-tone={player.lane ? undefined : 'secondary'}>{player.lane || '-'}</td>
      <td data-align="right">{player.average}</td>

      {([1, 2, 3] as const).flatMap(g => {
        const field = `game${g}_scratch` as 'game1_scratch' | 'game2_scratch' | 'game3_scratch'
        const scratch = player.scores?.[field]
        const validation = validateScore(scratch)
        return [
          <td key={`${g}-scratch`} data-align="right">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={300}
              data-player={player.id}
              data-field={field}
              value={scratch ?? ''}
              onChange={e => onUpdateScore(player.id, field, e.target.value ? Number(e.target.value) : undefined)}
              onKeyDown={e => onKeyDown(e, player.id, field)}
              disabled={isScoresLocked}
              className={styles.scoreInput}
              aria-label={`Game ${g} scratch for ${playerName}`}
              aria-invalid={validation.isValid ? undefined : true}
              title={validation.isValid ? undefined : validation.message}
              onFocus={e => e.target.select()}
            />
          </td>,
          <td key={`${g}-total`} data-align="right" data-tone="secondary">
            {scratch == null ? '-' : scratch + (player.handicap ?? 0)}
          </td>,
        ]
      })}

      <td data-align="right">{calculateTotalScratch(player) || '-'}</td>
      <td data-align="right" data-emphasis="true">{calculateDisplayTotal(player)}</td>

      <td>
        {saveState === 'saving' ? (
          <span className={styles.saving} role="status">Saving...</span>
        ) : saveState === 'failed' ? (
          <Badge tone="danger">Save failed</Badge>
        ) : (
          <Badge tone={STATUS_TONE[scoreStatus.tone]}>{scoreStatus.label}</Badge>
        )}
      </td>
    </tr>
  )
}
