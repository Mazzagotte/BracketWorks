"use client";

import { useMemo, useEffect, useState } from 'react';
import { Tournament, Squad, Player, BracketData, ScoreData, WinnerData, BracketSettings, ToastMessage, TournamentForm } from '../lib/types';

import Link from 'next/link';

import { usePageHeader, useHeader } from '../lib/header-context';
import { useAuth } from '../lib/auth-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getErrorMessage, getErrorContext } from '../lib/error-utils';
import styles from '../page.module.css';
import mobileStyles from './dashboard.module.css';
import ConfirmationDialog from '../components/ConfirmationDialog';
import Header from '../components/Header';
import { MobileForm, MobileFormField } from '../../components/MobileForm';
import { typography, colors, spacing, stylePresets } from '../lib/design-system';
import { API, apiClient } from '../lib/api';
import { logger } from '../lib/logger';
import { Spinner, LoadingButton, Skeleton, LoadingState } from '../components/LoadingComponents';
import EnhancedButton from '../components/EnhancedButton';
import { useToast } from '../components/Toast';
import { useAsyncOperation, ErrorMessage } from '../components/ErrorHandling';
import { usePagination } from '../components/Performance';
import { useAutoSave } from '../components/DataManagement';
import { 
  PageContainer, 
  ContentWrapper, 
  Card, 
  Grid, 
  StatCard,
  Button,
  FormField,
  Input,
  Select
} from '../components/UI';

function get12hrTimes() {
  const times: string[] = [];
  // First all AM times
  for (let h = 1; h <= 12; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${h}:${m.toString().padStart(2, '0')} AM`);
    }
  }
  // Then all PM times
  for (let h = 1; h <= 12; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${h}:${m.toString().padStart(2, '0')} PM`);
    }
  }
  return times;
}
const timeOptions = get12hrTimes();
// Show all AM and PM times

// Currency formatting utilities
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
};

const parseCurrencyInput = (value: string): number => {
  // Remove all non-numeric characters
  const cleaned = value.replace(/[^0-9]/g, '');
  const parsed = parseInt(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const formatNumberInput = (value: number): string => {
  // Format for input display with commas but no $ symbol
  return value === 0 ? '' : Math.round(value).toLocaleString('en-US');
};

function getDatesBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function EditTournamentModal({ open, onClose, tournament, onSave, isMobile }: {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onSave: (form: TournamentForm) => void;
  isMobile: boolean;
}) {
  const [form, setForm] = useState<TournamentForm>({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    squad_times: {}
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which input to focus (date, index)
  const [focusTime, setFocusTime] = useState<{date: string, idx: number} | null>(null);
  
  // Memoize timeInputs to prevent recreation on every render
  const timeInputs = useMemo(() => {
    const inputs: Record<string, Array<HTMLSelectElement | null>> = {};
    return inputs;
  }, []);

  useEffect(() => {
    if (tournament) {
      setForm({
        name: tournament.name || '',
        location: tournament.location || '',
        start_date: tournament.start_date || '',
        end_date: tournament.end_date || '',
        squad_times: tournament.squad_times || {}
      });
    }
  }, [tournament]);

  // Focus new time input when added
  useEffect(() => {
    if (focusTime && timeInputs[focusTime.date]?.[focusTime.idx]) {
      timeInputs[focusTime.date][focusTime.idx]?.focus();
      setFocusTime(null);
    }
  }, [focusTime, timeInputs]);

  // 12hr format validation (hh:mm am/pm)
  function isValid12hr(time: string) {
    return /^([1-9]|1[0-2]):[0-5][0-9] ?([aApP][mM])$/.test(time.trim());
  }

  if (!open) return null;

  const days = getDatesBetween(form.start_date || '', form.end_date || '');

  return (
    <div className="modal-overlay">
      <form
        className="modal-content"
        onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          try {
            // Debug: log form data
            // eslint-disable-next-line no-console
            logger.debug('Submitting tournament form', { form });
            await onSave(form);
          } catch (err: unknown) {
            setError(getErrorMessage(err) || 'Failed to save.');
          } finally {
            setSaving(false);
          }
        }}
      >
        {error && (
          <div className="error-message">{error}</div>
        )}
        <EnhancedButton
          type="button"
          onClick={onClose}
          variant="secondary"
          size="sm"
          className="modal-close"
        >
          ✕
        </EnhancedButton>
        <h2>Edit Tournament</h2>
        <div>
        {isMobile ? (
          // Mobile Form Layout
          <MobileForm
            title="Edit Tournament"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError(null);
              try {
                await onSave(form);
              } catch (err: unknown) {
                setError(getErrorMessage(err) || 'Failed to save.');
              } finally {
                setSaving(false);
              }
            }}
            isSubmitting={saving}
            submitText={saving ? 'Saving...' : 'Save Tournament'}
          >
            <MobileFormField
              label="Tournament Name"
              value={form.name}
              onChange={(value: string) => setForm(f => ({ ...f, name: value }))}
              required={true}
              placeholder="Enter tournament name"
            />
            
            <MobileFormField
              label="Location"
              value={form.location || ''}
              onChange={(value: string) => setForm(f => ({ ...f, location: value }))}
              placeholder="Enter tournament location"
            />
            
            <MobileFormField
              label="Start Date"
              type="text"
              value={form.start_date || ''}
              onChange={(value: string) => setForm(f => ({ ...f, start_date: value }))}
              placeholder="YYYY-MM-DD"
            />
            
            <MobileFormField
              label="End Date"
              type="text"
              value={form.end_date || ''}
              onChange={(value: string) => setForm(f => ({ ...f, end_date: value }))}
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
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Tournament name"
                required
              />
            </FormField>
            <FormField label="Location">
              <Input
                value={form.location || ''}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Tournament location"
              />
            </FormField>
            <FormField label="Start Date">
              <Input
                type="date"
                value={form.start_date || ''}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </FormField>
            <FormField label="End Date">
              <Input
                type="date"
                value={form.end_date || ''}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </FormField>
          </div>
          <div>
            <h3>Squad Times by Day</h3>
            {days.length === 0 && <p className="text-secondary">Select start and end dates to add squad times.</p>}
            {days.map(date => (
              <div key={date} className="squad-day">
                <div className="squad-day-label">{date}</div>
                {(form.squad_times[date] || []).map((time, i) => {
                  if (!timeInputs[date]) timeInputs[date] = [];
                  return (
                    <div key={i} className="squad-time-row">
                      <select
                        className="form-select"
                        ref={el => { timeInputs[date][i] = el as HTMLSelectElement | null; }}
                        value={time}
                        onChange={e => setForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: f.squad_times[date].map((t, j) => j === i ? e.target.value : t) } }))}
                      >
                        <option value="" disabled>Select time</option>
                        {timeOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <EnhancedButton
                        type="button"
                        onClick={() => setForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: f.squad_times[date].filter((_, j) => j !== i) } }))}
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
                    const times = form.squad_times[date] || [];
                    // Only add if last is selected
                    if (times.length === 0 || (times[times.length - 1] && times[times.length - 1] !== '')) {
                      setForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: [...(f.squad_times[date] || []), ''] } }));
                      setFocusTime({ date, idx: (form.squad_times[date]?.length || 0) });
                    }
                  }}
                  variant="secondary"
                  size="sm"
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
            loading={saving}
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
  const { isAuthenticated } = useAuth();

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuth = typeof window !== 'undefined' && 
    localStorage.getItem('token') && 
    localStorage.getItem('user_id');

  // Authentication guard - redirect if not logged in
  if (!isAuthenticated && !hasStoredAuth) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🔒</div>
          <div>Please log in to access the tournament dashboard</div>
        </div>
      </div>
    );
  }

  // Show loading if we have stored auth but context isn't ready yet
  if (!isAuthenticated && hasStoredAuth) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🎳</div>
          <div>Loading tournament dashboard...</div>
        </div>
      </div>
    );
  }

  // SSR-safe isAdmin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
  const [squads, setSquads] = useState<any[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: number, name: string} | null>(null);
  
  // Enhanced UX components
  const { addToast, removeToast } = useToast();
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination({ 
    items: allTournaments, 
    itemsPerPage: 10 
  });


  
  // Bracket settings state
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>({
    tournament_id: 0,
    bracket_size: 16,
    first_place: 0,
    second_place: 0,
    house_amount: 0,
    cost_per_bracket: 0,
    handicap_percentage: 80,
    handicap_base: 200
  });
  const [savingBracketSettings, setSavingBracketSettings] = useState(false);
  
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);

  // Save bracket settings
  const saveBracketSettings = async () => {
    if (!tournament?.id) {
      setConfirmMsg('Please load a tournament first before saving bracket settings.');
      setConfirmOpen(true);
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      setConfirmMsg('Please log in to save bracket settings.');
      setConfirmOpen(true);
      return;
    }

    setSavingBracketSettings(true);
    try {
      const data = await apiClient.post<BracketSettings>('/api/v1/bracket-settings/', {
        ...bracketSettings,
        tournament_id: tournament.id
      });
      
      // Check if it was a create or update operation
      const isUpdate = data.id && bracketSettings.id;
      const message = isUpdate 
        ? 'Bracket settings updated successfully!' 
        : 'Bracket settings saved successfully!';
      
      addToast({
        type: 'success',
        message,
        duration: 4000
      });
      
      // Update local state with the returned data (includes ID for new records)
      setBracketSettings(data);
    } catch (error) {
      logger.error('Failed to save bracket settings', { error });
      addToast({
        type: 'error',
        message: 'Network error occurred while saving. Please check your connection and try again.',
        duration: 7000
      });
    } finally {
      setSavingBracketSettings(false);
    }
  };

  // Load bracket settings
  const loadBracketSettings = async (tournamentId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`);
      if (settings) {
        setBracketSettings({
          ...settings,
          handicap_percentage: settings.handicap_percentage ?? 80, // Default to 80% if not set
          handicap_base: settings.handicap_base ?? 200 // Default to 200 if not set
        });
      } else {
        // No existing settings found, keep defaults
        setBracketSettings(prev => ({
          ...prev,
          tournament_id: tournamentId,
          id: undefined // Clear any existing ID
        }));
      }
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('404')) {
        // Tournament not found or no bracket settings exist - use defaults
        logger.warn('No bracket settings found for tournament', { tournamentId });
        setBracketSettings(prev => ({
          ...prev,
          tournament_id: tournamentId,
          id: undefined // Clear any existing ID
        }));
      } else {
        logger.error('Error loading bracket settings', getErrorContext(error));
        // On network error, still set up defaults for the tournament
        setBracketSettings(prev => ({
          ...prev,
          tournament_id: tournamentId,
          id: undefined
        }));
      }
    }
  };
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);



  // Fetch tournaments and restore last loaded tournament from backend on mount
  useEffect(() => {
    const adminFlag = localStorage.getItem('is_admin');
    setIsAdmin(adminFlag === '1' || adminFlag === 'true');
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    if (lastTournamentId && token) {
      fetch(API(`/api/v1/tournaments/${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setTournament(data);
            loadBracketSettings(data.id);
          }
        });
      fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => setSquads(data));
      // Fetch selected squad from backend
      if (userId) {
        fetch(API(`/api/v1/squads/selected/?user_id=${userId}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.squad_id) {
              setSelectedSquadId(data.squad_id);
            }
          });
      }
    }
  }, []);

  // Fetch tournaments when load modal opens
  useEffect(() => {
    if (loadModalOpen) {
      fetchAllTournaments();
    }
  }, [loadModalOpen, isAdmin]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
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
  const handleLoadTournament = (t: Tournament) => {
    setTournament(t);
    setLoadModalOpen(false);
    // Load bracket settings for this tournament
    loadBracketSettings(t.id);
    // Optionally, persist tournament id to localStorage for reload (not the full object)
    localStorage.setItem('lastTournamentId', String(t.id));
  };

  // Delete selected tournament with enhanced UX feedback
  const handleDeleteTournament = async (id: number) => {
    try {
      const deletedTournament = allTournaments.find(t => t.id === id);
      await apiClient.delete(`/api/v1/tournaments/${id}`);
      
      setAllTournaments(allTournaments.filter(t => t.id !== id));
      setDeleteConfirm(null);
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
  const handleSave = async (form: TournamentForm) => {
    const token = localStorage.getItem('token');
    if (!token) {
      addToast({
        type: 'error',
        message: 'Please log in to save tournaments',
        duration: 5000
      });
      return;
    }

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
          body: JSON.stringify(form)
        });
        if (res.ok) {
          savedTournament = await res.json();
          setTournament(savedTournament);
          addToast({
            type: 'success',
            message: `Tournament "${form.name}" created successfully!`,
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
          body: JSON.stringify(form)
        });
        if (res.ok) {
          savedTournament = await res.json();
          setTournament(savedTournament);
          addToast({
            type: 'success',
            message: `Tournament "${form.name}" updated successfully!`,
            duration: 4000
          });
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
            }
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
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <EnhancedButton
        onClick={() => {
          setCreateMode(true);
          setModalOpen(true);
        }}
        variant="primary"
        size="sm"
      >
        + New Tournament
      </EnhancedButton>
      
      {tournament && (
        <EnhancedButton
          onClick={() => {
            setCreateMode(false);
            setModalOpen(true);
          }}
          variant="secondary"
          size="sm"
        >
          Edit Tournament
        </EnhancedButton>
      )}
      
      <EnhancedButton
        onClick={() => setLoadModalOpen(true)}
        variant="secondary" 
        size="sm"
      >
        Load Tournament
      </EnhancedButton>
    </div>
  ), [tournament]);

  usePageHeader({
    title: "Tournament Dashboard",
    subtitle: tournament 
      ? `Managing: ${tournament.name}${tournament.location ? ` • ${tournament.location}` : ''}${tournament.start_date ? ` • ${new Date(tournament.start_date).toLocaleDateString()}` : ''}`
      : "Manage your bowling tournament settings and configuration",
    centerContent: false,
    actions: headerActions
  });

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
        />
        <main className="page-main">

          {/* Main Content Container - Centered */}
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 1rem'
          }}>
            {/* Enhanced Side-by-side container for cards */}
            <div className={mobileStyles.cardsContainer}>
            {/* Bracket Settings Card */}
            {tournament && (
              <div className={mobileStyles.bracketSettingsCard}>
                <div className={mobileStyles.settingsHeader}>
                  <span className={mobileStyles.settingsIcon}>⚙️</span>
                  <h2 className={mobileStyles.settingsTitle}>Bracket Settings</h2>
                </div>
                
                <div className={mobileStyles.settingsContent}>
                  {/* Main Settings Grid */}
                  <div className={mobileStyles.settingsGrid}>
                    
                    {/* Left Column - Tournament Basics */}
                    <div className={mobileStyles.settingsColumn}>
                      <div className={mobileStyles.sectionHeader}>
                        <span className={mobileStyles.sectionIcon}>🏆</span>
                        <h3 className={mobileStyles.sectionTitle}>Tournament</h3>
                      </div>
                      
                      <div className={mobileStyles.fieldGroup}>
                        <div className={mobileStyles.compactField}>
                          <label className={mobileStyles.compactLabel}>Bracket Size</label>
                          <select
                            className={mobileStyles.compactSelect}
                            value={bracketSettings.bracket_size}
                            onChange={e => setBracketSettings(prev => ({ ...prev, bracket_size: parseInt(e.target.value) }))}
                          >
                            <option value={4}>4 Players</option>
                            <option value={8}>8 Players</option>
                            <option value={16}>16 Players</option>
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
                              value={formatNumberInput(bracketSettings.cost_per_bracket)}
                              onChange={e => {
                                const numericValue = parseCurrencyInput(e.target.value);
                                setBracketSettings(prev => ({ ...prev, cost_per_bracket: numericValue }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Prize Structure */}
                    <div className={mobileStyles.settingsColumn}>
                      <div className={mobileStyles.sectionHeader}>
                        <span className={mobileStyles.sectionIcon}>💰</span>
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
                              value={formatNumberInput(bracketSettings.first_place)}
                              onChange={e => {
                                const numericValue = parseCurrencyInput(e.target.value);
                                setBracketSettings(prev => ({ ...prev, first_place: numericValue }));
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
                              value={formatNumberInput(bracketSettings.second_place)}
                              onChange={e => {
                                const numericValue = parseCurrencyInput(e.target.value);
                                setBracketSettings(prev => ({ ...prev, second_place: numericValue }));
                              }}
                            />
                          </div>
                        </div>

                        <div className={mobileStyles.compactField}>
                          <label className={mobileStyles.compactLabel}>House Take</label>
                          <div className={mobileStyles.compactInputWrapper}>
                            <span className={mobileStyles.currencySymbol}>$</span>
                            <input
                              className={mobileStyles.compactInput}
                              type="text"
                              placeholder="0"
                              value={formatNumberInput(bracketSettings.house_amount)}
                              onChange={e => {
                                const numericValue = parseCurrencyInput(e.target.value);
                                setBracketSettings(prev => ({ ...prev, house_amount: numericValue }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Handicap Settings - Full Width */}
                  <div className={mobileStyles.settingsSection}>
                    <div className={mobileStyles.sectionHeader}>
                      <span className={mobileStyles.sectionIcon}>📊</span>
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
                            value={bracketSettings.handicap_percentage}
                            onChange={e => {
                              const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                              setBracketSettings(prev => ({ ...prev, handicap_percentage: value }));
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
                          value={bracketSettings.handicap_base}
                          onChange={e => {
                            const value = Math.max(1, parseInt(e.target.value) || 200);
                            setBracketSettings(prev => ({ ...prev, handicap_base: value }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={mobileStyles.buttonGroup}>
                  <EnhancedButton
                    onClick={saveBracketSettings}
                    loading={savingBracketSettings}
                    variant="primary"
                    size="md"
                    className={mobileStyles.saveButton}
                  >
                    Save Settings
                  </EnhancedButton>
                  <EnhancedButton
                    onClick={() => setBracketSettings({
                      tournament_id: tournament?.id || 0,
                      bracket_size: 16,
                      first_place: 0,
                      second_place: 0,
                      house_amount: 0,
                      cost_per_bracket: 0,
                      handicap_percentage: 80,
                      handicap_base: 200
                    })}
                    variant="secondary"
                    size="md"
                    className={mobileStyles.resetButton}
                  >
                    Reset
                  </EnhancedButton>
                </div>
              </div>
            )}

            {/* Squad Selection Card */}
            {squads.length > 0 ? (
              <div className={mobileStyles.squadSelectionCard}>
                <div className={mobileStyles.squadHeader}>
                  <span className={mobileStyles.squadIcon}>🎳</span>
                  <h2 className={mobileStyles.squadTitle}>Squad Selection</h2>
                  <div className={mobileStyles.squadCounter}>
                    {squads.length} available
                  </div>
                </div>
                
                <div className={mobileStyles.squadInfo}>
                  <p className={mobileStyles.squadDescription}>
                    Choose your preferred time slot for the tournament
                  </p>
                </div>
                
                <div className={mobileStyles.squadGrid}>
                  {squads.map((squad, index) => {
                    const isSelected = selectedSquadId === squad.id;
                    
                    return (
                      <button
                        key={squad.id}
                        className={`${mobileStyles.squadPillEnhanced} ${isSelected ? mobileStyles.selected : ''}`}
                        onClick={async (e) => {
                          e.preventDefault();
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
                
                {selectedSquadId && (
                  <div className={mobileStyles.selectionFeedback}>
                    <span className={mobileStyles.checkIcon}>✓</span>
                    <span>
                      Selected: {squads.find(s => s.id === selectedSquadId)?.date} — {squads.find(s => s.id === selectedSquadId)?.time}
                    </span>
                  </div>
                )}
                
                <EnhancedButton
                  disabled={!selectedSquadId}
                  onClick={() => {
                    // Confirm squad loaded
                    const squad = squads.find(s => s.id === selectedSquadId);
                    setConfirmMsg(squad ? `Squad loaded: ${squad.date} — ${squad.time}` : 'Squad loaded');
                    setConfirmOpen(true);
                  }}
                  variant="primary"
                  size="md"
                  className={mobileStyles.loadSquadButton}
                >
                  {selectedSquadId ? 'Load Selected Squad' : 'Select a Squad First'}
                </EnhancedButton>
              </div>
            ) : (
              <div className={mobileStyles.noSquadsCard}>
                <div className={mobileStyles.noSquadsIcon}>📅</div>
                <div className={mobileStyles.noSquadsTitle}>More Features Coming Soon</div>
                <div className={mobileStyles.noSquadsText}>
                  Squad selection will appear here when squads are available
                </div>
              </div>
            )}
          </div>
          {/* End Main Content Container */}
          </div>

          {/* Load Tournament Modal */}
          {loadModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: colors.surface, borderRadius: 16, padding: 32, minWidth: 340, boxShadow: colors.shadow.lg, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                <h2 style={{ marginBottom: 18, color: colors.text.primary }}>{isAdmin ? 'All Tournaments' : 'Your Tournaments'}</h2>
                {isAdmin && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 15, color: colors.primary, fontWeight: 500 }}>Admin: Viewing all tournaments</span>
                  </div>
                )}
                <EnhancedButton 
                  onClick={() => setLoadModalOpen(false)}
                  variant="secondary"
                  size="sm"
                  className="absolute top-4 right-4"
                >
                  &times;
                </EnhancedButton>
                {allTournaments.length === 0 ? (
                  <div style={{ color: colors.text.secondary, fontSize: 16, textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ marginBottom: 12 }}>No tournaments found.</div>
                    <div style={{ fontSize: 14, color: colors.text.muted }}>Create your first tournament to get started!</div>
                  </div>
                ) : (
                  <>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {paginatedItems.map((t: Tournament) => (
                        <li key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${colors.border}`, transition: 'background-color 0.2s ease' }}>
                          <div>
                            <span style={{ fontWeight: 500, fontSize: 16, color: colors.text.primary }}>{t.name}</span>
                            {t.location && (
                              <div style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2 }}>{t.location}</div>
                            )}
                            {t.start_date && (
                              <div style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>
                                {new Date(t.start_date).toLocaleDateString()}
                                {t.end_date && t.end_date !== t.start_date && 
                                  ` - ${new Date(t.end_date).toLocaleDateString()}`
                                }
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <LoadingButton
                              onClick={() => handleLoadTournament(t)}
                              style={{ background: colors.primary, color: colors.text.white, fontSize: 14, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}
                            >
                              Load
                            </LoadingButton>
                            <LoadingButton
                              onClick={() => setDeleteConfirm({id: t.id, name: t.name})}
                              style={{ background: colors.error, color: colors.text.white, fontSize: 14, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}
                            >
                              Delete
                            </LoadingButton>
                          </div>
                        </li>
                      ))}
                    </ul>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20, padding: '12px 0', borderTop: `1px solid ${colors.border}` }}>
                        <EnhancedButton
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          variant="secondary"
                          size="sm"
                        >
                          Previous
                        </EnhancedButton>
                        <span style={{ fontSize: 14, color: colors.text.secondary, padding: '0 16px' }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <EnhancedButton
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          variant="secondary"
                          size="sm"
                        >
                          Next
                        </EnhancedButton>
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
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: colors.surface, borderRadius: 16, padding: 32, minWidth: 340, boxShadow: colors.shadow.lg, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
              <h2 style={{ marginBottom: 18, color: colors.error }}>Confirm Deletion</h2>
              <p style={{ fontSize: 16, marginBottom: 24, color: colors.text.primary }}>Are you sure you want to delete tournament <span style={{ fontWeight: 700 }}>{deleteConfirm.name}</span>?</p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                <EnhancedButton 
                  onClick={() => handleDeleteTournament(deleteConfirm.id)}
                  variant="danger"
                  size="md"
                >
                  Delete
                </EnhancedButton>
                <EnhancedButton 
                  onClick={() => setDeleteConfirm(null)}
                  variant="secondary"
                  size="md"
                >
                  Cancel
                </EnhancedButton>
              </div>
            </div>
          </div>
        )}
      </>
    </ErrorBoundary>
  );
}
