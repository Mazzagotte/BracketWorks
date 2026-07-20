import { Database, ShieldCheck, Clock, TrendingUp } from 'lucide-react';
import styles from './landing.module.css';

const benefits = [
  {
    icon: Database,
    title: 'All-in-One System',
    description: 'Entries, brackets, scores, side pots, standings, and payouts stay connected in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Fewer Mistakes',
    description: 'Built-in validation and warnings help prevent score, entry, bracket, and payout errors before results are final.',
  },
  {
    icon: Clock,
    title: 'Save Time',
    description: 'Automatic calculations, advancement, and reporting reduce repetitive administrative work.',
  },
  {
    icon: TrendingUp,
    title: 'Built for Any Size',
    description: 'Use the same workflow for weekly brackets, association tournaments, sweepers, and larger multi-squad events.',
  },
];

export function BenefitsSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Why Tournament Directors Choose BracketWorks</h2>
        <p className={styles.sectionSubtitle}>
          Spend less time managing spreadsheets and more time running a smooth tournament.
        </p>
      </div>

      <div className={styles.benefitsGrid}>
        {benefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <article key={benefit.title} className={styles.benefitCard}>
              <Icon className={styles.benefitIcon} aria-hidden="true" />
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
