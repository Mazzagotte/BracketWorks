import React, { memo, useState, useEffect, useRef } from 'react';
import { Button, Card, CardDivider, CardHeader, CheckboxField, ICON_SIZE, Notice, SelectField, TextField, capitalizeFirstLetter } from '@bracketworks/ui';

import { PlayerFormProps } from '../types';
import styles from './PlayerForm.module.css';
import { calculatePlayerTotalCost, calculateSidePotCost, divisionOptions, filterEntriesForDivision, isProgramAllowedForDivision, normalizeDivision, normalizePlayerBracketEntries } from '../../lib/bracketPrograms';
import { COMPACT_CONTENT_VIEWPORT_QUERY } from '../../lib/responsive';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ChevronDown, ChevronUp, Minus, Plus, UserPlus } from 'lucide-react';

type PlayerFormState = {
  firstName: string;
  lastName: string;
  usbc: string;
  average: number;
  handicap: number;
  scratch: number;
  bracketEntries: Record<string, number>;
  sidePotEntries: Record<string, boolean>;
  division: string;
  lane: string;
  amountPaid: number;
};

const EMPTY_FORM: PlayerFormState = {
  firstName: '',
  lastName: '',
  usbc: '',
  average: 150,
  handicap: 0,
  scratch: 0,
  bracketEntries: { handicap: 0, scratch: 0 },
  sidePotEntries: {},
  division: 'Mens',
  lane: 'A1',
  amountPaid: 0
};

const PlayerForm = memo(({ onAddPlayer, bowlerHistorySearchPanel, onBowlerIdentityChange, isLoading, squads, selectedSquad, tournamentName, existingPlayers = [], entryFee, bracketPrograms, sidePots, prefillDraft, prefillVersion }: PlayerFormProps) => {
  const [formData, setFormData] = useState<PlayerFormState>({ ...EMPTY_FORM });
  const [profileAverageChanged, setProfileAverageChanged] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isMobileLayout = useMediaQuery(COMPACT_CONTENT_VIEWPORT_QUERY);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeNameField, setActiveNameField] = useState<'firstName' | 'lastName' | null>(null);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null)
  const averageInputRef = useRef<HTMLInputElement | null>(null)
  const enabledSidePots = (sidePots?.pots ?? []).filter(pot => pot.enabled)

  useEffect(() => {
    if (!prefillDraft) return
    setIsCollapsed(false)
    setSuccessMessage(null)

    setFormData(prev => {
      const nextDivision = prefillDraft.division ? normalizeDivision(prefillDraft.division) : prev.division
      const nextEntries = filterEntriesForDivision(prev.bracketEntries, bracketPrograms, nextDivision)
      return {
        ...prev,
        firstName: prefillDraft.firstName ?? prev.firstName,
        lastName: prefillDraft.lastName ?? prev.lastName,
        usbc: prefillDraft.usbc ?? prev.usbc,
        average: prefillDraft.average ?? prev.average,
        lane: prefillDraft.lane ?? prev.lane,
        division: nextDivision,
        bracketEntries: nextEntries,
        handicap: nextEntries.handicap ?? 0,
        scratch: nextEntries.scratch ?? 0,
      }
    })

    // Move keyboard focus so the next user input goes into Average immediately.
    window.setTimeout(() => {
      averageInputRef.current?.focus()
      averageInputRef.current?.select()
    }, 0)
  }, [prefillDraft, prefillVersion, bracketPrograms])

  const bracketDraftTotal = calculatePlayerTotalCost(
    normalizePlayerBracketEntries(formData.bracketEntries, formData.handicap, formData.scratch),
    bracketPrograms,
    entryFee,
  )
  const sidePotDraftTotal = calculateSidePotCost(formData.sidePotEntries, sidePots)
  const draftTotal = bracketDraftTotal + sidePotDraftTotal
  const balanceDue = Math.max(0, draftTotal - formData.amountPaid)
  const paidInFull = draftTotal > 0 && balanceDue <= 0.009
  const hasRequiredNames = formData.firstName.trim().length > 0 && formData.lastName.trim().length > 0
  const normalizedUsbc = formData.usbc.trim().toLocaleLowerCase()
  const hasDuplicateUsbc = normalizedUsbc.length > 0 && existingPlayers.some(
    player => (player.usbc || '').trim().toLocaleLowerCase() === normalizedUsbc,
  )

  const isDirty = formData.firstName.trim() !== '' || formData.lastName.trim() !== '';


  // Warn if browser is closed/refreshed with unsaved data
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setSubmitError('Please enter both first and last name.');
      return;
    }

    if (formData.average < 0 || formData.average > 300) {
      setSubmitError('Average must be between 0 and 300.');
      return;
    }

    if (hasDuplicateUsbc) {
      setSubmitError('This USBC number already exists in the active squad.');
      return;
    }

    setSubmitError(null);
    setSuccessMessage(null);

    const totalCost = calculatePlayerTotalCost(
      normalizePlayerBracketEntries(formData.bracketEntries, formData.handicap, formData.scratch),
      bracketPrograms,
      entryFee,
    );
    const amountPaidOnSubmit = Math.max(0, Math.min(formData.amountPaid, draftTotal));

    const nextSidePotEntries = Object.fromEntries(
      enabledSidePots.map(pot => [pot.key, Boolean(formData.sidePotEntries[pot.key])]),
    );

    const bowlerName = `${formData.firstName.trim()} ${formData.lastName.trim()}`
    const wasAdded = await onAddPlayer({
      ...formData,
      bracketEntries: normalizePlayerBracketEntries(formData.bracketEntries, formData.handicap, formData.scratch),
      sidePotEntries: nextSidePotEntries,
      amountPaid: amountPaidOnSubmit,
      updateProfileAverage: profileAverageChanged,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      totalCost
    });

    if (wasAdded === false) return
    setFormData({ ...EMPTY_FORM });
    setProfileAverageChanged(false)
    setActiveNameField(null)
    onBowlerIdentityChange?.({ firstName: '', lastName: '', usbc: '' })
    setSuccessMessage(`${bowlerName} added.`)
    if (isMobileLayout) setIsCollapsed(true)
    window.setTimeout(() => {
      if (!isMobileLayout) {
        firstNameInputRef.current?.focus()
      }
    }, 0)
  };

  const handleInputChange = (field: string, value: string | number) => {
    if (field === 'average') setProfileAverageChanged(true)
    setSuccessMessage(null)
    if (field === 'firstName' || field === 'lastName' || field === 'usbc') {
      const normalizedValue = typeof value === 'string' && (field === 'firstName' || field === 'lastName')
        ? capitalizeFirstLetter(value)
        : value
      onBowlerIdentityChange?.({
        firstName: field === 'firstName' ? String(normalizedValue) : formData.firstName,
        lastName: field === 'lastName' ? String(normalizedValue) : formData.lastName,
        usbc: field === 'usbc' ? String(normalizedValue) : formData.usbc,
      })
    }
    setFormData(prev => {
      const normalizedValue = typeof value === 'string' && (field === 'firstName' || field === 'lastName')
        ? capitalizeFirstLetter(value)
        : value
      if (field !== 'division') {
        return { ...prev, [field]: normalizedValue }
      }
      const nextDivision = normalizeDivision(String(value))
      const nextEntries = filterEntriesForDivision(prev.bracketEntries, bracketPrograms, nextDivision)
      return {
        ...prev,
        division: nextDivision,
        bracketEntries: nextEntries,
        handicap: nextEntries.handicap ?? 0,
        scratch: nextEntries.scratch ?? 0,
      }
    });
  };

  const handleBracketEntryChange = (programKey: string, value: string) => {
    const count = Math.max(0, parseInt(value, 10) || 0)
    setFormData(prev => ({
      ...prev,
      bracketEntries: {
        ...prev.bracketEntries,
        [programKey]: count,
      },
      handicap: programKey === 'handicap' ? count : prev.handicap,
      scratch: programKey === 'scratch' ? count : prev.scratch,
    }))
  }

  const handleBracketStep = (programKey: string, delta: number) => {
    const current = formData.bracketEntries[programKey] || 0
    const next = Math.max(0, current + delta)
    handleBracketEntryChange(programKey, String(next))
  }

  const handleSidePotToggle = (potKey: string) => {
    setFormData(prev => ({
      ...prev,
      sidePotEntries: {
        ...prev.sidePotEntries,
        [potKey]: !Boolean(prev.sidePotEntries[potKey]),
      },
    }))
  }

  const handleCancel = () => {
    setFormData({ ...EMPTY_FORM })
    setProfileAverageChanged(false)
    setActiveNameField(null)
    onBowlerIdentityChange?.({ firstName: '', lastName: '', usbc: '' })
    setSubmitError(null)
    setSuccessMessage(null)
    setIsCollapsed(false)
    window.setTimeout(() => firstNameInputRef.current?.focus(), 0)
  }

  const handleNameFieldBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setActiveNameField(null)
    }
  }

  return (
    <Card aria-label="Add bowler">
      <CardHeader
        title="Add bowler"
        description="Register a bowler for the active squad."
        actions={isMobileLayout ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsCollapsed(current => !current)}
            aria-expanded={!isCollapsed}
            icon={isCollapsed ? <ChevronDown size={ICON_SIZE.md} aria-hidden="true" /> : <ChevronUp size={ICON_SIZE.md} aria-hidden="true" />}
          >
            {isCollapsed ? 'Add another bowler' : 'Collapse'}
          </Button>
        ) : undefined}
      />

      {submitError ? <Notice tone="danger" role="alert">{submitError}</Notice> : null}
      {successMessage ? <Notice tone="success" role="status">{successMessage}</Notice> : null}

      <form className={styles.form} onSubmit={handleSubmit} hidden={isCollapsed}>
        <section className={styles.group} aria-labelledby="add-bowler-info">
          <h3 id="add-bowler-info" className={styles.groupTitle}>Bowler information</h3>
          <div className={styles.fieldsThree}>
            <div className={styles.autocomplete} onBlur={handleNameFieldBlur}>
              <TextField
                ref={firstNameInputRef}
                label="First name"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                autoComplete="off"
                required
                error={isDirty && !formData.firstName.trim() ? 'Enter a first name.' : undefined}
                onFocus={() => setActiveNameField('firstName')}
              />
              {activeNameField === 'firstName' && bowlerHistorySearchPanel}
            </div>
            <div className={styles.autocomplete} onBlur={handleNameFieldBlur}>
              <TextField
                label="Last name"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                autoComplete="off"
                required
                error={isDirty && !formData.lastName.trim() ? 'Enter a last name.' : undefined}
                onFocus={() => setActiveNameField('lastName')}
              />
              {activeNameField === 'lastName' && bowlerHistorySearchPanel}
            </div>
            <TextField
              label="USBC number"
              optional
              value={formData.usbc}
              onChange={(e) => handleInputChange('usbc', e.target.value)}
              maxLength={8}
              error={hasDuplicateUsbc ? 'Already entered in this squad.' : undefined}
            />
          </div>
        </section>

        <CardDivider />

        <section className={styles.group} aria-labelledby="add-bowler-assignment">
          <h3 id="add-bowler-assignment" className={styles.groupTitle}>Tournament assignment</h3>
          <div className={styles.fieldsThree}>
            <TextField
              ref={averageInputRef}
              label="Average"
              type="number"
              inputMode="numeric"
              value={formData.average}
              onChange={(e) => handleInputChange('average', parseInt(e.target.value) || 0)}
              min="0"
              max="300"
            />
            <SelectField
              label="Division"
              value={formData.division}
              onChange={(e) => handleInputChange('division', e.target.value)}
            >
              {divisionOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </SelectField>
            <TextField
              label="Lane"
              value={formData.lane}
              onChange={(e) => handleInputChange('lane', e.target.value)}
              helper="For example A1"
            />
          </div>
        </section>

        <CardDivider />

        <section className={styles.group} aria-labelledby="add-bowler-entries">
          <h3 id="add-bowler-entries" className={styles.groupTitle}>Entries and payment</h3>
          <div className={styles.entriesPayment}>
            <div className={styles.entriesColumn}>
              <ul className={styles.programList}>
                {bracketPrograms.map(program => {
                  const programFee = Number(program.entry_fee ?? entryFee)
                  const programQuantity = formData.bracketEntries[program.key] || 0
                  const allowed = isProgramAllowedForDivision(program.division, formData.division)
                  const inputId = `add-bowler-program-${program.key}`
                  return (
                    <li key={program.key} className={styles.programRow}>
                      <div className={styles.programCopy}>
                        <label htmlFor={inputId} className={styles.programName}>{program.name} entries</label>
                        <span className={styles.meta}>
                          {allowed ? `$${programFee.toFixed(2)} each` : `Not open to ${formData.division}`}
                        </span>
                      </div>
                      <div className={styles.stepper}>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Minus size={ICON_SIZE.md} aria-hidden="true" />}
                          onClick={() => handleBracketStep(program.key, -1)}
                          disabled={!allowed || programQuantity <= 0}
                          aria-label={`Decrease ${program.name} entries`}
                        />
                        <input
                          id={inputId}
                          type="number"
                          inputMode="numeric"
                          value={programQuantity}
                          onChange={(e) => handleBracketEntryChange(program.key, e.target.value)}
                          className={styles.stepperInput}
                          min="0"
                          disabled={!allowed}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />}
                          onClick={() => handleBracketStep(program.key, 1)}
                          disabled={!allowed}
                          aria-label={`Increase ${program.name} entries`}
                        />
                      </div>
                      <span className={styles.subtotal}>${(programQuantity * programFee).toFixed(2)}</span>
                    </li>
                  )
                })}
              </ul>
              <p className={styles.meta}>Entry fees are calculated from the quantity.</p>

              {enabledSidePots.length > 0 ? (
                <fieldset className={styles.sidePots}>
                  <legend className={styles.subTitle}>Side pots</legend>
                  {enabledSidePots.map(pot => (
                    <CheckboxField
                      key={pot.key}
                      label={pot.name}
                      checked={Boolean(formData.sidePotEntries[pot.key])}
                      onChange={() => handleSidePotToggle(pot.key)}
                    />
                  ))}
                </fieldset>
              ) : null}
            </div>

            <div className={styles.paymentColumn}>
              <h4 className={styles.subTitle}>Payment summary</h4>
              <dl className={styles.totals}>
                <div className={styles.totalRow}>
                  <dt>Entry total</dt>
                  <dd>${draftTotal.toFixed(2)}</dd>
                </div>
                <div className={styles.totalRow}>
                  <dt>Amount paid</dt>
                  <dd>${formData.amountPaid.toFixed(2)}</dd>
                </div>
                <div className={styles.totalRow}>
                  <dt>Balance due</dt>
                  <dd className={styles.totalEmphasis}>${balanceDue.toFixed(2)}</dd>
                </div>
              </dl>
              <CheckboxField
                label="Paid in full"
                helper="Sets the amount paid to the entry total."
                checked={paidInFull}
                disabled={draftTotal <= 0}
                onChange={(event) => handleInputChange('amountPaid', event.target.checked ? draftTotal : 0)}
              />
              <TextField
                label="Amount paid"
                type="number"
                inputMode="decimal"
                value={formData.amountPaid}
                onChange={(e) => handleInputChange('amountPaid', parseFloat(e.target.value) || 0)}
                min="0"
                max={draftTotal}
                step="0.01"
              />
            </div>
          </div>
        </section>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !hasRequiredNames}
            icon={<UserPlus size={ICON_SIZE.md} aria-hidden="true" />}
          >
            {isLoading ? 'Adding...' : 'Add bowler'}
          </Button>
        </div>
      </form>
    </Card>
  );
});

PlayerForm.displayName = 'PlayerForm';

export default PlayerForm;
