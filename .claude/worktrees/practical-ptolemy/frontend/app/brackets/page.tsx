'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useBrackets, BracketPreview, Match } from '../hooks/useBrackets'
import { useTournaments, useSquads } from '../hooks/useTournaments'
import { useToast } from '../components/Toast'
import { Tournament, Squad, BracketResponse, BracketData, BracketRound } from '../lib/types'
import { logger } from '../lib/logger'
import { storage } from '../lib/storage'
import { cleanupModalState, resetScrollLocks, clearStrayOverlays } from '../utils/modalUtils'
import { BracketTabs } from './components/BracketTabs'
import { RoundNavigator } from './components/RoundNavigator'
import { SearchFilter } from './components/SearchFilter'
import { EmptyBracketState } from './components/EmptyBracketState'
import { colors, semantic, gradients, shadows, rgba } from '../styles/colors'
import '../styles/bowling-animations.css'

// Lazy load heavy components for better initial load performance
const BracketGenerationModal = lazy(() => import('../components/BracketGenerationModal'))
const ExplainBracketsModal = lazy(() => import('./components/ExplainBracketsModal'))
const BracketTreeView = lazy(() => import('./components/BracketTreeView').then(mod => ({ default: mod.BracketTreeView })))
const BracketStatsPanel = lazy(() => import('./components/BracketStatsPanel').then(mod => ({ default: mod.BracketStatsPanel })))
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
  const { tournaments, fetchTournaments } = useTournaments()
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
    // Also clear any stray overlays that might remain mounted
    clearStrayOverlays();

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
      clearStrayOverlays();
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

    // Auto-refresh interval - 5s when visible, 30s when hidden
    const getRefreshInterval = () => document.hidden ? 30000 : 5000;
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

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (searchTerm) count++
    if (selectedStatus !== 'all') count++
    if (selectedSeedRange !== 'all') count++
    return count
  }, [searchTerm, selectedStatus, selectedSeedRange])

  // Memoize the Generate Brackets button to prevent infinite re-renders
  const generateBracketsButton = useMemo(() => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <button
        onClick={() => setIsExplainModalOpen(true)}
        style={{
          backgroundColor: colors.transparent,
          color: colors.brand.gold,
          border: `2px solid ${colors.brand.gold}`,
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = rgba(colors.brand.gold, 0.1)
          e.currentTarget.style.borderColor = colors.brand.goldDark
          e.currentTarget.style.color = colors.brand.goldDark
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.transparent
          e.currentTarget.style.borderColor = colors.brand.gold
          e.currentTarget.style.color = colors.brand.gold
        }}
      >
        Explain Brackets
      </button>
      <button
        onClick={handleGenerateBrackets}
        style={{
          backgroundColor: semantic.button.primary,
          color: colors.white,
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = semantic.button.primaryHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = semantic.button.primary
        }}
      >
        Generate Brackets
      </button>
    </div>
  ), [handleGenerateBrackets, setIsExplainModalOpen])

  // Set page header with actions
  usePageHeader({
    title: 'Bracket Management',
    subtitle: selectedTournament 
      ? `Managing: ${selectedTournament.name}${selectedTournament.location ? ` • ${selectedTournament.location}` : ''}${selectedTournament.start_date ? ` • ${new Date(selectedTournament.start_date).toLocaleDateString()}` : ''}`
      : 'Create and manage tournament brackets',
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
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '200px',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  // Authentication guard
  if (!isAuthenticated && !hasStoredAuth) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div>Please log in to access bracket management</div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {/* Bracket Generation Modal */}
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

      {/* Bracket content */}      <div style={{ 
        padding: isMobile ? '0.5rem' : '1rem',
        fontFamily: 'Inter, sans-serif',
        position: 'relative'
      }}>
        {/* No Tournament Loaded State */}
        {!selectedTournament && !isInitializing ? (
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '20px',
            padding: isMobile ? '40px 24px' : '60px 40px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
            border: '2px solid #e2e8f0',
            margin: isMobile ? '20px 0' : '40px auto',
            maxWidth: '800px'
          }}>
            <h2 style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '12px',
              letterSpacing: '-0.02em',
              marginTop: '24px'
            }}>
              No Tournament Loaded
            </h2>
            <p style={{
              fontSize: isMobile ? '15px' : '16px',
              color: '#64748b',
              marginBottom: '32px',
              maxWidth: '560px',
              margin: '0 auto 32px',
              lineHeight: '1.6'
            }}>
              Load a tournament from the dashboard to generate and manage brackets. Once loaded, you'll be able to create brackets, track matches, and manage tournament progress.
            </p>
            <a 
              href="/dashboard"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #F47C20 0%, #D9651A 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: isMobile ? '12px 24px' : '14px 28px',
                fontSize: isMobile ? '15px' : '16px',
                fontWeight: '600',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(244, 124, 32, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(240, 165, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(240, 165, 0, 0.3)';
              }}
            >
              Go to Dashboard
            </a>
            
            {/* Info Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginTop: '48px',
              maxWidth: '800px',
              margin: '48px auto 0'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'left',
                border: '1px solid #e2e8f0',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                  Generate Brackets
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                  Automatically create single or double elimination brackets from your player list
                </p>
              </div>
              
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'left',
                border: '1px solid #e2e8f0',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                  Track Matches
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                  View match-ups, update winners, and follow tournament progress in real-time
                </p>
              </div>
              
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'left',
                border: '1px solid #e2e8f0',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                  Multiple Views
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                  Separate scratch and handicap brackets, with mobile-friendly navigation
                </p>
              </div>
            </div>
          </div>
        ) : (
        /* Show empty state if no brackets */
        (() => {
          const hasLoadedBrackets = !!loadedBrackets
          const hasRounds = !!rounds
          const roundsLength = rounds?.length || 0
          const showEmpty = !hasLoadedBrackets || !hasRounds || roundsLength === 0
          
          return showEmpty
        })() ? (
          <EmptyBracketState
            onGenerateClick={handleGenerateBrackets}
            showDemo={true}
          />
        ) : (
          <>
            {/* Bracket Tabs */}
            <BracketTabs
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab)
                setSelectedBracketIndex(0) // Reset to first bracket when switching tabs
              }}
              scratchCount={(loadedBrackets.scratch_brackets || loadedBrackets.multiple_brackets?.scratch_brackets)?.length || 0}
              handicapCount={(loadedBrackets.handicap_brackets || loadedBrackets.multiple_brackets?.handicap_brackets)?.length || 0}
            />

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
            />

            {/* Bracket Stats Panel */}
            {filteredBrackets.length > 0 && rounds.length > 0 && (
              <Suspense fallback={<div style={{ padding: '1rem', textAlign: 'center' }}>Loading stats...</div>}>
                <BracketStatsPanel
                  rounds={rounds}
                  bracketType={activeTab === 'all' ? 'scratch' : activeTab}
                  totalPlayers={loadedBrackets?.bracket_size || loadedBrackets?.size || 8}
                  lastUpdated={null}
                />
              </Suspense>
            )}

            {/* Bracket Selector - Navigate between individual brackets */}
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
                sum + round.matches.filter(m => m.winner).length, 0)
              const progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
              
              // Get bracket type
              const bracketType = activeTab === 'all' 
                ? (scratchBrackets.length > 0 ? 'Scratch' : 'Handicap')
                : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
              
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.5rem',
                  padding: '1.25rem 1.5rem',
                  background: gradients.grayLight,
                  borderRadius: '12px',
                  marginBottom: '1rem',
                  boxShadow: shadows.md,
                  border: `1px solid ${rgba(colors.white, 0.8)}`,
                  position: 'relative',
                  overflow: 'hidden',
                  maxWidth: '900px',
                  margin: '0 auto 1rem auto'
                }}>
                  {/* Gradient accent bar */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: gradients.rainbow,
                    backgroundSize: '200% 100%',
                    animation: 'gradientShift 3s ease infinite'
                  }} />
                  
                  {/* Previous Button */}
                  <button
                    onClick={() => setSelectedBracketIndex(Math.max(0, selectedBracketIndex - 1))}
                    disabled={selectedBracketIndex === 0}
                    style={{
                      padding: '0.75rem 1.25rem',
                      background: selectedBracketIndex === 0 
                        ? gradients.gray
                        : gradients.blue,
                      color: selectedBracketIndex === 0 ? colors.gray[400] : colors.white,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: selectedBracketIndex === 0 ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9375rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: selectedBracketIndex === 0 
                        ? 'none' 
                        : shadows.blue.sm
                    }}
                    onMouseEnter={(e) => {
                      if (selectedBracketIndex !== 0) {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                        e.currentTarget.style.boxShadow = shadows.blue.md
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedBracketIndex !== 0) {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = shadows.blue.sm
                      }
                    }}
                  >
                    <span style={{ fontSize: '1.125rem' }}>←</span>
                    <span>Previous</span>
                  </button>
                  
                  {/* Center Info Section */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minWidth: 0
                  }}>
                    {/* Bracket Title Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}>
                      <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: semantic.text.primary,
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{
                          background: `linear-gradient(135deg, ${colors.blue.primary} 0%, ${colors.purple.primary} 100%)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text'
                        }}>
                          Bracket {selectedBracketIndex + 1}
                        </span>
                        <span style={{ color: colors.gray[400], fontWeight: '400' }}>of</span>
                        <span style={{ color: colors.gray[500] }}>{totalBrackets}</span>
                      </h3>
                      
                      {/* Bracket Type Badge */}
                      <div style={{
                        padding: '0.375rem 0.875rem',
                        background: bracketType === 'Scratch'
                          ? gradients.blueLight
                          : gradients.yellowLight,
                        color: bracketType === 'Scratch' ? semantic.badge.scratch.text : semantic.badge.handicap.text,
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        border: `1px solid ${bracketType === 'Scratch' ? semantic.badge.scratch.border : semantic.badge.handicap.border}`
                      }}>
                        {bracketType}
                      </div>
                      
                      {/* Progress Badge */}
                      <div style={{
                        padding: '0.375rem 0.875rem',
                        background: progressPercent === 100
                          ? gradients.green
                          : gradients.gray,
                        color: progressPercent === 100 ? semantic.badge.complete.text : semantic.text.tertiary,
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        border: `1px solid ${progressPercent === 100 ? semantic.badge.complete.border : semantic.border.medium}`
                      }}>
                        {completedMatches}/{totalMatches} Complete
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: `linear-gradient(90deg, ${colors.gray[200]} 0%, ${colors.gray[100]} 100%)`,
                      borderRadius: '4px',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: shadows.inset
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: progressPercent === 100
                          ? gradients.greenProgress
                          : `linear-gradient(90deg, ${colors.blue.primary} 0%, ${colors.purple.primary} 50%, ${colors.pink.primary} 100%)`,
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: `0 0 8px ${rgba(colors.blue.primary, 0.4)}`,
                        position: 'relative'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '50%',
                          background: `linear-gradient(180deg, ${rgba(colors.white, 0.3)}, transparent)`,
                          pointerEvents: 'none'
                        }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Next Button */}
                  <button
                    onClick={() => setSelectedBracketIndex(Math.min(totalBrackets - 1, selectedBracketIndex + 1))}
                    disabled={selectedBracketIndex >= totalBrackets - 1}
                    style={{
                      padding: '0.75rem 1.25rem',
                      background: selectedBracketIndex >= totalBrackets - 1
                        ? gradients.gray
                        : gradients.blue,
                      color: selectedBracketIndex >= totalBrackets - 1 ? colors.gray[400] : colors.white,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: selectedBracketIndex >= totalBrackets - 1 ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9375rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: selectedBracketIndex >= totalBrackets - 1
                        ? 'none'
                        : shadows.blue.sm
                    }}
                    onMouseEnter={(e) => {
                      if (selectedBracketIndex < totalBrackets - 1) {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                        e.currentTarget.style.boxShadow = shadows.blue.md
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedBracketIndex < totalBrackets - 1) {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = shadows.blue.sm
                      }
                    }}
                  >
                    <span>Next</span>
                    <span style={{ fontSize: '1.125rem' }}>→</span>
                  </button>
                </div>
              )
            })()}

            {/* Bracket Display */}
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
                />
              )
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '3rem',
                color: colors.gray[500]
              }}>
                <p>No matches found for the selected filters.</p>
              </div>
            )}
          </>
        )
        )}
      </div>

      {/* Explain Brackets Modal */}
      <ExplainBracketsModal 
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
      />
    </ErrorBoundary>
  )
}