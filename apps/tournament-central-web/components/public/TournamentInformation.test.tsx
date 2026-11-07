import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TournamentInformation from './TournamentInformation';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubConfig(config: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => config }));
}

describe('public tournament format details', () => {
  it('shows event format, handicap, finals, payouts, side events, and division limits', async () => {
    stubConfig({
      details: {},
      events: [{
        id: 'ev-1', name: 'Sweeper', scoring: 'handicap', maxPlayers: 1, entryFeeCents: 5000,
        rules: {
          format: 'singles', games: 4, handicap: { percent: 80, basis: 220, maxPins: null, perPair: false },
          finals: { type: 'stepladder', cut: { by: 'count', value: 5 }, notes: 'One game per match.' },
          payoutRatio: 4, usbcRequired: true,
        },
      }],
      divisions: [{ id: 'div-1', name: 'Youth', maxAge: 20, rules: { gender: 'any', prizeType: 'scholarship' } }],
      squads: [],
      documents: [],
      fees: [{
        id: 'fee-1', name: 'Brackets', amountCents: 500,
        sideEvent: { kind: 'brackets', allowQuantity: true, maxQuantity: 10, per: 'bowler', brackets: { scoring: 'handicap', size: 8, firstPlaceCents: 3000, secondPlaceCents: 1000, houseCents: 0, refundUnfilled: true } },
      }],
    });
    render(<TournamentInformation configUrl="/config" />);
    expect(await screen.findByText('Singles · 4 games · Handicap 80% of 220 · Stepladder, top 5')).toBeInTheDocument();
    expect(screen.getByText('One game per match.')).toBeInTheDocument();
    expect(screen.getByText('About 1 in 4 entries cash · USBC membership required')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Side events and add-ons' })).toBeInTheDocument();
    expect(screen.getByText('Per bowler · Buy up to 10 · Handicap brackets')).toBeInTheDocument();
    expect(screen.getByText('8 entries at $5 = $40: pays $30 and $10')).toBeInTheDocument();
    expect(screen.getByText('Age 20 and under · Scholarship prizes')).toBeInTheDocument();
  });

  it('shows only the scoring for events saved before format rules existed', async () => {
    stubConfig({ details: {}, events: [{ id: 'ev-1', name: 'Singles', scoring: 'no-tap', entryFeeCents: 3000 }], divisions: [], squads: [], documents: [] });
    render(<TournamentInformation configUrl="/config" />);
    expect(await screen.findByText('No tap')).toBeInTheDocument();
    expect(screen.queryByText(/Singles ·/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Side events and add-ons' })).not.toBeInTheDocument();
  });
});
