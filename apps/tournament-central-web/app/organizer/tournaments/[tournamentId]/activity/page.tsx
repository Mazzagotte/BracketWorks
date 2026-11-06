'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { ActivityList, Button, Card, CardHeader, EmptyState, ICON_SIZE, Notice, Page, PageHeader } from '@bracketworks/ui';

import { listTournamentActivity, type TournamentActivityEntry } from '@/components/organizer/organizerApi';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import styles from './activity.module.css';

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
    <Page width="narrow">
      <PageHeader title="Activity" description={`Recent changes and events for ${tournamentName}.`} />

      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
      {isLoading ? <Notice tone="info">Loading activity...</Notice> : null}

      {!isLoading && !error ? (
        <Card aria-label="Activity log">
          <CardHeader title="Recent activity" description={`${entries.length} event${entries.length === 1 ? '' : 's'} shown`} />
          {entries.length === 0 ? (
            <EmptyState
              icon={<History size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No activity yet"
              description="Changes to setup, registrations, and payments are recorded here."
            />
          ) : (
            <ActivityList
              items={entries.map((entry) => ({
                id: String(entry.id),
                title: entry.summary,
                time: formatActivityTimestamp(entry.created_at),
                detail: entry.user_display_name || undefined,
              }))}
            />
          )}
          {hasMore && entries.length > 0 ? (
            <div className={styles.loadMore}>
              <Button variant="secondary" size="sm" onClick={() => { void loadMore(); }} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </Page>
  );
}
