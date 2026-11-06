'use client';

import { Card, Notice, Page, PageHeader } from '@bracketworks/ui';

import styles from './getting-started.module.css';

const steps = [
  { id: 'setup', number: '01', area: 'Dashboard and tournament settings', title: 'Set up the tournament', text: 'The Dashboard is the home for each event. Tournament details and squad times establish the schedule; Tournament Settings define the bracket programs, side pots, and payout rules used later in the workflow.' },
  { id: 'entries', number: '02', area: 'Entries', title: 'Build the squad entry list', text: 'Entries belong to the active tournament and squad. Each record can include a USBC number, average, division, bracket and side-pot selections, and payment status. History search reduces repeat data entry, while Excel import and export support larger lists.' },
  { id: 'brackets', number: '03', area: 'Brackets', title: 'Create the matchups', text: 'BracketWorks uses the eligible entries and configured programs to generate the bracket sets. If relevant entries change afterward, the app warns that affected brackets may need to be regenerated before results can be trusted.' },
  { id: 'scores', number: '04', area: 'Scores', title: 'Record and validate scores', text: 'Scratch game scores can be entered in the table or through the Excel workflow. Handicap values and totals are calculated from tournament settings and bowler averages. Validation identifies incomplete or invalid scoring before the workflow moves forward.' },
  { id: 'standings', number: '05', area: 'Brackets and Live View', title: 'Follow results and advancement', text: 'Saved scores determine bracket winners and advancement, tournament standings, and side-pot results. Until scoring is complete and reviewed, results should be treated as provisional.' },
  { id: 'payouts', number: '06', area: 'Payouts', title: 'Review tournament payouts', text: 'Payouts combine bracket winners and side-pot results with the configured payout rules. The page provides review controls, paid-status tracking, and export options so the director can verify the results before completing the event.' },
  { id: 'live-view', number: '07', area: 'Public Live View', title: 'Publish results for bowlers', text: 'Live View presents the bracket summary, individual brackets, and side-pot results on a public page that does not require an account. The same view is designed to work on phones and can be shared directly or by QR code.' },
];

export default function GettingStartedPage() {
  return (
    <Page width="narrow">
      <PageHeader
        overline="Tournament workflow"
        title="Run a tournament from setup to Live View"
        description="A map of how information moves through BracketWorks, not a required checklist. The active tournament and squad in the top bar decide which competition you are viewing and editing."
      />
      <Card>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li className={styles.step} id={step.id} key={step.id}>
              <p className={styles.area}>{index + 1}. {step.area}</p>
              <h2 className={styles.title}>{step.title}</h2>
              <p className={styles.text}>{step.text}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Notice tone="info">
        Before finalizing, follow the warnings and review steps on each page. Fix entry, bracket, or score issues before locking scores or finalizing payouts.
      </Notice>
    </Page>
  );
}
