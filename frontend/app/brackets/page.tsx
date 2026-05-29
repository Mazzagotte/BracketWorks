'use client'

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import ActionConfirmDialog from '../components/ActionConfirmDialog'
import { useBrackets, BracketPreview } from '../hooks/useBrackets'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { useToast } from '../components/Toast'
import { Tournament, Squad, BracketResponse } from '../lib/types'
import { logger } from '../lib/logger'
import { storage } from '../lib/storage'
import { cleanupModalState, resetScrollLocks } from '../utils/modalUtils'
import { getBracketGroups } from '../lib/bracketPrograms'
import { BracketTabs } from './components/BracketTabs'
import { SearchFilter } from './components/SearchFilter'
import { EmptyBracketState } from './components/EmptyBracketState'
import ExplainBracketsModal from './components/ExplainBracketsModal'
import NoTournamentState from '../components/NoTournamentState'
import styles from './brackets.module.css'

// Lazy load heavy components for better initial load performance
const BracketGenerationModal = lazy(() => import('../components/BracketGenerationModal'))
const BracketTreeView = lazy(() => import('./components/BracketTreeView').then(mod => ({ default: mod.BracketTreeView })))

export default function BracketsPage() {
  // State for modal and generation
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bracketGenerationPromise, setBracketGenerationPromise] = useState<Promise<BracketPreview> | null>(null)
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false)
  const [deleteBracketsConfirmOpen, setDeleteBracketsConfirmOpen] = useState(false)
  const [entriesMismatchPromptOpen, setEntriesMismatchPromptOpen] = useState(false)
  const [entriesMismatchPromptDismissedKey, setEntriesMismatchPromptDismissedKey] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  
  // State for bracket display
  const [activeTab, setActiveTab] = useState('all')
  const [mobileOpenBracketIndex, setMobileOpenBracketIndex] = useState<number | null>(null)
  
  // Ref to prevent infinite loop in useEffect
  const loadingRef = useRef(false)
  const lastLoadedRef = useRef<{tournamentId: number, squadId: number} | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [loadedBrackets, setLoadedBrackets] = useState<BracketPreview | null>(null)
  
  // Hooks for data fetching
  const { generateTournamentBrackets, loadSavedBrackets, deleteTournamentBrackets } = useBrackets()
  const { tournaments, fetchTournaments, loading: tournamentsLoading } = useTournaments()
  const { squads, fetchSquads } = useSquads()
  const { addToast } = useToast()
  
  // State for selected entities
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [selectedBracketIndex, setSelectedBracketIndex] = useState<number>(0) // Which bracket to display (0-based)
  const entriesMismatchPromptKey = useMemo(
    () => (selectedTournament && selectedSquad ? `${selectedTournament.id}:${selectedSquad.id}` : null),
    [selectedTournament, selectedSquad],
  )

  // Detect mobile viewport with debouncing to reduce unnecessary re-renders
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 480) // Phone only - tablets get desktop experience
    }
    
    checkMobile()
    
    // Debounce resize events to avoid excessive state updates
    let timeoutId: NodeJS.Timeout
    const debouncedCheckMobile = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(checkMobile, 150) // 150ms debounce
    }
    
    window.addEventListener('resize', debouncedCheckMobile)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedCheckMobile)
    }
  }, [])

  // Cleanup modals and state on unmount to prevent navigation blocking
  useEffect(() => {
    // On mount, force-clear any stale scroll locks from other pages
    resetScrollLocks();

    return () => {
      setIsModalOpen(false);
      setIsExplainModalOpen(false);
      setBracketGenerationPromise(null);
      cleanupModalState();
    };
  }, []);

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

  // Load tournaments on mount — and prefetch squads + brackets in parallel
  // when we already know the last-used IDs from localStorage (common case).
  useEffect(() => {
    const storedTournamentId = storage.getItem('lastTournamentId')
    const storedSquadId = storage.getItem('selected_squad_id')

    if (storedTournamentId && storedSquadId) {
      const tId = parseInt(storedTournamentId)
      const sId = parseInt(storedSquadId)
      // Fire all three requests in parallel — don't wait for tournaments before fetching squads/brackets
      Promise.all([
        fetchTournaments(),
        fetchSquads(tId),
        loadSavedBrackets(tId, sId).then(brackets => {
          if (brackets) {
            setLoadedBrackets(brackets)
            lastLoadedRef.current = { tournamentId: tId, squadId: sId }
          }
        }).catch(() => {}),
      ])
    } else if (storedTournamentId) {
      Promise.all([fetchTournaments(), fetchSquads(parseInt(storedTournamentId))])
    } else {
      fetchTournaments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select tournament from localStorage and load squads in one operation
  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedTournamentId = storage.getItem('lastTournamentId')
      if (storedTournamentId) {
        const storedTournament = tournaments.find(t => t.id === parseInt(storedTournamentId))
        if (storedTournament) {
          setSelectedTournament(storedTournament)
          // Immediately fetch squads - no need to wait for re-render
          fetchSquads(storedTournament.id).then(() => {
            setIsInitializing(false)
          }).catch(() => {
            setIsInitializing(false)
          })
        } else {
          setIsInitializing(false)
        }
      } else {
        setIsInitializing(false)
      }
    } else if (tournaments.length > 0) {
      setIsInitializing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments, selectedTournament])

  // If fetch completes with no tournaments, stop initializing
  useEffect(() => {
    if (!tournamentsLoading && tournaments.length === 0) {
      setIsInitializing(false)
    }
  }, [tournamentsLoading, tournaments.length])

  // Auto-select squad from localStorage only (no fallback to first squad)
  useEffect(() => {
    if (squads.length > 0 && !selectedSquad) {
      const storedSquadId = storage.getItem('selected_squad_id')
      if (storedSquadId) {
        const squadToSelect = squads.find(s => s.id === parseInt(storedSquadId))
        if (squadToSelect) {
          setSelectedSquad(squadToSelect)
        }
      }
    }
  }, [squads, selectedSquad])

  // Unified bracket loading and auto-refresh with smart visibility/focus handling
  useEffect(() => {
    if (!selectedSquad || !selectedTournament) return;

    // Flag to track if component is still mounted
    let isMounted = true;

    // Centralized bracket loading function
    const loadBrackets = (skipIfSame = false) => {
      // Skip if component unmounted
      if (!isMounted) return;
      
      // Skip if already loading
      if (loadingRef.current) return;
      
      // Skip if we're already showing the right brackets
      if (skipIfSame && 
          lastLoadedRef.current?.tournamentId === selectedTournament.id && 
          lastLoadedRef.current?.squadId === selectedSquad.id) {
        return;
      }

      loadingRef.current = true;
      loadSavedBrackets(selectedTournament.id, selectedSquad.id)
        .then(brackets => {
          if (!isMounted) {
            loadingRef.current = false;
            return;
          }
          if (brackets !== null) {
            setLoadedBrackets(brackets);
          }
          lastLoadedRef.current = { tournamentId: selectedTournament.id, squadId: selectedSquad.id };
          loadingRef.current = false;
        })
        .catch(() => {
          if (isMounted) {
            loadingRef.current = false;
          }
        });
    };

    // Initial load when tournament/squad changes — skip if prefetch already populated this pair
    loadBrackets(true);

    // Auto-refresh interval - 15s when visible, 60s when hidden
    const getRefreshInterval = () => document.hidden ? 60000 : 15000;
    let intervalId = setInterval(() => {
      if (isMounted) loadBrackets(false);
    }, getRefreshInterval());

    // Handle visibility changes - adjust interval and reload if becoming visible
    const handleVisibilityChange = () => {
      if (!isMounted) return;
      clearInterval(intervalId);
      if (!document.hidden) {
        loadBrackets(false); // Reload when becoming visible
      }
      intervalId = setInterval(() => {
        if (isMounted) loadBrackets(false);
      }, getRefreshInterval());
    };

    // Handle focus - reload to get latest data
    const handleFocus = () => {
      if (!isMounted) return;
      if (!document.hidden) {
        loadBrackets(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      loadingRef.current = false; // Reset loading state on cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSquad, selectedTournament]);

  // Start the bracket generation process
  const startBracketGeneration = useCallback(() => {
    if (!selectedTournament || !selectedSquad) return;
    
    // Create the promise for bracket generation
    const generationPromise = generateTournamentBrackets(
      selectedTournament.id,
      selectedSquad.id,
      8, // Default bracket size
      true, // Save to database
      true // Force regenerate to see debug output
    )
      .then((result) => {
        // Success - toast will be shown by modal
        addToast({
          type: 'success',
          message: 'Brackets generated successfully!',
          duration: 5000
        })
        return result
      })
      .catch((error) => {
        // Error - will be handled by modal
        logger.error('Bracket generation failed', { error });
        throw error
      })
    
    // Set the promise and open modal
    setBracketGenerationPromise(generationPromise)
    setIsModalOpen(true)
  }, [selectedTournament, selectedSquad, generateTournamentBrackets, addToast])

  // Handle generate brackets action
  const handleGenerateBrackets = useCallback(() => {
    // Validation: Check for tournament selection
    if (!selectedTournament) {
      addToast({
        type: 'error',
        message: 'Please select a tournament first',
        duration: 5000
      })
      return
    }

    // Validation: Check for squad selection
    if (!selectedSquad) {
      addToast({
        type: 'error',
        message: 'Please select a squad first',
        duration: 5000
      })
      return
    }

    // Start bracket generation
    startBracketGeneration()
  }, [selectedTournament, selectedSquad, addToast, startBracketGeneration])

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setBracketGenerationPromise(null)
    
    // Reload brackets after generation
    if (selectedSquad && selectedTournament) {
      loadingRef.current = false // Reset the loading ref
      lastLoadedRef.current = null // Reset the last loaded ref to force reload
      loadSavedBrackets(selectedTournament.id, selectedSquad.id).then(brackets => {
        if (brackets) {
          setLoadedBrackets(brackets)
          lastLoadedRef.current = { tournamentId: selectedTournament.id, squadId: selectedSquad.id }
        }
      })
    }
  }, [selectedSquad, selectedTournament, loadSavedBrackets])

  // Handle regenerate action from modal
  const handleRegenerate = useCallback(() => {
    // Restart the generation process
    startBracketGeneration()
  }, [startBracketGeneration])

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
  }, [selectedTournament, selectedSquad, deleteTournamentBrackets])

  const handleDeleteAllBrackets = useCallback(() => {
    setDeleteBracketsConfirmOpen(true)
  }, [])

  const bracketGroups = useMemo(() => {
    return getBracketGroups(loadedBrackets as BracketResponse | null).filter(group => group.brackets?.length)
  }, [loadedBrackets])

  useEffect(() => {
    if (activeTab === 'all') return
    if (!bracketGroups.some(group => group.key === activeTab)) {
      setActiveTab(bracketGroups.length > 1 ? 'all' : (bracketGroups[0]?.key || 'all'))
      setSelectedBracketIndex(0)
    }
  }, [activeTab, bracketGroups])

  // Filter and process brackets based on active tab
  const filteredBracketItems = useMemo(() => {
    if (activeTab === 'all') {
      return bracketGroups.flatMap(group => group.brackets.map(bracket => ({ group, bracket })))
    }

    const activeGroup = bracketGroups.find(group => group.key === activeTab)
    if (!activeGroup) return []
    return activeGroup.brackets.map(bracket => ({ group: activeGroup, bracket }))
  }, [activeTab, bracketGroups])

  const searchFilteredBracketItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return filteredBracketItems

    return filteredBracketItems.filter(({ bracket }) =>
      (bracket.rounds || []).some(round =>
        round.matches.some(match =>
          (match.playerA || '').toLowerCase().includes(term) ||
          (match.playerB || '').toLowerCase().includes(term)
        )
      )
    )
  }, [filteredBracketItems, searchTerm])

  const mobileBracketSections = useMemo(() => {
    const grouped = new Map<string, { key: string; name: string; items: Array<{ item: typeof searchFilteredBracketItems[number]; index: number }> }>()

    searchFilteredBracketItems.forEach((item, index) => {
      const existing = grouped.get(item.group.key)
      if (existing) {
        existing.items.push({ item, index })
      } else {
        grouped.set(item.group.key, {
          key: item.group.key,
          name: item.group.name,
          items: [{ item, index }],
        })
      }
    })

    return Array.from(grouped.values())
  }, [searchFilteredBracketItems])

  useEffect(() => {
    if (selectedBracketIndex >= searchFilteredBracketItems.length) {
      setSelectedBracketIndex(0)
    }
  }, [searchFilteredBracketItems.length, selectedBracketIndex])

  useEffect(() => {
    if (!entriesMismatchPromptKey || !loadedBrackets?.entries_mismatch) {
      setEntriesMismatchPromptOpen(false)
      return
    }

    if (entriesMismatchPromptDismissedKey === entriesMismatchPromptKey) {
      return
    }

    setEntriesMismatchPromptOpen(true)
  }, [loadedBrackets?.entries_mismatch, entriesMismatchPromptDismissedKey, entriesMismatchPromptKey])

  useEffect(() => {
    if (!isMobile || mobileOpenBracketIndex === null) return
    if (mobileOpenBracketIndex >= searchFilteredBracketItems.length) {
      setMobileOpenBracketIndex(null)
    }
  }, [isMobile, mobileOpenBracketIndex, searchFilteredBracketItems.length])

  const activeBracketItem = useMemo(() => {
    if (!searchFilteredBracketItems.length) return null
    const safeIndex = Math.min(selectedBracketIndex, searchFilteredBracketItems.length - 1)
    return searchFilteredBracketItems[safeIndex] || null
  }, [searchFilteredBracketItems, selectedBracketIndex])

  // Convert brackets to rounds structure
  const rounds = useMemo(() => {
    if (!loadedBrackets) return []
    
    // Check for direct rounds property first (fastest path for single bracket preview)
    if (loadedBrackets.rounds) {
      return loadedBrackets.rounds
    }

    return activeBracketItem?.bracket?.rounds || []
  }, [activeBracketItem, loadedBrackets])

  // Handle search and filter
  const handleClearFilters = useCallback(() => {
    setSearchTerm('')
  }, [])

  const searchResultCount = useMemo(() => {
    if (!searchTerm) return null
    return searchFilteredBracketItems.length
  }, [searchFilteredBracketItems.length, searchTerm])

  const handleCloseExplainModal = useCallback(() => setIsExplainModalOpen(false), [])
  const { isUserAuthenticated, isAuthInitialized, currentUser } = useAuth()
  const isDev = process.env.NODE_ENV === 'development' || !!currentUser?.isAdmin

  // Memoize the Generate Brackets button to prevent infinite re-renders
  const generateBracketsButton = useMemo(() => {
    if (!selectedTournament) return undefined
    return (
      <div className={styles.headerActions}>
        <button onClick={() => setIsExplainModalOpen(true)} className="ds-btn ds-btn-info ds-btn-sm">
          Bracket Guide
        </button>
        <button onClick={handleGenerateBrackets} className={`ds-btn ds-btn-primary ds-btn-sm ${styles.generateBtn}`}>
          Generate Brackets
        </button>
        {isDev && (
          <div className={styles.devGroup}>
            <button onClick={handleDeleteAllBrackets} className={styles.devButton}>
              Delete All Brackets
            </button>
          </div>
        )}
      </div>
    )
  }, [selectedTournament, handleGenerateBrackets, setIsExplainModalOpen, isDev, handleDeleteAllBrackets])

  // Set page header with actions
  usePageHeader({
    title: 'Bracket View',
    subtitle: undefined,
    actions: generateBracketsButton
  })

  // Check if we have tokens in localStorage
  const hasStoredAuth = typeof window !== 'undefined' && 
    storage.getItem('token') && 
    storage.getItem('user_id')

  // Wait for auth initialization
  if (!isAuthInitialized) {
    return (
      <div className={styles.loadingState}>
        <div>Loading...</div>
      </div>
    )
  }

  // Authentication guard
  if (!isUserAuthenticated && !hasStoredAuth) {
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
        <Suspense fallback={<div>Loading...</div>}>
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
      <div className={styles.pageContainer}>
        {/* Loading State */}
        {isInitializing ? (
          <div className={styles.loadingState}>
            <div>Loading...</div>
          </div>
        ) : /* No Tournament Loaded State */
        !selectedTournament ? (
          <NoTournamentState
            description="Load a tournament from the dashboard to generate and manage brackets. Once loaded, you'll be able to create brackets, track matches, and manage tournament progress."
            cards={[
              { title: 'Generate Brackets', text: 'Automatically create single or double elimination brackets from your player list' },
              { title: 'Track Matches', text: 'View match-ups, update winners, and follow tournament progress in real-time' },
              { title: 'Multiple Views', text: 'Separate scratch and handicap brackets, with mobile-friendly navigation' },
            ]}
          />
        ) : !selectedSquad ? (
          <NoTournamentState
            title="No Squad Selected"
            description="Select a squad from the dashboard to generate and view brackets for that session."
            cards={[
              { title: 'Select a Squad', text: 'Choose a squad from the dashboard to generate and view its brackets' },
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
              <div className={styles.mismatchBanner}>
                <span className={styles.mismatchBannerText}>
                  Brackets out of date: Entries have changed. Regenerate brackets to ensure accurate results and payouts.
                </span>
                <button onClick={handleGenerateBrackets} className={`${styles.mismatchBannerButton} ds-btn ds-btn-sm`}>
                  Regenerate Brackets
                </button>
              </div>
            )}
            {/* Combined Control Panel: Search + Tabs + Navigator */}
            <div className={styles.controlPanel}>
              {/* Search and Filter */}
              <SearchFilter
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onClearFilters={handleClearFilters}
                searchResultCount={searchResultCount}
              />

              {/* Divider */}
              <div className={styles.controlDivider} />

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
                sum + round.matches.filter(m => m.winner || m.split_pot || m.both_advance).length, 0)
              const progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
              
              return (
                <>
                  <div className={styles.controlDivider} />
                  <div className={styles.bracketNav}>
                    <div className={styles.navBtns}>
                        <button
                          onClick={() => setSelectedBracketIndex(Math.max(0, selectedBracketIndex - 1))}
                          disabled={selectedBracketIndex === 0}
                          className={styles.navBtn}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setSelectedBracketIndex(Math.min(totalBrackets - 1, selectedBracketIndex + 1))}
                          disabled={selectedBracketIndex >= totalBrackets - 1}
                          className={styles.navBtn}
                        >
                          Next
                        </button>
                      </div>
                  </div>
                </>
              )
            })()}
            </div>{/* end controlPanel */}

            {/* Bracket Display */}
            <Suspense fallback={<div className={styles.loadingState}><div>Loading...</div></div>}>
            {isMobile ? (
              searchFilteredBracketItems.length === 0 ? (
                <div className={styles.noMatches}>
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
                              className={styles.mobileBracketListItem}
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
                    searchTerm={searchTerm}
                    statusFilter="all"
                    bracketTitle={`${activeBracketItem.group.scoring_mode === 'scratch' ? 'Scratch' : 'Handicap'} Bracket ${selectedBracketIndex + 1} of ${searchFilteredBracketItems.length}`}
                  />
                </div>
              ) : (
                <div className={styles.noMatches}>
                  <p>No bracket selected.</p>
                </div>
              )
            ) : rounds.length > 0 ? (
              <BracketTreeView
                rounds={rounds}
                isMobile={false}
                bracketType={activeBracketItem?.group?.scoring_mode === 'scratch' ? 'scratch' : 'handicap'}
                searchTerm={searchTerm}
                statusFilter="all"
                bracketTitle={activeBracketItem ? `${activeBracketItem.group.scoring_mode === 'scratch' ? 'Scratch' : 'Handicap'} Bracket ${selectedBracketIndex + 1} of ${searchFilteredBracketItems.length}` : undefined}
              />
            ) : (
              <div className={styles.noMatches}>
                <p>No matches found for the selected filters.</p>
              </div>
            )}
            </Suspense>
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