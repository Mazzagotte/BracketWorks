import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteTournamentDocument, downloadTournamentDocument, listTournamentDocuments,
  uploadTournamentDocument, type TournamentDocumentRecord,
} from '../organizerApi';
import RulesDocumentsSection from './RulesDocumentsSection';

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

describe('Rules & Documents setup', () => {
  it('pastes rules with line breaks and offers a text preview before the first save', async () => {
    const user = userEvent.setup();
    render(<Editor tournamentId={null} />);
    const text = '1. Check in early.\n\n2. No substitutes.';
    await user.click(screen.getByLabelText('Write or paste rules'));
    await user.paste(text);
    expect(screen.getByLabelText('Write or paste rules')).toHaveValue(text);
    await user.click(screen.getByText('Preview pasted rules'));
    expect(screen.getByText(/1\. Check in early\./, { selector: 'div' }).textContent).toBe(text);
    expect(screen.getByRole('button', { name: 'Upload Document' })).toBeDisabled();
    expect(listTournamentDocuments).not.toHaveBeenCalled();
  });

  it('loads real rules filenames, excluding unrelated documents', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([record, { ...record, id: 10, doc_type: 'other', file_name: 'Internal.pdf' }]);
    render(<Editor />);
    expect(await screen.findByText(record.file_name)).toBeInTheDocument();
    expect(screen.queryByText('Internal.pdf')).not.toBeInTheDocument();
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(true);
  });

  it('uploads the selected file as rules, then shows the persisted filename', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload Document' })).toBeEnabled());
    const file = new File(['%PDF-1.4\nrules'], record.file_name, { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Rules document'), file);
    expect(screen.getByText(record.file_name)).toBeInTheDocument();
    expect(screen.getByText(/Ready to upload/)).toBeInTheDocument();
    expect(screen.getByText('Change file')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(uploadTournamentDocument).toHaveBeenCalledWith('test-session', 42, file, 'rules');
    expect(await screen.findByText(record.file_name)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`Uploaded ${record.file_name}.`);
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByLabelText('Rules document')).toHaveValue('');
    expect(screen.getByText('Choose a rules document')).toBeInTheDocument();
  });

  it('reports upload errors without claiming a document was saved', async () => {
    vi.mocked(uploadTournamentDocument).mockRejectedValue(new Error('Document content does not match its declared type'));
    const user = userEvent.setup();
    render(<Editor />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload Document' })).toBeEnabled());
    await user.upload(screen.getByLabelText('Rules document'), new File(['bad'], 'Bad.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Document content does not match its declared type');
    expect(onHasRulesDocumentChange).not.toHaveBeenCalledWith(true);
    expect(screen.getByText('Bad.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download Bad.pdf' })).not.toBeInTheDocument();
  });

  it('downloads and removes an actual saved rules document', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([record]);
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(await screen.findByRole('button', { name: `Download ${record.file_name}` }));
    expect(downloadTournamentDocument).toHaveBeenCalledWith('test-session', 42, record);
    await waitFor(() => expect(screen.getByRole('button', { name: `Remove ${record.file_name}` })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: `Remove ${record.file_name}` }));
    expect(screen.getByRole('alertdialog', { name: 'Remove rules document?' })).toHaveTextContent(record.file_name);
    expect(deleteTournamentDocument).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove document' }));
    await waitFor(() => expect(screen.queryByText(record.file_name)).not.toBeInTheDocument());
    expect(deleteTournamentDocument).toHaveBeenCalledWith('test-session', 42, record.id);
    expect(onHasRulesDocumentChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps a document listed when removal fails', async () => {
    vi.mocked(listTournamentDocuments).mockResolvedValue([record]);
    vi.mocked(deleteTournamentDocument).mockRejectedValue(new Error('Unable to remove document.'));
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(await screen.findByRole('button', { name: `Remove ${record.file_name}` }));
    await user.click(screen.getByRole('button', { name: 'Remove document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to remove document.');
    expect(screen.getByText(record.file_name)).toBeInTheDocument();
    expect(onHasRulesDocumentChange).not.toHaveBeenCalledWith(false);
  });

  it('exposes loading errors and lets the organizer retry', async () => {
    vi.mocked(listTournamentDocuments).mockRejectedValueOnce(new Error('Cannot load documents.'));
    const user = userEvent.setup();
    render(<Editor />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot load documents.');
    expect(screen.queryByText('No rules documents uploaded.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No rules documents uploaded.')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload Document' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a rules document');
    await user.upload(screen.getByLabelText('Rules document'), new File([], 'Empty.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The selected file is empty.');
    expect(uploadTournamentDocument).not.toHaveBeenCalled();
  });
});
