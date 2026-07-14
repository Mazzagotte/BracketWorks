import { useCallback, useEffect, useMemo, useState } from 'react';

import { Tournament, TournamentForm } from '../../lib/types';
import { getErrorMessage } from '../../lib/error-utils';
import { FormField, Input } from '../../components/UI';
import CloseControl from '../../../components/CloseControl';
import { formatIsoDateFull } from '../../lib/formatters';
import mobileStyles from '../dashboard.module.css';
import { getDatesBetween, normalizeTournamentForm } from '../utils/tournamentForm';

const get12hrTimes = () => {
  const makeGroup = (period: 'AM' | 'PM') => {
    const slots: string[] = [];
    for (const hour of [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        slots.push(`${hour}:${minutes.toString().padStart(2, '0')} ${period}`);
      }
    }
    return slots;
  };

  return { am: makeGroup('AM'), pm: makeGroup('PM') };
};

const availableTimeOptions = get12hrTimes();

type EditTournamentModalProps = {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onSave: (tournamentData: TournamentForm) => Promise<void> | void;
  isCreateMode: boolean;
};

export function EditTournamentModal({
  open,
  onClose,
  tournament,
  onSave,
  isCreateMode,
}: EditTournamentModalProps) {
  const [tournamentForm, setTournamentForm] = useState<TournamentForm>({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    squad_times: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingTimes, setPendingTimes] = useState<Record<string, string>>({});
  const [savedSnapshot, setSavedSnapshot] = useState<TournamentForm>(normalizeTournamentForm({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    squad_times: {},
  }));

  const buildInitialForm = useCallback((): TournamentForm => {
    if (tournament) {
      return normalizeTournamentForm({
        name: tournament.name || '',
        location: tournament.location || '',
        start_date: tournament.start_date || '',
        end_date: tournament.end_date || '',
        squad_times: tournament.squad_times || {},
      });
    }

    return normalizeTournamentForm({
      name: '',
      location: '',
      start_date: '',
      end_date: '',
      squad_times: {},
    });
  }, [tournament]);

  useEffect(() => {
    if (!open) return;
    const initial = buildInitialForm();
    setTournamentForm(initial);
    setSavedSnapshot(initial);
    setPendingTimes({});
    setValidationError(null);
  }, [open, buildInitialForm]);

  const tournamentDays = useMemo(
    () => getDatesBetween(tournamentForm.start_date || '', tournamentForm.end_date || ''),
    [tournamentForm.start_date, tournamentForm.end_date],
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(normalizeTournamentForm(tournamentForm)) !== JSON.stringify(savedSnapshot),
    [savedSnapshot, tournamentForm],
  );

  const totalSquadTimesAdded = useMemo(
    () => Object.values(tournamentForm.squad_times || {}).reduce((sum, times) => sum + (times?.length || 0), 0),
    [tournamentForm.squad_times],
  );

  const canSave = hasUnsavedChanges && !isSaving && Boolean(tournamentForm.name?.trim());

  if (!open) return null;

  const handleCancel = () => {
    setTournamentForm(savedSnapshot);
    setValidationError(null);
    onClose();
  };

  return (
    <div className={`${mobileStyles.modalOverlay} ${mobileStyles.settingsModalOverlay}`}>
      <form
        className={`${mobileStyles.modalCard} ${mobileStyles.tournamentModalContent} ${isCreateMode ? mobileStyles.createTournamentModalContent : ''}`}
        onSubmit={async submitEvent => {
          submitEvent.preventDefault();
          if (!hasUnsavedChanges) return;
          setIsSaving(true);
          setValidationError(null);
          try {
            await onSave(tournamentForm);
            const normalized = normalizeTournamentForm(tournamentForm);
            setSavedSnapshot(normalized);
          } catch (err: unknown) {
            setValidationError(getErrorMessage(err) || 'Failed to save.');
          } finally {
            setIsSaving(false);
          }
        }}
      >
        {validationError && (
          <div className="error-message">{validationError}</div>
        )}
        <CloseControl
          position="absolute"
          onClick={onClose}
          className={`${mobileStyles.closeBtn} ${mobileStyles.settingsModalCloseButton}`}
          label="Close create tournament modal"
          title="Close"
          size="sm"
        />
        <div className={mobileStyles.modalHeader}>
          <h2 className={mobileStyles.modalTitle}>{isCreateMode ? 'Create New Tournament' : 'Edit Tournament'}</h2>
          <p className={mobileStyles.modalSubtitle}>
            {isCreateMode
              ? 'Set up tournament details, dates, and squad times.'
              : 'Update tournament details, dates, and squad times.'}
          </p>
        </div>
        <div className={mobileStyles.tournamentContentWrapper}>
          <div className={mobileStyles.tournamentFormBody}>
            <p className={mobileStyles.tournamentSectionLabel}>Tournament Details</p>
            <div className={mobileStyles.tournamentFormFields}>
              <FormField label="Tournament Name" required>
                <Input
                  value={tournamentForm.name}
                  onChange={changeEvent => setTournamentForm(form => ({ ...form, name: changeEvent.target.value }))}
                  placeholder="Tournament name"
                  className={mobileStyles.tournamentInput}
                  required
                />
              </FormField>
              <FormField label="Location">
                <Input
                  value={tournamentForm.location || ''}
                  onChange={changeEvent => setTournamentForm(form => ({ ...form, location: changeEvent.target.value }))}
                  placeholder="Bowling center or event location"
                  className={mobileStyles.tournamentInput}
                />
              </FormField>
              <p className={mobileStyles.tournamentSectionLabel}>Tournament Dates</p>
              <div className={mobileStyles.tournamentDateRow}>
                <FormField label="Start Date">
                  <Input
                    type="date"
                    value={tournamentForm.start_date || ''}
                    onChange={changeEvent => setTournamentForm(form => ({ ...form, start_date: changeEvent.target.value }))}
                    className={`${mobileStyles.tournamentInput} ${mobileStyles.tournamentDateInput}`}
                  />
                </FormField>
                <FormField label="End Date">
                  <Input
                    type="date"
                    value={tournamentForm.end_date || ''}
                    onChange={changeEvent => setTournamentForm(form => ({ ...form, end_date: changeEvent.target.value }))}
                    className={`${mobileStyles.tournamentInput} ${mobileStyles.tournamentDateInput}`}
                  />
                </FormField>
              </div>
            </div>
            <div className={mobileStyles.squadTimesSection}>
              <div className={mobileStyles.squadTimesHeadingRow}>
                <h3 className={mobileStyles.squadTimesTitle}>Squad Times</h3>
                <span className={mobileStyles.squadTimesCount}>{totalSquadTimesAdded} added</span>
              </div>
              {tournamentDays.length === 0 && <p className={mobileStyles.noSquadDaysHint}>Select a start and end date to add squad times for each tournament day.</p>}
              {tournamentDays.map(date => (
                <div key={date} className={mobileStyles.squadDay}>
                  <div className={mobileStyles.squadDayLabel}>{formatIsoDateFull(date)}</div>
                  <div className={mobileStyles.squadTimesList}>
                    {(tournamentForm.squad_times[date] || []).map((time, i) => (
                      <div key={i} className={mobileStyles.squadTimeEntry}>
                        <span className={mobileStyles.squadTimeText}>{time}</span>
                        <button
                          type="button"
                          className={mobileStyles.squadTimeRemove}
                          onClick={() => setTournamentForm(form => ({ ...form, squad_times: { ...form.squad_times, [date]: (form.squad_times[date] ?? []).filter((_, j) => j !== i) } }))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className={mobileStyles.squadTimeAddRow}>
                      <select
                        className={`entries-select ${mobileStyles.squadTimeSelect} ${mobileStyles.tournamentInput}`}
                        value={pendingTimes[date] || ''}
                        onChange={event => setPendingTimes(times => ({ ...times, [date]: event.target.value }))}
                      >
                        <option value="" disabled>Select time</option>
                        <optgroup label="AM">
                          {availableTimeOptions.am.map(timeOption => (
                            <option key={timeOption} value={timeOption}>{timeOption}</option>
                          ))}
                        </optgroup>
                        <optgroup label="PM">
                          {availableTimeOptions.pm.map(timeOption => (
                            <option key={timeOption} value={timeOption}>{timeOption}</option>
                          ))}
                        </optgroup>
                      </select>
                      <button
                        type="button"
                        className={mobileStyles.squadTimeAddBtn}
                        onClick={() => {
                          const pending = pendingTimes[date];
                          if (pending) {
                            setTournamentForm(form => ({ ...form, squad_times: { ...form.squad_times, [date]: [...(form.squad_times[date] || []), pending] } }));
                            setPendingTimes(times => ({ ...times, [date]: '' }));
                          }
                        }}
                      >
                        + Add Squad Time
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={mobileStyles.tournamentModalFooter}>
            <div className={`${mobileStyles.tournamentSaveStatus} ${hasUnsavedChanges ? mobileStyles.tournamentSaveStatusDirty : mobileStyles.tournamentSaveStatusSaved}`}>
              {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
            </div>
            <div className={mobileStyles.tournamentModalFooterActions}>
              <button
                type="button"
                className={mobileStyles.tournamentCancelButton}
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={mobileStyles.tournamentSaveButton}
                disabled={!canSave}
              >
                {isSaving ? 'Saving...' : (isCreateMode ? 'Create Tournament' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
