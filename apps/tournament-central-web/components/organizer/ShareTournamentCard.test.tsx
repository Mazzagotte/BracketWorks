import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ShareTournamentButton from './ShareTournamentCard';
import { organizerRoutes } from './organizerRoutes';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const props = { tournamentId: 58, tournamentName: 'County Open', dateText: 'Nov 15, 2026', locationText: 'Meridian Lanes, Meridian, ID' };

async function openShare(isPublic = true) {
  const user = userEvent.setup();
  render(<ShareTournamentButton {...props} isPublic={isPublic} />);
  await user.click(screen.getByRole('button', { name: 'Share' }));
  return { user, dialog: screen.getByRole('dialog', { name: 'Share this tournament' }) };
}

describe('share dialog', () => {
  it('uses the public directory id the home page accepts', () => {
    expect(organizerRoutes.publicPage(58)).toBe('/?tournament=tc-58');
    expect(organizerRoutes.publicPage('tc-58')).toBe('/?tournament=tc-58');
  });

  it('opens from a Share button and copies the registration link', async () => {
    const { user, dialog } = await openShare();
    const link = `${window.location.origin}/?tournament=tc-58`;
    expect(await within(dialog).findByText(link)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(link);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Registration link copied.');
  });

  it('copies the live standings link', async () => {
    const { user, dialog } = await openShare();
    const link = `${window.location.origin}/live/tc-58`;
    expect(await within(dialog).findByText(link)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Copy live standings link' }));
    expect(await navigator.clipboard.readText()).toBe(link);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Live standings link copied.');
  });

  it('shows the QR code with download and flyer actions, and closes', async () => {
    const { user, dialog } = await openShare();
    expect(within(dialog).getByTitle('QR code for County Open registration')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Download QR code' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Print flyer' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close share' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains how to get a link when the tournament is not public', async () => {
    const { dialog } = await openShare(false);
    expect(within(dialog).getByText(/Publish the tournament with public visibility/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Print flyer' })).not.toBeInTheDocument();
  });

  it('asks to allow pop-ups when the flyer window is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { user, dialog } = await openShare();
    await user.click(within(dialog).getByRole('button', { name: 'Print flyer' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Allow pop-ups');
  });
});
