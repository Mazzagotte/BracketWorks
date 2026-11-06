'use client'

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Network, RefreshCw, Search, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardDivider,
  EmptyState,
  ICON_SIZE,
  Notice,
  Page,
  PageHeader,
  SearchField,
  SegmentedControl,
  SelectField,
  StatGroup,
} from '@bracketworks/ui'
import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { useBrackets, BracketPreview } from '../hooks/useBrackets'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { useToast } from '../components/Toast'
import { MOBILE_VIEWPORT_QUERY } from '../lib/responsive'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { cleanupModalState, resetScrollLocks } from '../utils/modalUtils'
import { getMemoryAccessToken } from '../lib/api'
import { formatSquadDate } from '../lib/squadDate'
import ExplainBracketsModal from './components/ExplainBracketsModal'
import { useBracketLoader } from './hooks/useBracketLoader'
import { useBracketGenerationFlow } from './hooks/useBracketGenerationFlow'
import { useBracketSelection } from './hooks/useBracketSelection'
import { useBracketDisplay } from './hooks/useBracketDisplay'
import NoTournamentState from '../components/NoTournamentState'
import styles from './components/BracketsPage.module.css'

// Lazy load heavy components for better initial load performance
const BracketGenerationModal = lazy(() => import('../components/BracketGenerationModal'))
const BracketTreeView = lazy(() => import('./components/BracketTreeView').then(mod => ({ default: mod.BracketTreeView })))

export default function BracketsPage() {
  const { addToast } = useToast()
  const { tournaments, fetchTournaments, loading: tournamentsLoading } = useTournaments()
  const { squads, fetchSquads } = useSquads()

  const lastLoadedRef = useRef<{ tournamentId: number; squadId: number } | null>(null)

  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false)
  const [deleteBracketsConfirmOpen, setDeleteBracketsConfirmOpen] = useState(false)
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0)
  const isMobile = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const [loadedBrackets, setLoadedBrackets] = useState<BracketPreview | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const refreshSelection = () => {
      setSelectionRefreshKey(previous => previous + 1)
    }

    window.addEventListener('tournament-changed', refreshSelection)
    window.addEventListener('squad-changed', refreshSelection)

    return () => {
      window.removeEventListener('tournament-changed', refreshSelection)
      window.removeEventListener('squad-changed', refreshSelection)
    }
  }, [])
  
  // Hooks for data fetching
  const { generateTournamentBrackets, loadSavedBrackets, deleteTournamentBrackets } = useBrackets()

  const { selectedTournament, setSelectedTournament, selectedSquad, setSelectedSquad, isInitializing } =
    useBracketSelection({
      tournaments,
      squads,
      tournamentsLoading,
      fetchTournaments,
      fetchSquads,
      loadSavedBrackets,
      onBracketsLoaded: (brackets) => setLoadedBrackets(brackets as import('../hooks/useBrackets').BracketPreview | null),
      onLastLoaded: (ref) => { lastLoadedRef.current = ref },
      selectionRefreshKey,
    })

  const {
    activeTab, setActiveTab,
    selectedBracketIndex, setSelectedBracketIndex,
    searchFirstName, setSearchFirstName,
    searchLastName, setSearchLastName,
    bracketGroups, filteredBracketItems, searchFilteredBracketItems,
    activeBracketItem, rounds,
    bracketSearchTerm, searchResultCount,
    totalBracketCount, totalPlayersAtGeneration,
    handleClearFilters,
  } = useBracketDisplay({ loadedBrackets, isMobile })
  const filteredBracketCountAll = bracketGroups.reduce((sum, group) => sum + group.brackets.length, 0)
  const { reloadAfterGeneration } = useBracketLoader({
    selectedTournament,
    selectedSquad,
    loadSavedBrackets,
    setLoadedBrackets,
  })

  const {
    isModalOpen,
    bracketGenerationPromise,
    handleGenerateBrackets,
    handleModalClose,
    handleRegenerate,
    resetGenerationModalState,
  } = useBracketGenerationFlow({
    selectedTournament,
    selectedSquad,
    generateTournamentBrackets,
    addToast,
    reloadAfterGeneration,
  })

  // Cleanup modals and state on unmount to prevent navigation blocking
  useEffect(() => {
    // On mount, force-clear any stale scroll locks from other pages
    resetScrollLocks();

    return () => {
      resetGenerationModalState();
      setIsExplainModalOpen(false);
      cleanupModalState();
    };
  }, [resetGenerationModalState]);

  // Safety: whenever both modals are closed, ensure document state is restored
  useEffect(() => {
    if (!isModalOpen && !isExplainModalOpen) {
      cleanupModalState();
    }
  }, [isModalOpen, isExplainModalOpen]);

  // Global cleanup: Ensure no modals are blocking navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key closes explain modal; generation modal manages its own close policy.
      if (e.key === 'Escape') {
        setIsExplainModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Ensure cleanup on page unload
    const handleBeforeUnload = () => {
      cleanupModalState();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const executeDeleteAllBrackets = useCallback(async () => {
    if (!selectedTournament || !selectedSquad) return

    try {
      await deleteTournamentBrackets(selectedTournament.id, selectedSquad.id)
      setLoadedBrackets(null)
      setActiveTab('all')
      setSelectedBracketIndex(0)
      lastLoadedRef.current = null
    } catch {
      // Toast is handled in the hook
    }
  }, [selectedTournament, selectedSquad, deleteTournamentBrackets, setActiveTab, setSelectedBracketIndex])

  const handleDeleteAllBrackets = useCallback(() => {
    setDeleteBracketsConfirmOpen(true)
  }, [])

  const handleCloseExplainModal = useCallback(() => setIsExplainModalOpen(false), [])

  const { isUserAuthenticated, isAuthInitialized, currentUser } = useAuth()
  const hasActiveSession = Boolean(getMemoryAccessToken())
  const isDev = process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin

  const matchTotals = useMemo(() => {
    let total = 0
    let completed = 0
    bracketGroups.forEach(group => group.brackets.forEach(bracket => (bracket.rounds || []).forEach(round => {
      total += round.matches.length
      completed += round.matches.filter(match => match.winner || match.split_pot || match.both_advance).length
    })))
    return { total, completed }
  }, [bracketGroups])

  // Wait for auth initialization
  if (!isAuthInitialized) {
    return <Page><p className={styles.status} role="status">Loading brackets...</p></Page>
  }

  // Authentication guard
  if (!isUserAuthenticated && !hasActiveSession) {
    return (
      <Page>
        <Card>
          <EmptyState title="Log in to manage brackets" description="Please log in to generate and review brackets for your tournament." />
        </Card>
      </Page>
    )
  }

  const hasBrackets = Boolean(loadedBrackets) && filteredBracketItems.length > 0
  const isOutOfDate = Boolean(loadedBrackets?.entries_mismatch)
  const completionPercent = matchTotals.total > 0 ? Math.round((matchTotals.completed / matchTotals.total) * 100) : 0
  const statusBadge = !hasBrackets
    ? <Badge tone="neutral">Not generated</Badge>
    : isOutOfDate
      ? <Badge tone="warning">Out of date</Badge>
      : completionPercent === 100
        ? <Badge tone="success">Complete</Badge>
        : <Badge tone="info">In progress</Badge>
  const squadLabel = selectedSquad ? `${formatSquadDate(selectedSquad.date)} · ${selectedSquad.time || 'Time pending'} squad` : null
  const totalVisible = searchFilteredBracketItems.length
  const safeIndex = Math.min(selectedBracketIndex, Math.max(0, totalVisible - 1))
  const programOptions = [
    ...(bracketGroups.length > 1 ? [{ value: 'all', label: 'All', count: filteredBracketCountAll }] : []),
    ...bracketGroups.map(group => ({ value: group.key, label: group.name, count: group.brackets.length })),
  ]
  const changeProgram = (value: string) => {
    setActiveTab(value)
    setSelectedBracketIndex(0)
  }
  const activeLabel = activeBracketItem ? `${activeBracketItem.group.name} bracket ${safeIndex + 1} of ${totalVisible}` : 'Bracket'

  return (
    <ErrorBoundary>
      {isModalOpen && (
        <Suspense fallback={<div role="status">Loading bracket tools...</div>}>
          <BracketGenerationModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onRegenerate={handleRegenerate}
            bracketGenerationPromise={bracketGenerationPromise}
            tournamentName={selectedTournament?.name}
            squadName={squadLabel ?? undefined}
            playerCount={undefined}
          />
        </Suspense>
      )}

      {isInitializing ? (
        <Page><p className={styles.status} role="status">Loading brackets...</p></Page>
      ) : !selectedTournament ? (
        <NoTournamentState
          title="Bracket engine ready"
          description="Load a tournament to generate bracket trees, manage match progress, and keep rounds moving cleanly."
          cards={[
            { title: 'Generate the tree', text: 'Build brackets directly from your tournament entries.' },
            { title: 'Advance winners', text: 'Track matchups, winners, and round progression as scores come in.' },
            { title: 'Switch programs easily', text: 'Move between scratch and handicap brackets on desktop or phone.' },
          ]}
        />
      ) : !selectedSquad ? (
        <NoTournamentState
          title="Brackets need a squad"
          description="Select a squad from the dashboard to generate and manage brackets for that session."
          cards={[
            { title: 'Choose a session', text: 'Pick the correct squad first, then generate and manage its bracket rounds.' },
          ]}
        />
      ) : (
        <Page>
          <PageHeader
            title="Brackets"
            badge={statusBadge}
            description={[selectedTournament.name, squadLabel].filter(Boolean).join(' · ')}
            actions={(
              <>
                <Button variant="secondary" icon={<BookOpen size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setIsExplainModalOpen(true)}>
                  Bracket guide
                </Button>
                <Button variant="primary" icon={<RefreshCw size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleGenerateBrackets}>
                  {totalBracketCount > 0 ? 'Regenerate brackets' : 'Generate brackets'}
                </Button>
              </>
            )}
          />

          {hasBrackets && isOutOfDate ? (
            <Notice tone="warning">
              Entries changed after these brackets were generated. Regenerate brackets so results and payouts are accurate.
            </Notice>
          ) : null}

          {!hasBrackets ? (
            <Card aria-label="Brackets">
              <EmptyState
                icon={<Network size={ICON_SIZE['2xl']} aria-hidden="true" />}
                title="No brackets generated yet"
                description="Generate brackets to seed matchups from this squad's entries. They update as scores come in."
                action={<Button variant="primary" onClick={handleGenerateBrackets}>Generate brackets</Button>}
              />
            </Card>
          ) : (
            <>
              <StatGroup
                label="Bracket totals"
                items={[
                  { label: 'Brackets', value: String(totalBracketCount) },
                  { label: 'Bowlers', value: String(totalPlayersAtGeneration) },
                  { label: 'Completion', value: `${completionPercent}%`, detail: `${matchTotals.completed} of ${matchTotals.total} matches` },
                ]}
              />

              <Card aria-label="Bracket viewer">
                <div className={styles.controls}>
                  {programOptions.length > 1 ? (
                    isMobile || programOptions.length > 5 ? (
                      <SelectField label="Program" value={activeTab} onChange={event => changeProgram(event.target.value)}>
                        {programOptions.map(option => (
                          <option key={option.value} value={option.value}>{`${option.label} (${option.count})`}</option>
                        ))}
                      </SelectField>
                    ) : (
                      <SegmentedControl label="Program" options={programOptions} value={activeTab} onChange={changeProgram} />
                    )
                  ) : null}

                  <div className={styles.pickerRow}>
                    <div className={styles.picker}>
                      <Button
                        size={isMobile ? undefined : 'sm'}
                        variant="secondary"
                        icon={<ChevronLeft size={ICON_SIZE.md} aria-hidden="true" />}
                        aria-label="Previous bracket"
                        onClick={() => setSelectedBracketIndex(Math.max(0, safeIndex - 1))}
                        disabled={safeIndex === 0}
                      />
                      <SelectField
                        label="Bracket"
                        hideLabel
                        value={safeIndex}
                        onChange={event => setSelectedBracketIndex(Number(event.target.value))}
                        disabled={totalVisible === 0}
                      >
                        {searchFilteredBracketItems.map((item, index) => (
                          <option key={`${item.group.key}-${index}`} value={index}>{`${item.group.name} ${index + 1} of ${totalVisible}`}</option>
                        ))}
                      </SelectField>
                      <Button
                        size={isMobile ? undefined : 'sm'}
                        variant="secondary"
                        icon={<ChevronRight size={ICON_SIZE.md} aria-hidden="true" />}
                        aria-label="Next bracket"
                        onClick={() => setSelectedBracketIndex(Math.min(totalVisible - 1, safeIndex + 1))}
                        disabled={safeIndex >= totalVisible - 1}
                      />
                    </div>
                    <SearchField
                      label="Highlight a bowler"
                      placeholder="Highlight a bowler"
                      value={searchFirstName}
                      onChange={event => { setSearchFirstName(event.target.value); setSearchLastName('') }}
                      className={styles.search}
                    />
                  </div>
                  {bracketSearchTerm ? (
                    <p className={styles.meta} role="status">
                      {searchResultCount === 1 ? '1 bracket' : `${searchResultCount ?? 0} brackets`} with &quot;{bracketSearchTerm}&quot;
                    </p>
                  ) : null}
                </div>

                <CardDivider />

                <Suspense fallback={<p className={styles.status} role="status">Loading bracket view...</p>}>
                  {totalVisible === 0 ? (
                    <EmptyState
                      icon={<Search size={ICON_SIZE['2xl']} aria-hidden="true" />}
                      title="No brackets with that bowler"
                      description="Try a different name, or clear the search."
                      action={<Button variant="secondary" onClick={handleClearFilters}>Clear search</Button>}
                    />
                  ) : rounds.length > 0 ? (
                    <BracketTreeView rounds={rounds} isMobile={isMobile} searchTerm={bracketSearchTerm} label={activeLabel} />
                  ) : (
                    <p className={styles.status}>This bracket has no matches yet.</p>
                  )}
                </Suspense>
              </Card>

              <div className={styles.footer}>
                <p className={styles.meta}>Brackets update as scores change.</p>
                {isDev ? (
                  <Button size="sm" variant="ghost-danger" icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={handleDeleteAllBrackets}>
                    Delete all brackets
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </Page>
      )}

      <ActionConfirmDialog
        open={deleteBracketsConfirmOpen}
        title="Delete all brackets?"
        message="Delete all saved brackets for this squad? This cannot be undone."
        confirmLabel="Delete brackets"
        cancelLabel="Cancel"
        onCancel={() => setDeleteBracketsConfirmOpen(false)}
        onConfirm={() => {
          setDeleteBracketsConfirmOpen(false)
          void executeDeleteAllBrackets()
        }}
      />

      <ExplainBracketsModal
        isOpen={isExplainModalOpen}
        onClose={handleCloseExplainModal}
      />
    </ErrorBoundary>
  )
}
