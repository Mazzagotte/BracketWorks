'use client'

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useBrackets, BracketPreview } from '../hooks/useBrackets'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { useToast } from '../components/Toast'
import { Tournament, Squad, BracketResponse, BracketData } from '../lib/types'
import { logger } from '../lib/logger'
import { storage } from '../lib/storage'
import { cleanupModalState, resetScrollLocks } from '../utils/modalUtils'
import { BracketTabs } from './components/BracketTabs'
import { SearchFilter } from './components/SearchFilter'
import { EmptyBracketState } from './components/EmptyBracketState'
import ExplainBracketsModal from './components/ExplainBracketsModal'
import NoTournamentState from '../components/NoTournamentState'
import '../styles/bowling-animations.css'
import styles from './brackets.module.css'

// Lazy load heavy components for better initial load performance
const BracketGenerationModal = lazy(() => import('../components/BracketGenerationModal'))
const BracketTreeView = lazy(() => import('./components/BracketTreeView').then(mod => ({ default: mod.BracketTreeView })))
const MobileBracketView = lazy(() => import('./components/MobileBracketView').then(mod => ({ default: mod.MobileBracketView })))

export default function BracketsPage() {
  // State for modal and generation
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bracketGenerationPromise, setBracketGenerationPromise] = useState<Promise<BracketPreview> | null>(null)
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  
  // State for bracket display
  const [activeTab, setActiveTab] = useState<'scratch' | 'handicap' | 'all'>('all')
  const [currentRound, setCurrentRound] = useState(0)
  
  // Ref to prevent infinite loop in useEffect
  const loadingRef = useRef(false)
  const lastLoadedRef = useRef<{tournamentId: number, squadId: number} | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedSeedRange, setSelectedSeedRange] = useState('all')
  const [isMobile, setIsMobile] = useState(false)
  const [loadedBrackets, setLoadedBrackets] = useState<BracketPreview | null>(null)
  
  // Hooks for data fetching
  const { generateTournamentBrackets, loadSavedBrackets } = useBrackets()
  const { tournaments, fetchTournaments, loading: tournamentsLoading } = useTournaments()
  const { squads, fetchSquads } = useSquads()
  const { addToast } = useToast()
  
  // State for selected entities
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [selectedBracketIndex, setSelectedBracketIndex] = useState<number>(0) // Which bracket to display (0-based)

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
      // Escape key closes all modals
      if (e.key === 'Escape') {
        setIsModalOpen(false);
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

  // Load tournaments on mount
  useEffect(() => {
    fetchTournaments()
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

  // Auto-select squad from localStorage or use first squad
  useEffect(() => {
    if (squads.length > 0 && !selectedSquad) {
      const storedSquadId = storage.getItem('selected_squad_id')
      let squadToSelect = null
      
      if (storedSquadId) {
        squadToSelect = squads.find(s => s.id === parseInt(storedSquadId))
      }
      
      // If no stored squad or stored squad not found, select first squad
      if (!squadToSelect) {
        squadToSelect = squads[0]
      }
      
      if (squadToSelect) {
        setSelectedSquad(squadToSelect)
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
          setLoadedBrackets(brackets);
          lastLoadedRef.current = { tournamentId: selectedTournament.id, squadId: selectedSquad.id };
          loadingRef.current = false;
        })
        .catch(() => {
          if (isMounted) {
            loadingRef.current = false;
          }
        });
    };

    // Initial load when tournament/squad changes
    loadBrackets(false);

    // Auto-refresh interval - 15s when visible, 60s when hidden
    const getRefreshInterval = () => document.hidden ? 60000 : 15000;
    let intervalId = setInterval(() => {
      if (isMounted) loadBrackets(true);
    }, getRefreshInterval());

    // Handle visibility changes - adjust interval and reload if becoming visible
    const handleVisibilityChange = () => {
      if (!isMounted) return;
      clearInterval(intervalId);
      if (!document.hidden) {
        loadBrackets(true); // Reload when becoming visible
      }
      intervalId = setInterval(() => {
        if (isMounted) loadBrackets(true);
      }, getRefreshInterval());
    };

    // Handle focus - reload to get latest data
    const handleFocus = () => {
      if (!isMounted) return;
      if (!document.hidden) {
        loadBrackets(true);
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
      true  // Force regenerate to see debug output
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

  // Filter and process brackets based on active tab
  const filteredBrackets = useMemo(() => {
    if (!loadedBrackets) return []
    
    // Try direct properties first (current API format)
    const scratch = loadedBrackets.scratch_brackets || loadedBrackets.multiple_brackets?.scratch_brackets || []
    const handicap = loadedBrackets.handicap_brackets || loadedBrackets.multiple_brackets?.handicap_brackets || []
    
    // Early return based on tab to avoid unnecessary array concatenation
    if (activeTab === 'scratch') {
      return scratch
    } else if (activeTab === 'handicap') {
      return handicap
    }
    
    // Only create combined array for 'all' tab
    return [...scratch, ...handicap]
  }, [loadedBrackets, activeTab])

  // Convert brackets to rounds structure
  const rounds = useMemo(() => {
    if (!loadedBrackets) return []
    
    // Check for direct rounds property first (fastest path for single bracket preview)
    if (loadedBrackets.rounds) {
      return loadedBrackets.rounds
    }
    
    // Check for direct scratch_brackets/handicap_brackets at top level (current API format)
    const bracketResponse = loadedBrackets as BracketResponse;
    const scratch_brackets = bracketResponse.scratch_brackets;
    const handicap_brackets = bracketResponse.handicap_brackets;
    
    // Helper function to get source brackets - eliminates duplicate logic
    const getSourceBrackets = (scratch: BracketData[] | undefined, handicap: BracketData[] | undefined): BracketData[] => {
      if (activeTab === 'scratch' && scratch?.length) {
        return scratch
      }
      if (activeTab === 'handicap' && handicap?.length) {
        return handicap
      }
      // For 'all' tab, prefer scratch if available
      return scratch?.length ? scratch : (handicap || [])
    }
    
    let sourceBrackets: BracketData[] = []
    
    if (scratch_brackets || handicap_brackets) {
      sourceBrackets = getSourceBrackets(scratch_brackets, handicap_brackets)
    } else if (bracketResponse.multiple_brackets) {
      // Alternative API format with wrapper
      const { scratch_brackets: wrapperScratch, handicap_brackets: wrapperHandicap } = bracketResponse.multiple_brackets
      sourceBrackets = getSourceBrackets(wrapperScratch, wrapperHandicap)
    }
    
    // Early return if no brackets
    if (!sourceBrackets.length) return []
    
    // Use selectedBracketIndex, but ensure it's within bounds
    const bracketIndex = Math.min(selectedBracketIndex, sourceBrackets.length - 1)
    return sourceBrackets[bracketIndex]?.rounds || []
  }, [loadedBrackets, activeTab, selectedBracketIndex])

  // Handle search and filter
  const handleClearFilters = useCallback(() => {
    setSearchTerm('')
    setSelectedStatus('all')
    setSelectedSeedRange('all')
  }, [])

  const searchResultCount = useMemo(() => {
    if (!searchTerm || !rounds.length) return null
    const term = searchTerm.toLowerCase()
    const matched = new Set<string>()
    rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.playerA && match.playerA.toLowerCase().includes(term)) matched.add(match.playerA)
        if (match.playerB && match.playerB.toLowerCase().includes(term)) matched.add(match.playerB)
      })
    })
    return matched.size
  }, [searchTerm, rounds])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (searchTerm) count++
    if (selectedStatus !== 'all') count++
    if (selectedSeedRange !== 'all') count++
    return count
  }, [searchTerm, selectedStatus, selectedSeedRange])

  const handleCloseExplainModal = useCallback(() => setIsExplainModalOpen(false), [])

  // Memoize the Generate Brackets button to prevent infinite re-renders
  const generateBracketsButton = useMemo(() => {
    if (!selectedTournament) return undefined
    return (
      <div className={styles.headerActions}>
        <button onClick={() => setIsExplainModalOpen(true)} className={styles.explainBtn}>
          Explain Brackets
        </button>
        <button onClick={handleGenerateBrackets} className={styles.generateBtn}>
          Generate Brackets
        </button>
      </div>
    )
  }, [selectedTournament, handleGenerateBrackets, setIsExplainModalOpen])

  // Set page header with actions
  usePageHeader({
    title: 'Bracket View',
    subtitle: undefined,
    actions: generateBracketsButton
  })

  // Authentication check
  const { isAuthenticated, isInitialized } = useAuth()

  // Check if we have tokens in localStorage
  const hasStoredAuth = typeof window !== 'undefined' && 
    storage.getItem('token') && 
    storage.getItem('user_id')

  // Wait for auth initialization
  if (!isInitialized) {
    return (
      <div className={styles.loadingState}>
        <div>Loading...</div>
      </div>
    )
  }

  // Authentication guard
  if (!isAuthenticated && !hasStoredAuth) {
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
        ) : (
        /* Show empty state if no brackets */
        (() => {
          const hasLoadedBrackets = !!loadedBrackets
          const roundsLength = rounds?.length || 0
          const showEmpty = !hasLoadedBrackets || roundsLength === 0

          return showEmpty
        })() ? (
          <EmptyBracketState
            onGenerateClick={handleGenerateBrackets}
            showDemo={true}
          />
        ) : (
          <>
            {/* Combined Control Panel: Search + Tabs + Navigator */}
            <div className={styles.controlPanel}>
              {/* Search and Filter */}
              <SearchFilter
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                selectedSeedRange={selectedSeedRange}
                onSeedRangeChange={setSelectedSeedRange}
                onClearFilters={handleClearFilters}
                activeFiltersCount={activeFiltersCount}
                searchResultCount={searchResultCount}
              />

              {/* Divider */}
              <div className={styles.controlDivider} />

              {/* Bracket Tabs */}
              <BracketTabs
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab)
                  setSelectedBracketIndex(0)
                }}
                scratchCount={loadedBrackets.scratch_brackets?.length || loadedBrackets.multiple_brackets?.scratch_brackets?.length || 0}
                handicapCount={loadedBrackets.handicap_brackets?.length || loadedBrackets.multiple_brackets?.handicap_brackets?.length || 0}
              />

              {/* Bracket Navigator - only shown when there are multiple brackets */}
              {(() => {
              const scratchBrackets = loadedBrackets.scratch_brackets || loadedBrackets.multiple_brackets?.scratch_brackets || []
              const handicapBrackets = loadedBrackets.handicap_brackets || loadedBrackets.multiple_brackets?.handicap_brackets || []
              
              let totalBrackets = 0
              if (activeTab === 'scratch') totalBrackets = scratchBrackets.length
              else if (activeTab === 'handicap') totalBrackets = handicapBrackets.length
              else totalBrackets = scratchBrackets.length + handicapBrackets.length
              
              if (totalBrackets <= 1) return null // Don't show if only one bracket
              
              // Calculate bracket stats
              const totalMatches = rounds.reduce((sum, round) => sum + round.matches.length, 0)
              const completedMatches = rounds.reduce((sum, round) =>
                sum + round.matches.filter(m => m.winner || m.split_pot || m.both_advance).length, 0)
              const progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
              
              // Get bracket type
              const bracketType = activeTab === 'all' 
                ? (scratchBrackets.length > 0 ? 'Scratch' : 'Handicap')
                : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
              
              return (
                <>
                  <div className={styles.controlDivider} />
                  <div className={styles.bracketNav}>

                  <button
                    onClick={() => setSelectedBracketIndex(Math.max(0, selectedBracketIndex - 1))}
                    disabled={selectedBracketIndex === 0}
                    className={styles.navBtn}
                  >
                    <span className={styles.navArrow}>←</span>
                    <span>Previous</span>
                  </button>

                  <div className={styles.navCenter}>
                    <div className={styles.navTitleRow}>
                      <h3 className={styles.navTitle}>
                        <span className={styles.navTitleGradient}>Bracket {selectedBracketIndex + 1}</span>
                        <span className={styles.navTitleOf}>of</span>
                        <span className={styles.navTitleTotal}>{totalBrackets}</span>
                      </h3>

                      <div className={`${styles.navBadge} ${bracketType === 'Scratch' ? styles.navBadgeScratch : styles.navBadgeHandicap}`}>
                        {bracketType}
                      </div>

                      <div className={`${styles.navBadge} ${progressPercent === 100 ? styles.navBadgeComplete : styles.navBadgeProgress}`}>
                        {completedMatches}/{totalMatches} Complete
                      </div>
                    </div>

                    <div className={styles.progressBarWrapper}>
                      <div
                        className={`${styles.progressBarFill} ${progressPercent === 100 ? styles.progressBarFillComplete : ''}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedBracketIndex(Math.min(totalBrackets - 1, selectedBracketIndex + 1))}
                    disabled={selectedBracketIndex >= totalBrackets - 1}
                    className={styles.navBtn}
                  >
                    <span>Next</span>
                    <span className={styles.navArrow}>→</span>
                  </button>
                  </div>
                </>
              )
            })()}
            </div>{/* end controlPanel */}

            {/* Bracket Display */}
            <Suspense fallback={<div className={styles.loadingState}><div>Loading...</div></div>}>
            {rounds.length > 0 ? (
              isMobile ? (
                <MobileBracketView
                  rounds={rounds}
                  currentRound={currentRound}
                  onRoundChange={setCurrentRound}
                />
              ) : (
                <BracketTreeView
                  rounds={rounds}
                  isMobile={isMobile}
                  bracketType={activeTab === 'scratch' ? 'scratch' : 'handicap'}
                  searchTerm={searchTerm}
                  statusFilter={selectedStatus}
                />
              )
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
      <ExplainBracketsModal
        isOpen={isExplainModalOpen}
        onClose={handleCloseExplainModal}
      />
    </ErrorBoundary>
  )
}