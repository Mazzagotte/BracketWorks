'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, MoreHorizontal, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Card, CardDivider, CardHeader, FormGrid, ICON_SIZE, Menu, MenuItem, Notice, SelectField, TextAreaField } from '@bracketworks/ui';
import {
  deleteTournamentDocument,
  downloadTournamentDocument,
  listTournamentDocuments,
  uploadTournamentDocument,
  type TournamentDocumentKind,
  type TournamentDocumentRecord,
} from '../organizerApi';
import { DOCUMENT_TYPE_OPTIONS, documentTypeLabel, formatDocumentUploadedAt } from '../documentTypes';
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

const hasRules = (records: TournamentDocumentRecord[]) => records.some((document) => document.doc_type === 'rules');

function accessToken(): string {
  const token = sessionStorage.getItem('access_token');
  if (!token) throw new Error('Your session expired. Please sign in again.');
  return token;
}

/**
 * Pasted rules plus every tournament document (rules, flyers, oil patterns, entry forms, notices, other):
 * upload with a type, list, download, and delete after confirmation.
 */
export default function RulesDocumentsSection({ tournamentId, rulesText, onRulesTextChange, onHasRulesDocumentChange }: Props) {
  const [documents, setDocuments] = useState<TournamentDocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(tournamentId));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<TournamentDocumentKind>('rules');
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
          setDocuments(records);
          onHasRulesDocumentChange(hasRules(records));
        }
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Unable to load documents.');
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
      if (activeRef.current) setError(cause instanceof Error ? cause.message : 'Unable to update documents.');
    } finally {
      if (activeRef.current) setBusy(false);
    }
  };

  const upload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file to upload.');
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
      const document = await uploadTournamentDocument(accessToken(), tournamentId, file, docType);
      if (!activeRef.current) return;
      const next = [document, ...documents];
      setDocuments(next);
      onHasRulesDocumentChange(hasRules(next));
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setMessage(`Uploaded ${document.file_name}.`);
    });
  };

  const remove = async (document: TournamentDocumentRecord) => {
    if (!tournamentId || busy || !await confirm({
      title: 'Delete document?',
      message: `Delete "${document.file_name}"? This cannot be undone.`,
      confirmLabel: 'Delete document',
      tone: 'danger',
    })) return;
    void runDocumentAction(async () => {
      await deleteTournamentDocument(accessToken(), tournamentId, document.id);
      if (!activeRef.current) return;
      const remaining = documents.filter((record) => record.id !== document.id);
      setDocuments(remaining);
      onHasRulesDocumentChange(hasRules(remaining));
      setMessage(`Deleted ${document.file_name}.`);
    });
  };

  const download = (document: TournamentDocumentRecord) => {
    if (!tournamentId) {
      setError('Save the tournament draft before downloading a document.');
      return;
    }
    void runDocumentAction(() => downloadTournamentDocument(accessToken(), tournamentId, document));
  };

  const rulesAdded = Boolean(rulesText.trim() || hasRules(documents));
  const controlsDisabled = !tournamentId || busy || isLoading || Boolean(loadError);

  return (
    <Card aria-labelledby="rules-documents-heading">
      {confirmationDialog}
      <CardHeader
        title={<span id="rules-documents-heading">Rules and documents</span>}
        description="Paste your rules, upload rules, flyers, oil patterns, and other files, or both. Bowlers can review them before registering."
        headingLevel="h3"
        actions={<Badge tone={rulesAdded ? 'success' : 'neutral'}>{rulesAdded ? 'Rules added' : 'Optional'}</Badge>}
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
          <h4 className={layout.subsectionTitle}>Upload documents</h4>
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
        {isLoading ? <p className={layout.helper} role="status">Loading documents...</p> : null}

        <FormGrid>
          <SelectField
            label="Document type"
            value={docType}
            onChange={(event) => setDocType(event.target.value as TournamentDocumentKind)}
            disabled={controlsDisabled}
          >
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
        </FormGrid>

        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Document file"
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
            <span className={local.pickerName}>{selectedFile ? selectedFile.name : 'Choose a document'}</span>
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
        {!isLoading && !loadError && documents.length === 0 ? <p className={layout.helper}>No documents have been uploaded yet.</p> : null}
        {documents.length > 0 ? (
          <ul className={layout.rows}>
            {documents.map((document) => (
              <li key={document.id} className={layout.row}>
                <div className={layout.rowText}>
                  <span className={layout.rowTitle}>{document.file_name}</span>
                  <span className={layout.rowMeta}>
                    {`${documentTypeLabel(document.doc_type)} · ${formatFileSize(document.file_size)} · ${formatDocumentUploadedAt(document.uploaded_at)}`}
                  </span>
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
                      aria-label={`Delete ${document.file_name}`}
                      onSelect={() => { void remove(document); }}
                    >
                      Delete document
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
