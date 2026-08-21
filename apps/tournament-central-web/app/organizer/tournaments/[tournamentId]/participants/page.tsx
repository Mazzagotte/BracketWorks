'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import { buildParticipantRows } from '@/components/organizer/tournamentInsights';
import styles from '../page.module.css';

export default function OrganizerTournamentParticipantsPage() {
  const { tournamentId, tournament, registrations, isRegistrationsLoading, tournamentError, registrationsError } = useTournamentContext();
  const error = tournamentError || registrationsError;
  const [search, setSearch] = useState('');

  const participants = useMemo(() => buildParticipantRows(registrations), [registrations]);

  const filteredParticipants = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return participants;
    }

    return participants.filter((participant) => {
      const haystack = [
        participant.firstName,
        participant.lastName,
        participant.usbcNumber ?? '',
        participant.email ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [participants, search]);

  return (
    <main className={styles.registrationPage}>
      <header className={styles.registrationHeader}>
        <div>
          <h1>Participants</h1>
          <p>{tournament?.name || 'Tournament'}</p>
        </div>
        <Link href={organizerRoutes.overview(tournamentId)} className={styles.registrationBackButton}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Overview
        </Link>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {isRegistrationsLoading ? <section className={styles.registrationLoading}>Loading participants...</section> : null}

      {!error && !isRegistrationsLoading ? (
        <section className={styles.registrationTableCard} aria-label="Participant list">
          <div className={styles.registrationPanelHeading}>
            <h2>Participant List</h2>
          </div>
          <div className={styles.registrationToolbar}>
            <label className={styles.registrationSearch}>
              <Search size={14} aria-hidden="true" />
              <span className={styles.srOnly}>Search participants</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, USBC number, or email..."
              />
            </label>
          </div>

          {filteredParticipants.length === 0 ? (
            <p className={styles.emptyRegistrations}>
              {search.trim() ? 'No participants match your search.' : 'No participants have registered yet.'}
            </p>
          ) : (
            <div className={styles.registrationTableWrap}>
              <table className={styles.registrationTable}>
                <thead>
                  <tr>
                    <th>Bowler</th>
                    <th>USBC #</th>
                    <th>Average</th>
                    <th>Events</th>
                    <th>Divisions</th>
                    <th>Squads</th>
                    <th>Entries</th>
                    <th>Payment</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant) => (
                    <tr key={participant.key}>
                      <td><strong>{`${participant.firstName} ${participant.lastName}`.trim()}</strong></td>
                      <td>{participant.usbcNumber || '\u2014'}</td>
                      <td>{participant.average ?? '\u2014'}</td>
                      <td>{participant.events.join(', ') || '\u2014'}</td>
                      <td>{participant.divisions.join(', ') || '\u2014'}</td>
                      <td>{participant.squads.join(', ') || '\u2014'}</td>
                      <td>{participant.entryCount}</td>
                      <td>
                        <OrganizerStatusBadge status={participant.paymentStatus} />
                      </td>
                      <td><span>{participant.email || participant.phone || '\u2014'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
