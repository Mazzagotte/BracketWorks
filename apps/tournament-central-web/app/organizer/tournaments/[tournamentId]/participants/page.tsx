'use client';

import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { Card, CardHeader, DataTable, EmptyState, ICON_SIZE, Notice, Page, PageHeader, SearchField, TableToolbar } from '@bracketworks/ui';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { buildParticipantRows } from '@/components/organizer/tournamentInsights';
import cells from '@/components/organizer/OrganizerTable.module.css';

export default function OrganizerTournamentParticipantsPage() {
  const { tournament, registrations, isRegistrationsLoading, tournamentError, registrationsError } = useTournamentContext();
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

  const empty = '—';

  return (
    <Page>
      <PageHeader
        title="Participants"
        description={`Every bowler registered for ${tournament?.name || 'this tournament'}, with their events and payment status.`}
      />

      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
      {isRegistrationsLoading ? <Notice tone="info">Loading participants...</Notice> : null}

      {!error && !isRegistrationsLoading ? (
        <Card padding="flush" aria-label="Participant list">
          <CardHeader title="Participant list" description={`${filteredParticipants.length} of ${participants.length} bowlers shown`} />
          <TableToolbar
            search={(
              <SearchField
                label="Search participants"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, USBC number, or email"
              />
            )}
          />
          {filteredParticipants.length === 0 ? (
            <EmptyState
              icon={<Users size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title={search.trim() ? 'No participants match your search' : 'No participants yet'}
              description={search.trim() ? 'Try a different name, USBC number, or email.' : 'Bowlers appear here once they register.'}
            />
          ) : (
            <DataTable caption="Participants" className={cells.nowrap}>
              <thead>
                <tr>
                  <th scope="col">Bowler</th>
                  <th scope="col">USBC number</th>
                  <th scope="col" data-align="right">Average</th>
                  <th scope="col">Events</th>
                  <th scope="col">Divisions</th>
                  <th scope="col">Squads</th>
                  <th scope="col" data-align="right">Entries</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Contact</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr key={participant.key}>
                    <td className={cells.primaryText}>{`${participant.firstName} ${participant.lastName}`.trim()}</td>
                    <td className={cells.code}>{participant.usbcNumber || empty}</td>
                    <td data-align="right">{participant.average ?? empty}</td>
                    <td>{participant.events.join(', ') || empty}</td>
                    <td>{participant.divisions.join(', ') || empty}</td>
                    <td>{participant.squads.join(', ') || empty}</td>
                    <td data-align="right">{participant.entryCount}</td>
                    <td><OrganizerStatusBadge status={participant.paymentStatus} /></td>
                    <td data-tone="secondary">{participant.email || participant.phone || empty}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      ) : null}
    </Page>
  );
}
