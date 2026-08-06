'use client';

import { useState } from 'react';
import { Brackets, Calculator, CheckCircle2, ClipboardList, Eye, Settings2, Trophy, Users } from 'lucide-react';
import styles from '../page.module.css';

const stages = [
  { label: 'Setup', icon: Settings2, status: 'Complete', title: 'Set the rules before play begins', description: 'Define the tournament, squads, bracket programs, entry pricing, side pots, and payout rules in one place.', metric: '2 squads ready', checks: ['8-player brackets', '90% of 220 handicap', 'Four side pots enabled'], next: 'Build the field and confirm every entry.' },
  { label: 'Entries', icon: Users, status: 'Complete', title: 'Build a clean tournament field', description: 'Keep bowler details, averages, divisions, squads, bracket entries, side-pot selections, and payments together.', metric: '32 bowlers · 72 entries', checks: ['All averages entered', 'All balances paid', 'No duplicate bowlers'], next: 'Generate matchups from the reviewed entries.' },
  { label: 'Brackets', icon: Brackets, status: 'Generated', title: 'Turn reviewed entries into matchups', description: 'Generate each configured bracket program, review the draw, record results, and advance winners round by round.', metric: '9 brackets ready', checks: ['4 Handicap brackets', '3 Scratch brackets', '2 Reverse Scratch brackets'], next: 'Record scores as the squad bowls.' },
  { label: 'Scores', icon: ClipboardList, status: 'In progress', title: 'Keep score entry accurate and visible', description: 'Enter squad scores, find incomplete games, correct mistakes, and lock results after they have been verified.', metric: '21 of 32 complete', checks: ['21 complete scorecards', '11 still need scores', 'Results remain unlocked'], next: 'Finish the remaining scores and review standings.' },
  { label: 'Standings', icon: Trophy, status: 'Provisional', title: 'Review results as they take shape', description: 'Check scratch and handicap standings while unfinished scorecards remain clearly marked as incomplete.', metric: 'Provisional results', checks: ['Scratch standings available', 'Handicap standings available', 'Incomplete scores identified'], next: 'Complete scoring before payout finalization.' },
  { label: 'Payouts', icon: Calculator, status: 'Pending', title: 'Review the money before closing out', description: 'Confirm prize pools, winners, side-pot results, payout amounts, and paid status before finalization and export.', metric: '$756 projected', checks: ['$864 collected', '$108 house fees', 'Awaiting final scores'], next: 'Finalize payouts after every result is verified.' },
  { label: 'Live View', icon: Eye, status: 'Published', title: 'Publish results for bowlers to follow', description: 'Share a public, mobile-supported page with bracket summaries, matchups, and side-pot results—no account required.', metric: 'Public page active', checks: ['No sign-in required', 'Bowler search included', 'Automatic refresh available'], next: 'Keep Live View available throughout the tournament.' },
] as const;

export default function LandingWorkflow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = stages[activeIndex] ?? stages[0]!;
  const ActiveIcon = active.icon;

  const moveToTab = (index: number) => {
    const nextIndex = (index + stages.length) % stages.length;
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => document.getElementById(`workflow-tab-${nextIndex}`)?.focus());
  };

  return (
    <div className={styles.workflowExplorer}>
      <div className={styles.workflowTabs} role="tablist" aria-label="Tournament workflow stages">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <button key={stage.label} id={`workflow-tab-${index}`} type="button" role="tab" aria-selected={activeIndex === index} aria-controls="workflow-detail" tabIndex={activeIndex === index ? 0 : -1} className={activeIndex === index ? styles.workflowTabActive : styles.workflowTab} onClick={() => setActiveIndex(index)} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveToTab(activeIndex + 1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); moveToTab(activeIndex - 1); } else if (event.key === 'Home') { event.preventDefault(); moveToTab(0); } else if (event.key === 'End') { event.preventDefault(); moveToTab(stages.length - 1); } }}>
              <span>{index + 1}</span><Icon aria-hidden="true" /><strong>{stage.label}</strong><small>{stage.status}</small>
            </button>
          );
        })}
      </div>
      <article id="workflow-detail" className={styles.workflowDetail} role="tabpanel" aria-labelledby={`workflow-tab-${activeIndex}`} tabIndex={0}>
        <div className={styles.workflowDetailMain}>
          <span className={styles.workflowDetailIcon}><ActiveIcon aria-hidden="true" /></span>
          <div><p className={styles.workflowStageLabel}>{active.label} · {active.status}</p><h3>{active.title}</h3><p>{active.description}</p></div>
        </div>
        <div className={styles.workflowMetric}><small>Famous Frames Invitational</small><strong>{active.metric}</strong></div>
        <ul>{active.checks.map(check => <li key={check}><CheckCircle2 aria-hidden="true" />{check}</li>)}</ul>
        <p className={styles.workflowNext}><span>Next</span>{active.next}</p>
      </article>
    </div>
  );
}
