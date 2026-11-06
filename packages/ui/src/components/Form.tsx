'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ICON_SIZE } from '../iconSize';
import { cx } from './cx';
import styles from './Form.module.css';

interface FieldFrameProps {
  label: ReactNode;
  /** Marks the field "(optional)". Required fields are not marked. */
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  /** Span both columns of a `FormGrid`. */
  fullRow?: boolean;
  /** Keep the label for screen readers only (table toolbars). Visible labels are the default. */
  hideLabel?: boolean;
  className?: string;
}

function useFieldIds(id?: string) {
  const generated = useId();
  const controlId = id ?? `field-${generated}`;
  return { controlId, helperId: `${controlId}-helper`, errorId: `${controlId}-error` };
}

function FieldFrame({
  label,
  optional,
  helper,
  error,
  fullRow,
  hideLabel,
  className,
  controlId,
  helperId,
  errorId,
  children,
}: FieldFrameProps & { controlId: string; helperId: string; errorId: string; children: ReactNode }) {
  return (
    <div className={cx(styles.field, fullRow && styles.span2, className)}>
      <label htmlFor={controlId} className={hideLabel ? 'sr-only' : styles.label}>
        {label}
        {optional ? <span className={styles.optional}> (optional)</span> : null}
      </label>
      {children}
      {error ? (
        <span id={errorId} className={styles.error}>{error}</span>
      ) : helper ? (
        <span id={helperId} className={styles.helper}>{helper}</span>
      ) : null}
    </div>
  );
}

function describedBy(helper: ReactNode, error: ReactNode, helperId: string, errorId: string): string | undefined {
  if (error) return errorId;
  if (helper) return helperId;
  return undefined;
}

export interface TextFieldProps extends FieldFrameProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {}

/** Label above, control, then helper or error text. */
export function TextField({ label, optional, helper, error, fullRow, hideLabel, className, id, ...inputProps }: TextFieldProps) {
  const { controlId, helperId, errorId } = useFieldIds(id);
  return (
    <FieldFrame {...{ label, optional, helper, error, fullRow, hideLabel, className, controlId, helperId, errorId }}>
      <input
        id={controlId}
        className={cx(styles.control, error ? styles.invalid : undefined)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(helper, error, helperId, errorId)}
        {...inputProps}
      />
    </FieldFrame>
  );
}

export interface SelectFieldProps extends FieldFrameProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  children: ReactNode;
}

export function SelectField({ label, optional, helper, error, fullRow, hideLabel, className, id, children, ...selectProps }: SelectFieldProps) {
  const { controlId, helperId, errorId } = useFieldIds(id);
  return (
    <FieldFrame {...{ label, optional, helper, error, fullRow, hideLabel, className, controlId, helperId, errorId }}>
      <select
        id={controlId}
        className={cx(styles.control, error ? styles.invalid : undefined)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(helper, error, helperId, errorId)}
        {...selectProps}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

export interface TextAreaFieldProps extends FieldFrameProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {}

export function TextAreaField({ label, optional, helper, error, fullRow, hideLabel, className, id, ...areaProps }: TextAreaFieldProps) {
  const { controlId, helperId, errorId } = useFieldIds(id);
  return (
    <FieldFrame {...{ label, optional, helper, error, fullRow, hideLabel, className, controlId, helperId, errorId }}>
      <textarea
        id={controlId}
        className={cx(styles.control, styles.textarea, error ? styles.invalid : undefined)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(helper, error, helperId, errorId)}
        {...areaProps}
      />
    </FieldFrame>
  );
}

export interface SearchFieldProps extends Omit<TextFieldProps, 'type' | 'optional'> {}

/** A search input with a leading icon. The label is screen-reader-only unless `hideLabel={false}`. */
export function SearchField({ label, helper, error, fullRow, hideLabel = true, className, id, ...inputProps }: SearchFieldProps) {
  const { controlId, helperId, errorId } = useFieldIds(id);
  return (
    <FieldFrame {...{ label, helper, error, fullRow, hideLabel, className, controlId, helperId, errorId }}>
      <span className={styles.searchWrap}>
        <svg className={styles.searchIcon} width={ICON_SIZE.md} height={ICON_SIZE.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          id={controlId}
          type="search"
          className={cx(styles.control, styles.searchControl, error ? styles.invalid : undefined)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(helper, error, helperId, errorId)}
          {...inputProps}
        />
      </span>
    </FieldFrame>
  );
}

/** Two columns on desktop, one on phones. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.formGrid, className)}>{children}</div>;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Shown after the label in secondary text, for example a count. */
  count?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group, for example "Filter tournaments". */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** 2 to 5 mutually exclusive options: filters and simple choices. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cx(styles.segmented, className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            className={cx(styles.segment, selected && styles.segmentSelected)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count !== undefined ? <span className={styles.segmentCount}>{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
