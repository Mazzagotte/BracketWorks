'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, buttonClassName } from '@bracketworks/ui';
import { ONBOARDING_STORAGE_KEY, OPEN_ONBOARDING_EVENT } from '../lib/onboarding';
import styles from './WelcomeOnboardingModal.module.css';
import { apiClient } from '../lib/api';

const workflowStages = [
  { id: 'setup', label: 'Setup', title: 'The Dashboard is the starting point.', description: 'A tournament contains its squads, settings, entries, brackets, scores, and results. The active tournament and squad determine which records you see throughout the app.' },
  { id: 'entries', label: 'Entries', title: 'Entries build the active squad.', description: 'Bowler information, averages, divisions, bracket selections, side pots, and payment status are recorded here. History search and Excel tools help with larger or returning fields.' },
  { id: 'brackets', label: 'Brackets', title: 'Entries become bracket matchups.', description: 'BracketWorks generates the configured programs from eligible entries. If relevant entries change later, the app warns you when affected brackets should be regenerated.' },
  { id: 'scores', label: 'Scores', title: 'Scores drive every result.', description: 'Scratch scores can be entered directly or imported. BracketWorks calculates handicap values and totals, validates the scoring data, and uses saved scores to determine advancement.' },
  { id: 'standings', label: 'Results', title: 'Results remain connected to scoring.', description: 'Tournament standings, bracket winners, and side-pot results update from the recorded scores. Incomplete scoring and review warnings indicate when results are still provisional.' },
  { id: 'payouts', label: 'Payouts', title: 'Payouts bring the results together.', description: 'Bracket winners and side-pot results are combined with the configured payout rules. Directors can review amounts, track paid status, and export payout records.' },
  { id: 'live-view', label: 'Live View', title: 'Live View shares public results.', description: 'Bowlers can see the bracket summary, individual brackets, and side-pot results without signing in. The public view is phone-friendly and can be shared by link or QR code.' },
] as const;

export default function WelcomeOnboardingModal({ enabled, userId }: { enabled: boolean; userId?: string }) {
  const [open, setOpen] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [viewedStages, setViewedStages] = useState<Set<number>>(() => new Set([0]));
  const storageKey = userId ? `${ONBOARDING_STORAGE_KEY}:${userId}` : ONBOARDING_STORAGE_KEY;
  const selectedStage = workflowStages[activeStage] ?? workflowStages[0];
  const hasViewedAllStages = viewedStages.size === workflowStages.length;

  const selectStage = (index: number) => {
    setActiveStage(index);
    setViewedStages(previous => new Set(previous).add(index));
  };

  const showNextStage = () => {
    for (let offset = 1; offset <= workflowStages.length; offset += 1) {
      const candidate = (activeStage + offset) % workflowStages.length;
      if (!viewedStages.has(candidate)) {
        selectStage(candidate);
        return;
      }
    }
  };

  const dismiss = useCallback(() => {
    localStorage.setItem(storageKey, 'dismissed');
    void apiClient.post('/api/v1/users/acknowledgments', { content_type: 'welcome', content_id: 'getting-started', version: '1' }).catch(() => undefined);
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_ONBOARDING_EVENT, reopen);
    if (localStorage.getItem(storageKey) !== 'dismissed') setOpen(true);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, reopen);
  }, [enabled, storageKey]);

  if (!enabled) return null;
  return (
    <Modal
      open={open}
      onClose={dismiss}
      closeLabel="Close welcome"
      title="Welcome to BracketWorks"
      description="Tournament setup, entries, brackets, scores, payouts, and public results work as one connected workflow. This overview shows how they fit together; you do not need to do anything now."
      footer={(
        <>
          <Link href={`/help/getting-started#${selectedStage.id}`} className={buttonClassName({ variant: 'secondary' })} onClick={dismiss}>View full workflow</Link>
          <Button variant="primary" onClick={hasViewedAllStages ? dismiss : showNextStage}>{hasViewedAllStages ? 'Got it' : 'Next'}</Button>
        </>
      )}
    >
      <div className={styles.body}>
        <ol className={styles.stages} aria-label="Workflow stages">
          {workflowStages.map((stage, index) => (
            <li key={stage.id}>
              <button
                id={`workflow-tab-${stage.id}`}
                type="button"
                aria-pressed={activeStage === index}
                className={activeStage === index ? `${styles.stage} ${styles.stageActive}` : styles.stage}
                onClick={() => selectStage(index)}
              >
                {index + 1}. {stage.label}
              </button>
            </li>
          ))}
        </ol>
        <div id="workflow-stage-panel" className={styles.panel} role="region" aria-live="polite" aria-label={`${selectedStage.label} workflow overview`}>
          <h3 className={styles.panelTitle}>{selectedStage.title}</h3>
          <p className={styles.text}>{selectedStage.description}</p>
        </div>
        <p className={styles.meta}>You can reopen this overview later from Help or Settings.</p>
      </div>
    </Modal>
  );
}
