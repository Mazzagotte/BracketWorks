'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, MoreHorizontal, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Card, CardDivider, CardHeader, ICON_SIZE, Menu, MenuItem, Notice, TextAreaField } from '@bracketworks/ui';
import {
  deleteTournamentDocument,
  downloadTournamentDocument,
  listTournamentDocuments,
  uploadTournamentDocument,
  type TournamentDocumentRecord,
} from '../organizerApi';
import { formatFileSize } from '../setupFormatting';
import { useConfirmation } from '../useConfirmation';
import layout from './setupLayout.module.css';
import local from './RulesDocumentsSection.module.css';

type Props = {
  tournamentId: number | null;
  rulesText: string;
  onRulesTextChange: (text: string) => void;
  onHasRulesDocumentChange: (hasDocument: boolean) => void;
};

function accessToken(): string {
  const token = sessionStorage.getItem('access_token');
  if (!token) throw new Error('Your session expired. Please sign in again.');
  return token;
}

export default function RulesDocumentsSection({ tournamentId, rulesText, onRulesTextChange, onHasRulesDocumentChange }: Props) {
  const [documents, setDocuments] = useState<TournamentDocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(tournamentId));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(true);
  const { confirm, confirmationDialog } = useConfirmation();

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!tournamentId) return;
    setIsLoading(true);
    setLoadError('');
    void (async () => {
      try {
        const records = await listTournamentDocuments(accessToken(), tournamentId);
        if (!cancelled) {
          const rules = records.filter((document) => document.doc_type === 'rules');
          setDocuments(rules);
          onHasRulesDocumentChange(rules.length > 0);
        }
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Unable to load rules documents.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tournamentId, loadAttempt, onHasRulesDocumentChange]);

  const runDocumentAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (cause) {
      if (activeRef.current) setError(cause instanceof Error ? cause.message : 'Unable to update rules documents.');
    } finally {
      if (activeRef.current) setBusy(false);
    }
  };

  const upload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a rules document to upload.');
      return;
    }
    if (!tournamentId) {
      setError('Save the tournament draft before uploading a document.');
      return;
    }
    if (file.size === 0 || file.size > 20 * 1024 * 1024) {
      setError(file.size === 0 ? 'The selected file is empty.' : 'Document exceeds the 20 MB size limit.');
      return;
    }
    void runDocumentAction(async () => {
      const document = await uploadTournamentDocument(accessToken(), tournamentId, file, 'rules');
      if (!activeRef.current) return;
      setDocuments((current) => [document, ...current]);
      onHasRulesDocumentChange(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setMessage(`Uploaded ${document.file_name}.`);
    });
  };

  const remove = async (document: TournamentDocumentRecord) => {
    if (!tournamentId || busy || !await confirm({
      title: 'Remove rules document?',
      message: `Remove "${document.file_name}"? This cannot be undone.`,
      confirmLabel: 'Remove document',
      tone: 'danger',
    })) return;
    void runDocumentAction(async () => {
      await deleteTournamentDocument(accessToken(), tournamentId, document.id);
      if (!activeRef.current) return;
      const remaining = documents.filter((record) => record.id !== document.id);
      setDocuments(remaining);
      onHasRulesDocumentChange(remaining.length > 0);
      setMessage(`Removed ${document.file_name}.`);
    });
  };

  const download = (document: TournamentDocumentRecord) => {
    if (!tournamentId) {
      setError('Save the tournament draft before downloading a document.');
      return;
    }
    void runDocumentAction(() => downloadTournamentDocument(accessToken(), tournamentId, document));
  };

  const hasRules = Boolean(rulesText.trim() || documents.length);
  const controlsDisabled = !tournamentId || busy || isLoading || Boolean(loadError);

  return (
    <Card aria-labelledby="rules-documents-heading">
      {confirmationDialog}
      <CardHeader
        title={<span id="rules-documents-heading">Rules and documents</span>}
        description="Paste your rules, upload a document, or both. Bowlers can review them before registering."
        headingLevel="h3"
        actions={<Badge tone={hasRules ? 'success' : 'neutral'}>{hasRules ? 'Rules added' : 'Optional'}</Badge>}
      />
      <div className={layout.stack}>
        <TextAreaField
          id="tournament-rules-text"
          label="Write or paste rules"
          rows={10}
          value={rulesText}
          onChange={(event) => onRulesTextChange(event.target.value)}
          placeholder={'Paste tournament rules here...\n\nInclude eligibility, format, check-in times, and policies.'}
          helper="Plain text; line breaks are kept. Save to keep your rules, then publish to make text changes public."
        />
        {rulesText.trim() ? (
          <details className={local.preview}>
            <summary>Preview pasted rules</summary>
            <div>{rulesText}</div>
          </details>
        ) : null}

        <CardDivider />

        <div className={layout.fieldGroup}>
          <h4 className={layout.subsectionTitle}>Upload rules documents</h4>
          <p className={layout.helper}>
            PDF, Word (DOC or DOCX), PNG, or JPG, up to 20 MB each. Files are saved right away and shown once the tournament is public and published.
          </p>
        </div>
        {!tournamentId ? <Notice tone="info">Save the draft to create the tournament before uploading a document. You can paste rules above now.</Notice> : null}
        {loadError ? (
          <Notice tone="danger" role="alert" action={<Button size="sm" variant="ghost" onClick={() => setLoadAttempt((value) => value + 1)}>Try again</Button>}>
            {loadError}
          </Notice>
        ) : null}
        {isLoading ? <p className={layout.helper} role="status">Loading rules documents...</p> : null}

        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Rules document"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
            setError('');
            setMessage('');
          }}
          disabled={controlsDisabled}
        />
        <div className={local.picker}>
          <div className={local.pickerText} aria-live="polite">
            <span className={local.pickerName}>{selectedFile ? selectedFile.name : 'Choose a rules document'}</span>
            <span className={layout.helper}>{selectedFile ? `${formatFileSize(selectedFile.size)} - Ready to upload` : 'PDF, Word, or image, up to 20 MB'}</span>
          </div>
          <div className={local.pickerActions}>
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={controlsDisabled}>
              {selectedFile ? 'Change file' : 'Browse files'}
            </Button>
            <Button size="sm" variant="secondary" icon={<Upload size={ICON_SIZE.md} aria-hidden="true" />} onClick={upload} disabled={controlsDisabled}>
              {busy ? 'Working...' : 'Upload document'}
            </Button>
          </div>
        </div>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        {message ? <p role="status" className={layout.helper}>{message}</p> : null}
        {!isLoading && !loadError && documents.length === 0 ? <p className={layout.helper}>No rules documents uploaded.</p> : null}
        {documents.length > 0 ? (
          <ul className={layout.rows}>
            {documents.map((document) => (
              <li key={document.id} className={layout.row}>
                <div className={layout.rowText}>
                  <span className={layout.rowTitle}>{document.file_name}</span>
                  <span className={layout.rowMeta}>{formatFileSize(document.file_size)}</span>
                </div>
                <div className={layout.rowActions}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download size={ICON_SIZE.md} aria-hidden="true" />}
                    disabled={busy}
                    aria-label={`Download ${document.file_name}`}
                    onClick={() => download(document)}
                  >
                    Download
                  </Button>
                  <Menu triggerLabel={`More actions for ${document.file_name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                    <MenuItem
                      tone="danger"
                      icon={<Trash2 size={ICON_SIZE.md} />}
                      disabled={busy}
                      aria-label={`Remove ${document.file_name}`}
                      onSelect={() => { void remove(document); }}
                    >
                      Remove document
                    </MenuItem>
                  </Menu>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
