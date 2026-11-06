"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, CheckboxField, ICON_SIZE, Page, PageHeader, SelectField, TextField } from '@bracketworks/ui';
import { Tournament, BracketSettings, SidePotsSettings, SidePot } from '../../lib/types';
import { useAuth } from '../../lib/auth-context';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { apiClient, getMemoryAccessToken } from '../../lib/api';
import { storage } from '../../lib/storage';
import pageStyles from './dashboard-settings-page.module.css';
import { useToast } from '../../components/Toast';
import { logger } from '../../lib/logger';
import { defaultBracketPrograms, normalizeBracketPrograms } from '../../lib/bracketPrograms';
import { formatIsoDateFull } from '../../lib/formatters';
import { getErrorContext } from '../../lib/error-utils';
import { BRACKET_SETTINGS_AUTOSAVE_DELAY_MS, getSidePotsStorageKey } from '../../lib/dashboard-settings';
import { notifySettingsChanged } from '../../lib/selection-session';
import { normalizeSidePotsSettings } from '../utils/sidePots';
import { TournamentStaffPanel } from './TournamentStaffPanel';
import { SettingsSection } from './SettingsSection';

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
});

const DEFAULT_SIDE_POTS: SidePot[] = [
  { key: 'high_game_scratch', name: 'High Game Scratch', enabled: false },
  { key: 'high_series_scratch', name: 'High Series Scratch', enabled: false },
  { key: 'high_game_handicap', name: 'High Game Handicap', enabled: false },
  { key: 'high_series_handicap', name: 'High Series Handicap', enabled: false },
];

const createDefaultSidePots = (tournamentId = 0): SidePotsSettings => ({
  tournament_id: tournamentId,
  entry_fee: 0,
  prize_amount: 0,
  pots: DEFAULT_SIDE_POTS.map(p => ({ ...p })),
});

const parseCurrencyInput = (userInput: string): number => {
  const cleanedNumericString = userInput.replace(/[^0-9]/g, '');
  const parsedValue = parseInt(cleanedNumericString, 10);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const formatNumberInput = (numericValue: number): string => {
  return numericValue === 0 ? '' : Math.round(numericValue).toLocaleString('en-US');
};

type SettingsLayout = 'page' | 'route-modal' | 'embedded-modal';

type TournamentSettingsContentProps = {
  tournamentId: number;
  layout?: SettingsLayout;
};

export function TournamentSettingsContent({ tournamentId, layout = 'page' }: TournamentSettingsContentProps) {
  const router = useRouter();
  const { isUserAuthenticated, isAuthInitialized, authToken } = useAuth();
  const effectiveAuthToken = authToken || getMemoryAccessToken();
  const hasActiveSession = Boolean(effectiveAuthToken);
  const { addToast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>(createDefaultBracketSettings());
  const [sidePots, setSidePots] = useState<SidePotsSettings>(createDefaultSidePots());

  const bracketSettingsRef = useRef<BracketSettings>(bracketSettings);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const computedHouseAmount = useMemo(() => {
    const totalCost = bracketSettings.bracket_size * bracketSettings.default_entry_fee;
    return Math.max(0, totalCost - bracketSettings.first_place_amount - bracketSettings.second_place_amount);
  }, [bracketSettings]);

  const projectedPayout = bracketSettings.first_place_amount + bracketSettings.second_place_amount;
  const applyAutoHouse = useCallback((previous: BracketSettings, updates: Partial<BracketSettings>): BracketSettings => {
    const next = { ...previous, ...updates };
    const totalCost = next.bracket_size * next.default_entry_fee;
    const prizeSum = next.first_place_amount + next.second_place_amount;
    next.house_fee_amount = Math.max(0, totalCost - prizeSum);
    return next;
  }, []);

  const persistBracketSettings = useCallback(
    async (settingsToSave: BracketSettings) => {
      const payload = {
        ...settingsToSave,
        tournament_id: tournamentId,
        bracket_programs: normalizeBracketPrograms(settingsToSave.bracket_programs, settingsToSave.default_entry_fee),
      };

      try {
        await apiClient.post<BracketSettings>('/api/v1/bracket-settings', payload);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        const isNotFound = message.includes('404') || message.includes('not found');
        if (!isNotFound) {
          throw err;
        }

        // Fallback for slash-sensitive backend routes while local rewrites are reloading.
        await apiClient.post<BracketSettings>('/api/v1/bracket-settings/', payload);
      }

      apiClient.clearCacheEntry(`/api/v1/bracket-settings/${tournamentId}`);
      notifySettingsChanged();
    },
    [tournamentId],
  );

  const queueBracketSettingsPersist = useCallback(
    (settingsToSave: BracketSettings) => {
      const queuedSave = settingsSaveQueueRef.current
        .catch(() => undefined)
        .then(() => persistBracketSettings(settingsToSave));
      settingsSaveQueueRef.current = queuedSave;
      return queuedSave;
    },
    [persistBracketSettings],
  );

  const saveBracketSettingsImmediately = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!tournamentId) return;

    void queueBracketSettingsPersist(bracketSettingsRef.current).catch((err: unknown) => {
      logger.error('Failed to save bracket settings', getErrorContext(err));
      addToast({
        type: 'error',
        message: 'Failed to save tournament settings changes.',
        duration: 5000,
      });
    });
  }, [addToast, queueBracketSettingsPersist, tournamentId]);

  const updateBracketSettings = useCallback(
    (updater: (prev: BracketSettings) => BracketSettings, mode: 'immediate' | 'none' | 'autosave' = 'autosave') => {
      setBracketSettings(prev => {
        const next = updater(prev);
        bracketSettingsRef.current = next;
        if (mode === 'immediate') {
          saveBracketSettingsImmediately();
        } else if (mode === 'autosave') {
          if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = setTimeout(saveBracketSettingsImmediately, BRACKET_SETTINGS_AUTOSAVE_DELAY_MS);
        }
        return next;
      });
    },
    [saveBracketSettingsImmediately],
  );

  const saveSidePots = useCallback(
    (nextSidePots: SidePotsSettings) => {
      const key = getSidePotsStorageKey(tournamentId);

      const nextBracketSettings: BracketSettings = {
        ...bracketSettingsRef.current,
        tournament_id: tournamentId,
        side_pots_settings: nextSidePots,
      };
      bracketSettingsRef.current = nextBracketSettings;

      void queueBracketSettingsPersist(nextBracketSettings).then(() => {
        storage.setItem(key, JSON.stringify(nextSidePots));
      }).catch((err: unknown) => {
        logger.error('Failed to save side-pot settings', getErrorContext(err));
        addToast({
          type: 'error',
          message: 'Failed to save side-pot settings changes.',
          duration: 5000,
        });
      });

    },
    [addToast, queueBracketSettingsPersist, tournamentId],
  );

  const updateSidePot = useCallback(
    (potKey: string, updates: Partial<SidePot>) => {
      setSidePots(prev => {
        const nextPots = prev.pots.map(pot => (pot.key === potKey ? { ...pot, ...updates } : pot));
        const next = { ...prev, pots: nextPots };
        saveSidePots(next);
        return next;
      });
    },
    [saveSidePots],
  );

  const getOptionalBracketEntryCount = useCallback(async (programKey: string) => {
    const normalizedKey = programKey.trim().toLowerCase();
    const limit = 500;
    let offset = 0;
    let totalEntries = 0;

    while (true) {
      const bowlers = await apiClient.get<Array<{ program_entry_counts?: Record<string, number> | null }>>(
        `/api/v1/bowlers?tournament_id=${tournamentId}&limit=${limit}&offset=${offset}`,
        false,
      );
      totalEntries += bowlers.reduce((sum, bowler) => sum + Number(bowler.program_entry_counts?.[normalizedKey] || 0), 0);
      if (bowlers.length < limit) return totalEntries;
      offset += limit;
    }
  }, [tournamentId]);

  const handleOptionalBracketToggle = async (programKey: string, enabled: boolean) => {
    if (!enabled) {
      try {
        const existingEntries = await getOptionalBracketEntryCount(programKey);
        if (existingEntries > 0) {
          addToast({
            type: 'warning',
            message: `Cannot disable ${programKey}: ${existingEntries} existing entries must be removed first.`,
            duration: 4000,
          });
          return;
        }
      } catch (error) {
        logger.error('Failed to verify optional bracket entries', { programKey, error: getErrorContext(error) });
        addToast({
          type: 'error',
          message: `Could not verify ${programKey} entries. Try again.`,
          duration: 4000,
        });
        return;
      }
    }

    updateBracketSettings(
      previous => {
        const normalizedPrograms = normalizeBracketPrograms(previous.bracket_programs, previous.default_entry_fee);
        const nextPrograms = normalizedPrograms.map(program =>
          program.key === programKey ? { ...program, enabled } : program,
        );
        return { ...previous, bracket_programs: nextPrograms };
      },
      'immediate',
    );
  };

  const handleByeProgramToggle = (programKey: string, allowByes: boolean) => {
    updateBracketSettings(previous => {
      const normalizedPrograms = normalizeBracketPrograms(previous.bracket_programs, previous.default_entry_fee);
      const nextPrograms = normalizedPrograms.map(program =>
        program.key === programKey ? { ...program, allow_byes: allowByes } : program,
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

  useEffect(() => {
    bracketSettingsRef.current = bracketSettings;
  }, [bracketSettings]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  useEffect(() => {
    if (!effectiveAuthToken || !tournamentId) return;

    const fetchTournament = async () => {
      try {
        const data = await apiClient.get<Tournament>(`/api/v1/tournaments/${tournamentId}`);
        setTournament(data);

        const settingsData = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`, false);
        if (settingsData) {
          const normalizedBracketSettings = {
            ...createDefaultBracketSettings(tournamentId),
            ...settingsData,
            bracket_programs: normalizeBracketPrograms(settingsData.bracket_programs, settingsData.default_entry_fee),
          };

          setBracketSettings(normalizedBracketSettings);
          setSidePots(normalizeSidePotsSettings(settingsData.side_pots_settings, tournamentId));
          return;
        }

        const key = getSidePotsStorageKey(tournamentId);
        const storedSidePots = storage.getItem(key);
        const loadedSidePots = storedSidePots
          ? JSON.parse(storedSidePots) as SidePotsSettings
          : createDefaultSidePots(tournamentId);

        setSidePots(loadedSidePots);
      } catch (error) {
        logger.error('Failed to load tournament settings', { tournamentId, error: getErrorContext(error) });
        addToast({
          type: 'error',
          message: 'Failed to load tournament settings',
          duration: 5000,
        });
      }
    };

    void fetchTournament();
  }, [effectiveAuthToken, tournamentId, addToast]);

  if (!isAuthInitialized || (!tournament && (isUserAuthenticated || hasActiveSession))) {
    return <p className={pageStyles.status} role="status">Loading tournament settings...</p>;
  }

  if (!isUserAuthenticated && !hasActiveSession) {
    return <p className={pageStyles.status}>Please log in to change tournament settings.</p>;
  }

  if (!tournament) return null;

  const inModal = layout !== 'page';
  const programs = normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee);
  const byePrograms = programs
    .filter(program => program.key === 'handicap' || program.key === 'scratch' || Boolean(program.enabled))
    .sort((a, b) => a.name.localeCompare(b.name));
  const optionalPrograms = programs
    .filter(program => program.key !== 'handicap' && program.key !== 'scratch' && program.key !== 'reverse')
    .sort((a, b) => a.name.localeCompare(b.name));

  const sections = (
    <>
      <SettingsSection id="bracket-settings" inModal={inModal} title="Bracket settings" description="Bracket size, entry fee, handicap, and prize split. Changes save automatically.">
        <div className={pageStyles.fieldGrid}>
          <SelectField
            label="Bracket size"
            value={bracketSettings.bracket_size}
            onChange={e => {
              updateBracketSettings(previous => applyAutoHouse(previous, { bracket_size: parseInt(e.target.value, 10) }), 'immediate');
            }}
          >
            <option value={8}>8 players</option>
          </SelectField>
          <TextField
            label="Entry fee ($)"
            inputMode="numeric"
            placeholder="0"
            value={formatNumberInput(bracketSettings.default_entry_fee)}
            onChange={e => {
              updateBracketSettings(previous => applyAutoHouse(previous, { default_entry_fee: parseCurrencyInput(e.target.value) }), 'none');
            }}
            onBlur={saveBracketSettingsImmediately}
          />
          <TextField
            label="Handicap percentage (%)"
            type="number"
            min={0}
            max={100}
            step={1}
            value={bracketSettings.handicap_percentage || ''}
            onChange={e => {
              const value = e.target.value;
              updateBracketSettings(previous => ({
                ...previous,
                handicap_percentage: value === '' ? 0 : Math.min(100, Math.max(0, Number(value))),
              }), 'none');
            }}
            onBlur={saveBracketSettingsImmediately}
          />
          <TextField
            label="Handicap base"
            type="number"
            min={0}
            step={1}
            value={bracketSettings.handicap_base || ''}
            onChange={e => {
              const value = e.target.value;
              updateBracketSettings(previous => ({ ...previous, handicap_base: value === '' ? 0 : Math.max(0, Number(value)) }), 'none');
            }}
            onBlur={saveBracketSettingsImmediately}
          />
          <TextField
            label="1st place ($)"
            inputMode="numeric"
            placeholder="0"
            value={formatNumberInput(bracketSettings.first_place_amount)}
            onChange={e => {
              updateBracketSettings(previous => applyAutoHouse(previous, { first_place_amount: parseCurrencyInput(e.target.value) }), 'none');
            }}
            onBlur={saveBracketSettingsImmediately}
          />
          <TextField
            label="2nd place ($)"
            inputMode="numeric"
            placeholder="0"
            value={formatNumberInput(bracketSettings.second_place_amount)}
            onChange={e => {
              updateBracketSettings(previous => applyAutoHouse(previous, { second_place_amount: parseCurrencyInput(e.target.value) }), 'none');
            }}
            onBlur={saveBracketSettingsImmediately}
          />
        </div>
        <dl className={pageStyles.totals}>
          <div><dt>House take (calculated)</dt><dd>${formatNumberInput(computedHouseAmount) || '0'}</dd></div>
          <div><dt>Projected payout</dt><dd>${formatNumberInput(projectedPayout) || '0'}</dd></div>
          <div>
            <dt>Prize split</dt>
            <dd>1st ${formatNumberInput(bracketSettings.first_place_amount) || '0'} · 2nd ${formatNumberInput(bracketSettings.second_place_amount) || '0'}</dd>
          </div>
        </dl>
      </SettingsSection>

      <SettingsSection id="side-pots" inModal={inModal} title="Side pots" description="Side pot pricing and which side pots are offered.">
        <div className={pageStyles.fieldGrid}>
          <TextField
            label="Entry fee ($)"
            inputMode="numeric"
            placeholder="0"
            value={formatNumberInput(sidePots.entry_fee)}
            onChange={e => {
              const next = { ...sidePots, entry_fee: parseCurrencyInput(e.target.value) };
              setSidePots(next);
              saveSidePots(next);
            }}
          />
          <TextField
            label="Prize amount ($)"
            inputMode="numeric"
            placeholder="0"
            value={formatNumberInput(sidePots.prize_amount)}
            onChange={e => {
              const next = { ...sidePots, prize_amount: parseCurrencyInput(e.target.value) };
              setSidePots(next);
              saveSidePots(next);
            }}
          />
        </div>
        <fieldset className={pageStyles.checkGroup}>
          <legend className={pageStyles.groupLabel}>Offered side pots</legend>
          <div className={pageStyles.checkGrid}>
            {sidePots.pots.map(pot => (
              <CheckboxField key={pot.key} label={pot.name} checked={pot.enabled} onChange={e => updateSidePot(pot.key, { enabled: e.target.checked })} />
            ))}
          </div>
        </fieldset>
      </SettingsSection>

      <SettingsSection id="bracket-programs" inModal={inModal} title="Bracket programs" description="Bye rules and optional bracket programs.">
        <fieldset className={pageStyles.checkGroup}>
          <legend className={pageStyles.groupLabel}>Allow byes</legend>
          <div className={pageStyles.checkGrid}>
            {byePrograms.map(program => (
              <CheckboxField
                key={`bye-${program.key}`}
                label={program.name}
                checked={Boolean(program.allow_byes ?? bracketSettings.allow_byes)}
                onChange={e => handleByeProgramToggle(program.key, e.target.checked)}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className={pageStyles.checkGroup}>
          <legend className={pageStyles.groupLabel}>Optional brackets</legend>
          <div className={pageStyles.checkGrid}>
            {optionalPrograms.map(program => (
              <CheckboxField
                key={program.key}
                label={program.name}
                checked={program.enabled ?? false}
                onChange={e => { void handleOptionalBracketToggle(program.key, e.target.checked); }}
              />
            ))}
          </div>
        </fieldset>
      </SettingsSection>

      <TournamentStaffPanel tournamentId={tournamentId} ownerUserId={tournament.user_id ?? 0} inModal={inModal} />
    </>
  );

  return (
    <ErrorBoundary>
      {inModal ? (
        <div className={pageStyles.modalStack}>
          {layout === 'route-modal' ? (
            <p className={pageStyles.meta}>{tournament.name} · {tournament.start_date ? formatIsoDateFull(tournament.start_date) : 'Date pending'}</p>
          ) : null}
          {sections}
        </div>
      ) : (
        <Page width="narrow">
          <PageHeader
            title="Tournament settings"
            description={`${tournament.name} · ${tournament.start_date ? formatIsoDateFull(tournament.start_date) : 'Date pending'}`}
            actions={(
              <Button variant="secondary" icon={<ArrowLeft size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => router.back()}>
                Back to dashboard
              </Button>
            )}
          />
          {sections}
        </Page>
      )}
    </ErrorBoundary>
  );
}
