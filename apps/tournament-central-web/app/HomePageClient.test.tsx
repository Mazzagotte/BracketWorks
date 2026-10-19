import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePageClient from './HomePageClient';

vi.mock('react-simple-maps', () => ({
  ComposableMap: () => null, Geographies: () => null, Geography: () => null,
  Marker: () => null, ZoomableGroup: () => null,
}));

const directory = { tournaments: [{
  id: 'tc-1', name: 'Fall Open', start_date: '2099-11-15', end_date: '2099-11-15',
  location: 'Sunset Lanes, Boise, ID', state_code: 'ID',
  registration_url: '/api/v1/public/tc-tournament/1/registration',
  registration_close_date: '2099-11-15',
}] };

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    details: { tournamentType: 'Adult', supportEmail: 'director@example.com', registrationCloseIso: '2099-11-15' },
    events: [{ id: 'singles', name: 'Singles', scoring: 'scratch', entryFeeCents: 6000 }],
    divisions: [{ id: 'open', name: 'Open' }],
    squads: [{ id: 'am', name: 'Morning', dateIso: '2099-11-15', startTime: '09:00', capacity: 20, registeredCount: 5 }],
    documents: [{ name: 'Rules.pdf', kind: 'rules', url: '/rules.pdf' }],
  }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public tournament discovery', () => {
  it('opens a shared link on a fresh visit and copies the permanent URL', async () => {
    window.history.replaceState(null, '', '/?tournament=tc-1');
    const user = userEvent.setup();
    render(<HomePageClient initialDirectory={directory} />);
    const dialog = await screen.findByRole('dialog', { name: 'Fall Open' });
    await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/?tournament=tc-1`);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Tournament link copied.');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('updates the address bar and follows browser Back and Forward', async () => {
    const user = userEvent.setup();
    render(<HomePageClient initialDirectory={directory} />);
    await user.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    expect(window.location.search).toBe('?tournament=tc-1');
    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.search).toBe('');
    window.history.forward();
    expect(await screen.findByRole('dialog', { name: 'Fall Open' })).toBeInTheDocument();
  });

  it('looks up a shared tournament outside the limited directory', async () => {
    window.history.replaceState(null, '', '/?tournament=tc-1');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url.includes('tournament_id=1') ? directory : { details: {}, squads: [] },
    })));
    render(<HomePageClient initialDirectory={{ tournaments: [] }} />);
    expect(await screen.findByRole('dialog', { name: 'Fall Open' })).toHaveFocus();
    expect(fetch).toHaveBeenCalledWith('/api/v1/public/tournaments?source=tc&tournament_id=1&limit=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it.each([
    ['bad-id', 'This tournament link is invalid.'],
    ['tc-404', 'This tournament is unavailable or is no longer public.'],
  ])('explains an unavailable shared tournament (%s)', async (id, message) => {
    window.history.replaceState(null, '', `/?tournament=${id}`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tournaments: [] }) }));
    const user = userEvent.setup();
    render(<HomePageClient initialDirectory={directory} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await user.click(screen.getByRole('button', { name: 'Back to tournaments' }));
    expect(window.location.search).toBe('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces copy failures without claiming the link was copied', async () => {
    window.history.replaceState(null, '', '/?tournament=tc-1');
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'));
    render(<HomePageClient initialDirectory={directory} />);
    const dialog = await screen.findByRole('dialog', { name: 'Fall Open' });
    await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Copy the tournament URL from your browser address bar.');
    expect(screen.queryByText('Tournament link copied.')).not.toBeInTheDocument();
  });

  it('keeps the shared URL through registration and returns to details when registration closes', async () => {
    window.history.replaceState(null, '', '/?tournament=tc-1');
    const user = userEvent.setup();
    render(<HomePageClient initialDirectory={directory} />);
    await user.click(within(await screen.findByRole('dialog', { name: 'Fall Open' })).getByRole('button', { name: 'Sign Up' }));
    expect(await screen.findByRole('dialog', { name: 'Tournament registration' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tournament=tc-1');
    await user.click(await screen.findByRole('button', { name: 'Close tournament registration' }));
    expect(await screen.findByRole('dialog', { name: 'Fall Open' })).toHaveFocus();
  });

  it('reviews a registration and retains the server confirmation after submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => options?.method === 'POST'
        ? { registration_id: 'FO-2099-0007', status: 'confirmed' }
        : {
          events: [{ id: 'singles', name: 'Singles', enabled: true, minPlayers: 1, maxPlayers: 1 }],
          divisions: [], squads: [{ id: 'am', name: 'Morning' }], fields: [], questions: [],
        },
    })));
    const user = userEvent.setup();
    render(<HomePageClient initialDirectory={directory} />);
    await user.click(screen.getAllByRole('button', { name: 'Register' })[0]);
    await user.click(await screen.findByRole('button', { name: 'Continue to Review' }));
    const review = screen.getByRole('dialog', { name: 'Please review before submitting' });
    await user.click(within(review).getByRole('checkbox'));
    expect(within(review).getByRole('checkbox')).toHaveFocus();
    await user.click(within(review).getByRole('button', { name: 'Agree & Submit Registration' }));
    expect(await screen.findByText('FO-2099-0007')).toBeInTheDocument();
    expect(screen.getByText('Status: confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue to Review' })).not.toBeInTheDocument();
  });

  it('traps keyboard focus in details, closes on Escape, and restores the trigger', async () => {
    const user = userEvent.setup();
    render(<HomePageClient initialDirectory={directory} />);
    const trigger = screen.getAllByRole('button', { name: 'View Details' })[0];
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Fall Open' });
    expect(dialog).toHaveAccessibleDescription('Review tournament information, availability, and documents before registering.');
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Sign Up' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Close tournament details' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Sign Up' })).toHaveFocus();
    expect(await within(dialog).findByText(/of 20 bowler spots remaining/)).toHaveTextContent('15 of 20 bowler spots remaining');
    expect(within(dialog).getByText('5 bowlers registered')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Rules.pdf (rules)' })).toBeInTheDocument();
    expect(within(dialog).getByText(/From \$60.00/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByText('Closes Nov 15, 2099')).toBeInTheDocument();
    expect(screen.queryByText(/Aug 29/)).not.toBeInTheDocument();
  });

  it.each([320, 375, 390])('keeps every filter keyboard operable at %ipx', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    const user = userEvent.setup();
    render(<HomePageClient initialDirectory={directory} />);
    const filter = screen.getByRole('button', { name: /In Progress/ });
    filter.focus();
    await user.keyboard('{Enter}');
    expect(filter).toHaveAttribute('aria-pressed', 'true');
    expect(filter).toHaveFocus();
  });
});
