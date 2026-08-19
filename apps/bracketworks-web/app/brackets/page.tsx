'use client'

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw, Trash2, Zap } from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { useBrackets, BracketPreview } from '../hooks/useBrackets'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { useToast } from '../components/Toast'
import { BracketResponse } from '../lib/types'
import { isPhoneViewport } from '../lib/responsive'
import { cleanupModalState, resetScrollLocks } from '../utils/modalUtils'
import { getMemoryAccessToken } from '../lib/api'
import { BracketTabs } from './components/BracketTabs'
import { SearchFilter } from './components/SearchFilter'
import { EmptyBracketState } from './components/EmptyBracketState'
import ExplainBracketsModal from './components/ExplainBracketsModal'
import { BracketSummaryCard } from './components/BracketSummaryCard'
import { EntriesMismatchBanner } from './components/EntriesMismatchBanner'
import { useBracketLoader } from './hooks/useBracketLoader'
import { useBracketGenerationFlow } from './hooks/useBracketGenerationFlow'
import { useBracketSelection } from './hooks/useBracketSelection'
import { useBracketDisplay } from './hooks/useBracketDisplay'
import NoTournamentState from '../components/NoTournamentState'
import styles from './brackets.module.css'
import cardStyles from '../styles/cards.module.css'
import buttonStyles from '../styles/buttons.module.css'
import shellStyles from '../styles/page-shell.module.css'

// Lazy load heavy components for better initial load performance
const BracketGenerationModal = lazy(() => import('../components/BracketGenerationModal'))
const BracketTreeView = lazy(() => import('./components/BracketTreeView').then(mod => ({ default: mod.BracketTreeView })))

export default function BracketsPage() {
  const { addToast } = useToast()
  const { tournaments, fetchTournaments, loading: tournamentsLoading } = useTournaments()
  const { squads, fetchSquads } = useSquads()

  const [selectedBracketIndex, setSelectedBracketIndex] = useState<number>(0)
  const lastLoadedRef = useRef<{ tournamentId: number; squadId: number } | null>(null)

  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false)
  const [deleteBracketsConfirmOpen, setDeleteBracketsConfirmOpen] = useState(false)
  const [entriesMismatchPromptOpen, setEntriesMismatchPromptOpen] = useState(false)
  const [entriesMismatchPromptDismissedKey, setEntriesMismatchPromptDismissedKey] = useState<string | null>(null)
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
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
    mobileOpenBracketIndex, setMobileOpenBracketIndex,
    searchFirstName, setSearchFirstName,
    searchLastName, setSearchLastName,
    bracketGroups, filteredBracketItems, searchFilteredBracketItems,
    mobileBracketSections, activeBracketItem, rounds,
    bracketSearchTerm, searchResultCount,
    totalBracketCount, totalPlayersAtGeneration,
    handleClearFilters,
  } = useBracketDisplay({ loadedBrackets, isMobile })
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

  const entriesMismatchPromptKey = useMemo(
    () => (selectedTournament && selectedSquad ? `${selectedTournament.id}:${selectedSquad.id}` : null),
    [selectedTournament, selectedSquad],
  )

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
  }, [selectedTournament, selectedSquad, deleteTournamentBrackets, setActiveTab])

  const handleDeleteAllBrackets = useCallback(() => {
    setDeleteBracketsConfirmOpen(true)
  }, [])

  // Entries mismatch: open confirmation dialog when bracket data becomes stale
  useEffect(() => {
    if (!entriesMismatchPromptKey || !loadedBrackets?.entries_mismatch) {
      setEntriesMismatchPromptOpen(false)
      return
    }
    if (entriesMismatchPromptDismissedKey === entriesMismatchPromptKey) return
    setEntriesMismatchPromptOpen(true)
  }, [loadedBrackets?.entries_mismatch, entriesMismatchPromptDismissedKey, entriesMismatchPromptKey])

  const handleCloseExplainModal = useCallback(() => setIsExplainModalOpen(false), [])

  const { isUserAuthenticated, isAuthInitialized, currentUser } = useAuth()
  const hasActiveSession = Boolean(getMemoryAccessToken())
  const isDev = process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin

  const bracketsQuickActions = useMemo(() => {
    if (!selectedTournament) return undefined
    return (
      <div className={`${cardStyles.quickActionsRow} ${styles.bracketsQuickActionsRow}`}>
        <div className={`${cardStyles.quickActionsGroupLeft} ${styles.bracketsQuickActionsGroupLeft}`}>
          <button
            onClick={() => setIsExplainModalOpen(true)}
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
          >
            <BookOpen aria-hidden="true" />
            Bracket Guide
          </button>
          <button
            type="button"
            onClick={handleGenerateBrackets}
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
          >
            <RefreshCw aria-hidden="true" />
            {totalBracketCount > 0 ? 'Regenerate Brackets' : 'Generate Brackets'}
          </button>
        </div>
        {isDev && (
          <div className={`${cardStyles.quickActionsGroupRight} ${styles.bracketsQuickActionsGroupRight}`}>
            <div className={styles.quickActionAdminLabel}>Admin Tools</div>
            <button onClick={handleDeleteAllBrackets} className={`${cardStyles.quickActionControl} ${styles.quickActionDangerBtn}`}>
              <Trash2 aria-hidden="true" />
              Delete All Brackets
            </button>
          </div>
        )}
      </div>
    )
  }, [selectedTournament, handleDeleteAllBrackets, handleGenerateBrackets, isDev, setIsExplainModalOpen, totalBracketCount])


  // Wait for auth initialization
  if (!isAuthInitialized) {
    return (
      <div className={styles.loadingState}>
        <div role="status">Loading brackets...</div>
      </div>
    )
  }

  // Authentication guard
  if (!isUserAuthenticated && !hasActiveSession) {
    return (
      <div className={styles.authRequired}>
        <div>Please log in to access bracket management</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {/* Bracket Generation Modal - only load when needed */}
      {isModalOpen && (
        <Suspense fallback={<div role="status">Loading bracket tools...</div>}>
          <BracketGenerationModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onRegenerate={handleRegenerate}
            bracketGenerationPromise={bracketGenerationPromise}
            tournamentName={selectedTournament?.name}
            squadName={selectedSquad ? `${selectedSquad.date} - ${selectedSquad.time}` : undefined}
            playerCount={undefined}
          />
        </Suspense>
      )}

      <ActionConfirmDialog
        open={entriesMismatchPromptOpen}
        title="Brackets Are Out of Date"
        message="Brackets out of date: Entries have changed. Regenerate brackets to ensure accurate results and payouts."
        confirmLabel="Regenerate Brackets"
        cancelLabel="Dismiss"
        showCloseButton={false}
        onCancel={() => {
          setEntriesMismatchPromptOpen(false)
          if (entriesMismatchPromptKey) {
            setEntriesMismatchPromptDismissedKey(entriesMismatchPromptKey)
          }
        }}
        onConfirm={() => {
          setEntriesMismatchPromptOpen(false)
          setEntriesMismatchPromptDismissedKey(null)
          handleGenerateBrackets()
        }}
      />

      {/* Bracket content */}
      <div className={`${shellStyles.page} ${styles.pageContainer}`}>
        {selectedTournament && (
          <section className={styles.bracketsTopRow}>
            {bracketsQuickActions && (
              <div className={`${cardStyles.card} ${cardStyles.quickActionsCard} ${styles.bracketsQuickActionsCard}`}>
                <h2 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle} ${styles.bracketsQuickActionsTitle}`}>
                  <Zap aria-hidden="true" />
                  Quick Actions
                </h2>
                <div className={cardStyles.quickActionsBody}>
                  {bracketsQuickActions}
                </div>
              </div>
            )}

            <BracketSummaryCard
              totalBracketCount={totalBracketCount}
              totalPlayersAtGeneration={totalPlayersAtGeneration}
            />
          </section>
        )}

        {/* Loading State */}
        {isInitializing ? (
          <div className={styles.loadingState}>
            <div role="status">Loading brackets...</div>
          </div>
        ) : /* No Tournament Loaded State */
        !selectedTournament ? (
          <NoTournamentState
            title="Bracket Engine Ready"
            description="Load a tournament to generate bracket trees, manage match progress, and keep rounds moving cleanly."
            cards={[
              { title: 'Generate the Tree', text: 'Build single or double elimination brackets directly from your tournament entries.' },
              { title: 'Advance Winners', text: 'Track matchups, update winners, and view round progression in real time.' },
              { title: 'Switch Modes Easily', text: 'Move between scratch and handicap views with navigation built for desk and mobile.' },
            ]}
          />
        ) : !selectedSquad ? (
          <NoTournamentState
            title="Brackets Need a Squad"
            description="Select a squad from the dashboard to generate and manage brackets for that session."
            cards={[
              { title: 'Choose a Session', text: 'Pick the correct squad first, then generate and manage its bracket rounds.' },
            ]}
          />
        ) : (
        /* Show empty state if no brackets */
        (() => {
          const hasLoadedBrackets = !!loadedBrackets
          const showEmpty = !hasLoadedBrackets || filteredBracketItems.length === 0

          return showEmpty
        })() ? (
          <EmptyBracketState
            onGenerateClick={handleGenerateBrackets}
            showDemo={true}
          />
        ) : (
          <>
            {/* Entries mismatch warning */}
            {loadedBrackets?.entries_mismatch && (
              <EntriesMismatchBanner onRegenerate={handleGenerateBrackets} />
            )}
            <section className={styles.bracketWorkspaceCard}>
              {/* Bracket Tabs + Navigator */}
              <div className={styles.controlPanel}>
              {/* Bracket Tabs */}
              <BracketTabs
                tabs={[
                  ...(bracketGroups.length > 1 ? [{ id: 'all', label: 'All Brackets', count: filteredBracketItems.length }] : []),
                  ...bracketGroups.map(group => ({ id: group.key, label: group.name, count: group.brackets.length })),
                ]}
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab)
                  setSelectedBracketIndex(0)
                  setMobileOpenBracketIndex(null)
                }}
              />

              {/* Bracket Navigator - only shown when there are multiple brackets */}
              {!isMobile && (() => {
              const totalBrackets = searchFilteredBracketItems.length
              
              if (totalBrackets <= 1) return null // Don't show if only one bracket
              
              // Calculate bracket stats
              const totalMatches = rounds.reduce((sum, round) => sum + round.matches.length, 0)
              const completedMatches = rounds.reduce((sum, round) =>
                sum + (round.matches as any[]).filter((m) => m.winner || m.split_pot || m.both_advance).length, 0)
              const progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
              
              return (
                <>
                  <div className={styles.bracketNav}>
                    <div className={styles.navMeta}>
                      <div className={styles.bracketPicker}>
                        <label className={styles.bracketSelectLabel} htmlFor="bracket-select-desktop">Bracket</label>
                        <select
                          id="bracket-select-desktop"
                          className={styles.bracketSelectControl}
                          value={selectedBracketIndex}
                          onChange={(event) => setSelectedBracketIndex(Number(event.target.value))}
                        >
                          {searchFilteredBracketItems.map((item, index) => (
                            <option key={`${item.group.key}-${index}`} value={index}>
                              {`${item.group.name} ${index + 1} of ${totalBrackets}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.bracketProgress}>
                        <span className={styles.navMetaSecondary}>{progressPercent}% complete</span>
                        <progress
                          className={styles.bracketProgressMeter}
                          value={progressPercent}
                          max={100}
                          aria-label={`${progressPercent}% of matches complete`}
                        />
                      </div>
                    </div>
                    <div className={styles.navBtns}>
                        <button
                          onClick={() => setSelectedBracketIndex(Math.max(0, selectedBracketIndex - 1))}
                          disabled={selectedBracketIndex === 0}
                          className={styles.navBtn}
                        >
                          <ChevronLeft aria-hidden="true" />
                          Previous
                        </button>
                        <button
                          onClick={() => setSelectedBracketIndex(Math.min(totalBrackets - 1, selectedBracketIndex + 1))}
                          disabled={selectedBracketIndex >= totalBrackets - 1}
                          className={styles.navBtn}
                        >
                          Next
                          <ChevronRight aria-hidden="true" />
                        </button>
                      </div>
                  </div>
                </>
              )
            })()}
              <div className={styles.bracketSearchRow}>
                <SearchFilter
                  firstName={searchFirstName}
                  lastName={searchLastName}
                  onFirstNameChange={setSearchFirstName}
                  onLastNameChange={setSearchLastName}
                  onClearFilters={handleClearFilters}
                  searchResultCount={searchResultCount}
                />
              </div>
              </div>{/* end controlPanel */}

              {/* Bracket Display */}
              <div className={styles.bracketWorkspaceStage}>
              <Suspense fallback={<div className={styles.loadingState} role="status"><div>Loading bracket view...</div></div>}>
            {isMobile ? (
              searchFilteredBracketItems.length === 0 ? (
                <div className={`${cardStyles.card} ${styles.noMatches}`}>
                  <p>No brackets contain that player name.</p>
                </div>
              ) : mobileOpenBracketIndex === null ? (
                <div className={styles.mobileBracketList}>
                  {mobileBracketSections.map(section => (
                    <section key={section.key} className={styles.mobileBracketSection}>
                      <h3 className={styles.mobileBracketSectionTitle}>{section.name}</h3>
                      <div className={styles.mobileBracketSectionList}>
                        {section.items.map(({ item, index }) => {
                          const itemRounds = item.bracket.rounds || []
                          const totalMatches = itemRounds.reduce((sum, round) => sum + round.matches.length, 0)
                          const completedMatches = itemRounds.reduce(
                            (sum, round) => sum + round.matches.filter(m => m.winner || m.split_pot || m.both_advance).length,
                            0
                          )

                          return (
                            <button
                              key={`${section.key}-${index}`}
                              className={`${cardStyles.panel} ${styles.mobileBracketListItem}`}
                              onClick={() => {
                                setSelectedBracketIndex(index)
                                setMobileOpenBracketIndex(index)
                              }}
                            >
                              <div className={styles.mobileBracketListTitleRow}>
                                <span className={styles.mobileBracketListTitle}>Bracket {index + 1}</span>
                                <span className={styles.mobileBracketListMode}>{item.group.name}</span>
                              </div>
                              <div className={styles.mobileBracketListMeta}>
                                {completedMatches}/{totalMatches} matches complete
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : activeBracketItem ? (
                <div className={styles.mobileTreeViewWrap}>
                  <div className={styles.mobileTreeHeader}>
                    <button
                      className={styles.mobileTreeBackBtn}
                      onClick={() => setMobileOpenBracketIndex(null)}
                    >
                      Back to Brackets
                    </button>
                    <div className={styles.mobileTreeTitle}>
                      Bracket {selectedBracketIndex + 1} • {activeBracketItem.group.name}
                    </div>
                  </div>
                  <BracketTreeView
                    rounds={rounds}
                    isMobile={true}
                    bracketType={activeBracketItem.group.scoring_mode === 'scratch' ? 'scratch' : 'handicap'}
                    searchTerm={bracketSearchTerm}
                    statusFilter="all"
                    bracketTitle={`${activeBracketItem.group.scoring_mode === 'scratch' ? 'Scratch' : 'Handicap'} Bracket ${selectedBracketIndex + 1} of ${searchFilteredBracketItems.length}`}
                  />
                </div>
              ) : (
                <div className={`${cardStyles.card} ${styles.noMatches}`}>
                  <p>No bracket selected.</p>
                </div>
              )
            ) : rounds.length > 0 ? (
              <BracketTreeView
                rounds={rounds}
                isMobile={false}
                bracketType={activeBracketItem?.group?.scoring_mode === 'scratch' ? 'scratch' : 'handicap'}
                searchTerm={bracketSearchTerm}
                statusFilter="all"
                bracketTitle={activeBracketItem ? `${activeBracketItem.group.scoring_mode === 'scratch' ? 'Scratch' : 'Handicap'} Bracket ${selectedBracketIndex + 1} of ${searchFilteredBracketItems.length}` : undefined}
              />
            ) : (
              <div className={`${cardStyles.card} ${styles.noMatches}`}>
                <p>No matches found for the selected filters.</p>
              </div>
            )}
              </Suspense>
              </div>

              <footer className={styles.bracketWorkspaceFooter}>
                <span>Brackets auto-update as scores change.</span>
                <span>{totalBracketCount} brackets generated for {totalPlayersAtGeneration} players.</span>
              </footer>
            </section>
          </>
        )
        )}
      </div>

      {/* Explain Brackets Modal */}
      <ActionConfirmDialog
        open={deleteBracketsConfirmOpen}
        title="Delete Saved Brackets?"
        message="Delete all saved brackets for this tournament/squad? This cannot be undone."
        confirmLabel="Delete Brackets"
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
