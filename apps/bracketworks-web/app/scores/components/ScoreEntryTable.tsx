import { Player, Squad } from '../../lib/types'
import { SortableHeader } from '../../components/SortableHeader'
import { Pagination } from '../../components/Performance'
import type { SortConfig } from '../types'
import type { RowSaveState } from '../types'
import { calculateTotalScratch, calculateDisplayTotal, getGameTotal, validateScore, getScoreInputClass, getPlayerScoreStatus } from '../utils/scoreUtils'
import styles from '../scores.module.css'
import tableStyles from '../../styles/tables.module.css'
import cardStyles from '../../styles/cards.module.css'
import { handleTableArrowNavigation } from '../../lib/tableKeyboard'

interface ScoreEntryTableProps {
  paginatedItems: Player[]
  filteredPlayers: Player[]
  selectedSquad: Squad | null
  sortConfig: SortConfig
  onSort: (column: string) => void
  rowSaveState: Record<number, RowSaveState>
  isScoresLocked: boolean
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onKeyDown: (e: React.KeyboardEvent, playerId: number, field: string) => void
  completedScoreCount: number
  scoreCompletionPercent: number
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems: number
}

/**
 * Desktop scores table: sticky header rows, sortable columns, inline inputs.
 * Rendering only – no state or API calls.
 */
export function ScoreEntryTable({
  paginatedItems,
  filteredPlayers,
  selectedSquad,
  sortConfig,
  onSort,
  rowSaveState,
  isScoresLocked,
  onUpdateScore,
  onKeyDown,
  completedScoreCount,
  scoreCompletionPercent,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
}: ScoreEntryTableProps) {
  return (
    <div className={`${cardStyles.card} ${styles.tableCard} ${isScoresLocked ? styles.scoresTableLocked : ''} ${styles.desktopWidthLockedCard}`}>
      <div className="entries-container">
        <table
          className={`${tableStyles.table} entries-table`}
          aria-label="Player Scores"
          onKeyDownCapture={handleTableArrowNavigation}
        >
          <thead>
            {selectedSquad && (
              <tr>
                <td colSpan={12} className="squad-banner">
                  <div className={styles.scoresTableBanner}>
                    <div>
                      <strong>Scores</strong>
                      <span>{selectedSquad.date} · {selectedSquad.time} Squad</span>
                    </div>
                    <div className={styles.scoresTableProgress}>
                      <span>{completedScoreCount} of {paginatedItems.length + (currentPage - 1) * 50} scored</span>
                      <progress value={scoreCompletionPercent} max="100" aria-label={`${scoreCompletionPercent}% of players fully scored`} />
                      <small>{scoreCompletionPercent}% complete</small>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            <tr className={`entries-header-row ${styles.scoresGroupHeaderRow}`}>
              <SortableHeader column="firstName" sortConfig={sortConfig} onSort={onSort} rowSpan={2} className={styles.stickyBowlerHeader}>Bowler</SortableHeader>
              <SortableHeader column="lane" sortConfig={sortConfig} onSort={onSort} rowSpan={2} className={styles.stickyLaneHeader}>Lane</SortableHeader>
              <SortableHeader column="average" sortConfig={sortConfig} onSort={onSort} rowSpan={2} className={styles.stickyAverageHeader}>Avg</SortableHeader>
              <th colSpan={2} scope="colgroup" className={`entries-header-cell ${styles.gameGroupHeader}`}>Game 1</th>
              <th colSpan={2} scope="colgroup" className={`entries-header-cell ${styles.gameGroupHeader}`}>Game 2</th>
              <th colSpan={2} scope="colgroup" className={`entries-header-cell ${styles.gameGroupHeader}`}>Game 3</th>
              <SortableHeader column="totalScratch" sortConfig={sortConfig} onSort={onSort} rowSpan={2} className={styles.totalColumnHeader}>Scratch<br/>Total</SortableHeader>
              <SortableHeader column="totalWithHandicap" sortConfig={sortConfig} onSort={onSort} rowSpan={2} className={styles.finalColumnHeader}>Final<br/>Total</SortableHeader>
              <th rowSpan={2} scope="col" className={`entries-header-cell ${styles.statusColumnHeader}`}>Status</th>
            </tr>
            <tr className={`entries-header-row ${styles.scoresSubHeaderRow}`}>
              <SortableHeader column="game1_scratch" sortConfig={sortConfig} onSort={onSort}>Scratch</SortableHeader>
              <SortableHeader column="game1_total" sortConfig={sortConfig} onSort={onSort}>Total</SortableHeader>
              <SortableHeader column="game2_scratch" sortConfig={sortConfig} onSort={onSort}>Scratch</SortableHeader>
              <SortableHeader column="game2_total" sortConfig={sortConfig} onSort={onSort}>Total</SortableHeader>
              <SortableHeader column="game3_scratch" sortConfig={sortConfig} onSort={onSort}>Scratch</SortableHeader>
              <SortableHeader column="game3_total" sortConfig={sortConfig} onSort={onSort}>Total</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((player, index) => (
              <ScoreEntryRow
                key={player.id}
                player={player}
                index={index}
                saveState={rowSaveState[player.id] || 'idle'}
                isScoresLocked={isScoresLocked}
                onUpdateScore={onUpdateScore}
                onKeyDown={onKeyDown}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.paginationWrapper}>
          <div className={styles.paginationInfo}>
            <span>
              Showing {((currentPage - 1) * 50) + 1} to{' '}
              {Math.min(currentPage * 50, filteredPlayers.length)} of{' '}
              {totalItems} players
            </span>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            itemsPerPage={50}
            totalItems={totalItems}
            showItemCount={false}
            showPageSize={false}
          />
        </div>
      )}
    </div>
  )
}

interface ScoreEntryRowProps {
  player: Player
  index: number
  saveState: RowSaveState
  isScoresLocked: boolean
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onKeyDown: (e: React.KeyboardEvent, playerId: number, field: string) => void
}

function ScoreEntryRow({ player, index, saveState, isScoresLocked, onUpdateScore, onKeyDown }: ScoreEntryRowProps) {
  const scoreStatus = getPlayerScoreStatus(player)

  return (
    <tr className={`scores-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
      <td className="scores-cell name">{player.firstName} {player.lastName}</td>
      <td className={`scores-cell lane ${!player.lane ? 'lane-empty' : ''}`}>{player.lane || ''}</td>
      <td className="scores-cell average">{player.average}</td>

      {([1, 2, 3] as const).map(g => {
        const field = `game${g}_scratch` as 'game1_scratch' | 'game2_scratch' | 'game3_scratch'
        const scratch = player.scores?.[field]
        return [
          <td key={`${g}-scratch`} className={`scores-cell scores-cell--game ${styles.editableScoreCell}`}>
            <div className="pos-relative inline-block">
              <input
                type="number"
                min={0}
                max={300}
                placeholder="—"
                data-player={player.id}
                data-field={field}
                value={scratch ?? ''}
                onChange={e => onUpdateScore(player.id, field, e.target.value ? Number(e.target.value) : undefined)}
                onKeyDown={e => onKeyDown(e, player.id, field)}
                disabled={isScoresLocked}
                className={getScoreInputClass(scratch)}
                onFocus={e => e.target.select()}
                title={!validateScore(scratch).isValid ? validateScore(scratch).message : ''}
              />
            </div>
          </td>,
          <td key={`${g}-total`} className={`scores-cell ${styles.calculatedScoreCell}`}>
            {scratch == null ? '—' : getGameTotal(scratch, player.handicap)}
          </td>,
        ]
      })}

      <td className="scores-cell total-scratch">{calculateTotalScratch(player) || ''}</td>
      <td className="scores-cell total-final">{calculateDisplayTotal(player)}</td>

      <td className={`scores-cell ${styles.scoreStatusCell}`}>
        {saveState !== 'saving' && saveState !== 'failed' && (
          <span className={`${styles.scoreStatusBadge} ${styles[`scoreStatusBadge_${scoreStatus.tone}`]}`}>
            {scoreStatus.label}
          </span>
        )}
        {(saveState === 'saving' || saveState === 'failed') && (
          <span className={`${styles.rowSaveState} ${styles[`rowSaveState_${saveState}`]}`}>
            {saveState === 'saving' ? 'Saving…' : 'Save Failed'}
          </span>
        )}
      </td>
    </tr>
  )
}
