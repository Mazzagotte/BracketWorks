import React, { memo, useState, useEffect, useRef } from 'react';

import { PlayerFormProps } from '../types';
import styles from '../entries.module.css';
import buttonStyles from '../../styles/buttons.module.css';
import cardStyles from '../../styles/cards.module.css';
import formStyles from '../../styles/forms.module.css';
import { calculatePlayerTotalCost, calculateSidePotCost, divisionOptions, filterEntriesForDivision, isProgramAllowedForDivision, normalizeDivision, normalizePlayerBracketEntries } from '../../lib/bracketPrograms';

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

const PlayerForm = memo(({ onAddPlayer, isLoading, squads, entryFee, bracketPrograms, sidePots, prefillDraft, prefillVersion }: PlayerFormProps) => {
  const [formData, setFormData] = useState<PlayerFormState>({ ...EMPTY_FORM });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const averageInputRef = useRef<HTMLInputElement | null>(null)
  const enabledSidePots = (sidePots?.pots ?? []).filter(pot => pot.enabled)

  useEffect(() => {
    if (!prefillDraft) return

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

  const isDirty = formData.firstName.trim() !== '' || formData.lastName.trim() !== '';

  // Warn if browser is closed/refreshed with unsaved data
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setSubmitError('Please enter both first and last name.');
      return;
    }

    if (formData.average < 0 || formData.average > 300) {
      setSubmitError('Average must be between 0 and 300.');
      return;
    }

    setSubmitError(null);

    const totalCost = calculatePlayerTotalCost(
      normalizePlayerBracketEntries(formData.bracketEntries, formData.handicap, formData.scratch),
      bracketPrograms,
      entryFee,
    );
    const amountPaidOnSubmit = draftTotal;

    const nextSidePotEntries = Object.fromEntries(
      enabledSidePots.map(pot => [pot.key, Boolean(formData.sidePotEntries[pot.key])]),
    );

    onAddPlayer({
      ...formData,
      bracketEntries: normalizePlayerBracketEntries(formData.bracketEntries, formData.handicap, formData.scratch),
      sidePotEntries: nextSidePotEntries,
      amountPaid: amountPaidOnSubmit,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      totalCost
    });

    setFormData({ ...EMPTY_FORM });
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => {
      if (field !== 'division') {
        return { ...prev, [field]: value }
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

  return (
    <div className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.formCard} ${styles.addBowlerCard}`}>
      <h3 className={`${cardStyles.cardHeader} ${styles.formTitle}`}>Add Bowler</h3>

      {isDirty && (
        <div className={styles.unsavedBanner}>
          Unsaved changes: submit the form or your data will be lost if you navigate away.
        </div>
      )}

      {submitError && <div className="error-message">{submitError}</div>}

      <form onSubmit={handleSubmit}>
        <p className={styles.formSectionLabel}>PLAYER INFORMATION</p>
        <div className={`${styles.formGrid} ${styles.playerInfoGrid}`}>
          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>First Name *</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`${formStyles.field} ${styles.fieldInput}`}
              placeholder="First Name *"
              aria-label="First Name"
              required
            />
          </div>

          <div>
            <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>Last Name *</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`${formStyles.field} ${styles.fieldInput}`}
              placeholder="Last Name *"
              aria-label="Last Name"
              required
            />
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
          </div>

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

        <div className={`${cardStyles.panel} ${styles.compactSection}`}>
          <div className={styles.compactSectionHeader}>
            <div>
              <h4 className={styles.compactSectionTitle}>Entries &amp; Payment</h4>
            </div>
          </div>

          <div className={styles.entriesPaymentRow}>
            <div className={styles.entriesCol}>
              <p className={styles.entriesSubheading}>Bracket Entries</p>
              <div className={styles.compactGrid}>

              {bracketPrograms.map(program => (
                <div key={program.key} className={styles.compactField}>
                  <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>{program.name} Entries</label>
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
                      value={formData.bracketEntries[program.key] || 0}
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
                </div>
              ))}

              </div>

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
              <p className={styles.entriesSubheading}>Payment Summary</p>
              <div className={`${cardStyles.panel} ${styles.paymentSummaryPanel}`}>
                <div className={styles.paymentSummaryRows}>
                  <div className={styles.paymentSummaryRow}>
                    <span>Total</span>
                    <span>${draftTotal.toFixed(2)}</span>
                  </div>
                  <div className={`${styles.paymentSummaryRow} ${paidInFull ? styles.paymentSummaryRowPaid : ''}`}>
                    <span>Paid</span>
                    <span>${formData.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className={`${styles.paymentSummaryRow} ${balanceDue > 0.009 ? styles.paymentSummaryRowDue : ''}`}>
                    <span>Due</span>
                    <span>${balanceDue.toFixed(2)}</span>
                  </div>
                </div>

                <div className={styles.compactField}>
                <label className={`${formStyles.fieldLabel} ${styles.fieldLabel}`}>Amount Paid</label>
                <input
                  type="number"
                  value={formData.amountPaid}
                  onChange={(e) => handleInputChange('amountPaid', parseFloat(e.target.value) || 0)}
                  className={`${formStyles.field} ${styles.fieldInput} ${styles.compactInput}`}
                  min="0"
                  step="0.01"
                />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.formFooter}>
          <div className={`${styles.formStatusHint} ${hasRequiredNames ? styles.formStatusHintReady : styles.formStatusHintRequired}`}>
            {hasRequiredNames ? 'Ready to add bowler.' : ''}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary} ${styles.submitBtn}`}
          >
            {isLoading ? 'Adding...' : 'Add Bowler'}
          </button>
        </div>
      </form>
    </div>
  );
});

PlayerForm.displayName = 'PlayerForm';

export default PlayerForm;
