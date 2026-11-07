import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ActivityList,
  Badge,
  BracketLadder,
  BracketMatch,
  BracketTree,
  BracketTwoSided,
  Button,
  ButtonLink,
  CheckboxField,
  ConfirmDialog,
  Menu,
  MenuItem,
  Modal,
  PasswordField,
  NavItem,
  Notice,
  PageColumns,
  PageHeader,
  Pagination,
  ProgressBar,
  RoundRobinGrid,
  SegmentedControl,
  SortableHeader,
  SideNav,
  StatGroup,
  TextField,
  TopNav,
  TopNavBrand,
} from '@bracketworks/ui';
import type { BracketRoundData } from '@bracketworks/ui';

describe('shared UI: buttons', () => {
  it('renders a typed button that can be disabled', async () => {
    const onClick = vi.fn();
    render(<Button variant="primary" onClick={onClick} disabled>Calculate payouts</Button>);
    const button = screen.getByRole('button', { name: 'Calculate payouts' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a link styled as a button and hides its icon from assistive tech', () => {
    render(<ButtonLink href="/register" variant="accent-outline" icon={<svg data-testid="icon" />}>Register</ButtonLink>);
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('shared UI: form fields', () => {
  it('associates the label, marks optional fields, and describes errors', () => {
    render(
      <>
        <TextField label="USBC number" optional helper="Found on your USBC card." />
        <TextField label="Average" error="Average must be 300 or less." defaultValue="310" />
      </>,
    );
    const usbc = screen.getByLabelText(/USBC number/);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(usbc).toHaveAccessibleDescription('Found on your USBC card.');

    const average = screen.getByLabelText('Average');
    expect(average).toHaveAttribute('aria-invalid', 'true');
    expect(average).toHaveAccessibleDescription('Average must be 300 or less.');
  });

  it('shows and hides a password with a labelled toggle', async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" defaultValue="secret" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('labels a checkbox, describes it with helper text, and toggles from the label', async () => {
    const user = userEvent.setup();
    render(<CheckboxField label="Also sign out this device" helper="Other devices are always signed out." />);
    const checkbox = screen.getByRole('checkbox', { name: 'Also sign out this device' });
    expect(checkbox).toHaveAccessibleDescription('Other devices are always signed out.');
    await user.click(screen.getByText('Also sign out this device'));
    expect(checkbox).toBeChecked();
  });
});

describe('shared UI: segmented control', () => {
  it('marks the selected option and reports changes', async () => {
    function Harness() {
      const [value, setValue] = useState<'upcoming' | 'past'>('upcoming');
      return (
        <SegmentedControl
          label="When"
          value={value}
          onChange={setValue}
          options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past', count: 3 }]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'When' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Past/ }));
    expect(screen.getByRole('button', { name: /Past/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('shared UI: modal and confirm dialog', () => {
  it('moves focus in, closes on Escape, and restores focus', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Switch tournament</button>
          <Modal open={open} onClose={() => setOpen(false)} title="All tournaments" description="9 available">
            <p>List</p>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Switch tournament' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'All tournaments' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('9 available');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('confirms or cancels', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Archive tournament?" description="Bowlers will no longer see it." confirmLabel="Archive" tone="danger" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('shared UI: sortable header', () => {
  it('announces the sort state and sorts from a keyboard-reachable button', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader column="name" sortConfig={{ column: 'name', direction: 'asc' }} onSort={onSort}>Bowler</SortableHeader>
          </tr>
        </thead>
      </table>,
    );
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Bowler' }));
    expect(onSort).toHaveBeenCalledWith('name');
  });
});

describe('shared UI: pagination', () => {
  it('marks the current page and disables next on the last page', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} pageCount={3} onPageChange={onPageChange} summary="Showing 21-22 of 22" />);
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Page 1' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});

describe('shared UI: page content', () => {
  it('renders a single h1 page header with badge, facts, and actions', () => {
    render(<PageHeader title="Brass Monkey ID State" badge={<Badge tone="success">Scores complete</Badge>} description="May 30, 2026" actions={<Button>Edit</Button>} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Scores complete')).toBeInTheDocument();
  });

  it('renders stats, progress, notices, activity, and side navigation', async () => {
    const onSelect = vi.fn();
    render(
      <>
        <StatGroup label="Tournament totals" items={[{ label: 'Players', value: '22' }, { label: 'Prize fund', value: '$2,182', detail: 'After house fee' }]} />
        <ProgressBar value={22} max={22} label="Bowlers scored" valueText="22 of 22 scored" />
        <Notice tone="warning" role="status">Registration closes in 3 days.</Notice>
        <ActivityList items={[{ id: '1', title: 'A score was changed', time: 'Oct 1, 5:56 PM', detail: 'Reason: corrected score' }]} />
        <SideNav label="Setup steps" activeId="details" onSelect={onSelect} sections={[{ heading: 'Setup', items: [{ id: 'details', label: 'Tournament details' }, { id: 'squads', label: 'Squads', meta: 'Optional' }] }]} />
      </>,
    );
    expect(screen.getByRole('region', { name: 'Tournament totals' })).toHaveTextContent('$2,182');
    expect(screen.getByRole('progressbar', { name: 'Bowlers scored' })).toHaveAttribute('value', '22');
    expect(screen.getByRole('status')).toHaveTextContent('Registration closes in 3 days.');
    expect(screen.getByText('A score was changed').closest('li')).toHaveTextContent('Reason: corrected score');
    expect(screen.getByRole('button', { name: /Tournament details/ })).toHaveAttribute('aria-current', 'step');
    await userEvent.click(screen.getByRole('button', { name: /Squads/ }));
    expect(onSelect).toHaveBeenCalledWith('squads');
  });
});

describe('shared UI: menu and top bar', () => {
  it('opens a menu, moves with arrow keys, closes on Escape, and returns focus', async () => {
    const onLogout = vi.fn();
    render(
      <Menu triggerLabel="Open account menu" trigger={<span>JM</span>} header="James Mazzagotte">
        <MenuItem href="/organizer/account">Account settings</MenuItem>
        <MenuItem onSelect={onLogout} tone="danger">Log out</MenuItem>
      </Menu>,
    );
    const trigger = screen.getByRole('button', { name: 'Open account menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'account menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Account settings' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders the top bar with context, nav, actions, and a mobile menu', () => {
    render(
      <TopNav
        brand={<TopNavBrand href="/organizer" mark={<svg aria-hidden="true" />} name="Tournament Central" />}
        contextTitle="Ada County USBC BVL Fundraiser"
        contextMeta="Nov 15, 2026"
        navLabel="Organizer"
        actions={<button type="button">Account</button>}
      >
        <NavItem href="/organizer" active>Dashboard</NavItem>
        <NavItem href="/organizer/tournaments/5">Overview</NavItem>
      </TopNav>,
    );
    expect(screen.getByRole('link', { name: 'Tournament Central' })).toHaveAttribute('href', '/organizer');
    const desktopNav = screen.getByRole('navigation', { name: 'Organizer' });
    expect(desktopNav).toContainElement(screen.getAllByRole('link', { name: 'Dashboard' })[0] ?? null);
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Ada County USBC BVL Fundraiser')).toBeInTheDocument();
  });

  it('lays out page columns', () => {
    render(<PageColumns main={<p>Main column</p>} side={<p>Side column</p>} />);
    expect(screen.getByText('Main column')).toBeInTheDocument();
    expect(screen.getByText('Side column')).toBeInTheDocument();
  });
});

describe('shared UI: brackets', () => {
  it('marks the winner with a check, shows the margin, and highlights a clicked bowler', async () => {
    const onPlayerClick = vi.fn();
    render(
      <BracketMatch
        label="Semifinal 1"
        players={[{ name: 'Pat Lee', score: 214, winner: true }, { name: 'Sam Roe', score: 179 }]}
        onPlayerClick={onPlayerClick}
      />,
    );
    const match = screen.getByRole('group', { name: 'Semifinal 1' });
    expect(match).toHaveTextContent('+35');
    expect(screen.getByRole('img', { name: 'Winner' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Sam Roe/ }));
    expect(onPlayerClick).toHaveBeenCalledWith('Sam Roe');
  });

  it('shows open slots and a note instead of a margin', () => {
    render(<BracketMatch label="Final" players={[{ name: 'Pat Lee' }, {}]} note="Split pot" />);
    expect(screen.getByText('To be decided')).toBeInTheDocument();
    expect(screen.getByText('Split pot')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Winner' })).not.toBeInTheDocument();
  });

  const rounds: BracketRoundData[] = [
    { title: 'Semifinals', matches: [
      { label: 'Semifinal 1', players: [{ name: 'Pat Lee', score: 220, winner: true }, { name: 'Sam Roe', score: 190 }] },
      { label: 'Semifinal 2', players: [{ name: 'Ada Fox', score: 205, winner: true }, { name: 'Lou Kim', score: 201 }] },
    ] },
    { title: 'Final', matches: [{ label: 'Final', players: [{ name: 'Pat Lee', score: 214, winner: true }, { name: 'Ada Fox', score: 191 }] }] },
  ];

  it('lays rounds out as a tree with a champion column', () => {
    render(<BracketTree label="Handicap bracket 1" rounds={rounds} champion={{ name: 'Pat Lee', detail: 'Won the final 214 to 191' }} />);
    const sections = screen.getAllByRole('region', { name: /./ });
    expect(sections[0]).toHaveAccessibleName('Handicap bracket 1');
    expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Semifinals', 'Final', 'Champion']);
    expect(screen.getByText('Won the final 214 to 191')).toBeInTheDocument();
  });

  it('stacks the champion first and the final before earlier rounds on phones', () => {
    render(<BracketTree layout="stacked" rounds={rounds} champion={null} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Champion', 'Final', 'Semifinals']);
    expect(screen.getByText('Decided after the final')).toBeInTheDocument();
  });
});

describe('shared UI: finals shapes', () => {
  const ladder = [
    { id: 'm1', label: 'Match 1', players: [{ seed: 4, name: 'Dave Kim', score: 291, winner: true }, { seed: 3, name: 'Terry Wallace', score: 249 }] },
    { id: 'm2', label: 'Match 2', players: [{ seed: 4, name: 'Dave Kim', score: 201 }, { seed: 2, name: 'Robin Hayes', score: null }] },
    { id: 'm3', label: 'Title match', players: [{ name: null }, { seed: 1, name: 'Alex Brooks' }] },
  ] as Parameters<typeof BracketLadder>[0]['matches'];

  it('draws a stepladder bottom-up with the current match, seed waits, and the champion slot', () => {
    render(<BracketLadder label="Singles stepladder" matches={ladder} highlightMatchId="m2" champion={null} />);
    const region = screen.getByRole('region', { name: 'Singles stepladder' });
    // Match 1 comes first in reading order (drawn on the bottom rung), the champion last (drawn on top).
    const groups = within(region).getAllByRole('group').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual(['Match 1', 'Match 2', 'Title match', 'Champion']);
    const current = screen.getByRole('group', { name: 'Match 2' });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).toHaveTextContent('Now bowling');
    expect(screen.getByRole('group', { name: 'Match 1' })).not.toHaveAttribute('aria-current');
    const title = screen.getByRole('group', { name: 'Title match' });
    expect(title).toHaveTextContent('Seed 1 waits');
    expect(title).toHaveTextContent('Winner of Match 2');
    expect(screen.getByText('Decided after the title match')).toBeInTheDocument();
  });

  it('shows the stepladder champion and To be decided for a rung with no one set', () => {
    render(
      <BracketLadder
        matches={[...ladder.slice(0, 1), { id: 'a', label: 'Match 2', players: [{ name: null }, { name: null }] }]}
        champion={{ name: 'Robin Hayes', detail: 'Won the title match 284 to 265' }}
      />,
    );
    expect(screen.getByRole('group', { name: 'Match 2' }).textContent).toContain('Winner of Match 1');
    expect(screen.getByRole('group', { name: 'Match 2' }).textContent).toContain('To be decided');
    expect(within(screen.getByRole('group', { name: 'Champion' })).getByText('Robin Hayes')).toBeInTheDocument();
    expect(screen.getByText('Won the title match 284 to 265')).toBeInTheDocument();
  });

  const eight = (): Parameters<typeof BracketTwoSided>[0]['rounds'] => [
    { title: 'Quarterfinals', matches: [1, 2, 3, 4].map((n) => ({ id: `q${n}`, label: `Quarterfinal ${n}`, players: [{ name: `Top ${n}` }, { name: `Low ${n}` }] })) },
    { title: 'Semifinals', matches: [1, 2].map((n) => ({ id: `s${n}`, label: `Semifinal ${n}`, players: [{ name: null }, { name: null }] })) },
    { title: 'Final', matches: [{ id: 'f', label: 'Final', players: [{ name: null }, { name: null }] }] },
  ];

  it('splits 8+ match play into two halves converging on the final', () => {
    render(<BracketTwoSided label="Match play" rounds={eight()} champion={null} />);
    const left = screen.getByRole('region', { name: 'Quarterfinals, left half' });
    const right = screen.getByRole('region', { name: 'Quarterfinals, right half' });
    expect(within(left).getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(['Quarterfinal 1', 'Quarterfinal 2']);
    expect(within(right).getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(['Quarterfinal 3', 'Quarterfinal 4']);
    expect(within(screen.getByRole('region', { name: 'Semifinals, left half' })).getByRole('group', { name: 'Semifinal 1' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Semifinals, right half' })).getByRole('group', { name: 'Semifinal 2' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Final' })).getByRole('group', { name: 'Final' })).toBeInTheDocument();
    expect(screen.getByText('Decided after the final')).toBeInTheDocument();
  });

  it('falls back to the tree for fewer than 8 finalists and on phones', () => {
    const { unmount } = render(<BracketTwoSided rounds={eight().slice(1)} />);
    expect(screen.queryByRole('region', { name: /left half/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Semifinals', 'Final', 'Champion']);
    unmount();
    render(<BracketTwoSided layout="stacked" rounds={eight()} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Champion', 'Final', 'Semifinals', 'Quarterfinals']);
  });

  it('draws a round robin head-to-head grid with W, L, and T in text', () => {
    render(
      <RoundRobinGrid
        label="Doubles head to head"
        players={[{ key: 'a', seed: 1, name: 'Ann Lee' }, { key: 'b', seed: 2, name: 'Bob Ray' }, { key: 'c', seed: 3, name: 'Cara Diaz' }]}
        games={[
          { a: { key: 'a', score: 214 }, b: { key: 'b', score: 190 } },
          { a: { key: 'a', score: 200 }, b: { key: 'c', score: 200 } },
          { a: { key: 'b', score: 180 }, b: { key: 'c', score: null } },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Doubles head to head' });
    expect(within(table).getByRole('columnheader', { name: 'Bob Ray' })).toHaveTextContent('2');
    const rows = within(table).getAllByRole('row').slice(1);
    const cells = (index: number) => within(rows[index]).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells(0)).toEqual(['', '214 W', '200 T']);
    expect(cells(1)).toEqual(['190 L', '', '180']);
    expect(cells(2)).toEqual(['200 T', '—', '']);
    const win = within(rows[0]).getAllByRole('cell')[1];
    expect(win).toHaveAttribute('data-emphasis', 'true');
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveAttribute('data-tone', 'secondary');
    expect(win).toHaveAttribute('data-align', 'right');
  });
});
