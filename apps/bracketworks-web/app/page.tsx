import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Card, ICON_SIZE, NavItem, Page, StatGroup, TopNav, TopNavBrand, buttonClassName } from '@bracketworks/ui';
import styles from './page.module.css';
import DemoDashboard from './demo/DemoDashboard';
import DemoLiveView from './demo/DemoLiveView';
import LandingWorkflow from './components/LandingWorkflow';

export const metadata: Metadata = {
  title: 'Bowling Tournament Management Software | BracketWorks',
  description: 'BracketWorks helps bowling tournament directors manage entries, brackets, side pots, scores, standings, payouts, and live results from one organized platform.',
  alternates: { canonical: 'https://bracketworks.app/' },
  robots: { index: true, follow: true },
  keywords: 'bowling tournament software, bowling brackets, live score tracking, bowling payouts, tournament director tools, side pots',
  openGraph: {
    title: 'Bowling Tournament Management Software | BracketWorks',
    description: 'BracketWorks helps bowling tournament directors manage entries, brackets, side pots, scores, standings, payouts, and live results.',
    type: 'website', url: 'https://bracketworks.app/', siteName: 'BracketWorks',
  },
  twitter: { card: 'summary', title: 'Bowling Tournament Management Software | BracketWorks', description: 'Bowling tournament management tools for tournament directors.' },
};

const organizationJsonLd = {
  '@context': 'https://schema.org', '@type': 'Organization', name: 'BracketWorks',
  url: 'https://bracketworks.app/', logo: 'https://bracketworks.app/logo_no_text.svg',
  description: 'Bowling tournament management software for tournament directors',
};

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'BracketWorks',
  applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: 'https://bracketworks.app/',
  description: 'BracketWorks helps bowling tournament directors manage entries, brackets, side pots, scores, standings, payouts, and live results.',
};

const NAV_LINKS = [
  { href: '#dashboard-preview', label: 'Dashboard' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#live-view', label: 'Live view' },
  { href: '#controls', label: 'Safeguards' },
];

const SAFEGUARDS = [
  { stage: 'Before brackets', title: 'Confirm the field is ready', text: 'Review missing averages, unpaid balances, and duplicate bowlers before generating matchups.' },
  { stage: 'After entry changes', title: 'Know when brackets are out of date', text: 'BracketWorks warns you when roster changes affect brackets that are already generated.' },
  { stage: 'Before payouts', title: 'Finish and verify scoring', text: 'Incomplete scores stay visible, and verified scores can be locked before final calculations.' },
  { stage: 'Final review', title: 'Check every payout before export', text: 'Review prize pools, winners, amounts, and paid status before closing the tournament.' },
];

export default function HomePage() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }} />
      <TopNav
        navLabel="Homepage"
        brand={(
          <TopNavBrand
            href="/"
            aria-label="BracketWorks home"
            mark={<Image src="/logo_no_text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />}
            name="BracketWorks"
          />
        )}
        actions={(
          <>
            <Link href="/login" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>Log in</Link>
            <Link href="/signup" className={buttonClassName({ variant: 'primary', size: 'sm' })}>Create account</Link>
          </>
        )}
      >
        {NAV_LINKS.map(link => <NavItem key={link.href} href={link.href}>{link.label}</NavItem>)}
      </TopNav>

      <main id="main-content">
        <Page>
          <section className={styles.hero} aria-labelledby="home-title">
            <p className={styles.overline}>Bowling tournament management</p>
            <h1 id="home-title" className={styles.title}>Run the tournament, not the spreadsheets</h1>
            <p className={styles.lead}>
              BracketWorks gives tournament directors one organized workspace for entries, brackets, side pots, scores,
              standings, payouts, and live results.
            </p>
            <div className={styles.actions}>
              <Link href="/signup" className={buttonClassName({ variant: 'primary' })}>Create a free account</Link>
              <Link href="/view" className={buttonClassName({ variant: 'secondary' })}>View a live tournament</Link>
            </div>
            <p className={styles.meta}>No credit card required · Built for tablet and desktop · Live View works on phones</p>
          </section>

          <section id="dashboard-preview" className={styles.section} aria-labelledby="dashboard-title">
            <div className={styles.sectionHeading}>
              <p className={styles.overline}>Tournament dashboard</p>
              <h2 id="dashboard-title" className={styles.sectionTitle}>See the whole tournament at a glance</h2>
              <p className={styles.body}>Follow the Famous Frames Invitational as entries move through brackets, scoring, and payout review from one dashboard.</p>
            </div>
            <DemoDashboard embedded />
          </section>

          <section id="workflow" className={styles.section} aria-labelledby="workflow-title">
            <div className={styles.sectionHeading}>
              <p className={styles.overline}>One connected workflow</p>
              <h2 id="workflow-title" className={styles.sectionTitle}>Keep the tournament moving without redoing work</h2>
              <p className={styles.body}>Tournament details, bowlers, brackets, scores, results, and payouts stay connected from the first squad setup to the final public update.</p>
            </div>
            <LandingWorkflow />
          </section>

          <section id="live-view" className={`${styles.section} ${styles.split}`} aria-labelledby="live-title">
            <div className={styles.sectionHeading}>
              <p className={styles.overline}>Public Live View</p>
              <h2 id="live-title" className={styles.sectionTitle}>Give bowlers their results without admin access</h2>
              <p className={styles.body}>Share one public page for the tournament and squad. It works on phones and needs no BracketWorks account.</p>
              <dl className={styles.points}>
                <div><dt>Find a bowler quickly</dt><dd>Search the squad instead of scanning a posted sheet.</dd></div>
                <div><dt>Follow the competition</dt><dd>Standings, brackets, and side pots on one page.</dd></div>
                <div><dt>See updated results</dt><dd>Automatic and manual refresh keep results current during play.</dd></div>
              </dl>
              <div className={styles.actions}>
                <Link href="/view" className={buttonClassName({ variant: 'secondary' })}>Browse public tournaments</Link>
              </div>
            </div>
            <DemoLiveView />
          </section>

          <section id="controls" className={styles.section} aria-labelledby="controls-title">
            <div className={styles.sectionHeading}>
              <p className={styles.overline}>Built-in safeguards</p>
              <h2 id="controls-title" className={styles.sectionTitle}>See what needs attention before you continue</h2>
              <p className={styles.body}>Warnings and review steps sit beside the work they affect, so incomplete information is harder to miss.</p>
            </div>
            <StatGroup
              label="Example tournament review"
              items={[
                { label: 'Entry issues', value: '0' },
                { label: 'Scores complete', value: '21 of 32' },
                { label: 'Payout status', value: 'Pending' },
              ]}
            />
            <Card padding="flush">
              <ul className={styles.rows}>
                {SAFEGUARDS.map(item => (
                  <li key={item.title} className={styles.row}>
                    <p className={styles.overlineMuted}>{item.stage}</p>
                    <h3 className={styles.rowTitle}>{item.title}</h3>
                    <p className={styles.body}>{item.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <Card className={styles.cta}>
            <div className={styles.ctaText}>
              <h2 className={styles.sectionTitle}>Ready for your next tournament?</h2>
              <p className={styles.body}>Create a free account to run a tournament, or browse published Live View pages as a bowler.</p>
            </div>
            <div className={styles.actions}>
              <Link href="/view" className={buttonClassName({ variant: 'secondary' })}>Browse live results</Link>
              <Link href="/signup" className={buttonClassName({ variant: 'primary' })}>Create a free account</Link>
            </div>
          </Card>
        </Page>
      </main>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} BracketWorks</span>
        <Link href="/view">Live View</Link>
        <Link href="/login">Log in</Link>
        <Link href="/terms">Terms of service</Link>
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/acceptable-use">Acceptable use</Link>
      </footer>
    </div>
  );
}
