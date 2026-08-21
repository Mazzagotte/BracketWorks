'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { formatSquadTime, formatTournamentDate } from '@/components/organizer/organizerFormatting';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import { buildSquadSummaries } from '@/components/organizer/tournamentInsights';
import type { OrganizerRegistrationRecord } from '@/components/organizer/organizerApi';
import styles from './page.module.css';

function registrantName(registration: OrganizerRegistrationRecord): string {
  const name = `${registration.contact_first_name ?? registration.form?.first_name ?? ''} ${registration.contact_last_name ?? registration.form?.last_name ?? ''}`.trim();
  return name || 'Unnamed bowler';
}

export default function OrganizerTournamentSquadsPage() {
  const { tournamentId, tournament, squads, registrations, isLoading, error } = useTournamentContext();
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
      const status = registration.status ?? 'pending';
      if (status === 'cancelled' || status === 'refunded') {
        return false;
      }
      return (registration.entries ?? []).some((entry) => entry.squad_config_id === selectedSummary.squad.id);
    });
  }, [registrations, selectedSummary]);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Squads</h1>
          <p>{tournament?.name || 'Tournament'}</p>
        </div>
        <Link href={organizerRoutes.overview(tournamentId)} className={styles.backButton}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Overview
        </Link>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {isLoading ? <section className={styles.loading}>Loading squads...</section> : null}

      {!error && !isLoading ? (
        <section className={styles.tableCard} aria-label="Squad list">
          {squadSummaries.length === 0 ? (
            <p className={styles.empty}>No squads are configured for this tournament yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Squad</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Registered</th>
                    <th>Capacity</th>
                    <th>Available</th>
                    <th>Waitlist</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {squadSummaries.map(({ squad, registered, waitlisted, available, status }) => (
                    <tr
                      key={squad.id}
                      onClick={() => setSelectedSquadId(squad.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View roster for ${squad.name}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedSquadId(squad.id);
                        }
                      }}
                    >
                      <td>{squad.name}</td>
                      <td>{formatTournamentDate(squad.dateIso)}</td>
                      <td>{formatSquadTime(squad.startTime)}</td>
                      <td>{squad.locationName || 'Not set'}</td>
                      <td>{registered}</td>
                      <td>{squad.capacity > 0 ? squad.capacity : '\u2014'}</td>
                      <td>{available === null ? '\u2014' : available}</td>
                      <td>{waitlisted}</td>
                      <td><OrganizerStatusBadge status={status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {selectedSummary ? (
        <div className={styles.rosterBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSquadId(null); }}>
          <section className={styles.rosterModal} role="dialog" aria-modal="true" aria-label={`${selectedSummary.squad.name} roster`}>
            <header>
              <div>
                <span>Squad Roster</span>
                <h2>{selectedSummary.squad.name}</h2>
              </div>
              <button type="button" className={styles.rosterModalClose} onClick={() => setSelectedSquadId(null)} aria-label="Close roster">
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className={styles.rosterList}>
              {selectedRoster.length === 0 ? (
                <p className={styles.rosterEmpty}>No registrations are assigned to this squad yet.</p>
              ) : (
                selectedRoster.map((registration) => (
                  <div key={registration.id} className={styles.rosterRow}>
                    <strong>{registrantName(registration)}</strong>
                    <span>{registration.contact_email ?? registration.form?.email ?? 'No email'}</span>
                    <span>{registration.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
