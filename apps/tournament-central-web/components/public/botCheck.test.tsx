import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BotTrapField, botCheckPayload } from './botCheck';

describe('bot check', () => {
  it('reports the trap value and how long the form was open', () => {
    vi.spyOn(Date, 'now').mockReturnValue(20_000);
    expect(botCheckPayload('', 12_000)).toEqual({ company_website: '', fill_seconds: 8 });
    expect(botCheckPayload(undefined, undefined)).toEqual({ company_website: '', fill_seconds: null });
    vi.restoreAllMocks();
  });

  it('keeps the trap field away from people and screen readers', () => {
    render(<BotTrapField value="" onChange={() => {}} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    const input = document.getElementById('company-website-check');
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });
});
