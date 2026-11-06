import { PencilLine, Trash2, Upload } from 'lucide-react';
import { Button, Card, CardDivider, CardHeader, FormGrid, ICON_SIZE, Notice, SegmentedControl, SelectField, TextField } from '@bracketworks/ui';
import { useEffect, useState } from 'react';
import type { ChangeEvent, Dispatch, DragEvent, RefObject, SetStateAction } from 'react';

import StepHeader from './StepHeader';
import layout from './setupLayout.module.css';
import local from './TournamentDetailsSection.module.css';
import type { SetupSectionKey, SetupStatus } from '../types';
import type { TournamentDetails } from '../setupTypes';
import { registrationDateErrors } from '@/lib/registrationDates';

type TimezoneOption = { value: string; label: string };
type UsStateOption = { code: string; name: string };

type VenueSearchResult = {
  source: 'internal' | 'external';
  venue: {
    id?: number;
    name: string;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    external_provider?: string | null;
    external_place_id?: string | null;
  };
};

type TournamentDetailsSectionProps = {
  details: TournamentDetails;
  setDetails: Dispatch<SetStateAction<TournamentDetails>>;
  statusBySection: Record<SetupSectionKey, SetupStatus>;
  supportEmailLooksValid: boolean;
  hasLogoAsset: boolean;
  logoAssetName: string;
  logoAssetMeta: string;
  logoPreviewUrl: string | null;
  isLogoDragActive: boolean;
  logoUploadError: string | null;
  pendingLogoFile: File | null;
  tournamentDateOrderInvalid: boolean;
  registrationDateOrderInvalid: boolean;
  registrationAfterEndInvalid: boolean;
  usStates: UsStateOption[];
  timezones: TimezoneOption[];
  logoInputRef: RefObject<HTMLInputElement>;
  handleLogoInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleLogoDrop: (event: DragEvent<HTMLDivElement>) => void;
  clearLogo: () => Promise<void> | void;
  setIsLogoDragActive: (isActive: boolean) => void;
};

export default function TournamentDetailsSection({
  details,
  setDetails,
  statusBySection,
  supportEmailLooksValid,
  hasLogoAsset,
  logoAssetName,
  logoAssetMeta,
  logoPreviewUrl,
  isLogoDragActive,
  logoUploadError,
  pendingLogoFile,
  tournamentDateOrderInvalid,
  registrationDateOrderInvalid,
  registrationAfterEndInvalid,
  usStates,
  timezones,
  logoInputRef,
  handleLogoInputChange,
  handleLogoDrop,
  clearLogo,
  setIsLogoDragActive,
}: TournamentDetailsSectionProps) {
  const dateErrors = registrationDateErrors(details);
  const [identityTouched, setIdentityTouched] = useState({ name: false, organizer: false, tournamentType: false });
  const [contactTouched, setContactTouched] = useState({ name: false, email: false, phone: false });
  const [logoDimensions, setLogoDimensions] = useState<string | null>(null);
  const [venueSearchResults, setVenueSearchResults] = useState<VenueSearchResult[]>([]);
  const [isVenueSearchLoading, setIsVenueSearchLoading] = useState(false);
  const [venueSearchError, setVenueSearchError] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<'search' | 'manual'>('search');
  const hasSelectedVenue = details.venueId !== null || Boolean(details.venueExternalPlaceId);

  useEffect(() => {
    const query = details.bowlingCenter.trim();
    if (locationMode !== 'search' || hasSelectedVenue) {
      setVenueSearchResults([]);
      setIsVenueSearchLoading(false);
      return;
    }
    if (query.length < 2) {
      setVenueSearchResults([]);
      setIsVenueSearchLoading(false);
      setVenueSearchError(null);
      return;
    }

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setVenueSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsVenueSearchLoading(true);
      setVenueSearchError(null);

      void fetch(`/api/v1/tc/venues/search?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => null) as VenueSearchResult[] | { detail?: string } | null;
          if (cancelled) {
            return;
          }

          if (!response.ok) {
            const detail = payload && typeof (payload as { detail?: string }).detail === 'string'
              ? (payload as { detail?: string }).detail
              : `Venue search failed (${response.status})`;
            throw new Error(detail);
          }

          setVenueSearchResults(Array.isArray(payload) ? payload : []);
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          setVenueSearchResults([]);
          setVenueSearchError(error instanceof Error ? error.message : 'Venue search failed.');
        })
        .finally(() => {
          if (!cancelled) {
            setIsVenueSearchLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [details.bowlingCenter, hasSelectedVenue, locationMode]);

  const clearVenueSelection = () => setDetails((prev) => ({ ...prev, venueId: null, venueExternalProvider: '', venueExternalPlaceId: '', venueLatitude: null, venueLongitude: null }));
  const nameError = identityTouched.name && !details.name.trim() ? 'Tournament name is required.' : undefined;
  const organizerError = identityTouched.organizer && !details.organizer.trim() ? 'Host organization is required.' : undefined;
  const typeError = identityTouched.tournamentType && !details.tournamentType ? 'Tournament type is required.' : undefined;
  const startError = !details.startDateIso ? 'Start date is required.' : undefined;
  const endError = !details.endDateIso
    ? 'End date is required.'
    : tournamentDateOrderInvalid ? 'End date must be on or after start date.' : undefined;
  const openError = !details.registrationOpenIso ? 'Registration open date is required.' : dateErrors.registrationOpenIso || undefined;
  const closeError = !details.registrationCloseIso ? 'Registration close date is required.' : dateErrors.registrationCloseIso || undefined;
  const openTimeError = dateErrors.registrationOpenTime || dateErrors.registrationOpenIso || undefined;
  const closeTimeError = dateErrors.registrationCloseTime || dateErrors.registrationCloseIso || undefined;
  const contactNameError = contactTouched.name && !details.contactName.trim() ? 'Contact name is required.' : undefined;
  const contactEmailError = contactTouched.email && !supportEmailLooksValid ? 'Enter a valid contact email.' : undefined;
  const contactPhoneError = contactTouched.phone && details.preferredContactMethod === 'phone' && !details.supportPhone.trim()
    ? 'Phone is required when it is the preferred contact method.'
    : undefined;

  return (
    <>
      <StepHeader
        title="Tournament details"
        description="Basic information used throughout Tournament Central and during registration."
        status={statusBySection['tournament-details']}
      />

      <div className={layout.cardGrid}>
        <Card id="details-identity" aria-labelledby="details-identity-title">
          <CardHeader title={<span id="details-identity-title">Tournament identity</span>} description="Name, organizer, tournament type, and branding." headingLevel="h3" />
          <FormGrid>
            <TextField
              label="Tournament name"
              fullRow
              value={details.name}
              onChange={(event) => setDetails((prev) => ({ ...prev, name: event.target.value }))}
              onBlur={() => setIdentityTouched((prev) => ({ ...prev, name: true }))}
              placeholder="For example, Mountain Classic Open"
              maxLength={120}
              error={nameError}
              helper={!nameError && details.name.length >= 100 ? `${details.name.length}/120 characters` : undefined}
            />
            <TextField
              label="Short description"
              optional
              fullRow
              value={details.subtitle}
              onChange={(event) => setDetails((prev) => ({ ...prev, subtitle: event.target.value }))}
              maxLength={160}
              placeholder="A brief public summary shown with the tournament name."
              helper={`${details.subtitle.length}/160 characters`}
            />
            <TextField
              label="Hosted by"
              value={details.organizer}
              onChange={(event) => setDetails((prev) => ({ ...prev, organizer: event.target.value }))}
              onBlur={() => setIdentityTouched((prev) => ({ ...prev, organizer: true }))}
              placeholder="Organization name"
              error={organizerError}
            />
            <SelectField
              label="Tournament type"
              value={details.tournamentType}
              onChange={(event) => setDetails((prev) => ({ ...prev, tournamentType: event.target.value }))}
              onBlur={() => setIdentityTouched((prev) => ({ ...prev, tournamentType: true }))}
              error={typeError}
            >
              <option value="">Select tournament type</option>
              {['Open', 'Adult', 'Youth', 'Senior', 'Women', 'Mixed', 'Invitational', 'Other'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </SelectField>
          </FormGrid>
          <CardDivider />
          <div className={layout.fieldGroup}>
            <span className={layout.fieldLabel}>Tournament logo <span className={local.optional}>(optional)</span></span>
            <input
              ref={logoInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose tournament logo file"
              onChange={handleLogoInputChange}
            />
            <div
              className={`${local.logoZone} ${isLogoDragActive ? local.logoZoneActive : ''}`}
              onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setIsLogoDragActive(true); }}
              onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setIsLogoDragActive(true); }}
              onDragLeave={(event) => { event.preventDefault(); event.stopPropagation(); setIsLogoDragActive(false); }}
              onDrop={handleLogoDrop}
            >
              {hasLogoAsset ? (
                <>
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Tournament logo preview"
                      className={local.logoPreview}
                      onLoad={(event) => setLogoDimensions(`${event.currentTarget.naturalWidth} x ${event.currentTarget.naturalHeight}px`)}
                    />
                  ) : null}
                  <div className={local.logoText}>
                    <span className={local.logoName}>{logoAssetName}</span>
                    <span className={layout.helper}>{logoAssetMeta}{logoDimensions ? ` · ${logoDimensions}` : ''}</span>
                  </div>
                  <div className={local.logoActions}>
                    <Button size="sm" variant="secondary" icon={<PencilLine size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => logoInputRef.current?.click()}>Replace</Button>
                    <Button size="sm" variant="ghost-danger" icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => { void clearLogo(); }}>Remove</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className={local.logoText}>
                    <span className={local.logoName}>Drop a logo here or upload one</span>
                    <span className={layout.helper}>PNG or JPG, up to 5 MB.</span>
                  </div>
                  <Button size="sm" variant="secondary" icon={<Upload size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => logoInputRef.current?.click()} aria-label="Upload tournament logo">
                    Upload logo
                  </Button>
                </>
              )}
            </div>
            {details.logoFileName && !logoPreviewUrl ? <span className={layout.helper}>Current file: {details.logoFileName}</span> : null}
            {pendingLogoFile ? <span className={layout.helper}>Pending upload: {pendingLogoFile.name}</span> : null}
            {logoUploadError ? <Notice tone="danger" role="alert">{logoUploadError}</Notice> : null}
          </div>
        </Card>

        <Card id="details-schedule" aria-labelledby="details-schedule-title">
          <CardHeader title={<span id="details-schedule-title">Tournament dates</span>} description="Tournament schedule, registration window, and timezone." headingLevel="h3" />
          <div className={layout.stack}>
            <h4 className={layout.subsectionTitle}>Tournament schedule</h4>
            <FormGrid>
              <TextField
                label="Start date"
                type="date"
                value={details.startDateIso}
                onChange={(event) => setDetails((prev) => ({ ...prev, startDateIso: event.target.value, endDateIso: prev.endDateIso || event.target.value }))}
                error={startError}
                aria-invalid={Boolean(startError || tournamentDateOrderInvalid)}
              />
              <TextField
                label="End date"
                type="date"
                min={details.startDateIso || undefined}
                value={details.endDateIso}
                onChange={(event) => setDetails((prev) => ({ ...prev, endDateIso: event.target.value }))}
                error={endError}
              />
            </FormGrid>
            <CardDivider />
            <h4 className={layout.subsectionTitle}>Registration window</h4>
            <FormGrid>
              <TextField
                label="Registration opens"
                type="date"
                value={details.registrationOpenIso}
                onChange={(event) => setDetails((prev) => ({ ...prev, registrationOpenIso: event.target.value }))}
                error={openError}
                aria-invalid={Boolean(openError || registrationDateOrderInvalid)}
                helper={openError ? undefined : 'When bowlers can begin submitting entries.'}
              />
              <TextField
                label="Registration closes"
                type="date"
                min={details.registrationOpenIso || undefined}
                max={details.endDateIso || undefined}
                value={details.registrationCloseIso}
                onChange={(event) => setDetails((prev) => ({ ...prev, registrationCloseIso: event.target.value }))}
                error={closeError}
                aria-invalid={Boolean(closeError || registrationDateOrderInvalid || registrationAfterEndInvalid)}
                helper={closeError ? undefined : 'Tournament-wide deadline; squads may close earlier.'}
              />
              <TextField
                label="Opens at"
                type="time"
                value={details.registrationOpenTime}
                onChange={(event) => setDetails((prev) => ({ ...prev, registrationOpenTime: event.target.value }))}
                error={openTimeError}
              />
              <TextField
                label="Closes at"
                type="time"
                value={details.registrationCloseTime}
                onChange={(event) => setDetails((prev) => ({ ...prev, registrationCloseTime: event.target.value }))}
                error={closeTimeError}
              />
              <SelectField
                label="Timezone"
                fullRow
                value={details.timezone}
                onChange={(event) => setDetails((prev) => ({ ...prev, timezone: event.target.value }))}
                helper="All dates and times are shown in this timezone."
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </SelectField>
            </FormGrid>
          </div>
        </Card>

        <Card id="details-location" aria-labelledby="details-location-title">
          <CardHeader title={<span id="details-location-title">Location</span>} description="Bowling center and tournament location." headingLevel="h3" />
          <div className={layout.stack}>
            <SegmentedControl
              label="Location entry method"
              value={locationMode}
              onChange={(mode) => {
                setLocationMode(mode);
                if (mode === 'manual') {
                  setVenueSearchResults([]);
                  clearVenueSelection();
                }
              }}
              options={[{ value: 'search', label: 'Search for venue' }, { value: 'manual', label: 'Enter manually' }]}
            />
            {locationMode === 'search' ? (
              <>
                {hasSelectedVenue ? (
                  <div className={local.selectedVenue}>
                    <div className={local.logoText}>
                      <span className={layout.helper}>Selected venue</span>
                      <span className={local.logoName}>{details.bowlingCenter}</span>
                      <span className={layout.helper}>{[details.venueAddressLine1, details.city, details.state, details.venueZip].filter(Boolean).join(', ')}</span>
                    </div>
                    <div className={local.logoActions}>
                      <Button size="sm" variant="secondary" onClick={clearVenueSelection}>Change venue</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetails((prev) => ({ ...prev, venueId: null, bowlingCenter: '', venueAddressLine1: '', venueAddressLine2: '', city: '', state: '', venueZip: '', venueLatitude: null, venueLongitude: null, venueExternalProvider: '', venueExternalPlaceId: '' }))}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <TextField
                    label="Venue name"
                    value={details.bowlingCenter}
                    onChange={(event) => setDetails((prev) => ({
                      ...prev,
                      bowlingCenter: event.target.value,
                      venueId: null,
                      venueAddressLine1: '',
                      venueAddressLine2: '',
                      city: '',
                      state: '',
                      venueZip: '',
                      venueLatitude: null,
                      venueLongitude: null,
                      venueExternalProvider: '',
                      venueExternalPlaceId: '',
                    }))}
                    placeholder="Search by venue name or city"
                    error={!details.bowlingCenter.trim() ? 'Bowling center is required.' : undefined}
                    helper={details.bowlingCenter.trim().length < 2 ? 'Type at least 2 characters to search.' : undefined}
                  />
                )}
                {isVenueSearchLoading ? <p className={layout.helper} role="status">Searching known venues...</p> : null}
                {venueSearchError ? <Notice tone="danger" role="alert">{venueSearchError} Enter the address manually if needed.</Notice> : null}
                {!hasSelectedVenue && !isVenueSearchLoading && details.bowlingCenter.trim().length > 1 && venueSearchResults.length === 0 && !venueSearchError
                  ? <p className={layout.helper}>No matching venues found.</p>
                  : null}
                {venueSearchResults.length > 0 ? (
                  <div className={layout.fieldGroup}>
                    <span className={layout.helper}>{venueSearchResults.length} result{venueSearchResults.length === 1 ? '' : 's'} found</span>
                    <ul className={local.results}>
                      {venueSearchResults.slice(0, 6).map((result) => {
                        const venue = result.venue;
                        const venueKey = `${result.source}-${venue.id ?? venue.external_place_id ?? venue.name}`;
                        const venueLine = [venue.address_line_1, venue.city, venue.state, venue.zip].filter((part) => (part || '').trim()).join(', ');
                        return (
                          <li key={venueKey}>
                            <button
                              type="button"
                              className={local.result}
                              onClick={() => {
                                setVenueSearchResults([]);
                                setDetails((prev) => ({
                                  ...prev,
                                  venueId: typeof venue.id === 'number' ? venue.id : null,
                                  bowlingCenter: venue.name,
                                  venueAddressLine1: venue.address_line_1 || '',
                                  venueAddressLine2: venue.address_line_2 || '',
                                  city: venue.city || '',
                                  state: venue.state || '',
                                  venueZip: venue.zip || '',
                                  venueCountry: venue.country || 'US',
                                  venueLatitude: venue.latitude ?? null,
                                  venueLongitude: venue.longitude ?? null,
                                  venueExternalProvider: venue.external_provider || '',
                                  venueExternalPlaceId: venue.external_place_id || '',
                                }));
                              }}
                            >
                              <span className={local.logoName}>{venue.name}{result.source === 'internal' ? ' (saved)' : ''}</span>
                              {venueLine ? <span className={layout.helper}>{venueLine}</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <FormGrid>
                <TextField label="Venue name" fullRow value={details.bowlingCenter} onChange={(event) => setDetails((prev) => ({ ...prev, bowlingCenter: event.target.value }))} placeholder="Enter venue name" />
                <TextField
                  label="City"
                  value={details.city}
                  onChange={(event) => setDetails((prev) => ({ ...prev, city: event.target.value }))}
                  error={!details.city.trim() ? 'City is required.' : undefined}
                />
                <SelectField
                  label="State"
                  value={details.state}
                  onChange={(event) => setDetails((prev) => ({ ...prev, state: event.target.value }))}
                  error={!details.state ? 'State is required.' : undefined}
                >
                  <option value="">Select state</option>
                  {usStates.map((us) => (
                    <option key={us.code} value={us.code}>{us.name}</option>
                  ))}
                </SelectField>
                <TextField label="Address line 1" optional fullRow value={details.venueAddressLine1} onChange={(event) => setDetails((prev) => ({ ...prev, venueAddressLine1: event.target.value }))} />
                <TextField label="Address line 2" optional fullRow value={details.venueAddressLine2} onChange={(event) => setDetails((prev) => ({ ...prev, venueAddressLine2: event.target.value }))} />
                <TextField label="Postal code" optional value={details.venueZip} onChange={(event) => setDetails((prev) => ({ ...prev, venueZip: event.target.value }))} />
                <TextField label="Country" optional value={details.venueCountry} onChange={(event) => setDetails((prev) => ({ ...prev, venueCountry: event.target.value }))} />
              </FormGrid>
            )}
          </div>
        </Card>

        <Card id="details-support" aria-labelledby="details-support-title">
          <CardHeader
            title={<span id="details-support-title">Participant contact</span>}
            description="Shown publicly on the tournament page for registration and tournament questions."
            headingLevel="h3"
          />
          <FormGrid>
            <TextField
              label="Contact name"
              value={details.contactName}
              onChange={(event) => setDetails((prev) => ({ ...prev, contactName: event.target.value }))}
              onBlur={() => setContactTouched((prev) => ({ ...prev, name: true }))}
              placeholder="Jamie Smith"
              autoComplete="name"
              error={contactNameError}
            />
            <TextField
              label="Role or title"
              optional
              value={details.contactRole}
              onChange={(event) => setDetails((prev) => ({ ...prev, contactRole: event.target.value }))}
              placeholder="Tournament director"
            />
            <TextField
              label="Contact email"
              type="email"
              value={details.supportEmail}
              onChange={(event) => setDetails((prev) => ({ ...prev, supportEmail: event.target.value.toLowerCase() }))}
              onBlur={() => setContactTouched((prev) => ({ ...prev, email: true }))}
              placeholder="contact@example.com"
              autoComplete="email"
              error={contactEmailError}
            />
            <TextField
              label="Contact phone"
              optional={details.preferredContactMethod !== 'phone'}
              type="tel"
              value={details.supportPhone}
              onChange={(event) => setDetails((prev) => ({ ...prev, supportPhone: event.target.value }))}
              onBlur={() => setContactTouched((prev) => ({ ...prev, phone: true }))}
              placeholder="(000) 000-0000"
              autoComplete="tel"
              inputMode="tel"
              error={contactPhoneError}
            />
            <div className={`${layout.fieldGroup} ${local.fullRow}`}>
              <span className={layout.fieldLabel} id="preferred-contact-label">Preferred contact method</span>
              <SegmentedControl
                label="Preferred contact method"
                value={details.preferredContactMethod}
                onChange={(method) => setDetails((prev) => ({ ...prev, preferredContactMethod: method }))}
                options={[{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'either', label: 'Either' }]}
              />
            </div>
            <TextField
              label="Contact note"
              optional
              fullRow
              maxLength={160}
              value={details.contactNote}
              onChange={(event) => setDetails((prev) => ({ ...prev, contactNote: event.target.value }))}
              placeholder="Email preferred. Responses within two business days."
              helper={`${details.contactNote.length}/160 characters`}
            />
          </FormGrid>
        </Card>
      </div>
    </>
  );
}
