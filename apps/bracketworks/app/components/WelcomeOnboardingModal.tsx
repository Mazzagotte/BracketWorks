'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import CloseControl from '../../components/CloseControl';
import { ONBOARDING_STORAGE_KEY, OPEN_ONBOARDING_EVENT } from '../lib/onboarding';
import { setBodyInteractionState } from '../utils/modalUtils';
import buttonStyles from '../styles/buttons.module.css';
import modalStyles from '../styles/modals.module.css';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBodyInteractionState({ scrollLocked: true, touchLocked: false });
    const frame = requestAnimationFrame(() => primaryRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      setBodyInteractionState({ scrollLocked: false, touchLocked: false });
      previousFocusRef.current?.focus();
    };
  }, [dismiss, open]);

  if (!enabled || !open) return null;
  return (
    <div className={modalStyles.overlay}>
      <div ref={dialogRef} className={`${modalStyles.modal} ${modalStyles.compactModal}`} role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description" tabIndex={-1}>
        <div className={modalStyles.header}>
          <p className={modalStyles.kicker}>Getting Started</p>
          <h2 id="welcome-title">Welcome to BracketWorks</h2>
          <CloseControl className={modalStyles.closeButton} position="absolute" size="sm" onClick={dismiss} />
        </div>
        <div className={`${modalStyles.content} ${styles.content}`}>
          <p id="welcome-description">BracketWorks keeps tournament setup, entries, brackets, scores, payouts, and public results in one connected workflow. This overview explains how the parts fit together; you do not need to complete anything now.</p>
          <div className={styles.workflow} role="group" aria-label="Choose a workflow stage">
            {workflowStages.map((stage, index) => (
              <button
                key={stage.id}
                id={`workflow-tab-${stage.id}`}
                type="button"
                aria-pressed={activeStage === index}
                className={activeStage === index ? styles.workflowActive : undefined}
                onClick={() => selectStage(index)}
              >
                <span>{index + 1}</span>{stage.label}
              </button>
            ))}
          </div>
          <div id="workflow-stage-panel" className={styles.firstStep} role="region" aria-live="polite" aria-label={`${selectedStage.label} workflow overview`}>
            <span className={styles.stepNumber}>{activeStage + 1}</span>
            <div><strong>{selectedStage.title}</strong><span>{selectedStage.description}</span></div>
          </div>
          <div className={styles.actions}>
            <Link ref={primaryRef} href={`/help/getting-started#${selectedStage.id}`} className={`${buttonStyles.button} ${buttonStyles.primary}`} onClick={dismiss}>View Full Workflow</Link>
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.secondary}`}
              onClick={hasViewedAllStages ? dismiss : showNextStage}
            >
              {hasViewedAllStages ? 'Got It' : 'Next'}
            </button>
          </div>
          <p className={styles.reopenNote}>You can reopen this overview later from Help or Settings.</p>
        </div>
      </div>
    </div>
  );
}
