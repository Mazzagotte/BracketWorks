'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { listTournamentActivity, type TournamentActivityEntry } from '@/components/organizer/organizerApi';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import styles from '../page.module.css';

const PAGE_SIZE = 25;

function formatActivityTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OrganizerTournamentActivityPage() {
  const { tournamentId, tournament } = useTournamentContext();
  const tournamentName = tournament?.name || 'Tournament';
  const [entries, setEntries] = useState<TournamentActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setIsLoading(true);
    setError(null);
    listTournamentActivity(token, tournamentId, { limit: PAGE_SIZE, offset: 0 })
      .then((rows) => {
        setEntries(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : 'Unable to load activity.'))
      .finally(() => setIsLoading(false));
  }, [tournamentId]);

  const loadMore = async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setIsLoadingMore(true);
    try {
      const rows = await listTournamentActivity(token, tournamentId, { limit: PAGE_SIZE, offset: entries.length });
      setEntries((current) => [...current, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load more activity.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <main className={styles.registrationPage}>
      <header className={styles.registrationHeader}>
        <div>
          <span className={styles.registrationEyebrow}>Tournament activity</span>
          <h1>Activity</h1>
          <p>Recent changes and events for {tournamentName}.</p>
        </div>
        <Link href={organizerRoutes.overview(tournamentId)} className={styles.registrationBackButton}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Overview
        </Link>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {isLoading ? <section className={styles.registrationLoading}>Loading activity...</section> : null}

      {!isLoading && !error ? (
        <section className={styles.registrationTableCard} aria-label="Activity log">
          <div className={styles.registrationPanelHeading}>
            <div>
              <h2>Recent Activity</h2>
              <p>{entries.length} event{entries.length === 1 ? '' : 's'} shown</p>
            </div>
          </div>
          {entries.length === 0 ? (
            <p className={styles.emptyRegistrations}>No activity recorded yet.</p>
          ) : (
            <ul className={styles.tournamentAttentionList} aria-label="Activity entries">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <span>
                    <strong>{entry.summary}</strong>
                    {entry.user_display_name ? ` \u2014 ${entry.user_display_name}` : ''}
                  </span>
                  <span>{formatActivityTimestamp(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
          {hasMore ? (
            <footer className={styles.registrationPagination}>
              <button type="button" className={styles.registrationBackButton} onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            </footer>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
