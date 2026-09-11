import { Activity, ArrowRight, Calendar, CircleDollarSign, ClipboardList, Clock, Settings2, Trophy, Users, type LucideIcon } from 'lucide-react';

import type { BracketSettings, Tournament, TournamentActivityEntry } from '../../lib/types';
import type { Squad } from '../../lib/types';
import type { DashboardScoreProgress } from '../hooks/useDashboardScoreProgress';
import buttonStyles from '../../styles/buttons.module.css';
import styles from './DashboardBoard.module.css';

const formatActivityTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const getActivityText = (entry: TournamentActivityEntry): { title: string; detail: string } => {
  switch (entry.event_type) {
    case 'scores.unlocked':
      return { title: 'Scores were unlocked', detail: 'Score entry was reopened. Payouts may need to be recalculated.' };
    case 'scores.locked':
      return { title: 'Scores were locked', detail: 'Scores were marked ready for payout calculation.' };
    case 'score.changed':
      return { title: 'A score was changed', detail: 'One or more saved game scores were updated.' };
    case 'score.entered':
      return { title: 'A score was entered', detail: 'A bowler score was saved for this tournament.' };
    case 'score.deleted':
      return { title: 'A score was deleted', detail: 'A saved bowler score was removed.' };
    case 'payouts.calculated':
      return { title: 'Payouts were calculated', detail: 'The payout sheet was generated from the current tournament results.' };
    case 'payouts.reopened':
      return { title: 'Payouts were reopened', detail: 'Finalized payouts were reopened for review or adjustment.' };
    case 'payouts.adjusted':
      return { title: 'A payout was adjusted', detail: 'A payout amount was manually changed.' };
    case 'payouts.finalized':
      return { title: 'Payouts were finalized', detail: 'The tournament payout records were marked final.' };
    case 'brackets.generated':
      return { title: 'Brackets were generated', detail: 'The bracket field was built from the current entries.' };
    case 'brackets.regenerated':
      return { title: 'Brackets were regenerated', detail: 'The bracket field was rebuilt after tournament changes.' };
    case 'brackets.deleted':
      return { title: 'Brackets were deleted', detail: 'Generated bracket records were removed.' };
    case 'entries.imported':
      return { title: 'Entries were imported', detail: 'A batch of bowler entries was added from an import.' };
    case 'player.added':
      return { title: 'A bowler was added', detail: 'A new bowler entry was added to the tournament.' };
    case 'player.deleted':
      return { title: 'A bowler was removed', detail: 'A bowler entry was deleted from the tournament.' };
    case 'players.merged':
      return { title: 'Duplicate bowlers were merged', detail: 'Two bowler records were combined.' };
    case 'players.bulk_updated':
      return { title: 'Bowlers were updated', detail: 'Multiple bowler records were changed at once.' };
    case 'squad.created':
      return { title: 'A squad was added', detail: 'A new squad time was added to the tournament.' };
    case 'squad.deleted':
    case 'squads.deleted':
      return { title: 'A squad was removed', detail: 'One or more squad times were removed from the tournament.' };
    case 'squads.changed':
      return { title: 'Squad times were changed', detail: 'The tournament squad schedule was updated.' };
    case 'tournament.bracket_settings_updated':
      return { title: 'Tournament setup was updated', detail: 'Bracket, fee, handicap, or side pot settings were changed.' };
    case 'tournament.settings_updated':
      return { title: 'Tournament details were updated', detail: 'The tournament name, location, dates, or schedule was changed.' };
    case 'tournament.archived':
      return { title: 'Tournament was archived', detail: 'This tournament was moved out of active use.' };
    case 'tournament.restored':
      return { title: 'Tournament was restored', detail: 'This tournament was returned to active use.' };
    case 'tournament.created':
      return { title: 'Tournament was created', detail: 'This tournament record was created.' };
    case 'tournament.duplicated':
      return { title: 'Tournament was duplicated', detail: 'This tournament was created from another tournament.' };
    case 'tournament.template_used':
      return { title: 'Tournament was used as a template', detail: 'Another tournament was created from this one.' };
    default:
      return { title: entry.summary, detail: 'A tournament record was updated.' };
  }
};

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
  activityEntries: TournamentActivityEntry[];
  activityLoading: boolean;
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
  activityEntries,
  activityLoading,
}: DashboardBoardProps) {
  const ContinueActionIcon = dashboardActionIcons[contextPrimaryAction.key] ?? ArrowRight;

  return (
    <div className={styles.dashboardBoard}>
      <section className={styles.dashboardHeaderCard}>
        <div className={styles.dashboardHeaderTop}>
          <div>
            <div className={styles.tournamentTitleRow}>
              <h2 className={styles.dashboardTournamentName}>{tournament.name}</h2>
              <span className={styles.lifecycleBadge}>{(tournament.archived_at ? 'archived' : tournament.lifecycle_status || 'setup').replaceAll('_', ' ')}</span>
            </div>
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

      <article className={`${styles.dashboardPanel} ${styles.activityPanel}`}>
        <h3 className={styles.dashboardPanelHeading}>
          <Activity className={styles.dashboardPanelIcon} aria-hidden="true" />
          <span className={styles.dashboardPanelTitle}>Tournament Activity</span>
        </h3>
        {activityLoading ? (
          <div className={styles.activityState} role="status">Loading tournament activity...</div>
        ) : activityEntries.length === 0 ? (
          <div className={styles.activityState}>No tournament activity recorded yet.</div>
        ) : (
          <div className={styles.activityList}>
                {activityEntries.map(entry => {
                  const activityText = getActivityText(entry);
                  return (
                    <article className={styles.activityItem} key={entry.id}>
                      <div className={styles.activityItemHeader}>
                        <div>
                          <strong>{activityText.title}</strong>
                          <span>{activityText.detail}</span>
                        </div>
                        <time dateTime={entry.created_at}>{formatActivityTime(entry.created_at)}</time>
                      </div>
                      {entry.reason ? <p className={styles.activityReason}><span>Reason given:</span> {entry.reason}</p> : null}
                      <div className={styles.activityMeta}>Changed by {entry.user_display_name}</div>
                    </article>
                  );
                })}
          </div>
        )}
      </article>
    </div>
  );
}
