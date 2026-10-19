import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';
import ConfigDrawer from './ConfigDrawer';
import { useConfirmation } from './useConfirmation';

afterEach(cleanup);

function Harness({ onResult = () => {} }: { onResult?: (confirmed: boolean) => void }) {
  const { confirm, confirmationDialog } = useConfirmation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  return <>
    <button onClick={() => setDrawerOpen(true)}>Edit squad</button>
    <ConfigDrawer open={drawerOpen} title="Squad" onClose={() => setDrawerOpen(false)}>
      <button onClick={async () => onResult(await confirm({
        title: 'Delete squad?', message: 'References will also be removed.', confirmLabel: 'Delete squad', tone: 'danger',
      }))}>Request deletion</button>
    </ConfigDrawer>
    {confirmationDialog}
  </>;
}

describe('shared organizer confirmations', () => {
  it('traps focus in a nested confirmation, cancels only the top dialog and restores focus', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    await user.click(screen.getByRole('button', { name: 'Edit squad' }));
    const trigger = screen.getByRole('button', { name: 'Request deletion' });
    await user.click(trigger);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete squad?' });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription('References will also be removed.');
    expect(document.body.style.overflow).toBe('hidden');
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Delete squad' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Close confirmation' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Squad' })).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit squad' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('confirms once, without closing the underlying drawer', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    await user.click(screen.getByRole('button', { name: 'Edit squad' }));
    await user.click(screen.getByRole('button', { name: 'Request deletion' }));
    await user.click(screen.getByRole('button', { name: 'Delete squad' }));
    expect(onResult).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('cancels on backdrop clicks and resolves pending requests on unmount', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const { unmount } = render(<Harness onResult={onResult} />);
    await user.click(screen.getByRole('button', { name: 'Edit squad' }));
    await user.click(screen.getByRole('button', { name: 'Request deletion' }));
    await user.click(screen.getByRole('alertdialog').parentElement!);
    expect(onResult).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Request deletion' }));
    unmount();
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('blocks dismissal and duplicate submissions while busy and displays errors', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete tournament?" message="This cannot be undone."
      busy error="Unable to delete tournament." confirmLabel="Deleting..." onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to delete tournament.');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('alertdialog').parentElement!);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Deleting...' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
