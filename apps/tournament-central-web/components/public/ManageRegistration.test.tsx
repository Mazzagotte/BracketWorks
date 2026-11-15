import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ManageRegistration, { type ManagedRegistration } from './ManageRegistration';
import FindRegistrationForm from './FindRegistrationForm';

let token = '42.c.signature';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(token ? { token } : {}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/registration/manage',
}));

afterEach(() => {
  token = '42.c.signature';
  vi.unstubAllGlobals();
});

function managed(overrides: Partial<ManagedRegistration> = {}): ManagedRegistration {
  return {
    token: '42.c.signature',
    viewer: { name: 'Ann Lee', removed: false },
    tournament: { id: 7, name: 'Spring Doubles', dates: 'March 6, 2027', location: 'Sunset Lanes, Boise, ID', url: 'https://tournamentcentral.app/?tournament=tc-7' },
    organizer: { name: 'Jamie Smith', email: 'director@example.com', phone: '' },
    can_edit: true,
    changes_close_at: 'March 1, 2027 at 11:59 PM MST',
    registration: {
      confirmation_code: 'SD-2027-0001',
      status: 'confirmed',
      subtotal_cents: 8000,
      fees_cents: 0,
      total_cents: 8000,
      squad_name: 'Saturday AM',
      event_name: 'Doubles',
      division_name: '',
    },
    form: {
      eventId: 'evt-doubles',
      divisionId: '',
      squadId: 'sq-am',
      notes: '',
      bowlers: [
        { first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com' },
        { first_name: 'Bo', last_name: 'Ray', email: 'bo@example.com' },
      ],
      bowlerQuestionAnswers: [{}, {}],
      sideEvents: [],
    },
    ...overrides,
  };
}

const config = {
  events: [{ id: 'evt-doubles', name: 'Doubles', entryFeeCents: 8000, connectedSquadIds: ['sq-am', 'sq-pm'] }],
  divisions: [],
  squads: [{ id: 'sq-am', name: 'Saturday AM' }, { id: 'sq-pm', name: 'Saturday PM' }],
  fields: [
    { id: 'f1', key: 'first_name', label: 'First name', mode: 'required' },
    { id: 'f2', key: 'last_name', label: 'Last name', mode: 'required' },
    { id: 'f3', key: 'email', label: 'Email', mode: 'optional' },
  ],
  questions: [],
  fees: [],
};

function stubFetch(responses: Record<string, (init?: RequestInit) => { ok: boolean; status?: number; body: unknown }>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = Object.keys(responses).find((prefix) => url.startsWith(prefix));
    if (!key) throw new Error(`Unexpected fetch ${url}`);
    const { ok, status = ok ? 200 : 400, body } = responses[key](init);
    return { ok, status, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('ManageRegistration', () => {
  it('shows the registration filled in, with the cutoff and a locked event', async () => {
    stubFetch({
      '/api/v1/public/tc-registration/manage': () => ({ ok: true, body: managed() }),
      '/api/v1/public/tc-tournament/7/registration': () => ({ ok: true, body: config }),
    });
    render(<ManageRegistration />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Spring Doubles' })).toBeInTheDocument();
    expect(screen.getByText('You can change this registration until March 1, 2027 at 11:59 PM MST.')).toBeInTheDocument();
    expect(screen.getByText('SD-2027-0001')).toBeInTheDocument();
    expect(await screen.findByLabelText('Event')).toBeDisabled();
    expect(screen.getAllByLabelText('First name').map((input) => (input as HTMLInputElement).value)).toEqual(['Ann', 'Bo']);
    expect(screen.queryByText(/I have read and agree/)).not.toBeInTheDocument();
  });

  it('replaces a bowler and saves the change', async () => {
    const fetchMock = stubFetch({
      '/api/v1/public/tc-registration/manage': (init) => ({
        ok: true,
        body: init?.method === 'PUT' ? managed({ registration: { ...managed().registration, squad_name: 'Saturday AM' } }) : managed(),
      }),
      '/api/v1/public/tc-tournament/7/registration': () => ({ ok: true, body: config }),
    });
    render(<ManageRegistration />);

    fireEvent.click(await screen.findByRole('button', { name: 'Replace Bo Ray' }));
    const firstNames = screen.getAllByLabelText('First name');
    const lastNames = screen.getAllByLabelText('Last name');
    expect((firstNames[1] as HTMLInputElement).value).toBe('');
    fireEvent.change(firstNames[1], { target: { value: 'Cy' } });
    fireEvent.change(lastNames[1], { target: { value: 'Day' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Everyone on the registration and the organizer got an email/)).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(put).toBeTruthy();
    const body = JSON.parse(String(put?.[1]?.body));
    expect(body.token).toBe('42.c.signature');
    expect(body.form.bowlers[1]).toEqual({ first_name: 'Cy', last_name: 'Day' });
    expect(body.form.eventId).toBe('evt-doubles');
  });

  it('shows the error when saving is refused', async () => {
    stubFetch({
      '/api/v1/public/tc-registration/manage': (init) => (init?.method === 'PUT'
        ? { ok: false, status: 409, body: { detail: 'This squad is full' } }
        : { ok: true, body: managed() }),
      '/api/v1/public/tc-tournament/7/registration': () => ({ ok: true, body: config }),
    });
    render(<ManageRegistration />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This squad is full');
  });

  it('is read-only after the cutoff', async () => {
    stubFetch({
      '/api/v1/public/tc-registration/manage': () => ({ ok: true, body: managed({ can_edit: false, changes_close_at: 'March 1, 2027 at 11:59 PM MST' }) }),
      '/api/v1/public/tc-tournament/7/registration': () => ({ ok: true, body: config }),
    });
    render(<ManageRegistration />);

    expect(await screen.findByText(/Changes are closed \(they closed March 1, 2027 at 11:59 PM MST\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel registration' })).not.toBeInTheDocument();
    expect(screen.getByText('Questions? Contact Jamie Smith at director@example.com.')).toBeInTheDocument();
  });

  it('cancels after confirming', async () => {
    const fetchMock = stubFetch({
      '/api/v1/public/tc-registration/manage/cancel': () => ({
        ok: true,
        body: managed({ can_edit: false, registration: { ...managed().registration, status: 'cancelled' } }),
      }),
      '/api/v1/public/tc-registration/manage': () => ({ ok: true, body: managed() }),
      '/api/v1/public/tc-tournament/7/registration': () => ({ ok: true, body: config }),
    });
    render(<ManageRegistration />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel registration' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel registration' }));

    expect(await screen.findByText(/Your registration is cancelled/)).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/manage/cancel'))).toBe(true));
  });

  it('offers to email new links when the link does not work', async () => {
    stubFetch({
      '/api/v1/public/tc-registration/manage': () => ({ ok: false, status: 404, body: { detail: "This link doesn't work anymore." } }),
    });
    render(<ManageRegistration />);

    expect(await screen.findByText("This link doesn't work")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email me my links' })).toHaveAttribute('href', '/registration/find');
  });
});

describe('FindRegistrationForm', () => {
  it('sends the email and always shows the same answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<FindRegistrationForm />);

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'bo@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me my links' }));

    expect(await screen.findByText(/we've sent the links to manage it/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/public/tc-registration/manage-links');
    expect(JSON.parse(init.body)).toMatchObject({ email: 'bo@example.com', company_website: '' });
  });
});
