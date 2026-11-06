import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ActivityList,
  Badge,
  Button,
  ButtonLink,
  ConfirmDialog,
  Menu,
  MenuItem,
  Modal,
  NavItem,
  Notice,
  PageColumns,
  PageHeader,
  Pagination,
  ProgressBar,
  SegmentedControl,
  SideNav,
  StatGroup,
  TextField,
  TopNav,
  TopNavBrand,
} from '@bracketworks/ui';

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
