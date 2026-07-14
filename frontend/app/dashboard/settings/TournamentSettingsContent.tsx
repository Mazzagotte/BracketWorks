"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament, BracketSettings, SidePotsSettings, SidePot } from '../../lib/types';
import { useAuth } from '../../lib/auth-context';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { storage } from '../../lib/storage';
import dashboardStyles from '../dashboard.module.css';
import pageStyles from './dashboard-settings-page.module.css';
import { useToast } from '../../components/Toast';
import { API, apiClient, apiFetch } from '../../lib/api';
import { logger } from '../../lib/logger';
import { isHandheldViewport } from '../../lib/responsive';
import { defaultBracketPrograms, normalizeBracketPrograms } from '../../lib/bracketPrograms';
import { formatIsoDateFull } from '../../lib/formatters';
import { getErrorContext } from '../../lib/error-utils';
import { BRACKET_SETTINGS_AUTOSAVE_DELAY_MS, getSidePotsStorageKey } from '../../lib/dashboard-settings';

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

type DashboardCardKey = 'bracketSettings' | 'sidePots' | 'bracketPrograms';
type SettingsLayout = 'page' | 'route-modal' | 'embedded-modal';

const expandedDesktopCards: Record<DashboardCardKey, boolean> = {
  bracketSettings: true,
  sidePots: true,
  bracketPrograms: true,
};

type TournamentSettingsContentProps = {
  tournamentId: number;
  layout?: SettingsLayout;
};

export function TournamentSettingsContent({ tournamentId, layout = 'page' }: TournamentSettingsContentProps) {
  const router = useRouter();
  const { isUserAuthenticated, isAuthInitialized } = useAuth();
  const hasStoredAuthTokens = typeof window !== 'undefined'
    && Boolean(storage.getItem('token'))
    && Boolean(storage.getItem('user_id'));
  const { addToast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>(createDefaultBracketSettings());
  const [sidePots, setSidePots] = useState<SidePotsSettings>(createDefaultSidePots());
  const [cardExpanded, setCardExpanded] = useState<Record<DashboardCardKey, boolean>>(expandedDesktopCards);
  const [isMobile, setIsMobile] = useState(false);

  const bracketSettingsRef = useRef<BracketSettings>(bracketSettings);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEmbeddedModal = layout === 'embedded-modal';
  const isRouteModal = layout === 'route-modal';
  const showHeader = !isEmbeddedModal;

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
      const token = storage.getItem('token');
      if (!token) return;

      await apiFetch(API(`/api/v1/bracket-settings/${tournamentId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settingsToSave),
      });
    },
    [tournamentId],
  );

  const saveBracketSettingsImmediately = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!tournamentId) return;

    void persistBracketSettings(bracketSettingsRef.current).catch((err: unknown) => {
      logger.error('Failed to save bracket settings', getErrorContext(err));
    });
  }, [persistBracketSettings, tournamentId]);

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
      storage.setItem(key, JSON.stringify(nextSidePots));
    },
    [tournamentId],
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

  const toggleCard = (cardKey: DashboardCardKey) => {
    setCardExpanded(prev => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };

  const isCardExpanded = (cardKey: DashboardCardKey): boolean => cardExpanded[cardKey] ?? expandedDesktopCards[cardKey] ?? false;

  const handleOptionalBracketToggle = async (programKey: string, enabled: boolean) => {
    if (!enabled) {
      const existingEntries = 0;
      if (existingEntries > 0) {
        addToast({
          type: 'warning',
          message: `Cannot disable ${programKey}: has existing entries`,
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
    const checkMobile = () => {
      setIsMobile(isHandheldViewport());
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    bracketSettingsRef.current = bracketSettings;
  }, [bracketSettings]);

  useEffect(() => {
    const token = storage.getItem('token');
    if (!token || !tournamentId) return;

    const fetchTournament = async () => {
      try {
        const data = await apiClient.get<Tournament>(`/api/v1/tournaments/${tournamentId}`);
        setTournament(data);

        const settingsData = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`);
        if (settingsData) {
          const normalizedBracketSettings = {
            ...createDefaultBracketSettings(tournamentId),
            ...settingsData,
            bracket_programs: normalizeBracketPrograms(settingsData.bracket_programs, settingsData.default_entry_fee),
          };

          setBracketSettings(normalizedBracketSettings);
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
  }, [tournamentId, addToast]);

  if (!isAuthInitialized) {
    return <div className={pageStyles.pageState}>Loading...</div>;
  }

  if (!isUserAuthenticated && !hasStoredAuthTokens) {
    return <div className={pageStyles.pageState}>Please log in</div>;
  }

  if (!tournament) {
    return <div className={pageStyles.pageState}>Loading tournament...</div>;
  }

  const shellClassName = isEmbeddedModal
    ? pageStyles.embeddedShell
    : isRouteModal
      ? pageStyles.pageShellModal
      : pageStyles.pageShell;

  const gridClassName = isEmbeddedModal
    ? dashboardStyles.settingsModalGrid
    : isRouteModal
      ? dashboardStyles.settingsModalGrid
      : `${dashboardStyles.advancedGrid} ${pageStyles.pageGrid}`;

  const content = (
    <>
      {showHeader && (
        <div className={pageStyles.pageHeader}>
          {!isRouteModal && (
            <button
              onClick={() => router.back()}
              className={pageStyles.backButton}
            >
              ← Back to Dashboard
            </button>
          )}
          <h1 className={`${pageStyles.pageTitle} ${isRouteModal ? pageStyles.pageTitleModal : ''}`}>
            Tournament Settings
          </h1>
          <p className={pageStyles.pageSubtitle}>
            {tournament.name} • {tournament.start_date ? formatIsoDateFull(tournament.start_date) : 'Date pending'}
          </p>
        </div>
      )}

      <section className={gridClassName}>
        <div className={`${dashboardStyles.bracketSettingsCard} ${dashboardStyles.mainBracketSettingsCard}`}>
          <button
            type="button"
            className={`${dashboardStyles.settingsHeader} ${dashboardStyles.settingsHeaderToggle}`}
            onClick={() => toggleCard('bracketSettings')}
            aria-expanded={isCardExpanded('bracketSettings')}
          >
            <div className={dashboardStyles.settingsTitleBlock}>
              <h2 className={dashboardStyles.settingsTitle}>Bracket Settings</h2>
              <div className={dashboardStyles.settingsMeta}>Configure bracket size, entry fee, and prize split.</div>
            </div>
            {isMobile && (
              <span className={dashboardStyles.cardExpandIcon} aria-hidden="true">
                {isCardExpanded('bracketSettings') ? '−' : '+'}
              </span>
            )}
          </button>

          {isCardExpanded('bracketSettings') && (
            <div className={dashboardStyles.settingsContent}>
              <div className={dashboardStyles.settingsGrid}>
                <div className={dashboardStyles.settingsColumn}>
                  <div className={dashboardStyles.sectionHeader}>
                    <h3 className={dashboardStyles.sectionTitle}>Tournament Setup</h3>
                  </div>
                  <div className={dashboardStyles.fieldGroup}>
                    <div className={dashboardStyles.compactField}>
                      <label className={dashboardStyles.compactLabel}>Bracket Size</label>
                      <select
                        className={dashboardStyles.compactSelect}
                        value={bracketSettings.bracket_size}
                        onChange={e => {
                          updateBracketSettings(
                            previous => applyAutoHouse(previous, { bracket_size: parseInt(e.target.value, 10) }),
                            'immediate',
                          );
                        }}
                      >
                        <option value={8}>8 Players</option>
                      </select>
                    </div>
                    <div className={dashboardStyles.compactField}>
                      <label className={dashboardStyles.compactLabel}>Entry Fee</label>
                      <div className={dashboardStyles.compactInputWrapper}>
                        <span className={dashboardStyles.currencySymbol}>$</span>
                        <input
                          className={dashboardStyles.compactInput}
                          type="text"
                          placeholder="0"
                          value={formatNumberInput(bracketSettings.default_entry_fee)}
                          onChange={e => {
                            updateBracketSettings(
                              previous => applyAutoHouse(previous, { default_entry_fee: parseCurrencyInput(e.target.value) }),
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

                <div className={dashboardStyles.settingsColumn}>
                  <div className={dashboardStyles.sectionHeader}>
                    <h3 className={dashboardStyles.sectionTitle}>Prize Breakdown</h3>
                  </div>
                  <div className={dashboardStyles.fieldGroup}>
                    <div className={dashboardStyles.compactField}>
                      <label className={dashboardStyles.compactLabel}>1st Place</label>
                      <div className={dashboardStyles.compactInputWrapper}>
                        <span className={dashboardStyles.currencySymbol}>$</span>
                        <input
                          className={dashboardStyles.compactInput}
                          type="text"
                          placeholder="0"
                          value={formatNumberInput(bracketSettings.first_place_amount)}
                          onChange={e => {
                            updateBracketSettings(
                              previous => applyAutoHouse(previous, { first_place_amount: parseCurrencyInput(e.target.value) }),
                              'none',
                            );
                          }}
                          onBlur={() => {
                            saveBracketSettingsImmediately();
                          }}
                        />
                      </div>
                    </div>
                    <div className={dashboardStyles.compactField}>
                      <label className={dashboardStyles.compactLabel}>2nd Place</label>
                      <div className={dashboardStyles.compactInputWrapper}>
                        <span className={dashboardStyles.currencySymbol}>$</span>
                        <input
                          className={dashboardStyles.compactInput}
                          type="text"
                          placeholder="0"
                          value={formatNumberInput(bracketSettings.second_place_amount)}
                          onChange={e => {
                            updateBracketSettings(
                              previous => applyAutoHouse(previous, { second_place_amount: parseCurrencyInput(e.target.value) }),
                              'none',
                            );
                          }}
                          onBlur={() => {
                            saveBracketSettingsImmediately();
                          }}
                        />
                      </div>
                    </div>
                    <div className={dashboardStyles.compactField}>
                      <label className={dashboardStyles.compactLabel}>House Take</label>
                      <div className={dashboardStyles.compactInputWrapper}>
                        <span className={dashboardStyles.currencySymbol}>$</span>
                        <input
                          className={`${dashboardStyles.compactInput} ${dashboardStyles.compactInputReadOnly}`}
                          type="text"
                          placeholder="0"
                          value={formatNumberInput(computedHouseAmount)}
                          readOnly
                        />
                      </div>
                      <p className={dashboardStyles.settingsFieldHint}>Calculated automatically from bracket size, entry fee, and prize split.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={dashboardStyles.settingsCalculatedSummary}>
                <div className={dashboardStyles.settingsCalculatedSummaryRow}>
                  <span>Total Projected Payout</span>
                  <strong>${formatNumberInput(projectedPayout) || '0'}</strong>
                </div>
                <div className={dashboardStyles.settingsCalculatedSummaryRow}>
                  <span>Prize Split</span>
                  <strong>
                    1st ${formatNumberInput(bracketSettings.first_place_amount) || '0'} / 2nd ${formatNumberInput(bracketSettings.second_place_amount) || '0'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`${dashboardStyles.bracketSettingsCard} ${dashboardStyles.sidePotsCard}`}>
          <button
            type="button"
            className={`${dashboardStyles.settingsHeader} ${dashboardStyles.settingsHeaderToggle}`}
            onClick={() => toggleCard('sidePots')}
            aria-expanded={isCardExpanded('sidePots')}
          >
            <div className={dashboardStyles.settingsTitleBlock}>
              <h2 className={dashboardStyles.settingsTitle}>Side Pots</h2>
              <div className={dashboardStyles.settingsMeta}>Set side pot pricing and enabled side pot games.</div>
            </div>
            {isMobile && (
              <span className={dashboardStyles.cardExpandIcon} aria-hidden="true">
                {isCardExpanded('sidePots') ? '−' : '+'}
              </span>
            )}
          </button>
          {isCardExpanded('sidePots') && (
            <div className={dashboardStyles.settingsContent}>
              <div className={dashboardStyles.sectionHeader}>
                <h3 className={dashboardStyles.sectionTitle}>Default Side Pot Pricing</h3>
              </div>
              <div className={dashboardStyles.sidePotSharedFee}>
                <div className={dashboardStyles.compactField}>
                  <label className={dashboardStyles.compactLabel}>Entry Fee</label>
                  <div className={dashboardStyles.compactInputWrapper}>
                    <span className={dashboardStyles.currencySymbol}>$</span>
                    <input
                      className={dashboardStyles.compactInput}
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
                <div className={dashboardStyles.compactField}>
                  <label className={dashboardStyles.compactLabel}>Prize Amount</label>
                  <div className={dashboardStyles.compactInputWrapper}>
                    <span className={dashboardStyles.currencySymbol}>$</span>
                    <input
                      className={dashboardStyles.compactInput}
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

              <div className={dashboardStyles.sectionHeader}>
                <h3 className={dashboardStyles.sectionTitle}>Enabled Side Pots</h3>
              </div>
              <p className={dashboardStyles.settingsSectionHint}>
                Toggle individual programs to include them in side pots.
              </p>

              {sidePots.pots.map(pot => (
                <div key={pot.key} className={`${dashboardStyles.programCard} ${pot.enabled ? dashboardStyles.programCardChecked : ''}`}>
                  <label className={dashboardStyles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={dashboardStyles.checkboxInput}
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

        <div className={`${dashboardStyles.bracketSettingsCard} ${dashboardStyles.programsSettingsCard}`}>
          <button
            type="button"
            className={`${dashboardStyles.settingsHeader} ${dashboardStyles.settingsHeaderToggle}`}
            onClick={() => toggleCard('bracketPrograms')}
            aria-expanded={isCardExpanded('bracketPrograms')}
          >
            <div className={dashboardStyles.settingsTitleBlock}>
              <h2 className={dashboardStyles.settingsTitle}>Bracket Programs</h2>
              <div className={dashboardStyles.settingsMeta}>Choose bye rules and optional bracket programs.</div>
            </div>
            {isMobile && (
              <span className={dashboardStyles.cardExpandIcon} aria-hidden="true">
                {isCardExpanded('bracketPrograms') ? '−' : '+'}
              </span>
            )}
          </button>

          {isCardExpanded('bracketPrograms') && (
            <div className={dashboardStyles.settingsContent}>
              <div className={dashboardStyles.settingsProgramsGrid}>
                <section className={dashboardStyles.settingsProgramsColumn}>
                  <div className={dashboardStyles.sectionHeader}>
                    <h3 className={dashboardStyles.sectionTitle}>Bye Settings</h3>
                  </div>
                  <p className={dashboardStyles.settingsSectionHint}>Choose which bracket types use byes.</p>
                  <div className={dashboardStyles.programList}>
                    {normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee)
                      .filter(program => program.key === 'handicap' || program.key === 'scratch' || Boolean(program.enabled))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(program => (
                        <div key={`bye-${program.key}`} className={`${dashboardStyles.programCard} ${Boolean(program.allow_byes ?? bracketSettings.allow_byes) ? dashboardStyles.programCardChecked : ''}`}>
                          <label className={dashboardStyles.checkboxLabel}>
                            <input
                              type="checkbox"
                              className={dashboardStyles.checkboxInput}
                              checked={Boolean(program.allow_byes ?? bracketSettings.allow_byes)}
                              onChange={e => handleByeProgramToggle(program.key, e.target.checked)}
                            />
                            <span>{program.name}</span>
                          </label>
                        </div>
                      ))}
                  </div>
                </section>

                <section className={`${dashboardStyles.settingsProgramsColumn} ${dashboardStyles.settingsProgramsColumnSecondary}`}>
                  <div className={dashboardStyles.sectionHeader}>
                    <h3 className={dashboardStyles.sectionTitle}>Optional Brackets</h3>
                  </div>
                  <p className={dashboardStyles.settingsSectionHint}>Enable extra bracket programs for divisions or groups.</p>
                  <div className={`${dashboardStyles.programList} ${dashboardStyles.programListTwoColumn}`}>
                    {normalizeBracketPrograms(bracketSettings.bracket_programs, bracketSettings.default_entry_fee)
                      .filter(program => program.key !== 'handicap' && program.key !== 'scratch' && program.key !== 'reverse')
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(program => (
                        <div key={program.key} className={`${dashboardStyles.programCard} ${program.enabled ? dashboardStyles.programCardChecked : ''}`}>
                          <label className={dashboardStyles.checkboxLabel}>
                            <input
                              type="checkbox"
                              className={dashboardStyles.checkboxInput}
                              checked={program.enabled ?? false}
                              onChange={e => {
                                void handleOptionalBracketToggle(program.key, e.target.checked);
                              }}
                            />
                            <span>{program.name}</span>
                          </label>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );

  return (
    <ErrorBoundary>
      {isEmbeddedModal ? (
        content
      ) : (
        <main className={shellClassName}>
          {content}
        </main>
      )}
    </ErrorBoundary>
  );
}
