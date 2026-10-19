import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TournamentInformation from './TournamentInformation';
import TournamentRegistrationForm from './TournamentRegistrationForm';
import TournamentRules from './TournamentRules';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rulesText = '1. Check in early.\n\n2. Averages < 200 must be verified.\n<script>not executable</script>';
const documents = [{ name: 'Rules.pdf', kind: 'rules', url: '/rules.pdf' }];

describe('public tournament rules', () => {
  it('shows pasted rules and document downloads together, treating markup as plain text', () => {
    const { container } = render(<TournamentRules rulesText={rulesText} documents={documents} />);
    expect(screen.getByText(/1\. Check in early/).textContent).toBe(rulesText);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByRole('link', { name: 'Rules.pdf (rules)' })).toHaveAttribute('download');
    expect(screen.queryByText('Rules and documents have not been posted.')).not.toBeInTheDocument();
  });

  it('displays saved rules in the public tournament details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ details: { rulesText }, documents }),
    }));
    render(<TournamentInformation configUrl="/config" />);
    expect((await screen.findByText(/1\. Check in early/)).textContent).toBe(rulesText);
    expect(screen.getByRole('link', { name: 'Rules.pdf (rules)' })).toHaveAttribute('href', '/rules.pdf');
  });

  it('makes rules and documents available when registering directly', async () => {
    const user = userEvent.setup();
    render(<TournamentRegistrationForm tournamentName="Open" squads={[]} events={[]} divisions={[]}
      fields={[]} questions={[]} requiredBowlerCount={1} rulesText={rulesText} documents={documents}
      formState={{ bowlers: [{}], eventId: '', divisionId: '', squadId: '', notes: '', bowlerQuestionAnswers: [{}], acceptTerms: false }}
      setFormState={vi.fn()} submitMessage={null} isSubmitting={false} onSubmit={vi.fn()} />);
    await user.click(screen.getByText('Review tournament rules and documents'));
    expect(screen.getByText(/1\. Check in early/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Rules.pdf (rules)' })).toHaveAttribute('href', '/rules.pdf');
  });
});
