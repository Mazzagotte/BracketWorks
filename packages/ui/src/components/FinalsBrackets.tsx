import { BracketChampion, BracketMatch, BracketTree } from './Bracket';
import type { BracketChampionData, BracketMatchData, BracketRoundData } from './Bracket';
import { DataTable } from './Table';
import { cx } from './cx';
import styles from './FinalsBrackets.module.css';

/* Finals shapes per docs/ui-standards.md sections 7 and 7a: a stepladder drawn as a ladder, match play
   with two halves meeting at the final, and a round robin head-to-head grid. Boxes are BracketMatch. */

/* ---------- Stepladder ---------- */

export interface BracketLadderProps {
  /**
   * Ordered bottom-up: Match 1 (the lowest seeds) first, the title match against the top seed last.
   * In each match the first player is the climber (the previous match's winner) and the second the seed waiting.
   */
  matches: BracketMatchData[];
  /** The title match winner; null while it is undecided. */
  champion?: BracketChampionData | null;
  /** The match being bowled now: panel background and "Now bowling". */
  highlightMatchId?: string | null;
  /** Accessible name, for example "Singles stepladder". */
  label?: string;
  className?: string;
}

/** "Seed 3 waits" (or the name when there is no seed) for a rung whose climber is still to be decided. */
export function ladderWaitingNote(match: BracketMatchData): string | null {
  if (match.note || match.players.some((player) => player.winner)) return null;
  const named = match.players.filter((player) => player.name?.trim());
  if (named.length !== 1) return null;
  const waiting = named[0];
  if (!waiting) return null;
  return `${typeof waiting.seed === 'number' ? `Seed ${waiting.seed}` : waiting.name?.trim()} waits`;
}

/**
 * A stepladder: Match 1 on the bottom rung, each rung up is the next match against a higher seed,
 * and the champion sits above the title match. On wider screens the rungs step to the right like
 * stairs; on phones they stack. 1px connectors show the climber's path from rung to rung.
 */
export function BracketLadder({ matches, champion, highlightMatchId, label = 'Stepladder', className }: BracketLadderProps) {
  return (
    <div className={cx(styles.ladder, className)} role="region" aria-label={label}>
      {matches.map((match, index) => {
        const previous = index > 0 ? matches[index - 1] : undefined;
        // The first slot is the climber: until the rung below is decided, it is that match's winner.
        const [climber, waiting] = match.players;
        const players: BracketMatchData['players'] = climber.name?.trim() || climber.placeholder || !previous
          ? match.players
          : [{ ...climber, placeholder: `Winner of ${previous.label}` }, waiting];
        const current = Boolean(highlightMatchId) && match.id === highlightMatchId;
        return (
          <div key={match.id ?? `${match.label}-${index}`} className={styles.rung}>
            <BracketMatch {...match} players={players} note={match.note ?? ladderWaitingNote(match)} current={current} />
          </div>
        );
      })}
      <div className={styles.ladderChampion} role="group" aria-label="Champion">
        <h3 className={styles.title}>Champion</h3>
        <BracketChampion champion={champion} pendingText="Decided after the title match" />
      </div>
    </div>
  );
}

/* ---------- Match play, two halves ---------- */

export interface BracketTwoSidedProps {
  /** Rounds in order (first round to final), as for BracketTree. */
  rounds: BracketRoundData[];
  champion?: BracketChampionData | null;
  /** `two-sided` on desktop; `stacked` on phones (falls back to the stacked BracketTree). */
  layout?: 'two-sided' | 'stacked';
  onPlayerClick?: (name: string) => void;
  label?: string;
  className?: string;
}

/** Fewer than 8 finalists (under four first-round matches) read better as a plain tree. */
export const TWO_SIDED_MIN_FIRST_ROUND_MATCHES = 4;

function pairs<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += 2) result.push(items.slice(index, index + 2));
  return result;
}

function HalfRound({ round, first, side, onPlayerClick }: { round: BracketRoundData; first: boolean; side: 'left' | 'right'; onPlayerClick?: (name: string) => void }) {
  return (
    <section className={styles.round} aria-label={`${round.title}, ${side} half`}>
      <h3 className={styles.title}>{round.title}</h3>
      <div className={styles.roundBody}>
        {pairs(round.matches).map((pair, pairIndex) => (
          <div key={pairIndex} className={cx(styles.pair, pair.length === 2 && styles.pairJoined)}>
            {pair.map((match, index) => (
              <div key={match.id ?? `${round.title}-${side}-${pairIndex}-${index}`} className={cx(styles.slot, !first && styles.slotIncoming)}>
                <BracketMatch {...match} onPlayerClick={onPlayerClick} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Match play for 8 or more finalists: the top half of the draw on the left, the bottom half on the
 * right (mirrored), both converging on the final in the center, with the champion above it.
 * Smaller fields and phones get the BracketTree instead.
 */
export function BracketTwoSided({ rounds, champion, layout = 'two-sided', onPlayerClick, label = 'Bracket', className }: BracketTwoSidedProps) {
  const firstRound = rounds[0];
  const finalRound = rounds[rounds.length - 1];
  if (layout === 'stacked' || rounds.length < 2 || !firstRound || !finalRound || firstRound.matches.length < TWO_SIDED_MIN_FIRST_ROUND_MATCHES) {
    return (
      <BracketTree
        rounds={rounds}
        champion={champion}
        layout={layout === 'stacked' ? 'stacked' : 'tree'}
        onPlayerClick={onPlayerClick}
        label={label}
        className={className}
      />
    );
  }
  const earlier = rounds.slice(0, -1);
  const half = (round: BracketRoundData, side: 'left' | 'right'): BracketRoundData => {
    const middle = Math.ceil(round.matches.length / 2);
    return { title: round.title, matches: side === 'left' ? round.matches.slice(0, middle) : round.matches.slice(middle) };
  };

  return (
    <div className={cx(styles.twoSidedScroll, className)} role="region" aria-label={label}>
      <div className={styles.twoSidedChampion} role="group" aria-label="Champion">
        <h3 className={styles.title}>Champion</h3>
        <BracketChampion champion={champion} />
      </div>
      <div className={styles.twoSided}>
        <div className={styles.half}>
          {earlier.map((round, index) => <HalfRound key={round.title} round={half(round, 'left')} first={index === 0} side="left" onPlayerClick={onPlayerClick} />)}
        </div>
        <section className={cx(styles.round, styles.centerRound)} aria-label={finalRound.title}>
          <h3 className={styles.title}>{finalRound.title}</h3>
          <div className={styles.roundBody}>
            {finalRound.matches.map((match, index) => (
              <div key={match.id ?? `${finalRound.title}-${index}`} className={styles.slot}>
                <BracketMatch {...match} onPlayerClick={onPlayerClick} />
              </div>
            ))}
          </div>
        </section>
        <div className={cx(styles.half, styles.halfRight)}>
          {earlier.map((round, index) => <HalfRound key={round.title} round={half(round, 'right')} first={index === 0} side="right" onPlayerClick={onPlayerClick} />)}
        </div>
      </div>
    </div>
  );
}

/* ---------- Round robin ---------- */

export interface RoundRobinPlayer {
  /** Stable key, used by the games. */
  key: string;
  name: string;
  seed?: number | null;
}

export interface RoundRobinGame {
  id?: string;
  a: { key: string; score: number | null };
  b: { key: string; score: number | null };
}

export interface RoundRobinGridProps {
  /** Finalists in seed order: one row and one column each. */
  players: RoundRobinPlayer[];
  games: RoundRobinGame[];
  /** Accessible table caption, for example "Doubles head to head". */
  label?: string;
  className?: string;
}

const EMPTY = '—';

type Cell = { score: number | null; result: 'W' | 'L' | 'T' | null };

function cellFor(games: Map<string, RoundRobinGame>, rowKey: string, columnKey: string): Cell | null {
  const game = games.get(`${rowKey}|${columnKey}`) ?? games.get(`${columnKey}|${rowKey}`);
  if (!game) return null;
  const mine = game.a.key === rowKey ? game.a : game.b;
  const theirs = game.a.key === rowKey ? game.b : game.a;
  if (mine.score === null) return { score: null, result: null };
  if (theirs.score === null) return { score: mine.score, result: null };
  const result = mine.score > theirs.score ? 'W' : mine.score < theirs.score ? 'L' : 'T';
  return { score: mine.score, result };
}

const RESULT_TEXT = { W: 'win', L: 'loss', T: 'tie' } as const;

/**
 * Head-to-head matrix: each cell is the row bowler's score against the column bowler with W, L, or T.
 * Wins are bold, losses secondary; no cell is colored. The diagonal is empty.
 */
export function RoundRobinGrid({ players, games, label = 'Head to head', className }: RoundRobinGridProps) {
  const byPair = new Map<string, RoundRobinGame>();
  for (const game of games) byPair.set(`${game.a.key}|${game.b.key}`, game);
  const seedText = (player: RoundRobinPlayer, index: number) => String(player.seed ?? index + 1);

  return (
    <DataTable caption={label} className={cx(styles.grid, className)}>
      <thead>
        <tr>
          <th scope="col">Bowler</th>
          {players.map((player, index) => (
            <th key={player.key} scope="col" data-align="right" aria-label={player.name} title={player.name}>
              {seedText(player, index)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((row, rowIndex) => (
          <tr key={row.key}>
            <th scope="row" className={styles.rowHeader}>
              <span className={styles.rowSeed}><span className="sr-only">Seed </span>{seedText(row, rowIndex)}</span>
              <span>{row.name}</span>
            </th>
            {players.map((column) => {
              if (column.key === row.key) return <td key={column.key} className={styles.self} />;
              const cell = cellFor(byPair, row.key, column.key);
              if (!cell || cell.score === null) {
                return <td key={column.key} data-align="right" data-tone="secondary">{EMPTY}</td>;
              }
              return (
                <td
                  key={column.key}
                  data-align="right"
                  data-tone={cell.result === 'L' ? 'secondary' : undefined}
                  data-emphasis={cell.result === 'W' ? 'true' : undefined}
                  title={`${row.name} vs ${column.name}: ${cell.score}${cell.result ? `, ${RESULT_TEXT[cell.result]}` : ''}`}
                >
                  <span className={styles.score}>{cell.score}</span>
                  <span className={styles.result}>{cell.result ? ` ${cell.result}` : ''}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
