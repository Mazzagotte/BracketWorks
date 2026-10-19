import { useState } from 'react';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyAccount } from '@/components/organizer/organizerApi';
import TournamentRegistrationForm, { type RegistrationFormState } from './TournamentRegistrationForm';

vi.mock('@/components/organizer/organizerApi', () => ({ getMyAccount: vi.fn() }));

const fields = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'usbc_number', 'average']
  .map((key) => ({ id: key, key, label: key, mode: 'optional' as const }));
const initial: RegistrationFormState = {
  bowlers: [
    { first_name: 'Alex', last_name: 'One', email: 'alex@example.com', phone: '123', address: '1 Main', city: 'Boise', state: 'ID', zip: '83701', usbc_number: '111', average: '190' },
    { first_name: 'Sam', last_name: 'Two', usbc_number: '222', average: '180' },
  ],
  eventId: 'doubles', squadId: 'am', divisionId: '', notes: '',
  bowlerQuestionAnswers: [{ shirt: 'Large' }, { shirt: 'Small' }], acceptTerms: false,
};
const submit = vi.fn();
const done = vi.fn();

function Form({ value = initial, receipt = false, requiredEmail = false }: {
  value?: RegistrationFormState; receipt?: boolean; requiredEmail?: boolean;
}) {
  const [formState, setFormState] = useState(value);
  return <TournamentRegistrationForm tournamentName="Fall Open"
    squads={[{ id: 'am', name: 'Morning' }]} events={[{ id: 'doubles', name: 'Doubles' }]} divisions={[]}
    fields={requiredEmail ? fields.map((field) => ({ ...field, mode: field.key === 'email' ? 'required' : field.mode })) : fields}
    questions={[{ id: 'shirt', label: 'Shirt size', required: false }]}
    requiredBowlerCount={2} formState={formState} setFormState={setFormState}
    submitMessage={null} isSubmitting={false} onSubmit={submit} onClose={done}
    confirmation={receipt ? { code: 'FO-2026-0001', status: 'waitlisted' } : null} />;
}

function bowler(index: number) {
  const heading = screen.getByRole('heading', { name: `Bowler ${index}` });
  if (!heading.parentElement) throw new Error('Bowler section missing');
  return within(heading.parentElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
afterEach(cleanup);

describe('registration conveniences and review flow', () => {
  it.each([1, 2])('exposes the %i-bowler requirement as one coherent text node and names all controls', (count) => {
    const { container } = render(<TournamentRegistrationForm tournamentName="Open" squads={[]} events={[]} divisions={[]}
      fields={[]} questions={[]} requiredBowlerCount={count} formState={initial} setFormState={vi.fn()}
      submitMessage={null} isSubmitting={false} onSubmit={submit} onClose={done} />);
    const sentence = `This event requires ${count} bowler ${count === 1 ? 'form' : 'forms'}.`;
    const paragraph = screen.getByText(sentence);
    const textNodes = Array.from(paragraph.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
    expect(textNodes.map((node) => node.textContent)).toEqual([sentence]);
    for (const control of container.querySelectorAll('a, button, summary')) {
      expect(control).toHaveAccessibleName();
    }
    for (const icon of container.querySelectorAll('svg')) {
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('copies only contact/address once and allows independent editing afterward', async () => {
    const user = userEvent.setup();
    render(<Form />);
    await user.click(screen.getByRole('button', { name: 'Copy address/contact from Bowler 1' }));
    for (const key of ['email', 'phone', 'address', 'city', 'state', 'zip']) {
      expect(bowler(2).getByLabelText(key)).toHaveValue(initial.bowlers[0][key]);
    }
    expect(bowler(2).getByLabelText('first_name')).toHaveValue('Sam');
    expect(bowler(2).getByLabelText('usbc_number')).toHaveValue('222');
    expect(bowler(2).getByLabelText('average')).toHaveValue(180);
    await user.clear(bowler(1).getByLabelText('address'));
    await user.type(bowler(1).getByLabelText('address'), '2 Main');
    expect(bowler(2).getByLabelText('address')).toHaveValue('1 Main');
    await user.clear(bowler(2).getByLabelText('email'));
    await user.type(bowler(2).getByLabelText('email'), 'sam@example.com');
    expect(bowler(1).getByLabelText('email')).toHaveValue('alex@example.com');
  });

  it('offers opt-in profile prefill only to signed-in users and preserves typed details', async () => {
    sessionStorage.setItem('access_token', 'session');
    vi.mocked(getMyAccount).mockResolvedValue({
      id: 1, first_name: 'Account', last_name: 'Player', email: 'account@example.com',
      username: 'player', is_admin: false, email_verified: true,
    });
    const user = userEvent.setup();
    render(<Form value={{ ...initial, bowlers: [{ first_name: 'Already typed' }, initial.bowlers[1]] }} />);
    expect(getMyAccount).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Use my account information' }));
    await waitFor(() => expect(bowler(1).getByLabelText('email')).toHaveValue('account@example.com'));
    expect(bowler(1).getByLabelText('first_name')).toHaveValue('Already typed');
    expect(bowler(1).getByLabelText('last_name')).toHaveValue('Player');
    expect(bowler(2).getByLabelText('first_name')).toHaveValue('Sam');
  });

  it('does not offer profile prefill to visitors and explains payment before data entry', () => {
    render(<Form />);
    expect(screen.queryByRole('button', { name: 'Use my account information' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Payment timing')).toHaveTextContent('cash at the venue during check-in');
    expect(screen.getByLabelText('Registration progress').querySelector('[aria-current="step"]')).toHaveTextContent('Details');
  });

  it('reports profile errors without clearing existing details', async () => {
    sessionStorage.setItem('access_token', 'session');
    vi.mocked(getMyAccount).mockRejectedValue(new Error('Unable to load profile.'));
    const user = userEvent.setup();
    render(<Form />);
    await user.click(screen.getByRole('button', { name: 'Use my account information' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load profile.');
    expect(bowler(1).getByLabelText('first_name')).toHaveValue('Alex');
  });

  it('reviews both bowlers and answers, allows going back, and submits only after agreement', async () => {
    const user = userEvent.setup();
    render(<Form />);
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }));
    const dialog = screen.getByRole('dialog', { name: 'Please review before submitting' });
    expect(within(dialog).getByLabelText('Registration progress').querySelector('[aria-current="step"]')).toHaveTextContent('Review');
    expect(within(dialog).getByRole('listitem', { name: 'Details, completed' })).toBeInTheDocument();
    const review = within(dialog).getByRole('region', { name: 'Registration review' });
    expect(review).toHaveTextContent('Doubles');
    expect(review).toHaveTextContent('Morning');
    expect(review).toHaveTextContent('Alex');
    expect(review).toHaveTextContent('Sam');
    expect(review).toHaveTextContent('Large');
    expect(review).toHaveTextContent('Small');
    expect(within(dialog).getByRole('button', { name: 'Agree & Submit Registration' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Go Back' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bowler(1).getByLabelText('first_name')).toHaveValue('Alex');
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }));
    await user.click(screen.getByRole('checkbox', { name: 'I have read and agree to this disclosure.' }));
    await user.click(screen.getByRole('button', { name: 'Agree & Submit Registration' }));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('does not enter review when a required field is missing', async () => {
    const user = userEvent.setup();
    render(<Form requiredEmail />);
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('shows a focused confirmation with the real code and waitlist status without a resubmit button', async () => {
    const user = userEvent.setup();
    render(<Form receipt />);
    expect(screen.getByText('FO-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Status: waitlisted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Registration received' })).toHaveFocus();
    expect(screen.getByLabelText('Registration progress').querySelector('[aria-current="step"]')).toHaveTextContent('Confirmation');
    expect(screen.getByRole('listitem', { name: 'Details, completed' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Review, completed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue to Review' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
