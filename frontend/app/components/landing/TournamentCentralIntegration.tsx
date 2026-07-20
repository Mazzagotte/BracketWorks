import styles from './landing.module.css';

export function TournamentCentralIntegration() {
  return (
    <section id="tournament-central" className={styles.ecosystemSection}>
      <div className={styles.ecosystemContent}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionEyebrow}>Built to Work Together</span>
          <h2 className={styles.sectionTitle}>Part of the Tournament Central by BracketWorks ecosystem</h2>
        </div>

        <div className={styles.ecosystemCards}>
          <div className={styles.productCard}>
            <h3 className={styles.productName}>Tournament Central</h3>
            <p className={styles.productTagline}>Find. Register. Bowl.</p>
            <ul className={styles.productFeatures}>
              <li className={styles.productFeature}>Tournament discovery</li>
              <li className={styles.productFeature}>Public event information</li>
              <li className={styles.productFeature}>Online registration</li>
              <li className={styles.productFeature}>Squad reservations</li>
              <li className={styles.productFeature}>Entry selections</li>
              <li className={styles.productFeature}>Registration documents</li>
            </ul>
          </div>

          <div className={styles.ecosystemConnector} aria-hidden="true">
            ↓
          </div>

          <div className={styles.productCard}>
            <h3 className={styles.productName}>BracketWorks</h3>
            <p className={styles.productTagline}>Run the Tournament</p>
            <ul className={styles.productFeatures}>
              <li className={styles.productFeature}>Entries and divisions</li>
              <li className={styles.productFeature}>Brackets and side pots</li>
              <li className={styles.productFeature}>Scores and standings</li>
              <li className={styles.productFeature}>Payouts and reporting</li>
              <li className={styles.productFeature}>Live tournament results</li>
            </ul>
          </div>
        </div>

        <div className={styles.ecosystemDescription}>
          <p>
            Bowlers discover and register through Tournament Central. Registration data flows directly into BracketWorks so tournament directors can organize entries and run the event without re-entering bowler information.
          </p>
          <p className={styles.productTaglineText}>
            Discover → Register → Compete → Follow Results
          </p>
          <ul className={styles.ecosystemBenefits}>
            <li className={styles.ecosystemBenefit}>No re-entry of bowler data</li>
            <li className={styles.ecosystemBenefit}>More accurate, up-to-date entries</li>
            <li className={styles.ecosystemBenefit}>Faster tournament setup</li>
            <li className={styles.ecosystemBenefit}>One connected tournament experience</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
