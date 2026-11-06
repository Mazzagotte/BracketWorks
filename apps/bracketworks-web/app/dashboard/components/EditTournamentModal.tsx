import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  CardDivider,
  FormGrid,
  ICON_SIZE,
  Modal,
  Notice,
  SelectField,
  TextField,
  capitalizeFirstLetter,
} from '@bracketworks/ui';

import { Tournament, TournamentForm } from '../../lib/types';
import { getErrorMessage } from '../../lib/error-utils';
import { formatIsoDateFull } from '../../lib/formatters';
import styles from './EditTournamentModal.module.css';
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

  const handleCancel = useCallback(() => {
    setTournamentForm(savedSnapshot);
    setValidationError(null);
    onClose();
  }, [onClose, savedSnapshot]);

  const formId = useId();

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!hasUnsavedChanges) return;
    setIsSaving(true);
    setValidationError(null);
    try {
      await onSave(tournamentForm);
      setSavedSnapshot(normalizeTournamentForm(tournamentForm));
    } catch (err: unknown) {
      setValidationError(getErrorMessage(err) || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      size="lg"
      dismissible={!isSaving}
      closeLabel={isCreateMode ? 'Close create tournament' : 'Close edit tournament'}
      title={isCreateMode ? 'Create tournament' : 'Edit tournament'}
      description={isCreateMode ? 'Set up the tournament details, dates, and squad times.' : 'Update the tournament details, dates, and squad times.'}
      footer={(
        <>
          <span className={styles.saveStatus} role="status">{hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}</span>
          <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" disabled={!canSave}>
            {isSaving ? 'Saving...' : (isCreateMode ? 'Create tournament' : 'Save changes')}
          </Button>
        </>
      )}
    >
      <form id={formId} className={styles.form} onSubmit={event => { void handleSubmit(event); }}>
        {validationError ? <Notice tone="danger" role="alert">{validationError}</Notice> : null}

        <section className={styles.group} aria-labelledby={`${formId}-details`}>
          <h3 id={`${formId}-details`} className={styles.groupTitle}>Tournament details</h3>
          <FormGrid>
            <TextField
              label="Tournament name"
              fullRow
              value={tournamentForm.name}
              onChange={changeEvent => setTournamentForm(form => ({ ...form, name: capitalizeFirstLetter(changeEvent.target.value) }))}
              required
              autoFocus
            />
            <TextField
              label="Location"
              optional
              fullRow
              value={tournamentForm.location || ''}
              onChange={changeEvent => setTournamentForm(form => ({ ...form, location: capitalizeFirstLetter(changeEvent.target.value) }))}
              helper="Bowling center or event location"
            />
            <TextField
              label="Start date"
              type="date"
              value={tournamentForm.start_date || ''}
              onChange={changeEvent => setTournamentForm(form => ({ ...form, start_date: changeEvent.target.value }))}
            />
            <TextField
              label="End date"
              type="date"
              value={tournamentForm.end_date || ''}
              min={tournamentForm.start_date || undefined}
              onChange={changeEvent => setTournamentForm(form => ({ ...form, end_date: changeEvent.target.value }))}
            />
          </FormGrid>
        </section>

        <CardDivider />

        <section className={styles.group} aria-labelledby={`${formId}-squads`}>
          <div className={styles.groupHeader}>
            <h3 id={`${formId}-squads`} className={styles.groupTitle}>Squad times</h3>
            <span className={styles.meta}>{totalSquadTimesAdded} added</span>
          </div>
          {tournamentDays.length === 0 ? (
            <p className={styles.meta}>Choose a start and end date to add squad times for each day.</p>
          ) : null}
          {tournamentDays.map(date => {
            const times = tournamentForm.squad_times[date] || [];
            const dayLabel = formatIsoDateFull(date);
            return (
              <div key={date} className={styles.day}>
                <h4 className={styles.dayTitle}>{dayLabel}</h4>
                {times.length > 0 ? (
                  <ul className={styles.times}>
                    {times.map((time, i) => (
                      <li key={`${time}-${i}`} className={styles.timeRow}>
                        <span>{time}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />}
                          aria-label={`Remove ${time} squad on ${dayLabel}`}
                          onClick={() => setTournamentForm(form => ({ ...form, squad_times: { ...form.squad_times, [date]: (form.squad_times[date] ?? []).filter((_, j) => j !== i) } }))}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className={styles.addRow}>
                  <SelectField
                    label={`Add a squad time on ${dayLabel}`}
                    hideLabel
                    value={pendingTimes[date] || ''}
                    onChange={event => setPendingTimes(current => ({ ...current, [date]: event.target.value }))}
                  >
                    <option value="" disabled>Select time</option>
                    <optgroup label="AM">
                      {availableTimeOptions.am.map(timeOption => <option key={timeOption} value={timeOption}>{timeOption}</option>)}
                    </optgroup>
                    <optgroup label="PM">
                      {availableTimeOptions.pm.map(timeOption => <option key={timeOption} value={timeOption}>{timeOption}</option>)}
                    </optgroup>
                  </SelectField>
                  <Button
                    variant="secondary"
                    icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />}
                    disabled={!pendingTimes[date]}
                    onClick={() => {
                      const pending = pendingTimes[date];
                      if (!pending) return;
                      setTournamentForm(form => ({ ...form, squad_times: { ...form.squad_times, [date]: [...(form.squad_times[date] || []), pending] } }));
                      setPendingTimes(current => ({ ...current, [date]: '' }));
                    }}
                  >
                    Add time
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      </form>
    </Modal>
  );
}
