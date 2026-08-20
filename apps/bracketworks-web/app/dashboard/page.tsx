"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Braces,
  ClipboardList,
  CircleDollarSign,
  LogOut,
  PencilLine,
  Repeat,
  Settings2,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Tournament, Squad, BracketSettings, TournamentForm, SidePotsSettings, SidePot, Player, DashboardTournamentBootstrapResponse } from '../lib/types';

import { useAuth } from '../lib/auth-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getErrorMessage, getErrorContext } from '../lib/error-utils';
import { storage } from '../lib/storage';
import { BRACKET_SETTINGS_AUTOSAVE_DELAY_MS, getSidePotsStorageKey } from '../lib/dashboard-settings';
import mobileStyles from './dashboard.module.css';
import shellStyles from '../styles/page-shell.module.css';
import { ConfirmationDialog } from '../components/LazyComponents';
import { API, apiClient, apiFetch, getMemoryAccessToken } from '../lib/api';
import { isPhoneWidth } from '../lib/responsive';
import { logger } from '../lib/logger';
import { defaultBracketPrograms, normalizeBracketPrograms, summarizeEntries } from '../lib/bracketPrograms';
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
import { formatIsoDateFull } from '../lib/formatters';
import { EditTournamentModal } from './components/EditTournamentModal';
import { ChangeSquadModal } from './components/ChangeSquadModal';
import { LoadTournamentModal } from './components/LoadTournamentModal';
import { normalizeSquadTimes } from './utils/tournamentForm';
import { SAMPLE_BOWLER_NAMES, SAMPLE_TOURNAMENT } from '../demo/sample-tournament';
import { createDefaultSidePots, hydrateStoredSidePots, normalizeSidePotsSettings } from './utils/sidePots';
import { useTournamentOrchestration } from './hooks/useTournamentOrchestration';
import { useDashboardScoreProgress } from './hooks/useDashboardScoreProgress';
import { useDashboardWorkflowModel } from './hooks/useDashboardWorkflowModel';
import { DashboardBoard } from './components/DashboardBoard';
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

const dashboardActionIcons: Record<string, LucideIcon> = {
  'add-player': UserPlus,
  'view-brackets': Braces,
  'view-payouts': Trophy,
  'calculate-payouts': CircleDollarSign,
  'finalize-payouts': Trophy,
  'change-squad': Users,
  'edit-tournament': PencilLine,
  'tournament-settings': Settings2,
  'change-tournament': Repeat,
  'unload-tournament': LogOut,
  'enter-scores': ClipboardList,
  'generate-brackets': ClipboardList,
};

const DEMO_DASHBOARD_TOURNAMENT: Tournament = { id: 900001, name: SAMPLE_TOURNAMENT.name, location: SAMPLE_TOURNAMENT.location, start_date: SAMPLE_TOURNAMENT.date, end_date: SAMPLE_TOURNAMENT.date, entry_count: 32, brackets_configured: true, is_public: true };
const DEMO_DASHBOARD_SQUADS: Squad[] = [
  { id: 900101, tournament_id: 900001, date: SAMPLE_TOURNAMENT.date, time: SAMPLE_TOURNAMENT.squads[0] },
  { id: 900102, tournament_id: 900001, date: SAMPLE_TOURNAMENT.date, time: SAMPLE_TOURNAMENT.squads[1] },
];
const DEMO_DASHBOARD_PLAYERS: Player[] = Array.from({ length: 32 }, (_, index) => {
  const programEntryCounts = { handicap: 1, scratch: index < 24 ? 1 : 0, reverse_scratch: index < 16 ? 1 : 0 };
  const totalCost = Object.values(programEntryCounts).reduce((sum, count) => sum + count, 0) * 12;
  const [firstName = 'Sample', ...lastNameParts] = (SAMPLE_BOWLER_NAMES[index] ?? `Sample Bowler ${index + 1}`).split(' ');
  return { id: 910000 + index, firstName, lastName: lastNameParts.join(' '), average: 172 + (index % 35), division: 'Open', amountPaid: totalCost, totalCost, programEntryCounts, squad: DEMO_DASHBOARD_SQUADS[0]! };
});
const DEMO_DASHBOARD_BRACKET_SETTINGS: BracketSettings = {
  ...createDefaultBracketSettings(900001), bracket_size: 8, default_entry_fee: 12, first_place_amount: 60, second_place_amount: 24, house_fee_amount: 12, handicap_percentage: 90, handicap_base: 220, allow_byes: true,
  bracket_programs: defaultBracketPrograms.map(program => ({ ...program, entry_fee: 12, enabled: program.key === 'handicap' || program.key === 'scratch' || program.key === 'reverse_scratch' })),
};
const DEMO_DASHBOARD_SIDE_POTS: SidePotsSettings = {
  ...createDefaultSidePots(900001), entry_fee: 10, prize_amount: 150,
  pots: createDefaultSidePots(900001).pots.map(pot => ({ ...pot, enabled: true })),
};

export default function TournamentDashboard() {
  const pathname = usePathname();
  const isDemoDashboard = pathname === '/demo/dashboard';
  // Authentication check - must be at the top
  const { isUserAuthenticated, isAuthInitialized, authToken, currentUser } = useAuth();
  const sessionToken = authToken || getMemoryAccessToken();
  const [showDashboard, setShowDashboard] = useState(false);

  // Check for an in-memory session even if auth context is still hydrating.
  const hasStoredAuthTokens = typeof window !== 'undefined' && 
    Boolean(sessionToken);

  // All hooks must be called before conditional returns (React rules of hooks)
  const [isAdmin, setIsAdmin] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(() => isDemoDashboard ? DEMO_DASHBOARD_TOURNAMENT : null);
  const [workflowStatus, setWorkflowStatus] = useState<DashboardTournamentBootstrapResponse['workflow_status']>(() => isDemoDashboard ? ({ status_squad_id: 900101, has_generated_brackets: true, has_payout_summary: false, payouts_finalized: false, scores_locked: false }) : null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(() => isDemoDashboard ? 900101 : null);
  const [squads, setSquads] = useState<Squad[]>(() => isDemoDashboard ? DEMO_DASHBOARD_SQUADS : []);
  const [squadEntryCounts, setSquadEntryCounts] = useState<Record<number, number>>(() => isDemoDashboard ? ({ 900101: 32, 900102: 0 }) : ({} as Record<number, number>));
  const [summaryPlayers, setSummaryPlayers] = useState<Player[]>(() => isDemoDashboard ? DEMO_DASHBOARD_PLAYERS : []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [optionalToggleConfirm, setOptionalToggleConfirm] = useState<{ programKey: string; programName: string; existingEntries: number } | null>(null);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [squadModalOpen, setSquadModalOpen] = useState(false);
  const [squadModalRequireMessage, setSquadModalRequireMessage] = useState<string | null>(null);
  const pendingSquadActionRef = useRef<(() => void) | null>(null);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: number, name: string} | null>(null);
  const [shareQROpen, setShareQROpen] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  
  // Enhanced UX components
  const { addToast } = useToast();
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination({ 
    items: allTournaments, 
    itemsPerPage: 10 
  });


  
  // Bracket settings state
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>(() => isDemoDashboard ? DEMO_DASHBOARD_BRACKET_SETTINGS : ({ ...createDefaultBracketSettings() }));
  const [savingBracketSettings, setSavingBracketSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  const lastPrizeValidationKeyRef = useRef<string>('');
  // Always holds the latest bracketSettings so async callbacks aren't stale
  const bracketSettingsRef = useRef<BracketSettings>(bracketSettings);

  // Side pots state
  const [sidePots, setSidePots] = useState<SidePotsSettings>(() => isDemoDashboard ? DEMO_DASHBOARD_SIDE_POTS : createDefaultSidePots());

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
    
    const token = sessionToken;
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

  const fetchBracketSettingsData = useCallback(async (tournamentId: number): Promise<BracketSettings> => {
    const token = sessionToken;
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
  }, [sessionToken]);

  // Load bracket settings
  const loadBracketSettings = useCallback(async (tournamentId: number) => {
    const loaded = await fetchBracketSettingsData(tournamentId);
    setBracketSettings(prev => applyAutoHouse(prev, loaded));
    const apiSidePots = normalizeSidePotsSettings(loaded.side_pots_settings, tournamentId);
    setSidePots(apiSidePots);
    storage.setItem(getSidePotsStorageKey(tournamentId), JSON.stringify(apiSidePots));
  }, [fetchBracketSettingsData]);

  const loadSidePots = useCallback((tournamentId: number) => {
    const fromSettings = normalizeSidePotsSettings(bracketSettingsRef.current.side_pots_settings, tournamentId);
    if ((fromSettings.pots ?? []).some(pot => pot.enabled) || fromSettings.entry_fee > 0 || fromSettings.prize_amount > 0) {
      setSidePots(fromSettings);
      storage.setItem(getSidePotsStorageKey(tournamentId), JSON.stringify(fromSettings));
      return;
    }

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
    updateBracketSettings(
      previous => ({ ...previous, side_pots_settings: next }),
      'immediate',
    );
    notifySettingsChanged();
  };

  const loadSquadEntryCounts = useCallback(async (tournamentId: number, squadList: Squad[]) => {
    const token = sessionToken;
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
  }, [sessionToken]);

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
    enabled: !isDemoDashboard,
    authToken: sessionToken,
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

    const token = sessionToken;
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

  // Keep admin scope in sync with authenticated user state.
  useEffect(() => {
    setIsAdmin(Boolean(currentUser?.isAdmin));
  }, [currentUser?.isAdmin]);

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

  // Mobile detection; tablets retain the wider layout inside the drawer shell.
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(isPhoneWidth(width));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleUnloadTournament = () => {
    unloadTournament();
    setSettingsModalOpen(false);
    setSquadModalOpen(false);
    setSquadModalRequireMessage(null);
    pendingSquadActionRef.current = null;
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
    setSquadModalRequireMessage(null);
    setSquadModalOpen(true);
  };

  // Blocks navigation away from the dashboard until a squad is chosen when multiple squads exist.
  const requireSquadSelection = useCallback((action: () => void) => {
    if (squads.length > 1 && selectedSquadId == null) {
      pendingSquadActionRef.current = action;
      setSquadModalRequireMessage('Select a squad before proceeding.');
      setSquadModalOpen(true);
      return;
    }
    action();
  }, [squads.length, selectedSquadId]);

  const handleSelectSquad = (squad: Squad) => {
    const label = [squad.date, squad.time].filter(Boolean).join(' ');
    setSelectedSquadId(squad.id);
    setSelectedSquad(squad.id);
    setActiveSquadLabel(label);
    setSquadModalOpen(false);
    setSquadModalRequireMessage(null);
    addToast({
      type: 'success',
      message: label ? `Active squad changed to ${label}` : 'Active squad changed',
      duration: 3000,
    });

    const pendingAction = pendingSquadActionRef.current;
    pendingSquadActionRef.current = null;
    if (pendingAction) {
      pendingAction();
    }
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
    const token = sessionToken;
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
  const normalizedPrograms = normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee);
  const enabledBracketProgramsForSummary = normalizedPrograms.filter(program =>
    program.key === 'handicap' || program.key === 'scratch' || Boolean(program.enabled)
  );
  const activeSquad = selectedSquad ?? squads[0] ?? null;
  const statsSummaryPlayers = useMemo(() => {
    if (selectedSquadId == null) return summaryPlayers;
    return summaryPlayers.filter(player => player.squad?.id === selectedSquadId);
  }, [summaryPlayers, selectedSquadId]);
  const scoreProgress = useDashboardScoreProgress({
    isDemoDashboard,
    authToken: sessionToken,
    tournamentId: tournament?.id ?? null,
    selectedSquadId,
    loadedEntries,
    statsSummaryPlayersLength: statsSummaryPlayers.length,
  });
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
  const expectedBracketCount = entrySummary.programSummaries.reduce((sum, program) => sum + program.expectedBrackets, 0);
  const grossCollected = Math.max(0, entrySummary.totalRevenue);
  const houseRetained = Math.max(0, expectedBracketCount * Number(bracketSettings.house_fee_amount || 0));
  const tournamentProjectedPayout = Math.max(0, grossCollected - houseRetained);
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
  const {
    continueTournamentActions,
    contextPrimaryAction,
    manageSetupActions,
    moreActions,
    dangerActions,
    optionalProgramNames,
    optionalProgramsSummary,
    scoreProgressText,
    workflowSteps,
    orderedStatsProgramSummaries,
  } = useDashboardWorkflowModel({
    workflowStatus,
    tournamentBracketsConfigured: Boolean(tournament?.brackets_configured),
    loadedEntries,
    bracketsSold,
    squadsLength: squads.length,
    bracketSize: bracketSettings.bracket_size,
    missingAveragesCount,
    unpaidEntriesCount,
    duplicatePlayersCount,
    scoreProgress,
    normalizedPrograms,
    statsProgramSummaries: statsEntrySummary.programSummaries,
    isEntryDataSyncing,
    onGoPlayers: () => requireSquadSelection(() => router.push('/players')),
    onGoBrackets: () => requireSquadSelection(() => router.push('/brackets')),
    onGoPayouts: () => requireSquadSelection(() => router.push('/payouts')),
    onGoScores: () => requireSquadSelection(() => router.push('/scores')),
    onOpenEditTournament: () => {
      setCreateMode(false);
      setModalOpen(true);
    },
    onOpenSettings: () => setSettingsModalOpen(true),
    onOpenSquadSelector: handleOpenSquadSelector,
    onChangeTournament: handleChangeTournament,
    onUnloadTournament: handleUnloadTournament,
  });

  const usdFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    [],
  );
  const formatUsd = useCallback((amount: number) => usdFormatter.format(Math.max(0, Number(amount || 0))), [usdFormatter]);

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
    if (sessionStorage.getItem('bracketworks-start-create-tournament') === 'true') {
      sessionStorage.removeItem('bracketworks-start-create-tournament');
      handleNewTournament();
    }
    return () => {
      window.removeEventListener('bw:new-tournament', handleNewTournament as EventListener);
    };
  }, []);

  // All hooks are declared above — conditional returns are safe below this line
  if (!isDemoDashboard && !isAuthInitialized && !showDashboard) {
    return (
      <div className={mobileStyles.loadingScreen}>
        <div className={mobileStyles.loadingContent} role="status">Loading dashboard...</div>
      </div>
    );
  }

  if (!isDemoDashboard && !isUserAuthenticated && !hasStoredAuthTokens) {
    return (
      <div className={mobileStyles.loadingScreen}>
        <div className={mobileStyles.loadingContent}>Please log in to access the tournament dashboard</div>
      </div>
    );
  }

  if (!isDemoDashboard && !isUserAuthenticated && hasStoredAuthTokens) {
    return (
      <div className={mobileStyles.loadingScreen}>
        <div className={mobileStyles.loadingContent} role="status">Loading dashboard...</div>
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
        <div className="page-main">

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
                <DashboardBoard
                  tournament={tournament}
                  activeSquad={activeSquad}
                  tournamentDateLabel={tournament.start_date ? formatIsoDateFull(tournament.start_date) : 'Date pending'}
                  squadTimeLabel={activeSquad ? activeSquad.time : 'Squad time pending'}
                  loadedEntries={loadedEntries}
                  statsEntrySummary={statsEntrySummary}
                  workflowSteps={workflowSteps}
                  bracketSettings={bracketSettings}
                  optionalProgramsLabel={optionalProgramNames.length === 1 ? 'Additional Bracket' : 'Additional Brackets'}
                  optionalProgramsSummary={optionalProgramsSummary}
                  enabledSidePotsCount={enabledSidePotsCount}
                  formatUsd={formatUsd}
                  tournamentProjectedPayout={tournamentProjectedPayout}
                  grossCollected={grossCollected}
                  houseRetained={houseRetained}
                  orderedStatsProgramSummaries={orderedStatsProgramSummaries}
                  continueTournamentActions={continueTournamentActions}
                  manageSetupActions={manageSetupActions}
                  moreActions={moreActions}
                  dangerActions={dangerActions}
                  contextPrimaryAction={contextPrimaryAction}
                  dashboardActionIcons={dashboardActionIcons}
                  scoreProgress={scoreProgress}
                  scoreProgressText={scoreProgressText}
                />
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
                  <h2 className={`${mobileStyles.modalTitle} ${mobileStyles.settingsModalTitle}`}>
                    <Settings2 aria-hidden="true" />
                    <span>Tournament Settings</span>
                  </h2>
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

          <ChangeSquadModal
            open={squadModalOpen}
            tournament={tournament}
            squads={squads}
            selectedSquadId={selectedSquadId}
            squadEntryCounts={squadEntryCounts}
            onSelectSquad={handleSelectSquad}
            onClose={() => {
              setSquadModalOpen(false);
              setSquadModalRequireMessage(null);
              pendingSquadActionRef.current = null;
            }}
            requireSelectionMessage={squadModalRequireMessage}
          />

          <LoadTournamentModal
            open={loadModalOpen}
            isAdmin={isAdmin}
            allTournaments={allTournaments}
            paginatedItems={paginatedItems}
            currentTournamentId={tournament?.id ?? null}
            currentPage={currentPage}
            totalPages={totalPages}
            goToPage={goToPage}
            onClose={() => setLoadModalOpen(false)}
            onLoadTournament={handleLoadTournament}
            onDeleteTournament={(selectedTournament) => setDeleteConfirm({ id: selectedTournament.id, name: selectedTournament.name })}
          />
        </div>

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



