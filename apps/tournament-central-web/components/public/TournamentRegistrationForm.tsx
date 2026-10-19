'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, SetStateAction } from 'react';
import { CalendarDays, Check, Info, MapPin, Trophy, X } from 'lucide-react';
import { capitalizeFirstLetter } from '@bracketworks/ui';

import styles from '../../app/page.module.css';
import TournamentRules, { type PublicTournamentDocument } from './TournamentRules';
import { getMyAccount } from '@/components/organizer/organizerApi';

export type RegistrationQuestionAnswerValue = string | boolean | string[];

export type RegistrationFormState = {
  bowlers: Array<Record<string, string>>;
  eventId: string;
  divisionId: string;
  squadId: string;
  notes: string;
  bowlerQuestionAnswers: Array<Record<string, RegistrationQuestionAnswerValue>>;
  acceptTerms: boolean;
};

type RegistrationFieldConfigLike = {
  id: string;
  key: string;
  label: string;
  customLabel?: string;
  mode: 'required' | 'optional' | 'dont-ask';
  validation?: string;
};

type RegistrationQuestionConfigLike = {
  id: string;
  label: string;
  type?: 'short-text' | 'long-text' | 'number' | 'yes-no' | 'dropdown' | 'multiple-choice' | 'checkbox' | 'date';
  required: boolean;
  options?: string[];
};

type RegistrationOptionLike = {
  id: string;
  name: string;
};

type RegistrationSquadLike = RegistrationOptionLike & {
  dateIso?: string;
  startTime?: string;
};

type TournamentRegistrationFormProps = {
  tournamentName: string;
  tournamentDate?: string;
  tournamentLocation?: string;
  tournamentLogoUrl?: string | null;
  squads: RegistrationSquadLike[];
  events: RegistrationOptionLike[];
  divisions: RegistrationOptionLike[];
  fields: RegistrationFieldConfigLike[];
  questions: RegistrationQuestionConfigLike[];
  requiredBowlerCount: number;
  formState: RegistrationFormState;
  setFormState: Dispatch<SetStateAction<RegistrationFormState>>;
  submitMessage: string | null;
  isSubmitting: boolean;
  onSubmit: () => void | Promise<void>;
  onClose?: () => void;
  footerHint?: string;
  rulesText?: string;
  documents?: PublicTournamentDocument[];
  confirmation?: { code: string; status: string } | null;
};

function normalizeRegistrationFieldKey(key: string): string {
  return key.trim().toLowerCase();
}

function getRegistrationFieldInputType(field: RegistrationFieldConfigLike): 'text' | 'email' | 'tel' | 'number' | 'date' {
  const key = normalizeRegistrationFieldKey(field.key);
  const validation = (field.validation || '').trim().toLowerCase();

  if (validation === 'email' || key.includes('email')) {
    return 'email';
  }

  if (validation === 'phone' || key.includes('phone')) {
    return 'tel';
  }

  if (validation === 'number' || key.includes('average')) {
    return 'number';
  }

  if (validation === 'date' || key.includes('date')) {
    return 'date';
  }

  return 'text';
}

function isWideRegistrationField(field: RegistrationFieldConfigLike): boolean {
  const key = normalizeRegistrationFieldKey(field.key);
  return key.includes('email')
    || key.includes('phone')
    || key.includes('usbc')
    || key.includes('address')
    || key.includes('zip')
    || key.includes('city')
    || key.includes('state');
}

function isNameOrLocationField(field: RegistrationFieldConfigLike): boolean {
  const key = normalizeRegistrationFieldKey(field.key);
  return key.includes('name')
    || key.includes('organization')
    || key.includes('venue')
    || key.includes('address')
    || key.includes('city')
    || key.includes('state');
}

function normalizeQuestionOptions(options: string[] | undefined): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => option.trim()).filter(Boolean);
}

export default function TournamentRegistrationForm({
  tournamentName,
  tournamentDate,
  tournamentLocation,
  tournamentLogoUrl,
  squads,
  events,
  divisions,
  fields,
  questions,
  requiredBowlerCount,
  formState,
  setFormState,
  submitMessage,
  isSubmitting,
  onSubmit,
  onClose,
  footerHint = 'Your entry is saved after submission.',
  rulesText,
  documents = [],
  confirmation,
}: TournamentRegistrationFormProps) {
  const [isDisclosureOpen, setIsDisclosureOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(true);
  const disclosureAgreementRef = useRef<HTMLInputElement | null>(null);
  const disclosureTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    setIsSignedIn(Boolean(sessionStorage.getItem('access_token')));
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (confirmation) confirmationRef.current?.focus();
  }, [confirmation]);

  const fillAccountInformation = async () => {
    setIsLoadingProfile(true);
    setProfileError('');
    setProfileMessage('');
    try {
      const token = sessionStorage.getItem('access_token');
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const profile = await getMyAccount(token);
      if (!mountedRef.current) return;
      const values: Record<string, string> = {
        first_name: profile.first_name, last_name: profile.last_name, email: profile.email,
      };
      const allowedKeys = new Set(fields.map((field) => normalizeRegistrationFieldKey(field.key)));
      setFormState((prev) => ({
        ...prev,
        bowlers: prev.bowlers.map((bowler, index) => index !== 0 ? bowler : {
          ...bowler,
          ...Object.fromEntries(Object.entries(values).filter(([key, value]) => allowedKeys.has(key) && value && !bowler[key]?.trim())),
        }),
      }));
      setProfileMessage('Account name and email applied to empty Bowler 1 fields only. Please check your details.');
    } catch (cause) {
      if (mountedRef.current) setProfileError(cause instanceof Error ? cause.message : 'Unable to load your account information.');
    } finally {
      if (mountedRef.current) setIsLoadingProfile(false);
    }
  };

  const copyContact = (bowlerIndex: number) => {
    const keys = new Set(['email', 'phone', 'address', 'city', 'state', 'zip']);
    const sharedKeys = fields.map((field) => normalizeRegistrationFieldKey(field.key)).filter((key) => keys.has(key));
    setFormState((prev) => ({
      ...prev,
      bowlers: prev.bowlers.map((bowler, index) => index !== bowlerIndex ? bowler : {
        ...bowler,
        ...Object.fromEntries(sharedKeys.filter((key) => prev.bowlers[0]?.[key]?.trim()).map((key) => [key, prev.bowlers[0][key]])),
      }),
    }));
    setCopyMessage(`Bowler 1's available contact/address details copied to Bowler ${bowlerIndex + 1}. You can edit them independently.`);
  };

  const openReview = () => {
    const inputs = bodyRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
    for (const input of inputs ?? []) {
      if (!input.reportValidity()) return;
    }
    setFormState((prev) => ({ ...prev, acceptTerms: false }));
    setIsDisclosureOpen(true);
  };

  useEffect(() => {
    if (isDisclosureOpen) {
      disclosureAgreementRef.current?.focus();
    }
  }, [isDisclosureOpen]);

  const closeDisclosure = () => {
    setIsDisclosureOpen(false);
    disclosureTriggerRef.current?.focus();
  };

  const handleDisclosureKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDisclosure();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const progress = (current: number) => <ol className={styles.registrationProgress} aria-label="Registration progress">
    {['Details', 'Review', 'Confirmation'].map((label, index) => <li key={label}
      className={index < current ? styles.registrationStepComplete : undefined}
      aria-label={`${label}${index < current ? ', completed' : ''}`}
      aria-current={index === current ? 'step' : undefined}>
      <span className={styles.registrationStepNumber} aria-hidden="true">{index < current ? <Check size={16} strokeWidth={3} /> : index + 1}</span>
      <span className={styles.registrationStepLabel}>{label}</span>
    </li>)}
  </ol>;

  if (confirmation) return <>
    <header className={styles.detailsModalHeader}><h2 ref={confirmationRef} tabIndex={-1}>Registration received</h2></header>
    <div className={styles.registrationModalBody}>
      {progress(2)}
      <section className={styles.registrationReviewCard}>
        <h3>{tournamentName}</h3>
        <p>Your confirmation number</p><strong className={styles.registrationConfirmationCode}>{confirmation.code}</strong>
        <p>Status: {confirmation.status}</p>
        <p>Save this number for your records. Registration does not mean payment has been collected.</p>
        <p>Payment is collected in cash at the venue during check-in. No online payment is collected here.</p>
      </section>
    </div>
    <footer className={styles.detailsModalFooter}><button type="button" className={styles.registrationSubmitButton} onClick={onClose}>Done</button></footer>
  </>;

  return (
    <>
      <header className={`${styles.detailsModalHeader} ${styles.registrationModalHeader}`}>
        <h4>Register: {tournamentName}</h4>
        {onClose ? (
          <button type="button" className={styles.detailsModalClose} onClick={onClose} aria-label="Close tournament registration">
            <X size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <div ref={bodyRef} className={styles.registrationModalBody}>
        {progress(0)}
        <aside className={styles.registrationPaymentNotice} aria-label="Payment timing">
          <strong>Register now, pay at check-in</strong>
          <p>Payment is collected in cash at the venue during check-in. No online payment is collected on this form.</p>
        </aside>
        {(rulesText?.trim() || documents.length > 0) && <details className={styles.registrationRules}>
          <summary>Review tournament rules and documents</summary>
          <TournamentRules rulesText={rulesText} documents={documents} />
        </details>}
        <p className={styles.registrationModalLead}>Fill out this registration form to reserve your spot.</p>

        <div className={styles.registrationSummary}>
          <span className={styles.registrationSummaryIcon} aria-hidden="true">
            {tournamentLogoUrl ? <img src={tournamentLogoUrl} alt="" className={styles.registrationSummaryLogo} /> : <Trophy size={22} />}
          </span>
          <div className={styles.registrationSummaryItem}>
            <span>Event</span>
            <strong>{tournamentName}</strong>
          </div>
          <div className={styles.registrationSummaryItem}>
            <span>Location</span>
            <strong>{tournamentLocation || 'TBD'}</strong>
          </div>
          <div className={styles.registrationSummaryItem}>
            <span>Date</span>
            <strong>{tournamentDate || 'Date TBA'}</strong>
          </div>
        </div>

        <div className={styles.registrationGrid}>
          {squads.length > 0 && (
            <label className={styles.registrationSelectRow}>
              Squad
              <select
                value={formState.squadId}
                onChange={(event) => setFormState((prev) => ({ ...prev, squadId: event.target.value }))}
              >
                {squads.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name || `${entry.dateIso || ''} ${entry.startTime || ''}`.trim() || 'Squad'}</option>
                ))}
              </select>
            </label>
          )}

          {events.length > 0 && (
            <label className={styles.registrationSelectRow}>
              Event
              <select
                value={formState.eventId}
                onChange={(event) => setFormState((prev) => ({ ...prev, eventId: event.target.value }))}
              >
                {events.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name || 'Untitled Event'}</option>
                ))}
              </select>
            </label>
          )}

          {divisions.length > 0 && (
            <label className={styles.registrationSelectRow}>
              Division
              <select
                value={formState.divisionId}
                onChange={(event) => setFormState((prev) => ({ ...prev, divisionId: event.target.value }))}
              >
                {divisions.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name || 'Untitled Division'}</option>
                ))}
              </select>
            </label>
          )}

          <p className={styles.registrationBowlerCountInfo}>
            <Info size={19} aria-hidden="true" />
            {`This event requires ${requiredBowlerCount} bowler ${requiredBowlerCount === 1 ? 'form' : 'forms'}.`}
          </p>

          {formState.bowlers.map((bowlerFields, bowlerIndex) => (
            <div key={`bowler-${bowlerIndex}`} className={styles.registrationBowlerSection}>
              <h5><span className={styles.registrationBowlerIcon} aria-hidden="true"><Trophy size={16} /></span>{`Bowler ${bowlerIndex + 1}`}</h5>
              {bowlerIndex === 0 && isSignedIn && <div className={styles.registrationConvenience}>
                <button type="button" className={styles.detailsModalSecondaryAction} disabled={isLoadingProfile} onClick={() => void fillAccountInformation()}>
                  {isLoadingProfile ? 'Loading account...' : 'Use my account information'}
                </button>
                <small>Fills only empty name and email fields for Bowler 1.</small>
                {profileMessage && <p role="status">{profileMessage}</p>}
                {profileError && <p role="alert">{profileError}</p>}
              </div>}
              {bowlerIndex > 0 && fields.some((field) => ['email', 'phone', 'address', 'city', 'state', 'zip'].includes(normalizeRegistrationFieldKey(field.key))) && <div className={styles.registrationConvenience}>
                <button type="button" className={styles.detailsModalSecondaryAction} onClick={() => copyContact(bowlerIndex)}>Copy address/contact from Bowler 1</button>
                <small>Copies once. Names and bowling details stay separate; all fields remain editable.</small>
              </div>}
              <div className={styles.registrationGrid}>
                {fields.map((field) => {
                  const key = normalizeRegistrationFieldKey(field.key);
                  const label = field.customLabel || field.label || 'Field';
                  const required = field.mode === 'required';
                  const inputType = getRegistrationFieldInputType(field);
                  const shouldCapitalize = isNameOrLocationField(field);

                  return (
                    <label key={`${field.id}-${bowlerIndex}`} className={isWideRegistrationField(field) ? styles.registrationFieldWide : undefined}>
                      {label} {required ? '*' : ''}
                      <input
                        type={inputType}
                        value={bowlerFields[key] || ''}
                        autoCapitalize={shouldCapitalize ? 'words' : 'off'}
                        required={required}
                        onChange={(event) => setFormState((prev) => {
                          const nextBowlers = prev.bowlers.map((entry, index) => (
                            index === bowlerIndex
                              ? {
                                  ...entry,
                                  [key]: shouldCapitalize ? capitalizeFirstLetter(event.target.value) : event.target.value,
                                }
                              : entry
                          ));

                          return {
                            ...prev,
                            bowlers: nextBowlers,
                          };
                        })}
                      />
                    </label>
                  );
                })}
              </div>
              {copyMessage && <p role="status">{copyMessage}</p>}

              {questions.length > 0 && (
                <div className={styles.registrationDynamicSection}>
                  <h5>Custom Questions</h5>
                  {questions.map((question) => (
                    <label key={`${question.id}-${bowlerIndex}`} className={styles.registrationQuestionRow}>
                      {question.label || 'Untitled question'} {question.required ? '*' : ''}
                      {(() => {
                        const questionType = (question.type || 'short-text').toLowerCase();
                        const options = normalizeQuestionOptions(question.options);
                        const answerSet = formState.bowlerQuestionAnswers[bowlerIndex] || {};
                        const answer = answerSet[question.id];

                        if (questionType === 'long-text') {
                          return (
                            <textarea
                              value={typeof answer === 'string' ? answer : ''}
                              required={question.required}
                              rows={3}
                              onChange={(event) => setFormState((prev) => {
                                const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                  index === bowlerIndex
                                    ? {
                                        ...entry,
                                        [question.id]: event.target.value,
                                      }
                                    : entry
                                ));

                                return {
                                  ...prev,
                                  bowlerQuestionAnswers: nextAnswers,
                                };
                              })}
                            />
                          );
                        }

                        if (questionType === 'number') {
                          return (
                            <input
                              type="number"
                              value={typeof answer === 'string' ? answer : ''}
                              required={question.required}
                              onChange={(event) => setFormState((prev) => {
                                const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                  index === bowlerIndex
                                    ? {
                                        ...entry,
                                        [question.id]: event.target.value,
                                      }
                                    : entry
                                ));

                                return {
                                  ...prev,
                                  bowlerQuestionAnswers: nextAnswers,
                                };
                              })}
                            />
                          );
                        }

                        if (questionType === 'date') {
                          return (
                            <input
                              type="date"
                              value={typeof answer === 'string' ? answer : ''}
                              required={question.required}
                              onChange={(event) => setFormState((prev) => {
                                const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                  index === bowlerIndex
                                    ? {
                                        ...entry,
                                        [question.id]: event.target.value,
                                      }
                                    : entry
                                ));

                                return {
                                  ...prev,
                                  bowlerQuestionAnswers: nextAnswers,
                                };
                              })}
                            />
                          );
                        }

                        if (questionType === 'yes-no') {
                          return (
                            <select
                              value={typeof answer === 'string' ? answer : ''}
                              required={question.required}
                              onChange={(event) => setFormState((prev) => {
                                const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                  index === bowlerIndex
                                    ? {
                                        ...entry,
                                        [question.id]: event.target.value,
                                      }
                                    : entry
                                ));

                                return {
                                  ...prev,
                                  bowlerQuestionAnswers: nextAnswers,
                                };
                              })}
                            >
                              <option value="">Select an option</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          );
                        }

                        if ((questionType === 'dropdown' || questionType === 'multiple-choice') && options.length > 0) {
                          return (
                            <select
                              value={typeof answer === 'string' ? answer : ''}
                              required={question.required}
                              onChange={(event) => setFormState((prev) => {
                                const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                  index === bowlerIndex
                                    ? {
                                        ...entry,
                                        [question.id]: event.target.value,
                                      }
                                    : entry
                                ));

                                return {
                                  ...prev,
                                  bowlerQuestionAnswers: nextAnswers,
                                };
                              })}
                            >
                              <option value="">Select an option</option>
                              {options.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          );
                        }

                        if (questionType === 'checkbox' && options.length > 0) {
                          const selectedOptions = Array.isArray(answer) ? answer : [];

                          return (
                            <div className={styles.registrationQuestionChoices}>
                              {options.map((option) => {
                                const isChecked = selectedOptions.includes(option);

                                return (
                                  <label key={option} className={styles.registrationChoiceItem}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(event) => {
                                        const checked = event.target.checked;
                                        setFormState((prev) => {
                                          const currentBowlerAnswers = prev.bowlerQuestionAnswers[bowlerIndex] || {};
                                          const currentQuestionAnswer = currentBowlerAnswers[question.id];
                                          const prevSelected = Array.isArray(currentQuestionAnswer)
                                            ? currentQuestionAnswer as string[]
                                            : [];

                                          const nextSelected = checked
                                            ? [...prevSelected, option]
                                            : prevSelected.filter((value) => value !== option);

                                          const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                            index === bowlerIndex
                                              ? {
                                                  ...entry,
                                                  [question.id]: nextSelected,
                                                }
                                              : entry
                                          ));

                                          return {
                                            ...prev,
                                            bowlerQuestionAnswers: nextAnswers,
                                          };
                                        });
                                      }}
                                    />
                                    <span>{option}</span>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        }

                        if (questionType === 'checkbox') {
                          return (
                            <label className={styles.registrationChoiceItem}>
                              <input
                                type="checkbox"
                                checked={answer === true}
                                onChange={(event) => setFormState((prev) => {
                                  const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                    index === bowlerIndex
                                      ? {
                                          ...entry,
                                          [question.id]: event.target.checked,
                                        }
                                      : entry
                                  ));

                                  return {
                                    ...prev,
                                    bowlerQuestionAnswers: nextAnswers,
                                  };
                                })}
                              />
                              <span>Yes</span>
                            </label>
                          );
                        }

                        return (
                          <input
                            value={typeof answer === 'string' ? answer : ''}
                            required={question.required}
                            onChange={(event) => setFormState((prev) => {
                              const nextAnswers = prev.bowlerQuestionAnswers.map((entry, index) => (
                                index === bowlerIndex
                                  ? {
                                      ...entry,
                                      [question.id]: event.target.value,
                                    }
                                  : entry
                              ));

                              return {
                                ...prev,
                                bowlerQuestionAnswers: nextAnswers,
                              };
                            })}
                          />
                        );
                      })()}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <label className={styles.registrationNotesRow}>
          Notes for Organizer
          <textarea
            value={formState.notes}
            onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
            rows={3}
          />
        </label>

        {submitMessage && <p className={styles.registrationSubmitMessage}>{submitMessage}</p>}
      </div>
      <footer className={`${styles.detailsModalFooter} ${styles.registrationModalFooter}`}>
        <span className={styles.detailsModalHint}><Info size={20} aria-hidden="true" />{footerHint}</span>
        <button
          ref={disclosureTriggerRef}
          type="button"
          className={styles.registrationSubmitButton}
          onClick={openReview}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Continue to Review'}
        </button>
      </footer>
      {isDisclosureOpen
        ? (
          <div
            className={styles.registrationDisclosureBackdrop}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeDisclosure();
              }
            }}
          >
            <section
              className={styles.registrationDisclosureDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="registration-disclosure-title"
              aria-describedby="registration-disclosure-copy"
              tabIndex={-1}
              onKeyDown={handleDisclosureKeyDown}
            >
              <div className={styles.registrationDisclosureCopy}>
                {progress(1)}
                <span className={styles.detailsModalEyebrow}>Registration Disclosure</span>
                <h2 id="registration-disclosure-title">Please review before submitting</h2>
                <section className={styles.registrationReviewCard} aria-label="Registration review">
                  <dl>
                    <dt>Tournament</dt><dd>{tournamentName}</dd>
                    <dt>Event</dt><dd>{events.find((entry) => entry.id === formState.eventId)?.name || 'Not selected'}</dd>
                    <dt>Squad</dt><dd>{squads.find((entry) => entry.id === formState.squadId)?.name || 'Not selected'}</dd>
                    {formState.divisionId && <><dt>Division</dt><dd>{divisions.find((entry) => entry.id === formState.divisionId)?.name}</dd></>}
                  </dl>
                  {formState.bowlers.map((bowler, index) => <div key={index}>
                    <h3>Bowler {index + 1}</h3>
                    <dl>{fields.map((field) => <div key={field.id}><dt>{field.customLabel || field.label}</dt><dd>{bowler[normalizeRegistrationFieldKey(field.key)] || 'Not provided'}</dd></div>)}
                    {questions.map((question) => {
                      const answer = formState.bowlerQuestionAnswers[index]?.[question.id];
                      return <div key={question.id}><dt>{question.label}</dt><dd>{Array.isArray(answer) ? answer.join(', ') : typeof answer === 'boolean' ? answer ? 'Yes' : 'No' : answer || 'Not provided'}</dd></div>;
                    })}</dl>
                  </div>)}
                  {formState.notes && <p>Notes: {formState.notes}</p>}
                  <p>Payment: cash at the venue during check-in. No online payment is collected.</p>
                </section>
                <p id="registration-disclosure-copy">
                  By submitting this entry form, I certify that the information provided is accurate to the best of my knowledge. Information collected through this form will be used for tournament registration, eligibility verification, scheduling, results, awards, and tournament-related communications. Personal contact information will not be sold or shared with unrelated third parties.
                </p>
              </div>
              <label className={styles.registrationConsentRow}>
                <input
                  ref={disclosureAgreementRef}
                  type="checkbox"
                  checked={formState.acceptTerms}
                  onChange={(event) => setFormState((prev) => ({ ...prev, acceptTerms: event.target.checked }))}
                />
                <span>I have read and agree to this disclosure.</span>
              </label>
              <div className={styles.registrationDisclosureActions}>
                <button type="button" className={styles.registrationDisclosureCancel} onClick={closeDisclosure}>
                  Go Back
                </button>
                <button
                  type="button"
                  className={styles.registrationSubmitButton}
                  disabled={!formState.acceptTerms || isSubmitting}
                  onClick={() => {
                    setIsDisclosureOpen(false);
                    void onSubmit();
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Agree & Submit Registration'}
                </button>
              </div>
            </section>
          </div>
        )
        : null}
    </>
  );
}
