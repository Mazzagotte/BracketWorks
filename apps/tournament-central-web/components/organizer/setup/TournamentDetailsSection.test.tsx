import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultTournamentDetails } from '../setupDefaults';
import type { TournamentDetails } from '../setupTypes';
import TournamentDetailsSection from './TournamentDetailsSection';

afterEach(cleanup);

function section(details: TournamentDetails) {
  return <TournamentDetailsSection
    details={details} setDetails={vi.fn()}
    statusBySection={{ 'tournament-details': 'needs-attention', 'events-divisions': 'incomplete', 'squads-availability': 'incomplete', 'registration-setup': 'incomplete', 'fees-payments-documents': 'incomplete', 'review-publish': 'incomplete' }}
    supportEmailLooksValid={true}
    hasLogoAsset={false} logoAssetName="" logoAssetMeta="" logoPreviewUrl={null}
    isLogoDragActive={false} logoUploadError={null} pendingLogoFile={null}
    tournamentDateOrderInvalid={false} registrationDateOrderInvalid={false}
    registrationAfterEndInvalid={details.registrationCloseIso > details.endDateIso}
    usStates={[]} timezones={[]} logoInputRef={createRef<HTMLInputElement>()}
    handleLogoInputChange={vi.fn()} handleLogoDrop={vi.fn()} clearLogo={vi.fn()} setIsLogoDragActive={vi.fn()}
  />;
}

describe('existing tournament deadline errors', () => {
  it('visibly flags an existing invalid deadline at its field without changing the value', () => {
    const details = {
      ...defaultTournamentDetails, startDateIso: '2026-11-15', endDateIso: '2026-11-15',
      registrationOpenIso: '2026-11-01', registrationCloseIso: '2026-11-16',
    };
    const view = render(section(details));
    const input = screen.getByLabelText(/Registration closes/);
    expect(input).toHaveValue('2026-11-16');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Registration must close on or before the final tournament day.');
    view.rerender(section({ ...details, registrationCloseIso: '2026-11-15' }));
    expect(screen.getByLabelText(/Registration closes/)).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('registration emails', () => {
  it('is off by default and hides the address field', () => {
    render(section(defaultTournamentDetails));
    expect(screen.getByLabelText('Email me when someone registers')).not.toBeChecked();
    expect(screen.queryByLabelText(/Send to/)).toBeNull();
  });

  it('shows the address field when on, with the contact email as the placeholder', () => {
    render(section({ ...defaultTournamentDetails, supportEmail: 'director@example.com', registrationNotifications: true }));
    expect(screen.getByLabelText('Email me when someone registers')).toBeChecked();
    expect(screen.getByLabelText(/Send to/)).toHaveAttribute('placeholder', 'director@example.com');
  });

  it('flags an address that is not an email', () => {
    render(section({ ...defaultTournamentDetails, registrationNotifications: true, registrationNotificationEmail: 'nope' }));
    expect(screen.getByLabelText(/Send to/)).toHaveAttribute('aria-invalid', 'true');
  });
});
