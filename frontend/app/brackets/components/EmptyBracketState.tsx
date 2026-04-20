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
        {/* Empty State Icon */}
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

        {/* Message */}
        <h2 className={styles.title}>{message}</h2>
        <p className={styles.description}>
          Generate a tournament bracket to get started. You can create brackets for scratch or handicap scoring.
        </p>

        {/* CTA Button */}
        <button onClick={onGenerateClick} className={styles.ctaButton}>
          <span className={styles.buttonIcon}>+</span>
          <span>Generate Bracket</span>
        </button>

        {/* Features List */}
        {showDemo && (
          <div className={styles.features}>
            <h3 className={styles.featuresTitle}>What you'll get:</h3>
            <ul className={styles.featuresList}>
              <li className={styles.feature}>
                <span className={styles.featureIcon}>🏆</span>
                <span>Interactive tournament tree visualization</span>
              </li>
              <li className={styles.feature}>
                <span className={styles.featureIcon}></span>
                <span>Real-time score tracking and updates</span>
              </li>
              <li className={styles.feature}>
                <span className={styles.featureIcon}>🎯</span>
                <span>Automatic bracket progression</span>
              </li>
              <li className={styles.feature}>
                <span className={styles.featureIcon}>📱</span>
                <span>Mobile-friendly interface</span>
              </li>
              <li className={styles.feature}>
                <span className={styles.featureIcon}></span>
                <span>Player search and filtering</span>
              </li>
            </ul>
          </div>
        )}

        {/* Demo Preview */}
        {showDemo && (
          <div className={styles.demoPreview}>
            <div className={styles.demoLabel}>Preview:</div>
            <div className={styles.demoBracket}>
              <div className={styles.demoRound}>
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
                <div className={styles.demoMatch}>
                  <div className={styles.demoPlayer}>Winner 1</div>
                  <div className={styles.demoPlayer}>Winner 2</div>
                </div>
              </div>
              <div className={styles.demoRound}>
                <div className={styles.demoMatch}>
                  <div className={styles.demoPlayer + ' ' + styles.champion}>Champion</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
