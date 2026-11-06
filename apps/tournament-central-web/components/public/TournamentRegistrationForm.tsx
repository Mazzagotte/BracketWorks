'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ArrowRight, Check, Info } from 'lucide-react';
import {
  Button,
  CardDivider,
  CheckboxField,
  FormGrid,
  ICON_SIZE,
  Modal,
  Notice,
  SelectField,
  TextAreaField,
  TextField,
  capitalizeFirstLetter,
} from '@bracketworks/ui';

import styles from './TournamentRegistrationForm.module.css';
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
  /** Loading or error message shown at the top of the form, for example while settings load. */
  notice?: ReactNode;
  rulesText?: string;
  documents?: PublicTournamentDocument[];
  confirmation?: { code: string; status: string } | null;
  /** `modal` (default) opens in the shared Modal; `inline` renders in place, for example as a live preview. */
  presentation?: 'modal' | 'inline';
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

/** USBC number and address span both columns so names, email and phone, and city and state pair up. */
function isFullRowRegistrationField(field: RegistrationFieldConfigLike): boolean {
  const key = normalizeRegistrationFieldKey(field.key);
  return key.includes('address') || key.includes('usbc');
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
  notice,
  rulesText,
  documents = [],
  confirmation,
  presentation = 'modal',
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

  const closeDisclosure = () => setIsDisclosureOpen(false);

  const setBowlerField = (bowlerIndex: number, key: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      bowlers: prev.bowlers.map((entry, index) => (index === bowlerIndex ? { ...entry, [key]: value } : entry)),
    }));
  };

  const setAnswer = (bowlerIndex: number, questionId: string, value: RegistrationQuestionAnswerValue) => {
    setFormState((prev) => ({
      ...prev,
      bowlerQuestionAnswers: prev.bowlerQuestionAnswers.map((entry, index) => (
        index === bowlerIndex ? { ...entry, [questionId]: value } : entry
      )),
    }));
  };

  const toggleAnswerOption = (bowlerIndex: number, questionId: string, option: string, checked: boolean) => {
    setFormState((prev) => {
      const current = prev.bowlerQuestionAnswers[bowlerIndex]?.[questionId];
      const selected = Array.isArray(current) ? current : [];
      const next = checked ? [...selected, option] : selected.filter((value) => value !== option);
      return {
        ...prev,
        bowlerQuestionAnswers: prev.bowlerQuestionAnswers.map((entry, index) => (
          index === bowlerIndex ? { ...entry, [questionId]: next } : entry
        )),
      };
    });
  };

  const progress = (current: number) => (
    <ol className={styles.progress} aria-label="Registration progress">
      {['Details', 'Review', 'Confirmation'].map((label, index) => {
        const isComplete = index < current;
        return (
          <li
            key={label}
            className={index === current ? styles.stepCurrent : styles.step}
            aria-label={`${label}${isComplete ? ', completed' : ''}`}
            aria-current={index === current ? 'step' : undefined}
          >
            {isComplete
              ? <Check className={styles.stepCheck} size={ICON_SIZE.sm} aria-hidden="true" />
              : <span className={styles.stepNumber} aria-hidden="true">{index + 1}.</span>}
            {label}
          </li>
        );
      })}
    </ol>
  );

  const renderQuestion = (question: RegistrationQuestionConfigLike, bowlerIndex: number) => {
    const questionType = (question.type || 'short-text').toLowerCase();
    const options = normalizeQuestionOptions(question.options);
    const answer = formState.bowlerQuestionAnswers[bowlerIndex]?.[question.id];
    const label = question.label || 'Untitled question';
    const optional = !question.required;
    const text = typeof answer === 'string' ? answer : '';
    const key = `${question.id}-${bowlerIndex}`;
    const onText = (event: { target: { value: string } }) => setAnswer(bowlerIndex, question.id, event.target.value);

    if (questionType === 'long-text') {
      return <TextAreaField key={key} label={label} optional={optional} fullRow value={text} required={question.required} rows={3} onChange={onText} />;
    }
    if (questionType === 'number' || questionType === 'date') {
      return <TextField key={key} label={label} optional={optional} type={questionType} value={text} required={question.required} onChange={onText} />;
    }
    if (questionType === 'yes-no' || ((questionType === 'dropdown' || questionType === 'multiple-choice') && options.length > 0)) {
      const choices = questionType === 'yes-no' ? [['yes', 'Yes'], ['no', 'No']] : options.map((option) => [option, option]);
      return (
        <SelectField key={key} label={label} optional={optional} value={text} required={question.required} onChange={onText}>
          <option value="">Select an option</option>
          {choices.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
        </SelectField>
      );
    }
    if (questionType === 'checkbox') {
      const selected = Array.isArray(answer) ? answer : [];
      return (
        <fieldset key={key} className={styles.choiceGroup}>
          <legend className={styles.choiceLegend}>
            {label}
            {optional ? <span className={styles.optional}> (optional)</span> : null}
          </legend>
          {options.length > 0 ? options.map((option) => (
            <CheckboxField
              key={option}
              label={option}
              checked={selected.includes(option)}
              onChange={(event) => toggleAnswerOption(bowlerIndex, question.id, option, event.target.checked)}
            />
          )) : (
            <CheckboxField label="Yes" checked={answer === true} onChange={(event) => setAnswer(bowlerIndex, question.id, event.target.checked)} />
          )}
        </fieldset>
      );
    }
    return <TextField key={key} label={label} optional={optional} value={text} required={question.required} onChange={onText} />;
  };

  const sharedContactKeys = ['email', 'phone', 'address', 'city', 'state', 'zip'];
  const canCopyContact = fields.some((field) => sharedContactKeys.includes(normalizeRegistrationFieldKey(field.key)));
  const selectedEvent = events.find((entry) => entry.id === formState.eventId)?.name || 'Not selected';
  const selectedSquad = squads.find((entry) => entry.id === formState.squadId)?.name || 'Not selected';
  const selectedDivision = divisions.find((entry) => entry.id === formState.divisionId)?.name;

  const formatAnswer = (answer: RegistrationQuestionAnswerValue | undefined): string => {
    if (Array.isArray(answer)) return answer.join(', ') || 'Not provided';
    if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
    if (answer === 'yes') return 'Yes';
    if (answer === 'no') return 'No';
    return answer || 'Not provided';
  };

  const footer = confirmation ? (
    <Button variant="primary" onClick={onClose}>Done</Button>
  ) : (
    <>
      <span className={styles.footerHint}>
        <Info size={ICON_SIZE.md} aria-hidden="true" />
        {footerHint}
      </span>
      <Button
        variant="primary"
        onClick={openReview}
        disabled={isSubmitting}
        icon={<ArrowRight size={ICON_SIZE.md} aria-hidden="true" />}
        iconPosition="end"
      >
        {isSubmitting ? 'Submitting...' : 'Continue to review'}
      </Button>
    </>
  );

  const title = confirmation ? tournamentName : `Register: ${tournamentName}`;
  const description = confirmation ? undefined : "Choose your squad and event, then enter each bowler's information.";

  const body = (
    <>
      {confirmation ? (
        <div className={styles.form}>
          {progress(2)}
          <section className={styles.confirmation}>
            <h3 ref={confirmationRef} tabIndex={-1} className={styles.subsectionTitle}>Registration received</h3>
            <p className={styles.body}>Your confirmation number</p>
            <strong className={styles.code}>{confirmation.code}</strong>
            <p className={styles.body}>Status: {confirmation.status}</p>
          </section>
          <p className={styles.body}>Save this number for your records. Registration does not mean payment has been collected.</p>
          <p className={styles.body}>Payment is collected in cash at the venue during check-in. No online payment is collected here.</p>
        </div>
      ) : (
        <div ref={bodyRef} className={styles.form}>
          {progress(0)}
          {notice}
          <section aria-label="Payment timing">
            <Notice tone="info">
              <strong>Register now, pay at check-in.</strong> Payment is collected in cash at the venue during check-in. No online payment is collected on this form.
            </Notice>
          </section>

          <div className={styles.summary}>
            {tournamentLogoUrl ? <img src={tournamentLogoUrl} alt="" className={styles.logo} /> : null}
            <dl className={styles.summaryList}>
              <div><dt>Location</dt><dd>{tournamentLocation || 'TBD'}</dd></div>
              <div><dt>Date</dt><dd>{tournamentDate || 'Date TBA'}</dd></div>
            </dl>
          </div>

          {(rulesText?.trim() || documents.length > 0) ? (
            <details className={styles.rules}>
              <summary>Review tournament rules and documents</summary>
              <TournamentRules rulesText={rulesText} documents={documents} />
            </details>
          ) : null}

          <FormGrid>
            {squads.length > 0 ? (
              <SelectField label="Squad" value={formState.squadId} onChange={(event) => setFormState((prev) => ({ ...prev, squadId: event.target.value }))}>
                {squads.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name || `${entry.dateIso || ''} ${entry.startTime || ''}`.trim() || 'Squad'}</option>
                ))}
              </SelectField>
            ) : null}
            {events.length > 0 ? (
              <SelectField label="Event" value={formState.eventId} onChange={(event) => setFormState((prev) => ({ ...prev, eventId: event.target.value }))}>
                {events.map((entry) => <option key={entry.id} value={entry.id}>{entry.name || 'Untitled event'}</option>)}
              </SelectField>
            ) : null}
            {divisions.length > 0 ? (
              <SelectField label="Division" value={formState.divisionId} onChange={(event) => setFormState((prev) => ({ ...prev, divisionId: event.target.value }))}>
                {divisions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name || 'Untitled division'}</option>)}
              </SelectField>
            ) : null}
          </FormGrid>

          <p className={styles.bowlerCount}>
            <Info size={ICON_SIZE.md} aria-hidden="true" />
            {`This event requires ${requiredBowlerCount} bowler ${requiredBowlerCount === 1 ? 'form' : 'forms'}.`}
          </p>

          {formState.bowlers.map((bowlerFields, bowlerIndex) => (
            <section key={`bowler-${bowlerIndex}`} className={styles.bowler}>
              <CardDivider />
              <h3 className={styles.subsectionTitle}>{`Bowler ${bowlerIndex + 1}`}</h3>
              {bowlerIndex === 0 && isSignedIn ? (
                <div className={styles.convenience}>
                  <Button size="sm" variant="secondary" disabled={isLoadingProfile} onClick={() => void fillAccountInformation()}>
                    {isLoadingProfile ? 'Loading account...' : 'Use my account information'}
                  </Button>
                  <span className={styles.helper}>Fills only empty name and email fields for Bowler 1.</span>
                  {profileMessage ? <p role="status" className={styles.helper}>{profileMessage}</p> : null}
                  {profileError ? <p role="alert" className={styles.error}>{profileError}</p> : null}
                </div>
              ) : null}
              {bowlerIndex > 0 && canCopyContact ? (
                <div className={styles.convenience}>
                  <Button size="sm" variant="secondary" onClick={() => copyContact(bowlerIndex)}>Copy address/contact from Bowler 1</Button>
                  <span className={styles.helper}>Copies once. Names and bowling details stay separate; all fields remain editable.</span>
                </div>
              ) : null}
              <FormGrid>
                {fields.map((field) => {
                  const key = normalizeRegistrationFieldKey(field.key);
                  const shouldCapitalize = isNameOrLocationField(field);
                  return (
                    <TextField
                      key={`${field.id}-${bowlerIndex}`}
                      label={field.customLabel || field.label || 'Field'}
                      optional={field.mode === 'optional'}
                      fullRow={isFullRowRegistrationField(field)}
                      type={getRegistrationFieldInputType(field)}
                      value={bowlerFields[key] || ''}
                      autoCapitalize={shouldCapitalize ? 'words' : 'off'}
                      required={field.mode === 'required'}
                      onChange={(event) => setBowlerField(bowlerIndex, key, shouldCapitalize ? capitalizeFirstLetter(event.target.value) : event.target.value)}
                    />
                  );
                })}
                {questions.map((question) => renderQuestion(question, bowlerIndex))}
              </FormGrid>
              {bowlerIndex > 0 && copyMessage ? <p role="status" className={styles.helper}>{copyMessage}</p> : null}
            </section>
          ))}

          <CardDivider />
          <TextAreaField
            label="Notes for the organizer"
            optional
            value={formState.notes}
            onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
            rows={3}
          />

          {submitMessage ? <Notice tone="info" role="status">{submitMessage}</Notice> : null}
        </div>
      )}
    </>
  );

  const reviewDialog = (
    <Modal
      open={isDisclosureOpen}
      onClose={closeDisclosure}
      title="Please review before submitting"
      size="lg"
      closeLabel="Close review"
      closeOnBackdrop={false}
      footer={(
        <>
          <Button variant="secondary" onClick={closeDisclosure}>Go back</Button>
          <Button
            variant="primary"
            disabled={!formState.acceptTerms || isSubmitting}
            onClick={() => {
              setIsDisclosureOpen(false);
              void onSubmit();
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Agree and submit registration'}
          </Button>
        </>
      )}
    >
      <div className={styles.form}>
        {progress(1)}
        <section className={styles.review} aria-label="Registration review">
          <dl className={styles.reviewList}>
            <div><dt>Tournament</dt><dd>{tournamentName}</dd></div>
            <div><dt>Event</dt><dd>{selectedEvent}</dd></div>
            <div><dt>Squad</dt><dd>{selectedSquad}</dd></div>
            {formState.divisionId ? <div><dt>Division</dt><dd>{selectedDivision}</dd></div> : null}
          </dl>
          {formState.bowlers.map((bowler, index) => (
            <div key={index} className={styles.reviewGroup}>
              <CardDivider />
              <h3 className={styles.subsectionTitle}>Bowler {index + 1}</h3>
              <dl className={styles.reviewList}>
                {fields.map((field) => (
                  <div key={field.id}><dt>{field.customLabel || field.label}</dt><dd>{bowler[normalizeRegistrationFieldKey(field.key)] || 'Not provided'}</dd></div>
                ))}
                {questions.map((question) => (
                  <div key={question.id}><dt>{question.label}</dt><dd>{formatAnswer(formState.bowlerQuestionAnswers[index]?.[question.id])}</dd></div>
                ))}
              </dl>
            </div>
          ))}
          <CardDivider />
          {formState.notes ? <p className={styles.body}>Notes: {formState.notes}</p> : null}
          <p className={styles.body}>Payment: cash at the venue during check-in. No online payment is collected.</p>
        </section>
        <p className={styles.body}>
          By submitting this entry form, I certify that the information provided is accurate to the best of my knowledge. Information collected through this form will be used for tournament registration, eligibility verification, scheduling, results, awards, and tournament-related communications. Personal contact information will not be sold or shared with unrelated third parties.
        </p>
        <CheckboxField
          ref={disclosureAgreementRef}
          label="I have read and agree to this disclosure."
          checked={formState.acceptTerms}
          onChange={(event) => setFormState((prev) => ({ ...prev, acceptTerms: event.target.checked }))}
        />
      </div>
    </Modal>
  );

  if (presentation === 'inline') {
    return (
      <section className={styles.inline} aria-label={title}>
        <header className={styles.inlineHeader}>
          <h3 className={styles.subsectionTitle}>{title}</h3>
          {description ? <p className={styles.helper}>{description}</p> : null}
        </header>
        {body}
        <div className={styles.inlineFooter}>{footer}</div>
        {reviewDialog}
      </section>
    );
  }

  return (
    <>
      <Modal
        open
        onClose={() => onClose?.()}
        title={title}
        description={description}
        size="lg"
        closeLabel="Close tournament registration"
        closeOnBackdrop={false}
        footer={footer}
      >
        {body}
      </Modal>
      {reviewDialog}
    </>
  );
}
