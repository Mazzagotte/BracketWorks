'use client';

import { Fragment, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, CardDivider, CheckboxField, FormGrid, ICON_SIZE, Notice, SegmentedControl, SelectField, TextAreaField, TextField } from '@bracketworks/ui';

import {
  EVENT_FORMAT_LABEL,
  FINALS_LABEL,
  FORMAT_PLAYERS,
  SIDE_EVENT_LABEL,
  defaultDivisionRules,
  defaultEventRules,
  defaultSideEvent,
  normalizeSideEvent,
} from '../formatTypes';
import type { AverageSource, BracketRules, DivisionRules, EventFormat, EventRules, FinalsScope, FinalsType, SideEventKind, SideEventSettings } from '../formatTypes';
import { bracketPayoutSummary, handicapExample, payoutRatioText } from '../formatSummaries';
import { normalizeEventConfig, normalizeSquadConfig } from '../setupSerialization';
import { buildSquadDisplayName, formatEntryFeeInput, normalizeEntryFeeInput, parseEntryFeeInputToCents } from '../setupFormatting';
import { eventRuleProblems, sideEventProblems } from '../setupValidation';
import type { RuleProblem } from '../setupValidation';
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
const errorFor = (problems: RuleProblem[], field: string) => problems.find((problem) => problem.field === field && problem.severity === 'error')?.message;

/** A dollar amount typed as text and kept in cents, the same pattern as the event entry fee. */
function MoneyField({ label, cents, onChange, error, helper }: {
  label: string;
  cents: number;
  onChange: (cents: number) => void;
  error?: string;
  helper?: ReactNode;
}) {
  const [input, setInput] = useState(() => formatEntryFeeInput(cents));
  return (
    <TextField
      label={label}
      inputMode="decimal"
      value={input}
      error={error}
      helper={helper}
      onChange={(changeEvent) => {
        const value = normalizeEntryFeeInput(changeEvent.target.value);
        setInput(value);
        onChange(parseEntryFeeInputToCents(value));
      }}
      onBlur={() => setInput(formatEntryFeeInput(cents))}
    />
  );
}

const AVERAGE_SOURCE_LABEL: Record<AverageSource, string> = {
  'highest-current-or-last': 'Higher of current or last season',
  current: 'Current season',
  'last-season': 'Last season',
  'organizer-assigned': 'Assigned by the organizer',
};

/** Format rules for one event: handicap, averages, team rules, re-entry scoring, finals, payouts. */
function EventRulesSections({ draft, setDraft, problems }: {
  draft: EventConfig;
  setDraft: (update: (previous: EventConfig) => EventConfig) => void;
  problems: RuleProblem[];
}) {
  const rules = draft.rules ?? defaultEventRules();
  const playerCount = Math.max(draft.minPlayers, draft.maxPlayers, 1);
  const setRules = (patch: Partial<EventRules>) => setDraft((previous) => ({ ...previous, rules: { ...(previous.rules ?? defaultEventRules()), ...patch } }));
  const handicap = draft.scoring === 'handicap' ? rules.handicap : null;
  const finals = rules.finals;
  const cutChoice = finals.cut ? finals.cut.by : 'all';

  const changeFinalsType = (type: FinalsType) => {
    const defaultCut = type === 'cut' ? { by: 'percent' as const, value: 25 } : type === 'stepladder' ? { by: 'count' as const, value: 5 } : null;
    setRules({
      finals: {
        ...finals,
        type,
        cut: type === 'none' ? null : finals.cut ?? defaultCut,
        roundRobinScoring: type === 'round-robin' ? finals.roundRobinScoring ?? 'bonus-pins' : null,
        winBonusPins: type === 'round-robin' ? finals.winBonusPins ?? 30 : null,
      },
    });
  };
  const changeCutChoice = (choice: string) => {
    setRules({ finals: { ...finals, cut: choice === 'all' ? null : { by: choice === 'percent' ? 'percent' : 'count', value: finals.cut?.value ?? 0 } } });
  };

  return (
    <>
      {handicap ? (
        <EditorSection title="Handicap" description="Each game's handicap is a percent of the difference between the basis score and the bowler's average.">
          <div className={styles.grid3}>
            <TextField
              label="Percent"
              type="number"
              min={1}
              max={100}
              value={handicap.percent}
              error={errorFor(problems, 'handicapPercent')}
              onChange={(e) => setRules({ handicap: { ...handicap, percent: Number(e.target.value) } })}
            />
            <TextField
              label="Basis score"
              type="number"
              min={1}
              value={handicap.basis}
              error={errorFor(problems, 'handicapBasis')}
              onChange={(e) => setRules({ handicap: { ...handicap, basis: Number(e.target.value) } })}
            />
            <TextField
              label="Most pins per game"
              optional
              type="number"
              min={0}
              placeholder="No limit"
              value={handicap.maxPins ?? ''}
              error={errorFor(problems, 'handicapMaxPins')}
              onChange={(e) => setRules({ handicap: { ...handicap, maxPins: numberOrNull(e.target.value) } })}
            />
          </div>
          {playerCount === 2 || handicap.perPair ? (
            <CheckboxField
              label="Figure handicap from the pair's combined average"
              checked={handicap.perPair}
              onChange={(e) => setRules({ handicap: { ...handicap, perPair: e.target.checked } })}
            />
          ) : null}
          <p className={styles.helper} aria-live="polite">{handicapExample(handicap)}</p>
        </EditorSection>
      ) : null}

      <EditorSection title="Entering average" description="Which average bowlers enter with, and what happens without one.">
        <FormGrid>
          <SelectField label="Average to use" value={rules.average.source} onChange={(e) => setRules({ average: { ...rules.average, source: e.target.value as AverageSource } })}>
            {(Object.keys(AVERAGE_SOURCE_LABEL) as AverageSource[]).map((source) => <option key={source} value={source}>{AVERAGE_SOURCE_LABEL[source]}</option>)}
          </SelectField>
          <TextField
            label="Minimum games behind the average"
            type="number"
            min={0}
            value={rules.average.minGames}
            error={errorFor(problems, 'averageMinGames')}
            onChange={(e) => setRules({ average: { ...rules.average, minGames: Number(e.target.value) } })}
          />
          <SelectField
            label="Bowlers without an average"
            value={rules.average.noAverage}
            onChange={(e) => setRules({ average: { ...rules.average, noAverage: e.target.value === 'not-eligible' ? 'not-eligible' : 'assigned-average' } })}
          >
            <option value="assigned-average">Bowl with an assigned average</option>
            <option value="not-eligible">Not eligible</option>
          </SelectField>
          {rules.average.noAverage === 'assigned-average' ? (
            <TextField
              label="Assigned average"
              optional
              type="number"
              min={0}
              placeholder="Not set"
              value={rules.average.assignedAverage ?? ''}
              error={errorFor(problems, 'assignedAverage')}
              onChange={(e) => setRules({ average: { ...rules.average, assignedAverage: numberOrNull(e.target.value) } })}
            />
          ) : null}
        </FormGrid>
      </EditorSection>

      {playerCount >= 2 ? (
        <EditorSection title="Team rules" description="Rules for who can bowl together on one entry.">
          <CheckboxField
            label="Mixed: each entry needs at least one man and one woman"
            checked={rules.team.mixedRequired}
            onChange={(e) => setRules({ team: { ...rules.team, mixedRequired: e.target.checked } })}
          />
          <FormGrid>
            <TextField
              label="Combined average limit"
              optional
              type="number"
              min={1}
              placeholder="No limit"
              value={rules.team.combinedAverageMax ?? ''}
              error={errorFor(problems, 'combinedAverageMax')}
              onChange={(e) => setRules({ team: { ...rules.team, combinedAverageMax: numberOrNull(e.target.value) } })}
            />
          </FormGrid>
        </EditorSection>
      ) : null}

      <EditorSection title="Re-entry" description="Whether a bowler may enter this event more than once.">
        <CheckboxField
          label="Allow bowlers to enter this event more than once"
          checked={draft.allowReentry}
          onChange={(e) => {
            const checked = e.target.checked;
            setDraft((previous) => ({ ...previous, allowReentry: checked, maxReentries: checked ? Math.max(previous.maxReentries, 1) : 0 }));
          }}
        />
        {draft.allowReentry ? (
          <FormGrid>
            <SelectField
              label="Re-entry scoring"
              value={rules.reentryScoring}
              onChange={(e) => setRules({ reentryScoring: e.target.value === 'best-counts' ? 'best-counts' : 'all-count' })}
            >
              <option value="all-count">Every set counts</option>
              <option value="best-counts">Only the best set counts</option>
            </SelectField>
          </FormGrid>
        ) : null}
      </EditorSection>

      <EditorSection title="Finals" description="What happens after qualifying.">
        <FormGrid>
          <SelectField label="Finals" value={finals.type} onChange={(e) => changeFinalsType(e.target.value as FinalsType)}>
            {(Object.keys(FINALS_LABEL) as FinalsType[]).map((type) => <option key={type} value={type}>{FINALS_LABEL[type]}</option>)}
          </SelectField>
          {finals.type !== 'none' ? (
            <SelectField label="Who advances" value={cutChoice} onChange={(e) => changeCutChoice(e.target.value)}>
              {finals.type !== 'cut' ? <option value="all">Everyone</option> : null}
              <option value="count">A set number of bowlers</option>
              <option value="percent">A percent of the field</option>
            </SelectField>
          ) : null}
          {finals.type !== 'none' && finals.cut ? (
            <TextField
              label={finals.cut.by === 'percent' ? 'Percent who advance' : 'Bowlers who advance'}
              type="number"
              min={1}
              max={finals.cut.by === 'percent' ? 100 : undefined}
              value={finals.cut.value || ''}
              error={errorFor(problems, 'cutValue')}
              onChange={(e) => {
                const value = Number(e.target.value);
                setRules({ finals: { ...finals, cut: { by: finals.cut?.by ?? 'count', value } } });
              }}
            />
          ) : null}
          {finals.type === 'round-robin' ? (
            <SelectField
              label="Round robin scoring"
              value={finals.roundRobinScoring ?? 'bonus-pins'}
              onChange={(e) => setRules({ finals: { ...finals, roundRobinScoring: e.target.value === 'petersen' ? 'petersen' : 'bonus-pins' } })}
            >
              <option value="bonus-pins">Bonus pins for each win</option>
              <option value="petersen">Petersen points</option>
            </SelectField>
          ) : null}
          {finals.type === 'round-robin' && finals.roundRobinScoring !== 'petersen' ? (
            <TextField
              label="Bonus pins for a win"
              type="number"
              min={0}
              value={finals.winBonusPins ?? ''}
              helper="A tie usually earns half."
              onChange={(e) => setRules({ finals: { ...finals, winBonusPins: numberOrNull(e.target.value) } })}
            />
          ) : null}
          {finals.type !== 'none' ? (
            <TextAreaField
              label="Finals notes"
              optional
              fullRow
              placeholder="For example: Top 5 bowl a stepladder, one game per match."
              value={finals.notes}
              onChange={(e) => setRules({ finals: { ...finals, notes: e.target.value } })}
            />
          ) : null}
        </FormGrid>
        {finals.type !== 'none' || rules.payoutRatio ? (
          <div className={styles.checkboxGroup}>
            {/* Visible label; the segmented control carries the same accessible name. */}
            <span className={styles.legend} aria-hidden="true">Finals are for</span>
            <SegmentedControl<FinalsScope>
              label="Finals are for"
              value={finals.scope}
              onChange={(scope) => setRules({ finals: { ...finals, scope } })}
              options={[
                { value: 'tournament', label: 'Whole tournament' },
                { value: 'squad', label: 'Each squad' },
              ]}
            />
            <p className={styles.helper}>Each squad has its own standings, cut, prize fund, and finals.</p>
          </div>
        ) : null}
      </EditorSection>

      <EditorSection title="Payouts and membership">
        <FormGrid>
          <TextField
            label="Entries per cash prize"
            optional
            type="number"
            min={1}
            placeholder="Not stated"
            value={rules.payoutRatio ?? ''}
            error={errorFor(problems, 'payoutRatio')}
            helper={payoutRatioText(rules.payoutRatio) ?? 'For example, 5 means about 1 in 5 entries cash.'}
            onChange={(e) => setRules({ payoutRatio: numberOrNull(e.target.value) })}
          />
        </FormGrid>
        <CheckboxField
          label="Bowlers must have a current USBC membership"
          checked={rules.usbcRequired}
          onChange={(e) => setRules({ usbcRequired: e.target.checked })}
        />
      </EditorSection>
    </>
  );
}

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
  const rules = draft.rules ?? defaultEventRules();
  const ruleProblems = eventRuleProblems(draft);
  const rulesAreInvalid = ruleProblems.some((problem) => problem.severity === 'error');
  const isValid = Boolean(draft.name.trim()) && requiredBowlerCount >= 1 && !squadsAreInvalid && !divisionsAreInvalid && !rulesAreInvalid;

  /** Suggests the usual team size for the new format unless the organizer already changed it. */
  const changeFormat = (format: EventFormat) => {
    setDraft((previous) => {
      const previousRules = previous.rules ?? defaultEventRules();
      const count = Math.max(previous.minPlayers, previous.maxPlayers, 1);
      const players = count === FORMAT_PLAYERS[previousRules.format] ? FORMAT_PLAYERS[format] : count;
      const handicap = previousRules.handicap ? { ...previousRules.handicap, perPair: format === 'scotch-doubles' } : null;
      return { ...previous, minPlayers: players, maxPlayers: players, rules: { ...previousRules, format, handicap } };
    });
  };
  const changeScoring = (scoring: EventConfig['scoring']) => {
    setDraft((previous) => {
      const previousRules = previous.rules ?? defaultEventRules();
      const handicap = scoring === 'handicap' ? previousRules.handicap ?? defaultEventRules(previousRules.format, 'handicap').handicap : null;
      return { ...previous, scoring, rules: { ...previousRules, handicap } };
    });
  };

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

      <EditorSection title="Format and pricing" description="How the event is bowled, team size, scoring method, games, and entry price.">
        <div className={styles.grid3}>
          <SelectField label="Format" value={rules.format} onChange={(e) => changeFormat(e.target.value as EventFormat)}>
            {(Object.keys(EVENT_FORMAT_LABEL) as EventFormat[]).map((format) => <option key={format} value={format}>{EVENT_FORMAT_LABEL[format]}</option>)}
          </SelectField>
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
          <TextField
            label="Games"
            optional
            type="number"
            min={0}
            placeholder="Not stated"
            value={rules.games || ''}
            error={errorFor(ruleProblems, 'games')}
            onChange={(e) => setDraft({ ...draft, rules: { ...rules, games: Number(e.target.value) || 0 } })}
          />
          <SelectField label="Scoring" value={draft.scoring} onChange={(e) => changeScoring(e.target.value as EventConfig['scoring'])}>
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

      <EventRulesSections draft={draft} setDraft={setDraft} problems={ruleProblems} />

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
  const [draft, setDraft] = useState<DivisionConfig>(() => ({ ...division, rules: division.rules ?? defaultDivisionRules() }));
  const divisionRules = draft.rules ?? defaultDivisionRules();
  const setDivisionRules = (patch: Partial<DivisionRules>) => setDraft((previous) => ({ ...previous, rules: { ...(previous.rules ?? defaultDivisionRules()), ...patch } }));
  const isDirty = JSON.stringify(draft) !== JSON.stringify({ ...division, rules: division.rules ?? defaultDivisionRules() });
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
          <SelectField label="Gender" value={divisionRules.gender} onChange={(e) => setDivisionRules({ gender: e.target.value as DivisionRules['gender'] })}>
            <option value="any">Any</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </SelectField>
          <SelectField
            label="Prizes"
            value={divisionRules.prizeType}
            helper={divisionRules.prizeType === 'scholarship' ? 'Scholarships protect youth bowlers\' amateur eligibility.' : undefined}
            onChange={(e) => setDivisionRules({ prizeType: e.target.value === 'scholarship' ? 'scholarship' : 'cash' })}
          >
            <option value="cash">Cash</option>
            <option value="scholarship">Scholarship</option>
          </SelectField>
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
  const [draft, setDraft] = useState<FeeConfig>(() => ({ ...fee, required: false, sideEvent: fee.sideEvent ?? normalizeSideEvent(undefined) }));
  const sideEvent: SideEventSettings = draft.sideEvent ?? defaultSideEvent('fee');
  const brackets = sideEvent.kind === 'brackets' ? sideEvent.brackets : null;
  const problems = sideEventProblems(draft);
  const payoutWarning = problems.find((problem) => problem.field === 'bracketPayouts');
  const hasErrors = problems.some((problem) => problem.severity === 'error');
  const setSideEvent = (patch: Partial<SideEventSettings>) => setDraft((previous) => ({ ...previous, sideEvent: { ...(previous.sideEvent ?? defaultSideEvent('fee')), ...patch } }));
  const setBrackets = (patch: Partial<BracketRules>) => {
    if (!brackets) return;
    setSideEvent({ brackets: { ...brackets, ...patch } });
  };
  const changeKind = (kind: SideEventKind) => {
    setDraft((previous) => {
      const previousLabel = previous.sideEvent ? SIDE_EVENT_LABEL[previous.sideEvent.kind] : '';
      const keepsName = previous.name.trim() && previous.name !== previousLabel;
      return {
        ...previous,
        name: keepsName || kind === 'fee' ? previous.name : SIDE_EVENT_LABEL[kind],
        sideEvent: defaultSideEvent(kind),
      };
    });
  };
  const scopeGroups: Array<{ legend: string; items: Array<{ id: string; name: string }>; key: 'eventIds' | 'divisionIds' | 'squadIds' }> = [
    { legend: 'Events', items: events, key: 'eventIds' },
    { legend: 'Divisions', items: divisions, key: 'divisionIds' },
    { legend: 'Squads', items: squads, key: 'squadIds' },
  ];

  return (
    <EditorForm onSubmit={() => onSave({ ...draft, required: false })}>
      <EditorSection first title="Add-on" description="Base entry fees are set in each event.">
        <FormGrid>
          <SelectField label="Type" value={sideEvent.kind} onChange={(e) => changeKind(e.target.value as SideEventKind)}>
            {(Object.keys(SIDE_EVENT_LABEL) as SideEventKind[]).map((kind) => <option key={kind} value={kind}>{SIDE_EVENT_LABEL[kind]}</option>)}
          </SelectField>
          <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <MoneyField label="Price (USD)" cents={draft.amountCents} onChange={(amountCents) => setDraft((previous) => ({ ...previous, amountCents }))} />
          <SelectField label="Charged" value={sideEvent.per} onChange={(e) => setSideEvent({ per: e.target.value === 'registration' ? 'registration' : 'bowler' })}>
            <option value="bowler">Per bowler</option>
            <option value="registration">Once per registration</option>
          </SelectField>
        </FormGrid>
        <CheckboxField
          label="Bowlers choose a quantity"
          helper="For example, 5 brackets. Otherwise it's yes or no."
          checked={sideEvent.allowQuantity}
          onChange={(e) => setSideEvent({ allowQuantity: e.target.checked, maxQuantity: e.target.checked ? sideEvent.maxQuantity : null })}
        />
        {sideEvent.allowQuantity ? (
          <FormGrid>
            <TextField
              label="Most a bowler can buy"
              optional
              type="number"
              min={1}
              placeholder="No limit"
              value={sideEvent.maxQuantity ?? ''}
              error={errorFor(problems, 'maxQuantity')}
              onChange={(e) => setSideEvent({ maxQuantity: numberOrNull(e.target.value) })}
            />
          </FormGrid>
        ) : null}
        <CheckboxField label="Offer this add-on" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
      </EditorSection>

      {brackets ? (
        <EditorSection title="Brackets" description="Single elimination over three games, using each bowler's main event scores.">
          <div className={styles.grid3}>
            <SelectField label="Scoring" value={brackets.scoring} onChange={(e) => setBrackets({ scoring: e.target.value === 'scratch' ? 'scratch' : 'handicap' })}>
              <option value="handicap">Handicap</option>
              <option value="scratch">Scratch</option>
            </SelectField>
            <TextField
              label="Bowlers per bracket"
              type="number"
              min={2}
              value={brackets.size || ''}
              error={errorFor(problems, 'bracketSize')}
              onChange={(e) => setBrackets({ size: Number(e.target.value) || 0 })}
            />
            <MoneyField label="1st place (USD)" cents={brackets.firstPlaceCents} onChange={(firstPlaceCents) => setBrackets({ firstPlaceCents })} />
            <MoneyField label="2nd place (USD)" cents={brackets.secondPlaceCents} onChange={(secondPlaceCents) => setBrackets({ secondPlaceCents })} />
            <MoneyField label="House (USD)" cents={brackets.houseCents} onChange={(houseCents) => setBrackets({ houseCents })} />
          </div>
          <CheckboxField
            label="Refund entries in brackets that don't fill"
            checked={brackets.refundUnfilled}
            onChange={(e) => setBrackets({ refundUnfilled: e.target.checked })}
          />
          <p className={styles.helper} aria-live="polite">{bracketPayoutSummary(draft.amountCents, brackets)}</p>
          {payoutWarning ? <Notice tone="warning" role="status">{payoutWarning.message}</Notice> : null}
        </EditorSection>
      ) : null}

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

      <EditorActions saveLabel="Save add-on" canSave={!hasErrors} />
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
