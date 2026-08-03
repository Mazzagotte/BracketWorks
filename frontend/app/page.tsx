import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, Brackets, Check, CheckCircle2,
  Eye, FileSpreadsheet, Gauge, Menu, ShieldCheck,
} from 'lucide-react';
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

function Brand() {
  return <span className={styles.brand}><Image src="/logo_no_text.svg" alt="BracketWorks" width={38} height={38} priority /><span><strong>BRACKET<span>WORKS</span></strong><small>Bowling Tournament Management</small></span></span>;
}

export default function HomePage() {
  return <div className={styles.page}>
    <a className={styles.skipLink} href="#main-content">Skip to main content</a>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }} />
    <header className={styles.header}>
      <div className={styles.headerInner}><Link href="/" aria-label="BracketWorks home"><Brand /></Link><nav aria-label="Homepage navigation"><a href="#dashboard-preview">Dashboard</a><a href="#workflow">Workflow</a><a href="#live-view">Live View</a><a href="#controls">Safeguards</a></nav><div className={styles.headerActions}><Link className={styles.secondaryButton} href="/login">Sign In</Link><Link className={styles.primaryButton} href="/signup">Create Account</Link></div><details className={styles.mobileMenu}><summary aria-label="Open navigation"><Menu /></summary><div><a href="#dashboard-preview">Dashboard</a><a href="#workflow">Workflow</a><a href="#live-view">Live View</a><a href="#controls">Safeguards</a><Link href="/login">Sign In</Link><Link href="/signup">Create Account</Link></div></details></div>
    </header>
    <main id="main-content">
      <section className={`${styles.section} ${styles.hero}`}><div className={styles.heroCopy}><p className={styles.eyebrow}>Bowling Tournament Management</p><h1>Run the Tournament.<br /><span>Not the Spreadsheets.</span></h1><p className={styles.lead}>BracketWorks gives tournament directors one organized workspace for entries, brackets, side pots, scores, standings, payouts, and live tournament results.</p><div className={styles.actions}><Link className={styles.primaryButton} href="/signup">Create Free Account <ArrowRight /></Link><Link className={styles.secondaryButton} href="/view"><Eye /> View Live Tournament</Link></div><ul className={styles.support}><li><Check />No credit card required</li><li><Gauge />Designed for tablet and desktop tournament management</li><li><Eye />Public Live View works on mobile devices</li></ul></div></section>
      <section id="dashboard-preview" className={`${styles.section} ${styles.dashboardShowcase}`}><div className={styles.sectionHeading}><p className={styles.eyebrow}>Tournament command center</p><h2>See the whole tournament at a glance</h2><p>Follow The Famous Frames Invitational as entries move through brackets, scoring, and payout review from one organized dashboard.</p></div><div className={styles.demoCue}><span>Dashboard view</span><strong>Scroll to explore the full tournament overview</strong></div><DemoDashboard embedded /></section>

      <section id="workflow" className={`${styles.section} ${styles.workflowSection}`}><div className={styles.sectionHeading}><p className={styles.eyebrow}>One connected workflow</p><h2>Keep the tournament moving without rebuilding the work</h2><p>Tournament details, bowlers, brackets, scores, results, and payouts stay connected from the first squad setup through the final public update.</p></div><LandingWorkflow /></section>

      <section id="live-view" className={`${styles.section} ${styles.liveDemoSection}`}><div className={styles.liveDemoCopy}><p className={styles.eyebrow}>Public Live View</p><h2>Give bowlers the results they want—without admin access</h2><p>Share one public page for the selected tournament and squad. It works on phones and does not require a BracketWorks account.</p><ul><li><CheckCircle2/><span><strong>Find a bowler quickly</strong><small>Search the current squad instead of scanning a posted sheet.</small></span></li><li><CheckCircle2/><span><strong>Follow the competition</strong><small>Open bracket summaries, matchups, and side-pot results from the same page.</small></span></li><li><CheckCircle2/><span><strong>See updated results</strong><small>Auto-refresh and manual refresh controls keep published information current during play.</small></span></li></ul><Link className={styles.primaryButton} href="/view">Browse Public Tournaments <ArrowRight/></Link></div><div className={styles.livePhoneColumn}><div className={styles.demoCue}><span>Live View</span><strong>Try Summary, Brackets, and Side Pots</strong></div><DemoLiveView/></div></section>

      <section id="controls" className={`${styles.section} ${styles.reviewSection}`}><div className={styles.reviewHeading}><p className={styles.eyebrow}>Built-in safeguards</p><h2>See what needs attention before you continue</h2><p>BracketWorks keeps warnings and review steps beside the work they affect, so incomplete information is harder to overlook.</p><div className={styles.reviewSummary}><span><small>ENTRY ISSUES</small><strong>0</strong></span><span><small>SCORES COMPLETE</small><strong>21 / 32</strong></span><span><small>PAYOUT STATUS</small><strong>Pending</strong></span></div></div><div className={styles.reviewList}><article><span data-tone="success"><ShieldCheck/></span><div><small>BEFORE BRACKETS</small><strong>Confirm the field is ready</strong><p>Review missing averages, unpaid balances, and duplicate bowlers before generating matchups.</p></div></article><article><span data-tone="warning"><Brackets/></span><div><small>AFTER ENTRY CHANGES</small><strong>Know when brackets are outdated</strong><p>BracketWorks warns when roster changes can affect brackets that have already been generated.</p></div></article><article><span data-tone="warning"><AlertTriangle/></span><div><small>BEFORE PAYOUTS</small><strong>Finish and verify scoring</strong><p>Incomplete scores remain visible, while verified scores can be locked before final calculations.</p></div></article><article><span data-tone="success"><FileSpreadsheet/></span><div><small>FINAL REVIEW</small><strong>Check every payout before export</strong><p>Review prize pools, winners, amounts, and paid status before tournament closeout.</p></div></article></div></section>

      <section className={`${styles.section} ${styles.tournamentDayBand}`} aria-label="BracketWorks device support"><span><Gauge/><strong>Tournament management</strong><small>Designed for tablet and desktop</small></span><span><Eye/><strong>Public Live View</strong><small>Fully supported on mobile</small></span><span><Check/><strong>Public results</strong><small>No bowler account required</small></span></section>
      <section className={`${styles.section} ${styles.finalCta}`}><div><p className={styles.eyebrow}>Ready for your next tournament?</p><h2>Put the spreadsheets away before the first ball rolls.</h2><p>Create a free account to manage a tournament, or browse published Live View pages as a bowler.</p></div><div className={styles.actions}><Link className={styles.primaryButton} href="/signup">Create Free Account <ArrowRight/></Link><Link className={styles.secondaryButton} href="/view"><Eye/> Browse Live Results</Link></div></section>
    </main>
    <footer className={styles.footer}><div><Brand/><p>One organized workspace for bowling tournament entries, brackets, scores, results, payouts, and public Live View.</p></div><nav aria-label="Footer product links"><strong>Product</strong><a href="#dashboard-preview">Dashboard</a><a href="#workflow">Workflow</a><Link href="/view">Public Live View</Link></nav><nav aria-label="Footer account links"><strong>Account</strong><Link href="/login">Sign In</Link><Link href="/signup">Create Account</Link></nav><nav aria-label="Footer legal links"><strong>Legal</strong><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link><Link href="/acceptable-use">Acceptable Use</Link></nav><div className={styles.copyright}>© {new Date().getFullYear()} BracketWorks. All rights reserved.</div></footer>
  </div>;
}
