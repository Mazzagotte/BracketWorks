import {
  Users,
  Settings,
  GitBranch,
  PenTool,
  BarChart3,
  DollarSign,
} from 'lucide-react';
import styles from './landing.module.css';

const features = [
  {
    icon: Users,
    title: 'Organize Entries',
    description: 'Manage bowler information, averages, divisions, squads, entries, payments, and notes.',
  },
  {
    icon: Settings,
    title: 'Flexible Setup',
    description: 'Configure rules, divisions, squads, bracket sizes, handicap formulas, payouts, and side pots for any event.',
  },
  {
    icon: GitBranch,
    title: 'Brackets & Side Pots',
    description: 'Generate brackets, track advancement, and manage scratch, handicap, and custom side pots.',
  },
  {
    icon: PenTool,
    title: 'Enter Scores',
    description: 'Enter scores by game, verify results, correct mistakes, and keep every calculation up to date.',
  },
  {
    icon: BarChart3,
    title: 'Standings',
    description: 'Calculate live standings by division, squad, event type, scratch, or handicap.',
  },
  {
    icon: DollarSign,
    title: 'Payouts & Reports',
    description: 'Calculate payouts, track payment status, and export clean tournament reports.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionEyebrow}>One Organized Tournament Workspace</span>
        <h2 className={styles.sectionTitle}>Everything you need to run a successful tournament</h2>
        <p className={styles.sectionSubtitle}>
          From the first entry through the final payout, BracketWorks keeps every part of your tournament connected.
        </p>
      </div>

      <div className={styles.featureGrid}>
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className={styles.featureCard}>
              <Icon className={styles.featureIcon} aria-hidden="true" />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
