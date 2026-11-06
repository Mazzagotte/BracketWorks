import { ArrowRight, CheckCircle2, ChevronRight, type LucideIcon } from 'lucide-react';
import {
  ActivityList,
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  ICON_SIZE,
  Page,
  PageColumns,
  PageHeader,
  ProgressBar,
  StatGroup,
  capitalizeFirstLetter,
} from '@bracketworks/ui';

import type { BracketSettings, Tournament, TournamentActivityEntry } from '../../lib/types';
import type { Squad } from '../../lib/types';
import type { DashboardScoreProgress } from '../hooks/useDashboardScoreProgress';
import styles from './DashboardBoard.module.css';

const formatActivityTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const visibleActivityEventTypes = new Set([
  'scores.unlocked',
  'scores.locked',
  'score.changed',
  'score.deleted',
  'payouts.calculated',
  'payouts.reopened',
  'payouts.adjusted',
  'payouts.finalized',
  'players.merged',
  'players.duplicate_resolved',
  'tournament.archived',
  'tournament.restored',
]);

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
  const visibleActivityEntries = activityEntries.filter(entry => visibleActivityEventTypes.has(entry.event_type));
  const lifecycle = (tournament.archived_at ? 'archived' : tournament.lifecycle_status || 'setup').replaceAll('_', ' ');
  const lifecycleTone = tournament.archived_at ? 'neutral' : lifecycle === 'complete' || lifecycle === 'completed' ? 'success' : lifecycle === 'in progress' ? 'info' : 'neutral';

  const actionButton = (action: DashboardAction, variant: 'secondary' | 'ghost' | 'ghost-danger') => {
    const ActionIcon = dashboardActionIcons[action.key] ?? ArrowRight;
    return (
      <Button
        key={action.key}
        variant={variant}
        fullWidth
        className={styles.actionButton}
        icon={<ActionIcon size={ICON_SIZE.md} aria-hidden="true" />}
        onClick={action.onClick}
        disabled={action.disabled}
      >
        <span className={styles.actionLabel}>{action.label}</span>
        {action.indicator ? <ChevronRight size={ICON_SIZE.sm} aria-hidden="true" className={styles.actionIndicator} /> : null}
      </Button>
    );
  };

  return (
    <Page>
      <PageHeader
        title={tournament.name}
        badge={<Badge tone={lifecycleTone}>{capitalizeFirstLetter(lifecycle)}</Badge>}
        description={[
          tournamentDateLabel,
          squadTimeLabel || (activeSquad ? activeSquad.time : 'Squad time pending'),
          `${loadedEntries} players`,
          `${statsEntrySummary.totalEntries} entries`,
        ].join(' · ')}
      />

      <ol className={styles.workflow} aria-label="Tournament workflow">
        {workflowSteps.map((step) => (
          <li
            key={step.key}
            className={step.done ? styles.stepDone : step.active ? styles.stepActive : styles.step}
            aria-current={step.active ? 'step' : undefined}
          >
            {step.done
              ? <CheckCircle2 className={styles.stepCheck} size={ICON_SIZE.md} aria-label="Complete" />
              : <span className={styles.stepNumber} aria-hidden="true">{step.step}</span>}
            <span className={styles.stepText}>
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepStatus}>{step.status}</span>
            </span>
          </li>
        ))}
      </ol>

      <StatGroup
        label="Tournament totals"
        items={[
          { label: 'Players', value: String(loadedEntries) },
          { label: 'Total entries', value: String(statsEntrySummary.totalEntries) },
          { label: 'Expected revenue', value: formatUsd(statsEntrySummary.totalRevenue) },
          { label: 'Prize fund', value: formatUsd(tournamentProjectedPayout) },
        ]}
      />

      <PageColumns
        main={(
          <>
            <div className={styles.panelGrid}>
              <Card aria-label="Tournament setup">
                <CardHeader title="Tournament setup" />
                <dl className={styles.rows}>
                  <div><dt>Bracket size</dt><dd>{bracketSettings.bracket_size} players</dd></div>
                  <div><dt>Entry fee</dt><dd>{formatUsd(bracketSettings.default_entry_fee)}</dd></div>
                  <div><dt>Handicap</dt><dd>{bracketSettings.handicap_percentage}% of {bracketSettings.handicap_base}</dd></div>
                  <div><dt>{capitalizeFirstLetter(optionalProgramsLabel.toLowerCase())}</dt><dd>{optionalProgramsSummary}</dd></div>
                  <div>
                    <dt>Byes</dt>
                    <dd><Badge tone={bracketSettings.allow_byes ? 'success' : 'neutral'}>{bracketSettings.allow_byes ? 'Enabled' : 'Disabled'}</Badge></dd>
                  </div>
                  <div>
                    <dt>Side pots</dt>
                    <dd><Badge tone={enabledSidePotsCount > 0 ? 'success' : 'neutral'}>{enabledSidePotsCount > 0 ? 'Enabled' : 'Disabled'}</Badge></dd>
                  </div>
                </dl>
              </Card>

              <Card aria-label="Financial summary">
                <CardHeader title="Financial summary" />
                <dl className={styles.rows}>
                  <div><dt>Gross collected</dt><dd>{formatUsd(grossCollected)}</dd></div>
                  <div><dt>House fee</dt><dd>-{formatUsd(houseRetained)}</dd></div>
                  <div className={styles.totalRow}><dt>Available prize pool</dt><dd>{formatUsd(tournamentProjectedPayout)}</dd></div>
                </dl>
                <CardDivider />
                <h3 className={styles.subsectionTitle}>Payout split</h3>
                <dl className={styles.rows}>
                  <div><dt>1st place</dt><dd>{formatUsd(bracketSettings.first_place_amount)}</dd></div>
                  <div><dt>2nd place</dt><dd>{formatUsd(bracketSettings.second_place_amount)}</dd></div>
                </dl>
              </Card>
            </div>

            <Card aria-label="Entry breakdown">
              <CardHeader title="Entry breakdown" />
              <dl className={styles.rows}>
                {orderedStatsProgramSummaries.map((program) => {
                  const percentage = statsEntrySummary.totalEntries > 0
                    ? Math.round((program.totalEntries / statsEntrySummary.totalEntries) * 100)
                    : 0;
                  return (
                    <div key={program.key}>
                      <dt>
                        <span className={styles.programName}>{program.name}</span>
                        <span className={styles.programMeta}>
                          {percentage}% · {program.expectedBrackets} {program.expectedBrackets === 1 ? 'bracket' : 'brackets'}
                        </span>
                      </dt>
                      <dd className={styles.programCount}>{program.totalEntries}</dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          </>
        )}
        side={(
          <Card aria-label="Tournament actions">
            <section className={styles.sideSection} aria-labelledby="dashboard-next-step">
              <h2 id="dashboard-next-step" className={styles.overline}>Next step</h2>
              <div className={styles.nextStep}>
                <ContinueActionIcon className={styles.nextStepIcon} size={ICON_SIZE.md} aria-hidden="true" />
                <div className={styles.nextStepText}>
                  <span className={styles.subsectionTitle}>{contextPrimaryAction.label}</span>
                  {!contextPrimaryAction.showScoreProgress ? <span className={styles.helper}>{contextPrimaryAction.message}</span> : null}
                </div>
              </div>
              {contextPrimaryAction.showScoreProgress ? (
                <ProgressBar
                  value={scoreProgress.percent}
                  max={100}
                  label={`${scoreProgress.percent}% of players fully scored`}
                  valueText={scoreProgressText}
                />
              ) : null}
              <Button variant="primary" fullWidth onClick={contextPrimaryAction.onClick} disabled={contextPrimaryAction.disabled}>
                {contextPrimaryAction.label}
              </Button>
            </section>

            {continueTournamentActions.length > 0 ? (
              <>
                <CardDivider />
                <section className={styles.sideSection} aria-labelledby="dashboard-quick-actions">
                  <h2 id="dashboard-quick-actions" className={styles.overline}>Quick actions</h2>
                  <div className={styles.actionList}>{continueTournamentActions.map((action) => actionButton(action, 'secondary'))}</div>
                </section>
              </>
            ) : null}

            <CardDivider />
            <section className={styles.sideSection} aria-labelledby="dashboard-management">
              <h2 id="dashboard-management" className={styles.overline}>Tournament management</h2>
              <div className={styles.actionList}>
                {manageSetupActions.map((action) => actionButton(action, 'ghost'))}
                {moreActions.map((action) => actionButton(action, 'ghost'))}
              </div>
            </section>

            {dangerActions.length > 0 ? (
              <>
                <CardDivider />
                <section className={styles.sideSection} aria-labelledby="dashboard-danger">
                  <h2 id="dashboard-danger" className={styles.overline}>Danger zone</h2>
                  <div className={styles.actionList}>{dangerActions.map((action) => actionButton(action, 'ghost-danger'))}</div>
                </section>
              </>
            ) : null}
          </Card>
        )}
      />

      <Card aria-label="Tournament activity">
        <CardHeader title="Tournament activity" description="Score unlocks, payout changes, and other review items." />
        {activityLoading ? (
          <p className={styles.helper} role="status">Loading tournament activity...</p>
        ) : visibleActivityEntries.length === 0 ? (
          <p className={styles.helper}>No score unlocks, payout changes, or other review items yet.</p>
        ) : (
          <ActivityList
            items={visibleActivityEntries.map((entry) => {
              const activityText = getActivityText(entry);
              return {
                id: String(entry.id),
                title: activityText.title,
                time: <time dateTime={entry.created_at}>{formatActivityTime(entry.created_at)}</time>,
                detail: [
                  activityText.detail,
                  entry.reason ? `Reason: ${entry.reason}` : null,
                  `Changed by ${entry.user_display_name}`,
                ].filter(Boolean).join(' · '),
              };
            })}
          />
        )}
      </Card>
    </Page>
  );
}
