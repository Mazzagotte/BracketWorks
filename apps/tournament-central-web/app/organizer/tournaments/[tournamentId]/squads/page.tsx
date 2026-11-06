'use client';

import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button, Card, CardHeader, DataTable, EmptyState, ICON_SIZE, Modal, Notice, Page, PageHeader } from '@bracketworks/ui';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { formatSquadTime, formatTournamentDate } from '@/components/organizer/organizerFormatting';
import { buildSquadSummaries } from '@/components/organizer/tournamentInsights';
import type { OrganizerRegistrationRecord } from '@/components/organizer/organizerApi';
import cells from '@/components/organizer/OrganizerTable.module.css';

function registrantName(registration: OrganizerRegistrationRecord): string {
  const name = `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim();
  return name || 'Unnamed bowler';
}

export default function OrganizerTournamentSquadsPage() {
  const {
    tournament, squads, registrations,
    isSetupLoading, isRegistrationsLoading,
    tournamentError, setupError, registrationsError,
  } = useTournamentContext();
  const isLoading = isSetupLoading || isRegistrationsLoading;
  const error = tournamentError || setupError || registrationsError;
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);

  const squadSummaries = useMemo(() => buildSquadSummaries(squads, registrations), [squads, registrations]);

  const selectedSummary = useMemo(
    () => squadSummaries.find((summary) => summary.squad.id === selectedSquadId) ?? null,
    [selectedSquadId, squadSummaries],
  );

  const selectedRoster = useMemo(() => {
    if (!selectedSummary) {
      return [];
    }

    return registrations.filter((registration) => {
      return (registration.entries ?? []).some((entry) =>
        entry.squad_config_id === selectedSummary.squad.id
        && ['pending', 'confirmed', 'waitlisted'].includes(entry.status));
    });
  }, [registrations, selectedSummary]);

  const empty = '—';

  return (
    <Page>
      <PageHeader
        title="Squads"
        description={`Registrations and bowlers for each squad of ${tournament?.name || 'this tournament'}. Capacity and availability are measured in bowler spots.`}
      />

      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
      {isLoading ? <Notice tone="info">Loading squads...</Notice> : null}

      {!error && !isLoading ? (
        <Card padding="flush" aria-label="Squad list">
          <CardHeader title="Squad list" description={`${squadSummaries.length} squad${squadSummaries.length === 1 ? '' : 's'}`} />
          {squadSummaries.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No squads yet"
              description="Add squads in tournament setup to start taking registrations."
            />
          ) : (
            <DataTable caption="Squads" className={cells.nowrap}>
              <thead>
                <tr>
                  <th scope="col">Squad</th>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">Location</th>
                  <th scope="col" data-align="right">Registrations</th>
                  <th scope="col" data-align="right">Bowlers</th>
                  <th scope="col" data-align="right">Bowler capacity</th>
                  <th scope="col" data-align="right">Bowler spots available</th>
                  <th scope="col" data-align="right">Waitlisted registrations</th>
                  <th scope="col" data-align="right">Waitlisted bowlers</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {squadSummaries.map(({ squad, registrationCount, bowlerCount, waitlistedRegistrationCount, waitlistedBowlerCount, availableBowlerSpots, status }) => (
                  <tr key={squad.id}>
                    <td className={cells.primaryText}>{squad.name}</td>
                    <td>{formatTournamentDate(squad.dateIso)}</td>
                    <td>{formatSquadTime(squad.startTime)}</td>
                    <td data-tone="secondary">{squad.locationName || 'Not set'}</td>
                    <td data-align="right">{registrationCount}</td>
                    <td data-align="right">{bowlerCount}</td>
                    <td data-align="right">{squad.capacity > 0 ? squad.capacity : empty}</td>
                    <td data-align="right">{availableBowlerSpots === null ? empty : availableBowlerSpots}</td>
                    <td data-align="right">{waitlistedRegistrationCount}</td>
                    <td data-align="right">{waitlistedBowlerCount}</td>
                    <td><OrganizerStatusBadge status={status} /></td>
                    <td data-align="right">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedSquadId(squad.id)} aria-label={`View roster for ${squad.name}`}>
                        View roster
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      ) : null}

      <Modal
        open={Boolean(selectedSummary)}
        onClose={() => setSelectedSquadId(null)}
        title={selectedSummary ? `${selectedSummary.squad.name} roster` : 'Squad roster'}
        description={selectedSummary ? `${selectedRoster.length} registration${selectedRoster.length === 1 ? '' : 's'} in this squad` : undefined}
        size="lg"
        closeLabel="Close roster"
      >
        {selectedRoster.length === 0 ? (
          <p className={cells.secondaryText}>No registrations are assigned to this squad yet.</p>
        ) : (
          <DataTable caption="Squad roster" className={cells.nowrap}>
            <thead>
              <tr>
                <th scope="col">Registrant</th>
                <th scope="col">Email</th>
                <th scope="col">Payment</th>
              </tr>
            </thead>
            <tbody>
              {selectedRoster.map((registration) => (
                <tr key={registration.id}>
                  <td className={cells.primaryText}>{registrantName(registration)}</td>
                  <td data-tone="secondary">{registration.contact_email ?? registration.form?.email ?? 'No email'}</td>
                  <td><OrganizerStatusBadge status={registration.payment_status === 'paid' ? 'paid' : 'unpaid'} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Modal>
    </Page>
  );
}
