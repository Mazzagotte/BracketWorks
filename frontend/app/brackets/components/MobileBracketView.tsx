import React, { useState, useRef } from 'react';
import styles from '../styles/mobile-bracket-view.module.css';
import { TournamentRound, Match } from './BracketTreeView';

export interface MobileBracketViewProps {
  rounds: TournamentRound[];
  currentRound: number;
  onRoundChange: (roundIndex: number) => void;
}

export function MobileBracketView({
  rounds,
  currentRound,
  onRoundChange,
}: MobileBracketViewProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentRound < rounds.length - 1) {
      onRoundChange(currentRound + 1);
    }

    if (isRightSwipe && currentRound > 0) {
      onRoundChange(currentRound - 1);
    }
  };

  const getMatchStatus = (match: Match): string => {
    if (match.winner) return 'completed';
    if (match.scoreA !== undefined || match.scoreB !== undefined) return 'in_progress';
    const prevRoundComplete = currentRound === 0 || rounds[currentRound - 1]?.matches.every((m: Match) => m.winner);
    if (prevRoundComplete) return 'next_up';
    return 'pending';
  };

  return (
    <div 
      className={styles.container}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      ref={containerRef}
    >
      {/* Round Indicator */}
      <div className={styles.roundIndicator}>
        <span className={styles.roundNumber}>Round {currentRound + 1}</span>
        <span className={styles.roundName}>{rounds[currentRound]?.name}</span>
      </div>

      {/* Swipe Hints */}
      <div className={styles.swipeHints}>
        {currentRound > 0 && (
          <button 
            className={`${styles.swipeHint} ${styles.left}`}
            onClick={() => onRoundChange(currentRound - 1)}
            aria-label="Previous round"
          >
            ◀
          </button>
        )}
        {currentRound < rounds.length - 1 && (
          <button 
            className={`${styles.swipeHint} ${styles.right}`}
            onClick={() => onRoundChange(currentRound + 1)}
            aria-label="Next round"
          >
            ▶
          </button>
        )}
      </div>

      {/* Round Content */}
      <div className={styles.roundContent}>
        {rounds[currentRound]?.matches.map((match, index) => {
          const status = getMatchStatus(match);
          
          return (
            <div
              key={index}
              className={`${styles.matchCard} ${styles[status]}`}
            >
              <div className={styles.matchHeader}>
                <span className={styles.matchNumber}>Match {index + 1}</span>
                <span className={`${styles.statusBadge} ${styles[status]}`}>
                  {status === 'completed' && '✓'}
                  {status === 'in_progress' && '⚡'}
                  {status === 'next_up' && '▶'}
                  {status === 'pending' && '○'}
                </span>
              </div>

              <div className={styles.players}>
                <div className={`${styles.player} ${match.winner === 'A' ? styles.winner : ''}`}>
                  <div className={styles.playerInfo}>
                    <span className={styles.seed}>{match.seedA}</span>
                    <span className={styles.playerName}>{match.playerA || 'TBD'}</span>
                  </div>
                  {match.scoreA !== undefined && match.scoreA !== null && (
                    <span className={styles.score}>{match.scoreA}</span>
                  )}
                </div>

                <div className={styles.vs}>vs</div>

                <div className={`${styles.player} ${match.winner === 'B' ? styles.winner : ''}`}>
                  <div className={styles.playerInfo}>
                    <span className={styles.seed}>{match.seedB}</span>
                    <span className={styles.playerName}>{match.playerB || 'TBD'}</span>
                  </div>
                  {match.scoreB !== undefined && match.scoreB !== null && (
                    <span className={styles.score}>{match.scoreB}</span>
                  )}
                </div>
              </div>

              {/* Footer removed since Match doesn't have scheduledTime or lane */}
            </div>
          );
        })}
      </div>

      {/* Progress Dots */}
      <div className={styles.progressDots}>
        {rounds.map((_, index) => (
          <button
            key={index}
            className={`${styles.dot} ${index === currentRound ? styles.active : ''}`}
            onClick={() => onRoundChange(index)}
            aria-label={`Go to round ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
