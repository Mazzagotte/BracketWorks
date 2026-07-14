"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament, Squad, BracketSettings, TournamentForm, SidePotsSettings, SidePot, Player } from '../lib/types';

import { useAuth } from '../lib/auth-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getErrorMessage, getErrorContext } from '../lib/error-utils';
import { storage } from '../lib/storage';
import mobileStyles from './dashboard.module.css';
import cardStyles from '../styles/cards.module.css';
import shellStyles from '../styles/page-shell.module.css';
import { ConfirmationDialog } from '../components/LazyComponents';
import { API, apiClient, apiFetch } from '../lib/api';
import { logger } from '../lib/logger';
import { defaultBracketPrograms, normalizeBracketPrograms, summarizeEntries } from '../lib/bracketPrograms';
import EnhancedButton from '../components/EnhancedButton';
import { useToast } from '../components/Toast';
import { usePagination } from '../components/Performance';
import { FormField, Input, Select } from '../components/UI';
import ShareQRModal from '../components/ShareQRModal';
import ActionConfirmDialog from '../components/ActionConfirmDialog';
import NoTournamentState from '../components/NoTournamentState';
import {
  clearSelectedSquad,
  clearSelectedTournament,
  getSelectedSquadId,
  getSelectedTournamentId,
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

function get12hrTimes() {
  const makeGroup = (period: 'AM' | 'PM') => {
    const slots: string[] = [];
    // 12:xx comes first in each period, then 1–11
    for (const hour of [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        slots.push(`${hour}:${minutes.toString().padStart(2, '0')} ${period}`);
      }
    }
    return slots;
  };
  return { am: makeGroup('AM'), pm: makeGroup('PM') };
}
const availableTimeOptions = get12hrTimes();
const BRACKET_SETTINGS_AUTOSAVE_DELAY_MS = 600;
// Show all AM and PM times

const parseCurrencyInput = (userInput: string): number => {
  // Remove all non-numeric characters
  const cleanedNumericString = userInput.replace(/[^0-9]/g, '');
  const parsedValue = parseInt(cleanedNumericString);
  return isNaN(parsedValue) ? 0 : parsedValue;
};

const formatNumberInput = (numericValue: number): string => {
  // Format for input display with commas but no $ symbol
  return numericValue === 0 ? '' : Math.round(numericValue).toLocaleString('en-US');
};

const formatCurrencyLabel = (numericValue: number): string => {
  return `$${Math.round(numericValue || 0).toLocaleString('en-US')}`;
};

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

const createDefaultBracketSettings = (tournamentId = 0): BracketSettings => ({
  tournament_id: tournamentId,
  bracket_size: 8,
  first_place_amount: 0,
  second_place_amount: 0,
  house_fee_amount: 0,
  default_entry_fee: 0,
  bracket_programs: defaultBracketPrograms,
  handicap_percentage: 80,
  handicap_base: 200,
  allow_byes: false,
})

const DEFAULT_SIDE_POTS: SidePot[] = [
  { key: 'high_game_scratch', name: 'High Game Scratch', enabled: false },
  { key: 'high_series_scratch', name: 'High Series Scratch', enabled: false },
  { key: 'high_game_handicap', name: 'High Game Handicap', enabled: false },
  { key: 'high_series_handicap', name: 'High Series Handicap', enabled: false },
]

const createDefaultSidePots = (tournamentId = 0): SidePotsSettings => ({
  tournament_id: tournamentId,
  entry_fee: 0,
  prize_amount: 0,
  pots: DEFAULT_SIDE_POTS.map(p => ({ ...p })),
})

const SIDE_POTS_STORAGE_KEY = (tournamentId: number) => `sidePots_${tournamentId}`

type TournamentBootstrapResponse = {
  tournament: Tournament | null;
  squads: Squad[];
  selected_squad: { squad_id: number } | null;
  bracket_settings: Partial<BracketSettings> | null;
  workflow_status: {
    status_squad_id: number | null;
    has_generated_brackets: boolean;
    payouts_finalized: boolean;
    scores_locked: boolean;
  } | null;
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

function getDatesBetween(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const dateList = [];
  let currentDate = new Date(startDate);
  const finalDate = new Date(endDate);
  while (currentDate <= finalDate) {
    dateList.push(currentDate.toISOString().slice(0, 10));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dateList;
}

function normalizeSquadTimes(squadTimes?: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(squadTimes || {})
      .map(([date, times]) => [date, [...(times || [])].filter(Boolean).sort()] as [string, string[]])
      .filter(([, times]) => times.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function normalizeTournamentForm(form: TournamentForm): TournamentForm {
  return {
    name: form.name || '',
    location: form.location || '',
    start_date: form.start_date || '',
    end_date: form.end_date || '',
    squad_times: normalizeSquadTimes(form.squad_times),
  };
}

function EditTournamentModal({ open, onClose, tournament, onSave, isCreateMode }: {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onSave: (tournamentData: TournamentForm) => void;
  isCreateMode: boolean;
}) {
  const [tournamentForm, setTournamentForm] = useState<TournamentForm>({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    squad_times: {}
  });
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingTimes, setPendingTimes] = useState<Record<string, string>>({});
  const [savedSnapshot, setSavedSnapshot] = useState<TournamentForm>(normalizeTournamentForm({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    squad_times: {},
  }));

  const buildInitialForm = useCallback((): TournamentForm => {
    if (tournament) {
      return normalizeTournamentForm({
        name: tournament.name || '',
        location: tournament.location || '',
        start_date: tournament.start_date || '',
        end_date: tournament.end_date || '',
        squad_times: tournament.squad_times || {},
      });
    }

    return normalizeTournamentForm({
      name: '',
      location: '',
      start_date: '',
      end_date: '',
      squad_times: {},
    });
  }, [tournament]);

  useEffect(() => {
    if (!open) return;
    const initial = buildInitialForm();
    setTournamentForm(initial);
    setSavedSnapshot(initial);
    setPendingTimes({});
    setValidationError(null);
  }, [open, buildInitialForm]);

  if (!open) return null;

  const tournamentDays = getDatesBetween(tournamentForm.start_date || '', tournamentForm.end_date || '');
  const hasUnsavedChanges = JSON.stringify(normalizeTournamentForm(tournamentForm)) !== JSON.stringify(savedSnapshot);
  const totalSquadTimesAdded = Object.values(tournamentForm.squad_times || {}).reduce((sum, times) => sum + (times?.length || 0), 0);
  const canSave = hasUnsavedChanges && !isSaving && Boolean(tournamentForm.name?.trim());

  const handleCancel = () => {
    setTournamentForm(savedSnapshot);
    setValidationError(null);
    onClose();
  };

  return (
    <div className={`${mobileStyles.modalOverlay} ${mobileStyles.settingsModalOverlay}`}>
      <form
        className={`${mobileStyles.modalCard} ${mobileStyles.tournamentModalContent} ${isCreateMode ? mobileStyles.createTournamentModalContent : ''}`}
        onSubmit={async submitEvent => {
          submitEvent.preventDefault();
          if (!hasUnsavedChanges) return;
          setIsSaving(true);
          setValidationError(null);
          try {
            await onSave(tournamentForm);
            const normalized = normalizeTournamentForm(tournamentForm);
            setSavedSnapshot(normalized);
          } catch (err: unknown) {
            setValidationError(getErrorMessage(err) || 'Failed to save.');
          } finally {
            setIsSaving(false);
          }
        }}
      >
        {validationError && (
          <div className="error-message">{validationError}</div>
        )}
        <CloseControl
          position="absolute"
          onClick={onClose}
          className={`${mobileStyles.closeBtn} ${mobileStyles.settingsModalCloseButton}`}
          label="Close create tournament modal"
          title="Close"
          size="sm"
        />
        <div className={mobileStyles.modalHeader}>
          <h2 className={mobileStyles.modalTitle}>{isCreateMode ? 'Create New Tournament' : 'Edit Tournament'}</h2>
          <p className={mobileStyles.modalSubtitle}>
            {isCreateMode
              ? 'Set up tournament details, dates, and squad times.'
              : 'Update tournament details, dates, and squad times.'}
          </p>
        </div>
        <div className={mobileStyles.tournamentContentWrapper}>
        <div className={mobileStyles.tournamentFormBody}>
          <p className={mobileStyles.tournamentSectionLabel}>Tournament Details</p>
          <div className={mobileStyles.tournamentFormFields}>
            <FormField label="Tournament Name" required>
              <Input
                value={tournamentForm.name}
                onChange={changeEvent => setTournamentForm(f => ({ ...f, name: changeEvent.target.value }))}
                placeholder="Tournament name"
                className={mobileStyles.tournamentInput}
                required
              />
            </FormField>
            <FormField label="Location">
              <Input
                value={tournamentForm.location || ''}
                onChange={changeEvent => setTournamentForm(f => ({ ...f, location: changeEvent.target.value }))}
                placeholder="Bowling center or event location"
                className={mobileStyles.tournamentInput}
              />
            </FormField>
            <p className={mobileStyles.tournamentSectionLabel}>Tournament Dates</p>
            <div className={mobileStyles.tournamentDateRow}>
              <FormField label="Start Date">
                <Input
                  type="date"
                  value={tournamentForm.start_date || ''}
                  onChange={changeEvent => setTournamentForm(f => ({ ...f, start_date: changeEvent.target.value }))}
                  className={`${mobileStyles.tournamentInput} ${mobileStyles.tournamentDateInput}`}
                />
              </FormField>
              <FormField label="End Date">
                <Input
                  type="date"
                  value={tournamentForm.end_date || ''}
                  onChange={changeEvent => setTournamentForm(f => ({ ...f, end_date: changeEvent.target.value }))}
                  className={`${mobileStyles.tournamentInput} ${mobileStyles.tournamentDateInput}`}
                />
              </FormField>
            </div>
          </div>
          <div className={mobileStyles.squadTimesSection}>
            <div className={mobileStyles.squadTimesHeadingRow}>
              <h3 className={mobileStyles.squadTimesTitle}>Squad Times</h3>
              <span className={mobileStyles.squadTimesCount}>{totalSquadTimesAdded} added</span>
            </div>
            {tournamentDays.length === 0 && <p className={mobileStyles.noSquadDaysHint}>Select a start and end date to add squad times for each tournament day.</p>}
            {tournamentDays.map(date => (
              <div key={date} className={mobileStyles.squadDay}>
                <div className={mobileStyles.squadDayLabel}>{formatIsoDateFull(date)}</div>
                <div className={mobileStyles.squadTimesList}>
                  {(tournamentForm.squad_times[date] || []).map((time, i) => (
                    <div key={i} className={mobileStyles.squadTimeEntry}>
                      <span className={mobileStyles.squadTimeText}>{time}</span>
                      <button
                        type="button"
                        className={mobileStyles.squadTimeRemove}
                        onClick={() => setTournamentForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: (f.squad_times[date] ?? []).filter((_, j) => j !== i) } }))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className={mobileStyles.squadTimeAddRow}>
                    <select
                      className={`entries-select ${mobileStyles.squadTimeSelect} ${mobileStyles.tournamentInput}`}
                      value={pendingTimes[date] || ''}
                      onChange={e => setPendingTimes(p => ({ ...p, [date]: e.target.value }))}
                    >
                      <option value="" disabled>Select time</option>
                      <optgroup label="AM">
                        {availableTimeOptions.am.map(timeOption => (
                          <option key={timeOption} value={timeOption}>{timeOption}</option>
                        ))}
                      </optgroup>
                      <optgroup label="PM">
                        {availableTimeOptions.pm.map(timeOption => (
                          <option key={timeOption} value={timeOption}>{timeOption}</option>
                        ))}
                      </optgroup>
                    </select>
                    <button
                      type="button"
                      className={mobileStyles.squadTimeAddBtn}
                      onClick={() => {
                        const pending = pendingTimes[date];
                        if (pending) {
                          setTournamentForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: [...(f.squad_times[date] || []), pending] } }));
                          setPendingTimes(p => ({ ...p, [date]: '' }));
                        }
                      }}
                    >
                      + Add Squad Time
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={mobileStyles.tournamentModalFooter}>
          <div className={`${mobileStyles.tournamentSaveStatus} ${hasUnsavedChanges ? mobileStyles.tournamentSaveStatusDirty : mobileStyles.tournamentSaveStatusSaved}`}>
            {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
          </div>
          <div className={mobileStyles.tournamentModalFooterActions}>
            <button
              type="button"
              className={mobileStyles.tournamentCancelButton}
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={mobileStyles.tournamentSaveButton}
              disabled={!canSave}
            >
              {isSaving ? 'Saving...' : (isCreateMode ? 'Create Tournament' : 'Save Changes')}
            </button>
          </div>
        </div>
        </div>
      </form>
    </div>
  );
}

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
  const [workflowStatus, setWorkflowStatus] = useState<TournamentBootstrapResponse['workflow_status']>(null);
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

  const calculateHouseAmount = useCallback((settings: Pick<BracketSettings, 'bracket_size' | 'default_entry_fee' | 'first_place_amount' | 'second_place_amount'>) => {
    const bracketSize = Number(settings.bracket_size ?? 0);
    const costPerBracket = Number(settings.default_entry_fee ?? 0);
    const firstPlace = Number(settings.first_place_amount ?? 0);
    const secondPlace = Number(settings.second_place_amount ?? 0);
    return (bracketSize * costPerBracket) - firstPlace - secondPlace;
  }, []);

  const applyAutoHouse = useCallback((prev: BracketSettings, patch: Partial<BracketSettings>): BracketSettings => {
    const next = { ...prev, ...patch };
    return {
      ...next,
      house_fee_amount: calculateHouseAmount(next)
    };
  }, [calculateHouseAmount]);

  const computedHouseAmount = useMemo(() => calculateHouseAmount(bracketSettings), [
    bracketSettings,
    calculateHouseAmount,
  ]);

  // Track when component is mounted to prevent premature auto-saves
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Save bracket settings
  const saveBracketSettings = async () => {
    // Prevent save if not mounted or missing tournament
    if (!isMountedRef.current || !tournament?.id) {
      if (tournament?.id) {
        setSaveStatus('error');
        setConfirmMsg('Please load a tournament first before saving bracket settings.');
        setConfirmOpen(true);
      }
      return;
    }
    
    const token = storage.getItem('token');
    if (!token) {
      setSaveStatus('error');
      setConfirmMsg('Please log in to save bracket settings.');
      setConfirmOpen(true);
      return;
    }

    setSavingBracketSettings(true);
    setSaveStatus('saving');
    const latestSettings = bracketSettingsRef.current;

    // Enforce prize split integrity: 1st + 2nd + House must equal bracket_size * entry_fee
    const bracketSize = Number(latestSettings.bracket_size ?? 0);
    const costPerBracket = Number(latestSettings.default_entry_fee ?? 0);
    const firstPlace = Number(latestSettings.first_place_amount ?? 0);
    const secondPlace = Number(latestSettings.second_place_amount ?? 0);
    const normalizedPrograms = normalizeBracketPrograms(latestSettings.bracket_programs, costPerBracket)
    const houseAmount = calculateHouseAmount(latestSettings);
    const expectedTotal = bracketSize * costPerBracket;
    const actualTotal = firstPlace + secondPlace + houseAmount;

    if (houseAmount < 0) {
      setSaveStatus('error');
      addToast({
        type: 'warning',
        message: 'Prize split invalid: 1st + 2nd cannot exceed Bracket Size x Entry Fee.',
        duration: 6000
      });
      return;
    }

    if (Math.abs(actualTotal - expectedTotal) > 0.009) {
      setSaveStatus('error');
      const validationKey = `${expectedTotal.toFixed(2)}|${actualTotal.toFixed(2)}`;
      if (lastPrizeValidationKeyRef.current !== validationKey) {
        addToast({
          type: 'warning',
          message: `Prize split mismatch: 1st + 2nd + House ($${actualTotal.toFixed(2)}) must equal Bracket Size x Entry Fee ($${expectedTotal.toFixed(2)}).`,
          duration: 6000
        });
        lastPrizeValidationKeyRef.current = validationKey;
      }
      return;
    }
    lastPrizeValidationKeyRef.current = '';

    try {
      const data = await apiClient.post<BracketSettings>('/api/v1/bracket-settings/', {
        ...latestSettings,
        bracket_programs: normalizedPrograms,
        house_fee_amount: houseAmount,
        tournament_id: tournament.id
      });
      
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
        return {
          ...settings,
          bracket_size: 8,
          bracket_programs: normalizeBracketPrograms(settings.bracket_programs, settings.default_entry_fee),
          handicap_percentage: settings.handicap_percentage ?? 80,
          handicap_base: settings.handicap_base ?? 200,
        };
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

  const fetchTournamentBootstrap = useCallback(async (tournamentId: number): Promise<TournamentBootstrapResponse | null> => {
    try {
      return await apiClient.get<TournamentBootstrapResponse>(`/api/v1/tournaments/bootstrap?tournament_id=${tournamentId}`, false);
    } catch (error) {
      logger.error('Failed to load tournament bootstrap data', { tournamentId, error: getErrorContext(error) });
      return null;
    }
  }, []);

  // Load bracket settings
  const loadBracketSettings = async (tournamentId: number) => {
    const loaded = await fetchBracketSettingsData(tournamentId);
    setBracketSettings(prev => applyAutoHouse(prev, loaded));
  };

  const loadSidePots = useCallback((tournamentId: number) => {
    try {
      const stored = storage.getItem(SIDE_POTS_STORAGE_KEY(tournamentId));
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SidePotsSettings> & { pots?: Array<Partial<SidePot> & { entry_fee?: number }> };
        // Merge stored pots against current defaults so new pots always appear
        // and old per-pot entry_fee fields are ignored
        const mergedPots = DEFAULT_SIDE_POTS.map(defaultPot => {
          const savedPot = parsed.pots?.find(p => p.key === defaultPot.key);
          return savedPot
            ? { key: defaultPot.key, name: defaultPot.name, enabled: savedPot.enabled ?? false }
            : { ...defaultPot };
        });
        // Top-level fields
        const entry_fee = typeof parsed.entry_fee === 'number' && !isNaN(parsed.entry_fee) ? parsed.entry_fee : 0;
        const prize_amount = typeof parsed.prize_amount === 'number' && !isNaN(parsed.prize_amount) ? parsed.prize_amount : 0;
        const merged: SidePotsSettings = { tournament_id: tournamentId, entry_fee, prize_amount, pots: mergedPots };
        setSidePots(merged);
        // Overwrite stale storage with the merged/clean shape
        storage.setItem(SIDE_POTS_STORAGE_KEY(tournamentId), JSON.stringify(merged));
      } else {
        setSidePots(createDefaultSidePots(tournamentId));
      }
    } catch {
      setSidePots(createDefaultSidePots(tournamentId));
    }
  }, []);

  const saveSidePots = (next: SidePotsSettings) => {
    storage.setItem(SIDE_POTS_STORAGE_KEY(next.tournament_id), JSON.stringify(next));
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

  // Fetch tournaments and restore last loaded tournament from backend on mount - OPTIMIZED
  useEffect(() => {
    const adminFlag = storage.getItem('is_admin');
    setIsAdmin(adminFlag === '1' || adminFlag === 'true');
    
    // Batch read all localStorage data at once
    const lastTournamentId = getSelectedTournamentId();
    const token = storage.getItem('token');

    if (lastTournamentId && token) {
      const bootstrapStarted = performance.now();
      fetchTournamentBootstrap(Number(lastTournamentId))
        .then(bootstrap => {
          const tournamentData = bootstrap?.tournament ?? null;
          const squadsData = bootstrap?.squads ?? [];
          const selectedSquadData = bootstrap?.selected_squad ?? null;
          const loadedBracketSettings = bootstrap?.bracket_settings
            ? {
                ...createDefaultBracketSettings(Number(lastTournamentId)),
                ...bootstrap.bracket_settings,
                bracket_size: 8,
                bracket_programs: normalizeBracketPrograms(
                  bootstrap.bracket_settings.bracket_programs,
                  bootstrap.bracket_settings.default_entry_fee,
                ),
                handicap_percentage: bootstrap.bracket_settings.handicap_percentage ?? 80,
                handicap_base: bootstrap.bracket_settings.handicap_base ?? 200,
              }
            : createDefaultBracketSettings(Number(lastTournamentId));

          const storedSelectedSquadId = getSelectedSquadId();
          const restoredSelectedSquadId = selectedSquadData?.squad_id
            ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null)
            ?? squadsData[0]?.id
            ?? null;

          // Set tournament and related state from the same startup batch.
          if (tournamentData && tournamentData.id) {
            setTournament(tournamentData);
            setWorkflowStatus(bootstrap?.workflow_status ?? null);
            setSelectedTournament(tournamentData.id, tournamentData.name);
            setBracketSettings(prev => applyAutoHouse(prev, loadedBracketSettings));
            loadSidePots(tournamentData.id);
            void loadSquadEntryCounts(tournamentData.id, squadsData);
          } else {
            // Tournament no longer accessible — clear stale localStorage
            clearSelectedTournament({ clearSquad: true });
            setSquadEntryCounts({});
            setWorkflowStatus(null);
          }
          
          // Set squads data
          setSquads(squadsData);
          
          // Set selected squad
          if (restoredSelectedSquadId && squadsData.some((squad: Squad) => squad.id === restoredSelectedSquadId)) {
            const restoredSquad = squadsData.find((squad: Squad) => squad.id === restoredSelectedSquadId) || null;
            setSelectedSquadId(restoredSelectedSquadId);
            setSelectedSquad(restoredSelectedSquadId);
            setActiveSquadLabel(restoredSquad ? [restoredSquad.date, restoredSquad.time].filter(Boolean).join(' ') : '');
          } else {
            setSelectedSquadId(null);
            clearSelectedSquad();
          }

          logger.info('Dashboard bootstrap load completed', {
            tournamentId: Number(lastTournamentId),
            durationMs: Math.round((performance.now() - bootstrapStarted) * 100) / 100,
            squadsCount: squadsData.length,
            hasSelectedSquad: Boolean(selectedSquadData?.squad_id),
            hasBracketSettings: Boolean(bootstrap?.bracket_settings),
          });
        })
        .catch(error => {
          logger.error('Error loading initial dashboard data:', error);
        });
    } else {
      // No stored tournament — clear any stale header strip data
      clearSelectedSquad();
      clearSelectedTournament();
      setWorkflowStatus(null);
    }
  }, [applyAutoHouse, fetchTournamentBootstrap, loadSidePots, loadSquadEntryCounts]);

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

  // Load selected tournament
  const handleLoadTournament = async (t: Tournament) => {
    setTournament(t);
    setWorkflowStatus(null);
    setLoadModalOpen(false);
    loadSidePots(t.id);
    // Optionally, persist tournament id to localStorage for reload (not the full object)
    setSelectedTournament(t.id, t.name);

    // Load squads for this tournament
    const token = storage.getItem('token');
    if (token) {
      try {
        const bootstrap = await fetchTournamentBootstrap(t.id);
        if (!bootstrap || !bootstrap.tournament) {
          throw new Error('Tournament bootstrap payload missing');
        }

        const loadedBracketSettings = bootstrap.bracket_settings
          ? {
              ...createDefaultBracketSettings(t.id),
              ...bootstrap.bracket_settings,
              bracket_size: 8,
              bracket_programs: normalizeBracketPrograms(
                bootstrap.bracket_settings.bracket_programs,
                bootstrap.bracket_settings.default_entry_fee,
              ),
              handicap_percentage: bootstrap.bracket_settings.handicap_percentage ?? 80,
              handicap_base: bootstrap.bracket_settings.handicap_base ?? 200,
            }
          : createDefaultBracketSettings(t.id);
        const squadsData = bootstrap.squads || [];
        const selectedSquadData = bootstrap.selected_squad;

        setTournament(bootstrap.tournament);
        setWorkflowStatus(bootstrap.workflow_status ?? null);
        setSelectedTournament(bootstrap.tournament.id, bootstrap.tournament.name);

        setBracketSettings(prev => applyAutoHouse(prev, loadedBracketSettings));
        setSquads(squadsData);
        void loadSquadEntryCounts(t.id, squadsData);
        
          const storedSelectedSquadId = getSelectedSquadId();
          const restoredSelectedSquadId = selectedSquadData?.squad_id
          ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null)
          ?? squadsData[0]?.id
          ?? null;

        if (restoredSelectedSquadId && squadsData.some(squad => squad.id === restoredSelectedSquadId)) {
          const restoredSquad = squadsData.find(squad => squad.id === restoredSelectedSquadId) || null;
          setSelectedSquadId(restoredSelectedSquadId);
          setSelectedSquad(restoredSelectedSquadId);
          setActiveSquadLabel(restoredSquad ? [restoredSquad.date, restoredSquad.time].filter(Boolean).join(' ') : '');
        } else {
          setSelectedSquadId(null);
          clearSelectedSquad();
        }
      } catch (error) {
        logger.error('Error loading squads for tournament', { tournamentId: t.id, error });
        setWorkflowStatus(null);
        setSquads([]);
        setSquadEntryCounts({});
        addToast({
          type: 'error',
          message: 'Failed to load squads for this tournament',
          duration: 5000
        });
      }
    }
  };

  const handleUnloadTournament = () => {
    const unloadedName = tournament?.name || 'Tournament';
    setTournament(null);
    setWorkflowStatus(null);
    setSquads([]);
    setSquadEntryCounts({});
    setSummaryPlayers([]);
    setSelectedSquadId(null);
    setBracketSettings(createDefaultBracketSettings());
    setSidePots(createDefaultSidePots());
    setSettingsModalOpen(false);
    setSquadModalOpen(false);
    clearSelectedTournament({ clearSquad: true });
    addToast({
      type: 'success',
      message: `${unloadedName} unloaded`,
      duration: 3000,
    });
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

    const normalizeSquadTimes = (squadTimes?: Record<string, string[]>) =>
      Object.fromEntries(
        Object.entries(squadTimes || {})
          .map(([date, times]) => [date, (times || []).filter(Boolean)] as [string, string[]])
          .filter(([, times]) => times.length > 0)
          .sort(([left], [right]) => left.localeCompare(right))
      );

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

  const openIssuesLabel = dataIssuesCount === 1
    ? '1 Open Issue'
    : `${dataIssuesCount} Open Issues`;

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
    {
      key: 'issues',
      label: openIssuesLabel,
      value: '',
      tone: dataIssuesCount > 0 ? 'alert' : 'pending',
      showAlertIcon: dataIssuesCount > 0,
    },
  ]), [bracketsStatusLabel, loadedEntries, scoreStatusLabel, payoutsChipStatusLabel, payoutsCalculated, dataIssuesCount, openIssuesLabel]);
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
  const entriesProgramCountByKey = useMemo(() => {
    const byKey: Record<string, number> = {};
    statsEntrySummary.programSummaries.forEach(program => {
      byKey[program.key] = program.totalEntries;
    });
    return byKey;
  }, [statsEntrySummary.programSummaries]);

  const percentOfTotalEntries = useCallback((count: number) => {
    if (statsEntrySummary.totalEntries <= 0) return null;
    return `${Math.round((count / statsEntrySummary.totalEntries) * 100)}% of entries`;
  }, [statsEntrySummary.totalEntries]);

  const tournamentSummaryCards = useMemo(() => {
    const handicapCount = entriesProgramCountByKey.handicap ?? 0;
    const scratchCount = entriesProgramCountByKey.scratch ?? 0;
    const reverseScratchCount = entriesProgramCountByKey.reverse_scratch ?? 0;
    const womensScratchCount = entriesProgramCountByKey.womens_scratch ?? 0;

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
      {
        key: 'summary-handicap',
        label: 'Handicap',
        value: `${handicapCount}`,
        helperPrimary: percentOfTotalEntries(handicapCount) ?? undefined,
        href: '/players',
      },
      {
        key: 'summary-scratch',
        label: 'Scratch',
        value: `${scratchCount}`,
        helperPrimary: percentOfTotalEntries(scratchCount) ?? undefined,
        href: '/players',
      },
      {
        key: 'summary-reverse-scratch',
        label: 'Reverse Scratch',
        value: `${reverseScratchCount}`,
        helperPrimary: percentOfTotalEntries(reverseScratchCount) ?? undefined,
        href: '/players',
      },
      {
        key: 'summary-womens-scratch',
        label: "Women's Scratch",
        value: `${womensScratchCount}`,
        helperPrimary: percentOfTotalEntries(womensScratchCount) ?? undefined,
        href: '/players',
      },
    ];
  }, [entriesProgramCountByKey, formatUsd, loadedEntries, percentOfTotalEntries, statsEntrySummary.totalEntries, statsEntrySummary.totalRevenue]);

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
                              if (chip.key === 'issues') {
                                router.push('/players');
                                return;
                              }
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
                            {chip.showAlertIcon ? <span className={mobileStyles.heroStatusAlertIcon} aria-hidden="true">!</span> : null}
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
                                <button className={mobileStyles.loadBtn} onClick={() => handleLoadTournament(t)}>
                                  {isActiveTournament ? 'Reload' : 'Load'}
                                </button>
                                <button className={mobileStyles.deleteBtn} onClick={() => setDeleteConfirm({id: t.id, name: t.name})}>Delete</button>
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






