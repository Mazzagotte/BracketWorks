'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Info, MapPin, Trophy, X } from 'lucide-react';
import { capitalizeFirstLetter } from '@bracketworks/ui';

import styles from '../../app/page.module.css';

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
}: TournamentRegistrationFormProps) {
  const [isDisclosureOpen, setIsDisclosureOpen] = useState(false);
  const disclosureAgreementRef = useRef<HTMLInputElement | null>(null);
  const disclosureTriggerRef = useRef<HTMLButtonElement | null>(null);

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
      <div className={styles.registrationModalBody}>
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
            This event requires {requiredBowlerCount} bowler form{requiredBowlerCount === 1 ? '' : 's'}.
          </p>

          {formState.bowlers.map((bowlerFields, bowlerIndex) => (
            <div key={`bowler-${bowlerIndex}`} className={styles.registrationBowlerSection}>
              <h5><span className={styles.registrationBowlerIcon} aria-hidden="true"><Trophy size={16} /></span>Bowler {bowlerIndex + 1}</h5>
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
          onClick={() => setIsDisclosureOpen(true)}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Review & Submit'}
        </button>
      </footer>
      {isDisclosureOpen && typeof document !== 'undefined'
        ? createPortal(
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
                <span className={styles.detailsModalEyebrow}>Registration Disclosure</span>
                <h2 id="registration-disclosure-title">Please review before submitting</h2>
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
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
