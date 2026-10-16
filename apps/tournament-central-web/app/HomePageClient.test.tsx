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
    expect(await within(dialog).findByText(/15 of 20 spots remaining/)).toBeInTheDocument();
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
