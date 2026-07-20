import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import styles from './landing.module.css';

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Bowling Tournament Management Software</span>
          
          <h1 className={styles.heroTitle}>
            Run Bowling Brackets Without the <span className={styles.highlight}>Spreadsheet Chaos.</span>
          </h1>
          
          <p className={styles.heroSubtitle}>
            BracketWorks helps tournament directors organize entries, generate brackets, manage side pots, enter scores, calculate standings, and review payouts—all in one connected system.
          </p>
          
          <div className={styles.heroCTA}>
            <Link href="/signup" className={`${styles.button} ${styles.buttonPrimary}`}>
              Start Free
            </Link>
            <Link href="/view" className={`${styles.button} ${styles.buttonSecondary}`}>
              View Live Demo
            </Link>
          </div>
          
          <div className={styles.trustRow}>
            <span className={styles.trustItem}>No credit card required</span>
            <span className={styles.trustItem}>Set up in minutes</span>
            <span className={styles.trustItem}>Works on any device</span>
          </div>
        </div>

        <div className={styles.heroPreview}>
          <div className={styles.previewHeader}>
            <h2 className={styles.previewTitle}>Idaho Scratch Classic</h2>
            <div className={styles.liveBadge}>
              <span className={styles.liveDot}></span>
              LIVE
            </div>
          </div>

          <div className={styles.previewMeta}>
            <p className={styles.previewMetaTitle}>Squad: 11:00 AM • 32 Entries</p>
          </div>

          <button className={`${styles.button} ${styles.buttonSecondary} ${styles.fullWidthButton}`}>
            Live Tournament Board
          </button>

          <div className={styles.previewStats}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>16</span>
              <span className={styles.statLabel}>Active Brackets</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>42/64</span>
              <span className={styles.statLabel}>Scores Entered</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>8</span>
              <span className={styles.statLabel}>Side Pots</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>$2,480</span>
              <span className={styles.statLabel}>Payouts</span>
            </div>
          </div>

          <div className={styles.previewActivity}>
            <h4 className={styles.activityTitle}>Recent Activity</h4>
            <ul className={styles.activityList}>
              <li className={styles.activityItem}>Game 2 scores updated</li>
              <li className={styles.activityItem}>Bracket Round 2 advanced</li>
              <li className={styles.activityItem}>High Game side pot recalculated</li>
              <li className={styles.activityItem}>Payout export ready for review</li>
            </ul>
          </div>

          <div className={styles.previewBracket}>
            <div className={styles.bracketLabel}>Bracket Preview</div>
            <div className={styles.bracketGrid}>
              <div className={styles.bracketColumn}>
                <div className={styles.bracketEntry}>Bowler A</div>
                <div className={styles.bracketEntry}>Bowler B</div>
                <div className={styles.bracketEntry}>Bowler C</div>
                <div className={styles.bracketEntry}>Bowler D</div>
              </div>
              <div className={styles.bracketColumn}>
                <div className={`${styles.bracketEntry} ${styles.bracketWinner}`}>Winner 1</div>
              <div className={styles.bracketSpacer25}></div>
                <div className={`${styles.bracketEntry} ${styles.bracketWinner}`}>Winner 2</div>
              </div>
              <div className={styles.bracketColumn}>
                <div className={styles.bracketSpacer65}></div>
                <div className={`${styles.bracketEntry} ${styles.bracketWinner}`}>Champion</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
