'use client';

import { useEffect, useState } from 'react';
import { formatTournamentDate } from '@/lib/tournamentDates';
import { formatMoney, formatSquadTime } from '@/components/organizer/organizerFormatting';
import styles from '@/app/page.module.css';

type PublicInformation = {
  details: {
    tournamentType?: string; organizer?: string; contactName?: string; supportEmail?: string;
    supportPhone?: string; contactNote?: string; registrationCloseIso?: string;
    registrationCloseTime?: string; timezone?: string;
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

  return <div className={styles.tournamentInformation}>
    <dl>
      {details.tournamentType && <><dt>Tournament type</dt><dd>{details.tournamentType}</dd></>}
      {prices.length > 0 && <><dt>Entry fee</dt><dd>From {formatMoney(Math.min(...prices))}</dd></>}
      {details.registrationCloseIso && <><dt>Registration deadline</dt><dd>{formatTournamentDate(details.registrationCloseIso)}{details.registrationCloseTime ? ` at ${formatSquadTime(details.registrationCloseTime)}` : ''}{details.timezone ? ` (${details.timezone})` : ''}</dd></>}
      {(details.organizer || details.contactName || details.supportEmail || details.supportPhone) && <>
        <dt>Organizer contact</dt>
        <dd>
          {[details.organizer, details.contactName].filter(Boolean).join(' - ')}
          {details.supportEmail && <a href={`mailto:${details.supportEmail}`}>{details.supportEmail}</a>}
          {details.supportPhone && <a href={`tel:${details.supportPhone}`}>{details.supportPhone}</a>}
          {details.contactNote && <p>{details.contactNote}</p>}
        </dd>
      </>}
    </dl>
    {events.length > 0 ? <section><h3>Events and format</h3><ul>{events.map((event) => <li key={event.id}>
      <strong>{event.name}</strong>{event.scoring ? ` - ${event.scoring}` : ''}{typeof event.entryFeeCents === 'number' ? ` - ${formatMoney(event.entryFeeCents)}` : ''}
      {event.description && <p>{event.description}</p>}
    </li>)}</ul></section> : <p>Event and format details have not been provided.</p>}
    {divisions.length > 0 && <section><h3>Divisions</h3><ul>{divisions.map((division) => <li key={division.id}>{division.name}{division.eligibilityNotes && <p>{division.eligibilityNotes}</p>}</li>)}</ul></section>}
    {squads.length > 0 ? <section><h3>Squad times and availability</h3><ul>{squads.map((squad) => <li key={squad.id}>
      <strong>{squad.name}</strong>
      {squad.dateIso ? ` - ${formatTournamentDate(squad.dateIso)}` : ''}
      {squad.startTime ? ` at ${formatSquadTime(squad.startTime)}` : ''}
      {typeof squad.capacity === 'number' && squad.capacity > 0 && typeof squad.registeredCount === 'number'
        ? ` - ${Math.max(0, squad.capacity - squad.registeredCount)} of ${squad.capacity} spots remaining`
        : ' - Contact the organizer for availability'}
    </li>)}</ul></section> : <p>Squad times have not been announced.</p>}
    {documents.length > 0 ? <section><h3>Rules and documents</h3><ul>{documents.map((document) => <li key={document.url}>
      <a href={document.url} download>{document.name} ({document.kind.replaceAll('_', ' ')})</a>
    </li>)}</ul></section> : <p>Rules and documents have not been posted.</p>}
  </div>;
}
