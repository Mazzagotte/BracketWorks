import { ChevronDown, ChevronUp } from 'lucide-react'
import { Badge, Button, ICON_SIZE, Pagination } from '@bracketworks/ui'

import { Player } from '../../lib/types'
import type { RowSaveState } from '../types'
import { calculateTotalScratch, calculateTotalWithHandicap, calculateDisplayTotal, getGameTotal } from '../utils/scoreUtils'
import styles from './ScoreTable.module.css'

interface MobileScoreCardListProps {
  paginatedItems: Player[]
  expandedPlayers: Record<number, boolean>
  rowSaveState: Record<number, RowSaveState>
  isScoresLocked: boolean
  currentPage: number
  totalPages: number
  totalItems: number
  onToggleExpand: (playerId: number) => void
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onFocusNext: (playerId: number, field: string) => void
  onSaveAll: () => void
  onPageChange: (page: number) => void
}

const PAGE_SIZE = 50

/**
 * Phone score list: divider rows that expand to edit three games.
 * Rendering only: no state or API calls. Sits inside a flush Card.
 */
export function MobileScoreCardList({
  paginatedItems,
  expandedPlayers,
  rowSaveState,
  isScoresLocked,
  currentPage,
  totalPages,
  totalItems,
  onToggleExpand,
  onUpdateScore,
  onFocusNext,
  onSaveAll,
  onPageChange,
}: MobileScoreCardListProps) {
  const firstShown = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, totalItems)
  return (
    <>
      <ul className={styles.mobileList}>
        {paginatedItems.map(player => (
          <MobileScoreRow
            key={player.id}
            player={player}
            isExpanded={!!expandedPlayers[player.id]}
            saveState={rowSaveState[player.id] || 'idle'}
            isScoresLocked={isScoresLocked}
            onToggleExpand={() => onToggleExpand(player.id)}
            onUpdateScore={onUpdateScore}
            onFocusNext={onFocusNext}
            onSaveAll={onSaveAll}
          />
        ))}
      </ul>

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

interface MobileScoreRowProps {
  player: Player
  isExpanded: boolean
  saveState: RowSaveState
  isScoresLocked: boolean
  onToggleExpand: () => void
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onFocusNext: (playerId: number, field: string) => void
  onSaveAll: () => void
}

function MobileScoreRow({
  player,
  isExpanded,
  saveState,
  isScoresLocked,
  onToggleExpand,
  onUpdateScore,
  onFocusNext,
  onSaveAll,
}: MobileScoreRowProps) {
  const playerName = `${player.firstName} ${player.lastName}`.trim()
  const detailsId = `mobile-score-details-${player.id}`

  return (
    <li className={styles.mobileRow}>
      <button
        type="button"
        className={styles.mobileRowHeader}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={onToggleExpand}
      >
        <span className={styles.mobileIdentity}>
          <span className={styles.mobileName}>{playerName}</span>
          <span className={styles.mobileMeta}>
            {[player.lane ? `Lane ${player.lane}` : null, `Avg ${player.average}`, `Hdcp ${player.handicap}`].filter(Boolean).join(' · ')}
          </span>
        </span>
        {saveState === 'saving' ? <span className={styles.saving}>Saving...</span> : null}
        {saveState === 'failed' ? <Badge tone="danger">Save failed</Badge> : null}
        <span className={styles.mobileTotal}>{calculateDisplayTotal(player)}</span>
        {isExpanded
          ? <ChevronUp size={ICON_SIZE.md} aria-hidden="true" />
          : <ChevronDown size={ICON_SIZE.md} aria-hidden="true" />}
      </button>

      {isExpanded ? (
        <div id={detailsId} className={styles.mobileDetails}>
          <div className={styles.mobileGames}>
            {([1, 2, 3] as const).map(g => {
              const field = `game${g}_scratch` as 'game1_scratch' | 'game2_scratch' | 'game3_scratch'
              const scratch = player.scores?.[field] as number | undefined
              const inputId = `mobile-score-${player.id}-${g}`
              return (
                <div key={g} className={styles.mobileGame}>
                  <label htmlFor={inputId} className={styles.mobileGameLabel}>Game {g}</label>
                  <input
                    id={inputId}
                    type="number"
                    min="0"
                    max="300"
                    inputMode="numeric"
                    enterKeyHint="next"
                    disabled={isScoresLocked}
                    data-mobile-player={player.id}
                    data-mobile-field={field}
                    className={styles.mobileGameInput}
                    value={scratch ?? ''}
                    onChange={e => onUpdateScore(player.id, field, parseInt(e.target.value) || 0)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); onFocusNext(player.id, field) }
                    }}
                  />
                  <span className={styles.mobileGameTotal}>{getGameTotal(scratch, player.handicap)}</span>
                </div>
              )
            })}
          </div>

          <p className={styles.mobileTotals}>
            Scratch {calculateTotalScratch(player)} · Total {calculateTotalWithHandicap(player)}
          </p>

          {saveState === 'failed' ? (
            <Button size="sm" variant="secondary" onClick={onSaveAll}>Retry save</Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
