import React, { memo, useState, useEffect } from 'react';

import { PlayerFormProps } from '../types';
import styles from '../entries.module.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  usbc: '',
  average: 150,
  handicap: 0,
  scratch: 0,
  lane: 'A1',
  division: 'Open',
  amountPaid: 0
};

const PlayerForm = memo(({ onAddPlayer, isLoading, squads, entryFee }: PlayerFormProps) => {
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

    const totalCost = (formData.scratch + formData.handicap) * entryFee;

    onAddPlayer({
      ...formData,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      totalCost
    });

    setFormData({ ...EMPTY_FORM });
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
              className={styles.fieldSelect}
            >
              <option value="Open">Open</option>
              <option value="Womens">Womens</option>
              <option value="Senior">Senior</option>
              <option value="Junior">Junior</option>
            </select>
          </div>

          <div>
            <label className={styles.fieldLabel}>Handicap Brackets</label>
            <input
              type="number"
              value={formData.handicap}
              onChange={(e) => handleInputChange('handicap', parseInt(e.target.value) || 0)}
              className={styles.fieldInput}
              min="0"
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>Scratch Brackets</label>
            <input
              type="number"
              value={formData.scratch}
              onChange={(e) => handleInputChange('scratch', parseInt(e.target.value) || 0)}
              className={styles.fieldInput}
              min="0"
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>Amount Paid</label>
            <input
              type="number"
              value={formData.amountPaid}
              onChange={(e) => handleInputChange('amountPaid', parseFloat(e.target.value) || 0)}
              className={styles.fieldInput}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={styles.submitBtn}
        >
          {isLoading ? 'Adding...' : 'Add Player'}
        </button>
      </form>
    </div>
  );
});

PlayerForm.displayName = 'PlayerForm';

export default PlayerForm;
