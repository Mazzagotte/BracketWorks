import React from 'react';
import styles from '../styles/empty-bracket-state.module.css';

export interface EmptyBracketStateProps {
  onGenerateClick: () => void;
  showDemo?: boolean;
  message?: string;
}

export function EmptyBracketState({
  onGenerateClick,
  showDemo = true,
  message = "No brackets generated yet",
}: EmptyBracketStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.accentGlow} aria-hidden="true" />

        <div className={styles.badge}>Tournament Ready</div>

        <div className={styles.heroRow}>
          <div className={styles.iconContainer}>
            <div className={styles.bracketIcon}>
              <svg viewBox="0 0 100 100" className={styles.svg}>
                <line x1="20" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="3" />
                <line x1="20" y1="40" x2="40" y2="40" stroke="currentColor" strokeWidth="3" />
                <line x1="40" y1="20" x2="40" y2="40" stroke="currentColor" strokeWidth="3" />
                <line x1="40" y1="30" x2="60" y2="30" stroke="currentColor" strokeWidth="3" />
                <line x1="20" y1="60" x2="40" y2="60" stroke="currentColor" strokeWidth="3" />
                <line x1="20" y1="80" x2="40" y2="80" stroke="currentColor" strokeWidth="3" />
                <line x1="40" y1="60" x2="40" y2="80" stroke="currentColor" strokeWidth="3" />
                <line x1="40" y1="70" x2="60" y2="70" stroke="currentColor" strokeWidth="3" />
                <line x1="60" y1="30" x2="60" y2="70" stroke="currentColor" strokeWidth="3" />
                <line x1="60" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="3" />
              </svg>
            </div>
          </div>

          <div>
            <h2 className={styles.title}>{message}</h2>
            <p className={styles.description}>
              Your tournament is loaded. Generate brackets to seed matchups, start scoring, and track winners in real time.
            </p>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button onClick={onGenerateClick} className={`${styles.ctaButton} ds-btn ds-btn-primary ds-btn-md`}>
            <span className={styles.buttonIcon}>+</span>
            <span>Generate Brackets</span>
          </button>
          <a className={`${styles.secondaryAction} ds-btn ds-btn-secondary ds-btn-md`} href="/dashboard">Back to Dashboard</a>
        </div>

        {showDemo && (
          <>
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <h3>Smart Seeding</h3>
                <p>Create scratch and handicap brackets while maximizing full brackets and reducing repeat matchups.</p>
              </div>
              <div className={styles.featureCard}>
                <h3>Live Match Flow</h3>
                <p>Update winners round-by-round and keep bracket progression in sync.</p>
              </div>
              <div className={styles.featureCard}>
                <h3>Mobile Friendly</h3>
                <p>Manage brackets from lane-side screens without losing context.</p>
              </div>
            </div>

            <div className={styles.demoPreview}>
              <div className={styles.demoLabel}>Bracket Preview</div>
              <div className={styles.demoBracket}>
                <div className={styles.demoRound}>
                  <div className={styles.demoRoundLabel}>Round 1</div>
                  <div className={styles.demoMatch}>
                    <div className={styles.demoPlayer}>Player 1</div>
                    <div className={styles.demoPlayer}>Player 2</div>
                  </div>
                  <div className={styles.demoMatch}>
                    <div className={styles.demoPlayer}>Player 3</div>
                    <div className={styles.demoPlayer}>Player 4</div>
                  </div>
                </div>
                <div className={styles.demoRound}>
                  <div className={styles.demoRoundLabel}>Semi</div>
                  <div className={styles.demoMatch}>
                    <div className={styles.demoPlayer}>Winner 1</div>
                    <div className={styles.demoPlayer}>Winner 2</div>
                  </div>
                </div>
                <div className={styles.demoRound}>
                  <div className={styles.demoRoundLabel}>Final</div>
                  <div className={styles.demoMatch}>
                    <div className={styles.demoPlayer + ' ' + styles.champion}>Champion</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
