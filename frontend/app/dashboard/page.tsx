"use client";

import { useMemo, useEffect, useState, useRef } from 'react';
import { Tournament, Squad, BracketSettings, TournamentForm, SidePotsSettings, SidePot } from '../lib/types';

import { usePageHeader } from '../lib/header-context';
import { useAuth } from '../lib/auth-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getErrorMessage, getErrorContext } from '../lib/error-utils';
import mobileStyles from './dashboard.module.css';
import { ConfirmationDialog } from '../components/LazyComponents';
import { MobileForm, MobileFormField } from '../../components/MobileForm';
import { API, apiClient, apiFetch } from '../lib/api';
import { logger } from '../lib/logger';
import { defaultBracketPrograms, normalizeBracketPrograms } from '../lib/bracketPrograms';
import EnhancedButton from '../components/EnhancedButton';
import { useToast } from '../components/Toast';
import { usePagination } from '../components/Performance';
import { FormField, Input, Select } from '../components/UI';
import ShareQRModal from '../components/ShareQRModal';
import ActionConfirmDialog from '../components/ActionConfirmDialog';
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

function get12hrTimes() {
  const availableTimeSlots: string[] = [];
  // First all AM times
  for (let hour = 1; hour <= 12; hour++) {
    for (let minutes = 0; minutes < 60; minutes += 30) {
      availableTimeSlots.push(`${hour}:${minutes.toString().padStart(2, '0')} AM`);
    }
  }
  // Then all PM times
  for (let hour = 1; hour <= 12; hour++) {
    for (let minutes = 0; minutes < 60; minutes += 30) {
      availableTimeSlots.push(`${hour}:${minutes.toString().padStart(2, '0')} PM`);
    }
  }
  return availableTimeSlots;
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

function EditTournamentModal({ open, onClose, tournament, onSave, isMobile, isCreateMode }: {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onSave: (tournamentData: TournamentForm) => void;
  isMobile: boolean;
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
  // Track which input to focus (date, index)
  const [focusedTimeSlot, setFocusedTimeSlot] = useState<{date: string, idx: number} | null>(null);
  
  // Memoize timeInputs to prevent recreation on every render
  const timeSlotInputReferences = useMemo(() => {
    const inputRefs: Record<string, Array<HTMLSelectElement | null>> = {};
    return inputRefs;
  }, []);

  useEffect(() => {
    if (!open) return;
    if (tournament) {
      setTournamentForm({
        name: tournament.name || '',
        location: tournament.location || '',
        start_date: tournament.start_date || '',
        end_date: tournament.end_date || '',
        squad_times: tournament.squad_times || {}
      });
    } else {
      setTournamentForm({ name: '', location: '', start_date: '', end_date: '', squad_times: {} });
    }
  }, [open, tournament]);

  // Focus new time input when added
  useEffect(() => {
    if (focusedTimeSlot && timeSlotInputReferences[focusedTimeSlot.date]?.[focusedTimeSlot.idx]) {
      timeSlotInputReferences[focusedTimeSlot.date][focusedTimeSlot.idx]?.focus();
      setFocusedTimeSlot(null);
    }
  }, [focusedTimeSlot, timeSlotInputReferences]);

  if (!open) return null;

  const tournamentDays = getDatesBetween(tournamentForm.start_date || '', tournamentForm.end_date || '');

  return (
    <div className="modal-overlay">
      <form
        className={`modal-content ${isCreateMode ? mobileStyles.createTournamentModalContent : ''}`}
        onSubmit={async submitEvent => {
          submitEvent.preventDefault();
          setIsSaving(true);
          setValidationError(null);
          try {
            // Debug: log form data
            // eslint-disable-next-line no-console
            logger.debug('Submitting tournament form', { tournamentForm });
            await onSave(tournamentForm);
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
        <CloseControl position="absolute" onClick={onClose} />
        <h2>{isCreateMode ? 'Create Tournament' : 'Edit Tournament'}</h2>
        <div>
        {isMobile ? (
          // Mobile Form Layout
          <MobileForm
            title={isCreateMode ? 'Create Tournament' : 'Edit Tournament'}
            flat
            onSubmit={async (submitEvent) => {
              submitEvent.preventDefault();
              setIsSaving(true);
              setValidationError(null);
              try {
                await onSave(tournamentForm);
              } catch (err: unknown) {
                setValidationError(getErrorMessage(err) || 'Failed to save.');
              } finally {
                setIsSaving(false);
              }
            }}
            isSubmitting={isSaving}
            submitText={isSaving ? 'Saving...' : 'Save Tournament'}
          >
            <MobileFormField
              label="Tournament Name"
              value={tournamentForm.name}
              onChange={(value: string) => setTournamentForm(f => ({ ...f, name: value }))}
              required={true}
              placeholder="Enter tournament name"
            />
            
            <MobileFormField
              label="Location"
              value={tournamentForm.location || ''}
              onChange={(value: string) => setTournamentForm(f => ({ ...f, location: value }))}
              placeholder="Enter tournament location"
            />
            
            <MobileFormField
              label="Start Date"
              type="text"
              value={tournamentForm.start_date || ''}
              onChange={(value: string) => setTournamentForm(f => ({ ...f, start_date: value }))}
              placeholder="YYYY-MM-DD"
            />
            
            <MobileFormField
              label="End Date"
              type="text"
              value={tournamentForm.end_date || ''}
              onChange={(value: string) => setTournamentForm(f => ({ ...f, end_date: value }))}
              placeholder="YYYY-MM-DD"
            />
          </MobileForm>
        ) : (
          // Desktop Form Layout
          <>
        <div className={`form-grid ${isCreateMode ? mobileStyles.createTournamentFormGrid : ''}`}>
          <div>
            <FormField label="Name" required>
              <Input
                value={tournamentForm.name}
                onChange={changeEvent => setTournamentForm(f => ({ ...f, name: changeEvent.target.value }))}
                placeholder="Tournament name"
                required
              />
            </FormField>
            <FormField label="Location">
              <Input
                value={tournamentForm.location || ''}
                onChange={changeEvent => setTournamentForm(f => ({ ...f, location: changeEvent.target.value }))}
                placeholder="Tournament location"
              />
            </FormField>
            <FormField label="Start Date">
              <Input
                type="date"
                value={tournamentForm.start_date || ''}
                onChange={changeEvent => setTournamentForm(f => ({ ...f, start_date: changeEvent.target.value }))}
              />
            </FormField>
            <FormField label="End Date">
              <Input
                type="date"
                value={tournamentForm.end_date || ''}
                onChange={changeEvent => setTournamentForm(f => ({ ...f, end_date: changeEvent.target.value }))}
              />
            </FormField>
          </div>
          <div>
            <h3>Squad Times by Day</h3>
            {tournamentDays.length === 0 && <p className="text-secondary">Select start and end dates to add squad times.</p>}
            {tournamentDays.map(date => (
              <div key={date} className="squad-day">
                <div className="squad-day-label">{date}</div>
                {(tournamentForm.squad_times[date] || []).map((time, i) => {
                  if (!timeSlotInputReferences[date]) timeSlotInputReferences[date] = [];
                  return (
                    <div key={i} className="squad-time-row">
                      <select
                        className="form-select"
                        ref={el => { timeSlotInputReferences[date][i] = el as HTMLSelectElement | null; }}
                        value={time}
                        onChange={changeEvent => setTournamentForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: f.squad_times[date].map((t, j) => j === i ? changeEvent.target.value : t) } }))}
                      >
                        <option value="" disabled>Select time</option>
                        {availableTimeOptions.map(timeOption => (
                          <option key={timeOption} value={timeOption}>{timeOption}</option>
                        ))}
                      </select>
                      <CloseControl
                        onClick={() => setTournamentForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: f.squad_times[date].filter((_, j) => j !== i) } }))}
                        label="Remove squad time"
                        size="xs"
                      />
                    </div>
                  );
                })}
                <EnhancedButton
                  type="button"
                  onClick={() => {
                    const times = tournamentForm.squad_times[date] || [];
                    // Only add if last is selected
                    if (times.length === 0 || (times[times.length - 1] && times[times.length - 1] !== '')) {
                      setTournamentForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: [...(f.squad_times[date] || []), ''] } }));
                      setFocusedTimeSlot({ date, idx: (tournamentForm.squad_times[date]?.length || 0) });
                    }
                  }}
                  variant="secondary"
                  size="sm"
                  disableSuccessState
                >
                  Add Time
                </EnhancedButton>
              </div>
            ))}
          </div>
        </div>
        <div className={`action-group ${isCreateMode ? mobileStyles.createTournamentActionGroup : ''}`}>
          <EnhancedButton
            type="submit"
            variant="primary"
            loading={isSaving}
          >
            Save
          </EnhancedButton>
          <EnhancedButton
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </EnhancedButton>
        </div>
        </>
        )}
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
    localStorage.getItem('token') && 
    localStorage.getItem('user_id');

  // All hooks must be called before conditional returns (React rules of hooks)
  const [isAdmin, setIsAdmin] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [optionalToggleConfirm, setOptionalToggleConfirm] = useState<{ programKey: string; programName: string; existingEntries: number } | null>(null);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: number, name: string} | null>(null);
  const [shareQROpen, setShareQROpen] = useState(false);
  
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

  const calculateHouseAmount = (settings: Pick<BracketSettings, 'bracket_size' | 'default_entry_fee' | 'first_place_amount' | 'second_place_amount'>) => {
    const bracketSize = Number(settings.bracket_size ?? 0);
    const costPerBracket = Number(settings.default_entry_fee ?? 0);
    const firstPlace = Number(settings.first_place_amount ?? 0);
    const secondPlace = Number(settings.second_place_amount ?? 0);
    return (bracketSize * costPerBracket) - firstPlace - secondPlace;
  };

  const applyAutoHouse = (prev: BracketSettings, patch: Partial<BracketSettings>): BracketSettings => {
    const next = { ...prev, ...patch };
    return {
      ...next,
      house_fee_amount: calculateHouseAmount(next)
    };
  };

  const computedHouseAmount = useMemo(() => calculateHouseAmount(bracketSettings), [
    bracketSettings
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
    
    const token = localStorage.getItem('token');
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
    const token = localStorage.getItem('token');
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

  const fetchTournamentBootstrap = async (tournamentId: number): Promise<TournamentBootstrapResponse | null> => {
    try {
      return await apiClient.get<TournamentBootstrapResponse>(`/api/v1/tournaments/bootstrap?tournament_id=${tournamentId}`, false);
    } catch (error) {
      logger.error('Failed to load tournament bootstrap data', { tournamentId, error: getErrorContext(error) });
      return null;
    }
  };

  // Load bracket settings
  const loadBracketSettings = async (tournamentId: number) => {
    const loaded = await fetchBracketSettingsData(tournamentId);
    setBracketSettings(prev => applyAutoHouse(prev, loaded));
  };

  const loadSidePots = (tournamentId: number) => {
    try {
      const stored = localStorage.getItem(SIDE_POTS_STORAGE_KEY(tournamentId));
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
        localStorage.setItem(SIDE_POTS_STORAGE_KEY(tournamentId), JSON.stringify(merged));
      } else {
        setSidePots(createDefaultSidePots(tournamentId));
      }
    } catch {
      setSidePots(createDefaultSidePots(tournamentId));
    }
  };

  const saveSidePots = (next: SidePotsSettings) => {
    localStorage.setItem(SIDE_POTS_STORAGE_KEY(next.tournament_id), JSON.stringify(next));
    notifySettingsChanged();
  };

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

    const token = localStorage.getItem('token');
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
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
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
    const adminFlag = localStorage.getItem('is_admin');
    setIsAdmin(adminFlag === '1' || adminFlag === 'true');
    
    // Batch read all localStorage data at once
    const lastTournamentId = getSelectedTournamentId();
    const token = localStorage.getItem('token');

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
            ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null);

          // Set tournament and related state from the same startup batch.
          if (tournamentData && tournamentData.id) {
            setTournament(tournamentData);
            setSelectedTournament(tournamentData.id, tournamentData.name);
            setBracketSettings(prev => applyAutoHouse(prev, loadedBracketSettings));
            loadSidePots(tournamentData.id);
          } else {
            // Tournament no longer accessible — clear stale localStorage
            clearSelectedTournament({ clearSquad: true });
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
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch tournaments when load modal opens
  useEffect(() => {
    if (loadModalOpen) {
      fetchAllTournaments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadModalOpen, isAdmin]);

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

  // Fetch all tournaments for user when load modal opens
  const fetchAllTournaments = async () => {
    const path = isAdmin ? '/api/v1/tournaments/?all=1' : '/api/v1/tournaments/';
    try {
      const data = await apiClient.get<any[]>(path);
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

  // Load selected tournament
  const handleLoadTournament = async (t: Tournament) => {
    setTournament(t);
    setLoadModalOpen(false);
    loadSidePots(t.id);
    // Optionally, persist tournament id to localStorage for reload (not the full object)
    setSelectedTournament(t.id, t.name);

    // Load squads for this tournament
    const token = localStorage.getItem('token');
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
        setSelectedTournament(bootstrap.tournament.id, bootstrap.tournament.name);

        setBracketSettings(prev => applyAutoHouse(prev, loadedBracketSettings));
        setSquads(squadsData);
        
        const storedSelectedSquadId = getSelectedSquadId();
        const restoredSelectedSquadId = selectedSquadData?.squad_id
          ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null);

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
        setSquads([]);
        addToast({
          type: 'error',
          message: 'Failed to load squads for this tournament',
          duration: 5000
        });
      }
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
        setSquads([]);
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
    const token = localStorage.getItem('token');
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
          // Auto-load the newly created tournament
          setSelectedTournament(savedTournament.id, savedTournament.name);
          loadBracketSettings(savedTournament.id);
          loadSidePots(savedTournament.id);
          addToast({
            type: 'success',
            message: `Tournament "${tournamentFormData.name}" created successfully!`,
            duration: 4000
          });
        } else {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.detail || `Failed to create tournament: ${res.status}`);
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
          if (!isOnlySquadTimesUpdate) {
            addToast({
              type: 'success',
              message: `Tournament "${tournamentFormData.name}" updated successfully!`,
              duration: 4000
            });
          }
        } else {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.detail || `Failed to update tournament: ${res.status}`);
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
            const errorData = await syncRes.json().catch(() => null);
            logger.warn('Squad sync failed', { status: syncRes.status, errorData });
            addToast({
              type: 'warning',
              message: `Squad sync failed: ${errorData?.detail || 'Unknown error'}. Please refresh the page.`,
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

  // Set up page header with action buttons
  const headerActions = useMemo(() => (
    <div className={mobileStyles.headerActions}>
      {tournament ? (
        <>
          <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={() => { setCreateMode(false); setModalOpen(true); }}>
            Edit Tournament
          </button>
          <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={() => setShareQROpen(true)}>
            Share QR
          </button>
          <button
            className="ds-btn ds-btn-destructive ds-btn-sm"
            onClick={() => {
              setTournament(null);
              setSquads([]);
              setSelectedSquadId(null);
              setBracketSettings(createDefaultBracketSettings());
              setSidePots(createDefaultSidePots());
              clearSelectedTournament({ clearSquad: true });
              addToast({ type: 'success', message: 'Tournament unloaded successfully', duration: 3000 });
            }}
          >
            Unload Tournament
          </button>
          <button
            className={`ds-btn ds-btn-destructive ds-btn-sm ${mobileStyles.headerDeleteBtn}`}
            onClick={() => setDeleteConfirm({ id: tournament.id, name: tournament.name })}
          >
            Delete Tournament
          </button>
          {selectedSquadId !== null && (
            <div className={mobileStyles.devGroup}>
              <button
                className={mobileStyles.devButton}
                onClick={async () => {
                  setSelectedSquadId(null);
                  clearSelectedSquad();
                  const token = localStorage.getItem('token');
                  const userId = localStorage.getItem('user_id');
                  if (token && userId) {
                    await apiFetch(API('/api/v1/squads/select/'), {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ user_id: Number(userId) }),
                    });
                  }
                }}
              >
                Unload Squad
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={() => { setCreateMode(true); setModalOpen(true); }}>
            + New Tournament
          </button>
          <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={() => setLoadModalOpen(true)}>
            Load Tournament
          </button>
        </>
      )}
    </div>
  ), [tournament, selectedSquadId, addToast]);

  const selectedSquad = squads.find(s => s.id === selectedSquadId)
  const squadLabel = selectedSquad ? ` · ${[selectedSquad.date, selectedSquad.time].filter(Boolean).join(' ')}` : ''
  const enabledOptionalProgramsCount = normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee)
    .filter(program => program.key !== 'handicap' && program.key !== 'scratch' && program.key !== 'reverse' && Boolean(program.enabled)).length;
  const enabledByeProgramsCount = normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee)
    .filter(program => (program.key === 'handicap' || program.key === 'scratch' || Boolean(program.enabled)) && Boolean(program.allow_byes ?? bracketSettings.allow_byes ?? false)).length;
  const enabledSidePotsCount = sidePots.pots.filter(pot => pot.enabled).length;

  useEffect(() => {
    if (selectedSquadId !== null) {
      setSelectedSquad(selectedSquadId);
    }
  }, [selectedSquadId]);

  useEffect(() => {
    const label = selectedSquad ? [selectedSquad.date, selectedSquad.time].filter(Boolean).join(' ') : '';
    setActiveSquadLabel(label);
  }, [selectedSquad]);

  usePageHeader({
    title: "Tournament Dashboard",
    subtitle: undefined,
    centerContent: false,
    actions: headerActions
  });

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
          isMobile={isMobile}
          isCreateMode={createMode}
        />
        <main className="page-main">

          <div className={mobileStyles.contentContainer}>
            <div className={mobileStyles.cardsContainer}>

            {/* Empty State - No Tournament Loaded */}
            {!tournament && (
              <div className={mobileStyles.emptyState}>
                <h2 className={mobileStyles.emptyStateTitle}>Welcome to Tournament Dashboard</h2>
                <p className={mobileStyles.emptyStateText}>
                  Get started by creating a new tournament or loading an existing one to manage brackets, squads, and settings.
                </p>
                <div className={mobileStyles.emptyStateButtons}>
                  <button className={mobileStyles.emptyStatePrimaryBtn} onClick={() => { setCreateMode(true); setModalOpen(true); }}>
                    Create New Tournament
                  </button>
                  <button className={mobileStyles.emptyStateSecondaryBtn} onClick={() => setLoadModalOpen(true)}>
                    Load Existing Tournament
                  </button>
                </div>

                <div className={mobileStyles.infoCards}>
                  <div className={mobileStyles.infoCard}>
                    <h3 className={mobileStyles.infoCardTitle}>Configure Settings</h3>
                    <p className={mobileStyles.infoCardText}>Set up bracket sizes, prizes, and handicap rules</p>
                  </div>
                  <div className={mobileStyles.infoCard}>
                    <h3 className={mobileStyles.infoCardTitle}>Manage Squads</h3>
                    <p className={mobileStyles.infoCardText}>Create and organize multiple squads with dates and times</p>
                  </div>
                  <div className={mobileStyles.infoCard}>
                    <h3 className={mobileStyles.infoCardTitle}>Track Results</h3>
                    <p className={mobileStyles.infoCardText}>Generate brackets, enter scores, and manage payouts</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Squad Selection Card */}
            {tournament && squads.length > 0 && (
              <div className={`${mobileStyles.squadSelectionCard} ${mobileStyles.squadSelectionCompactCard}`}>
                <button
                  type="button"
                  className={`${mobileStyles.settingsHeader} ${mobileStyles.settingsHeaderToggle}`}
                  onClick={() => toggleCard('squadSelection')}
                  aria-expanded={isCardExpanded('squadSelection')}
                  aria-controls="dashboard-squad-selection-content"
                >
                  <div className={mobileStyles.settingsTitleBlock}>
                    <h2 className={mobileStyles.settingsTitle}>Squad Selection</h2>
                    <div className={mobileStyles.settingsMeta}>{squads.length} squads configured</div>
                  </div>
                  {isMobile && (
                    <span className={mobileStyles.cardExpandIcon} aria-hidden="true">
                      {isCardExpanded('squadSelection') ? '−' : '+'}
                    </span>
                  )}
                </button>

                {isCardExpanded('squadSelection') && (
                <div id="dashboard-squad-selection-content" className={mobileStyles.squadGrid}>
                  <div className={mobileStyles.cardQuickStats}>
                    <span className={mobileStyles.cardPrimaryStat}>{selectedSquad ? [selectedSquad.date, selectedSquad.time].filter(Boolean).join(' ') : 'No squad selected'}</span>
                    <span className={mobileStyles.cardSecondaryStat}>Active Squad</span>
                  </div>
                  {squads.map((squad) => {
                    const isSelected = selectedSquadId === squad.id;
                    
                    return (
                      <button
                        key={squad.id}
                        className={`${mobileStyles.squadPillEnhanced} ${isSelected ? mobileStyles.selected : ''}`}
                        onClick={async (changeEvent) => { changeEvent.preventDefault();
                          setSelectedSquadId(squad.id);
                          setSelectedSquad(squad.id);
                          setActiveSquadLabel([squad.date, squad.time].filter(Boolean).join(' '));
                          const token = localStorage.getItem('token');
                          const userId = localStorage.getItem('user_id');
                          if (token && userId) {
                            await apiFetch(API('/api/v1/squads/select/'), {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({
                                user_id: Number(userId),
                                squad_id: squad.id
                              })
                            });
                          }
                        }}
                        aria-pressed={isSelected}
                      >
                        <div className={mobileStyles.squadTime}>
                          <div className={mobileStyles.squadDate}>{squad.date}</div>
                          <div className={mobileStyles.squadTimeSlot}>{squad.time}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* Bracket Settings Card */}
            {tournament && (
              <div className={`${mobileStyles.bracketSettingsCard} ${mobileStyles.mainBracketSettingsCard}`}>
                <button
                  type="button"
                  className={`${mobileStyles.settingsHeader} ${mobileStyles.settingsHeaderToggle}`}
                  onClick={() => toggleCard('bracketSettings')}
                  aria-expanded={isCardExpanded('bracketSettings')}
                  aria-controls="dashboard-bracket-settings-content"
                >
                  <div className={mobileStyles.settingsTitleBlock}>
                    <h2 className={mobileStyles.settingsTitle}>Bracket Settings</h2>
                    <div className={mobileStyles.settingsMeta}>Primary tournament configuration</div>
                  </div>
                  {isMobile && (
                    <span className={mobileStyles.cardExpandIcon} aria-hidden="true">
                      {isCardExpanded('bracketSettings') ? '−' : '+'}
                    </span>
                  )}
                </button>

                {isCardExpanded('bracketSettings') && (
                <div id="dashboard-bracket-settings-content" className={mobileStyles.settingsContent}>
                  <div className={mobileStyles.cardQuickStatsRow}>
                    <div className={mobileStyles.cardQuickStatItem}>
                      <span className={mobileStyles.cardPrimaryStat}>{formatCurrencyLabel(bracketSettings.default_entry_fee)}</span>
                      <span className={mobileStyles.cardSecondaryStat}>Entry Fee</span>
                    </div>
                    <div className={mobileStyles.cardQuickStatItem}>
                      <span className={mobileStyles.cardPrimaryStat}>{formatCurrencyLabel(computedHouseAmount)}</span>
                      <span className={mobileStyles.cardSecondaryStat}>House (Auto)</span>
                    </div>
                  </div>
                  {/* Main Settings Grid */}
                  <div className={mobileStyles.settingsGrid}>
                    
                    {/* Left Column - Tournament Basics */}
                    <div className={mobileStyles.settingsColumn}>
                      <div className={mobileStyles.sectionHeader}>
                        <h3 className={mobileStyles.sectionTitle}>Tournament</h3>
                      </div>
                      
                      <div className={mobileStyles.fieldGroup}>
                        <div className={mobileStyles.compactField}>
                          <label className={mobileStyles.compactLabel}>Bracket Size</label>
                          <select
                            className={mobileStyles.compactSelect}
                            value={bracketSettings.bracket_size}
                            onChange={changeEvent => {
                              updateBracketSettings(
                                previous => applyAutoHouse(previous, { bracket_size: parseInt(changeEvent.target.value) }),
                                'immediate',
                              );
                            }}
                          >
                            <option value={8}>8 Players</option>
                          </select>
                        </div>
                        
                        <div className={mobileStyles.compactField}>
                          <label className={mobileStyles.compactLabel}>Entry Fee</label>
                          <div className={mobileStyles.compactInputWrapper}>
                            <span className={mobileStyles.currencySymbol}>$</span>
                            <input
                              className={mobileStyles.compactInput}
                              type="text"
                              placeholder="0"
                              value={formatNumberInput(bracketSettings.default_entry_fee)}
                              onChange={changeEvent => {
                                const numericValue = parseCurrencyInput(changeEvent.target.value);
                                updateBracketSettings(
                                  previous => applyAutoHouse(previous, { default_entry_fee: numericValue }),
                                  'none',
                                );
                              }}
                              onBlur={() => {
                                saveBracketSettingsImmediately();
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Prize Structure */}
                    <div className={mobileStyles.settingsColumn}>
                      <div className={mobileStyles.sectionHeader}>
                        <h3 className={mobileStyles.sectionTitle}>Prizes</h3>
                      </div>
                      
                      <div className={mobileStyles.fieldGroup}>
                        <div className={mobileStyles.compactField}>
                          <label className={mobileStyles.compactLabel}>1st Place</label>
                          <div className={mobileStyles.compactInputWrapper}>
                            <span className={mobileStyles.currencySymbol}>$</span>
                            <input
                              className={mobileStyles.compactInput}
                              type="text"
                              placeholder="0"
                              value={formatNumberInput(bracketSettings.first_place_amount)}
                              onChange={changeEvent => {
                                const numericValue = parseCurrencyInput(changeEvent.target.value);
                                updateBracketSettings(
                                  previous => applyAutoHouse(previous, { first_place_amount: numericValue }),
                                  'none',
                                );
                              }}
                              onBlur={() => {
                                saveBracketSettingsImmediately();
                              }}
                            />
                          </div>
                        </div>

                        <div className={mobileStyles.compactField}>
                          <label className={mobileStyles.compactLabel}>2nd Place</label>
                          <div className={mobileStyles.compactInputWrapper}>
                            <span className={mobileStyles.currencySymbol}>$</span>
                            <input
                              className={mobileStyles.compactInput}
                              type="text"
                              placeholder="0"
                              value={formatNumberInput(bracketSettings.second_place_amount)}
                              onChange={changeEvent => {
                                const numericValue = parseCurrencyInput(changeEvent.target.value);
                                updateBracketSettings(
                                  previous => applyAutoHouse(previous, { second_place_amount: numericValue }),
                                  'none',
                                );
                              }}
                              onBlur={() => {
                                saveBracketSettingsImmediately();
                              }}
                            />
                          </div>
                        </div>

                        <div className={mobileStyles.compactField}>
                          <label className={mobileStyles.compactLabel}>House Take (Auto)</label>
                          <div className={mobileStyles.compactInputWrapper}>
                            <span className={mobileStyles.currencySymbol}>$</span>
                            <input
                              className={mobileStyles.compactInput}
                              type="text"
                              placeholder="0"
                              value={formatNumberInput(computedHouseAmount)}
                              readOnly
                              title="Auto-calculated as (Bracket Size × Entry Fee) - 1st Place - 2nd Place"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Handicap Settings - Full Width */}
                  <div className={mobileStyles.settingsSection}>
                    <div className={mobileStyles.sectionHeader}>
                      <h3 className={mobileStyles.sectionTitle}>Handicap</h3>
                    </div>
                    
                    <div className={mobileStyles.handicapContainer}>
                      <div className={mobileStyles.handicapField}>
                        <label className={mobileStyles.compactLabel}>Percentage</label>
                        <div className={mobileStyles.handicapPercentRow}>
                          <input
                            className={mobileStyles.compactInput}
                            type="number"
                            min="0"
                            max="100"
                            placeholder="80"
                            value={bracketSettings.handicap_percentage || ''}
                            onChange={changeEvent => {
                              const inputValue = changeEvent.target.value;
                              const numValue = parseInt(inputValue);
                              const value = isNaN(numValue) ? 80 : Math.min(100, Math.max(0, numValue));
                              updateBracketSettings(previous => ({ ...previous, handicap_percentage: value }), 'none');
                            }}
                            onBlur={() => {
                              // Trigger autosave only when user leaves the field
                              if (!bracketSettingsRef.current.handicap_percentage || bracketSettingsRef.current.handicap_percentage < 0) {
                                updateBracketSettings(previous => ({ ...previous, handicap_percentage: 80 }), 'immediate');
                                return;
                              }
                              saveBracketSettingsImmediately();
                            }}
                          />
                          <span className={mobileStyles.percentLabel}>%</span>
                        </div>
                      </div>
                      
                      <div className={mobileStyles.handicapSeparator}>of</div>
                      
                      <div className={mobileStyles.handicapField}>
                        <label className={mobileStyles.compactLabel}>Base</label>
                        <input
                          className={mobileStyles.compactInput}
                          type="number"
                          min="1"
                          placeholder="200"
                          value={bracketSettings.handicap_base || ''}
                          onChange={changeEvent => {
                            const inputValue = changeEvent.target.value;
                            const numValue = parseInt(inputValue);
                            const value = isNaN(numValue) ? 200 : Math.max(1, numValue);
                            updateBracketSettings(previous => ({ ...previous, handicap_base: value }), 'none');
                          }}
                          onBlur={() => {
                            // Trigger autosave only when user leaves the field
                            if (!bracketSettingsRef.current.handicap_base || bracketSettingsRef.current.handicap_base < 1) {
                              updateBracketSettings(previous => ({ ...previous, handicap_base: 200 }), 'immediate');
                              return;
                            }
                            saveBracketSettingsImmediately();
                          }}
                        />
                      </div>
                    </div>
                  </div>

                </div>
                )}
              </div>
            )}

            {tournament && (
              <div className={`${mobileStyles.bracketSettingsCard} ${mobileStyles.optionalBracketsCard}`}>
                <button
                  type="button"
                  className={`${mobileStyles.settingsHeader} ${mobileStyles.settingsHeaderToggle}`}
                  onClick={() => toggleCard('byeSettings')}
                  aria-expanded={isCardExpanded('byeSettings')}
                  aria-controls="dashboard-bye-settings-content"
                >
                  <div className={mobileStyles.settingsTitleBlock}>
                    <h2 className={mobileStyles.settingsTitle}>Bye Settings</h2>
                    <div className={mobileStyles.settingsMeta}>{enabledByeProgramsCount} programs allow byes</div>
                  </div>
                  {isMobile && (
                    <span className={mobileStyles.cardExpandIcon} aria-hidden="true">
                      {isCardExpanded('byeSettings') ? '−' : '+'}
                    </span>
                  )}
                </button>

                {isCardExpanded('byeSettings') && (
                <div id="dashboard-bye-settings-content" className={mobileStyles.settingsContent}>
                  <div className={mobileStyles.programList}>
                    {(() => {
                      const visibleForByes = normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee)
                        .filter(program => program.key === 'handicap' || program.key === 'scratch' || Boolean(program.enabled))
                      const orderedVisibleForByes = [...visibleForByes].sort((left, right) =>
                        left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
                      )
                      const renderCard = (program: typeof visibleForByes[number]) => (
                        <div key={`bye-${program.key}`} className={mobileStyles.programCard}>
                          <label className={mobileStyles.checkboxLabel}>
                            <input
                              type="checkbox"
                              className={mobileStyles.checkboxInput}
                              checked={Boolean(program.allow_byes ?? bracketSettings.allow_byes ?? false)}
                              onChange={event => {
                                handleByeProgramToggle(program.key, event.target.checked)
                              }}
                            />
                            <span>{program.name}</span>
                          </label>
                        </div>
                      )
                      return orderedVisibleForByes.map(renderCard)
                    })()}
                  </div>
                </div>
                )}
              </div>
            )}

            {tournament && (
              <div className={`${mobileStyles.bracketSettingsCard} ${mobileStyles.optionalBracketsCard}`}>
                <button
                  type="button"
                  className={`${mobileStyles.settingsHeader} ${mobileStyles.settingsHeaderToggle}`}
                  onClick={() => toggleCard('optionalBrackets')}
                  aria-expanded={isCardExpanded('optionalBrackets')}
                  aria-controls="dashboard-optional-brackets-content"
                >
                  <div className={mobileStyles.settingsTitleBlock}>
                    <h2 className={mobileStyles.settingsTitle}>Optional Brackets</h2>
                    <div className={mobileStyles.settingsMeta}>{enabledOptionalProgramsCount} enabled</div>
                  </div>
                  {isMobile && (
                    <span className={mobileStyles.cardExpandIcon} aria-hidden="true">
                      {isCardExpanded('optionalBrackets') ? '−' : '+'}
                    </span>
                  )}
                </button>

                {isCardExpanded('optionalBrackets') && (
                <div id="dashboard-optional-brackets-content" className={mobileStyles.settingsContent}>
                  <div className={mobileStyles.programList}>
                    {(() => {
                      const optional = normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee)
                        .filter(program => program.key !== 'handicap' && program.key !== 'scratch' && program.key !== 'reverse')
                      const orderedOptional = [...optional].sort((left, right) =>
                        left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
                      )
                      const renderCard = (program: typeof optional[number]) => (
                        <div key={program.key} className={mobileStyles.programCard}>
                          <label className={mobileStyles.checkboxLabel}>
                            <input
                              type="checkbox"
                              className={mobileStyles.checkboxInput}
                              checked={program.enabled ?? false}
                              onChange={event => {
                                void handleOptionalBracketToggle(program.key, event.target.checked)
                              }}
                            />
                            <span>{program.name}</span>
                          </label>
                        </div>
                      )
                      return orderedOptional.map(renderCard)
                    })()}
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Side Pots Card */}
            {tournament && (
              <div className={`${mobileStyles.bracketSettingsCard} ${mobileStyles.sidePotsCard}`}>
                <button
                  type="button"
                  className={`${mobileStyles.settingsHeader} ${mobileStyles.settingsHeaderToggle}`}
                  onClick={() => toggleCard('sidePots')}
                  aria-expanded={isCardExpanded('sidePots')}
                  aria-controls="dashboard-side-pots-content"
                >
                  <div className={mobileStyles.settingsTitleBlock}>
                    <h2 className={mobileStyles.settingsTitle}>Side Pots</h2>
                    <div className={mobileStyles.settingsMeta}>{enabledSidePotsCount} of {sidePots.pots.length} enabled</div>
                  </div>
                  {isMobile && (
                    <span className={mobileStyles.cardExpandIcon} aria-hidden="true">
                      {isCardExpanded('sidePots') ? '−' : '+'}
                    </span>
                  )}
                </button>
                {isCardExpanded('sidePots') && (
                <div id="dashboard-side-pots-content" className={mobileStyles.settingsContent}>
                  <div className={mobileStyles.cardQuickStatsRow}>
                    <div className={mobileStyles.cardQuickStatItem}>
                      <span className={mobileStyles.cardPrimaryStat}>{formatCurrencyLabel(sidePots.entry_fee)}</span>
                      <span className={mobileStyles.cardSecondaryStat}>Entry Fee</span>
                    </div>
                    <div className={mobileStyles.cardQuickStatItem}>
                      <span className={mobileStyles.cardPrimaryStat}>{formatCurrencyLabel(sidePots.prize_amount)}</span>
                      <span className={mobileStyles.cardSecondaryStat}>Prize</span>
                    </div>
                  </div>
                  {/* Shared entry fee + prize */}
                  <div className={mobileStyles.sidePotSharedFee}>
                    <div className={mobileStyles.compactField}>
                      <label className={mobileStyles.compactLabel}>Entry Fee</label>
                      <div className={mobileStyles.compactInputWrapper}>
                        <span className={mobileStyles.currencySymbol}>$</span>
                        <input
                          className={mobileStyles.compactInput}
                          type="text"
                          placeholder="0"
                          value={formatNumberInput(sidePots.entry_fee)}
                          onChange={e => {
                            const next = { ...sidePots, entry_fee: parseCurrencyInput(e.target.value) };
                            setSidePots(next);
                            saveSidePots(next);
                          }}
                        />
                      </div>
                    </div>
                    <div className={mobileStyles.compactField}>
                      <label className={mobileStyles.compactLabel}>Prize</label>
                      <div className={mobileStyles.compactInputWrapper}>
                        <span className={mobileStyles.currencySymbol}>$</span>
                        <input
                          className={mobileStyles.compactInput}
                          type="text"
                          placeholder="0"
                          value={formatNumberInput(sidePots.prize_amount)}
                          onChange={e => {
                            const next = { ...sidePots, prize_amount: parseCurrencyInput(e.target.value) };
                            setSidePots(next);
                            saveSidePots(next);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Per-pot toggles */}
                  {sidePots.pots.map(pot => (
                    <div key={pot.key} className={mobileStyles.programCard}>
                      <label className={mobileStyles.checkboxLabel}>
                        <input
                          type="checkbox"
                          className={mobileStyles.checkboxInput}
                          checked={pot.enabled}
                          onChange={e => updateSidePot(pot.key, { enabled: e.target.checked })}
                        />
                        <span>{pot.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

          </div>
          {/* End Main Content Container */}
          </div>

          {/* Load Tournament Modal */}
          {loadModalOpen && (
            <div className={mobileStyles.modalOverlay}>
              <div className={mobileStyles.modalCard}>
                <h2 className={mobileStyles.modalTitle}>{isAdmin ? 'All Tournaments' : 'Your Tournaments'}</h2>
                {isAdmin && (
                  <div className={mobileStyles.adminBadge}>Admin: Viewing all tournaments</div>
                )}
                <CloseControl position="absolute" onClick={() => setLoadModalOpen(false)} />
                {allTournaments.length === 0 ? (
                  <div className={mobileStyles.emptyTournaments}>
                    <div>No tournaments found.</div>
                    <div className={mobileStyles.emptyTournamentsHint}>Create your first tournament to get started!</div>
                  </div>
                ) : (
                  <>
                    <ul className={mobileStyles.tournamentList}>
                      {paginatedItems.map((t: Tournament) => (
                        <li key={t.id} className={mobileStyles.tournamentItem}>
                          <div>
                            <span className={mobileStyles.tournamentName}>{t.name}</span>
                            {t.location && <div className={mobileStyles.tournamentLocation}>{t.location}</div>}
                            {t.start_date && (
                              <div className={mobileStyles.tournamentDate}>
                                {new Date(t.start_date).toLocaleDateString()}
                                {t.end_date && t.end_date !== t.start_date && ` - ${new Date(t.end_date).toLocaleDateString()}`}
                              </div>
                            )}
                          </div>
                          <div className={mobileStyles.tournamentActions}>
                            <button className={mobileStyles.loadBtn} onClick={() => handleLoadTournament(t)}>Load</button>
                            <button className={mobileStyles.deleteBtn} onClick={() => setDeleteConfirm({id: t.id, name: t.name})}>Delete</button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    {totalPages > 1 && (
                      <div className={mobileStyles.paginationBar}>
                        <EnhancedButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} variant="secondary" size="sm">Previous</EnhancedButton>
                        <span className={mobileStyles.paginationText}>Page {currentPage} of {totalPages}</span>
                        <EnhancedButton onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} variant="secondary" size="sm">Next</EnhancedButton>
                      </div>
                    )}
                  </>
                )}
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
                <EnhancedButton onClick={() => setDeleteConfirm(null)} variant="secondary" size="md">Cancel</EnhancedButton>
              </div>
            </div>
          </div>
        )}
      </>
    </ErrorBoundary>
  );
}






