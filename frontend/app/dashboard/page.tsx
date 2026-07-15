"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament, Squad, BracketSettings, TournamentForm, SidePotsSettings, SidePot, Player, DashboardTournamentBootstrapResponse } from '../lib/types';

import { useAuth } from '../lib/auth-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getErrorMessage, getErrorContext } from '../lib/error-utils';
import { storage } from '../lib/storage';
import { BRACKET_SETTINGS_AUTOSAVE_DELAY_MS, getSidePotsStorageKey } from '../lib/dashboard-settings';
import mobileStyles from './dashboard.module.css';
import cardStyles from '../styles/cards.module.css';
import shellStyles from '../styles/page-shell.module.css';
import buttonStyles from '../styles/buttons.module.css';
import { ConfirmationDialog } from '../components/LazyComponents';
import { API, apiClient, apiFetch } from '../lib/api';
import { logger } from '../lib/logger';
import { defaultBracketPrograms, getBracketProgramLabel, normalizeBracketPrograms, summarizeEntries } from '../lib/bracketPrograms';
import EnhancedButton from '../components/EnhancedButton';
import { useToast } from '../components/Toast';
import { usePagination } from '../components/Performance';
import { Select } from '../components/UI';
import ShareQRModal from '../components/ShareQRModal';
import ActionConfirmDialog from '../components/ActionConfirmDialog';
import NoTournamentState from '../components/NoTournamentState';
import {
  clearSelectedTournament,
  notifySettingsChanged,
  setActiveSquadLabel,
  setSelectedSquad,
  setSelectedTournament,
} from '../lib/selection-session';
import CloseControl from '../../components/CloseControl';
import ExplainDashboardModal from './ExplainDashboardModal';
import { TournamentSettingsContent } from './settings/TournamentSettingsContent';
import { setBodyInteractionState } from '../utils/modalUtils';
import { formatIsoDateFull, formatIsoDateLong } from '../lib/formatters';
import { EditTournamentModal } from './components/EditTournamentModal';
import { normalizeSquadTimes } from './utils/tournamentForm';
import { createDefaultSidePots, hydrateStoredSidePots } from './utils/sidePots';
import { useTournamentOrchestration } from './hooks/useTournamentOrchestration';
import {
  applyAutoHouse,
  calculateHouseAmount,
  createDefaultBracketSettings,
  normalizeLoadedBracketSettings,
  validateBracketSettingsSplit,
} from './utils/bracketSettings';

const getErrorDetail = async (response: Response): Promise<string | null> => {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      return typeof detail === 'string' ? detail : null;
    }
  } catch {
    return null;
  }
  return null;
};

type DashboardCardKey = 'squadSelection' | 'bracketSettings' | 'byeSettings' | 'optionalBrackets' | 'sidePots';

const collapsedMobileCards: Record<DashboardCardKey, boolean> = {
  squadSelection: false,
  bracketSettings: false,
  byeSettings: false,
  optionalBrackets: false,
  sidePots: false,
};

const expandedDesktopCards: Record<DashboardCardKey, boolean> = {
  squadSelection: true,
  bracketSettings: true,
  byeSettings: true,
  optionalBrackets: true,
  sidePots: true,
};

export default function TournamentDashboard() {
  // Authentication check - must be at the top
  const { isUserAuthenticated, isAuthInitialized } = useAuth();
  const [showDashboard, setShowDashboard] = useState(false);

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuthTokens = typeof window !== 'undefined' && 
    storage.getItem('token') && 
    storage.getItem('user_id');

  // All hooks must be called before conditional returns (React rules of hooks)
  const [isAdmin, setIsAdmin] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<DashboardTournamentBootstrapResponse['workflow_status']>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadEntryCounts, setSquadEntryCounts] = useState<Record<number, number>>({});
  const [summaryPlayers, setSummaryPlayers] = useState<Player[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [optionalToggleConfirm, setOptionalToggleConfirm] = useState<{ programKey: string; programName: string; existingEntries: number } | null>(null);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [squadModalOpen, setSquadModalOpen] = useState(false);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: number, name: string} | null>(null);
  const [shareQROpen, setShareQROpen] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [scoreProgress, setScoreProgress] = useState({ completed: 0, entered: 0, total: 0, percent: 0, loading: false });
  
  // Enhanced UX components
  const { addToast } = useToast();
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination({ 
    items: allTournaments, 
    itemsPerPage: 10 
  });


  
  // Bracket settings state
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>({
    ...createDefaultBracketSettings(),
  });
  const [savingBracketSettings, setSavingBracketSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  const lastPrizeValidationKeyRef = useRef<string>('');
  // Always holds the latest bracketSettings so async callbacks aren't stale
  const bracketSettingsRef = useRef<BracketSettings>(bracketSettings);

  // Side pots state
  const [sidePots, setSidePots] = useState<SidePotsSettings>(createDefaultSidePots());

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<DashboardCardKey, boolean>>(expandedDesktopCards);

  const toggleCard = (cardKey: DashboardCardKey) => {
    if (!isMobile) return;
    setExpandedCards(previous => ({ ...previous, [cardKey]: !previous[cardKey] }));
  };

  const isCardExpanded = (cardKey: DashboardCardKey) => !isMobile || expandedCards[cardKey];

  // Keep ref in sync so timeout callbacks always read the latest settings
  useEffect(() => {
    bracketSettingsRef.current = bracketSettings;
  }, [bracketSettings]);

  useEffect(() => {
    setExpandedCards(isMobile ? collapsedMobileCards : expandedDesktopCards);
  }, [isMobile, tournament?.id]);

  const computedHouseAmount = useMemo(() => calculateHouseAmount(bracketSettings), [
    bracketSettings,
  ]);

  // Track when component is mounted to prevent premature auto-saves
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const showBracketSettingsSaveProblem = useCallback((message: string) => {
    setSaveStatus('error');
    setConfirmMsg(message);
    setConfirmOpen(true);
  }, []);

  // Save bracket settings
  const saveBracketSettings = async () => {
    // Prevent save if not mounted or missing tournament
    if (!isMountedRef.current || !tournament?.id) {
      if (tournament?.id) {
        showBracketSettingsSaveProblem('Please load a tournament first before saving bracket settings.');
      }
      return;
    }
    
    const token = storage.getItem('token');
    if (!token) {
      showBracketSettingsSaveProblem('Please log in to save bracket settings.');
      return;
    }

    setSavingBracketSettings(true);
    setSaveStatus('saving');
    const latestSettings = bracketSettingsRef.current;

    const splitValidation = validateBracketSettingsSplit(latestSettings);
    if (!splitValidation.ok) {
      setSaveStatus('error');
      const validationKey = splitValidation.validationKey ?? '';
      if (!validationKey || lastPrizeValidationKeyRef.current !== validationKey) {
        addToast({
          type: 'warning',
          message: splitValidation.message,
          duration: 6000
        });
      }
      lastPrizeValidationKeyRef.current = validationKey;
      return;
    }
    lastPrizeValidationKeyRef.current = '';

    const normalizedPrograms = normalizeBracketPrograms(latestSettings.bracket_programs, Number(latestSettings.default_entry_fee ?? 0))
    const houseAmount = splitValidation.houseAmount;

    try {
      const payload = {
        ...latestSettings,
        bracket_programs: normalizedPrograms,
        house_fee_amount: houseAmount,
        tournament_id: tournament.id
      };

      let data: BracketSettings;
      try {
        data = await apiClient.post<BracketSettings>('/api/v1/bracket-settings', payload);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const isNotFound = message.includes('404') || message.includes('not found');
        if (!isNotFound) {
          throw error;
        }

        data = await apiClient.post<BracketSettings>('/api/v1/bracket-settings/', payload);
      }
      
      // Check if it was a create or update operation
      const isUpdate = data.id && latestSettings.id;
      const message = isUpdate 
        ? 'Bracket settings updated successfully!' 
        : 'Bracket settings saved successfully!';
      
      addToast({
        type: 'success',
        message,
        duration: 4000
      });
      
      // Update local state with the returned data (includes ID for new records)
      // Merge rather than replace to preserve frontend-only fields (e.g. allow_byes)
      // that the backend may not echo back yet
      setBracketSettings(prev => applyAutoHouse(prev, {
        ...data,
        bracket_programs: normalizeBracketPrograms(data.bracket_programs, data.default_entry_fee),
      }));
      
      // Clear cache for bracket settings to ensure fresh data on reload
      apiClient.clearCacheEntry(`/api/v1/bracket-settings/${tournament.id}`);
      notifySettingsChanged();
      
      setSaveStatus('saved');
      setLastSavedTime(new Date());
    } catch (error) {
      logger.error('Failed to save bracket settings', { error });
      setSaveStatus('error');
      const message = getErrorMessage(error) || 'Failed to save bracket settings. Please review your values and try again.';
      addToast({
        type: 'error',
        message,
        duration: 7000
      });
    } finally {
      setSavingBracketSettings(false);
    }
  };

  const saveBracketSettingsImmediately = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    void saveBracketSettings();
  };

  // Auto-save with debounce
  const autoSaveBracketSettings = () => {
    // Don't auto-save if component isn't mounted or no tournament selected
    if (!isMountedRef.current || !tournament?.id) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Mark as unsaved
    setSaveStatus('unsaved');
    
    // Keep autosave responsive while still coalescing rapid edits.
    saveTimeoutRef.current = setTimeout(() => {
      saveBracketSettings();
    }, BRACKET_SETTINGS_AUTOSAVE_DELAY_MS);
  };

  const updateBracketSettings = (
    updater: (previous: BracketSettings) => BracketSettings,
    saveMode: 'none' | 'debounced' | 'immediate' = 'debounced',
  ) => {
    const next = updater(bracketSettingsRef.current);
    bracketSettingsRef.current = next;
    setBracketSettings(next);

    if (saveMode === 'immediate') {
      saveBracketSettingsImmediately();
    } else if (saveMode === 'debounced') {
      autoSaveBracketSettings();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const fetchBracketSettingsData = async (tournamentId: number): Promise<BracketSettings> => {
    const token = storage.getItem('token');
    if (!token) {
      return createDefaultBracketSettings(tournamentId);
    }

    try {
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`, false);
      if (settings) {
        return normalizeLoadedBracketSettings(settings, tournamentId);
      }
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('404')) {
        logger.warn('No bracket settings found for tournament', { tournamentId });
      } else {
        logger.error('Error loading bracket settings', getErrorContext(error));
      }
    }

    return createDefaultBracketSettings(tournamentId);
  };

  // Load bracket settings
  const loadBracketSettings = async (tournamentId: number) => {
    const loaded = await fetchBracketSettingsData(tournamentId);
    setBracketSettings(prev => applyAutoHouse(prev, loaded));
  };

  const loadSidePots = useCallback((tournamentId: number) => {
    try {
      const stored = storage.getItem(getSidePotsStorageKey(tournamentId));
      if (stored) {
        const merged = hydrateStoredSidePots(stored, tournamentId);
        setSidePots(merged);
        storage.setItem(getSidePotsStorageKey(tournamentId), JSON.stringify(merged));
      } else {
        setSidePots(createDefaultSidePots(tournamentId));
      }
    } catch {
      setSidePots(createDefaultSidePots(tournamentId));
    }
  }, []);

  const saveSidePots = (next: SidePotsSettings) => {
    storage.setItem(getSidePotsStorageKey(next.tournament_id), JSON.stringify(next));
    notifySettingsChanged();
  };

  const loadSquadEntryCounts = useCallback(async (tournamentId: number, squadList: Squad[]) => {
    const token = storage.getItem('token');
    if (!token || !tournamentId) {
      setSquadEntryCounts({});
      setSummaryPlayers([]);
      return;
    }

    const counts: Record<number, number> = {};
    const aggregatedPlayers: Player[] = [];
    squadList.forEach(squad => {
      counts[squad.id] = 0;
    });

    const limit = 500;
    let offset = 0;

    try {
      while (true) {
        const params = new URLSearchParams({
          tournament_id: String(tournamentId),
          limit: String(limit),
          offset: String(offset),
        });

        const response = await apiFetch(API(`/api/v1/bowlers?${params.toString()}`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load bowlers for tournament ${tournamentId}`);
        }

        const bowlers = await response.json() as Array<{
          id: number;
          full_name?: string;
          average?: number | null;
          division?: string | null;
          squad_id?: number | null;
          amount_paid?: number;
          total_cost?: number;
          program_entry_counts?: Record<string, number> | null;
        }>;
        bowlers.forEach(bowler => {
          if (typeof bowler.squad_id === 'number') {
            counts[bowler.squad_id] = (counts[bowler.squad_id] ?? 0) + 1;
          }

          const normalizedName = (bowler.full_name || '').trim();
          const [firstName, ...lastNameParts] = normalizedName.length > 0
            ? normalizedName.split(/\s+/)
            : ['', ''];

          aggregatedPlayers.push({
            id: bowler.id,
            firstName: firstName || '',
            lastName: lastNameParts.join(' ') || '',
            average: Number(bowler.average ?? 0),
            division: bowler.division || 'Open',
            amountPaid: Number(bowler.amount_paid ?? 0),
            totalCost: Number(bowler.total_cost ?? 0),
            programEntryCounts: bowler.program_entry_counts ?? {},
            squad: typeof bowler.squad_id === 'number'
              ? ({ id: bowler.squad_id, date: '', time: '' } as Squad)
              : undefined,
          });
        });

        if (bowlers.length < limit) break;
        offset += limit;
      }

      setSquadEntryCounts(counts);
      setSummaryPlayers(aggregatedPlayers);
    } catch (error) {
      logger.error('Failed to load squad entry counts', { tournamentId, error: getErrorContext(error) });
      setSquadEntryCounts(counts);
      setSummaryPlayers([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSettingsChanged = () => {
      const tournamentId = tournament?.id;
      if (!tournamentId) {
        return;
      }

      void loadBracketSettings(tournamentId);
      loadSidePots(tournamentId);
      void loadSquadEntryCounts(tournamentId, squads);
    };

    window.addEventListener('settings-changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('settings-changed', handleSettingsChanged);
    };
  }, [loadSidePots, loadSquadEntryCounts, loadBracketSettings, squads, tournament?.id]);

  const { handleLoadTournament, handleUnloadTournament: unloadTournament } = useTournamentOrchestration({
    tournament,
    addToast,
    setTournament,
    setWorkflowStatus,
    setSquads,
    setSelectedSquadId,
    setSquadEntryCounts,
    setSummaryPlayers,
    setBracketSettings,
    setSidePots,
    setLoadModalOpen,
    loadSidePots,
    loadSquadEntryCounts,
  });

  const updateSidePot = (key: string, patch: Partial<SidePot>) => {
    setSidePots(prev => {
      const next: SidePotsSettings = {
        ...prev,
        pots: prev.pots.map(p => p.key === key ? { ...p, ...patch } : p),
      };
      saveSidePots(next);
      return next;
    });
  };

  const getOptionalBracketEntryCount = async (programKey: string) => {
    if (!tournament?.id) return 0;

    const token = storage.getItem('token');
    if (!token) return 0;

    const normalizedKey = programKey.trim().toLowerCase();
    const limit = 500;
    let offset = 0;
    let totalEntries = 0;

    while (true) {
      const params = new URLSearchParams({
        tournament_id: String(tournament.id),
        limit: String(limit),
        offset: String(offset),
      });

      const response = await apiFetch(API(`/api/v1/bowlers?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Unable to check existing ${programKey} entries.`);
      }

      const bowlers = await response.json() as Array<{ program_entry_counts?: Record<string, number> | null }>;
      totalEntries += bowlers.reduce((sum, bowler) => sum + Number(bowler.program_entry_counts?.[normalizedKey] || 0), 0);

      if (bowlers.length < limit) {
        break;
      }

      offset += limit;
    }

    return totalEntries;
  };

  const updateBracketProgram = (index: number, patch: Partial<NonNullable<BracketSettings['bracket_programs']>[number]>) => {
    updateBracketSettings(previous => ({
      ...previous,
      bracket_programs: normalizeBracketPrograms(
        (previous.bracket_programs || defaultBracketPrograms).map((program, programIndex) =>
          programIndex === index ? { ...program, ...patch } : program
        ),
        previous.default_entry_fee,
      ),
    }), 'immediate');
  };

  const applyOptionalBracketToggle = (programKey: string, enabled: boolean) => {
    updateBracketSettings(previous => {
      const normalizedPrograms = normalizeBracketPrograms(previous.bracket_programs, previous.default_entry_fee);
      const nextPrograms = normalizedPrograms.map(program =>
        program.key === programKey
          ? { ...program, enabled, ...(enabled ? {} : { allow_byes: false }) }
          : program
      );

      const nextAllowByes = nextPrograms.some(program => {
        const isAlwaysVisible = program.key === 'handicap' || program.key === 'scratch';
        return Boolean(program.allow_byes) && (isAlwaysVisible || Boolean(program.enabled));
      });

      return {
        ...previous,
        bracket_programs: nextPrograms,
        allow_byes: nextAllowByes,
      };
    }, 'immediate');
  };

  const handleOptionalBracketToggle = async (programKey: string, enabled: boolean) => {
    const programIndex = normalizeBracketPrograms(
      bracketSettings.bracket_programs,
      bracketSettings.default_entry_fee,
    ).findIndex(existingProgram => existingProgram.key === programKey);

    if (programIndex < 0) {
      return;
    }

    if (!enabled) {
      try {
        const existingEntries = await getOptionalBracketEntryCount(programKey);
        if (existingEntries > 0) {
          const programName = normalizeBracketPrograms(
            bracketSettings.bracket_programs,
            bracketSettings.default_entry_fee,
          ).find(existingProgram => existingProgram.key === programKey)?.name || programKey;

          setOptionalToggleConfirm({ programKey, programName, existingEntries });
          return;
        }
      } catch (error) {
        logger.error('Failed to verify existing optional bracket entries', { programKey, error: getErrorContext(error) });
        addToast({
          type: 'error',
          message: `Couldn't verify existing ${programKey} entries. Try again.`,
          duration: 4000,
        });
        return;
      }
    }

    applyOptionalBracketToggle(programKey, enabled);
  };

  const handleByeProgramToggle = (programKey: string, allowByes: boolean) => {
    updateBracketSettings(previous => {
      const normalizedPrograms = normalizeBracketPrograms(previous.bracket_programs, previous.default_entry_fee)
      const nextPrograms = normalizedPrograms.map(program =>
        program.key === programKey ? { ...program, allow_byes: allowByes } : program
      )

      const nextAllowByes = nextPrograms.some(program => {
        const isAlwaysVisible = program.key === 'handicap' || program.key === 'scratch'
        return Boolean(program.allow_byes) && (isAlwaysVisible || Boolean(program.enabled))
      })

      return {
        ...previous,
        bracket_programs: nextPrograms,
        allow_byes: nextAllowByes,
      }
    }, 'immediate')
  }
  // Lock body scroll when no tournament is loaded
  useEffect(() => {
    if (!tournament) {
      setBodyInteractionState({ scrollLocked: true, touchLocked: false })
    } else {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false })
    }
    return () => {
      setBodyInteractionState({ scrollLocked: false, touchLocked: false })
    }
  }, [tournament])

  // Fallback: if auth isn't initialized after 3 seconds but we have tokens, show dashboard
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isAuthInitialized && hasStoredAuthTokens) {
        setShowDashboard(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthInitialized, hasStoredAuthTokens]);

  // Read admin flag once on mount for tournament listing scope
  useEffect(() => {
    const adminFlag = storage.getItem('is_admin');
    setIsAdmin(adminFlag === '1' || adminFlag === 'true');
  }, []);

  // Fetch tournaments when load modal opens
  useEffect(() => {
    if (!loadModalOpen) return;

    const runFetch = async () => {
      const path = isAdmin ? '/api/v1/tournaments/?all=1' : '/api/v1/tournaments/';
      try {
        const data = await apiClient.get<Tournament[]>(path);
        setAllTournaments(data);
        addToast({
          type: 'success',
          message: `Loaded ${data.length} tournaments`,
          duration: 3000
        });
      } catch (error) {
        logger.warn('Tournament fetch failed', error);
        addToast({
          type: 'error',
          message: 'Failed to load tournaments. Please try again.',
          duration: 5000
        });
      }
    };

    void runFetch();
  }, [addToast, isAdmin, loadModalOpen]);

  // Mobile detection (phone only - tablets get desktop experience)
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 480);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleUnloadTournament = () => {
    unloadTournament();
    setSettingsModalOpen(false);
    setSquadModalOpen(false);
  };

  const handleChangeTournament = () => {
    setLoadModalOpen(true);
  };

  const handleOpenSquadSelector = () => {
    if (squads.length === 0) {
      addToast({
        type: 'warning',
        message: 'No squads are available for this tournament yet.',
        duration: 4000,
      });
      return;
    }
    setSquadModalOpen(true);
  };

  const handleSelectSquad = (squad: Squad) => {
    const label = [squad.date, squad.time].filter(Boolean).join(' ');
    setSelectedSquadId(squad.id);
    setSelectedSquad(squad.id);
    setActiveSquadLabel(label);
    setSquadModalOpen(false);
    addToast({
      type: 'success',
      message: label ? `Active squad changed to ${label}` : 'Active squad changed',
      duration: 3000,
    });
  };

  // Delete selected tournament with enhanced UX feedback
  const handleDeleteTournament = async (id: number) => {
    try {
      const deletedTournament = allTournaments.find(t => t.id === id);
      await apiClient.delete(`/api/v1/tournaments/${id}`);
      
      setAllTournaments(allTournaments.filter(t => t.id !== id));
      setDeleteConfirm(null);

      if (tournament?.id === id) {
        setTournament(null);
        setWorkflowStatus(null);
        setSquads([]);
        setSquadEntryCounts({});
        setSelectedSquadId(null);
        setBracketSettings(createDefaultBracketSettings());
        setSidePots(createDefaultSidePots());
        clearSelectedTournament({ clearSquad: true });
      }

      addToast({
        type: 'success',
        message: `Tournament "${deletedTournament?.name || id}" deleted successfully!`,
        duration: 4000
      });
    } catch (error: unknown) {
      logger.error('Tournament delete failed', getErrorContext(error));
      addToast({
        type: 'error',
        message: getErrorMessage(error) || 'Failed to delete tournament. Please try again.',
        duration: 6000
      });
    }
  };

  // Save tournament handler with enhanced UX feedback
  const handleSave = async (tournamentFormData: TournamentForm) => {
    const token = storage.getItem('token');
    if (!token) {
      addToast({
        type: 'error',
        message: 'Please log in to save tournaments',
        duration: 5000
      });
      return;
    }

    const isOnlySquadTimesUpdate = !!tournament && !createMode && (() => {
      const original = {
        name: tournament.name || '',
        location: tournament.location || '',
        start_date: tournament.start_date || '',
        end_date: tournament.end_date || '',
      };
      const updated = {
        name: tournamentFormData.name || '',
        location: tournamentFormData.location || '',
        start_date: tournamentFormData.start_date || '',
        end_date: tournamentFormData.end_date || '',
      };

      return JSON.stringify(original) === JSON.stringify(updated)
        && JSON.stringify(normalizeSquadTimes(tournament.squad_times)) !== JSON.stringify(normalizeSquadTimes(tournamentFormData.squad_times));
    })();

    try {
      let savedTournament = tournament;
      if (createMode) {
        // Create new tournament
        const res = await apiFetch(API('/api/v1/tournaments/'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(tournamentFormData)
        });
        if (res.ok) {
          savedTournament = await res.json();
          setTournament(savedTournament);
          setWorkflowStatus(null);
          // Auto-load the newly created tournament
          if (savedTournament) {
            setSelectedTournament(savedTournament.id, savedTournament.name);
            loadBracketSettings(savedTournament.id);
            loadSidePots(savedTournament.id);
          }
          addToast({
            type: 'success',
            message: `Tournament "${tournamentFormData.name}" created successfully!`,
            duration: 4000
          });
        } else {
          const detail = await getErrorDetail(res);
          throw new Error(detail || `Failed to create tournament: ${res.status}`);
        }
      } else if (tournament) {
        // Update existing tournament
        const res = await apiFetch(API(`/api/v1/tournaments/${tournament.id}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(tournamentFormData)
        });
        if (res.ok) {
          savedTournament = await res.json();
          setTournament(savedTournament);
          if (savedTournament) {
            setSelectedTournament(savedTournament.id, savedTournament.name);
          }
          if (!isOnlySquadTimesUpdate) {
            addToast({
              type: 'success',
              message: `Tournament "${tournamentFormData.name}" updated successfully!`,
              duration: 4000
            });
          }
        } else {
          const detail = await getErrorDetail(res);
          throw new Error(detail || `Failed to update tournament: ${res.status}`);
        }
      }

      // Sync squad times to database using the new sync endpoint
      if (savedTournament) {
        try {
          const syncRes = await apiFetch(API(`/api/v1/squads/sync/${savedTournament.id}`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ squad_times: tournamentFormData.squad_times })
          });
          
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            logger.info('Squad sync completed', { syncData });
            
            // Show sync results in toast
            if (syncData.created_count > 0 || syncData.deleted_count > 0) {
              let message = `Squad sync: ${syncData.created_count} created, ${syncData.deleted_count} removed`;
              if (syncData.errors && syncData.errors.length > 0) {
                message += ` (${syncData.errors.length} errors)`;
              }
              
              addToast({
                type: syncData.errors && syncData.errors.length > 0 ? 'warning' : 'success',
                message,
                duration: 4000
              });
              
              // Log detailed errors for debugging
              if (syncData.errors) {
                logger.warn('Squad sync errors:', syncData.errors);
              }
            }
          } else {
            const detail = await getErrorDetail(syncRes);
            logger.warn('Squad sync failed', { status: syncRes.status, detail });
            addToast({
              type: 'warning',
              message: `Squad sync failed: ${detail || 'Unknown error'}. Please refresh the page.`,
              duration: 6000
            });
          }
        } catch (syncError) {
          logger.error('Squad sync error:', syncError);
          addToast({
            type: 'warning',
            message: 'Tournament saved but squad sync encountered an error. Please refresh the page.',
            duration: 6000
          });
        }
        
        // Reload squads after sync
        try {
          const squadRes = await apiFetch(API(`/api/v1/squads/?tournament_id=${savedTournament.id}`), {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          });
          if (squadRes.ok) {
            const squadData = await squadRes.json();
            setSquads(squadData);
            void loadSquadEntryCounts(savedTournament.id, squadData);
          }
        } catch (squadError) {
          logger.error('Failed to reload squads:', squadError);
        }
      }

      setModalOpen(false);
      setCreateMode(false);
    } catch (error: unknown) {
      logger.error('Tournament save failed', getErrorContext(error));
      addToast({
        type: 'error',
        message: getErrorMessage(error) || 'Failed to save tournament. Please try again.',
        duration: 6000
      });
    }
  };

  const router = useRouter();
  const selectedSquad = squads.find(s => s.id === selectedSquadId);
  const enabledSidePotsCount = sidePots.pots.filter(pot => pot.enabled).length;
  const loadedEntries = summaryPlayers.length > 0 ? summaryPlayers.length : (tournament?.entry_count ?? 0);
  const hasLivePlayerData = summaryPlayers.length > 0;
  const isSquadDataSyncing = squads.length > 0 && Object.keys(squadEntryCounts).length === 0;
  const isEntryDataSyncing = isSquadDataSyncing || (!hasLivePlayerData && loadedEntries > 0);
  const tournamentProjectedPayout = Math.max(0, bracketSettings.first_place_amount + bracketSettings.second_place_amount);
  const bracketEntriesForPayout = Math.max(0, Number(bracketSettings.bracket_size || 0));
  const grossCollected = Math.max(0, bracketEntriesForPayout * Number(bracketSettings.default_entry_fee || 0));
  const houseRetained = Math.max(0, Number(bracketSettings.house_fee_amount || 0));
  const normalizedPrograms = normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee);
  const enabledBracketProgramsForSummary = normalizedPrograms.filter(program =>
    program.key === 'handicap' || program.key === 'scratch' || Boolean(program.enabled)
  );
  const activeSquad = selectedSquad ?? squads[0] ?? null;
  const statsSummaryPlayers = useMemo(() => {
    if (selectedSquadId == null) return summaryPlayers;
    return summaryPlayers.filter(player => player.squad?.id === selectedSquadId);
  }, [summaryPlayers, selectedSquadId]);
  const statsEntrySummary = useMemo(() => summarizeEntries(
    statsSummaryPlayers,
    enabledBracketProgramsForSummary,
    bracketSettings.bracket_size,
    bracketSettings.default_entry_fee,
  ), [statsSummaryPlayers, enabledBracketProgramsForSummary, bracketSettings.bracket_size, bracketSettings.default_entry_fee]);
  const entrySummary = useMemo(() => summarizeEntries(
    summaryPlayers,
    enabledBracketProgramsForSummary,
    bracketSettings.bracket_size,
    bracketSettings.default_entry_fee,
  ), [summaryPlayers, enabledBracketProgramsForSummary, bracketSettings.bracket_size, bracketSettings.default_entry_fee]);
  const bracketsSold = entrySummary.totalEntries;
  const unpaidEntriesCount = summaryPlayers.filter(player => Number(player.totalCost || 0) - Number(player.amountPaid || 0) > 0.01).length;
  const missingAveragesCount = summaryPlayers.filter(player => Number(player.average || 0) <= 0).length;
  const duplicatePlayersCount = useMemo(() => {
    const nameCounts = new Map<string, number>();
    summaryPlayers.forEach(player => {
      const fallback = `player-${player.id}`;
      const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase() || fallback;
      nameCounts.set(fullName, (nameCounts.get(fullName) || 0) + 1);
    });
    return Array.from(nameCounts.values()).filter(count => count > 1).length;
  }, [summaryPlayers]);
  const hasGeneratedBrackets = workflowStatus?.has_generated_brackets ?? Boolean(tournament?.brackets_configured);
  const payoutsFinalized = workflowStatus?.payouts_finalized ?? false;
  const scoresLocked = workflowStatus?.scores_locked ?? payoutsFinalized;
  const payoutsNotFinalizedCount = loadedEntries > 0 && !payoutsFinalized ? 1 : 0;
  const bracketsNotGeneratedCount = hasGeneratedBrackets ? 0 : 1;
  const continueTournamentActions = [
    {
      key: 'enter-scores',
      label: 'Enter Scores',
      indicator: hasGeneratedBrackets && !scoresLocked ? '›' : 'Locked',
      onClick: () => {
        if (!hasGeneratedBrackets || scoresLocked) return;
        router.push('/scores');
      },
      disabled: !hasGeneratedBrackets || scoresLocked,
      accent: false,
    },
    {
      key: 'add-player',
      label: 'Add Player',
      indicator: '›',
      onClick: () => router.push('/players'),
      disabled: false,
      accent: false,
    },
    {
      key: 'view-payouts',
      label: 'View Payouts',
      indicator: '›',
      onClick: () => router.push('/payouts'),
      disabled: false,
      accent: false,
    },
  ];
  const contextPrimaryAction = useMemo(() => {
    if (loadedEntries <= 0) {
      return { key: 'add-player', label: 'Add Players', onClick: () => router.push('/players'), disabled: false };
    }

    if (!hasGeneratedBrackets) {
      return { key: 'generate-brackets', label: 'Generate Brackets', onClick: () => router.push('/brackets'), disabled: false };
    }

    if (!scoresLocked && scoreProgress.percent < 100) {
      return { key: 'enter-scores', label: 'Enter Scores', onClick: () => router.push('/scores'), disabled: false };
    }

    return { key: 'view-payouts', label: 'View Payouts', onClick: () => router.push('/payouts'), disabled: false };
  }, [loadedEntries, hasGeneratedBrackets, scoresLocked, scoreProgress.percent, router]);

  const primaryContinueActionKey = contextPrimaryAction.key === 'generate-brackets' ? 'enter-scores' : contextPrimaryAction.key;

  const manageSetupActions = [
    {
      key: 'edit-tournament',
      label: 'Edit Tournament',
      onClick: () => {
        setCreateMode(false);
        setModalOpen(true);
      },
      disabled: false,
    },
    { key: 'tournament-settings', label: 'Tournament Settings', onClick: () => setSettingsModalOpen(true), disabled: false },
    { key: 'change-squad', label: 'Change Squad', onClick: handleOpenSquadSelector, disabled: squads.length === 0 },
  ];
  const moreActions = [
    {
      key: 'new-tournament',
      label: 'New Tournament',
      onClick: () => {
        setCreateMode(true);
        setModalOpen(true);
      },
      disabled: false,
      variant: 'default' as const,
    },
    {
      key: 'change-tournament',
      label: 'Change Tournament',
      onClick: () => {
        handleChangeTournament();
      },
      disabled: false,
      variant: 'default' as const,
    },
    {
      key: 'unload-tournament',
      label: 'Unload Tournament',
      onClick: () => {
        handleUnloadTournament();
      },
      disabled: false,
      variant: 'destructive' as const,
    },
  ];
  const activeSquadLabel = activeSquad ? [activeSquad.date, activeSquad.time].filter(Boolean).join(' ') : 'No squad selected';
  const dataIssuesCount = [
    missingAveragesCount > 0,
    unpaidEntriesCount > 0,
    duplicatePlayersCount > 0,
  ].filter(Boolean).length;
  const setupChecklist = [
    loadedEntries > 0,
    bracketSettings.bracket_size > 0,
    bracketsSold > 0,
    missingAveragesCount === 0,
    unpaidEntriesCount === 0,
  ];
  const setupIncomplete = setupChecklist.some(item => !item) || bracketsNotGeneratedCount > 0;
  const setupBlockers = [
    { label: 'missing averages', count: missingAveragesCount },
    { label: 'unpaid entries', count: unpaidEntriesCount },
    { label: 'duplicate players', count: duplicatePlayersCount },
  ].filter(item => item.count > 0);
  const hasSetupBlockers = setupBlockers.length > 0;
  const enabledOptionalPrograms = normalizedPrograms.filter(program =>
    Boolean(program.enabled) && program.key !== 'handicap' && program.key !== 'scratch'
  );
  const optionalProgramNames = enabledOptionalPrograms.map(program => program.name);
  const optionalProgramsSummary = optionalProgramNames.length === 0
    ? 'None enabled'
    : optionalProgramNames.length <= 2
      ? optionalProgramNames.join(' · ')
      : `${optionalProgramNames.slice(0, 2).join(' · ')} +${optionalProgramNames.length - 2} more`;
  const blockerSummary = setupBlockers.map(item => `${item.count} ${item.label}`).join(' | ');
  const usdFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    [],
  );
  const formatUsd = useCallback((amount: number) => usdFormatter.format(Math.max(0, Number(amount || 0))), [usdFormatter]);
  const bracketsGenerated = hasGeneratedBrackets === true;
  const payoutsCalculated = payoutsFinalized || scoresLocked;

  const scoreStatusLabel = useMemo(() => {
    if (scoreProgress.loading) return 'Checking...';
    if (scoresLocked) return 'Locked';
    if (scoreProgress.entered > 0) return 'In Progress';
    return 'None';
  }, [scoreProgress.entered, scoreProgress.loading, scoresLocked]);

  const bracketsStatusLabel = useMemo(() => {
    if (bracketsGenerated) return 'Generated';
    return loadedEntries > 0 ? 'Not Generated' : 'Pending';
  }, [bracketsGenerated, loadedEntries]);

  const payoutWorkflowStatusLabel = useMemo(() => {
    if (payoutsFinalized) return 'Finalized';
    if (!hasGeneratedBrackets) return 'Pending';
    if (scoreProgress.percent >= 100) return 'Ready for Payouts';
    return 'Pending';
  }, [payoutsFinalized, hasGeneratedBrackets, scoreProgress.percent]);

  const payoutStatusLabel = payoutWorkflowStatusLabel;
  const payoutsChipStatusLabel = payoutsCalculated ? 'Calculated' : 'Not Calculated';

  const statusNarrative = useMemo(() => {
    if (isEntryDataSyncing) {
      return {
        tone: 'info',
        icon: 'i',
        warningText: 'Live entry data is still syncing from squad rosters.',
        nextStepText: 'Wait for sync, then resolve setup blockers before generating brackets.',
      };
    }

    if (hasSetupBlockers) {
      return {
        tone: 'warning',
        icon: '!',
        warningText: `Setup blockers: ${blockerSummary}`,
        nextStepText: 'Clear blockers first, then generate brackets.',
      };
    }

    if (bracketsNotGeneratedCount > 0) {
      return {
        tone: 'info',
        icon: 'i',
        warningText: 'No setup blockers found. Brackets are ready to generate.',
        nextStepText: 'Generate brackets.',
      };
    }

    if (dataIssuesCount === 0 && !setupIncomplete) {
      return {
        tone: 'info',
        icon: 'i',
        warningText: 'Setup complete: tournament is ready for bracket generation.',
        nextStepText: 'Generate brackets and move to score entry when lanes are complete.',
      };
    }

    return {
      tone: 'info',
      icon: 'i',
      warningText: 'Review tournament setup details before generating brackets.',
      nextStepText: 'Review setup status and continue workflow.',
    };
  }, [isEntryDataSyncing, hasSetupBlockers, blockerSummary, bracketsNotGeneratedCount, dataIssuesCount, setupIncomplete]);
  const heroStatusChips = useMemo(() => ([
    {
      key: 'brackets',
      label: 'Brackets',
      value: bracketsStatusLabel,
      tone: bracketsStatusLabel === 'Generated' ? 'complete' : (loadedEntries > 0 ? 'active' : 'pending'),
    },
    {
      key: 'scores',
      label: 'Scores',
      value: scoreStatusLabel,
      tone: scoreStatusLabel === 'None'
        ? 'pending'
        : scoreStatusLabel === 'Locked'
          ? 'complete'
          : scoreStatusLabel === 'Checking...' || scoreStatusLabel === 'In Progress'
          ? 'active'
          : 'pending',
    },
    {
      key: 'payouts',
      label: 'Payouts',
      value: payoutsChipStatusLabel,
      tone: payoutsCalculated ? 'complete' : 'pending',
    },
  ]), [bracketsStatusLabel, loadedEntries, scoreStatusLabel, payoutsChipStatusLabel, payoutsCalculated]);
  const healthStripItems = useMemo(() => ([
    {
      key: 'averages',
      label: 'Missing Averages',
      value: missingAveragesCount,
      href: '/players',
    },
    {
      key: 'payments',
      label: 'Unpaid Entries',
      value: unpaidEntriesCount,
      href: '/players',
    },
    {
      key: 'bracket-status',
      label: 'Brackets',
      value: hasGeneratedBrackets ? 'Ready' : 'Not Generated',
      href: '/brackets',
    },
    {
      key: 'payout-status',
      label: 'Payouts',
      value: payoutsFinalized ? 'Finalized' : 'Pending',
      href: '/payouts',
    },
  ]), [missingAveragesCount, unpaidEntriesCount, hasGeneratedBrackets, payoutsFinalized]);
  const showHeroStatusStrip = statusNarrative.tone === 'warning' || isEntryDataSyncing;
  const orderedStatsProgramSummaries = useMemo(() => {
    const programOrder: Record<string, number> = {
      handicap: 0,
      scratch: 1,
      reverse_scratch: 2,
      womens_scratch: 3,
    };

    return [...statsEntrySummary.programSummaries].sort((a, b) => {
      const aOrder = programOrder[a.key] ?? Number.MAX_SAFE_INTEGER;
      const bOrder = programOrder[b.key] ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    });
  }, [statsEntrySummary.programSummaries]);

  const percentOfTotalEntries = useCallback((count: number) => {
    if (statsEntrySummary.totalEntries <= 0) return null;
    return `${Math.round((count / statsEntrySummary.totalEntries) * 100)}% of entries`;
  }, [statsEntrySummary.totalEntries]);

  const tournamentSummaryCards = useMemo<Array<{ key: string; label: string; value: string; helperPrimary?: string; helperSecondary?: string; accent?: boolean; href: string }>>(() => {
    const programCards = orderedStatsProgramSummaries.map(program => {
      const label = getBracketProgramLabel(program);

      return {
        key: `summary-${program.key}`,
        label,
        value: `${program.totalEntries}`,
        helperPrimary: percentOfTotalEntries(program.totalEntries) ?? undefined,
        href: '/players',
      };
    });

    return [
      {
        key: 'summary-total-entries',
        label: 'Total Entries',
        value: `${statsEntrySummary.totalEntries}`,
        helperPrimary: loadedEntries > 0 ? `${loadedEntries} players` : undefined,
        href: '/players',
      },
      {
        key: 'summary-entry-revenue',
        label: 'Entry Revenue',
        value: formatUsd(statsEntrySummary.totalRevenue),
        href: '/players',
      },
      ...programCards,
    ];
  }, [formatUsd, loadedEntries, orderedStatsProgramSummaries, percentOfTotalEntries, statsEntrySummary.totalEntries, statsEntrySummary.totalRevenue]);

  useEffect(() => {
    let isCancelled = false;

    const loadScoreProgress = async () => {
      const tournamentId = tournament?.id;
      if (!tournamentId) {
        if (!isCancelled) {
          setScoreProgress({ completed: 0, entered: 0, total: 0, percent: 0, loading: false });
        }
        return;
      }

      const token = storage.getItem('token');
      if (!token) {
        if (!isCancelled) {
          setScoreProgress({ completed: 0, entered: 0, total: Math.max(loadedEntries, statsSummaryPlayers.length), percent: 0, loading: false });
        }
        return;
      }

      if (!isCancelled) {
        setScoreProgress(previous => ({ ...previous, loading: true }));
      }

      try {
        const params = new URLSearchParams({ tournament_id: String(tournamentId) });
        if (selectedSquadId) {
          params.set('squad_id', String(selectedSquadId));
        }

        const response = await apiFetch(API(`/api/v1/scores/?${params.toString()}`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to load scores progress: ${response.status}`);
        }

        const rows = await response.json() as Array<{
          player_id: number;
          game1_scratch?: number | null;
          game2_scratch?: number | null;
          game3_scratch?: number | null;
        }>;

        const completed = rows.filter(row =>
          row.game1_scratch != null && row.game2_scratch != null && row.game3_scratch != null
        ).length;
        const entered = rows.filter(row =>
          row.game1_scratch != null || row.game2_scratch != null || row.game3_scratch != null
        ).length;
        const total = Math.max(statsSummaryPlayers.length, loadedEntries, rows.length);
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (!isCancelled) {
          setScoreProgress({ completed, entered, total, percent, loading: false });
        }
      } catch (error) {
        logger.warn('Dashboard score progress load failed', { error: getErrorContext(error) });
        if (!isCancelled) {
          const total = Math.max(statsSummaryPlayers.length, loadedEntries);
          setScoreProgress({ completed: 0, entered: 0, total, percent: 0, loading: false });
        }
      }
    };

    void loadScoreProgress();

    return () => {
      isCancelled = true;
    };
  }, [loadedEntries, selectedSquadId, statsSummaryPlayers.length, tournament?.id]);

  useEffect(() => {
    if (selectedSquadId !== null) {
      setSelectedSquad(selectedSquadId);
    }
  }, [selectedSquadId]);

  useEffect(() => {
    const label = selectedSquad ? [selectedSquad.date, selectedSquad.time].filter(Boolean).join(' ') : '';
    setActiveSquadLabel(label);
  }, [selectedSquad]);

  useEffect(() => {
    const handleNewTournament = () => {
      setCreateMode(true);
      setModalOpen(true);
    };

    window.addEventListener('bw:new-tournament', handleNewTournament as EventListener);
    return () => {
      window.removeEventListener('bw:new-tournament', handleNewTournament as EventListener);
    };
  }, []);

  // All hooks are declared above — conditional returns are safe below this line
  if (!isAuthInitialized && !showDashboard) {
    return (
      <div className={mobileStyles.loadingScreen}>
        <div className={mobileStyles.loadingContent}>Loading tournament dashboard...</div>
      </div>
    );
  }

  if (!isUserAuthenticated && !hasStoredAuthTokens) {
    return (
      <div className={mobileStyles.loadingScreen}>
        <div className={mobileStyles.loadingContent}>Please log in to access the tournament dashboard</div>
      </div>
    );
  }

  if (!isUserAuthenticated && hasStoredAuthTokens) {
    return (
      <div className={mobileStyles.loadingScreen}>
        <div className={mobileStyles.loadingContent}>Loading tournament dashboard...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <ConfirmationDialog open={confirmOpen} message={confirmMsg} onClose={() => setConfirmOpen(false)} />
        <ActionConfirmDialog
          open={Boolean(optionalToggleConfirm)}
          title="Disable Bracket Program?"
          message={optionalToggleConfirm
            ? `${optionalToggleConfirm.programName} has ${optionalToggleConfirm.existingEntries} existing entr${optionalToggleConfirm.existingEntries === 1 ? 'y' : 'ies'} in this tournament. Disabling it will permanently delete those entries from the database and can affect totals.`
            : ''}
          confirmLabel="Disable"
          cancelLabel="Keep Enabled"
          onCancel={() => setOptionalToggleConfirm(null)}
          onConfirm={() => {
            if (optionalToggleConfirm) {
              applyOptionalBracketToggle(optionalToggleConfirm.programKey, false);
            }
            setOptionalToggleConfirm(null);
          }}
        />
        {tournament && (
          <ShareQRModal
            open={shareQROpen}
            onClose={() => setShareQROpen(false)}
            tournamentId={tournament.id}
            tournamentName={tournament.name}
          />
        )}
        <EditTournamentModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setCreateMode(false); }}
          tournament={createMode ? null : tournament}
          onSave={handleSave}
          isCreateMode={createMode}
        />
        <ExplainDashboardModal
          isOpen={isExplainModalOpen}
          onClose={() => setIsExplainModalOpen(false)}
        />
        <main className="page-main">

          <div className={`${shellStyles.content} ${mobileStyles.contentContainer}`}>
            <div className={mobileStyles.cardsContainer}>

            {/* Empty State - No Tournament Loaded */}
            {!tournament && (
              <NoTournamentState
                title="Command Center Ready"
                description="Create a new tournament or load an existing one to activate your full tournament command center."
                actions={[
                  { label: 'Create Tournament', onClick: () => { setCreateMode(true); setModalOpen(true); }, variant: 'primary' },
                  { label: 'Load Tournament', onClick: () => setLoadModalOpen(true), variant: 'secondary' },
                ]}
                cards={[
                  { title: 'Build the Event', text: 'Set squads, bracket programs, entry pricing, side pots, and payout logic before lanes go live.' },
                  { title: 'Run It Live', text: 'Manage entries, generate brackets, and enter scores from one control surface during play.' },
                  { title: 'Close with Confidence', text: 'Review outcomes, payouts, exports, and public links when the tournament is complete.' },
                ]}
              />
            )}

            {tournament && (
              <>
                <div className={mobileStyles.dashboardOverviewStack}>
                <section className={`${shellStyles.section} ${mobileStyles.commandCenterGrid}`}>
                  <article className={`${cardStyles.card} ${cardStyles.accentCard} ${mobileStyles.liveBoardCard} ${mobileStyles.gridHero}`}>
                    <div className={mobileStyles.heroTopRow}>
                      <div>
                        <div className={mobileStyles.heroKicker}>Tournament Overview</div>
                        <div className={mobileStyles.heroTitleRow}>
                          <h2 className={mobileStyles.heroTitle}>{tournament.name}</h2>
                        </div>
                        <div className={mobileStyles.heroMetaCompact}>
                          <span>{tournament.start_date ? formatIsoDateFull(tournament.start_date) : 'Date pending'}</span>
                          <span aria-hidden="true">•</span>
                          <span>{activeSquad ? `Active Squad: ${activeSquad.time}` : 'Active Squad: pending'}</span>
                          <span aria-hidden="true">•</span>
                          <span>{`Squads: ${squads.length}`}</span>
                        </div>
                        {(loadedEntries > 0 || statsEntrySummary.totalEntries > 0) && (
                          <div className={mobileStyles.heroSummaryLine}>
                            <span>{`${loadedEntries} players`}</span>
                            <span aria-hidden="true">•</span>
                            <span>{`${statsEntrySummary.totalEntries} entries`}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={mobileStyles.heroMiddleRow}>
                      <div className={mobileStyles.heroStatusChipRow}>
                        {heroStatusChips.map(chip => (
                          <button
                            key={chip.key}
                            type="button"
                            className={`${mobileStyles.heroStatusChip} ${
                              chip.tone === 'alert'
                                ? mobileStyles.heroStatusChipAlert
                                : chip.tone === 'active'
                                  ? mobileStyles.heroStatusChipActive
                                  : chip.tone === 'complete'
                                    ? mobileStyles.heroStatusChipComplete
                                    : mobileStyles.heroStatusChipPending
                            }`}
                            onClick={() => {
                              if (chip.key === 'brackets') {
                                router.push('/brackets');
                                return;
                              }
                              if (chip.key === 'scores') {
                                router.push('/scores');
                                return;
                              }
                              if (chip.key === 'payouts') {
                                router.push('/payouts');
                              }
                            }}
                          >
                            {chip.tone === 'alert' ? <span className={mobileStyles.heroStatusAlertIcon} aria-hidden="true">!</span> : null}
                            <span>{chip.label}</span>
                            {chip.value ? <strong>{chip.value}</strong> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={mobileStyles.heroBottomRow}>
                      <div className={mobileStyles.bracketPreview}>
                        <div className={`${cardStyles.panel} ${mobileStyles.bracketRound} ${mobileStyles.bracketRulesCard}`}>
                          <div className={mobileStyles.bracketRoundTitle}>Bracket &amp; Rules</div>
                          <div className={mobileStyles.bracketInfoGrid}>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>Bracket Size</span>
                              <span className={mobileStyles.bracketInfoValue}>{bracketSettings.bracket_size} Players</span>
                            </div>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>Entry Fee</span>
                              <span className={`${mobileStyles.bracketInfoValue} ${mobileStyles.bracketInfoValueStrong}`}>{formatUsd(bracketSettings.default_entry_fee)}</span>
                            </div>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>Handicap</span>
                              <span className={`${mobileStyles.bracketInfoValue} ${mobileStyles.bracketInfoValueStrong}`}>{bracketSettings.handicap_percentage}% / {bracketSettings.handicap_base}</span>
                            </div>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>Bye Settings</span>
                              <span className={`${mobileStyles.statusBadge} ${bracketSettings.allow_byes ? mobileStyles.statusBadgeEnabled : mobileStyles.statusBadgeDisabled}`}>
                                {bracketSettings.allow_byes ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>Side Pots</span>
                              <span className={`${mobileStyles.statusBadge} ${enabledSidePotsCount > 0 ? mobileStyles.statusBadgeEnabled : mobileStyles.statusBadgeDisabled}`}>
                                {enabledSidePotsCount > 0 ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className={`${mobileStyles.bracketInfoRow} ${mobileStyles.additionalBracketsRow}`}>
                              <span className={mobileStyles.bracketInfoLabel}>Additional Brackets</span>
                              <span className={`${mobileStyles.bracketInfoValue} ${mobileStyles.bracketInfoValueWrap}`}>{optionalProgramsSummary}</span>
                            </div>
                          </div>
                        </div>

                        <div className={`${cardStyles.panel} ${mobileStyles.bracketRound} ${mobileStyles.prizeBreakdownCard}`}>
                          <div className={mobileStyles.bracketRoundTitle}>Prize Breakdown</div>
                          <div className={mobileStyles.prizePoolHero}>
                            <span className={mobileStyles.prizePoolLabel}>Prize Pool</span>
                            <strong className={mobileStyles.prizePoolValue}>{formatUsd(tournamentProjectedPayout)}</strong>
                          </div>

                          <div className={mobileStyles.prizeSectionLabel}>Net Calculation</div>
                          <div className={mobileStyles.prizeSectionGroup}>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>Gross Collected</span>
                              <span className={mobileStyles.bracketInfoValue}>{formatUsd(grossCollected)}</span>
                            </div>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>House Fee</span>
                              <span className={`${mobileStyles.bracketInfoValue} ${mobileStyles.bracketInfoValueNegative}`}>-{formatUsd(houseRetained)}</span>
                            </div>
                          </div>

                          <div className={`${mobileStyles.prizeSectionLabel} ${mobileStyles.prizeSectionLabelSpaced}`}>Payout Split</div>
                          <div className={mobileStyles.prizeSectionGroup}>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>1st Place</span>
                              <span className={mobileStyles.bracketInfoValue}>{formatUsd(bracketSettings.first_place_amount)}</span>
                            </div>
                            <div className={mobileStyles.bracketInfoRow}>
                              <span className={mobileStyles.bracketInfoLabel}>2nd Place</span>
                              <span className={mobileStyles.bracketInfoValue}>{formatUsd(bracketSettings.second_place_amount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={mobileStyles.heroActionRail}>
                        {showHeroStatusStrip && (
                          <div className={`${mobileStyles.heroWarningStrip} ${statusNarrative.tone === 'warning' ? mobileStyles.heroWarningStripWarning : mobileStyles.heroWarningStripInfo}`}>
                            <span className={`${mobileStyles.heroWarningIcon} ${statusNarrative.tone === 'warning' ? mobileStyles.heroWarningIconWarning : mobileStyles.heroWarningIconInfo}`}>{statusNarrative.icon}</span>
                            <span>{statusNarrative.warningText}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>

                  <aside className={`${cardStyles.card} ${cardStyles.accentCard} ${mobileStyles.squadRailCard} ${mobileStyles.gridTools} ${mobileStyles.commissionerPanel}`}>
                    <div className={mobileStyles.commissionerSectionTitle}>Continue Tournament</div>
                    <div className={mobileStyles.squadRailList}>
                      {continueTournamentActions.map(action => (
                        <button
                          key={action.key}
                          className={`${mobileStyles.squadRailPill} ${action.key === primaryContinueActionKey ? mobileStyles.commissionerActionPrimary : mobileStyles.commissionerActionSecondary} ${action.disabled ? mobileStyles.commissionerActionDisabled : ''}`}
                          onClick={action.onClick}
                          disabled={action.disabled}
                        >
                          <span>{action.label}</span>
                          <span className={`${mobileStyles.commissionerActionIndicator} ${action.accent && !action.disabled ? mobileStyles.commissionerActionIndicatorAccent : ''}`}>{action.indicator}</span>
                        </button>
                      ))}
                    </div>

                    <div className={mobileStyles.commissionerSectionTitle}>Manage Tournament</div>
                    <div className={mobileStyles.squadRailList}>
                      {manageSetupActions.map(item => (
                        <button
                          key={item.key}
                          className={`${mobileStyles.squadRailPill} ${mobileStyles.commissionerAdminRow} ${item.disabled ? mobileStyles.commissionerActionDisabled : ''}`}
                          onClick={item.onClick}
                          disabled={item.disabled}
                        >
                          <span>{item.label}</span>
                          <span className={`${mobileStyles.commissionerActionIndicator} ${mobileStyles.commissionerAdminIndicator}`}>›</span>
                        </button>
                      ))}
                    </div>

                    <div className={mobileStyles.commissionerSectionTitle}>More Actions</div>
                    <div className={mobileStyles.squadRailList}>
                      {moreActions.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          className={`${mobileStyles.squadRailPill} ${item.variant === 'destructive' ? mobileStyles.moreActionInlineDanger : mobileStyles.commissionerActionSecondary}`}
                          onClick={item.onClick}
                          disabled={item.disabled}
                        >
                          <span>{item.label}</span>
                          <span className={mobileStyles.commissionerActionIndicator}>{item.variant === 'destructive' ? '!' : '›'}</span>
                        </button>
                      ))}
                    </div>
                  </aside>

                </section>

                <section className={`${shellStyles.section} ${mobileStyles.entriesOverviewSection}`}>
                  <article className={`${cardStyles.card} ${cardStyles.accentCard} ${mobileStyles.entriesOverviewCard} ${mobileStyles.entriesOverviewStandalone}`}>
                    <div className={mobileStyles.entriesOverviewHeader}>Entries Overview</div>
                    <div className={mobileStyles.summaryCardsBand}>
                      {tournamentSummaryCards.map(card => (
                        <button
                          key={card.key}
                          type="button"
                          className={`${cardStyles.statTile} ${mobileStyles.statTile} ${card.href ? mobileStyles.statTileActionable : ''}`}
                          onClick={() => {
                            if (card.href) {
                              router.push(card.href);
                            }
                          }}
                        >
                          <div className={mobileStyles.statLabel}>{card.label}</div>
                          <div className={`${mobileStyles.statValue} ${card.accent ? mobileStyles.statValueAccent : ''}`}>{card.value}</div>
                          {card.helperPrimary && <div className={mobileStyles.statCaption}>{card.helperPrimary}</div>}
                          {card.helperSecondary && <div className={mobileStyles.statCaptionMuted}>{card.helperSecondary}</div>}
                        </button>
                      ))}
                    </div>
                  </article>
                </section>
                </div>
              </>
            )}

          </div>
          {/* End Main Content Container */}
          </div>

          {/* Tournament Settings Modal */}
          {settingsModalOpen && tournament && (
            <div className={`${mobileStyles.modalOverlay} ${mobileStyles.settingsModalOverlay}`}>
              <div className={`${mobileStyles.modalCard} ${mobileStyles.settingsModalCard}`}>
                <CloseControl
                  position="absolute"
                  size="sm"
                  className={mobileStyles.settingsModalCloseButton}
                  label="Close tournament settings modal"
                  onClick={() => setSettingsModalOpen(false)}
                />
                <div className={mobileStyles.modalHeader}>
                  <h2 className={mobileStyles.modalTitle}>Tournament Settings</h2>
                  <p className={mobileStyles.modalSubtitle}>Update bracket rules, pricing, side pots, and other tournament setup details.</p>
                </div>
                <div className={`${mobileStyles.modalScrollBody} ${mobileStyles.settingsModalScrollBody}`}>
                  <TournamentSettingsContent tournamentId={tournament.id} layout="embedded-modal" />
                </div>
                <div className={mobileStyles.settingsModalCloseFooter}>
                  <button
                    type="button"
                    className={mobileStyles.settingsModalCloseFooterButton}
                    onClick={() => setSettingsModalOpen(false)}
                  >
                    Close Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Change Squad Modal */}
          {squadModalOpen && tournament && (
            <div className={`${mobileStyles.modalOverlay} ${mobileStyles.modalOverlayTop}`}>
              <div className={`${mobileStyles.modalCard} ${mobileStyles.squadChangeModalCard}`}>
                <div className={mobileStyles.modalHeader}>
                  <h2 className={mobileStyles.modalTitle}>Change Squad</h2>
                  <p className={mobileStyles.modalSubtitle}>Select the active squad for {tournament.name}</p>
                  <CloseControl position="absolute" size="sm" label="Close change squad modal" onClick={() => setSquadModalOpen(false)} />
                </div>
                <div className={mobileStyles.squadChangeList}>
                  {[...squads].sort((left, right) => {
                    const leftSelected = left.id === selectedSquadId ? 1 : 0;
                    const rightSelected = right.id === selectedSquadId ? 1 : 0;
                    return rightSelected - leftSelected;
                  }).map(squad => {
                    const label = [squad.date ? formatIsoDateLong(squad.date) : '', squad.time].filter(Boolean).join(' - ');
                    const isSelected = squad.id === selectedSquadId;
                    const entries = squadEntryCounts[squad.id] ?? 0;
                    return (
                      <button
                        key={squad.id}
                        type="button"
                        className={`${mobileStyles.squadChangeItem} ${isSelected ? mobileStyles.squadChangeItemSelected : ''} ${entries === 0 ? mobileStyles.squadChangeItemEmpty : ''}`}
                        onClick={() => handleSelectSquad(squad)}
                      >
                        <span className={mobileStyles.squadChangeItemMain}>
                          <span className={mobileStyles.squadChangeItemLabel}>{label || `Squad ${squad.id}`}</span>
                          <span className={mobileStyles.squadChangeItemMeta}>{entries} {entries === 1 ? 'entry' : 'entries'}{isSelected ? ' • Active squad' : ''}</span>
                        </span>
                        <span className={mobileStyles.squadChangeItemStatus}>{isSelected ? 'Current' : 'Make Active'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Load Tournament Modal */}
          {loadModalOpen && (
            <div className={mobileStyles.modalOverlay}>
              <div className={`${mobileStyles.modalCard} ${mobileStyles.tournamentSelectorCard}`}>
                <div className={mobileStyles.modalHeader}>
                  <h2 className={mobileStyles.modalTitle}>{isAdmin ? 'All Tournaments' : 'Your Tournaments'}</h2>
                  <p className={mobileStyles.modalSubtitle}>
                    {allTournaments.length > 0
                      ? `${allTournaments.length} available ${allTournaments.length === 1 ? 'tournament' : 'tournaments'}`
                      : 'No tournaments available'}
                  </p>
                  <CloseControl
                    position="absolute"
                    size="sm"
                    className={mobileStyles.settingsModalCloseButton}
                    label="Close load tournament modal"
                    onClick={() => setLoadModalOpen(false)}
                  />
                </div>
                <div className={mobileStyles.modalScrollBody}>
                  {allTournaments.length === 0 ? (
                    <div className={mobileStyles.emptyTournaments}>
                      <div>No tournaments found.</div>
                      <div className={mobileStyles.emptyTournamentsHint}>Create your first tournament to get started!</div>
                    </div>
                  ) : (
                    <>
                      <ul className={mobileStyles.tournamentList}>
                        {paginatedItems.map((t: Tournament) => {
                          const squadCount = t.squad_times
                            ? Object.values(t.squad_times).reduce((s, arr) => s + arr.length, 0)
                            : 0;
                          const dayCount = t.squad_times ? Object.keys(t.squad_times).length : 0;
                          const isActiveTournament = tournament?.id === t.id;
                          return (
                            <li
                              key={t.id}
                              className={`${mobileStyles.tournamentItem} ${isActiveTournament ? mobileStyles.tournamentItemActive : ''}`}
                            >
                              <div className={mobileStyles.tournamentInfo}>
                                <div className={mobileStyles.tournamentNameRow}>
                                  <span className={mobileStyles.tournamentName}>{t.name}</span>
                                  {isActiveTournament && <span className={mobileStyles.tournamentActiveBadge}>Active</span>}
                                </div>
                                {t.location && <div className={mobileStyles.tournamentLocation}>{t.location}</div>}
                                {t.start_date && (
                                  <div className={mobileStyles.tournamentDate}>
                                    {formatIsoDateLong(t.start_date)}
                                    {t.end_date && t.end_date !== t.start_date && ` – ${formatIsoDateLong(t.end_date)}`}
                                  </div>
                                )}
                                {(squadCount > 0 || (typeof t.entry_count === 'number' && t.entry_count > 0) || t.brackets_configured) && (
                                  <div className={mobileStyles.tournamentMeta}>
                                    {squadCount > 0 && <span>{squadCount} {squadCount === 1 ? 'Squad' : 'Squads'}</span>}
                                    {dayCount > 1 && <span>{dayCount} Days</span>}
                                    {typeof t.entry_count === 'number' && t.entry_count > 0 && (
                                      <span>{t.entry_count} {t.entry_count === 1 ? 'Entry' : 'Entries'}</span>
                                    )}
                                    {t.brackets_configured && <span>Brackets Configured</span>}
                                  </div>
                                )}
                              </div>
                              <div className={mobileStyles.tournamentActions}>
                                <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary} ${mobileStyles.loadBtn}`} onClick={() => handleLoadTournament(t)}>
                                  {isActiveTournament ? 'Reload' : 'Load'}
                                </button>
                                <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.danger} ${mobileStyles.deleteBtn}`} onClick={() => setDeleteConfirm({id: t.id, name: t.name})}>Delete</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {totalPages > 1 && (
                        <div className={mobileStyles.paginationBar}>
                          <EnhancedButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} variant="primary" size="sm">Previous</EnhancedButton>
                          <span className={mobileStyles.paginationText}>Page {currentPage} of {totalPages}</span>
                          <EnhancedButton onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} variant="primary" size="sm">Next</EnhancedButton>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className={`${mobileStyles.modalOverlay} ${mobileStyles.modalOverlayTop}`}>
            <div className={mobileStyles.modalCard}>
              <CloseControl onClick={() => setDeleteConfirm(null)} position="absolute" size="sm" label="Close tournament deletion dialog" />
              <h2 className={`${mobileStyles.modalTitle} ${mobileStyles.modalTitleDanger}`}>Confirm Deletion</h2>
              <p className={mobileStyles.deleteConfirmText}>
                Are you sure you want to delete tournament <strong>{deleteConfirm.name}</strong>?
              </p>
              <div className={mobileStyles.deleteConfirmActions}>
                <EnhancedButton onClick={() => handleDeleteTournament(deleteConfirm.id)} variant="danger" size="md">Delete</EnhancedButton>
                <EnhancedButton onClick={() => setDeleteConfirm(null)} variant="primary" size="md">Cancel</EnhancedButton>
              </div>
            </div>
          </div>
        )}
      </>
    </ErrorBoundary>
  );
}




