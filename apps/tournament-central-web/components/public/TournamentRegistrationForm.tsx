'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ArrowRight, Check, CircleAlert, Info, Minus, Plus } from 'lucide-react';
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
import type { SideEventSelection } from '@/components/organizer/formatTypes';
import { checkRegistrationEligibility, parseReferenceDate, requiredBowlerFields } from './registrationEligibility';
import {
  bracketPayoutLine,
  formatSideEventMoney,
  keepOfferedSelections,
  offeredSideEvents,
  sideEventLines,
  type OfferedSideEvent,
  type PublicFeeConfig,
} from './registrationSideEvents';

export type RegistrationQuestionAnswerValue = string | boolean | string[];

export type RegistrationFormState = {
  bowlers: Array<Record<string, string>>;
  eventId: string;
  divisionId: string;
  squadId: string;
  notes: string;
  bowlerQuestionAnswers: Array<Record<string, RegistrationQuestionAnswerValue>>;
  acceptTerms: boolean;
  /** Optional side events picked on the form. The server adds required fees and prices every line. */
  sideEvents?: SideEventSelection[];
  /** Staff only: register even though the bowlers don't meet the rules (`eligibility="warn"`). */
  overrideEligibility?: boolean;
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

type RegistrationEventLike = RegistrationOptionLike & {
  entryFeeCents?: number;
  /** Event rules from setup (EventRules), used for eligibility checks. */
  rules?: unknown;
};

type RegistrationDivisionLike = RegistrationOptionLike & {
  minAverage?: number | null;
  maxAverage?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  /** Division rules from setup (DivisionRules), used for the gender check. */
  rules?: unknown;
};

type RegistrationSquadLike = RegistrationOptionLike & {
  dateIso?: string;
  startTime?: string;
};

/** Fields the event or division rules need when setup doesn't already ask for them. */
const RULE_FIELDS: RegistrationFieldConfigLike[] = [
  { id: 'rule-usbc_number', key: 'usbc_number', label: 'USBC number', mode: 'required', validation: 'Pattern' },
  { id: 'rule-date_of_birth', key: 'date_of_birth', label: 'Date of birth', mode: 'required', validation: 'Date' },
  { id: 'rule-average', key: 'average', label: 'Average', mode: 'required', validation: 'Number' },
  { id: 'rule-gender', key: 'gender', label: 'Gender', mode: 'required', validation: 'Enum' },
];

const GENDER_OPTIONS: Array<[string, string]> = [['M', 'Man'], ['F', 'Woman']];

type TournamentRegistrationFormProps = {
  tournamentName: string;
  tournamentDate?: string;
  tournamentLocation?: string;
  tournamentLogoUrl?: string | null;
  squads: RegistrationSquadLike[];
  events: RegistrationEventLike[];
  divisions: RegistrationDivisionLike[];
  fields: RegistrationFieldConfigLike[];
  /** Fees and side events from the public registration config. */
  fees?: PublicFeeConfig[];
  /** First tournament day (YYYY-MM-DD), for division age limits. */
  startDate?: string | null;
  /**
   * `block` (default): bowlers who don't meet the rules can't continue.
   * `warn`: staff see the same problems and may tick "Register anyway".
   */
  eligibility?: 'block' | 'warn';
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
  fields: configuredFields,
  fees,
  startDate,
  eligibility = 'block',
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
  const eligibilityRef = useRef<HTMLDivElement>(null);
  const sideEventsHeadingId = useId();
  const [showEligibility, setShowEligibility] = useState(false);

  const eventConfig = events.find((entry) => entry.id === formState.eventId) ?? null;
  const divisionConfig = divisions.find((entry) => entry.id === formState.divisionId) ?? null;

  // Rules can need a field setup doesn't ask for (gender for a women's division): ask for it, required.
  // A setup may ask gender as a custom "Gender" question instead of the built-in field; use its answer.
  const genderQuestionId = questions.find((question) => question.label.trim().toLowerCase() === 'gender')?.id ?? null;
  const ruleFieldKeys = useMemo(() => requiredBowlerFields(eventConfig, divisionConfig), [eventConfig, divisionConfig]);
  const fields = useMemo(() => {
    const list = configuredFields.map((field) => (
      ruleFieldKeys.has(normalizeRegistrationFieldKey(field.key)) && field.mode !== 'required' ? { ...field, mode: 'required' as const } : field
    ));
    const asked = new Set(list.map((field) => normalizeRegistrationFieldKey(field.key)));
    if (genderQuestionId) asked.add('gender');
    return [...list, ...RULE_FIELDS.filter((field) => ruleFieldKeys.has(field.key) && !asked.has(field.key))];
  }, [configuredFields, ruleFieldKeys, genderQuestionId]);

  const eligibilityProblems = useMemo(() => checkRegistrationEligibility({
    event: eventConfig,
    division: divisionConfig,
    bowlers: formState.bowlers.map((bowler, index) => {
      const answer = genderQuestionId ? formState.bowlerQuestionAnswers[index]?.[genderQuestionId] : undefined;
      return !bowler.gender && typeof answer === 'string' ? { ...bowler, gender: answer } : bowler;
    }),
    referenceDate: parseReferenceDate(startDate),
  }), [eventConfig, divisionConfig, formState.bowlers, formState.bowlerQuestionAnswers, genderQuestionId, startDate]);

  const offered = useMemo(
    () => offeredSideEvents(fees, { eventId: formState.eventId, divisionId: formState.divisionId, squadId: formState.squadId }),
    [fees, formState.eventId, formState.divisionId, formState.squadId],
  );
  const bowlerCount = formState.bowlers.length;
  const lines = useMemo(() => sideEventLines(offered, formState.sideEvents, bowlerCount), [offered, formState.sideEvents, bowlerCount]);
  const sideEventsTotal = lines.reduce((total, line) => total + line.totalCents, 0);
  const entryFeeCents = typeof eventConfig?.entryFeeCents === 'number' ? Math.max(0, eventConfig.entryFeeCents) : 0;

  // Drop picks that no longer apply after the event, division, squad, or bowler count changes.
  useEffect(() => {
    const current = formState.sideEvents ?? [];
    const kept = keepOfferedSelections(current, offered, bowlerCount);
    if (JSON.stringify(kept) !== JSON.stringify(current)) {
      setFormState((prev) => ({ ...prev, sideEvents: kept }));
    }
  }, [offered, bowlerCount, formState.sideEvents, setFormState]);

  // An override only applies while there is something to override.
  useEffect(() => {
    if (eligibilityProblems.length === 0 && formState.overrideEligibility) {
      setFormState((prev) => ({ ...prev, overrideEligibility: false }));
    }
  }, [eligibilityProblems.length, formState.overrideEligibility, setFormState]);

  const setSideEventQuantity = (feeId: string, bowlerIndex: number | null, quantity: number) => {
    setFormState((prev) => {
      const rest = (prev.sideEvents ?? []).filter((item) => !(item.feeId === feeId && item.bowlerIndex === bowlerIndex));
      return { ...prev, sideEvents: quantity > 0 ? [...rest, { feeId, bowlerIndex, quantity }] : rest };
    });
  };

  const bowlerName = (index: number): string => {
    const bowler = formState.bowlers[index] ?? {};
    return `${bowler.first_name ?? ''} ${bowler.last_name ?? ''}`.trim() || `Bowler ${index + 1}`;
  };

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
    if (eligibilityProblems.length > 0 && (eligibility === 'block' || !formState.overrideEligibility)) {
      setShowEligibility(true);
      window.setTimeout(() => eligibilityRef.current?.focus(), 0);
      return;
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

  const formatFieldValue = (key: string, value: string | undefined): string => {
    if (key === 'gender') return GENDER_OPTIONS.find(([code]) => code === value)?.[1] ?? (value || 'Not provided');
    return value || 'Not provided';
  };

  const renderSideEventControl = (item: OfferedSideEvent, bowlerIndex: number | null) => {
    const name = item.fee.name || 'Side event';
    const who = bowlerIndex !== null && bowlerCount > 1 ? bowlerName(bowlerIndex) : null;
    const forWho = bowlerIndex !== null ? ` for ${bowlerName(bowlerIndex)}` : '';
    const quantity = (formState.sideEvents ?? [])
      .find((selection) => selection.feeId === item.fee.id && selection.bowlerIndex === bowlerIndex)?.quantity ?? 0;
    const key = `${item.fee.id}-${bowlerIndex ?? 'registration'}`;

    if (!item.settings.allowQuantity) {
      return (
        <CheckboxField
          key={key}
          label={who ? `Add for ${who}` : `Add ${name}`}
          checked={quantity > 0}
          onChange={(event) => setSideEventQuantity(item.fee.id, bowlerIndex, event.target.checked ? 1 : 0)}
        />
      );
    }
    return (
      <div key={key} className={styles.stepperRow} role="group" aria-label={`${name}${forWho}`}>
        {who ? <span className={styles.stepperLabel}>{who}</span> : null}
        <span className={styles.stepper}>
          <Button
            size="sm"
            variant="secondary"
            iconOnly
            icon={<Minus size={ICON_SIZE.md} />}
            aria-label={`Fewer ${name}${forWho}`}
            disabled={quantity <= 0}
            onClick={() => setSideEventQuantity(item.fee.id, bowlerIndex, quantity - 1)}
          />
          <output className={styles.stepperValue} aria-live="polite">{quantity}</output>
          <Button
            size="sm"
            variant="secondary"
            iconOnly
            icon={<Plus size={ICON_SIZE.md} />}
            aria-label={`More ${name}${forWho}`}
            disabled={quantity >= item.maxQuantity}
            onClick={() => setSideEventQuantity(item.fee.id, bowlerIndex, quantity + 1)}
          />
        </span>
      </div>
    );
  };

  const renderSideEvent = (item: OfferedSideEvent) => {
    const price = formatSideEventMoney(item.amountCents);
    const per = item.settings.per === 'bowler' ? 'per bowler' : 'per registration';
    const priceText = item.settings.allowQuantity
      ? `${price} each, up to ${item.maxQuantity} ${per}`
      : `${price} ${per}`;
    const payout = bracketPayoutLine(item.settings);
    const indexes: Array<number | null> = item.settings.per === 'bowler'
      ? Array.from({ length: bowlerCount }, (_, index) => index)
      : [null];
    return (
      <li key={item.fee.id} className={styles.sideEventRow}>
        <div className={styles.sideEventText}>
          <span className={styles.sideEventName}>{item.fee.name || 'Side event'}</span>
          <span className={styles.helper}>{priceText}</span>
          {payout ? <span className={styles.helper}>{payout}</span> : null}
        </div>
        <div className={styles.sideEventControls} role="group" aria-label={item.fee.name || 'Side event'}>
          {item.fee.required
            ? <span className={styles.helper}>Included with every entry</span>
            : indexes.map((bowlerIndex) => renderSideEventControl(item, bowlerIndex))}
        </div>
      </li>
    );
  };

  const lineLabel = (line: (typeof lines)[number]): string => {
    const name = line.quantity > 1 ? `${line.name} x${line.quantity}` : line.name;
    return line.bowlerIndex !== null && bowlerCount > 1 ? `${name}, ${bowlerName(line.bowlerIndex)}` : name;
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
                  if (key === 'gender') {
                    return (
                      <SelectField
                        key={`${field.id}-${bowlerIndex}`}
                        label={field.customLabel || field.label || 'Gender'}
                        optional={field.mode === 'optional'}
                        value={bowlerFields[key] || ''}
                        required={field.mode === 'required'}
                        onChange={(event) => setBowlerField(bowlerIndex, key, event.target.value)}
                      >
                        <option value="">Select an option</option>
                        {GENDER_OPTIONS.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </SelectField>
                    );
                  }
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

          {offered.length > 0 ? (
            <section className={styles.bowler} aria-labelledby={sideEventsHeadingId}>
              <CardDivider />
              <div className={styles.sideEventsHeader}>
                <h3 id={sideEventsHeadingId} className={styles.subsectionTitle}>Side events</h3>
                <p className={styles.helper}>Pick any extras. They are paid with your entry at check-in.</p>
              </div>
              <ul className={styles.sideEventList}>
                {offered.map((item) => renderSideEvent(item))}
              </ul>
              <p className={styles.body}>
                {'Side events total: '}
                <strong className={styles.amount}>{formatSideEventMoney(sideEventsTotal)}</strong>
              </p>
            </section>
          ) : null}

          <CardDivider />
          <TextAreaField
            label="Notes for the organizer"
            optional
            value={formState.notes}
            onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
            rows={3}
          />

          {showEligibility && eligibilityProblems.length > 0 ? (
            <div ref={eligibilityRef} tabIndex={-1} className={styles.eligibility} role="alert">
              {eligibility === 'warn' ? (
                <Notice tone="warning">
                  {"These bowlers don't meet the tournament rules. Check with the tournament director before registering them anyway."}
                </Notice>
              ) : (
                <p className={styles.body}>{"These bowlers can't enter as entered. Fix the following, or pick another event or division:"}</p>
              )}
              <ul className={styles.problemList}>
                {eligibilityProblems.map((problem) => (
                  <li key={problem} className={styles.error}>
                    <CircleAlert size={ICON_SIZE.sm} aria-hidden="true" />
                    {problem}
                  </li>
                ))}
              </ul>
              {eligibility === 'warn' ? (
                <CheckboxField
                  label="Register anyway"
                  helper="Staff only. The registration is saved even though the rules above aren't met."
                  checked={Boolean(formState.overrideEligibility)}
                  onChange={(event) => setFormState((prev) => ({ ...prev, overrideEligibility: event.target.checked }))}
                />
              ) : null}
            </div>
          ) : null}

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
                  <div key={field.id}><dt>{field.customLabel || field.label}</dt><dd>{formatFieldValue(normalizeRegistrationFieldKey(field.key), bowler[normalizeRegistrationFieldKey(field.key)])}</dd></div>
                ))}
                {questions.map((question) => (
                  <div key={question.id}><dt>{question.label}</dt><dd>{formatAnswer(formState.bowlerQuestionAnswers[index]?.[question.id])}</dd></div>
                ))}
              </dl>
            </div>
          ))}
          {lines.length > 0 ? (
            <div className={styles.reviewGroup}>
              <CardDivider />
              <h3 className={styles.subsectionTitle}>Cost</h3>
              <dl className={styles.costList}>
                <div><dt>Entry fee</dt><dd>{formatSideEventMoney(entryFeeCents)}</dd></div>
                {lines.map((line) => (
                  <div key={`${line.feeId}-${line.bowlerIndex ?? 'registration'}`}>
                    <dt>{lineLabel(line)}</dt>
                    <dd>{formatSideEventMoney(line.totalCents)}</dd>
                  </div>
                ))}
                <div className={styles.costTotal}><dt>Total due at check-in</dt><dd>{formatSideEventMoney(entryFeeCents + sideEventsTotal)}</dd></div>
              </dl>
            </div>
          ) : null}
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
