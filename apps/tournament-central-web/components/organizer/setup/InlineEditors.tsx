'use client';

import { Fragment, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, CardDivider, CheckboxField, FormGrid, ICON_SIZE, Notice, SelectField, TextAreaField, TextField } from '@bracketworks/ui';

import { normalizeEventConfig, normalizeSquadConfig } from '../setupSerialization';
import { buildSquadDisplayName, formatEntryFeeInput, normalizeEntryFeeInput, parseEntryFeeInputToCents } from '../setupFormatting';
import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, LocationConfig, RegistrationFieldConfig, SquadConfig } from '../types';
import styles from './InlineEditors.module.css';

/* Shared layout for every setup editor: subsections split by dividers, then one action row. */

function EditorForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      className={styles.form}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

function EditorSection({ title, description, action, children, first = false }: {
  title: string;
  description?: string;
  /** A control on the right of the title, for example a requirement select. */
  action?: ReactNode;
  children?: ReactNode;
  first?: boolean;
}) {
  return (
    <>
      {first ? null : <CardDivider />}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div className={styles.sectionText}>
            <h3 className={styles.sectionTitle}>{title}</h3>
            {description ? <p className={styles.helper}>{description}</p> : null}
          </div>
          {action ? <div className={styles.sectionAction}>{action}</div> : null}
        </header>
        {children}
      </section>
    </>
  );
}

function EditorActions({ saveLabel, canSave = true, onCancel, onDelete, deleteLabel }: {
  saveLabel: string;
  canSave?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <>
      <CardDivider />
      <div className={styles.actions}>
        {onDelete ? (
          <Button variant="ghost-danger" icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={onDelete} className={styles.deleteAction}>
            {deleteLabel ?? 'Delete'}
          </Button>
        ) : null}
        {onCancel ? <Button variant="secondary" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="primary" disabled={!canSave}>{saveLabel}</Button>
      </div>
    </>
  );
}

function CheckboxGroup<T extends { id: string }>({ legend, items, selectedIds, labelFor, onToggle, emptyText }: {
  legend: string;
  items: T[];
  selectedIds: string[];
  labelFor: (item: T) => string;
  onToggle: (id: string) => void;
  emptyText?: string;
}) {
  return (
    <fieldset className={styles.checkboxGroup}>
      <legend className={styles.legend}>{legend}</legend>
      {items.length === 0 ? <p className={styles.helper}>{emptyText ?? 'None configured yet.'}</p> : null}
      {items.map((item) => (
        <CheckboxField key={item.id} label={labelFor(item)} checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} />
      ))}
    </fieldset>
  );
}

const toggleId = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
const numberOrNull = (value: string) => (value ? Number(value) : null);

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
  const divisionSelectionValue = draft.connectedDivisionIds.length === 0 ? 'none' : draft.requireDivision ? 'required' : 'optional';
  const squadSelectionValue = draft.connectedSquadIds.length === 0 ? 'none' : draft.requireSquad ? 'required' : 'optional';
  const isDirty = JSON.stringify(draft) !== JSON.stringify(normalizeEventConfig(event)) || entryFeeInput !== formatEntryFeeInput(event.entryFeeCents);
  const squadsAreInvalid = draft.requireSquad && draft.connectedSquadIds.length === 0;
  const divisionsAreInvalid = draft.requireDivision && draft.connectedDivisionIds.length === 0;
  const isValid = Boolean(draft.name.trim()) && requiredBowlerCount >= 1 && !squadsAreInvalid && !divisionsAreInvalid;

  const setDivisionRequirement = (value: string) => {
    setDraft(value === 'none'
      ? { ...draft, requireDivision: false, connectedDivisionIds: [] }
      : { ...draft, requireDivision: value === 'required', connectedDivisionIds: draft.connectedDivisionIds.length ? draft.connectedDivisionIds : divisions.map((division) => division.id) });
  };
  const setSquadRequirement = (value: string) => {
    setDraft(value === 'none'
      ? { ...draft, requireSquad: false, connectedSquadIds: [] }
      : { ...draft, requireSquad: value === 'required', connectedSquadIds: draft.connectedSquadIds.length ? draft.connectedSquadIds : squads.map((squad) => squad.id) });
  };

  const requirementSelect = (label: string, value: string, disabled: boolean, onChange: (value: string) => void) => (
    <SelectField label={label} hideLabel className={styles.compactSelect} value={value} disabled={disabled} onChange={(changeEvent) => onChange(changeEvent.target.value)}>
      <option value="none">Not used</option>
      <option value="required">Required</option>
      <option value="optional">Optional</option>
    </SelectField>
  );

  return (
    <EditorForm onSubmit={() => onSave(draft)}>
      <EditorSection first title="Event information" description="Name the offering and explain what bowlers are entering.">
        <FormGrid>
          <TextField label="Event name" fullRow value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <TextAreaField label="Description" optional fullRow value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </FormGrid>
      </EditorSection>

      <EditorSection title="Format and pricing" description="Team size, scoring method, and entry price.">
        <div className={styles.grid3}>
          <TextField
            label="Bowlers per entry"
            type="number"
            min={1}
            value={requiredBowlerCount}
            onChange={(e) => {
              const count = Math.max(Number(e.target.value) || 1, 1);
              setDraft({ ...draft, minPlayers: count, maxPlayers: count });
            }}
          />
          <SelectField label="Scoring" value={draft.scoring} onChange={(e) => setDraft({ ...draft, scoring: e.target.value as EventConfig['scoring'] })}>
            <option value="handicap">Handicap</option>
            <option value="scratch">Scratch</option>
            <option value="no-tap">No-tap</option>
          </SelectField>
          <TextField
            label="Entry fee (USD)"
            inputMode="decimal"
            value={entryFeeInput}
            onChange={(e) => {
              const value = normalizeEntryFeeInput(e.target.value);
              setEntryFeeInput(value);
              setDraft({ ...draft, entryFeeCents: parseEntryFeeInputToCents(value) });
            }}
            onBlur={() => setEntryFeeInput(formatEntryFeeInput(draft.entryFeeCents))}
          />
        </div>
      </EditorSection>

      <EditorSection title="Re-entry" description="Whether a bowler may enter this event more than once.">
        <CheckboxField
          label="Allow bowlers to enter this event more than once"
          checked={draft.allowReentry}
          onChange={(e) => setDraft({ ...draft, allowReentry: e.target.checked, maxReentries: e.target.checked ? 1 : 0 })}
        />
      </EditorSection>

      <EditorSection
        title="Squads"
        description="Which squad times bowlers can choose for this event."
        action={requirementSelect('Squad selection', squadSelectionValue, squads.length === 0, setSquadRequirement)}
      >
        {squads.length === 0 ? <p className={styles.helper}>No squads are set up for this tournament.</p> : null}
        {squads.length > 0 && squadSelectionValue !== 'none' ? (
          <CheckboxGroup
            legend="Available squads"
            items={squads}
            selectedIds={draft.connectedSquadIds}
            labelFor={(squad) => squad.name || squad.dateIso}
            onToggle={(id) => setDraft((prev) => ({ ...prev, connectedSquadIds: toggleId(prev.connectedSquadIds, id) }))}
          />
        ) : null}
        {squadsAreInvalid ? <Notice tone="danger" role="alert">Select at least one squad when squad selection is required.</Notice> : null}
      </EditorSection>

      <EditorSection
        title="Divisions"
        description="Which eligibility groups can enter this event."
        action={requirementSelect('Division selection', divisionSelectionValue, divisions.length === 0, setDivisionRequirement)}
      >
        {divisions.length === 0 ? <p className={styles.helper}>No divisions are set up for this tournament.</p> : null}
        {divisions.length > 0 && divisionSelectionValue !== 'none' ? (
          <CheckboxGroup
            legend="Eligible divisions"
            items={divisions}
            selectedIds={draft.connectedDivisionIds}
            labelFor={(division) => division.name || 'Untitled division'}
            onToggle={(id) => setDraft((prev) => ({ ...prev, connectedDivisionIds: toggleId(prev.connectedDivisionIds, id) }))}
          />
        ) : null}
        {divisionsAreInvalid ? <Notice tone="danger" role="alert">Select at least one division when division selection is required.</Notice> : null}
      </EditorSection>

      <EditorActions saveLabel="Save event" canSave={isDirty && isValid} onCancel={onCancel} onDelete={onDelete} deleteLabel="Delete event" />
    </EditorForm>
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
    <EditorForm onSubmit={() => onSave(draft)}>
      <EditorSection first title="Division information" description="Name this eligibility group and explain its purpose.">
        <FormGrid>
          <TextField label="Division name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <SelectField label="Scoring eligibility" value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DivisionConfig['mode'] })}>
            <option value="handicap">Handicap</option>
            <option value="scratch">Scratch</option>
            <option value="both">Scratch and handicap</option>
          </SelectField>
          <TextAreaField label="Description" optional value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <TextAreaField
            label="Eligibility notes"
            optional
            value={draft.eligibilityNotes}
            onChange={(e) => setDraft({ ...draft, eligibilityNotes: e.target.value })}
            placeholder="Any special eligibility rules for this division"
          />
        </FormGrid>
      </EditorSection>

      <EditorSection title="Eligibility rules" description="Leave a field blank when there is no limit.">
        <FormGrid>
          <TextField label="Minimum average" optional type="number" placeholder="No limit" value={draft.minAverage ?? ''} onChange={(e) => setDraft({ ...draft, minAverage: numberOrNull(e.target.value) })} />
          <TextField label="Maximum average" optional type="number" placeholder="No limit" value={draft.maxAverage ?? ''} onChange={(e) => setDraft({ ...draft, maxAverage: numberOrNull(e.target.value) })} />
          <TextField label="Minimum age" optional type="number" placeholder="No limit" value={draft.minAge ?? ''} onChange={(e) => setDraft({ ...draft, minAge: numberOrNull(e.target.value) })} />
          <TextField label="Maximum age" optional type="number" placeholder="No limit" value={draft.maxAge ?? ''} onChange={(e) => setDraft({ ...draft, maxAge: numberOrNull(e.target.value) })} />
        </FormGrid>
        {averageRangeIsInvalid ? <Notice tone="danger" role="alert">Minimum average cannot be greater than maximum average.</Notice> : null}
        {ageRangeIsInvalid ? <Notice tone="danger" role="alert">Minimum age cannot be greater than maximum age.</Notice> : null}
        {negativeValueIsInvalid ? <Notice tone="danger" role="alert">Eligibility values cannot be negative.</Notice> : null}
      </EditorSection>

      <EditorSection title="Used by" description="Event assignments are managed in each event's details.">
        <p className={styles.body}>{usedByEventNames.length > 0 ? usedByEventNames.join(', ') : 'Not used by any events.'}</p>
      </EditorSection>

      <EditorActions saveLabel="Save division" canSave={isDirty && isValid} onCancel={onCancel} onDelete={onDelete} deleteLabel="Delete division" />
    </EditorForm>
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
    <EditorForm onSubmit={() => onSave(draft)}>
      <EditorSection first title="Squad details" description="The name and location are filled in automatically.">
        <dl className={styles.facts}>
          <div><dt>Squad name</dt><dd>{buildSquadDisplayName(draft)}</dd></div>
          <div><dt>Location</dt><dd>{locationName || 'Set a location in tournament details'}</dd></div>
        </dl>
      </EditorSection>

      <EditorSection title="Schedule" description="The squad date and when bowlers should arrive.">
        <div className={styles.grid3}>
          <TextField label="Date" type="date" value={draft.dateIso} onChange={(e) => setDraft({ ...draft, dateIso: e.target.value })} required />
          <TextField label="Start time" type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} required />
          <TextField
            label="Check-in time"
            type="time"
            value={draft.checkInTime}
            onChange={(e) => setDraft({ ...draft, checkInTime: e.target.value })}
            required
            error={checkInIsInvalid ? 'Check-in must be before the start time.' : undefined}
          />
        </div>
      </EditorSection>

      <EditorSection title="Capacity and availability" description={`${draft.registeredCount} registered · ${spotsRemaining} spot${spotsRemaining === 1 ? '' : 's'} left`}>
        <FormGrid>
          <TextField
            label="Capacity"
            type="number"
            min={Math.max(1, draft.registeredCount)}
            value={draft.capacity}
            onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
            required
            error={capacityIsInvalid ? `Capacity must be at least ${Math.max(1, draft.registeredCount)}.` : undefined}
          />
          <SelectField label="Waitlist" value={draft.waitlistEnabled ? 'enabled' : 'disabled'} onChange={(e) => setDraft({ ...draft, waitlistEnabled: e.target.value === 'enabled' })}>
            <option value="enabled">Open a waitlist when full</option>
            <option value="disabled">No waitlist</option>
          </SelectField>
        </FormGrid>
      </EditorSection>

      <EditorSection title="Internal notes" description="Only tournament staff can see these notes.">
        <TextAreaField
          label="Internal notes"
          hideLabel
          optional
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Staff instructions or accessibility notes"
        />
      </EditorSection>

      <EditorActions saveLabel="Save squad" canSave={isValid && isDirty} onCancel={onCancel} onDelete={onDelete} deleteLabel="Delete squad" />
    </EditorForm>
  );
}

type FieldEditorProps = {
  field: RegistrationFieldConfig;
  onSave: (field: RegistrationFieldConfig) => void;
};

export function FieldEditor({ field, onSave }: FieldEditorProps) {
  const [draft, setDraft] = useState<RegistrationFieldConfig>(field);
  const isModeLocked = draft.key === 'bowling_hand';

  return (
    <EditorForm onSubmit={() => onSave(draft)}>
      <FormGrid>
        <TextField label="System field" value={draft.label} readOnly />
        <TextField label="Validation type" value={draft.validation} readOnly />
        <TextField
          label="Custom label"
          optional
          fullRow
          value={draft.customLabel}
          onChange={(e) => setDraft({ ...draft, customLabel: e.target.value })}
          placeholder="Leave blank to use the system field name"
        />
        <TextAreaField
          label="Help text"
          optional
          fullRow
          value={draft.helpText}
          onChange={(e) => setDraft({ ...draft, helpText: e.target.value })}
          placeholder="Guidance the bowler sees below this field"
        />
        <SelectField
          label="Requirement"
          value={isModeLocked ? 'dont-ask' : draft.mode}
          onChange={(e) => setDraft({ ...draft, mode: e.target.value as RegistrationFieldConfig['mode'] })}
          disabled={isModeLocked}
          helper={isModeLocked ? 'This field cannot be asked right now.' : undefined}
        >
          {!isModeLocked ? <option value="required">Required</option> : null}
          {!isModeLocked ? <option value="optional">Optional</option> : null}
          <option value="dont-ask">Don&apos;t ask</option>
        </SelectField>
      </FormGrid>
      <EditorActions saveLabel="Save field" />
    </EditorForm>
  );
}

type QuestionEditorProps = {
  question: CustomQuestionConfig;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (question: CustomQuestionConfig) => void;
};

export function QuestionEditor({ question, events, divisions, squads, onSave }: QuestionEditorProps) {
  const [draft, setDraft] = useState<CustomQuestionConfig>(question);
  const hasOptions = draft.type === 'dropdown' || draft.type === 'multiple-choice' || draft.type === 'checkbox';
  const scopeGroups: Array<{ legend: string; items: Array<{ id: string; name: string }>; key: 'eventIds' | 'divisionIds' | 'squadIds' }> = [
    { legend: 'Events', items: events, key: 'eventIds' },
    { legend: 'Divisions', items: divisions, key: 'divisionIds' },
    { legend: 'Squads', items: squads, key: 'squadIds' },
  ];

  return (
    <EditorForm onSubmit={() => onSave(draft)}>
      <EditorSection first title="Question">
        <FormGrid>
          <TextField label="Question" fullRow value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} required />
          <SelectField label="Answer type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CustomQuestionConfig['type'] })}>
            <option value="short-text">Short text</option>
            <option value="long-text">Long text</option>
            <option value="number">Number</option>
            <option value="yes-no">Yes or no</option>
            <option value="dropdown">Dropdown</option>
            <option value="multiple-choice">Multiple choice</option>
            <option value="checkbox">Checkboxes</option>
            <option value="date">Date</option>
          </SelectField>
          {hasOptions ? (
            <TextAreaField
              label="Options"
              fullRow
              helper="One option per line."
              value={draft.options.join('\n')}
              onChange={(e) => setDraft({ ...draft, options: e.target.value.split('\n').map((option) => option.trim()).filter(Boolean) })}
            />
          ) : null}
          <TextAreaField label="Help text" optional fullRow value={draft.helpText} onChange={(e) => setDraft({ ...draft, helpText: e.target.value })} />
        </FormGrid>
        <div className={styles.checks}>
          <CheckboxField label="Required" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} />
          <CheckboxField label="Ask this question" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        </div>
      </EditorSection>

      <EditorSection title="Who is asked">
        <CheckboxField
          label="All registrations"
          checked={draft.scope.all}
          onChange={(e) => setDraft({ ...draft, scope: { ...draft.scope, all: e.target.checked } })}
        />
        {!draft.scope.all ? (
          <div className={styles.grid3}>
            {scopeGroups.map((group) => (
              <Fragment key={group.key}>
                <CheckboxGroup
                  legend={group.legend}
                  items={group.items}
                  selectedIds={draft.scope[group.key]}
                  labelFor={(item) => item.name || 'Untitled'}
                  onToggle={(id) => setDraft((prev) => ({ ...prev, scope: { ...prev.scope, [group.key]: toggleId(prev.scope[group.key], id) } }))}
                />
              </Fragment>
            ))}
          </div>
        ) : null}
      </EditorSection>

      <EditorActions saveLabel="Save question" />
    </EditorForm>
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
  const scopeGroups: Array<{ legend: string; items: Array<{ id: string; name: string }>; key: 'eventIds' | 'divisionIds' | 'squadIds' }> = [
    { legend: 'Events', items: events, key: 'eventIds' },
    { legend: 'Divisions', items: divisions, key: 'divisionIds' },
    { legend: 'Squads', items: squads, key: 'squadIds' },
  ];

  return (
    <EditorForm onSubmit={() => onSave({ ...draft, required: false })}>
      <EditorSection first title="Add-on" description="Base entry fees are set in each event.">
        <FormGrid>
          <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <TextField
            label="Amount (USD)"
            type="number"
            min={0}
            step="0.01"
            value={(draft.amountCents / 100).toFixed(2)}
            onChange={(e) => setDraft({ ...draft, amountCents: Math.round(Number(e.target.value || '0') * 100) })}
          />
        </FormGrid>
        <CheckboxField label="Offer this add-on" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
      </EditorSection>

      <EditorSection title="Applies to">
        <div className={styles.grid3}>
          {scopeGroups.map((group) => (
            <CheckboxGroup
              key={group.key}
              legend={group.legend}
              items={group.items}
              selectedIds={draft[group.key]}
              labelFor={(item) => item.name || 'Untitled'}
              onToggle={(id) => setDraft((prev) => ({ ...prev, [group.key]: toggleId(prev[group.key], id) }))}
            />
          ))}
        </div>
      </EditorSection>

      <EditorActions saveLabel="Save add-on" />
    </EditorForm>
  );
}

type LocationEditorProps = {
  location: LocationConfig;
  onSave: (location: LocationConfig) => void;
};

export function LocationEditor({ location, onSave }: LocationEditorProps) {
  const [draft, setDraft] = useState<LocationConfig>(location);

  return (
    <EditorForm onSubmit={() => onSave(draft)}>
      <FormGrid>
        <TextField label="Name" fullRow value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        <TextField label="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} required />
        <TextField label="State" value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} required maxLength={2} />
      </FormGrid>
      <CheckboxField label="Default location" checked={draft.defaultLocation} onChange={(e) => setDraft({ ...draft, defaultLocation: e.target.checked })} />
      <EditorActions saveLabel="Save location" />
    </EditorForm>
  );
}
