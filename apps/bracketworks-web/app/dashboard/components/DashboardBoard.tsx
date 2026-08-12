import { ArrowRight, Calendar, CircleDollarSign, ClipboardList, Clock, Settings2, Trophy, Users, type LucideIcon } from 'lucide-react';

import type { BracketSettings, Tournament } from '../../lib/types';
import type { Squad } from '../../lib/types';
import type { DashboardScoreProgress } from '../hooks/useDashboardScoreProgress';
import buttonStyles from '../../styles/buttons.module.css';
import styles from './DashboardBoard.module.css';

type WorkflowStep = {
  key: string;
  step: string;
  label: string;
  status: string;
  done: boolean;
  active?: boolean;
};

type ProgramSummary = {
  key: string;
  name: string;
  totalEntries: number;
  expectedBrackets: number;
};

type EntrySummary = {
  totalEntries: number;
  totalRevenue: number;
};

type DashboardAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  indicator?: string;
};

type ContextPrimaryAction = {
  key: string;
  label: string;
  message: string;
  onClick: () => void;
  disabled: boolean;
  showScoreProgress: boolean;
};

type DashboardBoardProps = {
  tournament: Tournament;
  activeSquad: Squad | null;
  tournamentDateLabel: string;
  squadTimeLabel: string;
  loadedEntries: number;
  statsEntrySummary: EntrySummary;
  workflowSteps: WorkflowStep[];
  bracketSettings: BracketSettings;
  optionalProgramsLabel: string;
  optionalProgramsSummary: string;
  enabledSidePotsCount: number;
  formatUsd: (amount: number) => string;
  tournamentProjectedPayout: number;
  grossCollected: number;
  houseRetained: number;
  orderedStatsProgramSummaries: ProgramSummary[];
  continueTournamentActions: DashboardAction[];
  manageSetupActions: DashboardAction[];
  moreActions: DashboardAction[];
  dangerActions: DashboardAction[];
  contextPrimaryAction: ContextPrimaryAction;
  dashboardActionIcons: Record<string, LucideIcon>;
  scoreProgress: DashboardScoreProgress;
  scoreProgressText: string;
};

export function DashboardBoard({
  tournament,
  activeSquad,
  tournamentDateLabel,
  squadTimeLabel,
  loadedEntries,
  statsEntrySummary,
  workflowSteps,
  bracketSettings,
  optionalProgramsLabel,
  optionalProgramsSummary,
  enabledSidePotsCount,
  formatUsd,
  tournamentProjectedPayout,
  grossCollected,
  houseRetained,
  orderedStatsProgramSummaries,
  continueTournamentActions,
  manageSetupActions,
  moreActions,
  dangerActions,
  contextPrimaryAction,
  dashboardActionIcons,
  scoreProgress,
  scoreProgressText,
}: DashboardBoardProps) {
  const ContinueActionIcon = dashboardActionIcons[contextPrimaryAction.key] ?? ArrowRight;

  return (
    <div className={styles.dashboardBoard}>
      <section className={styles.dashboardHeaderCard}>
        <div className={styles.dashboardHeaderTop}>
          <div>
            <h2 className={styles.dashboardTournamentName}>{tournament.name}</h2>
            <div className={styles.dashboardTournamentMeta}>
              <span><Calendar className={styles.dashboardMetaIcon} aria-hidden="true" />{tournamentDateLabel}</span>
              <span><Clock className={styles.dashboardMetaIcon} aria-hidden="true" />{squadTimeLabel || (activeSquad ? activeSquad.time : 'Squad time pending')}</span>
              <span><Users className={styles.dashboardMetaIcon} aria-hidden="true" />{loadedEntries} players</span>
              <span><ClipboardList className={styles.dashboardMetaIcon} aria-hidden="true" />{statsEntrySummary.totalEntries} entries</span>
            </div>
          </div>
        </div>

        <div className={styles.workflowRail}>
          {workflowSteps.map((step, index) => (
            <div
              key={step.key}
              className={`${styles.workflowItem} ${
                step.done
                  ? ''
                  : step.active
                    ? styles.workflowItemActive
                    : styles.workflowItemPending
              }`}
            >
              <div
                className={`${styles.workflowDot} ${
                  step.done
                    ? styles.workflowDotDone
                    : step.active
                      ? styles.workflowDotActive
                      : styles.workflowDotPending
                }`}
              >
                {step.done ? '✓' : step.step}
              </div>
              <div className={styles.workflowText}>
                <strong>{step.label}</strong>
                <span>{step.status}</span>
              </div>
              {index < workflowSteps.length - 1 ? (
                <div
                  className={`${styles.workflowConnector} ${
                    workflowSteps[index + 1]?.active
                      ? styles.workflowConnectorActive
                      : step.done && workflowSteps[index + 1]?.done
                        ? styles.workflowConnectorDone
                        : ''
                  }`}
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.dashboardGrid}>
        <div className={styles.dashboardMainColumn}>
          <div className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <div className={styles.kpiCardBody}>
                <span className={styles.kpiIconBadge}>
                  <Users className={styles.kpiIcon} aria-hidden="true" />
                </span>
                <div className={styles.kpiCopy}>
                  <p className={styles.kpiValue}>{loadedEntries}</p>
                  <p className={styles.kpiLabel}>Players</p>
                  <p className={styles.kpiDetail}>Active squad</p>
                </div>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiCardBody}>
                <span className={styles.kpiIconBadge}>
                  <ClipboardList className={styles.kpiIcon} aria-hidden="true" />
                </span>
                <div className={styles.kpiCopy}>
                  <p className={styles.kpiValue}>{statsEntrySummary.totalEntries}</p>
                  <p className={styles.kpiLabel}>Total Entries</p>
                  <p className={styles.kpiDetail}>{loadedEntries > 0 ? `${Math.round(statsEntrySummary.totalEntries / loadedEntries)} average per player` : 'No player data yet'}</p>
                </div>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiCardBody}>
                <span className={styles.kpiIconBadge}>
                  <CircleDollarSign className={styles.kpiIcon} aria-hidden="true" />
                </span>
                <div className={styles.kpiCopy}>
                  <p className={styles.kpiValue}>{formatUsd(statsEntrySummary.totalRevenue)}</p>
                  <p className={styles.kpiLabel}>Expected Revenue</p>
                  <p className={styles.kpiDetail}>{statsEntrySummary.totalEntries} entries × {formatUsd(bracketSettings.default_entry_fee)}</p>
                </div>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiCardBody}>
                <span className={styles.kpiIconBadge}>
                  <Trophy className={styles.kpiIcon} aria-hidden="true" />
                </span>
                <div className={styles.kpiCopy}>
                  <p className={styles.kpiValue}>{formatUsd(tournamentProjectedPayout)}</p>
                  <p className={styles.kpiLabel}>Prize Fund</p>
                  <p className={styles.kpiDetail}>After house fee</p>
                </div>
              </div>
            </article>
          </div>

          <div className={styles.dashboardPanelsGrid}>
            <article className={`${styles.dashboardPanel} ${styles.summaryDetailPanel}`}>
              <h3 className={styles.dashboardPanelHeading}>
                <Settings2 className={styles.dashboardPanelIcon} aria-hidden="true" />
                <span className={styles.dashboardPanelTitle}>Tournament Setup</span>
              </h3>
              <div className={styles.dashboardDataRows}>
                <div><span>Bracket Size</span><strong>{bracketSettings.bracket_size} Players</strong></div>
                <div><span>Entry Fee</span><strong>{formatUsd(bracketSettings.default_entry_fee)}</strong></div>
                <div><span>Handicap</span><strong>{bracketSettings.handicap_percentage}% of {bracketSettings.handicap_base}</strong></div>
                <div><span>{optionalProgramsLabel}</span><strong>{optionalProgramsSummary}</strong></div>
                <div><span>Bye Settings</span><span className={`${styles.statusBadge} ${bracketSettings.allow_byes ? styles.statusBadgeEnabled : styles.statusBadgeDisabled}`}>{bracketSettings.allow_byes ? 'Enabled' : 'Disabled'}</span></div>
                <div><span>Side Pots</span><span className={`${styles.statusBadge} ${enabledSidePotsCount > 0 ? styles.statusBadgeEnabled : styles.statusBadgeDisabled}`}>{enabledSidePotsCount > 0 ? 'Enabled' : 'Disabled'}</span></div>
              </div>
            </article>

            <article className={`${styles.dashboardPanel} ${styles.summaryDetailPanel}`}>
              <h3 className={styles.dashboardPanelHeading}>
                <CircleDollarSign className={styles.dashboardPanelIcon} aria-hidden="true" />
                <span className={styles.dashboardPanelTitle}>Financial Summary</span>
              </h3>
              <div className={styles.dashboardDataRows}>
                <div><span>Gross Collected</span><strong>{formatUsd(grossCollected)}</strong></div>
                <div><span>House Fee</span><strong className={styles.dashboardDangerText}>-{formatUsd(houseRetained)}</strong></div>
              </div>
              <div className={styles.financialHeroBlock}>
                <p className={styles.dashboardPanelEyebrow}>Available Prize Pool</p>
                <div className={styles.financialHeroValueContainer}>
                  <p className={styles.financialHeroValue}>{formatUsd(tournamentProjectedPayout)}</p>
                </div>
              </div>
              <div>
                <p className={`${styles.dashboardPanelEyebrow} ${styles.financialSplitSection}`}>Payout Split</p>
                <div className={styles.dashboardDataRows}>
                  <div><span>1st Place</span><strong>{formatUsd(bracketSettings.first_place_amount)}</strong></div>
                  <div><span>2nd Place</span><strong>{formatUsd(bracketSettings.second_place_amount)}</strong></div>
                </div>
              </div>
            </article>
          </div>

          <article className={styles.dashboardPanel}>
            <h3 className={styles.dashboardPanelHeading}>
              <ClipboardList className={styles.dashboardPanelIcon} aria-hidden="true" />
              <span className={styles.dashboardPanelTitle}>Entry Breakdown</span>
            </h3>
            <div className={styles.entryBreakdownCards}>
              {orderedStatsProgramSummaries.map(program => {
                const percentage = statsEntrySummary.totalEntries > 0
                  ? Math.round((program.totalEntries / statsEntrySummary.totalEntries) * 100)
                  : 0;
                const labelClass = program.key === 'handicap'
                  ? styles.entryBreakdownLabelHandicap
                  : program.key === 'scratch'
                    ? styles.entryBreakdownLabelScratch
                    : styles.entryBreakdownLabelOptional;

                return (
                  <div className={styles.entryBreakdownStat} key={program.key}>
                    <span className={labelClass}>{program.name}</span>
                    <strong>{program.totalEntries}</strong>
                    <small>
                      {percentage}% · {program.expectedBrackets} {program.expectedBrackets === 1 ? 'bracket' : 'brackets'}
                    </small>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <aside className={styles.dashboardSideColumn}>
          <article className={`${styles.dashboardPanel} ${styles.combinedSideCard}`}>
            <div className={styles.sideCardSection}>
              <p className={styles.sideCardSectionLabel}>Tournament Next Step</p>
              <div className={styles.continuePanelBody}>
                <div className={styles.continuePanelStatus}>
                  <span className={styles.continuePanelIconWrap}>
                    <ContinueActionIcon className={styles.continuePanelIcon} aria-hidden="true" />
                  </span>
                  <div>
                    <p className={styles.sideCardLead}>{contextPrimaryAction.label}</p>
                    <p className={styles.sideCardMeta}>{contextPrimaryAction.showScoreProgress ? scoreProgressText : contextPrimaryAction.message}</p>
                    {contextPrimaryAction.showScoreProgress && (
                      <progress
                        className={styles.scoreProgressBar}
                        value={scoreProgress.percent}
                        max="100"
                        aria-label={`${scoreProgress.percent}% of players fully scored`}
                      />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.sideCardPrimaryButton}`}
                  onClick={contextPrimaryAction.onClick}
                  disabled={contextPrimaryAction.disabled}
                >
                  {contextPrimaryAction.label}
                </button>
              </div>
            </div>

            <div className={styles.sideCardSection}>
              <p className={styles.sideCardSectionLabel}>Quick Actions</p>
              <div className={styles.sideActionList}>
                {continueTournamentActions.map(action => {
                  const ActionIcon = dashboardActionIcons[action.key] ?? ArrowRight;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      className={styles.sideActionButton}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      <span className={styles.sideActionButtonLabel}>
                        <ActionIcon className={styles.sideActionIcon} aria-hidden="true" />
                        <span>{action.label}</span>
                      </span>
                      <span>{action.indicator}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.sideCardSection}>
              <p className={styles.sideCardSectionLabel}>Tournament Management</p>
              <div className={styles.sideActionList}>
                {manageSetupActions.map(item => {
                  const ActionIcon = dashboardActionIcons[item.key] ?? ArrowRight;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.sideActionButton}
                      onClick={item.onClick}
                      disabled={item.disabled}
                    >
                      <span className={styles.sideActionButtonLabel}>
                        <ActionIcon className={styles.sideActionIcon} aria-hidden="true" />
                        <span>{item.label}</span>
                      </span>
                      <span>›</span>
                    </button>
                  );
                })}
                {moreActions.map(item => {
                  const ActionIcon = dashboardActionIcons[item.key] ?? ArrowRight;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.sideActionButton}
                      onClick={item.onClick}
                      disabled={item.disabled}
                    >
                      <span className={styles.sideActionButtonLabel}>
                        <ActionIcon className={styles.sideActionIcon} aria-hidden="true" />
                        <span>{item.label}</span>
                      </span>
                      <span>›</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`${styles.sideCardSection} ${styles.dangerZoneSection}`}>
              <p className={styles.sideCardSectionLabel}>Danger Zone</p>
              <div className={styles.sideActionList}>
                {dangerActions.map(item => {
                  const ActionIcon = dashboardActionIcons[item.key] ?? ArrowRight;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.sideActionButton} ${styles.sideActionButtonDanger}`}
                      onClick={item.onClick}
                      disabled={item.disabled}
                    >
                      <span className={styles.sideActionButtonLabel}>
                        <ActionIcon className={styles.sideActionIcon} aria-hidden="true" />
                        <span>{item.label}</span>
                      </span>
                      <span>!</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
