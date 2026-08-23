import { useMemo } from 'react';

import type { DashboardTournamentBootstrapResponse } from '../../lib/types';
import type { DashboardScoreProgress } from './useDashboardScoreProgress';

export type DashboardAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  indicator?: string;
};

export type ContextPrimaryAction = {
  key: string;
  label: string;
  message: string;
  onClick: () => void;
  disabled: boolean;
  showScoreProgress: boolean;
};

export type WorkflowStep = {
  key: string;
  step: string;
  label: string;
  status: string;
  done: boolean;
  active?: boolean;
};

type NarrativeTone = 'info' | 'warning';

type DashboardStatusNarrative = {
  tone: NarrativeTone;
  icon: string;
  warningText: string;
  nextStepText: string;
};

type NormalizedProgram = {
  key: string;
  name: string;
  enabled?: boolean;
};

type ProgramSummaryLike = {
  name: string;
  display_order?: number | null;
};

type UseDashboardWorkflowModelArgs<TProgramSummary extends ProgramSummaryLike> = {
  workflowStatus: DashboardTournamentBootstrapResponse['workflow_status'] | null;
  tournamentBracketsConfigured: boolean;
  loadedEntries: number;
  bracketsSold: number;
  squadsLength: number;
  bracketSize: number;
  missingAveragesCount: number;
  unpaidEntriesCount: number;
  duplicatePlayersCount: number;
  scoreProgress: DashboardScoreProgress;
  normalizedPrograms: NormalizedProgram[];
  statsProgramSummaries: TProgramSummary[];
  isEntryDataSyncing: boolean;
  onGoPlayers: () => void;
  onGoBrackets: () => void;
  onGoPayouts: () => void;
  onGoScores: () => void;
  onOpenEditTournament: () => void;
  onOpenSettings: () => void;
  onOpenSquadSelector: () => void;
  onChangeTournament: () => void;
  onUnloadTournament: () => void;
  onArchiveTournament?: () => void;
  onRestoreTournament?: () => void;
};

export function useDashboardWorkflowModel<TProgramSummary extends ProgramSummaryLike>({
  workflowStatus,
  tournamentBracketsConfigured,
  loadedEntries,
  bracketsSold,
  squadsLength,
  bracketSize,
  missingAveragesCount,
  unpaidEntriesCount,
  duplicatePlayersCount,
  scoreProgress,
  normalizedPrograms,
  statsProgramSummaries,
  isEntryDataSyncing,
  onGoPlayers,
  onGoBrackets,
  onGoPayouts,
  onGoScores,
  onOpenEditTournament,
  onOpenSettings,
  onOpenSquadSelector,
  onChangeTournament,
  onUnloadTournament,
  onArchiveTournament = () => undefined,
  onRestoreTournament = () => undefined,
}: UseDashboardWorkflowModelArgs<TProgramSummary>) {
  const hasGeneratedBrackets = workflowStatus?.has_generated_brackets ?? tournamentBracketsConfigured;
  const hasPayoutSummary = workflowStatus?.has_payout_summary ?? false;
  const payoutsFinalized = workflowStatus?.payouts_finalized ?? false;
  const scoresLocked = workflowStatus?.scores_locked ?? payoutsFinalized;
  const isReadOnly = workflowStatus?.read_only ?? false;
  const isArchived = workflowStatus?.lifecycle_status === 'archived';
  const payoutsNotFinalizedCount = loadedEntries > 0 && !payoutsFinalized ? 1 : 0;
  const bracketsNotGeneratedCount = hasGeneratedBrackets ? 0 : 1;

  const workflowSetupBlockers = [
    { label: 'missing averages', count: missingAveragesCount },
    { label: 'unpaid entries', count: unpaidEntriesCount },
    { label: 'duplicate players', count: duplicatePlayersCount },
  ].filter(item => item.count > 0);
  const hasWorkflowSetupBlockers = workflowSetupBlockers.length > 0;
  const workflowBlockerSummary = workflowSetupBlockers.map(item => `${item.count} ${item.label}`).join(' | ');

  const continueTournamentActions: DashboardAction[] = [];
  if (!hasGeneratedBrackets) {
    continueTournamentActions.push({
      key: 'add-player',
      label: 'Add Player',
      indicator: '›',
      onClick: onGoPlayers,
      disabled: isReadOnly,
    });
  }
  if (hasGeneratedBrackets) {
    continueTournamentActions.push({
      key: 'view-brackets',
      label: 'View Brackets',
      indicator: '›',
      onClick: onGoBrackets,
      disabled: false,
    });
  }

  const contextPrimaryAction: ContextPrimaryAction = useMemo(() => {
    if (payoutsFinalized) {
      return {
        key: 'view-payouts',
        label: 'View Final Results',
        message: 'Tournament complete. Payouts are finalized and scores are locked.',
        onClick: onGoPayouts,
        disabled: false,
        showScoreProgress: false,
      };
    }

    if (hasGeneratedBrackets) {
      if (scoreProgress.percent < 100) {
        return {
          key: 'enter-scores',
          label: scoreProgress.entered > 0 ? 'Continue Score Entry' : 'Enter Scores',
          message: scoreProgress.entered > 0 ? 'Scoring is in progress.' : 'Brackets are ready for score entry.',
          onClick: onGoScores,
          disabled: isReadOnly,
          showScoreProgress: true,
        };
      }

      if (!hasPayoutSummary) {
        return {
          key: 'calculate-payouts',
          label: 'Calculate Payouts',
          message: 'All scores are complete. Calculate and review tournament payouts.',
          onClick: onGoPayouts,
          disabled: isReadOnly,
          showScoreProgress: false,
        };
      }

      return {
        key: 'finalize-payouts',
        label: 'Review and Finalize Payouts',
        message: 'Payouts have been calculated and are ready for final review.',
        onClick: onGoPayouts,
        disabled: isReadOnly,
        showScoreProgress: false,
      };
    }

    if (squadsLength === 0) {
      return {
        key: 'edit-tournament',
        label: 'Complete Tournament Setup',
        message: 'Add at least one squad before adding entries.',
        onClick: onOpenEditTournament,
        disabled: isReadOnly,
        showScoreProgress: false,
      };
    }

    if (bracketSize <= 0) {
      return {
        key: 'tournament-settings',
        label: 'Complete Bracket Setup',
        message: 'Choose a valid bracket size and confirm tournament settings.',
        onClick: onOpenSettings,
        disabled: isReadOnly,
        showScoreProgress: false,
      };
    }

    if (loadedEntries <= 0) {
      return {
        key: 'add-player',
        label: 'Add Players',
        message: 'Add tournament entries before generating brackets.',
        onClick: onGoPlayers,
        disabled: isReadOnly,
        showScoreProgress: false,
      };
    }

    if (hasWorkflowSetupBlockers) {
      return {
        key: 'add-player',
        label: 'Review Entries',
        message: `Resolve entry issues before generating brackets: ${workflowBlockerSummary}.`,
        onClick: onGoPlayers,
        disabled: isReadOnly,
        showScoreProgress: false,
      };
    }

    return {
      key: 'generate-brackets',
      label: 'Generate Brackets',
      message: 'Setup and entries are ready. Generate brackets to begin play.',
      onClick: onGoBrackets,
      disabled: isReadOnly,
      showScoreProgress: false,
    };
  }, [
    bracketSize,
    hasGeneratedBrackets,
    hasPayoutSummary,
    hasWorkflowSetupBlockers,
    isReadOnly,
    loadedEntries,
    onGoBrackets,
    onGoPayouts,
    onGoPlayers,
    onGoScores,
    onOpenEditTournament,
    onOpenSettings,
    payoutsFinalized,
    scoreProgress.entered,
    scoreProgress.percent,
    squadsLength,
    workflowBlockerSummary,
  ]);

  const manageSetupActions: DashboardAction[] = [
    {
      key: 'edit-tournament',
      label: 'Edit Tournament',
      onClick: onOpenEditTournament,
      disabled: isReadOnly,
    },
    {
      key: 'tournament-settings',
      label: 'Tournament Settings',
      onClick: onOpenSettings,
      disabled: isReadOnly,
    },
    {
      key: 'change-squad',
      label: 'Change Squad',
      onClick: onOpenSquadSelector,
      disabled: isReadOnly || squadsLength === 0,
    },
  ];

  const moreActions: DashboardAction[] = [
    {
      key: 'change-tournament',
      label: 'Switch Tournament',
      onClick: onChangeTournament,
      disabled: false,
    },
  ];

  const dangerActions: DashboardAction[] = [
    {
      key: isArchived ? 'restore-tournament' : 'archive-tournament',
      label: isArchived ? 'Restore Tournament' : 'Archive Tournament',
      onClick: isArchived ? onRestoreTournament : onArchiveTournament,
      disabled: false,
    },
    {
      key: 'unload-tournament',
      label: 'Unload Tournament',
      onClick: onUnloadTournament,
      disabled: false,
    },
  ];

  const dataIssuesCount = [
    missingAveragesCount > 0,
    unpaidEntriesCount > 0,
    duplicatePlayersCount > 0,
  ].filter(Boolean).length;

  const setupChecklist = [
    loadedEntries > 0,
    bracketSize > 0,
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

  const scoreStatusLabel = useMemo(() => {
    if (scoreProgress.loading) return 'Checking...';
    if (scoresLocked) return 'Locked';
    if (scoreProgress.entered > 0) return 'In Progress';
    return 'None';
  }, [scoreProgress.entered, scoreProgress.loading, scoresLocked]);

  const payoutWorkflowStatusLabel = useMemo(() => {
    if (payoutsFinalized) return 'Finalized';
    if (!hasGeneratedBrackets) return 'Pending';
    if (scoreProgress.percent >= 100) return 'Ready for Payouts';
    return 'Pending';
  }, [payoutsFinalized, hasGeneratedBrackets, scoreProgress.percent]);

  const payoutStatusLabel = payoutWorkflowStatusLabel;
  const totalScoresTarget = Math.max(scoreProgress.total, loadedEntries);
  const workflowScoreProgressText = scoreProgress.loading
    ? 'Checking progress...'
    : `${scoreProgress.completed} of ${totalScoresTarget} scored`;
  const scoreProgressText = scoreProgress.loading
    ? 'Checking score progress...'
    : `${scoreProgress.completed} of ${totalScoresTarget} players fully scored`;

  const statusNarrative: DashboardStatusNarrative = useMemo(() => {
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

  const workflowSteps: WorkflowStep[] = [
    { key: 'setup', step: '1', label: 'Setup', status: setupIncomplete ? 'In Progress' : 'Complete', done: !setupIncomplete },
    { key: 'entries', step: '2', label: 'Entries', status: loadedEntries > 0 ? 'Complete' : 'Pending', done: loadedEntries > 0 },
    { key: 'brackets', step: '3', label: 'Brackets', status: hasGeneratedBrackets ? 'Complete' : 'Pending', done: hasGeneratedBrackets },
    { key: 'scores', step: '4', label: 'Scores', status: workflowScoreProgressText, done: scoresLocked, active: hasGeneratedBrackets && !scoresLocked },
    { key: 'payouts', step: '5', label: 'Payouts', status: payoutStatusLabel, done: payoutsFinalized },
  ];

  const orderedStatsProgramSummaries = useMemo(() => {
    return [...statsProgramSummaries].sort((a, b) => {
      const aOrder = a.display_order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.display_order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    });
  }, [statsProgramSummaries]);

  return {
    hasGeneratedBrackets,
    hasPayoutSummary,
    isReadOnly,
    payoutsFinalized,
    scoresLocked,
    payoutsNotFinalizedCount,
    bracketsNotGeneratedCount,
    continueTournamentActions,
    contextPrimaryAction,
    manageSetupActions,
    moreActions,
    dangerActions,
    dataIssuesCount,
    setupIncomplete,
    setupBlockers,
    hasSetupBlockers,
    optionalProgramNames,
    optionalProgramsSummary,
    blockerSummary,
    scoreStatusLabel,
    payoutStatusLabel,
    workflowScoreProgressText,
    scoreProgressText,
    statusNarrative,
    workflowSteps,
    orderedStatsProgramSummaries,
  };
}
