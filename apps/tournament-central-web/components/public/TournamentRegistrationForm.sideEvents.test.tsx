import { useEffect, useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TournamentRegistrationForm, { type RegistrationFormState } from './TournamentRegistrationForm';
import type { PublicFeeConfig } from './registrationSideEvents';

vi.mock('@/components/organizer/organizerApi', () => ({ getMyAccount: vi.fn() }));

const fields = ['first_name', 'last_name', 'average'].map((key) => ({ id: key, key, label: key, mode: 'optional' as const }));
const fees: PublicFeeConfig[] = [
  {
    id: 'fee-brackets', name: 'Handicap brackets', amountCents: 500, required: false, enabled: true, displayOrder: 1,
    sideEvent: { kind: 'brackets', allowQuantity: true, maxQuantity: 3, per: 'bowler', brackets: { scoring: 'handicap', size: 8, firstPlaceCents: 3000, secondPlaceCents: 1000 } },
  },
  { id: 'fee-high-game', name: 'High game', amountCents: 1000, required: false, enabled: true, displayOrder: 2, sideEvent: { kind: 'high-game-pot', per: 'bowler' } },
  { id: 'fee-lineage', name: 'Lineage', amountCents: 200, required: true, enabled: true, displayOrder: 3, sideEvent: { kind: 'fee', per: 'registration' } },
  { id: 'fee-doubles-only', name: 'Doubles pot', amountCents: 300, enabled: true, eventIds: ['doubles'] },
];

const single: RegistrationFormState = {
  bowlers: [{ first_name: 'Ann', last_name: 'Lee', average: '215' }],
  eventId: 'singles', squadId: 'am', divisionId: 'women', notes: '',
  bowlerQuestionAnswers: [{}], acceptTerms: false,
};

let latest: RegistrationFormState = single;

function Form({ value = single, eligibility, questions = [], division = {} }: {
  value?: RegistrationFormState;
  eligibility?: 'block' | 'warn';
  questions?: Array<{ id: string; label: string; required: boolean; type?: 'dropdown'; options?: string[] }>;
  division?: Record<string, unknown>;
}) {
  const [formState, setFormState] = useState(value);
  useEffect(() => { latest = formState; }, [formState]);
  return (
    <TournamentRegistrationForm
      tournamentName="Fall Open"
      squads={[{ id: 'am', name: 'Morning' }]}
      events={[{ id: 'singles', name: 'Singles', entryFeeCents: 6000 }]}
      divisions={[{ id: 'women', name: 'Women', ...division }]}
      fields={fields}
      fees={fees}
      startDate="2026-10-01"
      eligibility={eligibility}
      questions={questions}
      requiredBowlerCount={1}
      formState={formState}
      setFormState={setFormState}
      submitMessage={null}
      isSubmitting={false}
      onSubmit={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

afterEach(cleanup);

describe('side events on the registration form', () => {
  it('lists in-scope side events, counts picks, and shows the total in review', async () => {
    const user = userEvent.setup();
    render(<Form />);

    const section = within(screen.getByRole('region', { name: 'Side events' }));
    expect(section.getByText('Handicap brackets')).toBeInTheDocument();
    expect(section.getByText('$5 each, up to 3 per bowler')).toBeInTheDocument();
    expect(section.getByText('Pays $30 and $10 per bracket')).toBeInTheDocument();
    expect(section.getByText('$10 per bowler')).toBeInTheDocument();
    expect(section.getByText('Included with every entry')).toBeInTheDocument();
    expect(section.queryByText('Doubles pot')).not.toBeInTheDocument();
    expect(section.getByText('$2')).toBeInTheDocument();

    const more = section.getByRole('button', { name: 'More Handicap brackets for Ann Lee' });
    expect(more).not.toHaveClass(/primary/u);
    await user.click(more);
    await user.click(more);
    await user.click(more);
    expect(more).toBeDisabled();
    await user.click(section.getByRole('button', { name: 'Fewer Handicap brackets for Ann Lee' }));
    await user.click(section.getByRole('checkbox', { name: 'Add High game' }));

    expect(latest.sideEvents).toEqual([
      { feeId: 'fee-brackets', bowlerIndex: 0, quantity: 2 },
      { feeId: 'fee-high-game', bowlerIndex: 0, quantity: 1 },
    ]);
    expect(section.getByText('$22')).toBeInTheDocument();
  });

  it('shows entry fee, each side event, and the total due in review', async () => {
    const user = userEvent.setup();
    render(<Form value={{ ...single, divisionId: 'women', bowlers: [{ first_name: 'Ann', last_name: 'Lee', average: '190' }], sideEvents: [{ feeId: 'fee-brackets', bowlerIndex: 0, quantity: 2 }] }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    const review = within(screen.getByRole('dialog', { name: 'Please review before submitting' }));
    expect(review.getByText('Entry fee').nextElementSibling).toHaveTextContent('$60');
    expect(review.getByText('Handicap brackets x2').nextElementSibling).toHaveTextContent('$10');
    expect(review.getByText('Lineage').nextElementSibling).toHaveTextContent('$2');
    expect(review.getByText('Total due at check-in').nextElementSibling).toHaveTextContent('$72');
  });
});

describe('eligibility on the registration form', () => {
  const women = { maxAverage: 200, rules: { gender: 'women', prizeType: 'cash' } };

  it('asks for gender when the division needs it and blocks bowlers who do not qualify', async () => {
    const user = userEvent.setup();
    render(<Form division={women} />);

    const gender = screen.getByRole('combobox', { name: 'Gender' });
    expect(gender).toBeRequired();
    await user.selectOptions(gender, 'F');
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Ann Lee: average 215 is above the Women maximum of 200.');
    expect(screen.queryByRole('checkbox', { name: /Register anyway/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Please review before submitting' })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^average/u));
    await user.type(screen.getByLabelText(/^average/u), '190');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));
    expect(screen.getByRole('dialog', { name: 'Please review before submitting' })).toBeInTheDocument();
  });

  it('lets staff register anyway', async () => {
    const user = userEvent.setup();
    render(<Form division={women} eligibility="warn" value={{ ...single, bowlers: [{ ...single.bowlers[0], gender: 'M' }] }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to review' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ann Lee: Women is for women only.');
    expect(screen.queryByRole('dialog', { name: 'Please review before submitting' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Register anyway/u }));
    expect(latest.overrideEligibility).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));
    expect(screen.getByRole('dialog', { name: 'Please review before submitting' })).toBeInTheDocument();
  });

  it('uses a custom Gender question instead of asking twice', async () => {
    const user = userEvent.setup();
    render(<Form
      division={{ rules: { gender: 'women', prizeType: 'cash' } }}
      questions={[{ id: 'q-gender', label: 'Gender', required: true, type: 'dropdown', options: ['Man', 'Woman'] }]}
      value={{ ...single, bowlerQuestionAnswers: [{ 'q-gender': 'Man' }] }}
    />);

    expect(screen.getAllByRole('combobox', { name: 'Gender' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ann Lee: Women is for women only.');
  });
});
