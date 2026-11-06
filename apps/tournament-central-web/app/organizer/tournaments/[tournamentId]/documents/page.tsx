'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, MoreHorizontal, Trash2, Upload } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  FormGrid,
  ICON_SIZE,
  Menu,
  MenuItem,
  Notice,
  Page,
  PageHeader,
  SelectField,
  TextField,
} from '@bracketworks/ui';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import { useConfirmation } from '@/components/organizer/useConfirmation';
import {
  deleteTournamentDocument,
  downloadTournamentDocument,
  listTournamentDocuments,
  uploadTournamentDocument,
  type TournamentDocumentKind,
  type TournamentDocumentRecord,
} from '@/components/organizer/organizerApi';
import styles from './documents.module.css';

const DOC_TYPE_OPTIONS: Array<{ value: TournamentDocumentKind; label: string }> = [
  { value: 'rules', label: 'Rules' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'oil_pattern', label: 'Oil pattern' },
  { value: 'entry_form', label: 'Entry form' },
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
  const [fileName, setFileName] = useState('');
  const [documents, setDocuments] = useState<TournamentDocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<TournamentDocumentKind>('rules');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { confirm, confirmationDialog } = useConfirmation();
  const deletingRef = useRef(false);

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
      setFileName('');
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
    if (deletingRef.current || !await confirm({
      title: 'Delete document?',
      message: `Delete "${document.file_name}"? This cannot be undone.`,
      confirmLabel: 'Delete document',
      tone: 'danger',
    })) {
      return;
    }

    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Your session expired. Please sign in again.');
      return;
    }

    deletingRef.current = true;
    try {
      await deleteTournamentDocument(token, tournamentId, document.id);
      await refreshDocuments();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete document.');
    } finally {
      deletingRef.current = false;
    }
  };

  return (
    <Page width="narrow">
      {confirmationDialog}
      <PageHeader
        title="Documents"
        description={`Rules, flyers, and other files bowlers can download for ${tournament?.name || 'this tournament'}.`}
      />

      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

      <Card aria-label="Upload a document">
        <CardHeader title="Upload a document" description="PDF, Word, PNG, or JPG." />
        <FormGrid>
          <SelectField label="Type" value={docType} onChange={(event) => setDocType(event.target.value as TournamentDocumentKind)}>
            {DOC_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
          <TextField
            ref={fileInputRef}
            label="File"
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className={styles.fileField}
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
          />
        </FormGrid>
        <div className={styles.actions}>
          <Button
            variant="primary"
            icon={<Upload size={ICON_SIZE.md} aria-hidden="true" />}
            onClick={() => void handleUpload()}
            disabled={isUploading || !fileName}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </Card>

      {isLoading ? <Notice tone="info">Loading documents...</Notice> : null}

      {!isLoading ? (
        <Card aria-label="Tournament documents">
          <CardHeader title="Tournament documents" description={`${documents.length} file${documents.length === 1 ? '' : 's'}`} />
          {documents.length === 0 ? (
            <EmptyState
              icon={<FileText size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title="No documents yet"
              description="No documents have been uploaded yet."
            />
          ) : (
            <ul className={styles.rows}>
              {documents.map((document) => (
                <li key={document.id} className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.rowTitle}>{document.file_name}</span>
                    <span className={styles.rowMeta}>
                      {DOC_TYPE_LABEL[document.doc_type] ?? 'Other'} · {formatFileSize(document.file_size)} · {formatUploadedAt(document.uploaded_at)}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Download size={ICON_SIZE.md} aria-hidden="true" />}
                      aria-label={`Download ${document.file_name}`}
                      onClick={() => void handleDownload(document)}
                    >
                      Download
                    </Button>
                    <Menu triggerLabel={`More actions for ${document.file_name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                      <MenuItem
                        tone="danger"
                        icon={<Trash2 size={ICON_SIZE.md} />}
                        aria-label={`Delete ${document.file_name}`}
                        onSelect={() => void handleDelete(document)}
                      >
                        Delete document
                      </MenuItem>
                    </Menu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </Page>
  );
}
