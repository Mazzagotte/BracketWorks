import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDivision, emptyEvent, emptyFee } from '../setupFactories';
import type { EventConfig, FeeConfig } from '../types';
import { FeeEditor, InlineDivisionEditor, InlineEventEditor } from './InlineEditors';

afterEach(cleanup);

function renderEvent(overrides: Partial<EventConfig> = {}) {
  const onSave = vi.fn();
  render(<InlineEventEditor event={{ ...emptyEvent(1), name: 'Singles', ...overrides }} divisions={[]} squads={[]} onSave={onSave} onCancel={vi.fn()} />);
  return onSave;
}

describe('event rules editor', () => {
  it('shows handicap fields with a live example only for handicap scoring', async () => {
    const user = userEvent.setup();
    renderEvent();
    expect(screen.getByText('A 180 average gets 36 pins per game.')).toBeInTheDocument();
    const percent = screen.getByLabelText('Percent');
    await user.clear(percent);
    await user.type(percent, '80');
    expect(screen.getByText('A 180 average gets 32 pins per game.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Scoring'), 'scratch');
    expect(screen.queryByLabelText('Percent')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Scoring'), 'handicap');
    expect(screen.getByLabelText('Percent')).toHaveValue(90);
  });

  it('blocks saving an out-of-range handicap percent', async () => {
    const user = userEvent.setup();
    renderEvent();
    const percent = screen.getByLabelText('Percent');
    await user.clear(percent);
    await user.type(percent, '120');
    expect(screen.getByText('Handicap percent must be between 1 and 100.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save event' })).toBeDisabled();
  });

  it('suggests players per entry from the format and shows team rules for 2+ bowlers', async () => {
    const user = userEvent.setup();
    renderEvent();
    expect(screen.queryByText('Team rules')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Format'), 'doubles');
    expect(screen.getByLabelText('Bowlers per entry')).toHaveValue(2);
    expect(screen.getByText('Team rules')).toBeInTheDocument();
    expect(screen.getByLabelText(/Combined average limit/)).toBeInTheDocument();
  });

  it('keeps a team size the organizer changed', async () => {
    const user = userEvent.setup();
    renderEvent({ minPlayers: 3, maxPlayers: 3 });
    await user.selectOptions(screen.getByLabelText('Format'), 'team');
    expect(screen.getByLabelText('Bowlers per entry')).toHaveValue(3);
  });

  it('shows re-entry scoring only when re-entries are allowed', async () => {
    const user = userEvent.setup();
    renderEvent();
    expect(screen.queryByLabelText('Re-entry scoring')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Allow bowlers to enter this event more than once'));
    expect(screen.getByLabelText('Re-entry scoring')).toBeInTheDocument();
  });

  it('shows cut and round robin fields for the chosen finals and saves them', async () => {
    const user = userEvent.setup();
    const onSave = renderEvent();
    expect(screen.queryByLabelText('Who advances')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Finals'), 'stepladder');
    expect(screen.getByLabelText('Bowlers who advance')).toHaveValue(5);
    await user.selectOptions(screen.getByLabelText('Finals'), 'round-robin');
    expect(screen.getByLabelText('Round robin scoring')).toHaveValue('bonus-pins');
    expect(screen.getByLabelText('Bonus pins for a win')).toHaveValue(30);
    await user.selectOptions(screen.getByLabelText('Round robin scoring'), 'petersen');
    expect(screen.queryByLabelText('Bonus pins for a win')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Bowlers must have a current USBC membership'));
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    expect(onSave.mock.calls[0][0].rules).toMatchObject({
      usbcRequired: true,
      finals: { type: 'round-robin', cut: { by: 'count', value: 5 }, roundRobinScoring: 'petersen' },
    });
  });

  it('lets finals and the prize fund be for each squad', async () => {
    const user = userEvent.setup();
    const onSave = renderEvent();
    expect(screen.queryByRole('group', { name: 'Finals are for' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Entries per cash prize/), '5');
    expect(screen.getByRole('group', { name: 'Finals are for' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Finals'), 'stepladder');
    expect(screen.getByRole('button', { name: 'Whole tournament' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Each squad has its own standings, cut, prize fund, and finals.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Each squad' }));
    expect(screen.getByRole('button', { name: 'Each squad' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    expect(onSave.mock.calls[0][0].rules.finals).toMatchObject({ type: 'stepladder', scope: 'squad' });
  });
});

describe('division rules editor', () => {
  it('saves gender and prize type', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<InlineDivisionEditor division={{ ...emptyDivision(), name: 'Youth' }} usedByEventNames={[]} onSave={onSave} onCancel={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Gender'), 'women');
    await user.selectOptions(screen.getByLabelText('Prizes'), 'scholarship');
    await user.click(screen.getByRole('button', { name: 'Save division' }));
    expect(onSave.mock.calls[0][0].rules).toEqual({ gender: 'women', prizeType: 'scholarship' });
  });
});

function renderFee(fee: FeeConfig) {
  const onSave = vi.fn();
  render(<FeeEditor fee={fee} events={[]} divisions={[]} squads={[]} onSave={onSave} />);
  return onSave;
}

describe('fee editor', () => {
  it('turns a fee into brackets and explains the payout', async () => {
    const user = userEvent.setup();
    const onSave = renderFee(emptyFee(1));
    expect(screen.queryByText('Brackets', { selector: 'h3' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), 'brackets');
    expect(screen.getByLabelText('Name')).toHaveValue('Brackets');
    const price = screen.getByLabelText('Price (USD)');
    await user.clear(price);
    await user.type(price, '5');
    expect(screen.getByText('8 entries at $5 = $40: pays $30 and $10')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save add-on' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ amountCents: 500, sideEvent: { kind: 'brackets', allowQuantity: true, per: 'bowler' } });
  });

  it('warns, without blocking, when payouts and house do not match the pool', async () => {
    const user = userEvent.setup();
    renderFee({ ...emptyFee(1), name: 'Brackets', amountCents: 500, sideEvent: { kind: 'brackets', allowQuantity: true, maxQuantity: null, per: 'bowler', brackets: { scoring: 'handicap', size: 8, firstPlaceCents: 3000, secondPlaceCents: 1000, houseCents: 0, refundUnfilled: true } } });
    const house = screen.getByLabelText('House (USD)');
    await user.clear(house);
    await user.type(house, '5');
    expect(screen.getByText('8 entries at $5 = $40: pays $30 and $10, $5 to the house')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('add up to $45.00');
    expect(screen.getByRole('button', { name: 'Save add-on' })).toBeEnabled();
  });

  it('asks for a maximum quantity only when bowlers choose a quantity', async () => {
    const user = userEvent.setup();
    renderFee(emptyFee(1));
    expect(screen.queryByLabelText(/Most a bowler can buy/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Bowlers choose a quantity'));
    expect(screen.getByLabelText(/Most a bowler can buy/)).toBeInTheDocument();
  });
});
