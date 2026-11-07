import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteTournamentDocument, downloadTournamentDocument, listTournamentDocuments,
  uploadTournamentDocument, type TournamentDocumentRecord,
} from '../organizerApi';
import { redirect } from 'next/navigation';
import RulesDocumentsSection from './RulesDocumentsSection';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../organizerApi', () => ({
  listTournamentDocuments: vi.fn(),
  uploadTournamentDocument: vi.fn(),
  downloadTournamentDocument: vi.fn(),
  deleteTournamentDocument: vi.fn(),
}));

const record: TournamentDocumentRecord = {
  id: 9, tournament_id: 42, doc_type: 'rules', file_name: 'League Rules.pdf',
  file_size: 1024, mime_type: 'application/pdf', uploaded_at: '2026-10-18T12:00:00Z',
};
const onHasRulesDocumentChange = vi.fn();

function Editor({ tournamentId = 42 }: { tournamentId?: number | null }) {
  const [rulesText, setRulesText] = useState('');
  return <RulesDocumentsSection tournamentId={tournamentId} rulesText={rulesText}
    onRulesTextChange={setRulesText} onHasRulesDocumentChange={onHasRulesDocumentChange} />;
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'test-session');
  vi.mocked(listTournamentDocuments).mockResolvedValue([]);
  vi.mocked(uploadTournamentDocument).mockResolvedValue(record);
  vi.mocked(deleteTournamentDocument).mockResolvedValue({ ok: true });
  vi.mocked(downloadTournamentDocument).mockResolvedValue();
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('Rules and documents setup', () => {
  it('pastes rules with line breaks and offers a text preview before the first save', async () => {
    const user = userEvent.setup();
    render(<Editor tournamentId={null} />);
    const text = '1. Check in early.\n\n2. No substitutes.';
    await user.click(screen.getByLabelText('Write or paste rules'));
    await user.paste(text);
    expect(screen.getByLabelText('Write or paste rules')).toHaveValue(text);
    await user.click(screen.getByText('Preview pasted rules'));
    expect(screen.getByText(/1\. Check in early\./, { selector: 'div' }).textContent).toBe(text);
    expect(screen.getByRole('button', { name: 'Upload document' })).toBeDisabled();
    expect(listTournamentDocuments).not.toHaveBeenCalled();
  });

  it('lists every tournament document with its type, not only rules', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([
      record,
      { ...record, id: 10, doc_type: 'oil_pattern', file_name: 'Pattern.pdf' },
      { ...record, id: 11, doc_type: 'other', file_name: 'Internal.pdf' },
    ]);
    render(<Editor />);
    expect(await screen.findByText(record.file_name)).toBeInTheDocument();
    expect(screen.getByText('Pattern.pdf')).toBeInTheDocument();
    expect(screen.getByText('Internal.pdf')).toBeInTheDocument();
    expect(screen.getByText(/^Oil pattern · .* KB · /)).toBeInTheDocument();
    expect(screen.getByText(/^Other · .* KB · /)).toBeInTheDocument();
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(true);
  });

  it('does not count other document types as rules', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([{ ...record, doc_type: 'flyer', file_name: 'Flyer.png' }]);
    render(<Editor />);
    expect(await screen.findByText('Flyer.png')).toBeInTheDocument();
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(false);
  });

  it('offers every document type and uploads with the chosen type', async () => {
    const flyer = { ...record, id: 12, doc_type: 'flyer' as const, file_name: 'Flyer.png', mime_type: 'image/png' };
    vi.mocked(uploadTournamentDocument).mockResolvedValue(flyer);
    const user = userEvent.setup();
    render(<Editor />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload document' })).toBeEnabled());
    const typeSelect = screen.getByLabelText('Document type');
    expect([...typeSelect.querySelectorAll('option')].map((option) => option.textContent))
      .toEqual(['Rules', 'Flyer', 'Oil pattern', 'Entry form', 'Notice', 'Other']);
    await user.selectOptions(typeSelect, 'flyer');
    const file = new File(['png'], flyer.file_name, { type: 'image/png' });
    await user.upload(screen.getByLabelText('Document file'), file);
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(uploadTournamentDocument).toHaveBeenCalledWith('test-session', 42, file, 'flyer');
    expect(await screen.findByText(/^Flyer · /)).toBeInTheDocument();
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(false);
  });

  it('uploads the selected file as rules, then shows the persisted filename', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload document' })).toBeEnabled());
    const file = new File(['%PDF-1.4\nrules'], record.file_name, { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Document file'), file);
    expect(screen.getByText(record.file_name)).toBeInTheDocument();
    expect(screen.getByText(/Ready to upload/)).toBeInTheDocument();
    expect(screen.getByText('Change file')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(uploadTournamentDocument).toHaveBeenCalledWith('test-session', 42, file, 'rules');
    expect(await screen.findByText(record.file_name)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`Uploaded ${record.file_name}.`);
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByLabelText('Document file')).toHaveValue('');
    expect(screen.getByText('Choose a document')).toBeInTheDocument();
  });

  it('reports upload errors without claiming a document was saved', async () => {
    vi.mocked(uploadTournamentDocument).mockRejectedValue(new Error('Document content does not match its declared type'));
    const user = userEvent.setup();
    render(<Editor />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload document' })).toBeEnabled());
    await user.upload(screen.getByLabelText('Document file'), new File(['bad'], 'Bad.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Document content does not match its declared type');
    expect(onHasRulesDocumentChange).not.toHaveBeenCalledWith(true);
    expect(screen.getByText('Bad.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download Bad.pdf' })).not.toBeInTheDocument();
  });

  it('downloads and deletes an actual saved document', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([record]);
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(await screen.findByRole('button', { name: `Download ${record.file_name}` }));
    expect(downloadTournamentDocument).toHaveBeenCalledWith('test-session', 42, record);
    await user.click(screen.getByRole('button', { name: `More actions for ${record.file_name}` }));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: `Delete ${record.file_name}` })).toBeEnabled());
    await user.click(screen.getByRole('menuitem', { name: `Delete ${record.file_name}` }));
    expect(screen.getByRole('alertdialog', { name: 'Delete document?' })).toHaveTextContent(record.file_name);
    expect(deleteTournamentDocument).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    await waitFor(() => expect(screen.queryByText(record.file_name)).not.toBeInTheDocument());
    expect(deleteTournamentDocument).toHaveBeenCalledWith('test-session', 42, record.id);
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps the document when deletion is cancelled and deletes only after confirmation', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([record]);
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(await screen.findByRole('button', { name: `More actions for ${record.file_name}` }));
    await user.click(screen.getByRole('menuitem', { name: `Delete ${record.file_name}` }));
    expect(screen.getByRole('alertdialog', { name: 'Delete document?' })).toHaveTextContent(record.file_name);
    expect(deleteTournamentDocument).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteTournamentDocument).not.toHaveBeenCalled();
    expect(screen.getByText(record.file_name)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `More actions for ${record.file_name}` }));
    await user.click(screen.getByRole('menuitem', { name: `Delete ${record.file_name}` }));
    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(deleteTournamentDocument).toHaveBeenCalledWith('test-session', 42, record.id);
    expect(await screen.findByText('No documents have been uploaded yet.')).toBeInTheDocument();
  });

  it('keeps a document listed when deletion fails', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([record]);
    vi.mocked(deleteTournamentDocument).mockRejectedValue(new Error('Unable to remove document.'));
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(await screen.findByRole('button', { name: `More actions for ${record.file_name}` }));
    await user.click(screen.getByRole('menuitem', { name: `Delete ${record.file_name}` }));
    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to remove document.');
    expect(screen.getByText(record.file_name)).toBeInTheDocument();
    expect(onHasRulesDocumentChange).not.toHaveBeenCalledWith(false);
  });

  it('exposes loading errors and lets the organizer retry', async () => {
    vi.mocked(listTournamentDocuments).mockRejectedValueOnce(new Error('Cannot load documents.'));
    const user = userEvent.setup();
    render(<Editor />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot load documents.');
    expect(screen.queryByText('No documents have been uploaded yet.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No documents have been uploaded yet.')).toBeInTheDocument();
    expect(listTournamentDocuments).toHaveBeenCalledTimes(2);
  });

  it('reports an expired session rather than silently loading an empty list', async () => {
    sessionStorage.clear();
    render(<Editor />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session expired. Please sign in again.');
    expect(listTournamentDocuments).not.toHaveBeenCalled();
  });

  it('requires a selected nonempty file before uploading', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload document' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a file to upload.');
    await user.upload(screen.getByLabelText('Document file'), new File([], 'Empty.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The selected file is empty.');
    expect(uploadTournamentDocument).not.toHaveBeenCalled();
  });
});

describe('documents route', () => {
  it('redirects the old Documents page to the setup step that manages documents', async () => {
    const { default: DocumentsRedirect } = await import('@/app/organizer/tournaments/[tournamentId]/documents/page');
    await DocumentsRedirect({ params: Promise.resolve({ tournamentId: '42' }) });
    expect(redirect).toHaveBeenCalledWith('/organizer/tournaments/42/setup?section=fees-payments-documents');
  });
});
