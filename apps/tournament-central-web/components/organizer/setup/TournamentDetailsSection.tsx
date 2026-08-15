import {
  CalendarDays,
  Globe,
  Headphones,
  Info,
  Link2,
  Lock,
  MapPin,
  PencilLine,
  Trophy,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ChangeEvent, Dispatch, DragEvent, RefObject, SetStateAction } from 'react';
import { capitalizeFirstLetter } from '@bracketworks/ui';

import SetupStatusBadge from '../SetupStatusBadge';
import type { SetupSectionKey, SetupStatus, ValidationIssue } from '../types';
import styles from '../tournament-setup.module.css';

type TournamentDetails = {
  name: string;
  subtitle: string;
  series: string;
  certification: string;
  organizer: string;
  tournamentType: string;
  startDateIso: string;
  endDateIso: string;
  bowlingCenter: string;
  city: string;
  state: string;
  timezone: string;
  visibility: 'public' | 'unlisted' | 'private';
  tournamentStatus: string;
  supportEmail: string;
  supportPhone: string;
  registrationOpenIso: string;
  registrationCloseIso: string;
  logoFileName: string;
};

type RecommendedTournamentStatus = {
  value: TournamentDetails['tournamentStatus'];
  reason: string;
};

type TimezoneOption = { value: string; label: string };
type UsStateOption = { code: string; name: string };

type WarningAction = {
  id: string;
  label: string;
  onClick: () => void;
};

type TournamentDetailsSectionProps = {
  details: TournamentDetails;
  setDetails: Dispatch<SetStateAction<TournamentDetails>>;
  statusBySection: Record<SetupSectionKey, SetupStatus>;
  supportEmailLooksValid: boolean;
  recommendedTournamentStatus: RecommendedTournamentStatus;
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
  visibilitySummary: string;
  timelineWarnings: ValidationIssue[];
  warningActions?: WarningAction[];
  showValidationWarnings: boolean;
  usStates: UsStateOption[];
  timezones: TimezoneOption[];
  logoInputRef: RefObject<HTMLInputElement>;
  handleLogoInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleLogoDrop: (event: DragEvent<HTMLDivElement>) => void;
  clearLogo: () => Promise<void> | void;
  setIsLogoDragActive: (isActive: boolean) => void;
  shiftIsoDate: (dateIso: string, days: number) => string;
};

export default function TournamentDetailsSection({
  details,
  setDetails,
  statusBySection,
  supportEmailLooksValid,
  recommendedTournamentStatus,
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
  visibilitySummary,
  timelineWarnings,
  warningActions = [],
  showValidationWarnings,
  usStates,
  timezones,
  logoInputRef,
  handleLogoInputChange,
  handleLogoDrop,
  clearLogo,
  setIsLogoDragActive,
  shiftIsoDate,
}: TournamentDetailsSectionProps) {
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
            <article id="details-identity" className={styles.detailsCard}>
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
                    className={!details.name.trim() ? styles.fieldInputInvalid : ''}
                    value={details.name}
                    onChange={(event) => setDetails((prev) => ({ ...prev, name: capitalizeFirstLetter(event.target.value) }))}
                    placeholder="Tournament name"
                  />
                  {!details.name.trim() ? <small className={styles.fieldErrorText}>Tournament name is required.</small> : null}
                </label>
                <label className={styles.fieldLabel}>
                  Subtitle / Short Description
                  <input
                    value={details.subtitle}
                    onChange={(event) => setDetails((prev) => ({ ...prev, subtitle: capitalizeFirstLetter(event.target.value) }))}
                    placeholder="e.g. USBC Certified • Fall Series"
                  />
                </label>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Organizer / Organization
                    <input
                      value={details.organizer}
                      onChange={(event) => setDetails((prev) => ({ ...prev, organizer: capitalizeFirstLetter(event.target.value) }))}
                      placeholder="Organization name"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Tournament Type
                    <select
                      value={details.tournamentType}
                      onChange={(event) => setDetails((prev) => ({ ...prev, tournamentType: event.target.value }))}
                    >
                      <option value="Adult">Adult</option>
                      <option value="Youth">Youth</option>
                      <option value="Senior">Senior</option>
                      <option value="Mixed">Mixed</option>
                    </select>
                  </label>
                </div>
                <div className={styles.fieldLabel}>
                  Tournament Logo (optional)
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
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
                            <img src={logoPreviewUrl} alt="Tournament logo preview" className={styles.logoPreviewImage} />
                          </div>
                        ) : (
                          <span className={styles.logoUploadIcon}><Upload size={15} /></span>
                        )}
                        <div className={styles.logoUploadText}>
                          <span className={styles.logoUploadMain}>{logoAssetName}</span>
                          <small>{logoAssetMeta}</small>
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
                          <small className={styles.logoUploadHint}>PNG, JPG, or SVG · Maximum 5 MB</small>
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
                  {logoPreviewUrl ? (
                    <small className={styles.logoUploadFilename}>Preview will be saved when you save changes.</small>
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
                  <p>Tournament schedule and registration availability.</p>
                </div>
              </div>
              <div className={styles.detailsCardBody}>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Tournament Start Date <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.startDateIso || tournamentDateOrderInvalid ? styles.fieldInputInvalid : ''}
                      value={details.startDateIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, startDateIso: event.target.value }))}
                    />
                    {!details.startDateIso ? <small className={styles.fieldErrorText}>Start date is required.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Tournament End Date <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.endDateIso || tournamentDateOrderInvalid ? styles.fieldInputInvalid : ''}
                      value={details.endDateIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, endDateIso: event.target.value }))}
                    />
                    {!details.endDateIso ? <small className={styles.fieldErrorText}>End date is required.</small> : null}
                    {tournamentDateOrderInvalid ? <small className={styles.fieldErrorText}>End date must be on or after start date.</small> : null}
                  </label>
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Registration Opens <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.registrationOpenIso || registrationDateOrderInvalid ? styles.fieldInputInvalid : ''}
                      value={details.registrationOpenIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, registrationOpenIso: event.target.value }))}
                    />
                    {!details.registrationOpenIso ? <small className={styles.fieldErrorText}>Registration open date is required.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Registration Closes <span className={styles.fieldRequired}>*</span>
                    <input
                      type="date"
                      className={!details.registrationCloseIso || registrationDateOrderInvalid || registrationAfterStartWarning ? styles.fieldInputInvalid : ''}
                      value={details.registrationCloseIso}
                      onChange={(event) => setDetails((prev) => ({ ...prev, registrationCloseIso: event.target.value }))}
                    />
                    {!details.registrationCloseIso ? <small className={styles.fieldErrorText}>Registration close date is required.</small> : null}
                    {registrationDateOrderInvalid ? <small className={styles.fieldErrorText}>Close date must be on or after open date.</small> : null}
                    {!registrationDateOrderInvalid && registrationAfterStartWarning ? <small className={styles.fieldHintText}>Close date currently falls after tournament start.</small> : null}
                  </label>
                </div>
                <div className={styles.detailsDateQuickActions}>
                  <button
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => {
                      if (!details.startDateIso) {
                        return;
                      }

                      const openIso = shiftIsoDate(details.startDateIso, -60);
                      const closeIso = shiftIsoDate(details.startDateIso, -7);
                      setDetails((prev) => ({
                        ...prev,
                        registrationOpenIso: openIso || prev.registrationOpenIso,
                        registrationCloseIso: closeIso || prev.registrationCloseIso,
                      }));
                    }}
                    disabled={!details.startDateIso}
                  >
                    Use 60-day open / 7-day close preset
                  </button>
                  <button
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => {
                      if (!details.startDateIso) {
                        return;
                      }

                      const openIso = shiftIsoDate(details.startDateIso, -30);
                      const closeIso = shiftIsoDate(details.startDateIso, -1);
                      setDetails((prev) => ({
                        ...prev,
                        registrationOpenIso: openIso || prev.registrationOpenIso,
                        registrationCloseIso: closeIso || prev.registrationCloseIso,
                      }));
                    }}
                    disabled={!details.startDateIso}
                  >
                    Use 30-day open / 1-day close preset
                  </button>
                </div>
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
                <label className={styles.fieldLabel}>
                  Bowling Center <span className={styles.fieldRequired}>*</span>
                  <input
                    className={!details.bowlingCenter.trim() ? styles.fieldInputInvalid : ''}
                    value={details.bowlingCenter}
                    onChange={(event) => setDetails((prev) => ({ ...prev, bowlingCenter: capitalizeFirstLetter(event.target.value) }))}
                    placeholder="Enter bowling center name"
                  />
                  {!details.bowlingCenter.trim() ? <small className={styles.fieldErrorText}>Bowling center is required.</small> : null}
                </label>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    City
                    <input
                      value={details.city}
                      onChange={(event) => setDetails((prev) => ({ ...prev, city: capitalizeFirstLetter(event.target.value) }))}
                      placeholder="City"
                    />
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
              </div>
            </article>

            <article id="details-visibility" className={styles.detailsCard}>
              <div className={styles.detailsCardHead}>
                <span className={styles.detailsCardIcon}><Globe size={15} /></span>
                <div className={styles.detailsCardHeadText}>
                  <h3>Publishing</h3>
                  <p>Control who can view the tournament and its current status.</p>
                </div>
              </div>
              <div className={styles.detailsCardBody}>
                <div>
                  <div className={`${styles.fieldLabel} ${styles.fieldLabelInline}`}>
                    Visibility <span className={styles.fieldInfoIcon}><Info size={12} /></span>
                  </div>
                  <div className={styles.visibilityGroup}>
                    <button
                      type="button"
                      className={`${styles.visibilityOpt} ${details.visibility === 'public' ? styles.visibilityOptActive : ''}`}
                      onClick={() => setDetails((prev) => ({ ...prev, visibility: 'public' }))}
                    >
                      <span className={styles.visibilityOptIcon}><Globe size={15} /></span>
                      <span className={styles.visibilityOptText}>
                        <span>Public</span>
                        <small>Visible to everyone</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.visibilityOpt} ${details.visibility === 'unlisted' ? styles.visibilityOptActive : ''}`}
                      onClick={() => setDetails((prev) => ({ ...prev, visibility: 'unlisted' }))}
                    >
                      <span className={styles.visibilityOptIcon}><Link2 size={15} /></span>
                      <span className={styles.visibilityOptText}>
                        <span>Unlisted</span>
                        <small>Anyone with link</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.visibilityOpt} ${details.visibility === 'private' ? styles.visibilityOptActive : ''}`}
                      onClick={() => setDetails((prev) => ({ ...prev, visibility: 'private' }))}
                    >
                      <span className={styles.visibilityOptIcon}><Lock size={15} /></span>
                      <span className={styles.visibilityOptText}>
                        <span>Private</span>
                        <small>Invite only</small>
                      </span>
                    </button>
                  </div>
                </div>
                <label className={styles.fieldLabel}>
                  Tournament Status
                  <select
                    value={details.tournamentStatus}
                    onChange={(event) => setDetails((prev) => ({ ...prev, tournamentStatus: event.target.value }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="registration-open">Registration Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <div className={styles.detailsStatusRecommendation}>
                  <div>
                    <strong>Recommended status: {recommendedTournamentStatus.value}</strong>
                    <p>{recommendedTournamentStatus.reason}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => setDetails((prev) => ({ ...prev, tournamentStatus: recommendedTournamentStatus.value }))}
                    disabled={details.tournamentStatus === recommendedTournamentStatus.value}
                  >
                    Use Recommended Status
                  </button>
                </div>
                <p className={styles.detailNote}>You can change the status at any time.</p>
              </div>
            </article>

            <article id="details-support" className={`${styles.detailsCard} ${styles.detailsCardSpan}`}>
              <div className={styles.detailsCardHead}>
                <span className={styles.detailsCardIcon}><Headphones size={15} /></span>
                <div className={styles.detailsCardHeadText}>
                  <h3>Support Contact</h3>
                  <p>Contact information shown to bowlers who need tournament assistance.</p>
                </div>
              </div>
              <div className={styles.detailsCardBody}>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Support Email <span className={styles.fieldRequired}>*</span>
                    <input
                      type="email"
                      className={!supportEmailLooksValid ? styles.fieldInputInvalid : ''}
                      value={details.supportEmail}
                      onChange={(event) => setDetails((prev) => ({ ...prev, supportEmail: event.target.value }))}
                      placeholder="contact@example.com"
                    />
                    {!supportEmailLooksValid ? <small className={styles.fieldErrorText}>Enter a valid support email.</small> : null}
                  </label>
                  <label className={styles.fieldLabel}>
                    Support Phone (optional)
                    <input
                      type="tel"
                      value={details.supportPhone}
                      onChange={(event) => setDetails((prev) => ({ ...prev, supportPhone: event.target.value }))}
                      placeholder="(000) 000-0000"
                    />
                  </label>
                </div>
                <p className={styles.detailNote}>This contact information will be displayed on the public tournament page.</p>
              </div>
            </article>
          </div>
        </div>

        <aside className={styles.detailsSummaryRail}>
          <section className={styles.detailsSummaryCard} aria-label="Live tournament details summary">
            <div className={styles.detailsSummaryHead}>
              <h3>Live Summary</h3>
              <span>{statusBySection['tournament-details'] === 'complete' ? 'Ready' : 'In Progress'}</span>
            </div>
            <dl className={styles.detailsSummaryList}>
              <div>
                <dt>Name</dt>
                <dd>{details.name.trim() || 'Untitled Tournament'}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>{details.visibility.charAt(0).toUpperCase() + details.visibility.slice(1)}</dd>
              </div>
              <div>
                <dt>Tournament Dates</dt>
                <dd>{`${details.startDateIso ? new Date(`${details.startDateIso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'} - ${details.endDateIso ? new Date(`${details.endDateIso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}`}</dd>
              </div>
              <div>
                <dt>Registration Window</dt>
                <dd>{`${details.registrationOpenIso ? new Date(`${details.registrationOpenIso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'} - ${details.registrationCloseIso ? new Date(`${details.registrationCloseIso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}`}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{[details.bowlingCenter, details.city, details.state].filter((part) => part.trim()).join(', ') || 'Not set'}</dd>
              </div>
              <div>
                <dt>Support</dt>
                <dd>{details.supportEmail.trim() || 'Not set'}</dd>
              </div>
              <div>
                <dt>Logo</dt>
                <dd>{hasLogoAsset ? 'Uploaded' : 'Not uploaded'}</dd>
              </div>
            </dl>
            <p className={styles.detailsSummaryVisibility}>{visibilitySummary}</p>

            {showValidationWarnings && timelineWarnings.length > 0 ? (
              <div className={styles.detailsTimelineWarnings}>
                <strong>Timing & visibility checks</strong>
                <ul>
                  {timelineWarnings.map((warning) => (
                    <li key={warning.id}>{warning.message}</li>
                  ))}
                </ul>
                {warningActions.length > 0 ? (
                  <div className={styles.detailsSummaryActions}>
                    {warningActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={styles.inlineAction}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
