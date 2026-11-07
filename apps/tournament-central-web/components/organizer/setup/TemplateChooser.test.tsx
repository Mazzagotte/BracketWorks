import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOURNAMENT_TEMPLATES } from '../tournamentTemplates';
import TemplateChooser from './TemplateChooser';

afterEach(cleanup);

describe('TemplateChooser', () => {
  it('lists every tournament type with its description', () => {
    render(<TemplateChooser onChoose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'What kind of tournament?' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(TOURNAMENT_TEMPLATES.length);
    expect(screen.getByText(TOURNAMENT_TEMPLATES[0].description)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep current setup' })).not.toBeInTheDocument();
  });

  it('applies the picked type', async () => {
    const onChoose = vi.fn();
    render(<TemplateChooser onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: /^Sweeper/ }));
    expect(onChoose).toHaveBeenCalledWith('sweeper');
  });

  it('starts blank', async () => {
    const onChoose = vi.fn();
    render(<TemplateChooser onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start blank' }));
    expect(onChoose).toHaveBeenCalledWith(null);
  });

  it('lets the organizer keep the current setup when changing type', async () => {
    const onCancel = vi.fn();
    render(<TemplateChooser onChoose={vi.fn()} onCancel={onCancel} currentTemplateId="youth" />);
    expect(screen.getByText('Current')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep current setup' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
