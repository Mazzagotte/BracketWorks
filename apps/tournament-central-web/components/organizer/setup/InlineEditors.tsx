'use client';

import { useState } from 'react';

import { normalizeEventConfig, normalizeSquadConfig } from '../setupSerialization';
import { formatEntryFeeInput, normalizeEntryFeeInput, parseEntryFeeInputToCents } from '../setupFormatting';
import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, LocationConfig, RegistrationFieldConfig, SquadConfig } from '../types';
import styles from '../tournament-setup.module.css';

type InlineEventEditorProps = {
  event: EventConfig;
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (event: EventConfig) => void;
};

export function InlineEventEditor({ event, divisions, squads, onSave }: InlineEventEditorProps) {
  const [draft, setDraft] = useState<EventConfig>(normalizeEventConfig(event));
  const [entryFeeInput, setEntryFeeInput] = useState(() => formatEntryFeeInput(event.entryFeeCents));
  const requiredBowlerCount = Math.max(draft.minPlayers, draft.maxPlayers, 1);
  const hasAvailableDivisions = divisions.length > 0;
  const divisionSelectionValue = draft.connectedDivisionIds.length === 0 ? 'none' : draft.requireDivision ? 'required' : 'optional';
  const selectedDivisionCount = draft.connectedDivisionIds.length;
  const selectedSquadCount = draft.connectedSquadIds.length;

  return (
    <form
      className={`${styles.detailForm} ${styles.divisionEditorForm}`}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <div className={styles.divisionEditorSummary}>
        <span className={styles.divisionEditorSummaryChip}>{requiredBowlerCount} Bowler{requiredBowlerCount === 1 ? '' : 's'}</span>
        <span className={styles.divisionEditorSummaryChip}>{selectedDivisionCount} Division{selectedDivisionCount === 1 ? '' : 's'}</span>
        <span className={styles.divisionEditorSummaryChip}>{selectedSquadCount} Squad{selectedSquadCount === 1 ? '' : 's'}</span>
        <span className={`${styles.divisionEditorSummaryChip} ${draft.enabled ? styles.divisionEditorSummaryChipEnabled : ''}`}>{draft.enabled ? 'Enabled' : 'Draft'}</span>
      </div>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
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

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Scoring & Availability</h4>
          <p>Choose scoring mode and assign divisions and squads.</p>
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

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Registration Controls</h4>
          <p>Configure required selections and entry pricing.</p>
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
          <label className={styles.detailFormField}>
            Squad Selection
            <select value={draft.requireSquad ? 'required' : 'optional'} onChange={(e) => setDraft({ ...draft, requireSquad: e.target.value === 'required' })}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </label>
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

type InlineDivisionEditorProps = {
  division: DivisionConfig;
  events: EventConfig[];
  onSave: (division: DivisionConfig) => void;
};

export function InlineDivisionEditor({ division, events, onSave }: InlineDivisionEditorProps) {
  const [draft, setDraft] = useState<DivisionConfig>(division);
  const selectedEventCount = draft.eventIds.length;

  return (
    <form
      className={`${styles.detailForm} ${styles.divisionEditorForm}`}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <div className={styles.divisionEditorSummary}>
        <span className={styles.divisionEditorSummaryChip}>{selectedEventCount} Event{selectedEventCount === 1 ? '' : 's'}</span>
        <span className={styles.divisionEditorSummaryChip}>{draft.mode === 'both' ? 'Scratch + Handicap' : draft.mode === 'scratch' ? 'Scratch' : 'Handicap'}</span>
        <span className={`${styles.divisionEditorSummaryChip} ${draft.enabled ? styles.divisionEditorSummaryChipEnabled : ''}`}>{draft.enabled ? 'Enabled' : 'Draft'}</span>
      </div>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Identity & Scoring</h4>
          <p>Define this division and choose how it scores.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Division Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </label>
          <label className={styles.detailFormField}>
            Scoring Type
            <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DivisionConfig['mode'] })}>
              <option value="handicap">Handicap</option>
              <option value="scratch">Scratch</option>
              <option value="both">Both</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Description
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className={styles.detailFormField}>
            Eligibility Notes (optional)
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
          <p>Set average and age limits when needed.</p>
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
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Availability</h4>
          <p>Choose which events include this division.</p>
        </div>
        <div className={styles.detailFormField}>
          Associated Events
          <div className={styles.detailFormCheckList}>
            {events.map((ev) => (
              <label key={ev.id} className={styles.detailFormCheckItem}>
                <input
                  type="checkbox"
                  checked={draft.eventIds.includes(ev.id)}
                  onChange={() => setDraft((prev) => ({
                    ...prev,
                    eventIds: prev.eventIds.includes(ev.id)
                      ? prev.eventIds.filter((id) => id !== ev.id)
                      : [...prev.eventIds, ev.id],
                  }))}
                />
                {ev.name || 'Untitled'}
              </label>
            ))}
            {events.length === 0 && <span className={styles.detailFormNone}>No events yet</span>}
          </div>
        </div>
        <label className={styles.detailFormField}>
          Status
          <select value={draft.enabled ? 'enabled' : 'draft'} onChange={(e) => setDraft({ ...draft, enabled: e.target.value === 'enabled' })}>
            <option value="enabled">Enabled</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </section>

      <div className={styles.detailFormSaveRow}>
        <button type="submit" className={styles.primaryAction}>Save Division</button>
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
  const divisionSelectionValue = draft.connectedDivisionIds.length === 0 ? 'none' : draft.requireDivision ? 'required' : 'optional';
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
          <label className={styles.detailFormField}>
            Squad Selection
            <select value={draft.requireSquad ? 'required' : 'optional'} onChange={(e) => setDraft({ ...draft, requireSquad: e.target.value === 'required' })}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </label>
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
  events: EventConfig[];
  locationName: string;
  registrationDeadlineIso: string;
  onSave: (squad: SquadConfig) => void;
};

export function SquadEditor({ squad, events, locationName, registrationDeadlineIso, onSave }: SquadEditorProps) {
  const [draft, setDraft] = useState<SquadConfig>(normalizeSquadConfig(squad, { locationName, registrationDeadlineIso }));
  const selectedEventCount = draft.eventIds.length;
  const fillPercent = draft.capacity > 0
    ? Math.max(0, Math.min(100, Math.round((draft.registeredCount / draft.capacity) * 100)))
    : 0;

  return (
    <form className={`${styles.detailForm} ${styles.squadEditorForm}`} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <div className={styles.squadEditorSummary}>
        <span className={styles.squadEditorSummaryChip}>{selectedEventCount} Event{selectedEventCount === 1 ? '' : 's'}</span>
        <span className={styles.squadEditorSummaryChip}>{draft.requiredBowlerCount} Bowler{draft.requiredBowlerCount === 1 ? '' : 's'} Required</span>
        <span className={styles.squadEditorSummaryChip}>{fillPercent}% Filled</span>
        <span className={`${styles.squadEditorSummaryChip} ${draft.waitlistEnabled ? styles.squadEditorSummaryChipEnabled : ''}`}>{draft.waitlistEnabled ? 'Waitlist On' : 'Waitlist Off'}</span>
      </div>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Schedule</h4>
          <p>Set squad date, start, and check-in timing.</p>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>Date<input type="date" value={draft.dateIso} onChange={(eventInput) => setDraft({ ...draft, dateIso: eventInput.target.value })} required /></label>
          <label className={styles.detailFormField}>Start Time<input type="time" value={draft.startTime} onChange={(eventInput) => setDraft({ ...draft, startTime: eventInput.target.value })} required /></label>
          <label className={styles.detailFormField}>Check-in<input type="time" value={draft.checkInTime} onChange={(eventInput) => setDraft({ ...draft, checkInTime: eventInput.target.value })} required /></label>
        </div>
      </section>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Capacity & Rules</h4>
          <p>Control roster size and registration limits.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Required Bowler Count
            <input
              type="number"
              min={1}
              value={draft.requiredBowlerCount}
              onChange={(eventInput) => setDraft({ ...draft, requiredBowlerCount: Math.max(1, Number(eventInput.target.value) || 1) })}
            />
          </label>
          <label className={styles.detailFormField}>Capacity<input type="number" min={1} value={draft.capacity} onChange={(eventInput) => setDraft({ ...draft, capacity: Number(eventInput.target.value) })} /></label>
        </div>
        <label className={styles.detailFormField}>Notes<textarea value={draft.notes} onChange={(eventInput) => setDraft({ ...draft, notes: eventInput.target.value })} /></label>
      </section>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Availability</h4>
          <p>Assign events and control waitlist behavior.</p>
        </div>
        <div className={styles.detailFormField}>
          Associated Events
          <div className={styles.detailFormCheckList}>
            {events.map((eventOption) => {
              const checked = draft.eventIds.includes(eventOption.id);
              return (
                <label key={eventOption.id} className={styles.detailFormCheckItem}>
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
            {events.length === 0 && <span className={styles.detailFormNone}>No events yet</span>}
          </div>
        </div>
        <label className={styles.detailFormField}>
          Waitlist
          <select value={draft.waitlistEnabled ? 'enabled' : 'disabled'} onChange={(eventInput) => setDraft({ ...draft, waitlistEnabled: eventInput.target.value === 'enabled' })}>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </section>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Squad</button>
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
