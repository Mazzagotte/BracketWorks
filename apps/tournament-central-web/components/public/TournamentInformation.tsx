'use client';

import { useEffect, useState } from 'react';
import { formatTournamentDate, parseTournamentDate } from '@/lib/tournamentDates';
import { formatMoney, formatSquadTime } from '@/components/organizer/organizerFormatting';
import styles from '@/app/page.module.css';
import TournamentRules from './TournamentRules';

type PublicInformation = {
  details: {
    tournamentType?: string; organizer?: string; contactName?: string; supportEmail?: string;
    supportPhone?: string; contactNote?: string; registrationCloseIso?: string;
    registrationCloseTime?: string; timezone?: string;
    rulesText?: string;
  };
  events: Array<{ id: string; name: string; scoring?: string; description?: string; entryFeeCents?: number }>;
  divisions: Array<{ id: string; name: string; eligibilityNotes?: string }>;
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

  if (error) return <div role="alert">{error} <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>;
  if (!configUrl) return <p>Additional tournament information has not been provided. Contact the organizer before registering.</p>;
  if (!information) return <p role="status">Loading tournament information...</p>;
  const details = information.details ?? {};
  const events = information.events ?? [];
  const divisions = information.divisions ?? [];
  const squads = information.squads ?? [];
  const documents = information.documents ?? [];
  const prices = events.flatMap((event) => typeof event.entryFeeCents === 'number' ? [event.entryFeeCents] : []);
  const organizerNames = [...new Set([details.organizer, details.contactName].map((name) => name?.trim()).filter(Boolean))];

  return <div className={styles.tournamentInformation}>
    <dl className={styles.informationHighlights}>
      {details.tournamentType && <div><dt>Tournament type</dt><dd>{details.tournamentType}</dd></div>}
      {prices.length > 0 && <div><dt>Entry fee</dt><dd>From {formatMoney(Math.min(...prices))}</dd></div>}
      {details.registrationCloseIso && <div className={styles.informationDeadline}><dt>Registration deadline</dt><dd>
        {formatTournamentDate(details.registrationCloseIso)}{details.registrationCloseTime ? ` at ${formatSquadTime(details.registrationCloseTime)}` : ''}
        {details.timezone && <small>{details.timezone.replaceAll('_', ' ')}</small>}
      </dd></div>}
    </dl>
    {events.length > 0 ? <section className={styles.informationSection}><h3>Events and format</h3><ul className={styles.informationEventList}>{events.map((event) => <li key={event.id}>
      <div className={styles.informationEventHeading}>
        <strong>{event.name}</strong>
        {typeof event.entryFeeCents === 'number' && <span className={styles.informationEventPrice}>{formatMoney(event.entryFeeCents)}</span>}
      </div>
      {event.scoring && <span className={styles.informationScoring}>{event.scoring.replaceAll('-', ' ')}</span>}
      {event.description && <p>{event.description}</p>}
    </li>)}</ul></section> : <p className={styles.informationEmpty}>Event and format details have not been provided.</p>}
    {divisions.length > 0 && <section className={styles.informationSection}><h3>Divisions</h3><ul className={styles.informationDivisionList}>{divisions.map((division) => <li key={division.id}><strong>{division.name}</strong>{division.eligibilityNotes && <p>{division.eligibilityNotes}</p>}</li>)}</ul></section>}
    {squads.length > 0 ? <section className={styles.informationSection}>
      <div className={styles.informationSectionHeading}><h3>Squad times and availability</h3><span>{`${squads.length} ${squads.length === 1 ? 'squad' : 'squads'}`}</span></div>
      <ul className={styles.informationSquadList}>{squads.map((squad) => {
        const availability = typeof squad.capacity === 'number' && squad.capacity > 0 && typeof squad.registeredCount === 'number'
          ? { capacity: squad.capacity, bowlers: squad.registeredCount, remaining: Math.max(0, squad.capacity - squad.registeredCount) }
          : null;
        const date = parseTournamentDate(squad.dateIso);
        const fullDate = date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const scheduleIsInName = fullDate && squad.startTime
          && squad.name === `${fullDate} - ${formatSquadTime(squad.startTime)}`;
        return <li key={squad.id} className={styles.informationSquadCard}>
          <div className={styles.informationSquadHeading}>
            <strong>{squad.name}</strong>
            {availability && <span className={availability.remaining > 0 ? styles.informationAvailability : styles.informationFull}>{availability.remaining > 0 ? 'Spots available' : 'Full'}</span>}
          </div>
          {!scheduleIsInName && (squad.dateIso || squad.startTime) && <p className={styles.informationSquadSchedule}>
            {squad.dateIso ? formatTournamentDate(squad.dateIso) : ''}
            {squad.dateIso && squad.startTime ? ' at ' : ''}
            {squad.startTime ? formatSquadTime(squad.startTime) : ''}
          </p>}
          {availability ? <div className={styles.informationSquadCapacity}>
            <p><strong>{availability.remaining}</strong> of {availability.capacity} bowler spots remaining</p>
            <span>{`${availability.bowlers} ${availability.bowlers === 1 ? 'bowler' : 'bowlers'} registered`}</span>
          </div> : <p className={styles.informationEmpty}>Contact the organizer for availability</p>}
        </li>;
      })}</ul>
    </section> : <p className={styles.informationEmpty}>Squad times have not been announced.</p>}
    {(organizerNames.length > 0 || details.supportEmail || details.supportPhone) && <section className={styles.informationSection}>
      <h3>Organizer contact</h3>
      <div className={styles.informationContact}>
          {organizerNames.length > 0 && <strong>{organizerNames.join(' - ')}</strong>}
          {details.supportEmail && <a href={`mailto:${details.supportEmail}`}>{details.supportEmail}</a>}
          {details.supportPhone && <a href={`tel:${details.supportPhone}`}>{details.supportPhone}</a>}
          {details.contactNote && <p>{details.contactNote}</p>}
      </div>
    </section>}
    <TournamentRules rulesText={details.rulesText} documents={documents} />
  </div>;
}
