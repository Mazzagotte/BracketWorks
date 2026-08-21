'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import {
  deleteTournamentDocument,
  downloadTournamentDocument,
  listTournamentDocuments,
  uploadTournamentDocument,
  type TournamentDocumentKind,
  type TournamentDocumentRecord,
} from '@/components/organizer/organizerApi';
import styles from './page.module.css';

const DOC_TYPE_OPTIONS: Array<{ value: TournamentDocumentKind; label: string }> = [
  { value: 'rules', label: 'Rules' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'oil_pattern', label: 'Oil Pattern' },
  { value: 'entry_form', label: 'Entry Form' },
  { value: 'notice', label: 'Notice' },
  { value: 'other', label: 'Other' },
];

const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function OrganizerTournamentDocumentsPage() {
  const { tournamentId, tournament } = useTournamentContext();
  const [documents, setDocuments] = useState<TournamentDocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<TournamentDocumentKind>('rules');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshDocuments = useCallback(async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token || !Number.isInteger(tournamentId) || tournamentId <= 0) {
      setIsLoading(false);
      return;
    }

    try {
      const records = await listTournamentDocuments(token, tournamentId);
      setDocuments(records);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load documents.');
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }

    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Your session expired. Please sign in again.');
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      await uploadTournamentDocument(token, tournamentId, file, docType);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await refreshDocuments();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (document: TournamentDocumentRecord) => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      return;
    }

    try {
      await downloadTournamentDocument(token, tournamentId, document);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to download document.');
    }
  };

  const handleDelete = async (document: TournamentDocumentRecord) => {
    if (!window.confirm(`Delete "${document.file_name}"? This cannot be undone.`)) {
      return;
    }

    const token = sessionStorage.getItem('access_token');
    if (!token) {
      return;
    }

    try {
      await deleteTournamentDocument(token, tournamentId, document.id);
      await refreshDocuments();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete document.');
    }
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Documents</h1>
          <p>{tournament?.name || 'Tournament'}</p>
        </div>
        <Link href={`/organizer/tournaments/${tournamentId}`} className={styles.backButton}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Overview
        </Link>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.uploadCard} aria-label="Upload a document">
        <h2>Upload Document</h2>
        <div className={styles.uploadForm}>
          <label className={styles.uploadField}>
            Type
            <select value={docType} onChange={(event) => setDocType(event.target.value as TournamentDocumentKind)}>
              {DOC_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.uploadField}>
            File
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
          </label>
          <button type="button" className={styles.uploadButton} onClick={() => void handleUpload()} disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </section>

      {isLoading ? <section className={styles.loading}>Loading documents...</section> : null}

      {!isLoading ? (
        <section className={styles.listCard} aria-label="Tournament documents">
          <h2>Tournament Documents</h2>
          {documents.length === 0 ? (
            <p className={styles.empty}>No documents have been uploaded yet.</p>
          ) : (
            <div className={styles.docList}>
              {documents.map((document) => (
                <div key={document.id} className={styles.docRow}>
                  <strong>{document.file_name}</strong>
                  <span className={styles.docTypeChip}>{DOC_TYPE_LABEL[document.doc_type] ?? 'Other'}</span>
                  <span>{formatFileSize(document.file_size)} &middot; {formatUploadedAt(document.uploaded_at)}</span>
                  <div className={styles.docActions}>
                    <button type="button" onClick={() => void handleDownload(document)}>
                      <Download size={13} aria-hidden="true" /> Download
                    </button>
                    <button type="button" className={styles.deleteButton} onClick={() => void handleDelete(document)}>
                      <Trash2 size={13} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
