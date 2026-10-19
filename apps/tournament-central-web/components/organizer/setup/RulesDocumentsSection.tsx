'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import {
  deleteTournamentDocument,
  downloadTournamentDocument,
  listTournamentDocuments,
  uploadTournamentDocument,
  type TournamentDocumentRecord,
} from '../organizerApi';
import { formatFileSize } from '../setupFormatting';
import { useConfirmation } from '../useConfirmation';
import styles from '../tournament-setup.module.css';

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

  return <section className={styles.sectionCard} aria-labelledby="rules-documents-heading">
    {confirmationDialog}
    <div className={styles.sectionHeader}>
      <div>
        <h2 id="rules-documents-heading">Rules & Documents</h2>
        <p>Paste your rules, upload a document, or use both. Bowlers can review them before registering.</p>
      </div>
      <span className={`${styles.chip} ${rulesText.trim() || documents.length ? styles.chipEnabled : styles.chipMuted}`}>
        {rulesText.trim() || documents.length ? 'Rules added' : 'Optional'}
      </span>
    </div>
    <div className={styles.rulesDocumentsBody}>
      <div className={styles.rulesEditorPanel}>
        <label className={styles.detailFormField} htmlFor="tournament-rules-text">
          Write or paste rules
          <textarea id="tournament-rules-text" rows={10} value={rulesText} onChange={(event) => onRulesTextChange(event.target.value)}
            placeholder={'Paste tournament rules here...\n\nInclude eligibility, format, check-in times, and policies.'}
            aria-describedby="rules-text-help" />
        </label>
        <p id="rules-text-help" className={styles.rulesHelp}>Plain text; line breaks are preserved. Use Save Draft to save your rules, then Publish to make text changes public.</p>
        {rulesText.trim() && <details className={styles.rulesTextPreview}>
          <summary>Preview pasted rules</summary>
          <div>{rulesText}</div>
        </details>}
      </div>
      <div className={styles.rulesEditorPanel}>
        <h3>Upload rules documents</h3>
        <p className={styles.rulesHelp}>PDF, Word (DOC or DOCX), PNG, or JPG. Maximum 20 MB per file. Uploaded files are saved immediately and are available when the tournament is public and published.</p>
        {!tournamentId && <p className={styles.rulesHelp}>Save Draft to create the tournament before uploading a document. You can paste rules above now.</p>}
        {loadError && <p role="alert" className={styles.rulesError}>{loadError} <button type="button" className={styles.inlineAction} onClick={() => setLoadAttempt((value) => value + 1)}>Try again</button></p>}
        {isLoading && <p role="status">Loading rules documents...</p>}
        <div className={styles.rulesUploadControls}>
          <label className={styles.rulesFilePicker}>
            <input ref={fileInputRef} type="file" aria-label="Rules document"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setError('');
                setMessage('');
              }}
              disabled={!tournamentId || busy || isLoading || Boolean(loadError)} />
            <span className={styles.rulesFileIcon} aria-hidden="true">{selectedFile ? <FileText size={22} /> : <Upload size={22} />}</span>
            <span className={styles.rulesFileCopy} aria-live="polite">
              <strong>{selectedFile ? selectedFile.name : 'Choose a rules document'}</strong>
              <span>{selectedFile ? `${formatFileSize(selectedFile.size)} - Ready to upload` : 'PDF, Word, or image - up to 20 MB'}</span>
            </span>
            <span className={styles.rulesFileBrowse} aria-hidden="true">{selectedFile ? 'Change file' : 'Browse files'}</span>
          </label>
          <button type="button" className={styles.secondaryAction} onClick={upload} disabled={!tournamentId || busy || isLoading || Boolean(loadError)}>
            {busy ? 'Working...' : 'Upload Document'}
          </button>
        </div>
        {error && <p role="alert" className={styles.rulesError}>{error}</p>}
        {message && <p role="status" className={styles.rulesHelp}>{message}</p>}
        {!isLoading && !loadError && documents.length === 0 && <p className={styles.rulesHelp}>No rules documents uploaded.</p>}
        <ul className={styles.rulesDocumentList}>{documents.map((document) => <li key={document.id} className={styles.documentFileCard}>
          <div className={styles.documentFileMain}>
            <strong>{document.file_name}</strong>
            <p>{formatFileSize(document.file_size)}</p>
          </div>
          <div className={styles.documentActions}>
            <button type="button" className={styles.secondaryAction} disabled={busy} aria-label={`Download ${document.file_name}`}
              onClick={() => download(document)}>Download</button>
            <button type="button" className={styles.inlineAction} disabled={busy} aria-label={`Remove ${document.file_name}`} onClick={() => remove(document)}>Remove</button>
          </div>
        </li>)}</ul>
      </div>
    </div>
  </section>;
}
