import { ClipboardList, Users, Pencil, Trophy } from 'lucide-react';
import styles from './landing.module.css';

const workflow = [
  {
    number: '01',
    icon: ClipboardList,
    title: 'Organize',
    description: 'Set up the tournament, configure rules, squads, entry fees, payments, side pots, and payout settings.',
  },
  {
    number: '02',
    icon: Users,
    title: 'Generate',
    description: 'Add bowlers, assign squads and lanes, and generate organized brackets automatically.',
  },
  {
    number: '03',
    icon: Pencil,
    title: 'Score',
    description: 'Enter scores as games finish, advance winners, update standings, and track side pots in real time.',
  },
  {
    number: '04',
    icon: Trophy,
    title: 'Pay',
    description: 'Confirm winners, calculate payouts, export reports, and publish final results.',
  },
];

export function WorkflowSection() {
  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionEyebrow}>How It Works</span>
        <h2 className={styles.sectionTitle}>Run your tournament in four simple steps</h2>
        <p className={styles.sectionSubtitle}>
          Every event follows the same organized workflow, so your staff always knows what comes next.
        </p>
      </div>

      <div className={styles.workflowGrid}>
        {workflow.map((item, index) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={styles.workflowCard}>
              <div className={styles.workflowNumber}>{item.number}</div>
              <Icon className={styles.workflowIcon} aria-hidden="true" />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {index < workflow.length - 1 && (
                <div className={styles.workflowArrow} aria-hidden="true">→</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
