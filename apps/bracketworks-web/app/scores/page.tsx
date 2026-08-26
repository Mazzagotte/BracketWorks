'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Player } from '../lib/types'
import Link from 'next/link'
import { RefreshCcw, Search, UserRound, Zap } from 'lucide-react'

import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { API, apiFetch, getMemoryAccessToken } from '../lib/api'
import EnhancedButton from '../components/EnhancedButton'
import { MobileLayout } from '../../components/MobileLayout'
import { Spinner } from '../components/LoadingComponents'
import styles from './scores.module.css'
import cardStyles from '../styles/cards.module.css'
import buttonStyles from '../styles/buttons.module.css'
import formStyles from '../styles/forms.module.css'
import shellStyles from '../styles/page-shell.module.css'
import { useToast } from '../components/Toast'
import { useAutoSave } from '../components/DataManagement'
import NoTournamentState from '../components/NoTournamentState'
import { QuickActions, SearchPanel } from '../components/primitives'
import { getSelectedTournamentId, getSelectedSquadId } from '../lib/selection-session'
import { MOBILE_VIEWPORT_QUERY } from '../lib/responsive'
import { useMediaQuery } from '../hooks/useMediaQuery'
import ExplainScoresModal from './ExplainScoresModal'
import {
  buildSafeFileName,
  buildScoresExcelBuffer,
  hasMissingScore,
  parseScoresExcelFile,
} from './utils/scoreUtils'
import { buildScoresPdfHtml } from './utils/scoresPdfExport'
import { printHtmlDocument } from '../lib/printExport'
import { useScoreData } from './hooks/useScoreData'
import { useScoreFilters } from './hooks/useScoreFilters'
import { useScoreEditing } from './hooks/useScoreEditing'
import { useScoreLock } from './hooks/useScoreLock'
import { useOfflineScoreSync } from './hooks/useOfflineScoreSync'
import { CalcPayoutsModal, BracketMismatchModal } from './components/ScoreConfirmModals'
import { ScoreEntryTable } from './components/ScoreEntryTable'
import { MobileScoreCardList } from './components/MobileScoreCard'

export default function ScoresPage() {
  const { isUserAuthenticated, isAuthInitialized, authToken, currentUser } = useAuth()
  const storedAuthToken = getMemoryAccessToken()
  const sessionToken = authToken || storedAuthToken
  const hasStoredAuth = Boolean(sessionToken)

  const [isScoresGuideOpen, setIsScoresGuideOpen] = useState(false)
  const isMobile = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [mobileExpandedPlayers, setMobileExpandedPlayers] = useState<Record<number, boolean>>({})
  const [showCalcPayoutsConfirm, setShowCalcPayoutsConfirm] = useState(false)
  const [showBracketMismatchWarning, setShowBracketMismatchWarning] = useState(false)
  const [missingScoreNames, setMissingScoreNames] = useState<string[]>([])
  const importFileRef = useRef<HTMLInputElement | null>(null)

  // ── Core data ──────────────────────────────────────────────────────────────
  const { players, setPlayers, tournament, selectedSquad, selectedSquadRef, playersRef, isLoading } =
    useScoreData(sessionToken)

  // ── Toast + offline sync ───────────────────────────────────────────────────
  const { addToast } = useToast()
  const { isOnline, pendingSaves, setPendingSaves, processPendingSaves } = useOfflineScoreSync({ addToast })

  // ── Lock state ─────────────────────────────────────────────────────────────
  const { isScoresLocked, unlockScoresTable, unlockPayoutsAndGo } =
    useScoreLock(tournament, selectedSquad, addToast)

  // ── Filters / pagination ───────────────────────────────────────────────────
  const {
    sortConfig,
    handleSort,
    filteredPlayers,
    searchFirstName,
    setSearchFirstName,
    searchLastName,
    setSearchLastName,
    paginationHook,
  } = useScoreFilters(players, isMobile)

  // ── Editing + saving ───────────────────────────────────────────────────────
  const {
    rowSaveState,
    lastEdit,
    clearGameConfirm,
    setClearGameConfirm,
    rowStateCounts,
    updateScore,
    saveAllVisibleScores,
    undoLastEdit,
    clearGameScores,
    requestClearGame,
    handleKeyDown,
    focusNextMobileInput,
  } = useScoreEditing({
    players,
    setPlayers,
    playersRef,
    selectedSquadRef,
    tournament,
    isScoresLocked,
    isOnline,
    isMobile,
    sessionToken,
    addToast,
    pendingSaves,
    setPendingSaves,
    paginatedItems: paginationHook.paginatedItems,
  })

  // ── Auto-save backup to localStorage ──────────────────────────────────────
  const autoSaveData = useMemo(
    () => ({ scores: players.map(p => p.scores).filter(Boolean) }),
    [players],
  )
  useAutoSave({
    data: autoSaveData,
    saveFunction: async (data) => {
      if (typeof window !== 'undefined') localStorage.setItem('scores-backup', JSON.stringify(data))
    },
    delay: 2000,
  })

  // ── Derived counts ─────────────────────────────────────────────────────────
  const completedScoreCount = useMemo(() => players.filter(p => !hasMissingScore(p)).length, [players])
  const scoreCompletionPercent = players.length > 0 ? Math.round((completedScoreCount / players.length) * 100) : 0
  const showInitialScoresLoad = isLoading && players.length === 0

  // ── Pre-payouts check: bracket mismatch + missing scores ───────────────────
  const markScoresComplete = useCallback(async () => {
    const tournamentId = tournament?.id
    const squadId = selectedSquad?.id ?? null
    if (tournamentId) {
      try {
        const url = squadId
          ? API(`/api/v1/brackets/status/${tournamentId}?squad_id=${squadId}`)
          : API(`/api/v1/brackets/status/${tournamentId}`)
        const resp = await apiFetch(url, { headers: { Authorization: `Bearer ${sessionToken}` } })
        if (resp.ok) {
          const statusData = await resp.json()
          if (statusData.entries_mismatch) { setShowBracketMismatchWarning(true); return }
        }
      } catch { /* non-blocking */ }
    }
    const missing = players.filter(hasMissingScore).map(p => `${p.firstName} ${p.lastName}`.trim())
    setMissingScoreNames(missing)
    setShowCalcPayoutsConfirm(true)
  }, [players, tournament, selectedSquad, sessionToken])

  // ── Export handlers ────────────────────────────────────────────────────────
  const handleExportScoresToExcel = useCallback(async () => {
    if (players.length === 0) { addToast({ message: 'No scores to export.', type: 'warning', duration: 3000 }); return }
    setIsExporting(true)
    try {
      const { buffer, fileName, rowCount } = await buildScoresExcelBuffer(filteredPlayers, tournament, selectedSquad)
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
      addToast({ message: `Exported ${rowCount} score row${rowCount !== 1 ? 's' : ''}.`, type: 'success', duration: 3000 })
    } catch (err) {
      addToast({ message: `Failed to export Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error', duration: 5000 })
    } finally { setIsExporting(false) }
  }, [players.length, filteredPlayers, tournament, selectedSquad, addToast])

  const handleExportScoresToPdf = useCallback(() => {
    if (filteredPlayers.length === 0) { addToast({ message: 'No scores to export.', type: 'warning', duration: 3000 }); return }
    setIsExportingPdf(true)
    try {
      const squadLabel = selectedSquad ? [selectedSquad.name, selectedSquad.date, selectedSquad.time].filter(Boolean).join(' | ') : 'All Squads'
      const html = buildScoresPdfHtml({ players: filteredPlayers, tournamentName: tournament?.name || 'Tournament', squadLabel, location: tournament?.location || '', generatedAt: new Date().toLocaleString(), logoUrl: `${window.location.origin}/logo_no_text.svg`, scoresLocked: isScoresLocked })
      printHtmlDocument({ html, documentTitle: buildSafeFileName(tournament?.name, selectedSquad, 'scores').replace(/\.xlsx$/, '') })
      addToast({ message: `Prepared ${filteredPlayers.length} score rows for PDF export.`, type: 'success', duration: 3000 })
    } catch (err) {
      addToast({ message: `Failed to export PDF: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error', duration: 5000 })
    } finally { setIsExportingPdf(false) }
  }, [addToast, isScoresLocked, filteredPlayers, selectedSquad, tournament])

  // ── Import handler ─────────────────────────────────────────────────────────
  const handleImportScoresFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isScoresLocked) { addToast({ message: 'Scores are locked. Unlock scores to import changes.', type: 'warning', duration: 3000 }); e.target.value = ''; return }
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const token = sessionToken
      const tournamentId = getSelectedTournamentId()
      const squad = selectedSquadRef.current
      if (!token || !tournamentId || !squad) { addToast({ message: 'Select a tournament and squad before importing scores.', type: 'error', duration: 4000 }); return }
      const parsedRows = await parseScoresExcelFile(file)
      if (parsedRows.length === 0) { addToast({ message: 'No score rows found in file.', type: 'warning', duration: 3000 }); return }
      const byId = new Map(playersRef.current.map(p => [p.id, p]))
      const byName = new Map(playersRef.current.map(p => [`${(p.firstName || '').trim().toLowerCase()}|${(p.lastName || '').trim().toLowerCase()}`, p]))
      const matched: Array<{ player: Player; scores: { game1_scratch?: number; game2_scratch?: number; game3_scratch?: number } }> = []
      let skipped = 0
      parsedRows.forEach(row => {
        const hasAny = row.game1_scratch !== undefined || row.game2_scratch !== undefined || row.game3_scratch !== undefined
        if (!hasAny) return
        let target: Player | undefined
        if (row.playerId) target = byId.get(row.playerId)
        if (!target) target = byName.get(`${row.firstName.trim().toLowerCase()}|${row.lastName.trim().toLowerCase()}`)
        if (!target) { skipped += 1; return }
        matched.push({ player: target, scores: { game1_scratch: row.game1_scratch, game2_scratch: row.game2_scratch, game3_scratch: row.game3_scratch } })
      })
      if (matched.length === 0) { addToast({ message: 'No matching players found for imported score rows.', type: 'warning', duration: 4000 }); return }
      const scoreMap = new Map(matched.map(item => [item.player.id, item.scores]))
      setPlayers(prev => prev.map(player => {
        const imp = scoreMap.get(player.id)
        if (!imp) return player
        return { ...player, scores: { ...player.scores, game1_scratch: imp.game1_scratch, game1_with_handicap: imp.game1_scratch !== undefined ? imp.game1_scratch + (player.handicap || 0) : undefined, game2_scratch: imp.game2_scratch, game2_with_handicap: imp.game2_scratch !== undefined ? imp.game2_scratch + (player.handicap || 0) : undefined, game3_scratch: imp.game3_scratch, game3_with_handicap: imp.game3_scratch !== undefined ? imp.game3_scratch + (player.handicap || 0) : undefined } }
      }))
      const results = await Promise.allSettled(
        matched.map(item => apiFetch(API('/api/v1/scores/'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ player_id: item.player.id, tournament_id: parseInt(tournamentId, 10), squad_id: squad.id, game1_scratch: item.scores.game1_scratch, game2_scratch: item.scores.game2_scratch, game3_scratch: item.scores.game3_scratch }) }))
      )
      const persisted = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
      const failed = matched.length - persisted
      addToast({ message: `Imported ${persisted} player score${persisted !== 1 ? 's' : ''}.` + (failed > 0 ? ` ${failed} failed to save.` : '') + (skipped > 0 ? ` ${skipped} row${skipped !== 1 ? 's' : ''} skipped (no player match).` : ''), type: failed > 0 ? 'warning' : 'success', duration: 5000 })
    } catch (err) {
      addToast({ message: `Failed to import Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error', duration: 5000 })
    } finally { setIsImporting(false); e.target.value = '' }
  }, [addToast, isScoresLocked, playersRef, selectedSquadRef, sessionToken, setPlayers])

  // ── Dev/admin: randomize all scores ───────────────────────────────────────
  const handleRandomizeScores = useCallback(async () => {
    const token = sessionToken
    const tournamentId = getSelectedTournamentId()
    const squadId = selectedSquadRef.current?.id ?? getSelectedSquadId()
    const currentPlayers = playersRef.current
    if (!token || !tournamentId) { addToast({ message: 'Missing auth or tournament context.', type: 'error', duration: 4000 }); return }
    if (!squadId) { addToast({ message: 'Select a squad before randomizing scores.', type: 'warning', duration: 3500 }); return }
    const scoreMap: Record<number, { g1: number; g2: number; g3: number }> = {}
    currentPlayers.forEach(p => { scoreMap[p.id] = { g1: Math.floor(Math.random() * 121) + 130, g2: Math.floor(Math.random() * 121) + 130, g3: Math.floor(Math.random() * 121) + 130 } })
    setPlayers(prev => prev.map(player => { const s = scoreMap[player.id]; if (!s) return player; return { ...player, scores: { game1_scratch: s.g1, game1_with_handicap: s.g1 + (player.handicap || 0), game2_scratch: s.g2, game2_with_handicap: s.g2 + (player.handicap || 0), game3_scratch: s.g3, game3_with_handicap: s.g3 + (player.handicap || 0) } } }))
    const results = await Promise.allSettled(currentPlayers.map(player => { const s = scoreMap[player.id]; if (!s) return Promise.resolve(new Response(null, { status: 204 })); return apiFetch(API('/api/v1/scores/'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ player_id: player.id, tournament_id: parseInt(tournamentId, 10), squad_id: squadId, game1_scratch: s.g1, game2_scratch: s.g2, game3_scratch: s.g3 }) }) }))
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
    const failed = currentPlayers.length - successful
    addToast({ message: failed > 0 && successful === 0 ? 'Randomize failed to save to database.' : failed > 0 ? `Randomized ${successful} players. ${failed} failed to save.` : `Randomized and saved ${successful} players.`, type: failed > 0 && successful === 0 ? 'error' : failed > 0 ? 'warning' : 'success', duration: failed > 0 && successful === 0 ? 4500 : 3500 })
  }, [sessionToken, addToast, playersRef, selectedSquadRef, setPlayers])

  // ── Quick actions bar ──────────────────────────────────────────────────────
  const scoresQuickActions = useMemo(() => (
    <QuickActions
      left={(
        <>
          <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={() => setIsScoresGuideOpen(true)}>Scores Guide</button>
          <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={handleExportScoresToExcel} disabled={isExporting || players.length === 0}>{isExporting ? 'Exporting...' : 'Export to Excel'}</button>
          <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={handleExportScoresToPdf} disabled={isExportingPdf || players.length === 0}>{isExportingPdf ? 'Preparing...' : 'Export to PDF'}</button>
          <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={() => importFileRef.current?.click()} disabled={isImporting || players.length === 0 || isScoresLocked}>{isImporting ? 'Importing...' : 'Import from Excel'}</button>
          {players.length > 0 && !isScoresLocked && <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={() => { void markScoresComplete() }}>Calculate Payouts</button>}
          {players.length > 0 && isScoresLocked && <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={() => { void unlockScoresTable() }}>Unlock Scores</button>}
        </>
      )}
      right={(
        <>
          {pendingSaves.length > 0 && (
            <EnhancedButton onClick={async () => { await processPendingSaves(); addToast({ message: 'Sync completed!', type: 'success', duration: 3000 }) }} variant="primary" size="sm" className={`${cardStyles.quickActionControl} ${buttonStyles.quickAction}`}>
              Sync Offline Scores ({pendingSaves.length})
            </EnhancedButton>
          )}
          {(process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin) && players.length > 0 && (
            <>
              <span className={styles.quickActionAdminLabel}>Admin tools</span>
              <button className={`${cardStyles.quickActionControl} ${styles.adminButton} ${styles.quickActionAdminBtn}`} onClick={handleRandomizeScores} disabled={isScoresLocked}>Randomize Scores</button>
              <button className={`${cardStyles.quickActionControl} ${styles.adminButton} ${styles.quickActionAdminBtn}`} onClick={() => requestClearGame(2)} disabled={isScoresLocked}>Clear Game 2</button>
              <button className={`${cardStyles.quickActionControl} ${styles.adminButton} ${styles.quickActionAdminBtn}`} onClick={() => requestClearGame(3)} disabled={isScoresLocked}>Clear Game 3</button>
            </>
          )}
        </>
      )}
    />
  ), [players.length, pendingSaves.length, isExporting, isExportingPdf, isImporting, isScoresLocked, currentUser, addToast, handleExportScoresToExcel, handleExportScoresToPdf, handleRandomizeScores, markScoresComplete, processPendingSaves, requestClearGame, unlockScoresTable])

  // ── Auth guards (must be after all hooks) ─────────────────────────────────
  if (!isAuthInitialized) return <div className={styles.loadingState}><div role="status">Loading scores...</div></div>
  if (!isUserAuthenticated && !hasStoredAuth) return <div className={styles.authRequired}><div>Please log in to access score management</div></div>
  if (!isUserAuthenticated && hasStoredAuth) return <div className={styles.authRequired}><div role="status">Loading scores...</div></div>
  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
    return (
      <NoTournamentState
        title="Scoring Console Waiting"
        description="Load a tournament to start entering game scores, validating round totals, and keeping standings current."
        cards={[
          { title: 'Capture Results Fast', text: 'Record each game directly in the score sheet for fast lane-side updates.' },
          { title: 'Stay Continuously Saved', text: 'Edits save as you type, so your progress stays protected between updates.' },
          { title: 'Find Bowlers Quickly', text: 'Sort and filter by name, average, or score to correct and confirm entries quickly.' },
        ]}
      />
    )
  }
  if (!showInitialScoresLoad && typeof window !== 'undefined' && !getSelectedSquadId() && !selectedSquad) {
    return (
      <NoTournamentState
        title="Scores Need a Squad"
        description="Select a squad from the dashboard to open scoring for that session."
        cards={[{ title: 'Open the Right Session', text: 'Choose the squad first, then enter game-by-game scores for its bowlers.' }]}
      />
    )
  }

  return (
    <ErrorBoundary>
      <>
        <ActionConfirmDialog
          open={clearGameConfirm !== null}
          title="Clear Game Scores?"
          message={clearGameConfirm !== null ? `Clear all Game ${clearGameConfirm} scores for this tournament/squad? This cannot be undone.` : ''}
          confirmLabel="Clear Scores"
          cancelLabel="Cancel"
          onCancel={() => setClearGameConfirm(null)}
          onConfirm={() => { if (clearGameConfirm !== null) void clearGameScores(clearGameConfirm); setClearGameConfirm(null) }}
        />
        <CalcPayoutsModal
          open={showCalcPayoutsConfirm}
          missingScoreNames={missingScoreNames}
          playerCount={players.length}
          onClose={() => setShowCalcPayoutsConfirm(false)}
          onProceed={() => { setShowCalcPayoutsConfirm(false); void unlockPayoutsAndGo() }}
        />
        <BracketMismatchModal open={showBracketMismatchWarning} onClose={() => setShowBracketMismatchWarning(false)} />
        <ExplainScoresModal isOpen={isScoresGuideOpen} onClose={() => setIsScoresGuideOpen(false)} />
        <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportScoresFileSelected} className="sr-only" />

        {isMobile ? (
          <MobileLayout padding="small" className={styles.mobileScoresLayoutShell}>
            <div className={styles.mobileScoresPage}>
              <div className={styles.mobileScoresToolbarSticky}>
                {tournament && (
                  <div className={styles.mobileScoresContextCard}>
                    <span className={styles.mobileScoresContextTitle}>{tournament.name}</span>
                    {selectedSquad && <span className={styles.mobileScoresContextMeta}>Squad: {selectedSquad.date} - {selectedSquad.time}</span>}
                  </div>
                )}
                <div className={styles.mobileSaveBar}>
                  {rowStateCounts.saving > 0 && <span>Saving {rowStateCounts.saving}...</span>}
                  {rowStateCounts.saving === 0 && rowStateCounts.failed === 0 && <span>Auto-save on</span>}
                  {rowStateCounts.failed > 0 && <span>{rowStateCounts.failed} failed</span>}
                  {lastEdit && <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.mobileUndoBtn}`} onClick={undoLastEdit}>Undo</button>}
                </div>
              </div>
              {tournament && (
                <div className={`${cardStyles.card} ${cardStyles.quickActionsCard} ${styles.mobileQuickActionsCard}`}>
                  <h2 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle}`}>Quick Actions</h2>
                  <div className={cardStyles.quickActionsBody}>{scoresQuickActions}</div>
                </div>
              )}
              {!tournament && !isLoading && (
                <NoTournamentState
                  description="Load a tournament from the dashboard to enter game scores, review totals, and prepare payout calculations."
                  cards={[
                    { title: 'Score Entry', text: "Record each bowler's game scores with totals calculated as you work." },
                    { title: 'Auto-Save', text: 'Changes save in the background so live scoring stays focused and fast.' },
                    { title: 'Payout Ready', text: 'Use completed scores to unlock payout review when the squad is finalized.' },
                  ]}
                />
              )}
              {showInitialScoresLoad && <div className={styles.mobileLoadingWrap}><Spinner size="lg" /></div>}
              {!showInitialScoresLoad && paginationHook.paginatedItems.length > 0 && (
                <MobileScoreCardList
                  paginatedItems={paginationHook.paginatedItems}
                  expandedPlayers={mobileExpandedPlayers}
                  rowSaveState={rowSaveState}
                  isScoresLocked={isScoresLocked}
                  currentPage={paginationHook.currentPage}
                  totalPages={paginationHook.totalPages}
                  onToggleExpand={id => setMobileExpandedPlayers(prev => ({ ...prev, [id]: !prev[id] }))}
                  onUpdateScore={updateScore}
                  onFocusNext={focusNextMobileInput}
                  onSaveAll={saveAllVisibleScores}
                  onPageChange={paginationHook.goToPage}
                />
              )}
            </div>
          </MobileLayout>
        ) : (
          <div className={`${shellStyles.page} ${styles.desktopContainer}`}>
            {!tournament && !showInitialScoresLoad && (
              <NoTournamentState
                description="Load a tournament from the dashboard before entering scores. Once loaded, this page becomes the live scoring workspace for the selected squad."
                cards={[
                  { title: 'Enter Games', text: 'Record scratch scores for each game and review handicap-adjusted totals.' },
                  { title: 'Live Save Status', text: 'See when rows are saving, saved, or need attention during score entry.' },
                  { title: 'Calculate Payouts', text: 'Finalize scores and move directly into payout review when the squad is complete.' },
                ]}
              />
            )}
            {!isOnline && (
              <div className="notification notification-warning">
                <div className="offline-indicator">
                  <span />
                  <span>You are offline. Scores are being saved locally and will sync when connection is restored.</span>
                  {pendingSaves.length > 0 && <span className="pending-count">{pendingSaves.length} pending</span>}
                </div>
              </div>
            )}
            {showInitialScoresLoad && <div className={styles.statusMessage}><span role="status">Loading players and scores...</span></div>}
            {tournament && (
              <>
                <div className={`${cardStyles.card} ${cardStyles.quickActionsCard} ${styles.scoresQuickActionsCard} ${styles.desktopWidthLockedCard}`}>
                  <h2 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle} ${styles.scoresQuickActionsTitle}`}>
                    <Zap aria-hidden="true" />Quick Actions
                  </h2>
                  <div className={cardStyles.quickActionsBody}>{scoresQuickActions}</div>
                </div>
                {!showInitialScoresLoad && players.length === 0 && (
                  <div className={`${cardStyles.card} ${styles.emptyScoresState}`}>
                    <div className={styles.emptyScoresAccentGlow} aria-hidden="true" />
                    <div className={styles.emptyScoresBadge}>Tournament Ready</div>
                    <div className={styles.emptyScoresHeroRow}>
                      <div className={styles.emptyScoresIconContainer}>
                        <div className={styles.emptyScoresIcon}>
                          <svg viewBox="0 0 100 100" className={styles.emptyScoresIconSvg} aria-hidden="true">
                            <rect x="18" y="18" width="64" height="64" rx="8" ry="8" fill="none" stroke="currentColor" strokeWidth="4" />
                            <line x1="30" y1="38" x2="70" y2="38" stroke="currentColor" strokeWidth="4" />
                            <line x1="30" y1="54" x2="70" y2="54" stroke="currentColor" strokeWidth="4" />
                            <line x1="30" y1="70" x2="55" y2="70" stroke="currentColor" strokeWidth="4" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h2 className={styles.emptyScoresTitle}>No players loaded for this squad yet</h2>
                        <p className={styles.emptyScoresText}>Scores will appear here once entries have been added for the selected tournament and squad. Start by loading players into Entries, then come back here to enter game scores.</p>
                      </div>
                    </div>
                    <div className={styles.emptyScoresActions}>
                      <Link href="/players" className={`${styles.emptyScoresPrimaryAction} ${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}>Go To Entries</Link>
                      <Link href="/dashboard" className={`${styles.emptyScoresSecondaryAction} ${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}>Back To Dashboard</Link>
                    </div>
                    <div className={styles.emptyScoresFeaturesGrid}>
                      <div className={`${cardStyles.panel} ${styles.emptyScoresFeatureCard}`}><h3>Load Entries</h3><p>Add bowlers in Entries for the selected tournament and squad before entering any scores.</p></div>
                      <div className={`${cardStyles.panel} ${styles.emptyScoresFeatureCard}`}><h3>Enter Game Scores</h3><p>Capture game-by-game scratch scores and let handicap totals calculate automatically.</p></div>
                      <div className={`${cardStyles.panel} ${styles.emptyScoresFeatureCard}`}><h3>Track Results</h3><p>Sort and review totals quickly to prepare clean bracket seeding and payouts.</p></div>
                    </div>
                  </div>
                )}
                {!showInitialScoresLoad && players.length > 0 && <div className="mobile-scroll-hint">Scroll horizontally to see all score columns</div>}
                {!showInitialScoresLoad && players.length > 0 && (
                  <div className={styles.desktopWidthLockedCard}>
                    <SearchPanel
                      className={styles.scoresSearchCard}
                      title={<span className={styles.scoresSearchHeading}><Search aria-hidden="true" />Search Scores</span>}
                      useToolbar={false}
                      accented={false}
                      left={(
                        <>
                          <label className={styles.scoresSearchInputWrap}>
                            <UserRound aria-hidden="true" />
                            <input type="text" className={`${formStyles.search} ${formStyles.compactControl} ${styles.scoresSearchInput}`} placeholder="First name" aria-label="First name" value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} />
                          </label>
                          <label className={styles.scoresSearchInputWrap}>
                            <UserRound aria-hidden="true" />
                            <input type="text" className={`${formStyles.search} ${formStyles.compactControl} ${styles.scoresSearchInput}`} placeholder="Last name" aria-label="Last name" value={searchLastName} onChange={e => setSearchLastName(e.target.value)} />
                          </label>
                        </>
                      )}
                      right={(
                        <button type="button" className={styles.scoresSearchClear} onClick={() => { setSearchFirstName(''); setSearchLastName('') }}>
                          <RefreshCcw aria-hidden="true" />Clear
                        </button>
                      )}
                    />
                  </div>
                )}
                {!showInitialScoresLoad && filteredPlayers.length > 0 && (
                  <>
                    {rowStateCounts.saving > 0 && <div className={`table-save-status table-save-status--saving ${styles.tableSaveStatus}`}>Saving...</div>}
                    {rowStateCounts.saving === 0 && rowStateCounts.failed === 0 && Object.values(rowSaveState).some(s => s === 'saved') && (
                      <div className={`table-save-status table-save-status--success ${styles.tableSaveStatus}`}>All scores saved</div>
                    )}
                    {rowStateCounts.failed > 0 && <div className={`table-save-status table-save-status--error ${styles.tableSaveStatus}`}>Failed to save {rowStateCounts.failed} score{rowStateCounts.failed > 1 ? 's' : ''}</div>}
                    <ScoreEntryTable
                      paginatedItems={paginationHook.paginatedItems}
                      filteredPlayers={filteredPlayers}
                      selectedSquad={selectedSquad}
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      rowSaveState={rowSaveState}
                      isScoresLocked={isScoresLocked}
                      onUpdateScore={updateScore}
                      onKeyDown={handleKeyDown}
                      completedScoreCount={completedScoreCount}
                      scoreCompletionPercent={scoreCompletionPercent}
                      currentPage={paginationHook.currentPage}
                      totalPages={paginationHook.totalPages}
                      onPageChange={paginationHook.goToPage}
                      totalItems={filteredPlayers.length}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </>
    </ErrorBoundary>
  )
}
