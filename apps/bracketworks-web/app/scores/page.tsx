'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Player } from '../lib/types'
import Link from 'next/link'
import { BookOpen, Calculator, ClipboardList, Eraser, FileSpreadsheet, FileText, LockOpen, Printer, RefreshCcw, Search, Shuffle, Undo2, Upload } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  EmptyState,
  ICON_SIZE,
  Notice,
  Page,
  PageHeader,
  ProgressBar,
  TextField,
  buttonClassName,
} from '@bracketworks/ui'

import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { API, apiFetch, getMemoryAccessToken } from '../lib/api'
import styles from './components/ScoreTable.module.css'
import { useToast } from '../components/Toast'
import { useAutoSave } from '../components/DataManagement'
import NoTournamentState from '../components/NoTournamentState'
import { formatSquadDate } from '../lib/squadDate'
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
import { CalcPayoutsModal, BracketMismatchModal, ScoreCorrectionModal, UnlockScoresModal } from './components/ScoreConfirmModals'
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
  const [showUnlockScoresConfirm, setShowUnlockScoresConfirm] = useState(false)
  const [isUnlockingScores, setIsUnlockingScores] = useState(false)
  const [missingScoreNames, setMissingScoreNames] = useState<string[]>([])
  const importFileRef = useRef<HTMLInputElement | null>(null)

  // ── Core data ──────────────────────────────────────────────────────────────
  const { players, setPlayers, tournament, selectedSquad, selectedSquadRef, playersRef, isLoading } =
    useScoreData(sessionToken)

  // ── Toast + offline sync ───────────────────────────────────────────────────
  const { addToast } = useToast()
  const { isOnline, pendingSaves, setPendingSaves, processPendingSaves } = useOfflineScoreSync({ addToast })

  // ── Lock state ─────────────────────────────────────────────────────────────
  const { isScoresLocked, scoresHaveBeenUnlocked, unlockScoresTable, unlockPayoutsAndGo } =
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
    pendingScoreCorrection,
    confirmScoreCorrection,
    cancelScoreCorrection,
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
    scoresHaveBeenUnlocked,
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

  const confirmUnlockScores = useCallback(async (reason: string) => {
    setIsUnlockingScores(true)
    try {
      const unlocked = await unlockScoresTable(reason)
      if (unlocked) setShowUnlockScoresConfirm(false)
    } finally {
      setIsUnlockingScores(false)
    }
  }, [unlockScoresTable])

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

  const handlePrintBlankScoreSheet = useCallback(() => {
    if (filteredPlayers.length === 0) { addToast({ message: 'No players to print.', type: 'warning', duration: 3000 }); return }
    setIsExportingPdf(true)
    try {
      const squadLabel = selectedSquad ? [selectedSquad.name, selectedSquad.date, selectedSquad.time].filter(Boolean).join(' | ') : 'All Squads'
      const html = buildScoresPdfHtml({ players: filteredPlayers, tournamentName: tournament?.name || 'Tournament', squadLabel, location: tournament?.location || '', generatedAt: new Date().toLocaleString(), logoUrl: `${window.location.origin}/logo_no_text.svg`, scoresLocked: isScoresLocked, blankScoreSheet: true })
      printHtmlDocument({ html, documentTitle: buildSafeFileName(tournament?.name, selectedSquad, 'blank-score-sheet').replace(/\.xlsx$/, '') })
      addToast({ message: `Prepared a blank score sheet for ${filteredPlayers.length} players.`, type: 'success', duration: 3000 })
    } catch (err) {
      addToast({ message: `Failed to prepare score sheet: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error', duration: 5000 })
    } finally { setIsExportingPdf(false) }
  }, [addToast, filteredPlayers, isScoresLocked, selectedSquad, tournament])

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

  // ── Quick actions ──────────────────────────────────────────────────────────
  const showAdminTools = (process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin) && players.length > 0
  const scoresQuickActions = (
    <Card aria-label="Quick actions">
      <CardHeader title="Quick actions" />
      <div className={styles.actionRow}>
        {players.length > 0 && !isScoresLocked ? (
          <Button variant="primary" icon={<Calculator size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => { void markScoresComplete() }}>
            Calculate payouts
          </Button>
        ) : null}
        {players.length > 0 && isScoresLocked ? (
          <Button variant="primary" icon={<LockOpen size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setShowUnlockScoresConfirm(true)}>
            Unlock scores
          </Button>
        ) : null}
        {pendingSaves.length > 0 ? (
          <Button
            variant="secondary"
            icon={<RefreshCcw size={ICON_SIZE.md} aria-hidden="true" />}
            onClick={async () => { await processPendingSaves(); addToast({ message: 'Offline scores synced.', type: 'success', duration: 3000 }) }}
          >
            Sync offline scores ({pendingSaves.length})
          </Button>
        ) : null}
        <Button variant="secondary" icon={<Upload size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => importFileRef.current?.click()} disabled={isImporting || players.length === 0 || isScoresLocked}>
          {isImporting ? 'Importing...' : 'Import from Excel'}
        </Button>
        <Button variant="secondary" icon={<FileSpreadsheet size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleExportScoresToExcel} disabled={isExporting || players.length === 0}>
          {isExporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
        <Button variant="secondary" icon={<FileText size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleExportScoresToPdf} disabled={isExportingPdf || players.length === 0}>
          {isExportingPdf ? 'Preparing...' : 'Export to PDF'}
        </Button>
        <Button variant="secondary" icon={<Printer size={ICON_SIZE.md} aria-hidden="true" />} onClick={handlePrintBlankScoreSheet} disabled={isExportingPdf || players.length === 0}>
          Print blank score sheet
        </Button>
        <Button variant="ghost" icon={<BookOpen size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setIsScoresGuideOpen(true)}>
          Scores guide
        </Button>
      </div>
      {showAdminTools ? (
        <>
          <CardDivider />
          <h3 className={styles.overline}>Admin tools</h3>
          <div className={styles.actionRow}>
            <Button size="sm" variant="secondary" icon={<Shuffle size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleRandomizeScores} disabled={isScoresLocked}>
              Randomize scores
            </Button>
            <Button size="sm" variant="ghost-danger" icon={<Eraser size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => requestClearGame(2)} disabled={isScoresLocked}>
              Clear game 2
            </Button>
            <Button size="sm" variant="ghost-danger" icon={<Eraser size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => requestClearGame(3)} disabled={isScoresLocked}>
              Clear game 3
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  )

  // ── Auth guards (must be after all hooks) ─────────────────────────────────
  if (!isAuthInitialized || (!isUserAuthenticated && hasStoredAuth)) {
    return <Page><p className={styles.status} role="status">Loading scores...</p></Page>
  }
  if (!isUserAuthenticated && !hasStoredAuth) {
    return (
      <Page>
        <Card>
          <EmptyState title="Log in to enter scores" description="Please log in to manage scores for your tournament." />
        </Card>
      </Page>
    )
  }
  if (typeof window !== 'undefined' && !getSelectedTournamentId()) {
    return (
      <NoTournamentState
        title="Scoring console waiting"
        description="Load a tournament to start entering game scores, validating round totals, and keeping standings current."
        cards={[
          { title: 'Capture results fast', text: 'Record each game directly in the score sheet for fast lane-side updates.' },
          { title: 'Stay saved', text: 'Edits save as you type, so your progress stays protected between updates.' },
          { title: 'Find bowlers quickly', text: 'Sort and filter by name, average, or score to correct and confirm entries quickly.' },
        ]}
      />
    )
  }
  if (!showInitialScoresLoad && typeof window !== 'undefined' && !getSelectedSquadId() && !selectedSquad) {
    return (
      <NoTournamentState
        title="Scores need a squad"
        description="Select a squad from the dashboard to open scoring for that session."
        cards={[{ title: 'Open the right session', text: 'Choose the squad first, then enter game-by-game scores for its bowlers.' }]}
      />
    )
  }

  const squadLabel = selectedSquad
    ? `${formatSquadDate(selectedSquad.date)} · ${selectedSquad.time || 'Time pending'} squad`
    : null
  const hasSavedRows = Object.values(rowSaveState).some(state => state === 'saved')
  const saveLine = rowStateCounts.failed > 0
    ? `Failed to save ${rowStateCounts.failed} score${rowStateCounts.failed > 1 ? 's' : ''}`
    : rowStateCounts.saving > 0
      ? `Saving ${rowStateCounts.saving}...`
      : hasSavedRows ? 'All scores saved' : 'Scores save as you type'

  return (
    <ErrorBoundary>
      <>
        <ActionConfirmDialog
          open={clearGameConfirm !== null}
          title="Clear game scores?"
          message={clearGameConfirm !== null ? `Clear all game ${clearGameConfirm} scores for this squad? This cannot be undone.` : ''}
          confirmLabel="Clear scores"
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
        <ScoreCorrectionModal
          request={pendingScoreCorrection}
          onCancel={cancelScoreCorrection}
          onConfirm={confirmScoreCorrection}
        />
        <UnlockScoresModal
          open={showUnlockScoresConfirm}
          isSubmitting={isUnlockingScores}
          onClose={() => setShowUnlockScoresConfirm(false)}
          onConfirm={reason => { void confirmUnlockScores(reason) }}
        />
        <ExplainScoresModal isOpen={isScoresGuideOpen} onClose={() => setIsScoresGuideOpen(false)} />
        <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportScoresFileSelected} className="sr-only" />

        {!tournament && !showInitialScoresLoad ? (
          <NoTournamentState
            description="Load a tournament from the dashboard before entering scores. Once loaded, this page becomes the live scoring workspace for the selected squad."
            cards={[
              { title: 'Enter games', text: 'Record scratch scores for each game and review handicap-adjusted totals.' },
              { title: 'Live save status', text: 'See when rows are saving, saved, or need attention during score entry.' },
              { title: 'Calculate payouts', text: 'Finalize scores and move directly into payout review when the squad is complete.' },
            ]}
          />
        ) : (
          <Page>
            <PageHeader
              title="Scores"
              badge={isScoresLocked ? <Badge tone="neutral">Locked</Badge> : undefined}
              description={[tournament?.name, squadLabel].filter(Boolean).join(' · ') || undefined}
            />

            {!isOnline ? (
              <Notice tone="warning" role="status">
                You are offline. Scores are saved on this device and sync when the connection is back.
                {pendingSaves.length > 0 ? ` ${pendingSaves.length} waiting to sync.` : ''}
              </Notice>
            ) : null}

            {showInitialScoresLoad ? (
              <Card aria-label="Scores">
                <p className={styles.status} role="status">Loading players and scores...</p>
              </Card>
            ) : tournament ? (
              <>
                {scoresQuickActions}

                {players.length === 0 ? (
                  <Card aria-label="Scores">
                    <EmptyState
                      icon={<ClipboardList size={ICON_SIZE['2xl']} aria-hidden="true" />}
                      title="No bowlers in this squad yet"
                      description="Add entries for this squad first, then come back to enter game scores."
                      action={(
                        <>
                          <Link href="/players" className={buttonClassName({ variant: 'primary' })}>Go to entries</Link>
                          <Link href="/dashboard" className={buttonClassName({ variant: 'secondary' })}>Back to dashboard</Link>
                        </>
                      )}
                    />
                  </Card>
                ) : (
                  <>
                    <Card aria-label="Search scores">
                      <CardHeader title="Search scores" />
                      <div className={styles.searchForm}>
                        <TextField label="First name" value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} />
                        <TextField label="Last name" value={searchLastName} onChange={e => setSearchLastName(e.target.value)} />
                        <Button variant="ghost" onClick={() => { setSearchFirstName(''); setSearchLastName('') }} disabled={!searchFirstName && !searchLastName}>
                          Clear
                        </Button>
                      </div>
                    </Card>

                    <Card padding="flush" aria-label="Scores">
                      <CardHeader
                        title="Scores"
                        description={squadLabel ?? undefined}
                        actions={(
                          <div className={styles.headerMeta}>
                            <ProgressBar
                              value={completedScoreCount}
                              max={players.length}
                              label="Bowlers scored"
                              valueText={`${completedScoreCount} of ${players.length} scored`}
                            />
                            <p className={rowStateCounts.failed > 0 ? styles.saveLineError : styles.saveLine} role="status">
                              {saveLine}
                            </p>
                            {isMobile && lastEdit ? (
                              <Button size="sm" variant="ghost" icon={<Undo2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={undoLastEdit}>Undo</Button>
                            ) : null}
                          </div>
                        )}
                      />
                      {filteredPlayers.length === 0 ? (
                        <EmptyState
                          icon={<Search size={ICON_SIZE['2xl']} aria-hidden="true" />}
                          title="No matching bowlers"
                          description="Try a different first or last name."
                          action={<Button variant="secondary" onClick={() => { setSearchFirstName(''); setSearchLastName('') }}>Clear search</Button>}
                        />
                      ) : isMobile ? (
                        <MobileScoreCardList
                          paginatedItems={paginationHook.paginatedItems}
                          expandedPlayers={mobileExpandedPlayers}
                          rowSaveState={rowSaveState}
                          isScoresLocked={isScoresLocked}
                          currentPage={paginationHook.currentPage}
                          totalPages={paginationHook.totalPages}
                          totalItems={filteredPlayers.length}
                          onToggleExpand={id => setMobileExpandedPlayers(prev => ({ ...prev, [id]: !prev[id] }))}
                          onUpdateScore={updateScore}
                          onFocusNext={focusNextMobileInput}
                          onSaveAll={saveAllVisibleScores}
                          onPageChange={paginationHook.goToPage}
                        />
                      ) : (
                        <ScoreEntryTable
                          paginatedItems={paginationHook.paginatedItems}
                          filteredPlayers={filteredPlayers}
                          sortConfig={sortConfig}
                          onSort={handleSort}
                          rowSaveState={rowSaveState}
                          isScoresLocked={isScoresLocked}
                          onUpdateScore={updateScore}
                          onKeyDown={handleKeyDown}
                          currentPage={paginationHook.currentPage}
                          totalPages={paginationHook.totalPages}
                          onPageChange={paginationHook.goToPage}
                          totalItems={filteredPlayers.length}
                        />
                      )}
                    </Card>
                  </>
                )}
              </>
            ) : null}
          </Page>
        )}
      </>
    </ErrorBoundary>
  )
}
