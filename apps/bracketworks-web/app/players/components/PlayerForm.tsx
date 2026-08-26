import React, { memo, useState, useEffect, useRef } from 'react';
import { capitalizeFirstLetter } from '@bracketworks/ui';

import { PlayerFormProps } from '../types';
import styles from '../entries.module.css';
import buttonStyles from '../../styles/buttons.module.css';
import cardStyles from '../../styles/cards.module.css';
import formStyles from '../../styles/forms.module.css';
import { calculatePlayerTotalCost, calculateSidePotCost, divisionOptions, filterEntriesForDivision, isProgramAllowedForDivision, normalizeDivision, normalizePlayerBracketEntries } from '../../lib/bracketPrograms';
import { COMPACT_CONTENT_VIEWPORT_QUERY } from '../../lib/responsive';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CalendarDays, ChevronDown, ChevronUp, CircleDollarSign, Info, Target, Ticket, Trophy, UserRound, UserPlus } from 'lucide-react';

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

const PlayerForm = memo(({ onAddPlayer, isLoading, squads, selectedSquad, tournamentName, existingPlayers = [], entryFee, bracketPrograms, sidePots, prefillDraft, prefillVersion }: PlayerFormProps) => {
  const [formData, setFormData] = useState<PlayerFormState>({ ...EMPTY_FORM });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isMobileLayout = useMediaQuery(COMPACT_CONTENT_VIEWPORT_QUERY);
  const [isCollapsed, setIsCollapsed] = useState(false);
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
  const selectedSquadLabel = selectedSquad
    ? [selectedSquad.date, selectedSquad.time ? `${selectedSquad.time} Squad` : selectedSquad.name].filter(Boolean).join(' · ')
    : 'No active squad'

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
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      totalCost
    });

    if (wasAdded === false) return
    setFormData({ ...EMPTY_FORM });
    setSuccessMessage(`${bowlerName} added.`)
    if (isMobileLayout) setIsCollapsed(true)
    window.setTimeout(() => {
      if (!isMobileLayout) {
        firstNameInputRef.current?.focus()
      }
    }, 0)
  };

  const handleInputChange = (field: string, value: string | number) => {
    setSuccessMessage(null)
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
    setSubmitError(null)
    setSuccessMessage(null)
    setIsCollapsed(false)
    window.setTimeout(() => firstNameInputRef.current?.focus(), 0)
  }

  return (
    <div className={`${cardStyles.card} ${styles.formCard} ${styles.addBowlerCard}`}>
      <div className={styles.addBowlerHeader}>
        <h3 className={`${cardStyles.cardHeader} ${styles.formTitle} ${styles.addBowlerTitle}`}>
          <UserPlus aria-hidden="true" />
          Add Bowler
        </h3>
        <p className={styles.addBowlerSubtitle}>Register a bowler for the active squad.</p>
        {isMobileLayout && (
          <button
            type="button"
            className={styles.addBowlerCollapseButton}
            onClick={() => setIsCollapsed(current => !current)}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? 'Add another bowler' : 'Collapse'}
            {isCollapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          </button>
        )}
      </div>

      <div className={styles.addBowlerContextStrip}>
        <div className={styles.addBowlerContextItem}>
          <CalendarDays aria-hidden="true" />
          <span><small>Active Squad</small><strong>{selectedSquadLabel}</strong></span>
        </div>
        <div className={styles.addBowlerContextItem}>
          <Trophy aria-hidden="true" />
          <span><small>Tournament</small><strong>{tournamentName || 'Tournament pending'}</strong></span>
        </div>
      </div>

      {submitError && <div className="error-message">{submitError}</div>}
      {successMessage && <div className={styles.addBowlerSuccess} role="status">{successMessage}</div>}

      <form onSubmit={handleSubmit} hidden={isCollapsed}>
        <section className={styles.addBowlerFormSection}>
          <h4 className={styles.addBowlerSectionTitle}><UserRound aria-hidden="true" />Bowler Information</h4>
          <div className={`${styles.formGrid} ${styles.playerInfoGrid}`}>
          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>
              First Name <span className={styles.requiredIndicator}>Required</span>
            </label>
            <input
              ref={firstNameInputRef}
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`${formStyles.field} ${styles.fieldInput}`}
              placeholder="First Name *"
              aria-label="First Name"
              required
            />
            {isDirty && !formData.firstName.trim() && <p className={styles.fieldValidation}>First name is required.</p>}
          </div>

          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>
              Last Name <span className={styles.requiredIndicator}>Required</span>
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`${formStyles.field} ${styles.fieldInput}`}
              placeholder="Last Name *"
              aria-label="Last Name"
              required
            />
            {isDirty && !formData.lastName.trim() && <p className={styles.fieldValidation}>Last name is required.</p>}
          </div>

          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>USBC Number</label>
            <input
              type="text"
              value={formData.usbc}
              onChange={(e) => handleInputChange('usbc', e.target.value)}
              className={`${formStyles.field} ${styles.fieldInput}`}
              maxLength={8}
              placeholder="USBC Number"
              aria-label="USBC Number"
            />
            {hasDuplicateUsbc && <p className={styles.fieldValidation}>Already entered in this squad.</p>}
          </div>
          </div>
        </section>

        <section className={styles.addBowlerFormSection}>
          <h4 className={styles.addBowlerSectionTitle}><Target aria-hidden="true" />Tournament Assignment</h4>
          <div className={`${styles.formGrid} ${styles.placementGrid}`}>
          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>Average</label>
            <input
              ref={averageInputRef}
              type="number"
              value={formData.average}
              onChange={(e) => handleInputChange('average', parseInt(e.target.value) || 0)}
              className={`${formStyles.field} ${styles.fieldInput}`}
              min="0"
              max="300"
              placeholder="Average"
              aria-label="Average"
            />
          </div>

          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>Division</label>
            <select
              value={formData.division}
              onChange={(e) => handleInputChange('division', e.target.value)}
              className={`${formStyles.select} ${styles.fieldInput}`}
              aria-label="Division"
            >
              {divisionOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>Lane</label>
            <input
              type="text"
              value={formData.lane}
              onChange={(e) => handleInputChange('lane', e.target.value)}
              className={`${formStyles.field} ${styles.fieldInput}`}
              placeholder="Lane (e.g. A1)"
              aria-label="Lane"
            />
          </div>

          </div>
        </section>

        <div className={`${cardStyles.panel} ${styles.compactSection}`}>
          <div className={styles.compactSectionHeader}>
            <div>
              <h4 className={styles.compactSectionTitle}><Ticket aria-hidden="true" />Entries &amp; Payment</h4>
            </div>
          </div>

          <div className={styles.entriesPaymentRow}>
            <div className={styles.entriesCol}>
              <p className={styles.entriesSubheading}>Bracket Entries</p>
              <div className={styles.compactGrid}>

              {bracketPrograms.map(program => {
                const programFee = Number(program.entry_fee ?? entryFee)
                const programQuantity = formData.bracketEntries[program.key] || 0
                return (
                <div key={program.key} className={`${styles.compactField} ${styles.entryProgramCard}`}>
                  <div className={styles.entryProgramHeader}>
                    <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>{program.name} Entries</label>
                    <span>${programFee.toFixed(2)} each</span>
                  </div>
                  <div className={styles.stepperControl}>
                    <button
                      type="button"
                      className={`${styles.stepperBtn} ${styles.stepperBtnMinus}`}
                      onClick={() => handleBracketStep(program.key, -1)}
                      disabled={!isProgramAllowedForDivision(program.division, formData.division) || (formData.bracketEntries[program.key] || 0) <= 0}
                      aria-label={`Decrease ${program.name} entries`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={programQuantity}
                      onChange={(e) => handleBracketEntryChange(program.key, e.target.value)}
                      className={`${formStyles.field} ${styles.fieldInput} ${styles.compactInput}`}
                      min="0"
                      disabled={!isProgramAllowedForDivision(program.division, formData.division)}
                    />
                    <button
                      type="button"
                      className={`${styles.stepperBtn} ${styles.stepperBtnPlus}`}
                      onClick={() => handleBracketStep(program.key, 1)}
                      disabled={!isProgramAllowedForDivision(program.division, formData.division)}
                      aria-label={`Increase ${program.name} entries`}
                    >
                      +
                    </button>
                  </div>
                  <div className={styles.entryProgramSubtotal}>
                    <span>Subtotal</span>
                    <strong>${(programQuantity * programFee).toFixed(2)}</strong>
                  </div>
                </div>
              )})}

              </div>
              <p className={styles.entryFeeNote}><Info aria-hidden="true" />Entry fees are calculated automatically based on quantity.</p>

              {enabledSidePots.length > 0 && (
                <>
                  <p className={styles.entriesSubheading}>Side Pot Entries</p>
                  <div className={styles.addBowlerSidePotGrid}>
                    {enabledSidePots.map(pot => {
                      const checked = Boolean(formData.sidePotEntries[pot.key])
                      return (
                        <label key={pot.key} className={styles.addBowlerSidePotOption}>
                          <input
                            type="checkbox"
                            className={styles.addBowlerSidePotCheckbox}
                            checked={checked}
                            onChange={() => handleSidePotToggle(pot.key)}
                          />
                          <span>{pot.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className={styles.paymentCol}>
              <p className={`${styles.entriesSubheading} ${styles.paymentSummaryTitle}`}><CircleDollarSign aria-hidden="true" />Payment Summary</p>
              <div className={`${cardStyles.panel} ${styles.paymentSummaryPanel}`}>
                <label className={styles.paidInFullControl}>
                  <input
                    type="checkbox"
                    checked={paidInFull}
                    disabled={draftTotal <= 0}
                    onChange={(event) => handleInputChange('amountPaid', event.target.checked ? draftTotal : 0)}
                  />
                  <span>
                    <strong>Paid in Full</strong>
                    <small>Set Amount Paid equal to Entry Total.</small>
                  </span>
                </label>
                <div className={styles.paymentSummaryRows}>
                  <div className={styles.paymentSummaryRow}>
                    <span>Entry Total</span>
                    <span>${draftTotal.toFixed(2)}</span>
                  </div>
                  <div className={`${styles.paymentSummaryRow} ${paidInFull ? styles.paymentSummaryRowPaid : ''}`}>
                    <span>Amount Paid</span>
                    <span>${formData.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className={`${styles.paymentSummaryRow} ${balanceDue > 0.009 ? styles.paymentSummaryRowDue : ''}`}>
                    <span>Balance Due</span>
                    <span>${balanceDue.toFixed(2)}</span>
                  </div>
                </div>

                <div className={styles.compactField}>
                <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>Amount Paid</label>
                <div className={styles.currencyInputWrap}>
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    value={formData.amountPaid}
                    onChange={(e) => handleInputChange('amountPaid', parseFloat(e.target.value) || 0)}
                    className={`${formStyles.field} ${styles.fieldInput} ${styles.compactInput}`}
                    min="0"
                    max={draftTotal}
                    step="0.01"
                  />
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.formFooter}>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.cancelBtn}`}
            onClick={handleCancel}
          >
            Cancel
          </button>
          <div className={`${styles.formStatusHint} ${hasRequiredNames ? styles.formStatusHintReady : styles.formStatusHintRequired}`}>
            {isDirty && !hasRequiredNames ? 'First and last name are required.' : ''}
          </div>
          <button
            type="submit"
            disabled={isLoading || !hasRequiredNames}
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary} ${styles.submitBtn}`}
          >
            <UserPlus aria-hidden="true" />
            {isLoading ? 'Adding...' : 'Add Bowler'}
          </button>
        </div>
      </form>
    </div>
  );
});

PlayerForm.displayName = 'PlayerForm';

export default PlayerForm;
