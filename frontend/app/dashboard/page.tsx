"use client";

import { useMemo, useEffect, useState, useRef } from 'react';
import { Tournament, Squad, BracketSettings, TournamentForm } from '../lib/types';

import { usePageHeader } from '../lib/header-context';
import { useAuth } from '../lib/auth-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getErrorMessage, getErrorContext } from '../lib/error-utils';
import mobileStyles from './dashboard.module.css';
import { ConfirmationDialog } from '../components/LazyComponents';
import { MobileForm, MobileFormField } from '../../components/MobileForm';
import { API, apiClient } from '../lib/api';
import { logger } from '../lib/logger';
import { defaultBracketPrograms, normalizeBracketPrograms } from '../lib/bracketPrograms';
import EnhancedButton from '../components/EnhancedButton';
import { useToast } from '../components/Toast';
import { usePagination } from '../components/Performance';
import { FormField, Input, Select } from '../components/UI';

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
        className="modal-content"
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
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2>{isCreateMode ? 'Create Tournament' : 'Edit Tournament'}</h2>
        <div>
        {isMobile ? (
          // Mobile Form Layout
          <MobileForm
            title={isCreateMode ? 'Create Tournament' : 'Edit Tournament'}
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
        <div className="form-grid">
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
                      <EnhancedButton
                        type="button"
                        onClick={() => setTournamentForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: f.squad_times[date].filter((_, j) => j !== i) } }))}
                        variant="danger"
                        size="sm"
                      >
                        ×
                      </EnhancedButton>
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
        <div className="action-group">
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
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: number, name: string} | null>(null);
  
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
  
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);

  // Keep ref in sync so timeout callbacks always read the latest settings
  useEffect(() => {
    bracketSettingsRef.current = bracketSettings;
  }, [bracketSettings]);

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
    bracketSettings.bracket_size,
    bracketSettings.default_entry_fee,
    bracketSettings.first_place_amount,
    bracketSettings.second_place_amount
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

  // Load bracket settings
  const loadBracketSettings = async (tournamentId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`, false);
      if (settings) {
        const loaded = {
          ...settings,
          bracket_size: 8,
          bracket_programs: normalizeBracketPrograms(settings.bracket_programs, settings.default_entry_fee),
          handicap_percentage: settings.handicap_percentage ?? 80,
          handicap_base: settings.handicap_base ?? 200
        };
        setBracketSettings(prev => applyAutoHouse(prev, loaded));
      } else {
        setBracketSettings(createDefaultBracketSettings(tournamentId));
      }
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('404')) {
        // Tournament not found or no bracket settings exist - use defaults
        logger.warn('No bracket settings found for tournament', { tournamentId });
        setBracketSettings(createDefaultBracketSettings(tournamentId));
      } else {
        logger.error('Error loading bracket settings', getErrorContext(error));
        // On network error, still set up defaults for the tournament
        setBracketSettings(createDefaultBracketSettings(tournamentId));
      }
    }
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

      const response = await fetch(API(`/api/v1/bowlers?${params.toString()}`), {
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

          const confirmed = window.confirm(
            `${programName} has ${existingEntries} existing entr${existingEntries === 1 ? 'y' : 'ies'} in this tournament. Disabling it will hide those entries from the Entries page and can affect totals. Continue?`
          );

          if (!confirmed) {
            return;
          }
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

    updateBracketSettings(previous => {
      const normalizedPrograms = normalizeBracketPrograms(previous.bracket_programs, previous.default_entry_fee)
      const nextPrograms = normalizedPrograms.map((program, index) =>
        index === programIndex
          ? { ...program, enabled, ...(enabled ? {} : { allow_byes: false }) }
          : program
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
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);

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
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    
    if (lastTournamentId && token) {
      // Parallelize all initial data fetches for faster loading
      const tournamentPromise = fetch(API(`/api/v1/tournaments/${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : null);
      
      const squadsPromise = fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }).then(res => res.ok ? res.json() : []);
      
      const selectedSquadPromise = userId
        ? fetch(API(`/api/v1/squads/selected/?user_id=${userId}`), {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => res.ok ? res.json() : null)
        : Promise.resolve(null);
      
      // Wait for all requests to complete in parallel
      Promise.all([tournamentPromise, squadsPromise, selectedSquadPromise])
        .then(([tournamentData, squadsData, selectedSquadData]) => {
          const storedSelectedSquadId = localStorage.getItem('selected_squad_id');
          const restoredSelectedSquadId = selectedSquadData?.squad_id
            ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null);

          // Set tournament and load bracket settings
          if (tournamentData) {
            setTournament(tournamentData);
            loadBracketSettings(tournamentData.id);
          } else {
            // Tournament no longer accessible — clear stale localStorage
            localStorage.removeItem('lastTournamentId');
            localStorage.removeItem('activeTournamentName');
            localStorage.removeItem('selected_squad_id');
            localStorage.removeItem('activeSquadLabel');
            window.dispatchEvent(new Event('tournament-changed'));
            window.dispatchEvent(new Event('squad-changed'));
          }
          
          // Set squads data
          setSquads(squadsData);
          
          // Set selected squad
          if (restoredSelectedSquadId && squadsData.some((squad: Squad) => squad.id === restoredSelectedSquadId)) {
            setSelectedSquadId(restoredSelectedSquadId);
          } else {
            setSelectedSquadId(null);
          }
        })
        .catch(error => {
          logger.error('Error loading initial dashboard data:', error);
        });
    } else {
      // No stored tournament — clear any stale header strip data
      localStorage.removeItem('selected_squad_id');
      localStorage.removeItem('activeTournamentName');
      localStorage.removeItem('activeSquadLabel');
      window.dispatchEvent(new Event('tournament-changed'));
      window.dispatchEvent(new Event('squad-changed'));
    }
  }, []);

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
    // Load bracket settings for this tournament
    loadBracketSettings(t.id);
    // Optionally, persist tournament id to localStorage for reload (not the full object)
    localStorage.setItem('lastTournamentId', String(t.id));
    localStorage.setItem('activeTournamentName', t.name);
    window.dispatchEvent(new Event('tournament-changed'));
    
    // Load squads for this tournament
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    if (token) {
      try {
        // Fetch squads for the tournament
        const squadsData = await apiClient.get<Squad[]>(`/api/v1/squads/?tournament_id=${t.id}`);
        setSquads(squadsData);
        
        // Fetch selected squad for the user
        if (userId) {
          try {
            const selectedSquadData = await apiClient.get<{squad_id: number}>(`/api/v1/squads/selected/?user_id=${userId}`);
            const storedSelectedSquadId = localStorage.getItem('selected_squad_id');
            const restoredSelectedSquadId = selectedSquadData?.squad_id
              ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null);

            if (restoredSelectedSquadId && squadsData.some(squad => squad.id === restoredSelectedSquadId)) {
              setSelectedSquadId(restoredSelectedSquadId);
            } else {
              setSelectedSquadId(null);
            }
          } catch (error) {
            logger.warn('No selected squad found for user', { userId, error });
            const storedSelectedSquadId = localStorage.getItem('selected_squad_id');
            const restoredSelectedSquadId = storedSelectedSquadId ? Number(storedSelectedSquadId) : null;
            setSelectedSquadId(
              restoredSelectedSquadId && squadsData.some(squad => squad.id === restoredSelectedSquadId)
                ? restoredSelectedSquadId
                : null
            );
          }
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
        localStorage.removeItem('lastTournamentId');
        localStorage.removeItem('activeTournamentName');
        localStorage.removeItem('selected_squad_id');
        localStorage.removeItem('activeSquadLabel');
        window.dispatchEvent(new Event('tournament-changed'));
        window.dispatchEvent(new Event('squad-changed'));
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
        const res = await fetch(API('/api/v1/tournaments/'), {
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
          localStorage.setItem('lastTournamentId', String(savedTournament.id));
          localStorage.setItem('activeTournamentName', savedTournament.name);
          window.dispatchEvent(new Event('tournament-changed'));
          loadBracketSettings(savedTournament.id);
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
        const res = await fetch(API(`/api/v1/tournaments/${tournament.id}`), {
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
          const syncRes = await fetch(API(`/api/v1/squads/sync/${savedTournament.id}`), {
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
          const squadRes = await fetch(API(`/api/v1/squads/?tournament_id=${savedTournament.id}`), {
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
      <button className="ds-btn ds-btn-primary ds-btn-md" onClick={() => { setCreateMode(true); setModalOpen(true); }}>
        + New Tournament
      </button>
      {tournament && (
        <button className="ds-btn ds-btn-primary ds-btn-md" onClick={() => { setCreateMode(false); setModalOpen(true); }}>
          Edit Tournament
        </button>
      )}
      <button className="ds-btn ds-btn-primary ds-btn-md" onClick={() => setLoadModalOpen(true)}>
        Load Tournament
      </button>
      {tournament && (
        <button
          className={`ds-btn ds-btn-destructive ds-btn-md ${mobileStyles.headerDeleteBtn}`}
          onClick={() => setDeleteConfirm({ id: tournament.id, name: tournament.name })}
        >
          Delete Tournament
        </button>
      )}
      {tournament && (
        <button
          className="ds-btn ds-btn-destructive ds-btn-md"
          onClick={() => {
            setTournament(null);
            setSquads([]);
            setSelectedSquadId(null);
            setBracketSettings(createDefaultBracketSettings());
            localStorage.removeItem('lastTournamentId');
            localStorage.removeItem('activeTournamentName');
            localStorage.removeItem('selected_squad_id');
            localStorage.removeItem('activeSquadLabel');
            window.dispatchEvent(new Event('tournament-changed'));
            window.dispatchEvent(new Event('squad-changed'));
            addToast({ type: 'success', message: 'Tournament unloaded successfully', duration: 3000 });
          }}
        >
          Unload Tournament
        </button>
      )}
    </div>
  ), [tournament, addToast]);

  const selectedSquad = squads.find(s => s.id === selectedSquadId)
  const squadLabel = selectedSquad ? ` · ${[selectedSquad.date, selectedSquad.time].filter(Boolean).join(' ')}` : ''

  useEffect(() => {
    if (selectedSquadId !== null) {
      localStorage.setItem('selected_squad_id', String(selectedSquadId));
    }
  }, [selectedSquadId]);

  useEffect(() => {
    const label = selectedSquad ? [selectedSquad.date, selectedSquad.time].filter(Boolean).join(' ') : '';
    localStorage.setItem('activeSquadLabel', label);
    window.dispatchEvent(new Event('squad-changed'));
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
            
            {/* Bracket Settings Card */}
            {tournament && (
              <div className={`${mobileStyles.bracketSettingsCard} ${mobileStyles.mainBracketSettingsCard}`}>
                <div className={mobileStyles.settingsHeader}>
                  <h2 className={mobileStyles.settingsTitle}>Bracket Settings</h2>
                </div>
                
                <div className={mobileStyles.settingsContent}>
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
                        <div className={mobileStyles.compactInputWrapper}>
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
                          <span className={mobileStyles.inputSuffix}>%</span>
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
              </div>
            )}

            {tournament && (
              <div className={`${mobileStyles.bracketSettingsCard} ${mobileStyles.optionalBracketsCard}`}>
                <div className={mobileStyles.settingsHeader}>
                  <h2 className={mobileStyles.settingsTitle}>Bye Settings</h2>
                </div>

                <div className={mobileStyles.settingsContent}>
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
              </div>
            )}

            {tournament && (
              <div className={`${mobileStyles.bracketSettingsCard} ${mobileStyles.optionalBracketsCard}`}>
                <div className={mobileStyles.settingsHeader}>
                  <h2 className={mobileStyles.settingsTitle}>Optional Brackets</h2>
                </div>

                <div className={mobileStyles.settingsContent}>
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
              </div>
            )}

            {/* Squad Selection Card */}
            {squads.length > 0 && (
              <div className={`${mobileStyles.squadSelectionCard} ${mobileStyles.squadSelectionCompactCard}`}>
                <div className={mobileStyles.squadHeader}>
                  <h2 className={mobileStyles.squadTitle}>Squad Selection</h2>
                </div>
                
                <div className={mobileStyles.squadGrid}>
                  {squads.map((squad) => {
                    const isSelected = selectedSquadId === squad.id;
                    
                    return (
                      <button
                        key={squad.id}
                        className={`${mobileStyles.squadPillEnhanced} ${isSelected ? mobileStyles.selected : ''}`}
                        onClick={async (changeEvent) => { changeEvent.preventDefault();
                          setSelectedSquadId(squad.id);
                          const token = localStorage.getItem('token');
                          const userId = localStorage.getItem('user_id');
                          if (token && userId) {
                            await fetch(API('/api/v1/squads/select/'), {
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
                <button
                  className="modal-close"
                  onClick={() => setLoadModalOpen(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
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
          <div className={mobileStyles.modalOverlay} style={{ zIndex: 2000 }}>
            <div className={mobileStyles.modalCard}>
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

