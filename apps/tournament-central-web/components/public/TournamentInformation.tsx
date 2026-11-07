'use client';

import { useEffect, useState } from 'react';
import { formatTournamentDate, parseTournamentDate } from '@/lib/tournamentDates';
import { formatMoney, formatSquadTime } from '@/components/organizer/organizerFormatting';
import { Badge, Button, CardDivider, Notice, capitalizeFirstLetter } from '@bracketworks/ui';
import { normalizeDivisionRules, normalizeEventRules, normalizeSideEvent } from '@/components/organizer/formatTypes';
import { bracketPayoutSummary, divisionLimitParts, eventRulesParts, payoutRatioText } from '@/components/organizer/formatSummaries';
import styles from './publicInfo.module.css';
import TournamentRules from './TournamentRules';

type PublicInformation = {
  details: {
    tournamentType?: string; organizer?: string; contactName?: string; supportEmail?: string;
    supportPhone?: string; contactNote?: string; registrationCloseIso?: string;
    registrationCloseTime?: string; timezone?: string;
    rulesText?: string;
  };
  events: Array<{
    id: string; name: string; scoring?: string; description?: string; entryFeeCents?: number;
    maxPlayers?: number; rules?: unknown;
  }>;
  divisions: Array<{
    id: string; name: string; eligibilityNotes?: string;
    minAverage?: number | null; maxAverage?: number | null; minAge?: number | null; maxAge?: number | null; rules?: unknown;
  }>;
  fees?: Array<{ id: string; name: string; amountCents?: number; enabled?: boolean; sideEvent?: unknown }>;
  squads: Array<{ id: string; name: string; dateIso?: string; startTime?: string; capacity?: number; registeredCount?: number }>;
  documents: Array<{ name: string; kind: string; url: string }>;
};

export default function TournamentInformation({ configUrl }: { configUrl: string | null }) {
  const [information, setInformation] = useState<PublicInformation | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setInformation(null);
    setError('');
    if (!configUrl) return () => controller.abort();
    void (async () => {
      try {
        const response = await fetch(configUrl, { signal: controller.signal, cache: 'no-store' });
        if (response.status === 404) {
          setInformation({ details: {}, events: [], divisions: [], squads: [], documents: [] });
          return;
        }
        if (!response.ok) throw new Error('Tournament information could not be loaded.');
        const data = await response.json() as PublicInformation;
        if (!controller.signal.aborted) setInformation(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Tournament information could not be loaded.');
      }
    })();
    return () => controller.abort();
  }, [configUrl, attempt]);

  if (error) {
    return (
      <Notice tone="danger" role="alert" action={<Button size="sm" variant="ghost" onClick={() => setAttempt((value) => value + 1)}>Try again</Button>}>
        {error}
      </Notice>
    );
  }
  if (!configUrl) return <p className={styles.empty}>Additional tournament information has not been provided. Contact the organizer before registering.</p>;
  if (!information) return <p className={styles.empty} role="status">Loading tournament information...</p>;
  const details = information.details ?? {};
  const events = information.events ?? [];
  const divisions = information.divisions ?? [];
  const squads = information.squads ?? [];
  const documents = information.documents ?? [];
  const sideEvents = (information.fees ?? []).filter((fee) => fee.enabled !== false && fee.name);
  const prices = events.flatMap((event) => typeof event.entryFeeCents === 'number' ? [event.entryFeeCents] : []);
  const organizerNames = [...new Set([details.organizer, details.contactName].map((name) => name?.trim()).filter(Boolean))];

  return (
    <div className={styles.information}>
      <dl className={styles.facts}>
        {details.tournamentType ? <div><dt>Tournament type</dt><dd>{details.tournamentType}</dd></div> : null}
        {prices.length > 0 ? <div><dt>Entry fee</dt><dd>From {formatMoney(Math.min(...prices))}</dd></div> : null}
        {details.registrationCloseIso ? (
          <div>
            <dt>Registration deadline</dt>
            <dd>
              {formatTournamentDate(details.registrationCloseIso)}{details.registrationCloseTime ? ` at ${formatSquadTime(details.registrationCloseTime)}` : ''}
              {details.timezone ? <span className={styles.meta}>{details.timezone.replaceAll('_', ' ')}</span> : null}
            </dd>
          </div>
        ) : null}
      </dl>

      <CardDivider />
      <section className={styles.section}>
        <h3 className={styles.heading}>Events and format</h3>
        {events.length > 0 ? (
          <ul className={styles.rows}>
            {events.map((event) => (
              <li key={event.id} className={styles.row}>
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>{event.name}</span>
                  <EventFormatDetails event={event} />
                  {event.description ? <p className={styles.meta}>{event.description}</p> : null}
                </div>
                {typeof event.entryFeeCents === 'number' ? <span className={styles.amount}>{formatMoney(event.entryFeeCents)}</span> : null}
              </li>
            ))}
          </ul>
        ) : <p className={styles.empty}>Event and format details have not been provided.</p>}
      </section>

      {divisions.length > 0 ? (
        <>
          <CardDivider />
          <section className={styles.section}>
            <h3 className={styles.heading}>Divisions</h3>
            <ul className={styles.rows}>
              {divisions.map((division) => (
                <li key={division.id} className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.rowTitle}>{division.name}</span>
                    {divisionText(division) ? <span className={styles.meta}>{divisionText(division)}</span> : null}
                    {division.eligibilityNotes ? <p className={styles.meta}>{division.eligibilityNotes}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {sideEvents.length > 0 ? (
        <>
          <CardDivider />
          <section className={styles.section}>
            <h3 className={styles.heading}>Side events and add-ons</h3>
            <ul className={styles.rows}>
              {sideEvents.map((fee) => {
                const amountCents = typeof fee.amountCents === 'number' ? fee.amountCents : 0;
                const sideEvent = fee.sideEvent ? normalizeSideEvent(fee.sideEvent) : null;
                const meta = sideEvent ? [
                  sideEvent.per === 'bowler' ? 'Per bowler' : 'Per registration',
                  sideEvent.allowQuantity ? (sideEvent.maxQuantity ? `Buy up to ${sideEvent.maxQuantity}` : 'Buy as many as you like') : null,
                  sideEvent.brackets ? `${capitalizeFirstLetter(sideEvent.brackets.scoring)} brackets` : null,
                ].filter(Boolean).join(' · ') : '';
                return (
                  <li key={fee.id} className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowTitle}>{fee.name}</span>
                      {meta ? <span className={styles.meta}>{meta}</span> : null}
                      {sideEvent?.brackets ? <span className={styles.meta}>{bracketPayoutSummary(amountCents, sideEvent.brackets)}</span> : null}
                      {sideEvent?.brackets?.refundUnfilled ? <span className={styles.meta}>Unfilled brackets are refunded.</span> : null}
                    </div>
                    <span className={styles.amount}>{formatMoney(amountCents)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      <CardDivider />
      <section className={styles.section}>
        <div className={styles.headingRow}>
          <h3 className={styles.heading}>Squad times and availability</h3>
          {squads.length > 0 ? <span className={styles.meta}>{`${squads.length} ${squads.length === 1 ? 'squad' : 'squads'}`}</span> : null}
        </div>
        {squads.length > 0 ? (
          <ul className={styles.rows}>
            {squads.map((squad) => {
              const availability = typeof squad.capacity === 'number' && squad.capacity > 0 && typeof squad.registeredCount === 'number'
                ? { capacity: squad.capacity, bowlers: squad.registeredCount, remaining: Math.max(0, squad.capacity - squad.registeredCount) }
                : null;
              const date = parseTournamentDate(squad.dateIso);
              const fullDate = date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              const scheduleIsInName = fullDate && squad.startTime && squad.name === `${fullDate} - ${formatSquadTime(squad.startTime)}`;
              return (
                <li key={squad.id} className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.rowTitle}>{squad.name}</span>
                    {!scheduleIsInName && (squad.dateIso || squad.startTime) ? (
                      <span className={styles.meta}>
                        {squad.dateIso ? formatTournamentDate(squad.dateIso) : ''}
                        {squad.dateIso && squad.startTime ? ' at ' : ''}
                        {squad.startTime ? formatSquadTime(squad.startTime) : ''}
                      </span>
                    ) : null}
                    {availability ? (
                      <>
                        <p className={styles.meta}><strong className={styles.strong}>{availability.remaining}</strong> of {availability.capacity} bowler spots remaining</p>
                        <span className={styles.meta}>{`${availability.bowlers} ${availability.bowlers === 1 ? 'bowler' : 'bowlers'} registered`}</span>
                      </>
                    ) : <span className={styles.meta}>Contact the organizer for availability</span>}
                  </div>
                  {availability ? (
                    <Badge tone={availability.remaining > 0 ? 'success' : 'danger'}>{availability.remaining > 0 ? 'Spots available' : 'Full'}</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : <p className={styles.empty}>Squad times have not been announced.</p>}
      </section>

      {organizerNames.length > 0 || details.supportEmail || details.supportPhone ? (
        <>
          <CardDivider />
          <section className={styles.section}>
            <h3 className={styles.heading}>Organizer contact</h3>
            <div className={styles.contact}>
              {organizerNames.length > 0 ? <span className={styles.rowTitle}>{organizerNames.join(' - ')}</span> : null}
              {details.supportEmail ? <a href={`mailto:${details.supportEmail}`}>{details.supportEmail}</a> : null}
              {details.supportPhone ? <a href={`tel:${details.supportPhone}`}>{details.supportPhone}</a> : null}
              {details.contactNote ? <p className={styles.meta}>{details.contactNote}</p> : null}
            </div>
          </section>
        </>
      ) : null}

      <CardDivider />
      <TournamentRules rulesText={details.rulesText} documents={documents} />
    </div>
  );
}

type PublicEvent = PublicInformation['events'][number];

/** Format, games, handicap, and finals for one event. Events saved before rules existed show their scoring only. */
function EventFormatDetails({ event }: { event: PublicEvent }) {
  const scoring = event.scoring === 'scratch' || event.scoring === 'no-tap' ? event.scoring : 'handicap';
  if (!event.rules) {
    return event.scoring ? <span className={styles.meta}>{capitalizeFirstLetter(event.scoring.replaceAll('-', ' '))}</span> : null;
  }
  const rules = normalizeEventRules(event.rules, { scoring, maxPlayers: Number(event.maxPlayers) || 1 });
  const extras = [
    payoutRatioText(rules.payoutRatio),
    rules.usbcRequired ? 'USBC membership required' : null,
  ].filter(Boolean).join(' · ');
  return (
    <>
      <span className={styles.meta}>{eventRulesParts(rules, scoring).join(' · ')}</span>
      {rules.finals.type !== 'none' && rules.finals.notes.trim() ? <span className={styles.meta}>{rules.finals.notes}</span> : null}
      {extras ? <span className={styles.meta}>{extras}</span> : null}
    </>
  );
}

function divisionText(division: PublicInformation['divisions'][number]): string {
  return divisionLimitParts({ ...division, rules: division.rules ? normalizeDivisionRules(division.rules) : undefined }).join(' · ');
}
