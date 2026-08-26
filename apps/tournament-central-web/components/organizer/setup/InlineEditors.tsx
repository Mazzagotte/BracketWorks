'use client';

import { useState } from 'react';

import { normalizeEventConfig, normalizeSquadConfig } from '../setupSerialization';
import { buildSquadDisplayName, formatEntryFeeInput, normalizeEntryFeeInput, parseEntryFeeInputToCents } from '../setupFormatting';
import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, LocationConfig, RegistrationFieldConfig, SquadConfig } from '../types';
import styles from '../tournament-setup.module.css';

type InlineEventEditorProps = {
  event: EventConfig;
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (event: EventConfig) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export function InlineEventEditor({ event, divisions, squads, onSave, onCancel, onDelete }: InlineEventEditorProps) {
  const [draft, setDraft] = useState<EventConfig>(normalizeEventConfig(event));
  const [entryFeeInput, setEntryFeeInput] = useState(() => formatEntryFeeInput(event.entryFeeCents));
  const requiredBowlerCount = Math.max(draft.minPlayers, draft.maxPlayers, 1);
  const hasAvailableDivisions = divisions.length > 0;
  const hasAvailableSquads = squads.length > 0;
  const divisionSelectionValue = draft.connectedDivisionIds.length === 0 ? 'none' : draft.requireDivision ? 'required' : 'optional';
  const squadSelectionValue = draft.connectedSquadIds.length === 0 ? 'none' : draft.requireSquad ? 'required' : 'optional';
  const isDirty = JSON.stringify(draft) !== JSON.stringify(normalizeEventConfig(event)) || entryFeeInput !== formatEntryFeeInput(event.entryFeeCents);
  const squadsAreInvalid = draft.requireSquad && draft.connectedSquadIds.length === 0;
  const divisionsAreInvalid = draft.requireDivision && draft.connectedDivisionIds.length === 0;
  const isValid = Boolean(draft.name.trim()) && requiredBowlerCount >= 1 && !squadsAreInvalid && !divisionsAreInvalid;

  const setDivisionRequirement = (value: string) => {
    setDraft(value === 'none'
      ? { ...draft, requireDivision: false, connectedDivisionIds: [] }
      : { ...draft, requireDivision: value === 'required' });
  };
  const setSquadRequirement = (value: string) => {
    setDraft(value === 'none'
      ? { ...draft, requireSquad: false, connectedSquadIds: [] }
      : { ...draft, requireSquad: value === 'required' });
  };

  return (
    <form className={`${styles.detailForm} ${styles.divisionEditorForm}`} onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Event Information</h4>
          <p>Name the offering and explain what bowlers are entering.</p>
        </div>
        <label className={styles.detailFormField}>Event Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
        <label className={styles.detailFormField}>Description <span className={styles.optionalLabel}>(optional)</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}><h4>Format & Pricing</h4><p>Set the team size, scoring method, and entry price.</p></div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>Required Bowlers<input type="number" min={1} value={requiredBowlerCount} onChange={(e) => { const count = Math.max(Number(e.target.value) || 1, 1); setDraft({ ...draft, minPlayers: count, maxPlayers: count }); }} /></label>
          <label className={styles.detailFormField}>Scoring Type<select value={draft.scoring} onChange={(e) => setDraft({ ...draft, scoring: e.target.value as EventConfig['scoring'] })}><option value="handicap">Handicap</option><option value="scratch">Scratch</option><option value="no-tap">No-Tap</option></select></label>
          <label className={styles.detailFormField}>Entry Fee (USD)<input type="text" inputMode="decimal" value={entryFeeInput} onChange={(e) => { const value = normalizeEntryFeeInput(e.target.value); setEntryFeeInput(value); setDraft({ ...draft, entryFeeCents: parseEntryFeeInputToCents(value) }); }} onBlur={() => setEntryFeeInput(formatEntryFeeInput(draft.entryFeeCents))} /></label>
        </div>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}><h4>Re-entry</h4><p>Control whether a bowler may enter this event more than once.</p></div>
        <label className={styles.eventToggleRow}><input type="checkbox" checked={draft.allowReentry} onChange={(e) => setDraft({ ...draft, allowReentry: e.target.checked, maxReentries: e.target.checked ? 1 : 0 })} /><span>Allow bowlers to enter this event more than once</span></label>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.eventSectionHeaderRow}><div className={styles.divisionEditorSectionHeader}><h4>Squad Availability</h4><p>Choose which tournament times can be selected.</p></div><select value={squadSelectionValue} disabled={!hasAvailableSquads} onChange={(e) => setSquadRequirement(e.target.value)}><option value="none">Not Used</option><option value="required">Required</option><option value="optional">Optional</option></select></div>
        {!hasAvailableSquads ? <p className={styles.detailFormNone}>No squads are configured for this tournament.</p> : squadSelectionValue !== 'none' ? <div className={styles.detailFormCheckList}>{squads.map((sq) => <label key={sq.id} className={styles.detailFormCheckItem}><input type="checkbox" checked={draft.connectedSquadIds.includes(sq.id)} onChange={() => setDraft((prev) => ({ ...prev, connectedSquadIds: prev.connectedSquadIds.includes(sq.id) ? prev.connectedSquadIds.filter((id) => id !== sq.id) : [...prev.connectedSquadIds, sq.id] }))} />{sq.name || sq.dateIso}</label>)}</div> : null}
        {squadsAreInvalid ? <p className={styles.squadEditorError}>Select at least one squad when squad selection is required.</p> : null}
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.eventSectionHeaderRow}><div className={styles.divisionEditorSectionHeader}><h4>Division Availability</h4><p>Choose which eligibility groups can enter.</p></div><select value={divisionSelectionValue} disabled={!hasAvailableDivisions} onChange={(e) => setDivisionRequirement(e.target.value)}><option value="none">Not Used</option><option value="required">Required</option><option value="optional">Optional</option></select></div>
        {!hasAvailableDivisions ? <p className={styles.detailFormNone}>No divisions are configured for this tournament.</p> : divisionSelectionValue !== 'none' ? <div className={styles.detailFormCheckList}>{divisions.map((division) => <label key={division.id} className={styles.detailFormCheckItem}><input type="checkbox" checked={draft.connectedDivisionIds.includes(division.id)} onChange={() => setDraft((prev) => ({ ...prev, connectedDivisionIds: prev.connectedDivisionIds.includes(division.id) ? prev.connectedDivisionIds.filter((id) => id !== division.id) : [...prev.connectedDivisionIds, division.id] }))} />{division.name || 'Untitled Division'}</label>)}</div> : null}
        {divisionsAreInvalid ? <p className={styles.squadEditorError}>Select at least one division when division selection is required.</p> : null}
      </section>

      <div className={`${styles.modalFormFooter} ${styles.editorActionFooter}`}>
        <div className={styles.squadEditorFooterLeft}>{onDelete ? <button type="button" className={styles.dangerAction} onClick={onDelete}>Delete Event</button> : null}</div>
        <div className={styles.squadEditorFooterActions}><button type="button" className={styles.secondaryAction} onClick={onCancel}>Cancel</button><button type="submit" className={styles.primaryAction} disabled={!isDirty || !isValid}>Save Event</button></div>
      </div>
    </form>
  );
}

type InlineDivisionEditorProps = {
  division: DivisionConfig;
  usedByEventNames: string[];
  onSave: (division: DivisionConfig) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export function InlineDivisionEditor({ division, usedByEventNames, onSave, onCancel, onDelete }: InlineDivisionEditorProps) {
  const [draft, setDraft] = useState<DivisionConfig>(division);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(division);
  const averageRangeIsInvalid = draft.minAverage !== null && draft.maxAverage !== null && draft.minAverage > draft.maxAverage;
  const ageRangeIsInvalid = draft.minAge !== null && draft.maxAge !== null && draft.minAge > draft.maxAge;
  const negativeValueIsInvalid = [draft.minAverage, draft.maxAverage, draft.minAge, draft.maxAge].some((value) => value !== null && value < 0);
  const isValid = Boolean(draft.name.trim()) && !averageRangeIsInvalid && !ageRangeIsInvalid && !negativeValueIsInvalid;

  return (
    <form
      className={`${styles.detailForm} ${styles.divisionEditorForm}`}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Division Information</h4>
          <p>Name this eligibility group and explain its purpose.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Division Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </label>
          <label className={styles.detailFormField}>
            Scoring Eligibility
            <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DivisionConfig['mode'] })}>
              <option value="handicap">Handicap</option>
              <option value="scratch">Scratch</option>
              <option value="both">Scratch and Handicap</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Description (optional)
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className={styles.detailFormField}>
            Additional Eligibility Notes (optional)
            <textarea
              value={draft.eligibilityNotes}
              onChange={(e) => setDraft({ ...draft, eligibilityNotes: e.target.value })}
              placeholder="Add any special eligibility notes for this division..."
            />
          </label>
        </div>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Eligibility Rules</h4>
          <p>Leave fields blank when there is no restriction.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Minimum Average
            <input type="number" placeholder="No restriction" value={draft.minAverage ?? ''} onChange={(e) => setDraft({ ...draft, minAverage: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className={styles.detailFormField}>
            Maximum Average
            <input type="number" placeholder="No restriction" value={draft.maxAverage ?? ''} onChange={(e) => setDraft({ ...draft, maxAverage: e.target.value ? Number(e.target.value) : null })} />
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Minimum Age
            <input type="number" placeholder="No restriction" value={draft.minAge ?? ''} onChange={(e) => setDraft({ ...draft, minAge: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className={styles.detailFormField}>
            Maximum Age
            <input type="number" placeholder="No restriction" value={draft.maxAge ?? ''} onChange={(e) => setDraft({ ...draft, maxAge: e.target.value ? Number(e.target.value) : null })} />
          </label>
        </div>
        {averageRangeIsInvalid ? <p className={styles.squadEditorError}>Minimum average cannot be greater than maximum average.</p> : null}
        {ageRangeIsInvalid ? <p className={styles.squadEditorError}>Minimum age cannot be greater than maximum age.</p> : null}
        {negativeValueIsInvalid ? <p className={styles.squadEditorError}>Eligibility values cannot be negative.</p> : null}
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}><h4>Event Usage</h4><p>Event assignments are managed from Event Details.</p></div>
        <div className={styles.divisionUsageList}>{usedByEventNames.length > 0 ? usedByEventNames.map((name) => <span key={name} className={styles.chip}>{name}</span>) : <span className={styles.detailFormNone}>Not used by any events.</span>}</div>
      </section>

      <div className={`${styles.modalFormFooter} ${styles.editorActionFooter}`}>
        <div className={styles.squadEditorFooterLeft}>{onDelete ? <button type="button" className={styles.dangerAction} onClick={onDelete}>Delete Division</button> : null}</div>
        <div className={styles.squadEditorFooterActions}><button type="button" className={styles.secondaryAction} onClick={onCancel}>Cancel</button><button type="submit" className={styles.primaryAction} disabled={!isDirty || !isValid}>Save Division</button></div>
      </div>
    </form>
  );
}

type EventEditorProps = {
  event: EventConfig;
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (event: EventConfig) => void;
};

export function EventEditor({ event, divisions, squads, onSave }: EventEditorProps) {
  const [draft, setDraft] = useState<EventConfig>(normalizeEventConfig(event));
  const [entryFeeInput, setEntryFeeInput] = useState(() => formatEntryFeeInput(event.entryFeeCents));
  const requiredBowlerCount = Math.max(draft.minPlayers, draft.maxPlayers, 1);
  const hasAvailableDivisions = divisions.length > 0;
  const hasAvailableSquads = squads.length > 0;
  const divisionSelectionValue = draft.connectedDivisionIds.length === 0 ? 'none' : draft.requireDivision ? 'required' : 'optional';
  const squadSelectionValue = draft.connectedSquadIds.length === 0 ? 'none' : draft.requireSquad ? 'required' : 'optional';
  const selectedDivisionCount = draft.connectedDivisionIds.length;
  const selectedSquadCount = draft.connectedSquadIds.length;

  return (
    <form
      className={`${styles.detailForm} ${styles.eventEditorForm}`}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <div className={styles.eventEditorSummary}>
        <span className={styles.eventEditorSummaryChip}>{requiredBowlerCount} Bowler{requiredBowlerCount === 1 ? '' : 's'}</span>
        <span className={styles.eventEditorSummaryChip}>{selectedDivisionCount} Division{selectedDivisionCount === 1 ? '' : 's'}</span>
        <span className={styles.eventEditorSummaryChip}>{selectedSquadCount} Squad{selectedSquadCount === 1 ? '' : 's'}</span>
        <span className={`${styles.eventEditorSummaryChip} ${draft.enabled ? styles.eventEditorSummaryChipEnabled : ''}`}>{draft.enabled ? 'Enabled' : 'Draft'}</span>
      </div>

      <section className={styles.eventEditorSection}>
        <div className={styles.eventEditorSectionHeader}>
          <h4>Identity & Entry Rules</h4>
          <p>Set the event basics and who can enter.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Event Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </label>
          <label className={styles.detailFormField}>
            Re-entry
            <select value={draft.allowReentry ? 'enabled' : 'disabled'} onChange={(e) => setDraft({ ...draft, allowReentry: e.target.value === 'enabled' })}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Description
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className={styles.detailFormField}>
            Max Entries Per Bowler
            <input type="number" min={0} value={draft.maxReentries} onChange={(e) => setDraft({ ...draft, maxReentries: Number(e.target.value) })} disabled={!draft.allowReentry} />
          </label>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>
            Required Bowler Count
            <input
              type="number"
              min={1}
              value={requiredBowlerCount}
              onChange={(e) => {
                const playerCount = Math.max(Number(e.target.value) || 1, 1);
                setDraft({ ...draft, minPlayers: playerCount, maxPlayers: playerCount });
              }}
            />
          </label>
        </div>
      </section>

      <section className={styles.eventEditorSection}>
        <div className={styles.eventEditorSectionHeader}>
          <h4>Scoring & Availability</h4>
          <p>Choose scoring mode and assign divisions/squads.</p>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>
            Scoring
            <select value={draft.scoring} onChange={(e) => setDraft({ ...draft, scoring: e.target.value as EventConfig['scoring'] })}>
              <option value="handicap">Handicap</option>
              <option value="scratch">Scratch</option>
              <option value="no-tap">No-Tap</option>
            </select>
          </label>
          <div className={styles.detailFormField}>
            Available Divisions (optional)
            <div className={styles.detailFormCheckList}>
              {divisions.map((div) => (
                <label key={div.id} className={styles.detailFormCheckItem}>
                  <input
                    type="checkbox"
                    checked={draft.connectedDivisionIds.includes(div.id)}
                    onChange={() => setDraft((prev) => ({
                      ...prev,
                      connectedDivisionIds: prev.connectedDivisionIds.includes(div.id)
                        ? prev.connectedDivisionIds.filter((id) => id !== div.id)
                        : [...prev.connectedDivisionIds, div.id],
                    }))}
                  />
                  {div.name || 'Untitled'}
                </label>
              ))}
              {divisions.length === 0 && <span className={styles.detailFormNone}>No divisions configured for this tournament.</span>}
            </div>
          </div>
          <div className={styles.detailFormField}>
            Available Squads
            <div className={styles.detailFormCheckList}>
              {squads.map((sq) => (
                <label key={sq.id} className={styles.detailFormCheckItem}>
                  <input
                    type="checkbox"
                    checked={draft.connectedSquadIds.includes(sq.id)}
                    onChange={() => setDraft((prev) => ({
                      ...prev,
                      connectedSquadIds: prev.connectedSquadIds.includes(sq.id)
                        ? prev.connectedSquadIds.filter((id) => id !== sq.id)
                        : [...prev.connectedSquadIds, sq.id],
                    }))}
                  />
                  {sq.name || sq.dateIso}
                </label>
              ))}
              {squads.length === 0 && <span className={styles.detailFormNone}>No squads yet</span>}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.eventEditorSection}>
        <div className={styles.eventEditorSectionHeader}>
          <h4>Registration Controls</h4>
          <p>Define what bowlers must select and set pricing.</p>
        </div>
        <div className={styles.detailFormRow}>
          {hasAvailableDivisions ? (
            <label className={styles.detailFormField}>
              Division Selection
              <select
                value={divisionSelectionValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (nextValue === 'none') {
                    setDraft({ ...draft, requireDivision: false, connectedDivisionIds: [] });
                    return;
                  }

                  setDraft({ ...draft, requireDivision: nextValue === 'required' });
                }}
              >
                <option value="none">No divisions</option>
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
          ) : (
            <div className={styles.detailFormField}>
              Division Selection
              <span className={styles.detailFormNone}>Not needed because this tournament has no divisions.</span>
            </div>
          )}
          {hasAvailableSquads ? (
            <label className={styles.detailFormField}>
              Squad Selection
              <select value={squadSelectionValue} onChange={(e) => {
                const nextValue = e.target.value;
                setDraft(nextValue === 'none'
                  ? { ...draft, requireSquad: false, connectedSquadIds: [] }
                  : { ...draft, requireSquad: nextValue === 'required' });
              }}>
                <option value="none">No squads</option>
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
          ) : (
            <div className={styles.detailFormField}>Squad Selection<span className={styles.detailFormNone}>Not needed because this tournament has no squads.</span></div>
          )}
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Entry Fee (USD)
            <input
              type="text"
              inputMode="decimal"
              value={entryFeeInput}
              onChange={(e) => {
                const nextValue = normalizeEntryFeeInput(e.target.value);
                setEntryFeeInput(nextValue);
                setDraft({ ...draft, entryFeeCents: parseEntryFeeInputToCents(nextValue) });
              }}
              onBlur={() => {
                setEntryFeeInput(formatEntryFeeInput(draft.entryFeeCents));
              }}
            />
          </label>
        </div>
      </section>

      <div className={styles.detailFormSaveRow}>
        <button type="submit" className={styles.primaryAction}>Save Event</button>
      </div>
    </form>
  );
}

type SquadEditorProps = {
  squad: SquadConfig;
  locationName: string;
  onSave: (squad: SquadConfig) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export function SquadEditor({ squad, locationName, onSave, onCancel, onDelete }: SquadEditorProps) {
  const normalizedSquad = normalizeSquadConfig(squad, { locationName });
  const [draft, setDraft] = useState<SquadConfig>(normalizedSquad);
  const spotsRemaining = Math.max(draft.capacity - draft.registeredCount, 0);
  const checkInIsInvalid = Boolean(draft.checkInTime && draft.startTime && draft.checkInTime >= draft.startTime);
  const capacityIsInvalid = draft.capacity < 1 || draft.capacity < draft.registeredCount;
  const isValid = Boolean(draft.dateIso && draft.startTime && draft.checkInTime) && !checkInIsInvalid && !capacityIsInvalid;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(normalizedSquad);

  return (
    <form className={`${styles.detailForm} ${styles.squadEditorForm}`} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Squad Details</h4>
          <p>The squad name and location are generated automatically.</p>
        </div>
        <div className={styles.squadInheritedValue}><span>Squad Name</span><strong>{buildSquadDisplayName(draft)}</strong><small>Generated from the date and start time</small></div>
        <div className={styles.squadInheritedValue}><span>Tournament Location</span><strong>{locationName || 'Set a location in Tournament Details'}</strong><small>Managed in Tournament Details</small></div>
      </section>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Schedule</h4>
          <p>Set the squad date and when bowlers should arrive.</p>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>Date<input type="date" value={draft.dateIso} onChange={(eventInput) => setDraft({ ...draft, dateIso: eventInput.target.value })} required /></label>
          <label className={styles.detailFormField}>Start Time<input type="time" value={draft.startTime} onChange={(eventInput) => setDraft({ ...draft, startTime: eventInput.target.value })} required /></label>
          <label className={styles.detailFormField}>Check-in Time<input aria-invalid={checkInIsInvalid} type="time" value={draft.checkInTime} onChange={(eventInput) => setDraft({ ...draft, checkInTime: eventInput.target.value })} required /></label>
        </div>
        {checkInIsInvalid ? <p className={styles.squadEditorError}>Check-in must be earlier than the squad start time.</p> : null}
      </section>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Capacity & Availability</h4>
          <p>Control available spots and overflow registration.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>Capacity<input aria-invalid={capacityIsInvalid} type="number" min={Math.max(1, draft.registeredCount)} value={draft.capacity} onChange={(eventInput) => setDraft({ ...draft, capacity: Number(eventInput.target.value) })} required /></label>
          <label className={styles.detailFormField}>Waitlist<select value={draft.waitlistEnabled ? 'enabled' : 'disabled'} onChange={(eventInput) => setDraft({ ...draft, waitlistEnabled: eventInput.target.value === 'enabled' })}><option value="enabled">Enabled when full</option><option value="disabled">Disabled</option></select></label>
        </div>
        <p className={styles.squadEditorContext}>{draft.registeredCount} registered · {spotsRemaining} spot{spotsRemaining === 1 ? '' : 's'} remaining</p>
        {capacityIsInvalid ? <p className={styles.squadEditorError}>Capacity must be at least {Math.max(1, draft.registeredCount)}.</p> : null}
      </section>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}><h4>Internal Notes <span>(optional)</span></h4><p>Only tournament staff can see these notes.</p></div>
        <label className={styles.detailFormField}><span className={styles.srOnly}>Internal Notes</span><textarea value={draft.notes} onChange={(eventInput) => setDraft({ ...draft, notes: eventInput.target.value })} placeholder="Add staff instructions or accessibility notes" /></label>
      </section>
      <div className={styles.modalFormFooter}>
        <div className={styles.squadEditorFooterLeft}>{onDelete ? <button type="button" className={styles.dangerAction} onClick={onDelete}>Delete Squad</button> : null}</div>
        <div className={styles.squadEditorFooterActions}>
          <button type="button" className={styles.secondaryAction} onClick={onCancel}>Cancel</button>
          <button type="submit" className={styles.primaryAction} disabled={!isValid || !isDirty}>Save Squad</button>
        </div>
      </div>
    </form>
  );
}

type QuestionEditorProps = {
  question: CustomQuestionConfig;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (question: CustomQuestionConfig) => void;
};

type FieldEditorProps = {
  field: RegistrationFieldConfig;
  onSave: (field: RegistrationFieldConfig) => void;
};

export function FieldEditor({ field, onSave }: FieldEditorProps) {
  const [draft, setDraft] = useState<RegistrationFieldConfig>(field);
  const isModeLocked = draft.key === 'bowling_hand';

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <label>
        System Field
        <input value={draft.label} readOnly />
      </label>
      <label>
        Custom Label
        <input
          value={draft.customLabel}
          onChange={(eventInput) => setDraft({ ...draft, customLabel: eventInput.target.value })}
          placeholder="Leave blank to use the system field name"
        />
      </label>
      <label>
        Help Text
        <textarea
          value={draft.helpText}
          onChange={(eventInput) => setDraft({ ...draft, helpText: eventInput.target.value })}
          placeholder="Add guidance the bowler will see below this field"
        />
      </label>
      <label>
        Requirement
        <select
          value={isModeLocked ? 'dont-ask' : draft.mode}
          onChange={(eventInput) => setDraft({ ...draft, mode: eventInput.target.value as RegistrationFieldConfig['mode'] })}
          disabled={isModeLocked}
        >
          {isModeLocked ? <option value="dont-ask">Don&apos;t Ask (Locked)</option> : null}
          {!isModeLocked ? <option value="required">Required</option> : null}
          {!isModeLocked ? <option value="optional">Optional</option> : null}
          <option value="dont-ask">Don&apos;t Ask</option>
        </select>
      </label>
      <label>
        Validation Type
        <input value={draft.validation} readOnly />
      </label>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Field</button>
      </div>
    </form>
  );
}

export function QuestionEditor({ question, events, divisions, squads, onSave }: QuestionEditorProps) {
  const [draft, setDraft] = useState<CustomQuestionConfig>(question);
  const optionsText = draft.options.join('\n');

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <label>Question<input value={draft.label} onChange={(eventInput) => setDraft({ ...draft, label: eventInput.target.value })} required /></label>
      <label>
        Field Type
        <select value={draft.type} onChange={(eventInput) => setDraft({ ...draft, type: eventInput.target.value as CustomQuestionConfig['type'] })}>
          <option value="short-text">Short text</option>
          <option value="long-text">Long text</option>
          <option value="number">Number</option>
          <option value="yes-no">Yes/No</option>
          <option value="dropdown">Dropdown</option>
          <option value="multiple-choice">Multiple choice</option>
          <option value="checkbox">Checkbox</option>
          <option value="date">Date</option>
        </select>
      </label>
      {(draft.type === 'dropdown' || draft.type === 'multiple-choice' || draft.type === 'checkbox') && (
        <label>
          Options (one per line)
          <textarea value={optionsText} onChange={(eventInput) => setDraft({ ...draft, options: eventInput.target.value.split('\n').map((option) => option.trim()).filter(Boolean) })} />
        </label>
      )}
      <label>Help Text<textarea value={draft.helpText} onChange={(eventInput) => setDraft({ ...draft, helpText: eventInput.target.value })} /></label>
      <div className={styles.inlineFields}>
        <label><input type="checkbox" checked={draft.required} onChange={(eventInput) => setDraft({ ...draft, required: eventInput.target.checked })} /> Required</label>
        <label><input type="checkbox" checked={draft.enabled} onChange={(eventInput) => setDraft({ ...draft, enabled: eventInput.target.checked })} /> Enabled</label>
      </div>
      <label><input type="checkbox" checked={draft.scope.all} onChange={(eventInput) => setDraft({ ...draft, scope: { ...draft.scope, all: eventInput.target.checked } })} /> Applies to all registrations</label>
      {!draft.scope.all && (
        <>
          <fieldset>
            <legend>Selected Events</legend>
            <div className={styles.checkboxGrid}>
              {events.map((eventOption) => {
                const checked = draft.scope.eventIds.includes(eventOption.id);
                return (
                  <label key={eventOption.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setDraft((prev) => ({
                          ...prev,
                          scope: {
                            ...prev.scope,
                            eventIds: checked ? prev.scope.eventIds.filter((id) => id !== eventOption.id) : [...prev.scope.eventIds, eventOption.id],
                          },
                        }));
                      }}
                    />
                    {eventOption.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend>Selected Divisions</legend>
            <div className={styles.checkboxGrid}>
              {divisions.map((division) => {
                const checked = draft.scope.divisionIds.includes(division.id);
                return (
                  <label key={division.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setDraft((prev) => ({
                          ...prev,
                          scope: {
                            ...prev.scope,
                            divisionIds: checked ? prev.scope.divisionIds.filter((id) => id !== division.id) : [...prev.scope.divisionIds, division.id],
                          },
                        }));
                      }}
                    />
                    {division.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend>Selected Squads</legend>
            <div className={styles.checkboxGrid}>
              {squads.map((squad) => {
                const checked = draft.scope.squadIds.includes(squad.id);
                return (
                  <label key={squad.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setDraft((prev) => ({
                          ...prev,
                          scope: {
                            ...prev.scope,
                            squadIds: checked ? prev.scope.squadIds.filter((id) => id !== squad.id) : [...prev.scope.squadIds, squad.id],
                          },
                        }));
                      }}
                    />
                    {squad.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </>
      )}
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Question</button>
      </div>
    </form>
  );
}

type FeeEditorProps = {
  fee: FeeConfig;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (fee: FeeConfig) => void;
};

export function FeeEditor({ fee, events, divisions, squads, onSave }: FeeEditorProps) {
  const [draft, setDraft] = useState<FeeConfig>({ ...fee, required: false });

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave({ ...draft, required: false }); }}>
      <label>Name<input value={draft.name} onChange={(eventInput) => setDraft({ ...draft, name: eventInput.target.value })} required /></label>
      <label>Amount (USD)<input type="number" min={0} step="0.01" value={(draft.amountCents / 100).toFixed(2)} onChange={(eventInput) => setDraft({ ...draft, amountCents: Math.round(Number(eventInput.target.value || '0') * 100) })} /></label>
      <div className={styles.inlineFields}>
        <label className={styles.feeEditorHint}>Base entry fees are managed in Events & Divisions.</label>
        <label><input type="checkbox" checked={draft.enabled} onChange={(eventInput) => setDraft({ ...draft, enabled: eventInput.target.checked })} /> Enabled</label>
      </div>
      <fieldset>
        <legend>Applicable Events</legend>
        <div className={styles.checkboxGrid}>
          {events.map((eventOption) => {
            const checked = draft.eventIds.includes(eventOption.id);
            return (
              <label key={eventOption.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setDraft((prev) => ({
                      ...prev,
                      eventIds: checked
                        ? prev.eventIds.filter((id) => id !== eventOption.id)
                        : [...prev.eventIds, eventOption.id],
                    }));
                  }}
                />
                {eventOption.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend>Applicable Divisions</legend>
        <div className={styles.checkboxGrid}>
          {divisions.map((division) => {
            const checked = draft.divisionIds.includes(division.id);
            return (
              <label key={division.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setDraft((prev) => ({
                      ...prev,
                      divisionIds: checked
                        ? prev.divisionIds.filter((id) => id !== division.id)
                        : [...prev.divisionIds, division.id],
                    }));
                  }}
                />
                {division.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend>Applicable Squads</legend>
        <div className={styles.checkboxGrid}>
          {squads.map((squad) => {
            const checked = draft.squadIds.includes(squad.id);
            return (
              <label key={squad.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setDraft((prev) => ({
                      ...prev,
                      squadIds: checked
                        ? prev.squadIds.filter((id) => id !== squad.id)
                        : [...prev.squadIds, squad.id],
                    }));
                  }}
                />
                {squad.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Add-on</button>
      </div>
    </form>
  );
}

type LocationEditorProps = {
  location: LocationConfig;
  onSave: (location: LocationConfig) => void;
};

export function LocationEditor({ location, onSave }: LocationEditorProps) {
  const [draft, setDraft] = useState<LocationConfig>(location);

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <label>Name<input value={draft.name} onChange={(eventInput) => setDraft({ ...draft, name: eventInput.target.value })} required /></label>
      <div className={styles.inlineFields}>
        <label>City<input value={draft.city} onChange={(eventInput) => setDraft({ ...draft, city: eventInput.target.value })} required /></label>
        <label>State<input value={draft.state} onChange={(eventInput) => setDraft({ ...draft, state: eventInput.target.value })} required maxLength={2} /></label>
      </div>
      <label><input type="checkbox" checked={draft.defaultLocation} onChange={(eventInput) => setDraft({ ...draft, defaultLocation: eventInput.target.checked })} /> Default location</label>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Location</button>
      </div>
    </form>
  );
}
