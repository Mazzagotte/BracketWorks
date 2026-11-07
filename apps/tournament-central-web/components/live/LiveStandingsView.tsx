'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  Badge,
  BracketTree,
  ButtonLink,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ICON_SIZE,
  Notice,
  SearchField,
  StatGroup,
  TableToolbar,
} from '@bracketworks/ui';

import { MOBILE_VIEWPORT_QUERY } from '@/lib/responsive';
import type { LiveAllEvents, LiveDivision, LiveEvent, LiveFinals, LiveStandings, StandingRow } from './liveStandingsTypes';
import { useLiveStandings, useMediaQuery } from './useLiveStandings';
import { FinalsPlacings } from './FinalsPlacings';
import { ChampionLine, RoundRobinTable, finalsRounds } from './finalsParts';
import { EMPTY, FINALS_BADGE, LiveNotFound, LiveShell, TV_CYCLE_MS } from './LiveShell';
import type { LiveNavItem } from './LiveShell';
import { Picker, divisionKey, divisionOptions, findGroup, groupKey, groupStops, sectionTitle, squadKey, squadOptions } from './livePickers';
import type { PickerOption } from './livePickers';
import { liveFinalsPagePath } from './liveStandingsPaths';
import styles from './LiveStandingsView.module.css';

export { TV_CYCLE_MS, finalsRounds };

export type LiveView = 'standings' | 'finals' | 'all-events';

export type LiveStandingsViewProps = {
  tournamentId: number;
  initialData: LiveStandings | null;
  /** The server already got a 404: show the not-found state. */
  initialNotFound?: boolean;
  /** `?tv=1`: read-only view for a screen at the center that cycles through events. */
  tv?: boolean;
  /** Test hook; defaults to the live poll interval. */
  pollIntervalMs?: number;
  /** `?view=finals` or `?view=all-events` (links from the finals page). */
  initialView?: LiveView;
};

type MoneyLine = { position: number; label: string } | null;

/**
 * Where the money line goes in qualifying. Without finals it's the top `cashingCount` places. With
 * finals (the API sends `cashNote`), the finals finish decides the money, so qualifying only shows a
 * line when more places pay than advance.
 */
function moneyLine(division: LiveDivision): MoneyLine {
  const cashing = division.cashingCount;
  const advancing = division.advancingCount;
  if (!cashing) return null;
  if (division.cashNote) {
    if (!advancing || cashing <= advancing) return null;
    const places = advancing + 1 === cashing ? `place ${cashing} cashes` : `places ${advancing + 1}-${cashing} cash`;
    return { position: cashing, label: `In the money: ${places} from qualifying` };
  }
  return { position: cashing, label: `In the money: top ${cashing} cash` };
}

function rankText(rank: number | null, tied: boolean): string {
  if (rank === null) return EMPTY;
  return tied ? `T${rank}` : String(rank);
}

/** Ranked rows in rank order, then rows that have not bowled, keeping the API's order within each. */
function orderRows<T extends { rank: number | null }>(rows: T[]): T[] {
  const ranked = rows.filter((row) => row.rank !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return [...ranked, ...rows.filter((row) => row.rank === null)];
}

/** Labels for the divider rows, keyed by how many ranked rows come before the line. */
function lineLabels(rankedCount: number, advancingCount: number | null, money: MoneyLine): Map<number, string[]> {
  const lines = new Map<number, string[]>();
  const add = (position: number | null, label: string) => {
    if (!position || position <= 0 || position >= rankedCount) return;
    lines.set(position, [...(lines.get(position) ?? []), label]);
  };
  add(advancingCount, `Cut line: top ${advancingCount} advance to finals`);
  if (money) add(money.position, money.label);
  return lines;
}

function NumberCell({ value, emphasis }: { value: number | null; emphasis?: boolean }) {
  if (value === null) return <td data-align="right" data-tone="secondary">{EMPTY}</td>;
  return (
    <td data-align="right" data-tone={value === 0 ? 'secondary' : undefined} data-emphasis={emphasis ? 'true' : undefined}>
      {value}
    </td>
  );
}

function DividerRow({ colSpan, labels }: { colSpan: number; labels: string[] }) {
  return (
    <tr className={styles.lineRow}>
      <td colSpan={colSpan}>{labels.join(' · ')}</td>
    </tr>
  );
}

function matchesQuery(query: string, ...values: Array<string | null | undefined>): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return values.some((value) => value?.toLocaleLowerCase().includes(needle));
}

/* ---------- Standings ---------- */

function StandingsTable({ event, division, query }: { event: LiveEvent; division: LiveDivision; query: string }) {
  // On phones the total sits right after the name, so the number people look for is visible without scrolling.
  const totalFirst = useMediaQuery(MOBILE_VIEWPORT_QUERY);
  const rows = useMemo(() => orderRows(division.rows), [division.rows]);
  const gameCount = event.games > 0 ? event.games : rows.reduce((max, row) => Math.max(max, row.games.length), 0);
  const games = Array.from({ length: gameCount }, (_, index) => index);
  const showHandicap = event.scoring === 'handicap';
  const columnCount = 2 + gameCount + 1 + (showHandicap ? 1 : 0) + 1;
  const filtering = query.trim().length > 0;
  const visible = filtering ? rows.filter((row) => matchesQuery(query, row.name, ...row.bowlers.map((bowler) => bowler.name))) : rows;
  const rankedCount = rows.filter((row) => row.rank !== null).length;
  const lines = filtering ? new Map<number, string[]>() : lineLabels(rankedCount, division.advancingCount, moneyLine(division));

  return (
    <DataTable caption={`${sectionTitle(event, division)} standings`} className={styles.table}>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Bowler</th>
          {totalFirst ? <th scope="col" data-align="right">Total</th> : null}
          {games.map((index) => (
            <th key={index} scope="col" data-align="right">
              <abbr title={`Game ${index + 1}`} className={styles.abbr}>G{index + 1}</abbr>
            </th>
          ))}
          <th scope="col" data-align="right">Scratch</th>
          {showHandicap ? <th scope="col" data-align="right">Hdcp</th> : null}
          {totalFirst ? null : <th scope="col" data-align="right">Total</th>}
        </tr>
      </thead>
      <tbody>
        {visible.length === 0 ? (
          <tr className={styles.lineRow}>
            <td colSpan={columnCount}>No bowlers match &quot;{query.trim()}&quot;.</td>
          </tr>
        ) : null}
        {visible.map((row, index) => (
          <Fragment key={row.key}>
            <StandingRowView row={row} games={games} showHandicap={showHandicap} totalFirst={totalFirst} />
            {lines.has(index + 1) ? <DividerRow colSpan={columnCount} labels={lines.get(index + 1) ?? []} /> : null}
          </Fragment>
        ))}
      </tbody>
    </DataTable>
  );
}

function StandingRowView({ row, games, showHandicap, totalFirst }: { row: StandingRow; games: number[]; showHandicap: boolean; totalFirst: boolean }) {
  const bowled = row.rank !== null;
  const totalCell = bowled ? <NumberCell value={row.total} emphasis /> : <td data-align="right" data-tone="secondary">{EMPTY}</td>;
  const bowlerNames = row.bowlers.length > 1 ? row.bowlers.map((bowler) => bowler.name).join(', ') : '';
  const meta = [bowlerNames, bowled ? '' : 'Not bowled yet'].filter(Boolean).join(' · ');
  return (
    <tr>
      <td data-tone={bowled ? undefined : 'secondary'} className={styles.rank}>{rankText(row.rank, row.tied)}</td>
      <td className={styles.nameCell}>
        <span className={styles.nameLine}>
          <span>{row.name}</span>
          {row.status === 'advancing' ? <Badge>Advancing</Badge> : null}
          {row.status === 'cashing' ? <Badge>Cashing</Badge> : null}
        </span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </td>
      {totalFirst ? totalCell : null}
      {games.map((index) => <NumberCell key={index} value={row.games[index] ?? null} />)}
      <td data-align="right" data-tone="secondary">{bowled ? row.scratchTotal : EMPTY}</td>
      {showHandicap ? <td data-align="right" data-tone="secondary">{bowled ? row.handicapTotal : EMPTY}</td> : null}
      {totalFirst ? null : totalCell}
    </tr>
  );
}

function StandingsCard({
  events,
  event,
  division,
  onEventChange,
  onDivisionChange,
  onSquadChange,
  query,
  onQueryChange,
  tv,
}: {
  events: LiveEvent[];
  event: LiveEvent;
  division: LiveDivision;
  onEventChange: (id: string) => void;
  onDivisionChange: (key: string) => void;
  onSquadChange: (key: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  tv: boolean;
}) {
  const noScores = division.rows.length > 0 && division.rows.every((row) => row.rank === null);
  const entryText = `${division.entryCount} ${division.entryCount === 1 ? 'entry' : 'entries'}`;
  const eventOptions = events.map((item) => ({ value: item.id, label: item.name }));
  const divisions = divisionOptions(event);
  const squads = squadOptions(event, division);
  const hasPickers = eventOptions.length > 1 || divisions.length > 1 || squads.length > 1;
  const facts = `${event.scoringLabel} · ${entryText}`;

  return (
    <Card padding="flush" aria-label="Standings" className={styles.tableCard}>
      <CardHeader
        title={sectionTitle(event, division)}
        description={division.cashNote ? <>{facts}<span className={styles.noteLine}>{division.cashNote}</span></> : facts}
      />
      {hasPickers || !tv ? (
        <TableToolbar
          className={styles.toolbar}
          search={tv ? undefined : (
            <SearchField label="Find a bowler" placeholder="Find a bowler" value={query} onChange={(change) => onQueryChange(change.target.value)} />
          )}
        >
          <Picker label="Event" options={eventOptions} value={event.id} onChange={onEventChange} />
          <Picker label="Division" options={divisions} value={divisionKey(division)} onChange={onDivisionChange} />
          <Picker label="Squad" options={squads} value={squadKey(division)} onChange={onSquadChange} />
        </TableToolbar>
      ) : null}
      {noScores ? (
        <div className={styles.inset}>
          <Notice tone="info" role="status">Scores will appear here once bowling starts.</Notice>
        </div>
      ) : null}
      {division.rows.length === 0 ? (
        <div className={styles.inset}>
          <EmptyState title="No entries yet" description="Bowlers will appear here once they register for this event." />
        </div>
      ) : (
        <StandingsTable event={event} division={division} query={query} />
      )}
    </Card>
  );
}

/* ---------- Finals ---------- */

function SurvivorTable({ finals, caption }: { finals: LiveFinals; caption: string }) {
  const rounds = [...finals.rounds].sort((a, b) => a.round - b.round);
  const bowlers = new Map<string, { seed: number; name: string; outAfter: number | null }>();
  for (const round of rounds) {
    for (const row of round.rows) {
      const key = row.key ?? `${row.seed}-${row.name}`;
      const current = bowlers.get(key) ?? { seed: row.seed, name: row.name, outAfter: null };
      if (row.eliminated && current.outAfter === null) current.outAfter = round.round;
      bowlers.set(key, current);
    }
  }
  const ordered = [...bowlers.entries()].sort(([, a], [, b]) => {
    // Still bowling first, then by how long they lasted, then by seed.
    const aOut = a.outAfter ?? Number.MAX_SAFE_INTEGER;
    const bOut = b.outAfter ?? Number.MAX_SAFE_INTEGER;
    return bOut - aOut || a.seed - b.seed;
  });
  const scoreFor = (roundIndex: number, key: string) => {
    const row = rounds[roundIndex].rows.find((item) => (item.key ?? `${item.seed}-${item.name}`) === key);
    return row ? row.score : null;
  };

  return (
    <DataTable caption={caption} className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Seed</th>
          <th scope="col">Bowler</th>
          {rounds.map((round) => <th key={round.round} scope="col" data-align="right">{round.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {ordered.map(([key, bowler]) => (
          <tr key={key}>
            <td className={styles.rank} data-tone="secondary">{bowler.seed}</td>
            <td className={styles.nameCell} data-tone={bowler.outAfter === null ? undefined : 'secondary'}>
              <span>{bowler.name}</span>
              {bowler.outAfter !== null ? <span className={styles.meta}>Out after round {bowler.outAfter}</span> : null}
            </td>
            {rounds.map((round, index) => <NumberCell key={round.round} value={scoreFor(index, key)} />)}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function FinalsCard({
  event,
  division,
  finals,
  isPhone,
  squads,
  onSquadChange,
  finalsHref,
}: {
  event: LiveEvent;
  division: LiveDivision;
  finals: LiveFinals;
  isPhone: boolean;
  squads: PickerOption[];
  onSquadChange: (key: string) => void;
  /** The dedicated finals view for this group. */
  finalsHref: string;
}) {
  const title = sectionTitle(event, division);
  const badge = FINALS_BADGE[finals.status];
  const isBracket = finals.type === 'stepladder' || finals.type === 'match-play-single' || finals.type === 'match-play-double';
  const rounds = isBracket ? finalsRounds(finals) : [];
  const hasTable = (finals.type === 'round-robin' && finals.table.length > 0) || (finals.type === 'survivor' && finals.rounds.length > 0);
  const hasPlacings = (finals.placings?.length ?? 0) > 0;

  return (
    <Card padding={hasTable ? 'flush' : 'default'} aria-label={`${title} finals`} className={hasTable ? styles.tableCard : undefined}>
      <CardHeader
        title={title}
        description={finals.label}
        actions={(
          <>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <ButtonLink variant="secondary" size="sm" href={finalsHref} icon={<ExternalLink size={ICON_SIZE.md} aria-hidden="true" />}>
              Open finals view
            </ButtonLink>
          </>
        )}
      />
      {squads.length > 1 ? (
        <TableToolbar className={styles.toolbar}>
          <Picker label="Squad" options={squads} value={squadKey(division)} onChange={onSquadChange} />
        </TableToolbar>
      ) : null}
      {finals.notes ? <p className={hasTable ? `${styles.body} ${styles.inset}` : styles.body}>{finals.notes}</p> : null}
      {!isBracket && finals.champion ? (
        <div className={hasTable ? styles.inset : undefined}><ChampionLine champion={finals.champion} /></div>
      ) : null}
      {isBracket && rounds.length > 0 ? (
        <BracketTree
          rounds={rounds}
          layout={isPhone ? 'stacked' : 'tree'}
          label={`${title} finals bracket`}
          champion={finals.champion ? { name: finals.champion.name, detail: finals.champion.detail || undefined } : null}
        />
      ) : null}
      {finals.type === 'round-robin' && finals.table.length > 0 ? <RoundRobinTable finals={finals} caption={`${title} round robin`} /> : null}
      {finals.type === 'survivor' && finals.rounds.length > 0 ? <SurvivorTable finals={finals} caption={`${title} survivor rounds`} /> : null}
      {hasPlacings ? (
        <div className={hasTable ? `${styles.inset} ${styles.placings}` : styles.placings}>
          <FinalsPlacings placings={finals.placings} />
        </div>
      ) : null}
      {!finals.notes && !hasTable && rounds.length === 0 && !finals.champion ? (
        <p className={styles.body}>Finals will appear here once the qualifying cut is set.</p>
      ) : null}
    </Card>
  );
}

/** The finals page for one group, opened on that group (and kept in TV mode). */
function finalsViewHref(tournamentId: number, event: LiveEvent, division: LiveDivision, tv: boolean): string {
  const params = new URLSearchParams({ event: event.id, division: divisionKey(division) });
  if (division.squad) params.set('squad', squadKey(division));
  if (tv) params.set('tv', '1');
  return `${liveFinalsPagePath(tournamentId)}?${params.toString()}`;
}

function FinalsView({ events, isPhone, tournamentId, tv }: { events: LiveEvent[]; isPhone: boolean; tournamentId: number; tv: boolean }) {
  // Per-squad events show one card per division, with a squad picker; the choice is kept per event and division.
  const [squadChoice, setSquadChoice] = useState<Record<string, string>>({});
  const sections: Array<{ event: LiveEvent; division: LiveDivision; finals: LiveFinals; squads: PickerOption[]; slot: string }> = [];
  for (const event of events) {
    const seen = new Set<string>();
    for (const division of event.divisions) {
      if (!division.finals) continue;
      const slot = `${event.id}:${divisionKey(division)}`;
      if (!division.squad) {
        sections.push({ event, division, finals: division.finals, squads: [], slot });
        continue;
      }
      if (seen.has(slot)) continue;
      seen.add(slot);
      const withFinals = event.divisions.filter((item) => item.finals && item.squad && divisionKey(item) === divisionKey(division));
      const chosen = withFinals.find((item) => squadKey(item) === squadChoice[slot]) ?? withFinals[0];
      const squads = withFinals.map((item) => ({ value: squadKey(item), label: item.squad?.label ?? 'Squad' }));
      sections.push({ event, division: chosen, finals: chosen.finals as LiveFinals, squads, slot });
    }
  }
  if (sections.length === 0) {
    return (
      <Card>
        <EmptyState title="No finals yet" description="Finals will appear here once they are set up." />
      </Card>
    );
  }
  return (
    <>
      {sections.map(({ event, division, finals, squads, slot }) => (
        <FinalsCard
          key={`${event.id}:${groupKey(division)}`}
          event={event}
          division={division}
          finals={finals}
          isPhone={isPhone}
          squads={squads}
          onSquadChange={(key) => setSquadChoice((previous) => ({ ...previous, [slot]: key }))}
          finalsHref={finalsViewHref(tournamentId, event, division, tv)}
        />
      ))}
    </>
  );
}

/* ---------- All Events ---------- */

function AllEventsCard({ allEvents, query, onQueryChange, tv }: { allEvents: LiveAllEvents; query: string; onQueryChange: (value: string) => void; tv: boolean }) {
  const rows = useMemo(() => orderRows(allEvents.rows), [allEvents.rows]);
  const filtering = query.trim().length > 0;
  const visible = filtering ? rows.filter((row) => matchesQuery(query, row.name)) : rows;
  const rankedCount = rows.filter((row) => row.rank !== null).length;
  const cashing = allEvents.cashingCount;
  const money = cashing ? { position: cashing, label: `In the money: top ${cashing} cash` } : null;
  const lines = filtering ? new Map<number, string[]>() : lineLabels(rankedCount, null, money);
  const columnCount = 3 + allEvents.events.length;

  return (
    <Card padding="flush" aria-label="All events" className={styles.tableCard}>
      <CardHeader title="All events" description="Each bowler's total with handicap across every event." />
      {tv ? null : (
        <TableToolbar
          className={styles.toolbar}
          search={<SearchField label="Find a bowler" placeholder="Find a bowler" value={query} onChange={(change) => onQueryChange(change.target.value)} />}
        />
      )}
      {rows.length === 0 ? (
        <div className={styles.inset}>
          <EmptyState title="No totals yet" description="All events totals will appear here once bowling starts." />
        </div>
      ) : (
        <DataTable caption="All events standings" className={styles.table}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Bowler</th>
              {allEvents.events.map((event) => <th key={event.id} scope="col" data-align="right">{event.name}</th>)}
              <th scope="col" data-align="right">Total</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr className={styles.lineRow}>
                <td colSpan={columnCount}>No bowlers match &quot;{query.trim()}&quot;.</td>
              </tr>
            ) : null}
            {visible.map((row, index) => (
              <Fragment key={row.key}>
                <tr>
                  <td className={styles.rank} data-tone={row.rank === null ? 'secondary' : undefined}>{rankText(row.rank, row.tied)}</td>
                  <td className={styles.nameCell}>
                    <span className={styles.nameLine}>
                      <span>{row.name}</span>
                      {row.status === 'cashing' ? <Badge>Cashing</Badge> : null}
                    </span>
                  </td>
                  {allEvents.events.map((event, eventIndex) => <NumberCell key={event.id} value={row.eventTotals[eventIndex] ?? null} />)}
                  <NumberCell value={row.total} emphasis />
                </tr>
                {lines.has(index + 1) ? <DividerRow colSpan={columnCount} labels={lines.get(index + 1) ?? []} /> : null}
              </Fragment>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}

/* ---------- Shell ---------- */

function topScore(events: LiveEvent[]): { total: number; name: string } | null {
  let best: { total: number; name: string } | null = null;
  for (const event of events) {
    for (const division of event.divisions) {
      for (const row of division.rows) {
        if (row.rank !== null && (!best || row.total > best.total)) best = { total: row.total, name: row.name };
      }
    }
  }
  return best;
}

export default function LiveStandingsView({
  tournamentId,
  initialData,
  initialNotFound = false,
  tv = false,
  pollIntervalMs,
  initialView = 'standings',
}: LiveStandingsViewProps) {
  const { data, notFound, reconnecting, refresh } = useLiveStandings(tournamentId, initialData, { intervalMs: pollIntervalMs, initialNotFound });
  const isPhone = useMediaQuery(MOBILE_VIEWPORT_QUERY);
  const [view, setView] = useState<LiveView>(initialView);
  const [eventId, setEventId] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [squadId, setSquadId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const events = useMemo(() => data?.events ?? [], [data]);
  const hasFinals = events.some((event) => event.divisions.some((division) => division.finals));
  const allEvents = data?.allEvents ?? null;
  const views = useMemo(() => {
    const list: Array<LiveNavItem<LiveView>> = [{ value: 'standings', label: 'Standings', href: '#standings' }];
    if (hasFinals) list.push({ value: 'finals', label: 'Finals', href: '#finals' });
    if (allEvents) list.push({ value: 'all-events', label: 'All events', href: '#all-events' });
    return list;
  }, [hasFinals, allEvents]);
  const activeView: LiveView = views.some((item) => item.value === view) ? view : 'standings';

  const event = events.find((item) => item.id === eventId) ?? events[0] ?? null;
  const division = event ? findGroup(event, divisionId, squadId) : null;

  const changeEvent = useCallback((id: string) => {
    setEventId(id);
    setDivisionId(null);
    setSquadId(null);
  }, []);
  const changeDivision = useCallback((key: string) => {
    setDivisionId(key);
    setSquadId(null);
  }, []);

  // TV mode: step through every event, division, and squad group so a screen at the center shows them all.
  const stops = useMemo(() => groupStops(events), [events]);
  const currentStop = event && division
    ? stops.findIndex((stop) => stop.eventId === event.id && stop.divisionId === divisionKey(division) && stop.squadId === squadKey(division))
    : -1;
  useEffect(() => {
    if (!tv || stops.length < 2 || activeView !== 'standings') return undefined;
    const timer = setTimeout(() => {
      const next = stops[(currentStop + 1) % stops.length];
      setEventId(next.eventId);
      setDivisionId(next.divisionId);
      setSquadId(next.squadId);
    }, TV_CYCLE_MS);
    return () => clearTimeout(timer);
  }, [tv, stops, currentStop, activeView]);

  if (notFound || (!data && initialNotFound)) return <LiveNotFound />;

  const entryTotal = events.reduce((sum, item) => sum + item.divisions.reduce((inner, entry) => inner + entry.entryCount, 0), 0);
  const best = topScore(events);

  return (
    <LiveShell
      data={data}
      tv={tv}
      reconnecting={reconnecting}
      onRefresh={refresh}
      views={views}
      activeView={activeView}
      onViewChange={setView}
      viewsLabel="Live standings views"
      shareLabel="Share live standings"
      fallbackTitle="Live standings"
      loadingText="Loading live standings..."
      unavailableText="Unable to reach live standings. Trying again..."
    >
      <StatGroup
        label="Tournament totals"
        items={[
          { label: 'Entries', value: String(entryTotal) },
          { label: 'Events', value: String(events.length) },
          { label: 'Top score', value: best ? String(best.total) : EMPTY, detail: best ? best.name : 'No scores yet' },
        ]}
      />

      {activeView === 'standings' ? (
        event && division ? (
          <StandingsCard
            events={events}
            event={event}
            division={division}
            onEventChange={changeEvent}
            onDivisionChange={changeDivision}
            onSquadChange={setSquadId}
            query={query}
            onQueryChange={setQuery}
            tv={tv}
          />
        ) : (
          <Card>
            <EmptyState title="No events yet" description="Standings will appear here once the tournament's events are set up." />
          </Card>
        )
      ) : null}
      {activeView === 'finals' ? <FinalsView events={events} isPhone={isPhone} tournamentId={tournamentId} tv={tv} /> : null}
      {activeView === 'all-events' && allEvents ? <AllEventsCard allEvents={allEvents} query={query} onQueryChange={setQuery} tv={tv} /> : null}
    </LiveShell>
  );
}
