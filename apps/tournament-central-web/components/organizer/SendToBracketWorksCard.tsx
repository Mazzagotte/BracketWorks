'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Send } from 'lucide-react';
import {
  Button,
  ButtonLink,
  Card,
  CardDivider,
  CardHeader,
  CheckboxField,
  ICON_SIZE,
  Modal,
  Notice,
} from '@bracketworks/ui';

import {
  BRACKETWORKS_URL,
  getBracketWorksLink,
  syncToBracketWorks,
  type BracketWorksLinkStatus,
  type BracketWorksSyncSummary,
} from './bracketworksApi';
import { formatRegistrationTimestamp } from './organizerFormatting';
import styles from './SendToBracketWorksCard.module.css';

function getAccessToken(): string {
  const token = typeof window === 'undefined' ? null : sessionStorage.getItem('access_token');
  if (!token) throw new Error('Your session expired. Please sign in again.');
  return token;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function sendCount(summary: BracketWorksSyncSummary): number {
  return summary.players_created + summary.players_updated;
}

function PreviewDetails({ summary }: { summary: BracketWorksSyncSummary }) {
  const rows = [
    { label: 'New bowlers', value: summary.players_created },
    { label: 'Updated bowlers', value: summary.players_updated },
    { label: 'Already up to date', value: summary.unchanged },
    { label: 'New squads', value: summary.squads_created },
  ];

  return (
    <>
      {summary.created_tournament ? (
        <p className={styles.body}>
          This creates a private BracketWorks tournament named {summary.bw_tournament_name} and links it to this tournament.
        </p>
      ) : null}
      <dl className={styles.rows} aria-label="What will be sent">
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt>{row.label}</dt>
            <dd className={styles.count}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {summary.skipped.length > 0 ? (
        <>
          <CardDivider />
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>Skipped ({summary.skipped.length})</h3>
            <ul className={styles.list} aria-label="Skipped bowlers">
              {summary.skipped.map((item) => (
                <li key={`${item.name}-${item.reason}`}><strong>{item.name}</strong>: {item.reason}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {summary.possible_duplicates.length > 0 ? (
        <>
          <CardDivider />
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>Possible duplicates ({summary.possible_duplicates.length})</h3>
            <p className={styles.body}>
              These bowlers were already added by hand in BracketWorks, so they will not be added again.
            </p>
            <ul className={styles.list} aria-label="Possible duplicates">
              {summary.possible_duplicates.map((item) => (
                <li key={`${item.bw_player_id}-${item.name}`}>
                  <strong>{item.name}</strong> matches {item.bw_name} in {item.squad}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {summary.not_in_tc.length > 0 ? (
        <>
          <CardDivider />
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>No longer registered ({summary.not_in_tc.length})</h3>
            <p className={styles.body}>
              These bowlers are in BracketWorks but no longer registered here. They stay in BracketWorks; remove them there if needed.
            </p>
            <ul className={styles.list} aria-label="No longer registered">
              {summary.not_in_tc.map((item) => (
                <li key={item.bw_player_id}><strong>{item.name}</strong></li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {summary.squads_needing_regeneration.length > 0 ? (
        <Notice tone="warning">
          Brackets already exist for {summary.squads_needing_regeneration.map((squad) => squad.label).join(', ')}.
          After sending, regenerate them in BracketWorks.
        </Notice>
      ) : null}
    </>
  );
}

export default function SendToBracketWorksCard({ tournamentId }: { tournamentId: number }) {
  const [link, setLink] = useState<BracketWorksLinkStatus | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [includePending, setIncludePending] = useState(false);
  const [preview, setPreview] = useState<BracketWorksSyncSummary | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<BracketWorksSyncSummary | null>(null);

  const loadLink = useCallback(async () => {
    try {
      setLink(await getBracketWorksLink(getAccessToken(), tournamentId));
      setLinkError(null);
    } catch (error) {
      setLinkError(errorMessage(error, 'Could not load the BracketWorks link.'));
    }
  }, [tournamentId]);

  useEffect(() => {
    void loadLink();
  }, [loadLink]);

  const runPreview = useCallback(async (withPending: boolean) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      setPreview(await syncToBracketWorks(getAccessToken(), tournamentId, { dryRun: true, includePending: withPending }));
    } catch (error) {
      setPreview(null);
      setPreviewError(errorMessage(error, 'Could not prepare the preview.'));
    } finally {
      setIsPreviewLoading(false);
    }
  }, [tournamentId]);

  const openPreview = () => {
    setResult(null);
    setIsModalOpen(true);
    void runPreview(includePending);
  };

  const closePreview = () => {
    if (isSending) return;
    setIsModalOpen(false);
    setPreview(null);
    setPreviewError(null);
  };

  const togglePending = (checked: boolean) => {
    setIncludePending(checked);
    void runPreview(checked);
  };

  const send = async () => {
    setIsSending(true);
    setPreviewError(null);
    try {
      const summary = await syncToBracketWorks(getAccessToken(), tournamentId, { dryRun: false, includePending });
      setResult(summary);
      setIsModalOpen(false);
      setPreview(null);
      await loadLink();
    } catch (error) {
      setPreviewError(errorMessage(error, 'Could not send bowlers to BracketWorks.'));
    } finally {
      setIsSending(false);
    }
  };

  const isLinked = Boolean(link?.linked);
  const count = preview ? sendCount(preview) : 0;
  const canSend = Boolean(preview) && !isPreviewLoading && (count > 0 || Boolean(preview?.created_tournament));
  const sendLabel = isSending ? 'Sending...' : count > 0 ? `Send ${plural(count, 'bowler')}` : isLinked ? 'Nothing to send' : 'Create tournament';

  return (
    <Card aria-label="BracketWorks">
      <CardHeader title="BracketWorks" />
      <div className={styles.stack}>
        {linkError ? <Notice tone="danger" role="alert">{linkError}</Notice> : null}

        {result ? (
          <Notice tone="success" role="status">
            Sent to BracketWorks: {plural(result.players_created, 'new bowler')}, {plural(result.players_updated, 'update')}.
          </Notice>
        ) : null}
        {result && result.squads_needing_regeneration.length > 0 ? (
          <Notice tone="warning">
            Brackets in BracketWorks are out of date for: {result.squads_needing_regeneration.map((squad) => squad.label).join(', ')}.
            Regenerate them in BracketWorks.
          </Notice>
        ) : null}

        {isLinked && link ? (
          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt>Linked to</dt>
              <dd>{link.bw_tournament_name || 'BracketWorks tournament'}</dd>
            </div>
            <div className={styles.row}>
              <dt>Last sent</dt>
              <dd>{formatRegistrationTimestamp(link.last_synced_at, 'Not sent yet')}</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.body}>
            Bring your registered bowlers into BracketWorks to run brackets, scores, and payouts.
          </p>
        )}

        {link ? (
          <div className={styles.actions}>
            {isLinked ? (
              <>
                <Button variant="secondary" icon={<Send size={ICON_SIZE.md} aria-hidden="true" />} onClick={openPreview}>
                  Send updates
                </Button>
                <ButtonLink
                  href={BRACKETWORKS_URL}
                  variant="ghost"
                  target="_blank"
                  rel="noreferrer"
                  icon={<ExternalLink size={ICON_SIZE.md} aria-hidden="true" />}
                  aria-label="Open in BracketWorks (opens in a new tab)"
                >
                  Open in BracketWorks
                </ButtonLink>
              </>
            ) : (
              <Button variant="primary" icon={<Send size={ICON_SIZE.md} aria-hidden="true" />} onClick={openPreview}>
                Send to BracketWorks
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <Modal
        open={isModalOpen}
        onClose={closePreview}
        title={isLinked ? 'Send updates to BracketWorks' : 'Send to BracketWorks'}
        description="Review what will change before anything is sent."
        dismissible={!isSending}
        footer={
          <>
            <Button variant="secondary" onClick={closePreview} disabled={isSending}>Cancel</Button>
            <Button variant="primary" onClick={() => void send()} disabled={!canSend || isSending}>
              {sendLabel}
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          <CheckboxField
            label="Include pending registrations"
            helper="Confirmed registrations are always included. Cancelled and waitlisted ones never are."
            checked={includePending}
            disabled={isPreviewLoading || isSending}
            onChange={(event) => togglePending(event.target.checked)}
          />
          {previewError ? <Notice tone="danger" role="alert">{previewError}</Notice> : null}
          {isPreviewLoading ? <p className={styles.body} role="status">Checking what will change...</p> : null}
          {preview && !isPreviewLoading ? <PreviewDetails summary={preview} /> : null}
        </div>
      </Modal>
    </Card>
  );
}
