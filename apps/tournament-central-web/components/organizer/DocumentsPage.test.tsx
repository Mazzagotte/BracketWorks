import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DocumentsPage from '@/app/organizer/tournaments/[tournamentId]/documents/page';
import { deleteTournamentDocument, listTournamentDocuments, type TournamentDocumentRecord } from './organizerApi';

vi.mock('./TournamentContext', () => ({
  useTournamentContext: () => ({ tournamentId: 42, tournament: { name: 'Open' } }),
}));
vi.mock('./organizerApi', () => ({
  deleteTournamentDocument: vi.fn(), listTournamentDocuments: vi.fn(),
  downloadTournamentDocument: vi.fn(), uploadTournamentDocument: vi.fn(),
}));

const record: TournamentDocumentRecord = {
  id: 9, tournament_id: 42, doc_type: 'rules', file_name: 'Rules.pdf',
  file_size: 1024, mime_type: 'application/pdf', uploaded_at: '2026-10-18T12:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'test');
  vi.mocked(listTournamentDocuments).mockResolvedValue([record]);
  vi.mocked(deleteTournamentDocument).mockResolvedValue({ ok: true });
});
afterEach(() => { cleanup(); sessionStorage.clear(); });

describe('document deletion confirmation', () => {
  it('keeps the document when cancelled and deletes only after confirmation', async () => {
    const user = userEvent.setup();
    render(<DocumentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Rules.pdf' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete document?' })).toHaveTextContent('Rules.pdf');
    expect(deleteTournamentDocument).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteTournamentDocument).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete Rules.pdf' }));
    vi.mocked(listTournamentDocuments).mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(deleteTournamentDocument).toHaveBeenCalledWith('test', 42, 9);
    expect(await screen.findByText('No documents have been uploaded yet.')).toBeInTheDocument();
  });

  it('surfaces a failed confirmed deletion and retains the document', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteTournamentDocument).mockRejectedValue(new Error('Permission denied.'));
    render(<DocumentsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Rules.pdf' }));
    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied.');
    expect(screen.getByText('Rules.pdf')).toBeInTheDocument();
  });
});
