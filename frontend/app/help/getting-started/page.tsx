'use client';

import styles from './getting-started.module.css';

const steps = [
  { id: 'setup', number: '01', area: 'Dashboard and Tournament Settings', title: 'Set up the tournament', text: 'The Dashboard is the home for each event. Tournament details and squad times establish the schedule; Tournament Settings define the bracket programs, side pots, and payout rules used later in the workflow.' },
  { id: 'entries', number: '02', area: 'Entries', title: 'Build the squad entry list', text: 'Entries belong to the active tournament and squad. Each record can include the bowler’s USBC number, average, division, bracket and side-pot selections, and payment status. History search reduces repeat data entry, while Excel import and export support larger lists.' },
  { id: 'brackets', number: '03', area: 'Brackets', title: 'Create the matchups', text: 'BracketWorks uses the eligible entries and configured programs to generate the bracket sets. If relevant entries change afterward, the app warns that affected brackets may need to be regenerated before results can be trusted.' },
  { id: 'scores', number: '04', area: 'Scores', title: 'Record and validate scores', text: 'Scratch game scores can be entered in the table or through the Excel workflow. Handicap values and totals are calculated from tournament settings and bowler averages. Validation identifies incomplete or invalid scoring before the workflow moves forward.' },
  { id: 'standings', number: '05', area: 'Brackets and Live View', title: 'Follow results and advancement', text: 'Saved scores determine bracket winners and advancement, tournament standings, and side-pot results. Until scoring is complete and reviewed, results should be treated as provisional.' },
  { id: 'payouts', number: '06', area: 'Payouts', title: 'Review tournament payouts', text: 'Payouts combine bracket winners and side-pot results with the configured payout rules. The page provides review controls, paid-status tracking, and export options so the director can verify the results before completing the event.' },
  { id: 'live-view', number: '07', area: 'Public Live View', title: 'Publish results for bowlers', text: 'Live View presents the bracket summary, individual brackets, and side-pot results on a public page that does not require an account. The same view is designed to work on phones and can be shared directly or by QR code.' },
];

export default function GettingStartedPage() {
  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Tournament workflow</p>
        <h1>Run a tournament from setup to Live View</h1>
        <p>This is a map of how information moves through BracketWorks—not a required checklist. The active tournament and squad shown in the navigation determine which competition you are viewing and editing.</p>
      </section>
      <div className={styles.steps}>
        {steps.map(step => (
          <section className={styles.step} id={step.id} key={step.id}>
            <div className={styles.number} aria-hidden="true">{step.number}</div>
            <div className={styles.stepBody}><span className={styles.area}>{step.area}</span><h2>{step.title}</h2><p>{step.text}</p></div>
          </section>
        ))}
      </div>
      <aside className={styles.note}><strong>Before finalizing:</strong> Follow the warnings and review controls shown on each page. Correct entry, bracket, or score issues before locking scores or finalizing payouts.</aside>
    </div>
  );
}
