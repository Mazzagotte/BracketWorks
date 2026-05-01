import React, { memo, useState, useEffect } from 'react';

import { PlayerFormProps } from '../types';
import styles from '../entries.module.css';
import { calculatePlayerTotalCost, divisionOptions, filterEntriesForDivision, isProgramAllowedForDivision, normalizeDivision, normalizePlayerBracketEntries } from '../../lib/bracketPrograms';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  usbc: '',
  average: 150,
  handicap: 0,
  scratch: 0,
  bracketEntries: { handicap: 0, scratch: 0 },
  division: 'Mens',
  lane: 'A1',
  amountPaid: 0
};

const PlayerForm = memo(({ onAddPlayer, isLoading, squads, entryFee, bracketPrograms }: PlayerFormProps) => {
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

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
      alert('Please enter both first and last name');
      return;
    }

    const totalCost = calculatePlayerTotalCost(
      normalizePlayerBracketEntries(formData.bracketEntries, formData.handicap, formData.scratch),
      bracketPrograms,
      entryFee,
    );

    onAddPlayer({
      ...formData,
      bracketEntries: normalizePlayerBracketEntries(formData.bracketEntries, formData.handicap, formData.scratch),
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

  return (
    <div className={styles.formCard}>
      <h3 className={styles.formTitle}>Add New Player</h3>

      {isDirty && (
        <div className={styles.unsavedBanner}>
          Unsaved changes — submit the form or your data will be lost if you navigate away.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <div>
            <label className={styles.fieldLabel}>First Name *</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={styles.fieldInput}
              required
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>Last Name *</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={styles.fieldInput}
              required
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>USBC Number</label>
            <input
              type="text"
              value={formData.usbc}
              onChange={(e) => handleInputChange('usbc', e.target.value)}
              className={styles.fieldInput}
              maxLength={8}
              placeholder="8 digits"
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>Average</label>
            <input
              type="number"
              value={formData.average}
              onChange={(e) => handleInputChange('average', parseInt(e.target.value) || 0)}
              className={styles.fieldInput}
              min="0"
              max="300"
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>Lane</label>
            <input
              type="text"
              value={formData.lane}
              onChange={(e) => handleInputChange('lane', e.target.value)}
              className={styles.fieldInput}
              placeholder="A1"
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>Division</label>
            <select
              value={formData.division}
              onChange={(e) => handleInputChange('division', e.target.value)}
              className={styles.fieldInput}
            >
              {divisionOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

        </div>

        <div className={styles.compactSection}>
          <div className={styles.compactSectionHeader}>
            <div>
              <h4 className={styles.compactSectionTitle}>Entries & Payment</h4>
            </div>
          </div>

          <div className={styles.compactGrid}>

          {bracketPrograms.map(program => (
            <div key={program.key} className={styles.compactField}>
              <label className={styles.fieldLabel}>{program.name}</label>
              <input
                type="number"
                value={formData.bracketEntries[program.key] || 0}
                onChange={(e) => handleBracketEntryChange(program.key, e.target.value)}
                className={`${styles.fieldInput} ${styles.compactInput}`}
                min="0"
                disabled={!isProgramAllowedForDivision(program.division, formData.division)}
              />
            </div>
          ))}

          <div className={styles.compactField}>
            <label className={styles.fieldLabel}>Amount Paid</label>
            <input
              type="number"
              value={formData.amountPaid}
              onChange={(e) => handleInputChange('amountPaid', parseFloat(e.target.value) || 0)}
              className={`${styles.fieldInput} ${styles.compactInput}`}
              min="0"
              step="0.01"
            />
          </div>
        </div>
        </div>

        <div className={styles.formFooter}>
          <button
            type="submit"
            disabled={isLoading}
            className={styles.submitBtn}
          >
            {isLoading ? 'Adding...' : 'Add Player'}
          </button>
        </div>
      </form>
    </div>
  );
});

PlayerForm.displayName = 'PlayerForm';

export default PlayerForm;
