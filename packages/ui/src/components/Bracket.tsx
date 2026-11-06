import type { ReactNode } from 'react';

import { ICON_SIZE } from '../iconSize';
import { cx } from './cx';
import styles from './Bracket.module.css';

/* Brackets per docs/ui-standards.md section 7a: one match component for the organizer
   Brackets page and Live View, and a tree that lays matches out by round. */

export interface BracketPlayerData {
  /** Empty while the slot is not decided yet; shows "To be decided". */
  name?: string | null;
  score?: number | null;
  winner?: boolean;
  /** Row background for a searched or selected bowler. Never orange. */
  highlighted?: boolean;
}

export interface BracketMatchData {
  id?: string;
  /** "Match 1", "Semifinal 1", "Final". */
  label: string;
  players: [BracketPlayerData, BracketPlayerData];
  /** Replaces the winning margin, for example "Tie, both advance" or "Split pot". */
  note?: ReactNode;
  /** Fades a match that does not match the current search. */
  dimmed?: boolean;
}

export interface BracketMatchProps extends BracketMatchData {
  /** Makes each named player a button, for example to highlight that bowler's path. */
  onPlayerClick?: (name: string) => void;
  className?: string;
}

function CheckIcon() {
  return (
    <svg width={ICON_SIZE.sm} height={ICON_SIZE.sm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Winner" className={styles.winnerIcon}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.trophyIcon}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function hasScore(score: number | null | undefined): score is number {
  return typeof score === 'number' && Number.isFinite(score);
}

/** "+35" when one player won and both scores are known. */
export function bracketWinningMargin(players: [BracketPlayerData, BracketPlayerData]): string | null {
  const [a, b] = players;
  if (!hasScore(a.score) || !hasScore(b.score)) return null;
  if (a.winner && !b.winner) return `+${a.score - b.score}`;
  if (b.winner && !a.winner) return `+${b.score - a.score}`;
  return null;
}

/** One match box: header (name and margin), then a row per player. Winner is bold with a check. */
export function BracketMatch({ label, players, note, dimmed, onPlayerClick, className }: BracketMatchProps) {
  const decided = players.some((player) => player.winner);
  const aside = note ?? bracketWinningMargin(players);

  return (
    <div className={cx(styles.match, dimmed && styles.dimmed, className)} role="group" aria-label={label}>
      <div className={styles.matchHeader}>
        <span className={styles.matchLabel}>{label}</span>
        {aside ? <span className={styles.matchAside}>{aside}</span> : null}
      </div>
      {players.map((player, index) => {
        const name = player.name?.trim() || '';
        const rowClass = cx(
          styles.player,
          player.winner && styles.playerWinner,
          decided && !player.winner && styles.playerOther,
          !name && styles.playerPending,
          player.highlighted && styles.playerHighlighted,
        );
        const content = (
          <>
            <span className={styles.playerName}>
              <span className={styles.playerNameText}>{name || 'To be decided'}</span>
              {player.winner ? <CheckIcon /> : null}
            </span>
            <span className={styles.playerScore}>{hasScore(player.score) ? player.score : '-'}</span>
          </>
        );
        return onPlayerClick && name ? (
          <button
            key={index}
            type="button"
            className={cx(rowClass, styles.playerButton)}
            aria-pressed={player.highlighted ? true : false}
            onClick={() => onPlayerClick(name)}
          >
            {content}
          </button>
        ) : (
          <div key={index} className={rowClass}>{content}</div>
        );
      })}
    </div>
  );
}

export interface BracketRoundData {
  /** "Quarterfinals", "Semifinals", "Final". */
  title: string;
  matches: BracketMatchData[];
}

export interface BracketChampionData {
  name: string;
  /** For example "Won the final 214 to 191". */
  detail?: ReactNode;
  /** For example "Runner-up: Pat Lee". */
  runnerUp?: ReactNode;
}

export interface BracketTreeProps {
  rounds: BracketRoundData[];
  /** The final's winner; null while the final is undecided. */
  champion?: BracketChampionData | null;
  /** `tree` on desktop (rounds left to right); `stacked` on phones (champion, then Final first). */
  layout?: 'tree' | 'stacked';
  onPlayerClick?: (name: string) => void;
  /** Accessible name, for example "Handicap bracket 3". */
  label?: string;
  className?: string;
}

function Champion({ champion }: { champion?: BracketChampionData | null }) {
  if (!champion) {
    return <p className={styles.championPending}>Decided after the final</p>;
  }
  return (
    <div className={styles.champion}>
      <TrophyIcon />
      <p className={styles.championName}>{champion.name}</p>
      {champion.detail ? <p className={styles.championMeta}>{champion.detail}</p> : null}
      {champion.runnerUp ? <p className={styles.championMeta}>{champion.runnerUp}</p> : null}
    </div>
  );
}

function pairs<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += 2) result.push(items.slice(index, index + 2));
  return result;
}

/** Bracket rounds with 1px connector lines and a champion column, or a stacked phone layout. */
export function BracketTree({ rounds, champion, layout = 'tree', onPlayerClick, label = 'Bracket', className }: BracketTreeProps) {
  if (layout === 'stacked') {
    return (
      <div className={cx(styles.stacked, className)} aria-label={label} role="region">
        <section className={styles.stackedSection} aria-label="Champion">
          <h3 className={styles.roundTitle}>Champion</h3>
          <Champion champion={champion} />
        </section>
        {[...rounds].reverse().map((round) => (
          <section key={round.title} className={styles.stackedSection} aria-label={round.title}>
            <h3 className={styles.roundTitle}>{round.title}</h3>
            <div className={styles.stackedMatches}>
              {round.matches.map((match, index) => (
                <BracketMatch key={match.id ?? `${round.title}-${index}`} {...match} onPlayerClick={onPlayerClick} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={cx(styles.treeScroll, className)} aria-label={label} role="region">
      <div className={styles.tree}>
        {rounds.map((round, roundIndex) => {
          const isFirst = roundIndex === 0;
          return (
            <section key={round.title} className={styles.round} aria-label={round.title}>
              <h3 className={styles.roundTitle}>{round.title}</h3>
              <div className={styles.roundBody}>
                {pairs(round.matches).map((pair, pairIndex) => (
                  <div key={pairIndex} className={cx(styles.pair, pair.length === 2 && styles.pairJoined)}>
                    {pair.map((match, index) => (
                      <div key={match.id ?? `${round.title}-${pairIndex}-${index}`} className={cx(styles.slot, !isFirst && styles.slotIncoming)}>
                        <BracketMatch {...match} onPlayerClick={onPlayerClick} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <section className={cx(styles.round, styles.championRound)} aria-label="Champion">
          <h3 className={styles.roundTitle}>Champion</h3>
          <div className={styles.roundBody}>
            <div className={styles.pair}>
              <div className={cx(styles.slot, rounds.length > 0 && styles.slotIncoming)}>
                <Champion champion={champion} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
