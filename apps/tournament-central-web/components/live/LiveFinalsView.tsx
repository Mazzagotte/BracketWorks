'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import {
  Badge,
  BracketLadder,
  BracketTwoSided,
  ButtonLink,
  Card,
  CardDivider,
  CardHeader,
  DataTable,
  EmptyState,
  ICON_SIZE,
  Notice,
  RoundRobinGrid,
  StatGroup,
} from '@bracketworks/ui';
import type { BracketChampionData } from '@bracketworks/ui';

import { MOBILE_VIEWPORT_QUERY } from '@/lib/responsive';
import { FinalsPlacings } from './FinalsPlacings';
import { RoundRobinTable } from './finalsParts';
import { EMPTY, FINALS_BADGE, LiveNotFound, LiveShell, TV_CYCLE_MS, withTv } from './LiveShell';
import type { LiveNavItem } from './LiveShell';
import {
  advancingQualifiers,
  currentFinalsFocus,
  finalsRounds,
  finalsStats,
  ladderMatches,
  roundRobinGrid,
  survivorRound,
  upNextText,
} from './liveFinals';
import type { FinalsFocus } from './liveFinals';
import { Picker, divisionKey, divisionOptions, findGroup, groupKey, groupStops, sectionTitle, squadKey, squadOptions } from './livePickers';
import { liveFinalsPagePath, livePagePath } from './liveStandingsPaths';
import type { FinalsRound, FinalsSide, LiveDivision, LiveEvent, LiveFinals, LiveStandings } from './liveStandingsTypes';
import { useLiveStandings, useMediaQuery } from './useLiveStandings';
import styles from './LiveFinals.module.css';

/* Public live finals (docs/ui-standards.md section 7a): the same shell as live standings, then the
   finals for one event, division, and squad: what is being bowled now (or the champion), and the
   finals drawn in their real shape. */

type FinalsView = 'standings' | 'finals' | 'all-events';

export type LiveFinalsSelection = { event?: string | null; division?: string | null; squad?: string | null };

export type LiveFinalsViewProps = {
  tournamentId: number;
  initialData: LiveStandings | null;
  initialNotFound?: boolean;
  /** `?tv=1`: read-only view for a screen at the center that cycles through finals groups. */
  tv?: boolean;
  /** `?event=&division=&squad=` from the standings page's "Open finals view". */
  initialSelection?: LiveFinalsSelection;
  /** Test hook; defaults to the live poll interval. */
  pollIntervalMs?: number;
};

/** Events with only their groups that have finals; events without finals drop out. */
export function finalsEvents(events: LiveEvent[]): LiveEvent[] {
  return events
    .map((event) => ({ ...event, divisions: event.divisions.filter((division) => division.finals) }))
    .filter((event) => event.divisions.length > 0);
}

function championData(finals: LiveFinals): BracketChampionData | null {
  return finals.champion ? { name: finals.champion.name, detail: finals.champion.detail || undefined } : null;
}

/* ---------- Spotlight ---------- */

function Contender({ side }: { side: FinalsSide }) {
  return (
    <div className={styles.contender}>
      <span className={styles.contenderSeed}>{`Seed ${side.seed}`}</span>
      <span className={styles.contenderName}>{side.name}</span>
      <span className={styles.contenderScore} aria-label={side.score === null ? `${side.name}: no score yet` : `${side.name}: ${side.score}`}>
        {side.score ?? EMPTY}
      </span>
    </div>
  );
}

function NowBowlingCard({ finals, focus, title }: { finals: LiveFinals; focus: NonNullable<FinalsFocus>; title: string }) {
  if (focus.kind === 'round') {
    const rows = [...focus.round.rows].sort((a, b) => a.seed - b.seed);
    return (
      <Card aria-label="Now bowling">
        <CardHeader title="Now bowling" description={`${focus.round.label} · ${title}`} />
        <div className={styles.field}>
          {rows.map((row) => <Contender key={row.key ?? `seed:${row.seed}`} side={{ seed: row.seed, name: row.name, score: row.score, winner: false }} />)}
        </div>
      </Card>
    );
  }
  const { match, next } = focus;
  const tied = finals.type !== 'round-robin' && match.a.score !== null && match.a.score === match.b.score;
  return (
    <Card aria-label="Now bowling">
      <CardHeader title="Now bowling" description={`${match.label} · ${title}`} />
      <div className={styles.duel}>
        <Contender side={match.a} />
        <Contender side={match.b} />
      </div>
      {tied ? <Notice tone="warning" className={styles.spaced}>Tied. A roll-off decides this match.</Notice> : null}
      {next ? (
        <>
          <CardDivider />
          <p className={styles.upNext}>{upNextText(finals, next)}</p>
        </>
      ) : null}
    </Card>
  );
}

function ChampionCard({ finals }: { finals: LiveFinals }) {
  if (!finals.champion) return null;
  return (
    <Card aria-label="Champion">
      <div className={styles.championBlock}>
        <Trophy size={ICON_SIZE['2xl']} aria-hidden="true" className={styles.trophy} />
        <div className={styles.championText}>
          <h2 className={styles.championTitle}>{`Champion: ${finals.champion.name}`}</h2>
          {finals.champion.detail ? <p className={styles.body}>{finals.champion.detail}</p> : null}
        </div>
      </div>
      {finals.placings && finals.placings.length > 0 ? (
        <>
          <CardDivider />
          <FinalsPlacings placings={finals.placings} />
        </>
      ) : null}
    </Card>
  );
}

function QualifiersCard({ division }: { division: LiveDivision }) {
  const qualifiers = advancingQualifiers(division);
  const count = division.advancingCount ?? qualifiers.length;
  return (
    <Card padding="flush" aria-label="Qualifiers" className={styles.tableCard}>
      <CardHeader
        title="Qualifiers"
        description={count ? `The top ${count} after qualifying advance to the finals.` : 'The top qualifiers advance to the finals.'}
      />
      <div className={styles.inset}>
        <Notice tone="info" role="status">Finals start after qualifying.</Notice>
      </div>
      {qualifiers.length === 0 ? (
        <p className={`${styles.body} ${styles.inset}`}>Qualifiers appear here once scores are entered.</p>
      ) : (
        <DataTable caption="Advancing qualifiers" className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Seed</th>
              <th scope="col">Bowler</th>
              <th scope="col" data-align="right">Qualifying total</th>
            </tr>
          </thead>
          <tbody>
            {qualifiers.map((row, index) => (
              <tr key={row.key}>
                <td className={styles.rank}>{index + 1}</td>
                <td>{row.name}</td>
                <td data-align="right" data-emphasis="true">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}

/* ---------- Finals shapes ---------- */

function SurvivorRounds({ rounds, currentRound, label }: { rounds: FinalsRound[]; currentRound: number | null; label: string }) {
  const ordered = [...rounds].sort((a, b) => a.round - b.round);
  return (
    <div className={styles.survivor} role="region" aria-label={label}>
      {ordered.map((round) => {
        const { rows, cutAfter } = survivorRound(round);
        return (
          <section
            key={round.round}
            className={styles.survivorRound}
            aria-label={round.label}
            aria-current={currentRound === round.round ? 'step' : undefined}
          >
            <h3 className={styles.overline}>{round.label}</h3>
            <ol className={styles.survivorList}>
              {rows.map((row, index) => (
                <li
                  key={row.key}
                  className={[styles.survivorRow, row.eliminated ? styles.survivorOut : '', cutAfter === index ? styles.survivorCut : ''].filter(Boolean).join(' ')}
                >
                  <span className={styles.survivorSeed}><span className="sr-only">Seed </span>{row.seed}</span>
                  <span className={styles.survivorName}>
                    <span className={styles.survivorNameText}>{row.name}</span>
                    {row.eliminated ? <span className={styles.outText}>Out</span> : null}
                  </span>
                  <span className={styles.survivorScore}>{row.score ?? EMPTY}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function FinalsShapeCard({ event, division, finals, focus, isPhone }: { event: LiveEvent; division: LiveDivision; finals: LiveFinals; focus: FinalsFocus; isPhone: boolean }) {
  const title = sectionTitle(event, division);
  const badge = FINALS_BADGE[finals.status];
  const currentId = focus?.kind === 'match' ? focus.match.id : null;
  const champion = championData(finals);
  const hasMatches = finals.matches.length > 0;
  const isRoundRobin = finals.type === 'round-robin' && finals.table.length > 0;
  const showPlacings = finals.status !== 'complete' && (finals.placings?.length ?? 0) > 0;

  let shape: ReactNode = null;
  if (finals.type === 'stepladder' && hasMatches) {
    shape = <BracketLadder label={`${title} stepladder`} matches={ladderMatches(finals)} champion={champion} highlightMatchId={currentId} />;
  } else if (finals.type === 'match-play-single' && hasMatches) {
    shape = (
      <BracketTwoSided
        label={`${title} match play bracket`}
        rounds={finalsRounds(finals, currentId)}
        champion={champion}
        layout={isPhone ? 'stacked' : 'two-sided'}
      />
    );
  } else if (finals.type === 'survivor' && finals.rounds.length > 0) {
    shape = <SurvivorRounds rounds={finals.rounds} currentRound={focus?.kind === 'round' ? focus.round.round : null} label={`${title} survivor rounds`} />;
  }

  if (isRoundRobin) {
    const grid = roundRobinGrid(finals);
    return (
      <Card padding="flush" aria-label={`${title} finals`} className={styles.tableCard}>
        <CardHeader title={title} description={finals.label} actions={<Badge tone={badge.tone}>{badge.label}</Badge>} />
        {finals.notes ? <p className={`${styles.body} ${styles.inset}`}>{finals.notes}</p> : null}
        <h3 className={`${styles.subTitle} ${styles.inset}`}>Head to head</h3>
        <RoundRobinGrid label={`${title} head to head`} players={grid.players} games={grid.games} />
        <h3 className={`${styles.subTitle} ${styles.inset} ${styles.subTitleSpaced}`}>Points</h3>
        <RoundRobinTable finals={finals} caption={`${title} round robin points`} />
        {showPlacings ? (
          <div className={`${styles.inset} ${styles.placings}`}>
            <FinalsPlacings placings={finals.placings} />
          </div>
        ) : <div className={styles.cardEnd} />}
      </Card>
    );
  }

  return (
    <Card aria-label={`${title} finals`}>
      <CardHeader title={title} description={finals.label} actions={<Badge tone={badge.tone}>{badge.label}</Badge>} />
      {finals.notes ? <p className={`${styles.body} ${shape ? styles.notes : ''}`}>{finals.notes}</p> : null}
      {shape}
      {!shape && !finals.notes ? <p className={styles.body}>The finals are drawn here once they start.</p> : null}
      {showPlacings ? (
        <>
          <CardDivider />
          <FinalsPlacings placings={finals.placings} />
        </>
      ) : null}
    </Card>
  );
}

function FinalsGroup({ event, division, finals, isPhone }: { event: LiveEvent; division: LiveDivision; finals: LiveFinals; isPhone: boolean }) {
  const focus = currentFinalsFocus(finals);
  const stats = finalsStats(finals, division);
  const title = sectionTitle(event, division);
  return (
    <>
      <StatGroup
        label="Finals totals"
        items={[
          { label: 'Finalists', value: String(stats.finalists) },
          { label: stats.progressLabel, value: stats.progress },
          { label: 'High game', value: stats.high ? String(stats.high.score) : EMPTY, detail: stats.high ? stats.high.name : 'No scores yet' },
        ]}
      />
      {finals.status === 'complete' ? <ChampionCard finals={finals} /> : null}
      {focus ? <NowBowlingCard finals={finals} focus={focus} title={title} /> : null}
      {finals.status === 'not-started' ? <QualifiersCard division={division} /> : null}
      <FinalsShapeCard event={event} division={division} finals={finals} focus={focus} isPhone={isPhone} />
    </>
  );
}

/* ---------- Page ---------- */

export default function LiveFinalsView({ tournamentId, initialData, initialNotFound = false, tv = false, initialSelection, pollIntervalMs }: LiveFinalsViewProps) {
  const { data, notFound, reconnecting, refresh } = useLiveStandings(tournamentId, initialData, { intervalMs: pollIntervalMs, initialNotFound });
  const isPhone = useMediaQuery(MOBILE_VIEWPORT_QUERY);
  const [eventId, setEventId] = useState<string | null>(initialSelection?.event ?? null);
  const [divisionId, setDivisionId] = useState<string | null>(initialSelection?.division ?? null);
  const [squadId, setSquadId] = useState<string | null>(initialSelection?.squad ?? null);

  const events = useMemo(() => finalsEvents(data?.events ?? []), [data]);
  const event = events.find((item) => item.id === eventId) ?? events[0] ?? null;
  const division = event ? findGroup(event, divisionId, squadId) : null;
  const hasAllEvents = Boolean(data?.allEvents);

  const views = useMemo(() => {
    const standings = livePagePath(tournamentId);
    const list: Array<LiveNavItem<FinalsView>> = [
      { value: 'standings', label: 'Standings', href: withTv(standings, tv) },
      { value: 'finals', label: 'Finals', href: withTv(liveFinalsPagePath(tournamentId), tv) },
    ];
    if (hasAllEvents) list.push({ value: 'all-events', label: 'All events', href: withTv(`${standings}?view=all-events`, tv) });
    return list;
  }, [tournamentId, tv, hasAllEvents]);

  const changeEvent = useCallback((id: string) => {
    setEventId(id);
    setDivisionId(null);
    setSquadId(null);
  }, []);
  const changeDivision = useCallback((key: string) => {
    setDivisionId(key);
    setSquadId(null);
  }, []);

  // TV mode: step through every finals group; the spotlight stays at the top of each.
  const stops = useMemo(() => groupStops(events), [events]);
  const currentStop = event && division
    ? stops.findIndex((stop) => stop.eventId === event.id && stop.divisionId === divisionKey(division) && stop.squadId === squadKey(division))
    : -1;
  useEffect(() => {
    if (!tv || stops.length < 2) return undefined;
    const timer = setTimeout(() => {
      const next = stops[(currentStop + 1) % stops.length];
      setEventId(next.eventId);
      setDivisionId(next.divisionId);
      setSquadId(next.squadId);
    }, TV_CYCLE_MS);
    return () => clearTimeout(timer);
  }, [tv, stops, currentStop]);

  if (notFound || (!data && initialNotFound)) return <LiveNotFound title="Live finals are not available" />;

  const eventOptions = events.map((item) => ({ value: item.id, label: item.name }));
  const divisions = event ? divisionOptions(event) : [];
  const squads = event && division ? squadOptions(event, division) : [];
  const hasPickers = !tv && (eventOptions.length > 1 || divisions.length > 1 || squads.length > 1);

  return (
    <LiveShell
      data={data}
      tv={tv}
      reconnecting={reconnecting}
      onRefresh={refresh}
      views={views}
      activeView="finals"
      viewsLabel="Live views"
      shareLabel="Share live finals"
      fallbackTitle="Live finals"
      loadingText="Loading live finals..."
      unavailableText="Unable to reach live finals. Trying again..."
    >
      {hasPickers && event && division ? (
        <div className={styles.pickers} role="group" aria-label="Choose finals">
          <Picker label="Event" options={eventOptions} value={event.id} onChange={changeEvent} />
          <Picker label="Division" options={divisions} value={divisionKey(division)} onChange={changeDivision} />
          <Picker label="Squad" options={squads} value={squadKey(division)} onChange={setSquadId} />
        </div>
      ) : null}
      {event && division?.finals ? (
        <FinalsGroup key={`${event.id}:${groupKey(division)}`} event={event} division={division} finals={division.finals} isPhone={isPhone} />
      ) : (
        <Card>
          <EmptyState
            title="No finals yet"
            description="Finals will appear here once they are set up."
            action={<ButtonLink variant="secondary" href={withTv(livePagePath(tournamentId), tv)}>View standings</ButtonLink>}
          />
        </Card>
      )}
    </LiveShell>
  );
}
