import Link from 'next/link';
import styles from './landing.module.css';

export function LiveViewSection() {
  return (
    <section id="live-view" className={styles.liveViewSection}>
      <div className={styles.liveViewInner}>
        <div className={styles.liveViewPreview}>
          <div className={styles.liveViewDevice}>
            <div className={styles.laptopPreview}>
              <div className={styles.mockupHeader}>
                <div className={styles.mockupLabel}>Live View</div>
                <div className={styles.mockupSubLabel}>Standings • Brackets • Results</div>
              </div>
              <div className={styles.mockupContent}>
                <div className={styles.mockupItem}><strong className={styles.mockupHighlight}>1. Bowler A</strong> - 573</div>
                <div className={styles.mockupItem}><strong className={styles.mockupHighlight}>2. Bowler B</strong> - 568</div>
                <div className={styles.mockupItem}><strong className={styles.mockupHighlight}>3. Bowler C</strong> - 542</div>
                <div>... live updates every game</div>
              </div>
            </div>
          </div>
          <div className={styles.liveViewDevice}>
            <div className={styles.phonePreview}>
              <div className={styles.mockupSectionTitle}>Current Round</div>
              <div className={styles.mockupSmallContent}>
                <div className={styles.mockupSmallItem}><strong>Bowler A</strong></div>
                <div className={styles.mockupVsDivider}>vs</div>
                <div className={styles.mockupSmallItem}><strong>Bowler B</strong></div>
                <div className={styles.mockupMatchResult}>
                  → Champion
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.liveViewContent}>
          <span className={styles.eyebrow}>Live Tournament Board</span>
          <h2 className={styles.sectionTitle}>Give bowlers a live view of the tournament</h2>
          <p className={styles.sectionSubtitle}>
            Share one public link where bowlers, families, and spectators can follow the action in real time—no account required.
          </p>

          <ul className={styles.liveViewList}>
            <li className={styles.liveViewItem}>Live scores and standings</li>
            <li className={styles.liveViewItem}>Bracket progress and winners</li>
            <li className={styles.liveViewItem}>Side-pot results and payouts</li>
            <li className={styles.liveViewItem}>Search by bowler name</li>
            <li className={styles.liveViewItem}>Tournament announcements</li>
            <li className={styles.liveViewItem}>Automatic updates on any device</li>
          </ul>

          <Link href="/view" className={`${styles.button} ${styles.buttonSecondary} ${styles.demoButtonMargin}`}>
            See Live Demo
          </Link>
        </div>
      </div>
    </section>
  );
}
