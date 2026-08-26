import {
  CalendarDays,
  Headphones,
  Info,
  MapPin,
  PencilLine,
  Trophy,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEvent, Dispatch, DragEvent, RefObject, SetStateAction } from 'react';

import SetupStatusBadge from '../SetupStatusBadge';
import type { SetupSectionKey, SetupStatus } from '../types';
import styles from '../tournament-setup.module.css';

type TournamentDetails = {
  name: string;
  subtitle: string;
  organizer: string;
  tournamentType: string;
  startDateIso: string;
  endDateIso: string;
  venueId: number | null;
  bowlingCenter: string;
  venueAddressLine1: string;
  venueAddressLine2: string;
  city: string;
  state: string;
  venueZip: string;
  venueCountry: string;
  venueLatitude: number | null;
  venueLongitude: number | null;
  venueExternalProvider: string;
  venueExternalPlaceId: string;
  timezone: string;
  visibility: 'public' | 'unlisted' | 'private';
  tournamentStatus: string;
  supportEmail: string;
  supportPhone: string;
  contactName: string;
  contactRole: string;
  preferredContactMethod: 'email' | 'phone' | 'either';
  contactNote: string;
  registrationOpenIso: string;
  registrationCloseIso: string;
  registrationOpenTime: string;
  registrationCloseTime: string;
  logoFileName: string;
};

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
  registrationAfterStartWarning: boolean;
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
  registrationAfterStartWarning,
  usStates,
  timezones,
  logoInputRef,
  handleLogoInputChange,
  handleLogoDrop,
  clearLogo,
  setIsLogoDragActive,
}: TournamentDetailsSectionProps) {
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

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Tournament Details</h2>
          <p>Basic information used throughout Tournament Central and during registration.</p>
        </div>
        <SetupStatusBadge status={statusBySection['tournament-details']} />
      </div>

      <div className={styles.detailsLayout}>
        <div className={styles.detailsMain}>
          <div className={styles.detailsGrid}>
            <article id="details-identity" className={`${styles.detailsCard} ${styles.identityCard}`}>
              <div className={styles.detailsCardHead}>
                <span className={styles.detailsCardIcon}><Trophy size={15} /></span>
                <div className={styles.detailsCardHeadText}>
                  <h3>Tournament Identity</h3>
                  <p>Name, organizer, tournament type, and branding.</p>
                </div>
              </div>
              <div className={styles.detailsCardBody}>
                <label className={styles.fieldLabel}>
                  Tournament Name <span className={styles.fieldRequired}>*</span>
                  <input
                    className={identityTouched.name && !details.name.trim() ? styles.fieldInputInvalid : ''}
                    value={details.name}
                    onChange={(event) => setDetails((prev) => ({ ...prev, name: event.target.value }))}
                    onBlur={() => setIdentityTouched((prev) => ({ ...prev, name: true }))}
                    placeholder="e.g. Mountain Classic Open"
                    maxLength={120}
                  />
                  {identityTouched.name && !details.name.trim() ? <small className={styles.fieldErrorText}>Tournament name is required.</small> : null}
                  {details.name.length >= 100 ? <small className={styles.fieldHintText}>{details.name.length}/120 characters</small> : null}
                </label>
                <label className={styles.fieldLabel}>
                  Short Description
                  <input
                    value={details.subtitle}
                    onChange={(event) => setDetails((prev) => ({ ...prev, subtitle: event.target.value }))}
                    maxLength={160}
                    placeholder="A brief public summary shown with the tournament name."
                  />
                  <small className={styles.fieldHintText}>{details.subtitle.length}/160 characters</small>
                </label>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Hosted By <span className={styles.fieldRequired}>*</span>
                    <input
                      className={identityTouched.organizer && !details.organizer.trim() ? styles.fieldInputInvalid : ''}
                      value={details.organizer}
                      onChange={(event) => setDetails((prev) => ({ ...prev, organizer: event.target.value }))}
                      onBlur={() => setIdentityTouched((prev) => ({ ...prev, organizer: true }))}
                      placeholder="Organization name"
                    />
                    {identityTouched.organizer && !details.organizer.trim() ? <small className={styles.fieldErrorText}>Host organization is required.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Tournament Type
                    <select
                      value={details.tournamentType}
                      onChange={(event) => setDetails((prev) => ({ ...prev, tournamentType: event.target.value }))}
                      onBlur={() => setIdentityTouched((prev) => ({ ...prev, tournamentType: true }))}
                    >
                      <option value="">Select tournament type</option>
                      <option value="Open">Open</option>
                      <option value="Adult">Adult</option>
                      <option value="Youth">Youth</option>
                      <option value="Senior">Senior</option>
                      <option value="Women">Women</option>
                      <option value="Mixed">Mixed</option>
                      <option value="Invitational">Invitational</option>
                      <option value="Other">Other</option>
                    </select>
                    {identityTouched.tournamentType && !details.tournamentType ? <small className={styles.fieldErrorText}>Tournament type is required.</small> : null}
                  </label>
                </div>
                <div className={`${styles.fieldLabel} ${styles.identityLogoField} ${hasLogoAsset ? styles.identityLogoFieldExpanded : ''}`}>
                  Tournament Logo (optional)
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    className={styles.logoUploadInput}
                    onChange={handleLogoInputChange}
                  />
                  <div
                    className={`${styles.logoUpload} ${isLogoDragActive ? styles.logoUploadActive : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload tournament logo"
                    onClick={() => {
                      if (!hasLogoAsset) {
                        logoInputRef.current?.click();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (!hasLogoAsset) {
                          logoInputRef.current?.click();
                        }
                      }
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsLogoDragActive(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsLogoDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsLogoDragActive(false);
                    }}
                    onDrop={handleLogoDrop}
                  >
                    {hasLogoAsset ? (
                      <div className={styles.logoAssetRow}>
                        {logoPreviewUrl ? (
                          <div className={styles.logoPreviewWrap}>
                            <img src={logoPreviewUrl} alt="Tournament logo preview" className={styles.logoPreviewImage} onLoad={(event) => setLogoDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}px`)} />
                          </div>
                        ) : (
                          <span className={styles.logoUploadIcon}><Upload size={15} /></span>
                        )}
                        <div className={styles.logoUploadText}>
                          <span className={styles.logoUploadMain}>{logoAssetName}</span>
                          <small>{logoAssetMeta}{logoDimensions ? ` · ${logoDimensions}` : ''}</small>
                        </div>
                        <div className={styles.logoAssetActions}>
                          <button
                            type="button"
                            className={styles.logoActionButton}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              logoInputRef.current?.click();
                            }}
                          >
                            <PencilLine size={13} /> Replace
                          </button>
                          <button
                            type="button"
                            className={`${styles.logoActionButton} ${styles.logoActionButtonDanger}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void clearLogo();
                            }}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.logoUploadInner}>
                        <span className={styles.logoUploadIcon}><Upload size={16} /></span>
                        <div className={styles.logoUploadText}>
                          <span className={styles.logoUploadMain}>Upload Tournament Logo</span>
                          <small className={styles.logoUploadHint}>PNG or JPG · Maximum 5 MB</small>
                        </div>
                      </div>
                    )}
                  </div>
                  {details.logoFileName && !logoPreviewUrl ? (
                    <small className={styles.logoUploadFilename}>Current file: {details.logoFileName}</small>
                  ) : null}
                  {pendingLogoFile ? (
                    <small className={styles.logoUploadFilename}>Pending upload: {pendingLogoFile.name}</small>
                  ) : null}
                  {logoUploadError ? <small className={styles.logoUploadError}>{logoUploadError}</small> : null}
                </div>
              </div>
            </article>

            <article id="details-schedule" className={styles.detailsCard}>
              <div className={styles.detailsCardHead}>
                <span className={styles.detailsCardIcon}><CalendarDays size={15} /></span>
                <div className={styles.detailsCardHeadText}>
                  <h3>Tournament Dates</h3>
                  <p>Tournament schedule, registration window, and timezone.</p>
                </div>
              </div>
              <div className={styles.detailsCardBody}>
                <h4>Tournament Schedule</h4>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Tournament Start Date <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.startDateIso || tournamentDateOrderInvalid ? styles.fieldInputInvalid : ''}
                      value={details.startDateIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, startDateIso: event.target.value, endDateIso: prev.endDateIso || event.target.value }))}
                    />
                    {!details.startDateIso ? <small className={styles.fieldErrorText}>Start date is required.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Tournament End Date <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.endDateIso || tournamentDateOrderInvalid ? styles.fieldInputInvalid : ''}
                      min={details.startDateIso || undefined}
                      value={details.endDateIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, endDateIso: event.target.value }))}
                    />
                    {!details.endDateIso ? <small className={styles.fieldErrorText}>End date is required.</small> : null}
                    {tournamentDateOrderInvalid ? <small className={styles.fieldErrorText}>End date must be on or after start date.</small> : null}
                  </label>
                </div>
                <h4>Registration Window</h4>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Registration Opens <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.registrationOpenIso || registrationDateOrderInvalid ? styles.fieldInputInvalid : ''}
                      value={details.registrationOpenIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, registrationOpenIso: event.target.value }))}
                    />
                    <small className={styles.fieldHintText}>When bowlers can begin submitting entries.</small>
                    {!details.registrationOpenIso ? <small className={styles.fieldErrorText}>Registration open date is required.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Registration Closes <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.registrationCloseIso || registrationDateOrderInvalid || registrationAfterStartWarning ? styles.fieldInputInvalid : ''}
                      min={details.registrationOpenIso || undefined}
                      value={details.registrationCloseIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, registrationCloseIso: event.target.value }))}
                    />
                    <small className={styles.fieldHintText}>Tournament-wide deadline; squad deadlines may close earlier.</small>
                    {!details.registrationCloseIso ? <small className={styles.fieldErrorText}>Registration close date is required.</small> : null}
                    {registrationDateOrderInvalid ? <small className={styles.fieldErrorText}>Close date must be on or after open date.</small> : null}
                    {!registrationDateOrderInvalid && registrationAfterStartWarning ? <small className={styles.fieldHintText}>Close date currently falls after tournament start.</small> : null}
                  </label>
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Opens at<input type="time" value={details.registrationOpenTime} onChange={(event) => setDetails((prev) => ({ ...prev, registrationOpenTime: event.target.value }))} /></label>
                  <label className={styles.fieldLabel}>Closes at<input type="time" value={details.registrationCloseTime} onChange={(event) => setDetails((prev) => ({ ...prev, registrationCloseTime: event.target.value }))} /></label>
                </div>
                <p className={styles.detailNote}>This is the tournament-wide registration window. Individual squads may close earlier.</p>
                <label className={styles.fieldLabel}>
                  Timezone <span className={styles.fieldRequired}>*</span>
                  <select
                    value={details.timezone}
                    onChange={(event) => setDetails((prev) => ({ ...prev, timezone: event.target.value }))}
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </label>
                <p className={styles.detailNote}><Info size={13} /> All dates and times will be displayed in the selected timezone.</p>
              </div>
            </article>

            <article id="details-location" className={styles.detailsCard}>
              <div className={styles.detailsCardHead}>
                <span className={styles.detailsCardIcon}><MapPin size={15} /></span>
                <div className={styles.detailsCardHeadText}>
                  <h3>Location</h3>
                  <p>Bowling center and tournament location.</p>
                </div>
              </div>
              <div className={styles.detailsCardBody}>
                <div className={styles.locationModeTabs} aria-label="Location entry method">
                  <button type="button" className={`${styles.locationModeTab} ${locationMode === 'search' ? styles.locationModeTabActive : ''}`} onClick={() => setLocationMode('search')}><MapPin size={13} /> Search for Venue</button>
                  <button type="button" className={`${styles.locationModeTab} ${locationMode === 'manual' ? styles.locationModeTabActive : ''}`} onClick={() => {
                    setLocationMode('manual');
                    setVenueSearchResults([]);
                    setDetails((prev) => ({ ...prev, venueId: null, venueExternalProvider: '', venueExternalPlaceId: '', venueLatitude: null, venueLongitude: null }));
                  }}>Enter Manually</button>
                </div>
                {locationMode === 'search' ? <>
                {hasSelectedVenue ? (
                  <div className={styles.locationSelectedCard}>
                    <div className={styles.locationSelectedIcon}><MapPin size={18} /></div>
                    <div className={styles.locationSelectedText}><span>Selected Venue</span><strong>{details.bowlingCenter}</strong><small>{[details.venueAddressLine1, details.city, details.state, details.venueZip].filter(Boolean).join(', ')}</small></div>
                    <div className={styles.locationSelectedActions}>
                      <button type="button" className={styles.inlineAction} onClick={() => setDetails((prev) => ({ ...prev, venueId: null, venueExternalProvider: '', venueExternalPlaceId: '', venueLatitude: null, venueLongitude: null }))}>Change Venue</button>
                      <button type="button" className={styles.inlineAction} onClick={() => setDetails((prev) => ({ ...prev, venueId: null, bowlingCenter: '', venueAddressLine1: '', venueAddressLine2: '', city: '', state: '', venueZip: '', venueLatitude: null, venueLongitude: null, venueExternalProvider: '', venueExternalPlaceId: '' }))}>Clear</button>
                    </div>
                  </div>
                ) : (
                <label className={styles.fieldLabel}>
                  Venue Name <span className={styles.fieldRequired}>*</span>
                  <input
                    className={!details.bowlingCenter.trim() ? styles.fieldInputInvalid : ''}
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
                  />
                  {!details.bowlingCenter.trim() ? <small className={styles.fieldErrorText}>Bowling center is required.</small> : null}
                </label>
                )}
                {isVenueSearchLoading ? <p className={styles.detailNote}>Searching known venues...</p> : null}
                {venueSearchError ? <p className={styles.fieldErrorText}>{venueSearchError} Enter the address manually if needed.</p> : null}
                {!hasSelectedVenue && !isVenueSearchLoading && details.bowlingCenter.trim().length > 1 && venueSearchResults.length === 0 && !venueSearchError ? <p className={styles.detailNote}>No matching venues found.</p> : null}
                {!hasSelectedVenue && details.bowlingCenter.trim().length < 2 ? <p className={styles.detailNote}>Type at least 2 characters to search.</p> : null}
                {venueSearchResults.length > 0 ? (
                  <div className={styles.locationSearchResults}>
                    <p className={styles.detailNote}>{venueSearchResults.length} result{venueSearchResults.length === 1 ? '' : 's'} found</p>
                    {venueSearchResults.slice(0, 6).map((result) => {
                      const venue = result.venue;
                      const venueKey = `${result.source}-${venue.id ?? venue.external_place_id ?? venue.name}`;
                      const venueLine = [venue.address_line_1, venue.city, venue.state, venue.zip].filter((part) => (part || '').trim()).join(', ');

                      return (
                        <button
                          key={venueKey}
                          type="button"
                          className={styles.locationSearchResult}
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
                          {venue.name}
                          {venueLine ? ` - ${venueLine}` : ''}
                          {result.source === 'internal' ? ' (Saved)' : ''}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                </> : <div className={styles.locationManualForm}>
                <label className={styles.fieldLabel}>Venue Name <span className={styles.fieldRequired}>*</span><input value={details.bowlingCenter} onChange={(event) => setDetails((prev) => ({ ...prev, bowlingCenter: event.target.value }))} placeholder="Enter venue name" /></label>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    City <span className={styles.fieldRequired}>*</span>
                    <input
                      className={!details.city.trim() ? styles.fieldInputInvalid : ''}
                      value={details.city}
                      onChange={(event) => setDetails((prev) => ({ ...prev, city: event.target.value }))}
                      placeholder="City"
                    />
                    {!details.city.trim() ? <small className={styles.fieldErrorText}>City is required.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    State <span className={styles.fieldRequired}>*</span>
                    <select
                      className={!details.state ? styles.fieldInputInvalid : ''}
                      value={details.state}
                      onChange={(event) => setDetails((prev) => ({ ...prev, state: event.target.value }))}
                    >
                      <option value="">Select state</option>
                      {usStates.map((us) => (
                        <option key={us.code} value={us.code}>{us.name}</option>
                      ))}
                    </select>
                    {!details.state ? <small className={styles.fieldErrorText}>State is required.</small> : null}
                  </label>
                </div>
                <label className={styles.fieldLabel}>Address line 1<input value={details.venueAddressLine1} onChange={(event) => setDetails((prev) => ({ ...prev, venueAddressLine1: event.target.value }))} /></label>
                <label className={styles.fieldLabel}>Address line 2 (optional)<input value={details.venueAddressLine2} onChange={(event) => setDetails((prev) => ({ ...prev, venueAddressLine2: event.target.value }))} /></label>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Postal code<input value={details.venueZip} onChange={(event) => setDetails((prev) => ({ ...prev, venueZip: event.target.value }))} /></label>
                  <label className={styles.fieldLabel}>Country<input value={details.venueCountry} onChange={(event) => setDetails((prev) => ({ ...prev, venueCountry: event.target.value }))} /></label>
                </div>
                </div>}
              </div>
            </article>

            <article id="details-support" className={styles.detailsCard}>
              <div className={styles.detailsCardHead}>
                <span className={styles.detailsCardIcon}><Headphones size={15} /></span>
                <div className={styles.detailsCardHeadText}>
                  <h3>Participant Contact</h3>
                  <p>Contact information shown to bowlers for registration and tournament questions.</p>
                </div>
              </div>
              <div className={styles.detailsCardBody}>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Contact Name <span className={styles.fieldRequired}>*</span>
                    <input
                      className={contactTouched.name && !details.contactName.trim() ? styles.fieldInputInvalid : ''}
                      value={details.contactName}
                      onChange={(event) => setDetails((prev) => ({ ...prev, contactName: event.target.value }))}
                      onBlur={() => setContactTouched((prev) => ({ ...prev, name: true }))}
                      placeholder="Jamie Smith"
                      autoComplete="name"
                    />
                    {contactTouched.name && !details.contactName.trim() ? <small className={styles.fieldErrorText}>Contact name is required.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Role or Title (optional)
                    <input value={details.contactRole} onChange={(event) => setDetails((prev) => ({ ...prev, contactRole: event.target.value }))} placeholder="Tournament Director" />
                  </label>
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Contact Email <span className={styles.fieldRequired}>*</span>
                    <input
                      type="email"
                      className={contactTouched.email && !supportEmailLooksValid ? styles.fieldInputInvalid : ''}
                      value={details.supportEmail}
                      onChange={(event) => setDetails((prev) => ({ ...prev, supportEmail: event.target.value.toLowerCase() }))}
                      onBlur={() => setContactTouched((prev) => ({ ...prev, email: true }))}
                      placeholder="contact@example.com"
                      autoComplete="email"
                    />
                    {contactTouched.email && !supportEmailLooksValid ? <small className={styles.fieldErrorText}>Enter a valid contact email.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Contact Phone {details.preferredContactMethod === 'phone' ? <span className={styles.fieldRequired}>*</span> : '(optional)'}
                    <input
                      type="tel"
                      value={details.supportPhone}
                      onChange={(event) => setDetails((prev) => ({ ...prev, supportPhone: event.target.value }))}
                      onBlur={() => setContactTouched((prev) => ({ ...prev, phone: true }))}
                      placeholder="(000) 000-0000"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    {contactTouched.phone && details.preferredContactMethod === 'phone' && !details.supportPhone.trim() ? <small className={styles.fieldErrorText}>Phone is required when it is the preferred contact method.</small> : null}
                  </label>
                </div>
                <div className={styles.fieldLabel}>Preferred Contact Method</div>
                <div className={`${styles.locationModeTabs} ${styles.contactMethodTabs}`}>
                  {(['email', 'phone', 'either'] as const).map((method) => <button key={method} type="button" className={`${styles.locationModeTab} ${details.preferredContactMethod === method ? styles.locationModeTabActive : ''}`} onClick={() => setDetails((prev) => ({ ...prev, preferredContactMethod: method }))}>{method.charAt(0).toUpperCase() + method.slice(1)}</button>)}
                </div>
                <label className={styles.fieldLabel}>Contact Note (optional)<input maxLength={160} value={details.contactNote} onChange={(event) => setDetails((prev) => ({ ...prev, contactNote: event.target.value }))} placeholder="Email preferred. Responses within two business days." /><small className={styles.fieldHintText}>{details.contactNote.length}/160 characters</small></label>
                <p className={styles.detailNote}>This information will be displayed publicly on the tournament page.</p>
              </div>
            </article>
          </div>
        </div>

      </div>
    </section>
  );
}
