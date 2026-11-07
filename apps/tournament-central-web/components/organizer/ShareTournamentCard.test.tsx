import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ShareTournamentCard from './ShareTournamentCard';
import { organizerRoutes } from './organizerRoutes';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const props = { tournamentId: 58, tournamentName: 'County Open', dateText: 'Nov 15, 2026', locationText: 'Meridian Lanes, Meridian, ID' };

describe('share card', () => {
  it('uses the public directory id the home page accepts', () => {
    expect(organizerRoutes.publicPage(58)).toBe('/?tournament=tc-58');
    expect(organizerRoutes.publicPage('tc-58')).toBe('/?tournament=tc-58');
  });

  it('shows the registration link and copies it', async () => {
    const user = userEvent.setup();
    render(<ShareTournamentCard {...props} isPublic />);
    const link = `${window.location.origin}/?tournament=tc-58`;
    expect(await screen.findByText(link)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(link);
    expect(screen.getByRole('status')).toHaveTextContent('Registration link copied.');
  });

  it('shows the live standings link and copies it', async () => {
    const user = userEvent.setup();
    render(<ShareTournamentCard {...props} isPublic />);
    const link = `${window.location.origin}/live/tc-58`;
    expect(await screen.findByText(link)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy live standings link' }));
    expect(await navigator.clipboard.readText()).toBe(link);
    expect(screen.getByRole('status')).toHaveTextContent('Live standings link copied.');
  });

  it('explains how to get a link when the tournament is not public', () => {
    render(<ShareTournamentCard {...props} isPublic={false} />);
    expect(screen.getByText(/Publish the tournament with public visibility/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'QR code and flyer' })).not.toBeInTheDocument();
    expect(screen.queryByText('Live standings link')).not.toBeInTheDocument();
  });

  it('keeps the QR code, download, and flyer in a dialog', async () => {
    const user = userEvent.setup();
    render(<ShareTournamentCard {...props} isPublic />);
    expect(screen.queryByRole('button', { name: 'Download QR code' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('QR code for County Open registration')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'QR code and flyer' }));
    const dialog = screen.getByRole('dialog', { name: 'QR code and flyer' });
    expect(within(dialog).getByTitle('QR code for County Open registration')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Download QR code' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Print flyer' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close QR code and flyer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks to allow pop-ups when the flyer window is blocked', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockReturnValue(null);
    render(<ShareTournamentCard {...props} isPublic />);
    await user.click(screen.getByRole('button', { name: 'QR code and flyer' }));
    await user.click(screen.getByRole('button', { name: 'Print flyer' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Allow pop-ups');
  });
});
