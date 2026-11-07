'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ExternalLink, MoreHorizontal, Trophy } from 'lucide-react';
import {
  BracketTree,
  Button,
  ButtonLink,
  Card,
  CardDivider,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ICON_SIZE,
  Menu,
  MenuItem,
  Notice,
  Page,
  PageHeader,
  SegmentedControl,
  SelectField,
} from '@bracketworks/ui';
import type { BracketMatchData, BracketRoundData } from '@bracketworks/ui';

import type { FinalsMatch, LiveFinals, LiveStandings } from '@/components/live/liveStandingsTypes';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import {
  fetchFinals,
  fetchScoreGrid,
  fetchStandings,
  resetFinals,
  saveFinalsGames,
  saveScores,
  startFinals,
} from '@/components/organizer/scoresApi';
import type { FinalsGameChange, FinalsSlot, FinalsState, FinalsTarget, ScoreChange, ScoreGrid, ScoreGridRow } from '@/components/organizer/scoresApi';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import cells from '@/components/organizer/OrganizerTable.module.css';
import styles from './scores.module.css';

/** How long typing pauses before a score saves. */
const AUTOSAVE_DELAY_MS = 600;
const MAX_SCORE = 300;
const ALL_SQUADS = '';
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

type View = 'qualifying' | 'finals';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string };

/** '' is a cleared score, a number is a valid score, and undefined is invalid input. */
function parseScore(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}$/u.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value <= MAX_SCORE ? value : undefined;
}

function getToken(): string | null {
  return sessionStorage.getItem('access_token');
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

type Autosaver<T> = {
  queue: (key: string, item: T) => void;
  drop: (key: string) => void;
  flush: () => Promise<void>;
  dispose: () => void;
  setSave: (save: (items: T[]) => Promise<unknown>) => void;
};

/** Queues changes by key, saves them together after a pause in typing, and keeps failed ones for a retry. */
function createAutosaver<T>(onStatus: (status: SaveStatus) => void): Autosaver<T> {
  const pending = new Map<string, T>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let save: (items: T[]) => Promise<unknown> = async () => undefined;

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (inFlight || pending.size === 0) return;
    const items = [...pending.entries()];
    pending.clear();
    inFlight = true;
    onStatus({ kind: 'saving' });
    try {
      await save(items.map(([, item]) => item));
      onStatus({ kind: 'saved', at: new Date() });
    } catch (cause) {
      items.forEach(([key, item]) => {
        if (!pending.has(key)) pending.set(key, item);
      });
      onStatus({ kind: 'error', message: errorMessage(cause, 'Scores could not be saved.') });
      inFlight = false;
      return;
    }
    inFlight = false;
    if (pending.size > 0) await flush();
  };

  return {
    queue: (key, item) => {
      pending.set(key, item);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, AUTOSAVE_DELAY_MS);
    },
    drop: (key) => { pending.delete(key); },
    flush,
    dispose: () => {
      if (timer) clearTimeout(timer);
      if (pending.size > 0) void flush();
    },
    setSave: (next) => { save = next; },
  };
}

function useAutosave<T>(save: (items: T[]) => Promise<unknown>) {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [saver] = useState(() => createAutosaver<T>(setStatus));
  useEffect(() => { saver.setSave(save); }, [saver, save]);
  useEffect(() => () => saver.dispose(), [saver]);
  return { queue: saver.queue, drop: saver.drop, flush: saver.flush, status };
}

function SaveStatusText({ status }: { status: SaveStatus }) {
  let text = '';
  if (status.kind === 'saving') text = 'Saving...';
  if (status.kind === 'saved') text = `Saved ${timeFormatter.format(status.at)}`;
  if (status.kind === 'error') text = 'Not saved';
  return <span className={styles.saveStatus} role="status">{text}</span>;
}

/** Moves focus to the same game in the next or previous scoring line. */
function moveVertical(event: KeyboardEvent<HTMLInputElement>, step: 1 | -1, scope: string) {
  const input = event.currentTarget;
  const line = Number(input.dataset.line);
  const column = input.dataset.column;
  const next = document.querySelector<HTMLInputElement>(
    `input[data-scope="${scope}"][data-line="${line + step}"][data-column="${column}"]`,
  );
  if (next) {
    event.preventDefault();
    next.focus();
    next.select();
  }
}

function handleGridKeys(event: KeyboardEvent<HTMLInputElement>, scope: string) {
  if (event.key === 'Enter' || event.key === 'ArrowDown') moveVertical(event, 1, scope);
  if (event.key === 'ArrowUp') moveVertical(event, -1, scope);
}

type ScoreInputProps = {
  label: string;
  value: string;
  error: boolean;
  scope: string;
  line: number;
  column: number;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function ScoreInput({ label, value, error, scope, line, column, disabled, onChange }: ScoreInputProps) {
  return (
    <input
      className={styles.scoreInput}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      aria-invalid={error || undefined}
      value={value}
      disabled={disabled}
      data-scope={scope}
      data-line={line}
      data-column={column}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => handleGridKeys(event, scope)}
    />
  );
}

// ---------------------------------------------------------------------------
// Qualifying

function cellKey(entryId: number, bowlerId: number, game: number): string {
  return `${entryId}:${bowlerId}:${game}`;
}

function initialValues(grid: ScoreGrid): Record<string, string> {
  const values: Record<string, string> = {};
  grid.rows.forEach((row) => {
    row.bowlers.forEach((bowler) => {
      (row.scores[String(bowler.bowler_id)] ?? []).forEach((score, index) => {
        values[cellKey(row.entry_id, bowler.bowler_id, index + 1)] = score === null ? '' : String(score);
      });
    });
  });
  return values;
}

function rowTotals(row: ScoreGridRow, values: Record<string, string>, games: number, shared: boolean) {
  let scratch = 0;
  let handicap = 0;
  const entryGames = new Set<number>();
  row.bowlers.forEach((bowler) => {
    let bowled = 0;
    for (let game = 1; game <= games; game += 1) {
      const value = parseScore(values[cellKey(row.entry_id, bowler.bowler_id, game)] ?? '');
      if (typeof value === 'number') {
        scratch += value;
        bowled += 1;
        entryGames.add(game);
      }
    }
    if (!shared) handicap += bowler.handicap_per_game * bowled;
  });
  if (shared) handicap = row.bowlers.reduce((sum, bowler) => sum + bowler.handicap_per_game, 0) * entryGames.size;
  return { scratch, handicap, total: scratch + handicap };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function linesSummary(grid: ScoreGrid): string {
  const event = grid.events.find((item) => item.id === grid.event_id);
  if (!event) return '';
  const parts = [event.scoring_label];
  event.divisions.forEach((division) => {
    const lines = [
      division.advancing_count ? `top ${division.advancing_count} advance` : '',
      division.cashing_count ? `top ${division.cashing_count} cash` : '',
    ].filter(Boolean).join(', ');
    if (!lines) return;
    parts.push(division.name ? `${division.name}: ${lines}` : lines.charAt(0).toUpperCase() + lines.slice(1));
  });
  return parts.join(' · ');
}

function QualifyingView({ tournamentId }: { tournamentId: number }) {
  const [grid, setGrid] = useState<ScoreGrid | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [squadId, setSquadId] = useState<string>(ALL_SQUADS);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  const saveGrid = useCallback(async (changes: ScoreChange[]) => {
    const token = getToken();
    if (!token) throw new Error('Your session expired. Please sign in again.');
    await saveScores(token, tournamentId, changes);
  }, [tournamentId]);
  const autosave = useAutosave<ScoreChange>(saveGrid);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      setLoadError('Your session expired. Please sign in again.');
      setIsLoading(false);
      return undefined;
    }
    setIsLoading(true);
    fetchScoreGrid(token, tournamentId, { eventId, squadId: squadId || null })
      .then((result) => {
        if (cancelled) return;
        setGrid(result);
        setValues(initialValues(result));
        setInvalid(new Set());
        setLoadError('');
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, 'Scores could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [tournamentId, eventId, squadId]);

  const updateCell = (entryId: number, bowlerId: number, game: number, text: string) => {
    const key = cellKey(entryId, bowlerId, game);
    setValues((current) => ({ ...current, [key]: text }));
    const score = parseScore(text);
    setInvalid((current) => {
      const next = new Set(current);
      if (score === undefined) next.add(key);
      else next.delete(key);
      return next;
    });
    if (score === undefined) {
      autosave.drop(key);
      return;
    }
    autosave.queue(key, { entry_id: entryId, bowler_id: bowlerId, game, score });
  };

  if (loadError && !grid) return <Notice tone="danger" role="alert">{loadError}</Notice>;
  if (!grid) return isLoading ? <Notice tone="info" role="status">Loading scores...</Notice> : null;
  if (grid.events.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
          title="No events to score"
          description="Add events in setup, then scores can be entered here as bowlers finish."
          action={<ButtonLink variant="secondary" href={organizerRoutes.setup(tournamentId)}>Go to setup</ButtonLink>}
        />
      </Card>
    );
  }

  const games = Array.from({ length: grid.games }, (_, index) => index + 1);
  const currentEvent = grid.events.find((event) => event.id === grid.event_id);
  // First scoring line of each entry, so Enter can move to the same game on the next line.
  const firstLine = new Map<number, number>();
  grid.rows.reduce((next, row) => {
    firstLine.set(row.entry_id, next);
    return next + (grid.shared_score ? 1 : Math.max(row.bowlers.length, 1));
  }, 0);

  return (
    <>
      <div className={styles.controls}>
        <SelectField label="Event" value={grid.event_id ?? ''} onChange={(event) => setEventId(event.target.value)}>
          {grid.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </SelectField>
        {grid.squads.length > 1 ? (
          <SelectField label="Squad" value={squadId} onChange={(event) => setSquadId(event.target.value)}>
            <option value={ALL_SQUADS}>All squads</option>
            {grid.squads.map((squad) => <option key={squad.id} value={squad.id}>{squad.label}</option>)}
          </SelectField>
        ) : null}
      </div>

      {autosave.status.kind === 'error' ? (
        <Notice
          tone="danger"
          role="alert"
          action={<Button variant="ghost" size="sm" onClick={() => { void autosave.flush(); }}>Retry</Button>}
        >
          {`Scores not saved. ${autosave.status.message}`}
        </Notice>
      ) : null}
      {loadError ? <Notice tone="danger" role="alert">{loadError}</Notice> : null}

      <Card padding="flush" aria-label="Score grid">
        <CardHeader
          title={currentEvent?.name ?? 'Scores'}
          description={linesSummary(grid)}
          actions={<SaveStatusText status={autosave.status} />}
        />
        {grid.rows.length === 0 ? (
          <EmptyState
            icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
            title="No entries to score"
            description="Confirmed and pending entries for this event and squad appear here."
          />
        ) : (
          <DataTable caption={`Scores for ${currentEvent?.name ?? 'this event'}`} className={styles.grid}>
            <thead>
              <tr>
                <th scope="col">Entry</th>
                {games.map((game) => <th key={game} scope="col" data-align="right">{`Game ${game}`}</th>)}
                <th scope="col" data-align="right">Scratch</th>
                <th scope="col" data-align="right">Handicap</th>
                <th scope="col" data-align="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => {
                const totals = rowTotals(row, values, grid.games, grid.shared_score);
                const scorers = grid.shared_score ? row.bowlers.slice(0, 1) : row.bowlers;
                const span = scorers.length;
                const meta = [row.division, row.squad].filter(Boolean).join(' · ');
                return (
                  <Fragment key={row.entry_id}>
                    {scorers.map((bowler, index) => {
                      const currentLine = (firstLine.get(row.entry_id) ?? 0) + index;
                      const lineName = grid.shared_score || row.bowlers.length === 1 ? row.label : bowler.name;
                      const details = grid.shared_score
                        ? row.bowlers.map((member) => member.name).join(', ')
                        : [
                          bowler.average !== null ? `Avg ${bowler.average}` : 'No average',
                          bowler.handicap_per_game ? `Hdcp ${bowler.handicap_per_game}` : '',
                        ].filter(Boolean).join(' · ');
                      return (
                        <tr key={bowler.bowler_id}>
                          <th scope="row" className={styles.entryCell}>
                            <div className={cells.stack}>
                              {index === 0 && row.bowlers.length > 1 && !grid.shared_score ? (
                                <span className={cells.primaryText}>{row.label}</span>
                              ) : null}
                              <span className={index === 0 && (row.bowlers.length === 1 || grid.shared_score) ? cells.primaryText : undefined}>
                                {lineName}
                              </span>
                              <span className={cells.secondaryText}>{details}</span>
                              {index === 0 && meta ? <span className={cells.secondaryText}>{meta}</span> : null}
                            </div>
                          </th>
                          {games.map((game) => {
                            const key = cellKey(row.entry_id, bowler.bowler_id, game);
                            const hasError = invalid.has(key);
                            return (
                              <td key={game} data-align="right">
                                <ScoreInput
                                  label={`${lineName}, game ${game}`}
                                  value={values[key] ?? ''}
                                  error={hasError}
                                  scope="qualifying"
                                  line={currentLine}
                                  column={game}
                                  onChange={(text) => updateCell(row.entry_id, bowler.bowler_id, game, text)}
                                />
                                {hasError ? <span className={styles.cellError}>0 to 300</span> : null}
                              </td>
                            );
                          })}
                          {index === 0 ? (
                            <>
                              <td rowSpan={span} data-align="right">{totals.scratch}</td>
                              <td rowSpan={span} data-align="right" data-tone="secondary">{totals.handicap}</td>
                              <td rowSpan={span} data-align="right" data-emphasis="true">{totals.total}</td>
                            </>
                          ) : null}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </DataTable>
        )}
        <p className={styles.footnote}>
          {`${plural(grid.rows.length, 'entry')} · Enter or the down arrow moves to the next bowler, Tab moves across`}
        </p>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Finals

type FinalsOption = { value: string; eventId: string; divisionId: string | null; label: string };

function finalsOptions(standings: LiveStandings): FinalsOption[] {
  const options: FinalsOption[] = [];
  standings.events.forEach((event) => {
    event.divisions.forEach((division) => {
      if (!division.finals) return;
      options.push({
        value: `${event.id}::${division.id ?? ''}`,
        eventId: event.id,
        divisionId: division.id,
        label: division.name ? `${event.name}, ${division.name}` : event.name,
      });
    });
  });
  return options;
}

function bracketSide(side: FinalsMatch['a']) {
  return side ? { name: side.name, score: side.score, winner: side.winner } : { name: null };
}

function matchPlayRoundTitle(round: number, rounds: number): string {
  if (round === rounds) return 'Final';
  if (round === rounds - 1) return 'Semifinals';
  if (round === rounds - 2) return 'Quarterfinals';
  return `Round ${round}`;
}

function bracketRounds(finals: LiveFinals): BracketRoundData[] {
  const roundNumbers = [...new Set(finals.matches.map((match) => match.round))].sort((a, b) => a - b);
  const total = roundNumbers.length;
  return roundNumbers.map((round) => {
    const matches = finals.matches.filter((match) => match.round === round);
    const title = finals.type === 'match-play-single'
      ? matchPlayRoundTitle(round, total)
      : matches[0]?.label ?? `Round ${round}`;
    return {
      title,
      matches: matches.map((match): BracketMatchData => ({
        id: match.id,
        label: match.label,
        players: [bracketSide(match.a), match.b ? bracketSide(match.b) : { name: 'Bye' }],
      })),
    };
  });
}

function FinalsDisplay({ finals }: { finals: LiveFinals }) {
  if (finals.type === 'stepladder' || finals.type === 'match-play-single') {
    return <BracketTree rounds={bracketRounds(finals)} champion={finals.champion} label={finals.label} />;
  }
  if (finals.type === 'round-robin') {
    return (
      <DataTable caption="Round robin standings">
        <thead>
          <tr>
            <th scope="col" data-align="right">#</th>
            <th scope="col">Finalist</th>
            <th scope="col" data-align="right">Won</th>
            <th scope="col" data-align="right">Lost</th>
            <th scope="col" data-align="right">Tied</th>
            <th scope="col" data-align="right">Pins</th>
            <th scope="col" data-align="right">Points</th>
          </tr>
        </thead>
        <tbody>
          {finals.table.map((row) => (
            <tr key={row.key ?? row.seed}>
              <td data-align="right">{row.rank}</td>
              <td>{row.name}</td>
              <td data-align="right">{row.wins}</td>
              <td data-align="right">{row.losses}</td>
              <td data-align="right">{row.ties}</td>
              <td data-align="right">{row.pins}</td>
              <td data-align="right" data-emphasis="true">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    );
  }
  return null;
}

function slotKey(slot: Pick<FinalsSlot, 'round' | 'match' | 'seed'>): string {
  return `${slot.round}:${slot.match}:${slot.seed}`;
}

function FinalsView({ tournamentId }: { tournamentId: number }) {
  const [options, setOptions] = useState<FinalsOption[] | null>(null);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState<FinalsState | null>(null);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<'start' | 'reset' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const option = options?.find((item) => item.value === selected) ?? options?.[0] ?? null;
  const target: FinalsTarget | null = option ? { event_config_id: option.eventId, division_config_id: option.divisionId } : null;

  /** Takes the server's finals, keeping any invalid text still being corrected. */
  const applyState = useCallback((next: FinalsState) => {
    setState(next);
    setValues((current) => {
      const nextValues: Record<string, string> = {};
      next.slots.forEach((slot) => {
        const key = slotKey(slot);
        const typed = current[key];
        nextValues[key] = typed !== undefined && parseScore(typed) === undefined
          ? typed
          : slot.score === null ? '' : String(slot.score);
      });
      return nextValues;
    });
  }, []);

  const eventId = target?.event_config_id ?? null;
  const divisionId = target?.division_config_id ?? null;
  const saveFinals = useCallback(async (games: FinalsGameChange[]) => {
    const token = getToken();
    if (!token) throw new Error('Your session expired. Please sign in again.');
    if (!eventId) return;
    applyState(await saveFinalsGames(token, tournamentId, { event_config_id: eventId, division_config_id: divisionId }, games));
  }, [tournamentId, eventId, divisionId, applyState]);
  const autosave = useAutosave<FinalsGameChange>(saveFinals);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Your session expired. Please sign in again.');
      return;
    }
    fetchStandings(token, tournamentId)
      .then((standings) => setOptions(finalsOptions(standings)))
      .catch((cause: unknown) => setError(errorMessage(cause, 'Finals could not be loaded.')));
  }, [tournamentId]);

  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    const token = getToken();
    if (!token) return undefined;
    fetchFinals(token, tournamentId, { event_config_id: eventId, division_config_id: divisionId })
      .then((next) => {
        if (cancelled) return;
        setInvalid(new Set());
        setValues({});
        applyState(next);
        setError('');
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, 'Finals could not be loaded.'));
      });
    return () => { cancelled = true; };
  }, [tournamentId, eventId, divisionId, applyState]);

  const updateSlot = (slot: FinalsSlot, text: string) => {
    const key = slotKey(slot);
    setValues((current) => ({ ...current, [key]: text }));
    const score = parseScore(text);
    setInvalid((current) => {
      const next = new Set(current);
      if (score === undefined) next.add(key);
      else next.delete(key);
      return next;
    });
    if (score === undefined) {
      autosave.drop(key);
      return;
    }
    autosave.queue(key, { round: slot.round, match: slot.match, seed: slot.seed, score });
  };

  const runAction = async () => {
    const token = getToken();
    if (!token || !target || !confirm) return;
    setBusy(true);
    setActionError('');
    try {
      if (confirm === 'start') {
        applyState(await startFinals(token, tournamentId, target));
      } else {
        await resetFinals(token, tournamentId, target);
        setValues({});
        applyState(await fetchFinals(token, tournamentId, target));
      }
      setConfirm(null);
    } catch (cause) {
      setActionError(errorMessage(cause, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (error && !state) return <Notice tone="danger" role="alert">{error}</Notice>;
  if (!options) return <Notice tone="info" role="status">Loading finals...</Notice>;
  if (options.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
          title="No finals set up"
          description="Choose a stepladder, match play, round robin, or survivor final for an event in setup."
          action={<ButtonLink variant="secondary" href={organizerRoutes.setup(tournamentId)}>Go to setup</ButtonLink>}
        />
      </Card>
    );
  }

  const finals = state?.finals ?? null;
  const isDouble = state?.finals_type === 'match-play-double';

  return (
    <>
      {options.length > 1 ? (
        <div className={styles.controls}>
          <SelectField label="Event and division" value={option?.value ?? ''} onChange={(event) => setSelected(event.target.value)}>
            {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
        </div>
      ) : null}

      {autosave.status.kind === 'error' ? (
        <Notice
          tone="danger"
          role="alert"
          action={<Button variant="ghost" size="sm" onClick={() => { void autosave.flush(); }}>Retry</Button>}
        >
          {`Finals scores not saved. ${autosave.status.message}`}
        </Notice>
      ) : null}

      {state && !state.started ? (
        <Card padding="flush" aria-label="Qualifiers">
          <CardHeader
              title={finals?.label ?? 'Finals'}
            description={isDouble
              ? 'Double elimination finals are coming soon.'
              : `Seeds come from the current standings. ${plural(state.qualifiers.length, 'entry')} inside the cut.`}
            actions={isDouble ? null : (
              <Button variant="primary" disabled={!state.can_start} onClick={() => setConfirm('start')}>Start finals</Button>
            )}
          />
          {state.qualifiers.length === 0 ? (
            <EmptyState
              icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No qualifiers yet"
              description="Qualifiers appear here once scores are entered."
            />
          ) : (
            <DataTable caption="Qualifiers">
              <thead>
                <tr>
                  <th scope="col" data-align="right">Seed</th>
                  <th scope="col">Entry</th>
                  <th scope="col" data-align="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {state.qualifiers.map((row, index) => (
                  <tr key={row.key}>
                    <td data-align="right">{index + 1}</td>
                    <td>{row.name}</td>
                    <td data-align="right" data-emphasis="true">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      ) : null}

      {state && state.started && finals ? (
        <Card aria-label="Finals">
          <CardHeader
            title={finals.label}
            description={[
              finals.status === 'complete' ? 'Complete' : 'In progress',
              finals.notes,
            ].filter(Boolean).join(' · ')}
            actions={(
              <>
                <SaveStatusText status={autosave.status} />
                <Menu
                  triggerLabel="More actions for finals"
                  trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}
                >
                  <MenuItem tone="danger" onSelect={() => setConfirm('reset')}>Reset finals</MenuItem>
                </Menu>
              </>
            )}
          />
          {finals.champion && finals.type !== 'stepladder' && finals.type !== 'match-play-single' ? (
            <Notice tone="success">{`Champion: ${finals.champion.name}. ${finals.champion.detail}`}</Notice>
          ) : null}
          <FinalsDisplay finals={finals} />
          {finals.type === 'survivor' && finals.rounds.length ? (
            <p className={styles.footnote}>
              {finals.rounds.map((round) => {
                const out = round.rows.filter((row) => row.eliminated).map((row) => row.name);
                return out.length ? `${round.label}: ${out.join(', ')} out` : `${round.label}: in progress`;
              }).join(' · ')}
            </p>
          ) : null}
          <CardDivider />
          <h3 className={styles.subsectionTitle}>Enter finals scores</h3>
          {state.slots.length === 0 ? (
            <p className={styles.bodyText}>Scores open as each match is set.</p>
          ) : (
            <DataTable caption="Finals scores" className={styles.grid}>
              <thead>
                <tr>
                  <th scope="col">Match</th>
                  <th scope="col" data-align="right">Seed</th>
                  <th scope="col">Finalist</th>
                  <th scope="col" data-align="right">Score</th>
                  <th scope="col" data-align="right">Handicap</th>
                  <th scope="col" data-align="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {state.slots.map((slot, currentLine) => {
                  const key = slotKey(slot);
                  const parsed = parseScore(values[key] ?? '');
                  return (
                    <tr key={key}>
                      <td>{slot.label}</td>
                      <td data-align="right">{slot.seed}</td>
                      <th scope="row" className={styles.entryCell}>{slot.name}</th>
                      <td data-align="right">
                        <ScoreInput
                          label={`${slot.name}, ${slot.label}`}
                          value={values[key] ?? ''}
                          error={invalid.has(key)}
                          scope="finals"
                          line={currentLine}
                          column={1}
                          onChange={(text) => updateSlot(slot, text)}
                        />
                        {invalid.has(key) ? <span className={styles.cellError}>0 to 300</span> : null}
                      </td>
                      <td data-align="right" data-tone="secondary">{slot.handicap}</td>
                      <td data-align="right" data-emphasis="true">{typeof parsed === 'number' ? parsed + slot.handicap : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirm === 'start'}
        title="Start finals?"
        description="Seeds are taken from the current standings. Finish qualifying scores first: later qualifying changes don't reseed the finals."
        confirmLabel="Start finals"
        busy={busy}
        busyLabel="Starting..."
        error={actionError || undefined}
        onConfirm={() => { void runAction(); }}
        onCancel={() => { setConfirm(null); setActionError(''); }}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        tone="danger"
        title="Reset finals?"
        description="This deletes every finals score and the seeds for this event. Qualifying scores are kept."
        confirmLabel="Reset finals"
        busy={busy}
        busyLabel="Resetting..."
        error={actionError || undefined}
        onConfirm={() => { void runAction(); }}
        onCancel={() => { setConfirm(null); setActionError(''); }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

export default function ScoresPage() {
  const { tournamentId } = useTournamentContext();
  const [view, setView] = useState<View>('qualifying');
  const liveHref = useMemo(() => organizerRoutes.liveStandings(tournamentId), [tournamentId]);

  return (
    <Page>
      <PageHeader
        title="Scores"
        description="Enter scores as bowlers finish. Standings and the live page update as you type."
        actions={(
          <ButtonLink
            variant="secondary"
            href={liveHref}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExternalLink size={ICON_SIZE.md} aria-hidden="true" />}
          >
            Open live standings
          </ButtonLink>
        )}
      />
      <SegmentedControl
        label="Scoring stage"
        value={view}
        onChange={setView}
        options={[{ value: 'qualifying', label: 'Qualifying' }, { value: 'finals', label: 'Finals' }]}
      />
      {view === 'qualifying' ? <QualifyingView tournamentId={tournamentId} /> : <FinalsView tournamentId={tournamentId} />}
    </Page>
  );
}
