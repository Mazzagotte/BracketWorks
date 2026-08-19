import { Player } from '../../lib/types'
import type { RowSaveState } from '../types'
import { calculateTotalScratch, calculateTotalWithHandicap, calculateDisplayTotal, getGameTotal } from '../utils/scoreUtils'
import { Pagination } from '../../components/Performance'
import styles from '../scores.module.css'
import buttonStyles from '../../styles/buttons.module.css'

interface MobileScoreCardListProps {
  paginatedItems: Player[]
  expandedPlayers: Record<number, boolean>
  rowSaveState: Record<number, RowSaveState>
  isScoresLocked: boolean
  currentPage: number
  totalPages: number
  onToggleExpand: (playerId: number) => void
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onFocusNext: (playerId: number, field: string) => void
  onSaveAll: () => void
  onPageChange: (page: number) => void
}

/**
 * Mobile score card list with expand-to-edit per-player cards.
 * Rendering only — no state or API calls.
 */
export function MobileScoreCardList({
  paginatedItems,
  expandedPlayers,
  rowSaveState,
  isScoresLocked,
  currentPage,
  totalPages,
  onToggleExpand,
  onUpdateScore,
  onFocusNext,
  onSaveAll,
  onPageChange,
}: MobileScoreCardListProps) {
  return (
    <>
      <div className={styles.mobileScoreList}>
        {paginatedItems.map(player => (
          <MobileScoreCard
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
      </div>

      {totalPages > 1 && (
        <div className={styles.mobilePaginationWrap}>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </>
  )
}

interface MobileScoreCardProps {
  player: Player
  isExpanded: boolean
  saveState: RowSaveState
  isScoresLocked: boolean
  onToggleExpand: () => void
  onUpdateScore: (playerId: number, field: string, value: number | undefined) => void
  onFocusNext: (playerId: number, field: string) => void
  onSaveAll: () => void
}

function MobileScoreCard({
  player,
  isExpanded,
  saveState,
  isScoresLocked,
  onToggleExpand,
  onUpdateScore,
  onFocusNext,
  onSaveAll,
}: MobileScoreCardProps) {
  const hasFailed = saveState === 'failed'
  const saveLabel =
    saveState === 'saving' ? 'Saving...' :
    saveState === 'saved' ? 'Saved' :
    saveState === 'failed' ? 'Failed' : ''
  const pilotClass =
    saveState === 'saving' ? styles.mobileSaveStateSaving :
    saveState === 'saved' ? styles.mobileSaveStateSaved :
    saveState === 'failed' ? styles.mobileSaveStateFailed :
    styles.mobileSaveStateIdle

  return (
    <div className={styles.mobileScoreCard}>
      <div
        className={styles.mobileScoreCardHeader}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={onToggleExpand}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand() }
        }}
      >
        <div className={styles.mobileScoreIdentity}>
          <div className={styles.mobileScoreName}>{player.firstName} {player.lastName}</div>
          <div className={styles.mobileScoreMeta}>
            {player.lane ? `Lane ${player.lane} | ` : ''}Avg: {player.average} | HDCP: {player.handicap}
          </div>
        </div>
        <div className={styles.mobileScoreHeaderRight}>
          {saveLabel && <span className={`${styles.mobileSaveStatePill} ${pilotClass}`}>{saveLabel}</span>}
          <span className={styles.mobileScoreTotal}>{calculateDisplayTotal(player)}</span>
          <span className={styles.mobileExpandGlyph}>{isExpanded ? '^' : 'v'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.mobileScoreCardBody}>
          <div className={styles.mobileContextChips}>
            <span className={styles.mobileContextChip}>Scratch: {calculateTotalScratch(player)}</span>
            <span className={styles.mobileContextChip}>Total: {calculateTotalWithHandicap(player)}</span>
          </div>

          <div className={styles.mobileGameInputGrid}>
            {([1, 2, 3] as const).map(g => {
              const field = `game${g}_scratch` as 'game1_scratch' | 'game2_scratch' | 'game3_scratch'
              const scratch = player.scores?.[field] as number | undefined
              return (
                <div key={g} className={styles.mobileGameInputField}>
                  <span>G{g}</span>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    inputMode="numeric"
                    disabled={isScoresLocked}
                    placeholder=""
                    data-mobile-player={player.id}
                    data-mobile-field={field}
                    className={styles.mobileScoreInput}
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

          {hasFailed && (
            <button className={styles.mobileRetryBtn} onClick={onSaveAll}>
              Retry Save
            </button>
          )}
        </div>
      )}
    </div>
  )
}
